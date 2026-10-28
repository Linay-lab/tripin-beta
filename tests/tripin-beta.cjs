const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const engine=process.env.TEST_BROWSER==='mobile-webkit'?webkit:chromium;
const results=[];
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(html)}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 let browser;
 try{
  browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:process.env.TEST_BROWSER?.startsWith('mobile')||false});
  await context.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>authView('register'));
  await page.locator('#authEmail').fill('tripin-beta@example.com');
  await page.locator('#authPass').fill('test-pass-123');
  await page.locator('#authConfirm').fill('test-pass-123');
  await page.locator('#authRoot button[type=submit]').click();
  const check=async(name,fn)=>{try{await fn();results.push({name,status:'PASS'})}catch(e){results.push({name,status:'FAIL',error:String(e)});process.exitCode=1}};
  await check('TRIPIN 品牌與原有資料鍵值保留',async()=>{assert((await page.title()).includes('TRIPIN'));assert(html.includes("const KEY='travel_studio_beta_v3'"));assert(html.includes('id="feedback-script"'))});
  await check('手機版底部導覽列為五個主要入口',async()=>{
   await page.evaluate(()=>go('home'));
   const labels=await page.locator('#bottom button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
   assert.deepEqual(labels,['⌂ 首頁','✈ 我的旅行','▣ 購物清單','▤ 行程規劃','♙ 個人中心']);
  });
  await check('首頁呈現所有旅行封面卡片',async()=>{
   await page.evaluate(()=>{data.trips.push({id:'t2',name:'台南旅行',country:'台灣',city:'台南',start:'2026-12-01',end:'2026-12-02'});go('home')});
   assert.equal(await page.locator('.v4-tripcard').count(),2);
  });
  await check('找店功能由使用者手動啟動且排除已購商品',async()=>{
   await page.evaluate(()=>go('shopping'));
   const select=page.locator('[aria-label="選擇待購商品"]');
   assert(await select.count()===1);
   assert((await select.locator('option').allTextContents()).some(x=>x.includes('紅芋')));
   assert(!(await select.locator('option').allTextContents()).some(x=>x.includes('黑糖')));
   assert.equal(await page.getByRole('dialog',{name:'幫我找店家'}).count(),0);
   await select.selectOption('i1');
   await page.locator('[data-tripin-find]').click();
   assert.equal(await page.getByRole('dialog',{name:'幫我找店家'}).count(),1);
   assert.equal(await page.locator('[name=product]').inputValue(),'沖繩紅芋塔');
   assert((await page.getByRole('dialog',{name:'幫我找店家'}).innerText()).includes('庫存狀態：未知'));
   await page.locator('[name=storeName]').fill('御菓子御殿 國際通店');
   await page.locator('[name=storeLat]').fill('26.215');
   await page.locator('[name=storeLng]').fill('127.68');
   await page.locator('[data-link-store]').click();
   const linked=await page.evaluate(()=>({item:data.items.find(x=>x.id==='i1'),stores:data.shoppingPlaces}));
   assert.equal(linked.stores.length,1);
   assert.equal(linked.item.shoppingPlaceId,linked.stores[0].id);
   assert.equal(linked.stores[0].lat,26.215);
   assert.equal(linked.stores[0].lng,127.68);
   await page.locator('[data-close]').click();
  });
  await check('新增功能無 JavaScript 執行錯誤',async()=>assert.deepEqual(errors,[]));
  await context.close();
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 const output=path.resolve(process.env.TEST_OUTPUT_DIR||path.join(__dirname,'../test-results'));fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'tripin-beta.json'),JSON.stringify({results},null,2));
 console.log(JSON.stringify(results,null,2));
});
