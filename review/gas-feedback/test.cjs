'use strict';
// All Google services are in-memory doubles. No mail, Sheets or network calls.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/Code.gs','utf8');
const base={id:'feedback_1',page:'首頁',kind:'改善建議',content:'synthetic feedback',extra:'',createdAt:'2026-10-31T00:00:00.000Z',website:'https://linay-lab.github.io/tripin-beta/',trap:''};
function harness(options={}){
 const state={sheets:new Map(),props:new Map([['NOTIFY_EMAIL','owner@example.invalid'],...Object.entries(options.properties||{})]),mails:[],attempts:0,held:false,time:Date.parse('2026-10-31T00:00:00Z'),flushes:0,options};
 class Sheet{
  constructor(name){this.name=name;this.rows=[]}
  getLastRow(){return this.rows.length}
  appendRow(values){if(state.options.failAppendData===this.name&&this.rows.length>0)throw Error('PRIVATE-DETAIL');this.rows.push([...values]);return this}
  getRange(row,col,numRows=1,numCols=1){const sheet=this;return {
   getValues:()=>Array.from({length:numRows},(_,i)=>Array.from({length:numCols},(_,j)=>sheet.rows[row+i-1]?.[col+j-1]??'')),
   setValues:values=>{if(state.options.failState&&values[0]?.[2]===state.options.failState)throw Error('PRIVATE-DETAIL');for(let i=0;i<numRows;i++){sheet.rows[row+i-1]??=[];for(let j=0;j<numCols;j++)sheet.rows[row+i-1][col+j-1]=values[i][j]}},
   createTextFinder:text=>{const finder={matchEntireCell:()=>finder,matchCase:()=>finder,useRegularExpression:()=>finder,findNext:()=>{for(let i=row-1;i<row-1+numRows;i++)if(String(sheet.rows[i]?.[col-1]??'')===text)return {getRow:()=>i+1};return null}};return finder}
  }}
 }
 const ss={getSheetByName:name=>state.sheets.get(name)||null,insertSheet:name=>{const sheet=new Sheet(name);state.sheets.set(name,sheet);return sheet}};
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[state.time]))}static now(){return state.time}}
 const globals={Date:ClockDate,ContentService:{createTextOutput:value=>String(value)},PropertiesService:{getScriptProperties:()=>({getProperty:key=>state.props.get(key)??null,setProperty:(key,value)=>state.props.set(key,value)})},
  LockService:{getScriptLock:()=>({tryLock:()=>{if(state.options.busy||state.held)return false;state.held=true;return true},releaseLock:()=>{assert(state.held);state.held=false}})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>state.options.noSheet?null:ss,flush:()=>{state.flushes++}},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(algorithm,text)=>[...crypto.createHash(algorithm).update(text).digest()],base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),formatDate:date=>date.toISOString().slice(0,10)},
  MailApp:{getRemainingDailyQuota:()=>{if(state.options.quotaThrows)throw Error('PRIVATE-DETAIL');return state.options.quota??100},sendEmail:mail=>{state.attempts++;if(state.options.reenter){const action=state.options.reenter;state.options.reenter=null;action()}
   if(state.options.sendThrowsBefore)throw Error('PRIVATE-DETAIL');state.mails.push(mail);if(state.options.sendThrowsAfter)throw Error('PRIVATE-DETAIL')}}};
 function restart(){state.context=vm.createContext(globals);vm.runInContext(source,state.context)}restart();
 state.restart=restart;
 state.event=(overrides={})=>{const parameter={...base,...overrides},contents=new URLSearchParams(parameter).toString();return {parameter,parameters:Object.fromEntries(Object.entries(parameter).map(([key,value])=>[key,[value]])),postData:{type:'application/x-www-form-urlencoded;charset=UTF-8',contents,length:Buffer.byteLength(contents)}}};
 state.post=overrides=>state.context.doPost(state.event(overrides));
 state.sheet=name=>state.sheets.get(name);
 state.status=()=>state.sheet('旅購回饋狀態')?.rows[1]?.[2];
 return state;
}
const checks=[];
function test(name,fn){try{fn();checks.push({name,pass:true})}catch(error){checks.push({name,pass:false,detail:error.message})}}
test('Happy path preserves columns, recipient and real newlines',()=>{const h=harness();assert.equal(h.post(),'OK');assert.equal(h.attempts,1);assert.equal(h.mails[0].to,'owner@example.invalid');assert(h.mails[0].body.includes('\n'));assert(!h.mails[0].body.includes('\\n'));assert.equal(h.sheet('旅購回饋').rows[0].length,8);assert.equal(h.status(),'SENT');assert(!h.held)});
test('Durable duplicate protection survives a new execution',()=>{const h=harness();h.post();h.restart();assert.equal(h.post(),'DUPLICATE');assert.equal(h.attempts,1);assert.equal(h.sheet('旅購回饋').rows.length,2)});
test('ID reused for different content is rejected',()=>{const h=harness();h.post();assert.equal(h.post({content:'changed'}),'CONFLICT');assert.equal(h.attempts,1)});
test('Legacy rows are adopted without a second email',()=>{const h=harness();h.post();h.sheets.delete('旅購回饋狀態');h.restart();assert.equal(h.post(),'DUPLICATE');assert.equal(h.attempts,1);assert.equal(h.status(),'LEGACY_RECORDED')});
test('Send exception before delivery is not automatically retried',()=>{const h=harness({sendThrowsBefore:true});assert.equal(h.post(),'ERROR');assert.equal(h.status(),'SEND_UNCERTAIN');h.options.sendThrowsBefore=false;assert.equal(h.post(),'DUPLICATE');assert.equal(h.attempts,1);assert.equal(h.mails.length,0)});
test('Uncertain delivery cannot generate a duplicate email',()=>{const h=harness({sendThrowsAfter:true});assert.equal(h.post(),'ERROR');assert.equal(h.mails.length,1);assert.equal(h.status(),'SEND_UNCERTAIN');assert.equal(h.post(),'DUPLICATE');assert.equal(h.attempts,1)});
test('Failure to commit SENT remains uncertain and cannot resend',()=>{const h=harness({failState:'SENT'});assert.equal(h.post(),'ERROR');assert.equal(h.status(),'SEND_UNCERTAIN');assert.equal(h.post(),'DUPLICATE');assert.equal(h.attempts,1)});
test('Write failure never calls MailApp and releases lock',()=>{const h=harness({failAppendData:'旅購回饋'});assert.equal(h.post(),'ERROR');assert.equal(h.status(),'WRITE_FAILED');assert.equal(h.attempts,0);assert(!h.held)});
test('Quota exhaustion still records feedback without mailing',()=>{const h=harness({quota:0});assert.equal(h.post(),'RECORDED_NO_EMAIL');assert.equal(h.status(),'QUOTA_BLOCKED');assert.equal(h.attempts,0);assert.equal(h.post(),'DUPLICATE')});
test('Quota service failure preserves record without claiming delivery',()=>{const h=harness({quotaThrows:true});assert.equal(h.post(),'ERROR');assert.equal(h.status(),'RECORDED_NO_EMAIL');assert.equal(h.attempts,0);assert.equal(h.sheet('旅購回饋').rows.length,2)});
test('Minute admission limit rejects new feedback',()=>{const h=harness({properties:{MAX_PER_MINUTE:'2'}});assert.equal(h.post({id:'one'}),'OK');assert.equal(h.post({id:'two'}),'OK');assert.equal(h.post({id:'three'}),'RATE_LIMIT');assert.equal(h.attempts,2)});
test('Daily limit remains enforced across minutes and resets on UTC day',()=>{const h=harness({properties:{MAX_PER_DAY:'2'}});h.post({id:'one'});h.time+=61000;h.post({id:'two'});h.time+=61000;assert.equal(h.post({id:'three'}),'RATE_LIMIT');h.time+=86400000;assert.equal(h.post({id:'four'}),'OK');assert.equal(h.attempts,3)});
test('Duplicate does not consume another admission slot',()=>{const h=harness({properties:{MAX_PER_MINUTE:'1'}});h.post();assert.equal(h.post(),'DUPLICATE');assert.equal(h.post({id:'another'}),'RATE_LIMIT');assert.equal(h.attempts,1)});
test('Concurrent/reentrant request cannot enter locked sender',()=>{const h=harness();let nested;h.options.reenter=()=>{nested=h.post({id:'nested'})};assert.equal(h.post(),'OK');assert.equal(nested,'BUSY');assert.equal(h.attempts,1);assert(!h.held)});
test('Busy lock creates no rows or emails',()=>{const h=harness({busy:true});assert.equal(h.post(),'BUSY');assert.equal(h.sheets.size,0);assert.equal(h.attempts,0)});
test('Honeypot exits without accessing Sheets or Mail',()=>{const h=harness();assert.equal(h.post({trap:'bot'}),'OK');assert.equal(h.sheets.size,0);assert.equal(h.attempts,0)});
test('Formula and control-prefixed cells are stored as text',()=>{const h=harness();h.post({content:'\t=IMPORTXML("synthetic")',extra:' +synthetic'});assert(h.sheet('旅購回饋').rows[1][4].startsWith("'="));assert(h.sheet('旅購回饋').rows[1][5].startsWith("'+"));assert.equal(h.context.feedbackSafeCell_('\nplain'),"'\nplain")});
test('URL query and fragment are not retained in Sheet or email',()=>{const h=harness();h.post({website:base.website+'?token=SYNTHETIC#private'});assert.equal(h.sheet('旅購回饋').rows[1][7],base.website);assert(!h.mails[0].body.includes('SYNTHETIC'))});
for(const [name,overrides] of [['empty content',{content:' '}],['oversized content',{content:'x'.repeat(3001)}],['oversized extra',{extra:'x'.repeat(201)}],['invalid ID',{id:'=formula'}],['unknown page',{page:'unknown'}],['subject header injection',{kind:'改善建議\r\nBcc: outsider@example.invalid'}],['invalid timestamp',{createdAt:'yesterday'}],['HTTP URL',{website:'http://linay-lab.github.io/'}],['host lookalike',{website:'https://linay-lab.github.io.attacker.invalid/'}],['URL credentials',{website:'https://user:pass@linay-lab.github.io/'}],['recipient override',{to:'outsider@example.invalid'}]])test('Reject '+name,()=>{const h=harness();assert.equal(h.post(overrides),'INVALID');assert.equal(h.attempts,0);assert.equal(h.sheets.size,0)});
test('Duplicate form parameters are rejected',()=>{const h=harness(),e=h.event();e.parameters.id=['a','b'];assert.equal(h.context.doPost(e),'INVALID');assert.equal(h.attempts,0)});
test('Oversized request is rejected before writing',()=>{const h=harness(),e=h.event();e.postData.length=65537;assert.equal(h.context.doPost(e),'INVALID');assert.equal(h.sheets.size,0)});
test('Unexpected JSON content type is rejected',()=>{const h=harness(),e=h.event();e.postData.type='application/json';assert.equal(h.context.doPost(e),'INVALID')});
test('Impossible calendar date is rejected',()=>{const h=harness();assert.equal(h.post({createdAt:'2026-02-30T00:00:00.000Z'}),'INVALID')});
test('Control characters in source URLs are rejected',()=>{const h=harness();assert.equal(h.post({website:base.website+'\tprivate'}),'INVALID')});
test('Email misconfiguration does not leak raw values',()=>{const h=harness({properties:{NOTIFY_EMAIL:'first@example.invalid,second@example.invalid'}});assert.equal(h.post(),'CONFIG_ERROR');assert.equal(h.attempts,0)});
test('Bound spreadsheet absence fails closed',()=>{const h=harness({noSheet:true});assert.equal(h.post(),'CONFIG_ERROR');assert(!h.held);assert.equal(h.attempts,0)});
test('Corrupt rate state is not silently reset',()=>{const h=harness({properties:{TS_FEEDBACK_RATE_V2:'invalid'}});assert.equal(h.post(),'ERROR');assert.equal(h.attempts,0);assert(!h.held)});
test('Existing header mismatch is not overwritten',()=>{const h=harness();h.post();h.sheet('旅購回饋').rows[0][0]='custom';assert.equal(h.post({id:'different'}),'ERROR');assert.equal(h.sheet('旅購回饋').rows[0][0],'custom');assert.equal(h.attempts,1)});
test('Editor setup check reads only and exposes no private values',()=>{const h=harness(),r=h.context.feedbackReviewSetup();assert(r.recipientConfigured&&r.boundSpreadsheet&&r.headersCompatible&&r.mailQuotaAvailable);assert.equal(h.attempts,0);assert.equal(h.sheets.size,0);assert.equal(h.props.size,1);assert(!JSON.stringify(r).includes('@'))});
const report={scope:'Node in-memory Google service doubles; no real mail, Sheets, quota or deployment',total:checks.length,passed:checks.filter(c=>c.pass).length,checks};
fs.writeFileSync(__dirname+'/results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({total:report.total,passed:report.passed,failures:checks.filter(c=>!c.pass)},null,2));
if(report.passed!==report.total)process.exitCode=1;
