'use strict';
// Dedicated test project only. Never log tokens or raw responses.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const ORIGIN='https://xxzchaewtmctplhamwwi.supabase.co';
const required=['TRIPIN_TEST_SUPABASE_URL','TRIPIN_TEST_SUPABASE_ANON_KEY','TRIPIN_TEST_USER_A_TOKEN','TRIPIN_TEST_USER_B_TOKEN'];
if(required.some(k=>!process.env[k])||process.env.TRIPIN_TEST_ISOLATED_PROJECT!=='YES'){console.error('NOT RUN: isolated-project confirmation and four test secrets are required. No requests made.');process.exit(2)}
if(process.env.TRIPIN_TEST_SUPABASE_URL.replace(/\/$/,'')!==ORIGIN){console.error('NOT RUN: only the approved nonproduction project is permitted.');process.exit(2)}
const key=process.env.TRIPIN_TEST_SUPABASE_ANON_KEY,A=process.env.TRIPIN_TEST_USER_A_TOKEN,B=process.env.TRIPIN_TEST_USER_B_TOKEN;
function claims(token){try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString())}catch{throw Error('Invalid JWT format')}}
if(!key.startsWith('sb_publishable_'))assert.equal(claims(key).role,'anon','Only publishable or anon keys are allowed');
assert(A!==B,'Two different test users required');
for(const token of [A,B]){const p=claims(token);assert.equal(p.role,'authenticated');assert(p.exp>Date.now()/1000+120,'Refresh short-lived test tokens before running');assert.equal(p.iss,ORIGIN+'/auth/v1');assert.match(p.sub,/^[0-9a-f-]{36}$/i)}
const a=claims(A).sub,b=claims(B).sub;assert.notEqual(a,b);
const checks=[],created=[],objects=[];const tag='tripin-full-rls-'+crypto.randomUUID();
let failed=false;
function check(name,ok){checks.push({name,result:ok?'PASS':'FAIL'});if(!ok)failed=true}
async function call(token,path,{method='GET',body,bytes=false}={}){const headers={apikey:key,...(token?{Authorization:'Bearer '+token}:{}),...(bytes?{}:{'Content-Type':'application/json',Prefer:'return=representation'})};const res=await fetch(ORIGIN+path,{method,headers,signal:AbortSignal.timeout(15000),...(body!==undefined?{body:bytes?body:JSON.stringify(body)}:{})});let data;if(bytes)data=new Uint8Array(await res.arrayBuffer());else{const raw=await res.text();try{data=raw?JSON.parse(raw):null}catch{data=null}}return {ok:res.ok,status:res.status,data}}
const q=(column,id)=>'?'+column+'=eq.'+encodeURIComponent(id);
const denied=r=>[400,401,403,404].includes(r.status);
const policyDenied=r=>r.status===403&&r.data?.code==='42501';
async function create(token,table,body,keyColumn='id'){const r=await call(token,'/rest/v1/'+table,{method:'POST',body});assert(r.ok&&Array.isArray(r.data)&&r.data.length===1,'Own fixture creation failed on '+table+' (HTTP '+r.status+')');const row=r.data[0];created.push({table,keyColumn,id:row[keyColumn]});return row}
async function expectForbiddenInsert(name,token,table,body){const r=await call(token,'/rest/v1/'+table,{method:'POST',body});if(r.ok&&r.data?.[0])created.push({table,keyColumn:'id',id:r.data[0].id});check(name,policyDenied(r))}
(async()=>{try{
 for(const [token,id]of [[A,a],[B,b]]){const r=await call(token,'/auth/v1/user');assert(r.ok&&r.data?.id===id&&r.data?.is_anonymous!==true,'Target Auth must verify each non-anonymous user before any fixture write')}
 check('Both real JWTs verified by target Auth',true);
 const ta=await create(A,'trips',{owner_id:a,name:tag+'-A'}),tb=await create(B,'trips',{owner_id:b,name:tag+'-B'});
 const ca=await create(A,'saved_collections',{user_id:a,title:tag+'-A'}),cb=await create(B,'saved_collections',{user_id:b,title:tag+'-B'});
 const item=await create(A,'shopping_items',{trip_id:ta.id,created_by:a,name:tag});
 const stop=await create(A,'itinerary_stops',{trip_id:ta.id,user_id:a,visit_date:'2026-10-29',title:tag,source_collection_id:ca.id});
 const expense=await create(A,'trip_expenses',{trip_id:ta.id,user_id:a,expense_date:'2026-10-29',title:tag,amount:1});
 await create(A,'trip_budgets',{trip_id:ta.id,owner_id:a,currency:'TWD',amount:1},'trip_id');
 await create(A,'trip_covers',{trip_id:ta.id,owner_id:a,storage_path:a+'/'+tag+'.png'},'trip_id');
 check('A and B can create their own test data',true);
 for(const [table,keyCol,id,ownerCol]of [['trips','id',ta.id,'owner_id'],['shopping_items','id',item.id,'created_by'],['saved_collections','id',ca.id,'user_id'],['itinerary_stops','id',stop.id,'user_id'],['trip_expenses','id',expense.id,'user_id'],['trip_budgets','trip_id',ta.id,'owner_id'],['trip_covers','trip_id',ta.id,'owner_id']]){
  const route='/rest/v1/'+table+q(keyCol,id);
  const own=await call(A,route);check('A reads own '+table,own.ok&&own.data?.length===1);
  const edit=await call(A,route,{method:'PATCH',body:{[ownerCol]:a}});check('A updates own '+table,edit.ok&&edit.data?.length===1);
  const other=await call(B,route);check('B cannot read A '+table,other.ok&&other.data?.length===0);
  const change=await call(B,route,{method:'PATCH',body:{[ownerCol]:b}});check('B cannot update A '+table,change.ok&&change.data?.length===0);
  const remove=await call(B,route,{method:'DELETE'});check('B cannot delete A '+table,remove.ok&&remove.data?.length===0);
  const transfer=await call(A,route,{method:'PATCH',body:{[ownerCol]:b}});check('A cannot transfer ownership of '+table,policyDenied(transfer));
  const still=await call(A,route);check('A data survived denied operations on '+table,still.ok&&still.data?.length===1&&still.data[0][ownerCol]===a);
  const anon=await call(null,route);check('Anonymous cannot read '+table,(anon.ok&&anon.data?.length===0)||[401,403].includes(anon.status));
 }
 await expectForbiddenInsert('B cannot attach item to A trip',B,'shopping_items',{trip_id:ta.id,created_by:b,name:tag});
 await expectForbiddenInsert('A cannot link B private collection',A,'itinerary_stops',{trip_id:ta.id,user_id:a,visit_date:'2026-10-29',title:tag,source_collection_id:cb.id});
 await expectForbiddenInsert('A cannot attach expense to B trip',A,'trip_expenses',{trip_id:tb.id,user_id:a,expense_date:'2026-10-29',title:tag,amount:1});

 // Bounded concurrent API smoke test: TWO accounts, not 2/5/10 distinct users.
 // All workers settle before cleanup, so a failed request cannot race fixture deletion.
 const concurrencyMetrics=[];
 for(const concurrency of [2,5,10]){
  const started=Date.now(),samples=[];
  const workers=await Promise.allSettled(Array.from({length:concurrency},async(_,i)=>{
   const token=i%2===0?A:B,otherToken=i%2===0?B:A,owner=i%2===0?a:b,trip=i%2===0?ta:tb;
   const t=Date.now();
   try{
    const row=await create(token,'shopping_items',{trip_id:trip.id,created_by:owner,name:tag+'-parallel-'+concurrency+'-'+i});
    const route='/rest/v1/shopping_items'+q('id',row.id);
    const own=await call(token,route),foreign=await call(otherToken,route);
    assert(own.ok&&own.data?.length===1&&own.data[0].created_by===owner,'Concurrent own read failed');
    assert(foreign.ok&&foreign.data?.length===0,'Concurrent cross-account isolation failed');
   }finally{samples.push(Date.now()-t)}
  }));
  const failures=workers.filter(x=>x.status==='rejected').length;
  const sorted=[...samples].sort((x,y)=>x-y);
  concurrencyMetrics.push({concurrentWorkers:concurrency,distinctAccounts:2,operationsPerWorker:3,completed:workers.length-failures,failures,totalMs:Date.now()-started,p50WorkerMs:sorted[Math.ceil(sorted.length*.5)-1],p95WorkerMs:sorted[Math.ceil(sorted.length*.95)-1]});
  check('Concurrent create/read/isolation with '+concurrency+' workers across two accounts',failures===0);
 }
 console.log(JSON.stringify({boundedConcurrency:concurrencyMetrics,limits:'Two accounts; short batches; no sustained load, same-record conflict or production capacity certification.'},null,2));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE2kAAAAASUVORK5CYII=','base64');
 const objectPath=a+'/'+tag+'.png',storagePath='/storage/v1/object/collection-photos/'+objectPath;
 const upload=await fetch(ORIGIN+storagePath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+A,'Content-Type':'image/png','x-upsert':'false'},body:png,signal:AbortSignal.timeout(15000)});
 if(upload.ok)objects.push(objectPath);
 assert(upload.ok,'A photo upload failed (HTTP '+upload.status+')');
 const ownPhoto=await call(A,'/storage/v1/object/authenticated/collection-photos/'+objectPath,{bytes:true});check('A reads own photo',ownPhoto.ok&&ownPhoto.data.length>0);
 const otherPhoto=await call(B,'/storage/v1/object/authenticated/collection-photos/'+objectPath,{bytes:true});check('B cannot read A photo',denied(otherPhoto));
 const publicPhoto=await call(null,'/storage/v1/object/public/collection-photos/'+objectPath,{bytes:true});check('Photo is not downloadable through public URL',denied(publicPhoto));
 const signed=await call(A,'/storage/v1/object/sign/collection-photos/'+objectPath,{method:'POST',body:{expiresIn:60}});check('A can request short-lived photo URL',signed.ok&&typeof signed.data?.signedURL==='string');
 const otherSigned=await call(B,'/storage/v1/object/sign/collection-photos/'+objectPath,{method:'POST',body:{expiresIn:60}});check('B cannot sign A photo URL',denied(otherSigned));
 }catch(e){failed=true;checks.push({name:'Execution / fixture creation',result:'FAIL',detail:String(e.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted-token]')})}
 finally{
  for(const objectPath of objects){try{const r=await call(A,'/storage/v1/object/collection-photos',{method:'DELETE',body:{prefixes:[objectPath]}});check('Photo fixture cleanup',r.ok);const listing=await call(A,'/storage/v1/object/list/collection-photos',{method:'POST',body:{prefix:objectPath.slice(0,objectPath.lastIndexOf('/')),search:objectPath.split('/').pop(),limit:100}});check('Photo fixture metadata removal verified',listing.ok&&Array.isArray(listing.data)&&!listing.data.some(row=>row.name===objectPath.split('/').pop()));const verify=await call(A,'/storage/v1/object/authenticated/collection-photos/'+objectPath+'?cacheNonce='+crypto.randomUUID(),{bytes:true});check('Photo fixture removal verified without cached response',denied(verify))}catch{check('Photo fixture cleanup',false)}}
  for(const resource of created.reverse()){try{const route='/rest/v1/'+resource.table+q(resource.keyColumn,resource.id);await call(A,route,{method:'DELETE'});await call(B,route,{method:'DELETE'});const ra=await call(A,route),rb=await call(B,route);check('Fixture cleanup '+resource.table,ra.ok&&rb.ok&&ra.data?.length===0&&rb.data?.length===0)}catch{check('Fixture cleanup '+resource.table,false)}}
  console.log(JSON.stringify({target:'approved nonproduction project',mode:'real JWT REST and Storage API',warning:'Not a load test, production approval or complete security certification.',checks},null,2));if(failed)process.exitCode=1;
 }
})();
