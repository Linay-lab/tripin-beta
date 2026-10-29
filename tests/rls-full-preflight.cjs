'use strict';
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const file=path.join(__dirname,'../backend/tests/rls-full-rest.cjs');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tripin-rls-preflight-'));
const preload=path.join(folder,'block-network.cjs');fs.writeFileSync(preload,"globalThis.fetch=()=>{console.error('UNEXPECTED_NETWORK');throw Error('Network must not be called during preflight')};");
const results=[];function run(name,vars,expected){const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('TRIPIN_TEST_'))delete env[k];Object.assign(env,vars);const r=spawnSync(process.execPath,['--require',preload,file],{env,encoding:'utf8',timeout:5000});const out=(r.stdout||'')+(r.stderr||'');assert.equal(r.status,expected,name);assert(!out.includes('UNEXPECTED_NETWORK'),name);if(vars.TRIPIN_TEST_USER_A_TOKEN)assert(!out.includes(vars.TRIPIN_TEST_USER_A_TOKEN),'Never print user token');results.push({name,result:'PASS'})}
try{
run('Missing secrets fail closed before network',{},2);
const vars={TRIPIN_TEST_ISOLATED_PROJECT:'YES',TRIPIN_TEST_SUPABASE_URL:'https://production-must-not-run.supabase.co',TRIPIN_TEST_SUPABASE_ANON_KEY:'sb_publishable_synthetic',TRIPIN_TEST_USER_A_TOKEN:'SYNTHETIC-A',TRIPIN_TEST_USER_B_TOKEN:'SYNTHETIC-B'};
run('Unapproved project refused before network',vars,2);
run('Absent isolated-project confirmation refused',{...vars,TRIPIN_TEST_ISOLATED_PROJECT:'NO'},2);
run('Identical tokens rejected without printing them',{...vars,TRIPIN_TEST_SUPABASE_URL:'https://xxzchaewtmctplhamwwi.supabase.co',TRIPIN_TEST_USER_A_TOKEN:'SYNTHETIC-DO-NOT-PRINT',TRIPIN_TEST_USER_B_TOKEN:'SYNTHETIC-DO-NOT-PRINT'},1);
console.log(JSON.stringify({mode:'offline safety guards only, no database requests',checks:results},null,2));
}finally{fs.rmSync(folder,{recursive:true,force:true})}
