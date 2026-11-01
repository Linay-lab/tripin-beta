'use strict';
const assert=require('node:assert/strict');
const {runBoundedReadSoak,LIMITS}=require('../backend/tests/bounded-read-soak.cjs');
(async()=>{
 let time=0,calls=0,active=0,maxActive=0;
 const clock={now:()=>time,sleep:async ms=>{time+=ms}};
 const success=await runBoundedReadSoak(async()=>{calls++;active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;return true},clock);
 assert(success.completedAllPhases);assert.equal(success.failures,0);assert.equal(success.phases.length,3);assert(calls<=200);assert(maxActive<=5);
 time=0;calls=0;
 const failed=await runBoundedReadSoak(async()=>{calls++;throw Error('synthetic request failure')},clock);
 assert(!failed.completedAllPhases);assert.equal(failed.failures,LIMITS.maxFailures);assert.equal(calls,LIMITS.maxFailures);
 time=0;
 const emptyBody=await runBoundedReadSoak(async()=>null,clock);
 assert(!emptyBody.completedAllPhases);assert.equal(emptyBody.failures,LIMITS.maxFailures);
 time=0;calls=0;
 const stuck=await runBoundedReadSoak(async()=>{calls++;time+=LIMITS.maxStartWindowMs;return true},clock);
 assert(!stuck.completedAllPhases);assert.equal(calls,1);
 calls=0;
 const capped=await runBoundedReadSoak(async()=>{calls++;return true},{now:()=>0,sleep:async()=>{}});
 assert(!capped.completedAllPhases);assert.equal(calls,LIMITS.maxRequests);
 console.log('PASS fixed concurrency/request limits, failure stop, explicit success and elapsed deadline guards');
})().catch(error=>{console.error(error);process.exitCode=1});

