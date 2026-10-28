'use strict';
// Real Supabase REST isolation checks for the EXISTING souvenir-reminder test schema.
// Requires two short-lived real-user JWTs. Never use service_role or production.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const keys = ['TRIPIN_TEST_SUPABASE_URL','TRIPIN_TEST_SUPABASE_ANON_KEY','TRIPIN_TEST_USER_A_TOKEN','TRIPIN_TEST_USER_B_TOKEN'];
const missing = keys.filter(k => !process.env[k]);
if (missing.length || process.env.TRIPIN_TEST_ISOLATED_PROJECT !== 'YES') {
  console.error('SKIPPED: missing credentials or isolated-project confirmation. No requests made.');
  process.exit(2);
}
const base = process.env.TRIPIN_TEST_SUPABASE_URL.replace(/\/$/, '');
if (base !== 'https://xxzchaewtmctplhamwwi.supabase.co') {
  console.error('Refusing any project other than the approved nonproduction souvenir-reminder project.');
  process.exit(2);
}
const key = process.env.TRIPIN_TEST_SUPABASE_ANON_KEY;
const A = process.env.TRIPIN_TEST_USER_A_TOKEN;
const B = process.env.TRIPIN_TEST_USER_B_TOKEN;
if (A === B) throw Error('Distinct user JWTs required');
function subject(token) {
  const parts = token.split('.');
  assert(parts.length === 3, 'JWT required');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.match(payload.sub || '', /^[0-9a-f-]{36}$/i);
  assert(payload.exp > Date.now()/1000 + 30, 'Expired JWT');
  return payload.sub;
}
const aId = subject(A), bId = subject(B);
assert.notEqual(aId, bId);
async function verifyAuth(token, expectedId) {
  const res = await fetch(base+'/auth/v1/user', {headers:{apikey:key,Authorization:'Bearer '+token}});
  if (!res.ok) throw Error('JWT authentication failed: HTTP '+res.status);
  const user = await res.json();
  assert.equal(user.id, expectedId, 'JWT subject does not match Auth user');
}
const checks = [];
const created = [];
const tag = 'tripin-rest-rls-' + crypto.randomUUID();
async function request(token, table, method='GET', query='', data) {
  const res = await fetch(base+'/rest/v1/'+table+query, {
    method, headers: {apikey:key, Authorization:'Bearer '+token,
      'Content-Type':'application/json', Prefer:'return=representation'},
    ...(data ? {body:JSON.stringify(data)} : {})
  });
  const raw = await res.text();
  let body; try {body=raw ? JSON.parse(raw) : null} catch {body=raw}
  return {ok:res.ok,status:res.status,body};
}
function check(name, passed) {
  checks.push({name,result:passed?'PASS':'FAIL'});
  if (!passed) process.exitCode=1;
}
(async () => {
  try {
    await verifyAuth(A,aId);
    await verifyAuth(B,bId);
    check('Both JWTs verified by target Supabase Auth',true);
    const trip = await request(A,'trips','POST','',{owner_id:aId,name:tag});
    assert(trip.ok && Array.isArray(trip.body) && trip.body.length===1,
      'A cannot create trip (HTTP '+trip.status+')');
    const tripId=trip.body[0].id; created.push(['trips',tripId]);
    check('A creates own trip',true);
    const item=await request(A,'shopping_items','POST','',
      {trip_id:tripId,created_by:aId,name:tag});
    assert(item.ok && item.body.length===1,'A cannot create item (HTTP '+item.status+')');
    const itemId=item.body[0].id; created.push(['shopping_items',itemId]);
    const q=id=>'?id=eq.'+encodeURIComponent(id)+'&select=id';
    for (const [table,id] of [['trips',tripId],['shopping_items',itemId]]) {
      const own=await request(A,table,'GET',q(id));
      check('A reads own '+table,own.ok && own.body.length===1);
      const other=await request(B,table,'GET',q(id));
      check('B cannot read A '+table,other.ok && other.body.length===0);
      const edit=await request(B,table,'PATCH','?id=eq.'+id,
        {name:'unauthorized-'+tag});
      check('B cannot modify A '+table,edit.ok && edit.body.length===0);
      const del=await request(B,table,'DELETE','?id=eq.'+id);
      check('B cannot delete A '+table,del.ok && del.body.length===0);
    }
    const cross=await request(B,'shopping_items','POST','',
      {trip_id:tripId,created_by:bId,name:'forbidden-'+tag});
    check('B cannot attach item to A trip',!cross.ok);
    const anonymous=await request(key,'trips','GET','?id=eq.'+tripId+'&select=id');
    check('Anonymous cannot see A trip',
      (anonymous.ok && anonymous.body.length===0) ||
      anonymous.status===401 || anonymous.status===403);
  } catch(e) {
    console.error('Test failed:',e.message);process.exitCode=1;
  } finally {
    for (const [table,id] of created.reverse()) {
      try {
        const result=await request(A,table,'DELETE','?id=eq.'+id);
        if (!result.ok) {console.error('Cleanup HTTP '+result.status+' on '+table);process.exitCode=1}
      } catch(e) {console.error('Cleanup failed:',e.message);process.exitCode=1}
    }
    console.log(JSON.stringify({target:'approved nonproduction souvenir-reminder',
      mode:'real JWT REST API',checks},null,2));
  }
})();
