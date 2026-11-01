// Starts only an isolated loopback Next server; no Supabase config or credentials.
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const net=require('node:net');await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(3201,'127.0.0.1',()=>probe.close(resolve));});
 await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(root,'scripts/prepare-reference.cjs')],{cwd:root,stdio:'inherit'});p.on('exit',code=>code===0?resolve():reject(Error('Asset preparation failed')));});
 const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3201'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','ignore','inherit']});
 try{
  const deadline=Date.now()+90000;let ready=false;
  while(Date.now()<deadline){if(server.exitCode!==null)throw Error('Next server exited');try{const r=await fetch('http://127.0.0.1:3201',{signal:AbortSignal.timeout(4000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}
  if(!ready)throw Error('Next server not ready');
  await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(__dirname,'port.cjs')],{cwd:root,env:process.env,stdio:'inherit'});p.on('exit',code=>code===0?resolve():reject(Error('Port validation failed')));});
 }finally{server.kill('SIGTERM');}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
