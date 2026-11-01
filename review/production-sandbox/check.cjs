'use strict';
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
const snapshot=require('./schema-snapshot.json');
const quote=s=>'"'+s.replace(/"/g,'""')+'"';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IA='aaaaaaaa-1111-4111-8111-111111111111',IB='bbbbbbbb-2222-4222-8222-222222222222';
const IMAGE='cccccccc-3333-4333-8333-333333333333';
async function build(){
 const db=new PGlite();
 await db.exec(`create role authenticated nologin;create role anon nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;`);
 await db.exec('grant usage on schema public,auth to authenticated,anon;');
 const s=snapshot.schema;
 for(const table of [...new Set(s.columns.map(c=>c.table))]){
  const columns=s.columns.filter(c=>c.table===table).map(c=>quote(c.column)+' '+c.type+(c.default?' default '+c.default:'')+(c.not_null?' not null':''));
  await db.exec('create table public.'+quote(table)+'('+columns.join(',')+');alter table public.'+quote(table)+' enable row level security;');
 }
 for(const constraint of [...s.constraints.filter(c=>c.kind!=='f'),...s.constraints.filter(c=>c.kind==='f')])await db.exec('alter table public.'+quote(constraint.table)+' add constraint '+quote(constraint.name)+' '+constraint.definition);
 await db.exec(snapshot.support.set_updated_at);
 for(const trigger of s.triggers||[])await db.exec(trigger);
 for(const p of s.policies){
  let sql='create policy '+quote(p.name)+' on public.'+quote(p.table)+' as '+p.permissive+' for '+p.command+' to '+p.roles.map(r=>r==='public'?'PUBLIC':quote(r)).join(',');
  if(p.using)sql+=' using ('+p.using+')';if(p.check)sql+=' with check ('+p.check+')';await db.exec(sql);
 }
 for(const g of snapshot.support.grants||[])await db.exec('grant '+g.privilege+' on public.'+quote(g.table)+' to '+(g.role==='PUBLIC'?'PUBLIC':quote(g.role)));
 await db.query('insert into auth.users(id) values($1),($2)',[A,B]);
 await db.query('insert into public.trips(id,owner_id,name) values($1,$2,$3),($4,$5,$6)',[TA,A,'A trip',TB,B,'B trip']);
 await db.query('insert into public.shopping_items(id,trip_id,created_by,name) values($1,$2,$3,$4),($5,$6,$7,$8)',[IA,TA,A,'A item',IB,TB,B,'B item']);
 return db;
}
async function audit(db){
 const checks=[];
 async function as(user,action){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,role:'authenticated'}:{role:'anon'})]);await db.exec('set role '+(user?'authenticated':'anon'));return action();}
 async function check(name,action){try{await action();checks.push({name,pass:true})}catch(error){checks.push({name,pass:false,detail:error.code||error.message.split('\n')[0]})}}
 async function denied(sql,params){try{const r=await db.query(sql,params);assert.equal(r.affectedRows||0,0)}catch(error){if(error.code!=='42501')throw error}}
 await as(A,async()=>{
  await check('A reads own trip',async()=>assert.equal((await db.query('select id from public.trips where id=$1',[TA])).rows.length,1));
  await check('A cannot read B trip',async()=>assert.equal((await db.query('select id from public.trips where id=$1',[TB])).rows.length,0));
  await check('A cannot read B item',async()=>assert.equal((await db.query('select id from public.shopping_items where id=$1',[IB])).rows.length,0));
  await check('A cannot update B item',()=>denied('update public.shopping_items set name=$1 where id=$2',['forbidden',IB]));
  await check('A cannot delete B item',()=>denied('delete from public.shopping_items where id=$1',[IB]));
  await check('A creates own profile',async()=>{await db.query('insert into public.profiles(id,display_name) values($1,$2)',[A,'A profile'])});
  await check('A cannot create B profile',()=>denied('insert into public.profiles(id,display_name) values($1,$2)',[B,'forbidden']));
  await check('A adds member to own trip',async()=>{await db.query('insert into public.trip_members(trip_id,user_id) values($1,$2)',[TA,B])});
  await check('A cannot add member to B trip',()=>denied('insert into public.trip_members(trip_id,user_id) values($1,$2)',[TB,A]));
  await check('A creates own budget',async()=>{await db.query('insert into public.trip_budgets(trip_id,owner_id,currency,amount) values($1,$2,$3,1)',[TA,A,'TWD'])});
  await check('A cannot create budget on B trip',()=>denied('insert into public.trip_budgets(trip_id,owner_id,currency,amount) values($1,$2,$3,1)',[TB,A,'TWD']));
  await check('A creates own cover',async()=>{await db.query('insert into public.trip_covers(trip_id,owner_id,storage_path) values($1,$2,$3)',[TA,A,A+'/'+TA+'/cover.png'])});
  await check('A cannot move cover outside own folder',()=>denied('update public.trip_covers set storage_path=$1 where trip_id=$2',[B+'/cover.png',TA]));
  await check('A creates own item image metadata',async()=>{await db.query('insert into public.item_images(id,item_id,uploaded_by,storage_path) values($1,$2,$3,$4)',[IMAGE,IA,A,A+'/image.png'])});
  await check('A cannot create image metadata on B item',()=>denied('insert into public.item_images(item_id,uploaded_by,storage_path) values($1,$2,$3)',[IB,A,A+'/forbidden.png']));
  await check('A creates consistent photo metadata',async()=>{await db.query('insert into public.shopping_item_photos(item_id,trip_id,owner_id,storage_path) values($1,$2,$3,$4)',[IA,TA,A,A+'/photo.png'])});
  await check('A cannot mismatch photo trip and item',()=>denied('insert into public.shopping_item_photos(item_id,trip_id,owner_id,storage_path) values($1,$2,$3,$4)',[IA,TB,A,A+'/forbidden.png']));
  await check('A cannot reassign item creator to B',()=>denied('update public.shopping_items set created_by=$1 where id=$2',[B,IA]));
  await check('A cannot relink own image to B item',()=>denied('update public.item_images set item_id=$1 where id=$2',[IB,IMAGE]));
 });
 await as(B,async()=>{
  await check('B still cannot read A trip item after creator reassignment attempt',async()=>assert.equal((await db.query('select id from public.shopping_items where id=$1',[IA])).rows.length,0));
  for(const table of ['profiles','trip_members','trip_budgets','trip_covers','item_images','shopping_item_photos'])await check('B cannot read A '+table,async()=>{try{assert.equal((await db.query('select * from public.'+quote(table))).rows.length,0)}catch(error){if(error.code!=='42501')throw error}});
  await check('Member currently cannot read owner trip',async()=>assert.equal((await db.query('select id from public.trips where id=$1',[TA])).rows.length,0));
 });
 await as(null,async()=>{
  for(const table of [...new Set(snapshot.schema.columns.map(c=>c.table))])await check('Anonymous cannot read '+table,async()=>{try{assert.equal((await db.query('select * from public.'+quote(table))).rows.length,0)}catch(error){if(error.code!=='42501')throw error}});
 });
 await db.exec('reset role');
 return {total:checks.length,passed:checks.filter(c=>c.pass).length,failures:checks.filter(c=>!c.pass),checks};
}
(async()=>{
 const baseline=await build();let result,policyResult,fixedResult;
 try{result=await audit(baseline)}finally{await baseline.close()}
 const policyDb=await build();
 try{
  await policyDb.exec('grant select,insert,update,delete on all tables in schema public to authenticated;');
  policyResult=await audit(policyDb);
 }finally{await policyDb.close()}
 const fixed=await build();
 try{
  // Policy-only analysis explicitly grants CRUD locally; these grants are NOT a rollout proposal.
  await fixed.exec('grant select,insert,update,delete on all tables in schema public to authenticated;');
  await fixed.exec(fs.readFileSync('candidate-policy-fixes.sql','utf8'));
  fixedResult=await audit(fixed);
 }finally{await fixed.close()}
 const report={scope:'Offline PGlite copy of production metadata; simulated Auth claims; no real records, Storage bytes or production changes',baseline:result,policyOnlyWithSyntheticCrudGrants:policyResult,candidatePolicyOnly:fixedResult};
 fs.writeFileSync('results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({scope:report.scope,baseline:{passed:result.passed,total:result.total,failures:result.failures},policyOnly:{passed:policyResult.passed,total:policyResult.total,failures:policyResult.failures},candidate:{passed:fixedResult.passed,total:fixedResult.total,failures:fixedResult.failures}},null,2));
 assert.deepEqual(result.failures.map(c=>c.name).sort(),['A creates own profile','A adds member to own trip','A creates own item image metadata','A cannot reassign item creator to B'].sort(),'Unexpected change to captured baseline findings');
 assert.deepEqual(policyResult.failures.map(c=>c.name),['A cannot reassign item creator to B']);
 assert.equal(fixedResult.failures.length,0,'Candidate policy simulation must pass');
})().catch(error=>{console.error(error.message);process.exitCode=1});
