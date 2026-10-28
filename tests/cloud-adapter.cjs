'use strict';
const assert=require('node:assert/strict');
const {createTripinCloud}=require('../backend/client/tripin-cloud.cjs');
const url='https://xxzchaewtmctplhamwwi.supabase.co';
const user='156007ee-1cdb-48eb-9325-022330bef7f9';
const trip='351edfec-1062-4fd4-bcea-93c9b6e9a105';
let calls=[];
const mock=async (path,options)=>{
  calls.push({path,options});
  return {ok:true,status:200,text:async()=>JSON.stringify(path.endsWith('/auth/v1/user')?{id:user}:[{id:trip}])};
};
async function main(){
  assert.throws(()=>createTripinCloud({url:'https://production.invalid',publishableKey:'public',accessToken:'jwt',fetchImpl:mock}),/nonproduction/);
  assert.throws(()=>createTripinCloud({url,publishableKey:'public',accessToken:''}),/required/);
  const api=createTripinCloud({url,publishableKey:'public',accessToken:'test-jwt',fetchImpl:mock});
  await api.listTrips();
  assert(calls.some(x=>x.path.includes('/trips?owner_id=eq.'+user)));
  assert(calls.every(x=>x.options.headers.Authorization==='Bearer test-jwt'));
  await api.createTrip({name:'  Okinawa  '});
  const create=calls.find(x=>x.options.method==='POST');
  assert.equal(JSON.parse(create.options.body).owner_id,user);
  assert.equal(JSON.parse(create.options.body).name,'Okinawa');
  await api.listItems(trip);
  assert(calls.some(x=>x.path.includes('/shopping_items?trip_id=eq.'+trip)));
  await api.addItem({tripId:trip,name:'Snack'});
  const item=JSON.parse(calls.at(-1).options.body);
  assert.equal(item.created_by,user);
  assert.equal(item.trip_id,trip);
  await assert.rejects(()=>api.listItems('not-uuid'),/Invalid trip ID/);
  console.log('PASS: beta cloud adapter contract, project allowlist, auth and owner mapping');
}
main().catch(e=>{console.error(e);process.exitCode=1});
