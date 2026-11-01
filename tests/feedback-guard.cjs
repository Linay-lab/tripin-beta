// Serve the Beta locally and intercept every external request; no email is sent.
const {chromium,webkit}=require('playwright'),http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const original=html.match(/<script id="feedback-script">[\s\S]*?<\/script>/)[0];
assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'775bfbb84c24791fb347930c0d0d11ee5198ffa99de0b929b9dbea8e86be8d74');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const bundled=process.env.USE_BUNDLED_CHROMIUM?require('@sparticuz/chromium'):null;
 const engine=process.env.TEST_BROWSER==='mobile-webkit'?webkit:chromium;
 try{for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const browser=await engine.launch({headless:true,...(engine===chromium?{args:bundled?bundled.args:['--no-sandbox']}:{}),...(bundled?{executablePath:await bundled.executablePath()}:{})});
  try{
   const context=await browser.newContext({viewport});let posts=0,mode='hold',release,entered;
   const requestEntered=new Promise(resolve=>{entered=resolve});
   await context.addInitScript(()=>sessionStorage.setItem('travel-studio-beta-auth-v1','yes'));
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin===origin)return route.continue();
    if(url.hostname==='script.google.com'&&route.request().method()==='POST'){
     posts++;
     assert.equal(route.request().headers()['content-type']?.startsWith('application/x-www-form-urlencoded'),true);
     if(mode==='hold'){entered();await new Promise(resolve=>{release=resolve})}
     if(mode==='fail')return route.abort();
     return route.fulfill({status:200,body:'synthetic response'});
    }
    return route.fulfill({status:204,body:''});
   });
   const page=await context.newPage();await page.goto(origin);
   const submit=async(content,extra='')=>page.evaluate(async({content,extra})=>{
    document.getElementById('feedbackText').value=content;
    document.getElementById('feedbackContact').value=extra;
    await window.saveFeedback({preventDefault(){}});
   },{content,extra});
   await page.evaluate(()=>openFeedback());
   await submit('x'.repeat(3001));await submit('valid','x'.repeat(201));await submit('   ');
   assert.equal(posts,0);assert.equal(await page.locator('#feedbackCount').innerText(),'0');
   await page.locator('#feedbackText').fill('synthetic feedback');
   await page.locator('#feedbackForm button[type=submit]').click();await requestEntered;
   assert(await page.locator('#feedbackForm button[type=submit]').isDisabled());
   await submit('second while pending');assert.equal(posts,1);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('travel-studio-v18-feedback-v1')).length),1);
   release();await page.waitForFunction(()=>document.getElementById('feedbackStatus').textContent.includes('傳送請求'));
   assert.equal(await page.locator('#feedbackForm button[type=submit]').isEnabled(),true);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('travel-studio-v18-feedback-v1'))[0].delivery),'submitted_unverified');
   mode='fail';await submit('<img src=x onerror="window.__feedbackGuardXss=1">');
   assert((await page.locator('#feedbackStatus').innerText()).includes('失敗'));
   assert.equal(await page.locator('#feedbackList img').count(),0);
   assert.equal(await page.evaluate(()=>window.__feedbackGuardXss),undefined);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('travel-studio-v18-feedback-v1')).length),2);
   assert.equal(await page.locator('#feedbackForm button[type=submit]').isEnabled(),true);
   assert.equal(posts,2);
   console.log('PASS preserved GAS script, input limits, pending submit lock, unverified status, failed-request retention and HTML escaping '+viewport.width+'px');
  }finally{await browser.close()}
 }}finally{server.close();server.closeAllConnections()}
})().catch(error=>{console.error(error);process.exitCode=1});
