'use strict';
// Real, opt-in cross-account RLS test. Requires TWO dedicated test users in an isolated Supabase project.
// Never run against production; never commit tokens or service_role credentials.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const required=['TRIPIN_TEST_SUPABASE_URL','TRIPIN_TEST_SUPABASE_ANON_KEY','TRIPIN_TEST_USER_A_TOKEN','TRIPIN_TEST_USER_B_TOKEN'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length){console.error('SKIPPED: missing '+missing.join(', ')+'. No remote requests made.');process.exit(2)}
const base=process.env.TRIPIN_TEST_SUPABASE_URL.replace(/\\/$/,'');
if(!/^https:\/\/[a-z0-9-]+\\.supabase\\.co$/.test(base)){console.error('Refusing nonstandard Supabase test endpoint');process.exit(2)}
if(process.env.TRIPIN_TEST_ISOLATED_PROJECT!=='YES'){console.error('Set TRIPIN_TEST_ISOLATED_PROJECT=YES only after confirming this is a dedicated nonproduction project');process.exit(2)}
const key=process.env.TRIPIN_TEST_SUPABASE_ANON_KEY;
const tokenA=process.env.TRIPIN_TEST_USER_A_TOKEN,tokenB=process.env.TRIPIN_TEST_USER_B_TOKEN;
if(tokenA===tokenB){console.error('Two distinct user tokens required');process.exit(2)}
const tag='rls-'+crypto.randomUUID();const created=[];const checks=[];
async function req(token,table,method='GET',query='',body){const res=await fetch(base+'/rest/v1/'+table+query,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}return {status:res.status,ok:res.ok,data}}
function record(name,ok){checks.push({name,status:ok?'PASS':'FAIL'});if(!ok)process.exitCode=1}
(async()=>{try{
const a=await req(tokenA,'tripin_trips','POST','',{title:tag,destination:'TEST'});assert(a.ok,'A cannot create trip: HTTP '+a.status);const trip=a.data[0];created.push({table:'tripin_trips',id:trip.id});record('A can create own trip',true);
const own=await req(tokenA,'tripin_trips','GET','?id=eq.'+trip.id+'&select=id');record('A can read own trip',own.ok&&own.data.length===1);
const other=await req(tokenB,'tripin_trips','GET','?id=eq.'+trip.id+'&select=id');record('B cannot read A trip',other.ok&&other.data.length===0);
const update=await req(tokenB,'tripin_trips','PATCH','?id=eq.'+trip.id,{title:tag+'-tampered'});record('B cannot edit A trip',update.ok&&update.data.length===0);
const deletion=await req(tokenB,'tripin_trips','DELETE','?id=eq.'+trip.id);record('B cannot delete A trip',deletion.ok&&deletion.data.length===0);
const store=await req(tokenA,'tripin_stores','POST','',{name:tag,latitude:25.033,longitude:121.565});assert(store.ok,'A cannot create store: HTTP '+store.status);created.push({table:'tripin_stores',id:store.data[0].id});
const storeB=await req(tokenB,'tripin_stores','GET','?id=eq.'+store.data[0].id+'&select=id');record('B cannot read A store',storeB.ok&&storeB.data.length===0);
const item=await req(tokenA,'tripin_shopping_items','POST','',{name:tag,trip_id:trip.id,store_id:store.data[0].id});assert(item.ok,'A cannot create item: HTTP '+item.status);created.push({table:'tripin_shopping_items',id:item.data[0].id});
const itemB=await req(tokenB,'tripin_shopping_items','GET','?id=eq.'+item.data[0].id+'&select=id');record('B cannot read A item',itemB.ok&&itemB.data.length===0);
const cross=await req(tokenB,'tripin_shopping_items','POST','',{name:tag,trip_id:trip.id,store_id:store.data[0].id});record('B cannot attach A trip/store to own item',!cross.ok);
const anonymous=await fetch(base+'/rest/v1/tripin_trips?select=id&limit=1',{headers:{apikey:key,Authorization:'Bearer '+key}});record('Anonymous cannot read trips',anonymous.status===401||anonymous.status===403);
}catch(e){console.error('Test error:',e.message);process.exitCode=1}finally{
for(const item of created.reverse()){try{const x=await req(tokenA,item.table,'DELETE','?id=eq.'+item.id);if(!x.ok)console.error('Cleanup failed for '+item.table+': HTTP '+x.status)}catch{console.error('Cleanup request failed for '+item.table)}}
console.log(JSON.stringify({scope:'Dedicated Supabase project, real user access tokens; no service role',checks},null,2));
}})();
