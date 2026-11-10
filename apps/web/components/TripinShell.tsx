'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Data,type LocalData,type Trip,type Item} from '../lib/types';
import {seed} from '../lib/seed';
import {ItemEditor} from './ItemEditor';
import {TripEditor} from './TripEditor';

type NavPage='home'|'trips'|'library'|'shopping'|'plans'|'wallet'|'info'|'profile';
const navs:[NavPage,string][]=[['home','⌂ 首頁'],['trips','✈ 我的旅行'],['library','♡ 收藏庫'],['shopping','▣ 購物清單'],['plans','▤ 行程規劃'],['wallet','◈ 旅行錢包'],['info','⌁ 旅行資訊'],['profile','♙ 個人中心']];
type ContextValue={data:LocalData;openItem:(item?:Item)=>void;removeItem:(id:string)=>void;toggleItem:(id:string)=>void;tripFilter:string;setTripFilter:(filter:string)=>void;openTrip:(trip?:Trip)=>void;removeTrip:(id:string)=>void;saveTrip:(trip:Trip)=>boolean;legacy:(page:NavPage,options?:Record<string,string>)=>void;photo:(url:string,title:string)=>void};
const Context=createContext<ContextValue|null>(null);
export function useTripin(){const value=useContext(Context);if(!value)throw Error('Tripin provider missing');return value;}
export function TripinShell({children}:{children:React.ReactNode}){
 const router=useRouter(),path=usePathname();
 const [tripFilter,setTripFilter]=useState('all');
 const [data,setData]=useState<LocalData|null>(null),[loadError,setLoadError]=useState('');
 const [editor,setEditor]=useState<{trip?:Trip;kind:"trip"}|{item?:Item;kind:"item"}|null>(null),[lightbox,setLightbox]=useState<{url:string;title:string}|null>(null);
 const store=useRef<Data.LocalRepository|null>(null),snapshot=useRef<string|null>(null),blocked=useRef(false),current=useRef<LocalData|null>(null);
 const photoButton=useRef<HTMLButtonElement>(null),photoFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  let active=true;
  const repository=Data.createLocalRepository({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)});
  store.current=repository;
  const load=()=>{if(!active)return;const result=repository.load(seed);snapshot.current=result.raw;blocked.current=!result.ok;current.current=result.data;setData(result.data);setLoadError(result.ok?'':'原始資料無法讀取，已保留原始內容。請至個人中心匯出原始備份，再匯入有效檔案或重設；目前不會覆寫舊資料。');};
  Promise.resolve().then(load);
  const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)load();};window.addEventListener('pageshow',onPageShow);
  return()=>{active=false;window.removeEventListener('pageshow',onPageShow);};
 },[]);
 useLayoutEffect(()=>{setEditor(null);},[path]);
 useEffect(()=>{if(!lightbox)return;document.body.classList.add('photo-open');photoButton.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setLightbox(null);};window.addEventListener('keydown',key);return()=>{document.body.classList.remove('photo-open');window.removeEventListener('keydown',key);photoFocus.current?.focus();};},[lightbox]);
 function legacy(page:NavPage,options:Record<string,string>={}){const query=new URLSearchParams({page,...options});window.location.assign('/legacy.html?'+query);}
 function commit(next:LocalData){if(!store.current)return false;const result=store.current.save(next,snapshot.current,{blocked:blocked.current});if(!result.ok){window.alert(result.code==='CORRUPT'?'原始資料無法讀取，請先匯出原始備份，再匯入有效檔案或明確重設資料':result.code==='STALE'?'另一個分頁已更新資料，為避免覆蓋，請先匯出目前資料再重新整理':'資料欄位不正確或瀏覽器儲存空間不足，請確認內容、改用較小圖片或先匯出備份');return false;}snapshot.current=result.raw;current.current=next;setData(next);return true;}
 function saveTrip(trip:Trip){const old=current.current;if(!old)return false;const next=structuredClone(old),index=next.trips.findIndex(t=>t.id===trip.id);if(index<0)next.trips.push(trip);else next.trips[index]=trip;return commit(next);}
 function removeTrip(id:string){if(!window.confirm('確定刪除這筆資料？')||!current.current)return;const next=structuredClone(current.current);next.trips=next.trips.filter(t=>t.id!==id);next.items.forEach(x=>{if(x.trip===id)x.trip='';});next.plans=next.plans.filter(x=>x.trip!==id);next.expenses=next.expenses.filter(x=>x.trip!==id);next.info=next.info.filter(x=>x.trip!==id);if(commit(next)&&path===('/trips/'+encodeURIComponent(id)))router.push('/trips');}
 function saveItem(item:Item, editing:boolean){
  if(!current.current)return false;
  const items=[...current.current.items];
  const index=items.findIndex(existing=>existing.id===item.id);
  if(editing && index<0){window.alert('這筆收藏已不存在');return false;}
  if(index>=0)items[index]=item;
  else items.push(item);
  return commit({...current.current,items});
 }
 function toggleItem(id:string){
  const item=current.current?.items.find(existing=>existing.id===id);
  if(item?.type==='商品')saveItem({...item,bought:!item.bought},true);
 }
 function removeItem(id:string){
  if(!current.current||!window.confirm('確定刪除這筆資料？'))return;
  commit({...current.current,items:current.current.items.filter(item=>item.id!==id)});
 }
 const active=path==='/'?'home':path==='/trips'?'trips':path==='/library'?'library':'';
 function navigate(page:NavPage){if(page==='home'||page==='trips'||page==='library'){setEditor(null);router.push(page==='home'?'/':'/'+page);}else legacy(page);}
 const navButton=([page,label]:[NavPage,string],mobile=false)=><button key={page} className={active===page?'active':''} aria-label={mobile?label:undefined} onClick={()=>navigate(page)}>{label}</button>;
 return <>
  <aside><div className="brand"><span className="tripin-brand-mark" aria-hidden="true">✦</span>旅點<small>每一站，都不錯過。 · Beta</small></div><nav id="nav">{navs.map(n=>navButton(n))}</nav><div className="notice">獨立 Beta 測試版<br/>資料儲存在此瀏覽器，不會更動正式網站。</div><button className="beta-logout" onClick={()=>legacy('profile',{mode:'login'})}>↪ 登出測試版</button></aside>
  <main id="app">{!data?<div className="notice" role="status">正在讀取本機資料…</div>:<Context.Provider value={{data,tripFilter,setTripFilter,openTrip:trip=>setEditor({trip,kind:"trip"}),openItem:item=>setEditor({item,kind:"item"}),removeItem,toggleItem,removeTrip,saveTrip,legacy,photo:(url,title)=>{photoFocus.current=document.activeElement as HTMLElement;setLightbox({url,title});}}}>{loadError&&<div className="notice" role="alert">{loadError}</div>}{children}</Context.Provider>}</main>
  <button id="mobileProfile" type="button" onClick={()=>legacy('profile')} aria-label="個人中心">♙</button>
  <div className="bottom" id="bottom">{[navs[0],navs[1],navs[3],navs[4],navs[7]].map(n=>navButton(n,true))}</div>
  <div id="overlay">{editor?.kind==="trip"&&data&&<TripEditor trip={editor.trip} onSave={saveTrip} onClose={()=>setEditor(null)}/>}
   {editor?.kind==="item"&&data&&<ItemEditor item={editor.item} data={data} onSave={saveItem} onClose={()=>setEditor(null)}/>}
  </div>
  <div id="v12-notice" role="note">測試版：資料僅儲存在此瀏覽器。更換裝置前請至個人中心匯出備份。</div>
  <button type="button" className="feedback-fab" id="feedbackFab" onClick={()=>legacy('profile',{action:'feedback'})}>✎ 隨時回饋</button>
  {lightbox&&<div id="photoLightbox" className="photo-lightbox" onClick={event=>{if(event.target===event.currentTarget)setLightbox(null);}}><div className="photo-lightbox-inner" role="dialog" aria-modal="true" aria-label="放大照片"><button ref={photoButton} id="photoClose" type="button" onClick={()=>setLightbox(null)} aria-label="關閉放大照片">✕</button><img id="photoLarge" src={lightbox.url} alt={lightbox.title}/><div id="photoCaption">{lightbox.title}</div></div></div>}
 </>;
}
