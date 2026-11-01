// Platform-neutral data contract. No DOM, auth credentials or network access.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TripinData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const APP_DATA_KEY='travel_studio_beta_v3';
const GPS_LEDGER_KEY='travel-studio-gps-ledger-v1';
function normalizeBackup(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid backup');
  const shape={trips:['name','country','city','start','end','notes'],items:['name','type','country','city','place','currency','recipient','category','note','trip','shoppingPlaceId'],expenses:['trip','name','currency','payer','date'],plans:['trip','date','time','name','place','note'],info:['trip','type','name','value','note']};
  const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
  const number=(v,min,max,fallback)=>{if(v==null||v==='')return fallback;if(!['string','number'].includes(typeof v)||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error('Invalid number');return Number(v)};
  const text=(v,max=5000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)throw Error('Invalid text');return v};
  const out={};
  for(const [key,fields] of Object.entries(shape)){
    if(!Array.isArray(input[key])||input[key].length>10000)throw Error('Invalid collection');
    const seen=new Set();out[key]=input[key].map(x=>{
      if(!x||typeof x!=='object'||Array.isArray(x)||!id(x.id)||seen.has(x.id))throw Error('Invalid or duplicate ID');seen.add(x.id);
      const row={id:x.id};for(const field of fields)if(x[field]!=null)row[field]=text(x[field],field==='name'?300:5000);
      for(const field of ['trip','shoppingPlaceId'])if(row[field]&&!id(row[field]))throw Error('Invalid reference');
      if(key==='trips'){row.budget=number(x.budget,0,1e12,0);row.coverX=number(x.coverX,0,100,50);row.coverY=number(x.coverY,0,100,50);row.coverZoom=number(x.coverZoom,1,3,1.35);if(x.cover){row.cover=safeImage(x.cover);if(!row.cover)throw Error('Invalid cover')}}
      if(key==='items'){row.price=number(x.price,0,1e12,0);row.qty=number(x.qty,1,1000000,1);if(!Number.isInteger(row.qty))throw Error('Invalid quantity');if(x.bought!=null&&typeof x.bought!=='boolean')throw Error('Invalid purchase status');row.bought=x.bought===true;if(x.image){row.image=safeImage(x.image);if(!row.image)throw Error('Invalid image')}row.source=safeUrl(text(x.source,4096))}
      if(key==='expenses')row.amount=number(x.amount,0,1e12,0);
      if(row.currency&&!/^[A-Z]{3}$/.test(row.currency))throw Error('Invalid currency');
      return row;
    });
  }
  if(input.shoppingPlaces!=null){if(!Array.isArray(input.shoppingPlaces)||input.shoppingPlaces.length>10000)throw Error('Invalid locations');const seen=new Set();out.shoppingPlaces=input.shoppingPlaces.map(s=>{if(!s||!id(s.id)||seen.has(s.id)||s.lat==null||s.lng==null||s.lat===''||s.lng==='')throw Error('Invalid location');seen.add(s.id);return {id:s.id,name:text(s.name,300),lat:number(s.lat,-90,90,0),lng:number(s.lng,-180,180,0)}})}
  if(input.shoppingReminderRadius!=null){if(![100,200,500,1000].includes(Number(input.shoppingReminderRadius)))throw Error('Invalid radius');out.shoppingReminderRadius=Number(input.shoppingReminderRadius)}
  return out;
}
function safeImage(value){
  if(typeof value!=='string'||value.length>4*1024*1024)return '';
  if(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&value.length<=4096?u.href:''}catch{return ''}
}

function safeUrl(v){try{let u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}

// Synchronous local adapter: expectedRaw preserves the existing stale-tab guard.
// A future async remote adapter must not masquerade as this synchronous contract.
function createLocalRepository(storage,key=APP_DATA_KEY){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new TypeError('Storage adapter required');
  function load(fallback){
    let raw=null;
    try {raw=storage.getItem(key);} catch {return {ok:false,code:'STORAGE_READ',raw,data:structuredClone(fallback)};}
    try {return {ok:true,raw,data:raw?normalizeBackup(JSON.parse(raw)):structuredClone(fallback)};}
    catch {return {ok:false,code:'CORRUPT',raw,data:structuredClone(fallback)};}
  }
  function save(value,expectedRaw,{blocked=false}={}){
    if(blocked)return {ok:false,code:'CORRUPT'};
    if(expectedRaw!==null&&typeof expectedRaw!=='string')return {ok:false,code:'INVALID_EXPECTATION'};
    let actual;
    try {actual=storage.getItem(key);}catch{return {ok:false,code:'STORAGE_READ'};}
    if(actual!==expectedRaw)return {ok:false,code:'STALE'};
    let raw;
    try {raw=JSON.stringify(normalizeBackup(value));}catch{return {ok:false,code:'INVALID'};}
    try {storage.setItem(key,raw);}catch{return {ok:false,code:'STORAGE_WRITE'};}
    return {ok:true,raw};
  }
  function parseBackup(text){
    if(typeof text!=='string'||text.length>10*1024*1024)throw new Error('Invalid backup size');
    return normalizeBackup(JSON.parse(text));
  }
  function exportBackup(value,{blocked=false,raw=null}={}){
    if(blocked){if(typeof raw!=='string')throw new Error('Original storage unavailable');return raw;}
    return JSON.stringify(value,null,2);
  }
  return Object.freeze({load,save,parseBackup,exportBackup});
}
// Auxiliary records keep their existing separate keys and do not enter backups.
function createJsonRecordStore(storage,key){
  if(key!==GPS_LEDGER_KEY)throw new Error('Unsupported auxiliary record');
  return Object.freeze({
    read(){return JSON.parse(storage.getItem(key)||'{}');},
    write(value){storage.setItem(key,JSON.stringify(value));}
  });
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOUD_ENTITIES=['trips','saved_collections','shopping_items','itinerary_stops','trip_expenses','trip_budgets','shopping_places','trip_info'];
// Explicit maps only: never assume a local ID (even one shaped like a UUID)
// identifies an existing cloud row. Mapping generation/persistence is future work.
function createCloudIdResolver(maps){
  const copy=new Map();
  for(const entity of CLOUD_ENTITIES){
    const rows=Object.hasOwn(maps||{},entity)?maps[entity]:{};
    if(!rows||typeof rows!=='object'||Array.isArray(rows))throw new Error('Invalid ID map');
    const seen=new Set();
    for(const [localId,cloudId] of Object.entries(rows)){
      if(typeof cloudId!=='string'||!UUID.test(cloudId)||!localId||['__proto__','constructor','prototype'].includes(localId))throw new Error('Invalid ID mapping');
      const canonicalId=cloudId.toLowerCase();
      if(seen.has(canonicalId))throw new Error('Duplicate cloud ID mapping');
      seen.add(canonicalId);
      copy.set(entity+':'+localId,canonicalId);
    }
  }
  return function resolve(entity,localId){
    if(!CLOUD_ENTITIES.includes(entity)||!copy.has(entity+':'+localId))throw new Error('Missing explicit cloud ID mapping');
    return copy.get(entity+':'+localId);
  };
}
// Pure draft only. It neither uploads nor claims schema compatibility.
// Non-shopping fields are returned explicitly for a later migration decision.
function shoppingItemDraft(input,{resolveId,userId}){
  if(!input||input.type!=='商品'||!input.trip||typeof input.name!=='string'||!input.name.trim())throw new Error('Only trip-linked products may become shopping items');
  if(typeof userId!=='string'||!UUID.test(userId)||typeof resolveId!=='function')throw new Error('Explicit owner and ID resolver required');
  const item=normalizeBackup({trips:[],items:[input],plans:[],expenses:[],info:[]}).items[0];
  const id=resolveId('shopping_items',item.id),tripId=resolveId('trips',item.trip);
  if(typeof id!=='string'||typeof tripId!=='string'||!UUID.test(id)||!UUID.test(tripId))throw new Error('Cloud IDs must be UUIDs');
  return {row:{id,trip_id:tripId,created_by:userId,name:item.name,quantity:item.qty,recipient:item.recipient||'',category:item.category||'',price:item.price,currency:item.currency||'TWD',place_name:item.place||null,note:item.note||null,bought:item.bought},
    pending:{type:item.type,country:item.country||'',city:item.city||'',source:item.source||'',image:item.image||'',shoppingPlaceId:item.shoppingPlaceId||''}};
}
return Object.freeze({APP_DATA_KEY,GPS_LEDGER_KEY,normalizeBackup,safeImage,safeUrl,createLocalRepository,createJsonRecordStore,createCloudIdResolver,shoppingItemDraft});
});
