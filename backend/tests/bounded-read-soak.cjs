'use strict';
// Read-only short soak. The caller supplies a verified, filtered GET operation.
// Limits are fixed here, not configurable through CI inputs or environment variables.
const LIMITS=Object.freeze({concurrency:Object.freeze([1,3,5]),phaseMs:20000,maxRequests:200,pauseMs:1000,maxFailures:3,maxStartWindowMs:90000});
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]:null;
async function runBoundedReadSoak(request,clock={now:()=>performance.now(),sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const started=clock.now(),overallDeadline=started+LIMITS.maxStartWindowMs;
 let requests=0,failures=0,stopped=false;
 const phases=[];
 for(const concurrency of LIMITS.concurrency){
  if(stopped)break;
  const phaseStarted=clock.now(),deadline=Math.min(phaseStarted+LIMITS.phaseMs,overallDeadline),durations=[];
  let phaseRequests=0,phaseFailures=0;
  await Promise.all(Array.from({length:concurrency},async(_,worker)=>{
   while(!stopped&&clock.now()<deadline){
    if(requests>=LIMITS.maxRequests){stopped=true;break}
    requests++;phaseRequests++;
    const start=clock.now();let ok=false;
    try{ok=await request({worker,concurrency})===true}catch{}
    durations.push(Math.max(0,clock.now()-start));
    if(!ok){failures++;phaseFailures++;if(failures>=LIMITS.maxFailures)stopped=true}
    if(!stopped&&clock.now()<deadline)await clock.sleep(Math.min(LIMITS.pauseMs,deadline-clock.now()));
   }
  }));
  phases.push({concurrency,distinctAccounts:Math.min(2,concurrency),requests:phaseRequests,failures:phaseFailures,elapsedMs:Math.round(clock.now()-phaseStarted),p50RequestMs:percentile(durations,.5),p95RequestMs:percentile(durations,.95)});
  if(clock.now()>=overallDeadline)stopped=true;
 }
 return {limits:LIMITS,requests,failures,completedAllPhases:!stopped&&phases.length===LIMITS.concurrency.length,elapsedMs:Math.round(clock.now()-started),phases,scope:'Two accounts, read-only short soak; not production capacity or long-duration certification.'};
}
module.exports={runBoundedReadSoak,LIMITS};
