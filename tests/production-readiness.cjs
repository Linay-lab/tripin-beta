const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const checks=[];
function check(name,fn){try{fn();checks.push({name,status:'PASS'})}catch(e){checks.push({name,status:'FAIL',reason:e.message});process.exitCode=1}}
check('Beta 仍為本機展示登入，不能誤認為正式 Auth',()=>{assert(html.includes('travel-studio-beta-auth-v1'));assert(html.includes('本機測試'));});
check('Beta 使用本機儲存而非假裝雲端同步',()=>{assert(html.includes('travel_studio_beta_v3'));assert(/localStorage\.setItem\(/.test(html));});
check('回饋功能使用既有端點，沒有在前端放入伺服器金鑰',()=>{assert(html.includes('FEEDBACK_ENDPOINT'));assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(html));assert(!/\bservice_role\b/.test(html));});
check('GPS 需要使用者主動啟用',()=>{assert(html.includes('啟用定位提醒'));assert(html.includes('watchPosition'));});
check('正式版安全驗收文件存在',()=>{const doc=fs.readFileSync(path.join(__dirname,'../docs/PRODUCTION-SECURITY-ROADMAP.md'),'utf8');for(const key of ['owner_id','RLS','備份','跨帳號','限流'])assert(doc.includes(key),'Missing: '+key);});
const out=path.resolve(process.env.TEST_OUTPUT_DIR||path.join(__dirname,'../test-results'));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'production-readiness.json'),JSON.stringify({scope:'Beta risk visibility and documentation checks; NOT a production security audit',checks},null,2));console.log(JSON.stringify(checks,null,2));
