'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const api=require('../data/tripin-data.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/local-data-v3.json'),'utf8'));
const clone=x=>structuredClone(x),normalized=api.normalizeBackup(fixture);
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
function memory(){const values=new Map();return {values,getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)};}
const store=memory(),repo=api.createLocalRepository(store);
check('empty storage loads independent fallback without writes',()=>{const r=repo.load(fixture);assert(r.ok);assert.deepEqual(r.data,fixture);assert.notEqual(r.data,fixture);assert.equal(store.values.size,0);});
check('existing storage key and format retained; no input mutation',()=>{const input=clone(fixture);const r=repo.save(input,null);assert(r.ok);assert.deepEqual(input,fixture);assert.deepEqual(JSON.parse(store.values.get('travel_studio_beta_v3')),normalized);});
check('all data associations, cover crop, media and GPS settings round-trip',()=>{const data=repo.load({}).data;assert.deepEqual(data,normalized);assert.equal(data.items[0].shoppingPlaceId,data.shoppingPlaces[0].id);for(const key of ['items','plans','expenses','info'])assert.equal(data[key][0].trip,data.trips[0].id);assert.equal(data.trips[0].coverZoom,1.8);});
check('JSON export/parse preserves current backup contract',()=>{assert.deepEqual(repo.parseBackup(repo.exportBackup(normalized)),normalized);});
check('adapter is replaceable; no shared snapshot or cross-store state',()=>{const other=memory(),r=api.createLocalRepository(other);assert(r.save(fixture,null).ok);other.values.set(api.APP_DATA_KEY,'different');assert.equal(repo.load({}).ok,true);assert.equal(r.load(fixture).code,'CORRUPT');});
check('stale tab write rejected without overwriting latest data',()=>{const old=store.getItem(api.APP_DATA_KEY);store.setItem(api.APP_DATA_KEY,old+' ');assert.equal(repo.save(fixture,old).code,'STALE');assert.equal(store.getItem(api.APP_DATA_KEY),old+' ');});
check('snapshot required, not silently treated as empty storage',()=>{assert.equal(repo.save(fixture,undefined).code,'INVALID_EXPECTATION');});
check('corrupt storage keeps raw bytes and blocks writes',()=>{const x=memory();x.setItem(api.APP_DATA_KEY,'{"items":null}');const r=api.createLocalRepository(x),loaded=r.load(fixture);assert.equal(loaded.code,'CORRUPT');assert.deepEqual(loaded.data,fixture);assert.equal(r.save(fixture,loaded.raw,{blocked:true}).code,'CORRUPT');assert.equal(r.exportBackup(loaded.data,{blocked:true,raw:loaded.raw}),'{"items":null}');assert.equal(x.getItem(api.APP_DATA_KEY),loaded.raw);});
check('storage read failure is not an empty data set',()=>{let writes=0;const r=api.createLocalRepository({getItem(){throw Error('unavailable')},setItem(){writes++}});assert.equal(r.load(fixture).code,'STORAGE_READ');assert.equal(r.save(fixture,null).code,'STORAGE_READ');assert.throws(()=>r.exportBackup(fixture,{blocked:true,raw:null}),/unavailable/);assert.equal(writes,0);});
check('quota write failure retains previous storage',()=>{const r=api.createLocalRepository({getItem:()=>null,setItem(){throw Error('quota')}});assert.equal(r.save(fixture,null).code,'STORAGE_WRITE');});
check('invalid and oversized backups rejected without writes',()=>{assert.throws(()=>repo.parseBackup('{broken'));assert.throws(()=>repo.parseBackup(' '.repeat(10*1024*1024+1)));assert.throws(()=>repo.parseBackup('{"items":[]}'));});
for(const [name,mutate] of [
 ['duplicate IDs',d=>d.items.push(clone(d.items[0]))],
 ['prototype IDs',d=>d.items[0].id='__proto__'],
 ['numeric injection',d=>d.items[0].qty={toString:'1'}],
 ['fractional quantity',d=>d.items[0].qty=1.5],
 ['negative money',d=>d.expenses[0].amount=-1],
 ['invalid coordinates',d=>d.shoppingPlaces[0].lat=91],
 ['invalid reminder radius',d=>d.shoppingReminderRadius=12],
 ['SVG media',d=>d.items[0].image='data:image/svg+xml;base64,aGVsbG8=']
])check('reject '+name,()=>{const m=memory(),r=api.createLocalRepository(m),d=clone(fixture);mutate(d);assert.equal(r.save(d,null).code,'INVALID');assert.equal(m.values.size,0);});
check('unsafe URLs stripped, untrusted text stays inert data',()=>{const d=clone(fixture);d.items[0].source='javascript:alert(1)';d.items[0].name='<img src=x onerror=alert(1)>';const n=api.normalizeBackup(d);assert.equal(n.items[0].source,'');assert.equal(n.items[0].name,d.items[0].name);assert.equal({}.polluted,undefined);});
check('unknown fields and prototype keys cannot pollute stored structure',()=>{const d=JSON.parse(JSON.stringify(fixture).replace('"trips":','"__proto__":{"polluted":true},"password":"synthetic","trips":'));const n=api.normalizeBackup(d);assert(!Object.hasOwn(n,'__proto__'));assert(!Object.hasOwn(n,'password'));assert.equal({}.polluted,undefined);});
check('GPS ledger remains separate and cannot overwrite arbitrary keys',()=>{const m=memory();m.setItem('unrelated','KEEP');const ledger=api.createJsonRecordStore(m,api.GPS_LEDGER_KEY);ledger.write({s1:{last:100}});assert.deepEqual(ledger.read(),{s1:{last:100}});assert.equal(m.getItem(api.APP_DATA_KEY),null);assert.equal(m.getItem('unrelated'),'KEEP');assert.throws(()=>api.createJsonRecordStore(m,'unrelated'));});
const user='11111111-1111-4111-8111-111111111111',trip='22222222-2222-4222-8222-222222222222',item='33333333-3333-4333-8333-333333333333';
const resolve=api.createCloudIdResolver({trips:{t1:trip},shopping_items:{i1:item}});
check('cloud mapping requires explicit UUID maps, never local-ID fallback',()=>{assert.equal(resolve('trips','t1'),trip);assert.throws(()=>resolve('trips',user),/Missing/);assert.throws(()=>api.createCloudIdResolver({trips:{t1:'t1'}}),/Invalid/);assert.throws(()=>api.createCloudIdResolver({trips:{t1:trip,t2:trip}}),/Duplicate/);const upper='AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';assert.throws(()=>api.createCloudIdResolver({trips:{t1:upper,t2:upper.toLowerCase()}}),/Duplicate/);});
check('shopping draft maps fields, keeps unresolved media/place fields',()=>{const d=api.shoppingItemDraft(fixture.items[0],{resolveId:resolve,userId:user});assert.equal(d.row.id,item);assert.equal(d.row.trip_id,trip);assert.equal(d.row.created_by,user);assert.equal(d.row.quantity,2);assert.equal(d.row.recipient,'家人');assert.equal(d.pending.shoppingPlaceId,'s1');assert.equal(d.pending.source,fixture.items[0].source);assert.equal(d.pending.image,fixture.items[0].image);});
check('nonproduct collections and unassigned products never become shopping rows',()=>{for(const x of fixture.items.slice(1))assert.throws(()=>api.shoppingItemDraft(x,{resolveId:resolve,userId:user}),/Only/);});
check('mapping rejects fake owner/short IDs even with caller-supplied resolver',()=>{assert.throws(()=>api.shoppingItemDraft(fixture.items[0],{resolveId:resolve,userId:'local-owner'}));assert.throws(()=>api.shoppingItemDraft(fixture.items[0],{resolveId:()=> 'short-id',userId:user}));});
check('embedded bundle matches reusable source and all scripts parse',()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.equal(html.match(/<script id="tripin-data-store">\n([\s\S]*?)<\/script>/)[1],fs.readFileSync(path.join(__dirname,'../data/tripin-data.cjs'),'utf8'));for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);assert.equal(crypto.createHash('sha256').update(html.match(/<script id="feedback-script">[\s\S]*?<\/script>/)[0]).digest('hex'),'775bfbb84c24791fb347930c0d0d11ee5198ffa99de0b929b9dbea8e86be8d74');});
check('all baseline CSS blocks preserved byte-for-byte',()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.equal(crypto.createHash('sha256').update([...html.matchAll(/<style[\s\S]*?<\/style>/g)].map(m=>m[0]).join('\n')).digest('hex'),'27ea5c0de30fe77a04ad1b455c377aa8d656a73bcc80cc693b23f9437566ac99');});
console.log('PASS '+count+' data contract/security groups; no network or user data');
