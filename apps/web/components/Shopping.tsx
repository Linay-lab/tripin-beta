'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Data,type Item} from '../lib/types';
import {purposes} from './Library';
import {useTripin} from './TripinShell';

function money(value:number,currency?:string){
  return `${currency||'TWD'} ${value.toLocaleString()}`;
}

function ProductPhoto({item}:{item:Item}){
  const {photo}=useTripin();
  const image=Data.safeImage(item.image);
  if(!image)return <div className="thumb">🎁</div>;
  return <button className="thumb zoomable-thumb" type="button" aria-label={`放大 ${item.name} 的照片`}
    onClick={()=>photo(image,item.name||'')}><img src={image} alt={item.name}/></button>;
}

export function Shopping({requestedTrip}:{requestedTrip:string}){
  const router=useRouter();
  const {data,openItem,removeItem,toggleItem,legacy}=useTripin();
  const [query,setQuery]=useState('');
  const [purpose,setPurpose]=useState('');
  const trip=data.trips.find(candidate=>candidate.id===requestedTrip);
  const tripIds=new Set(data.trips.map(candidate=>candidate.id));
  const products=data.items.filter(item=>item.type==='商品'&&
    (trip?item.trip===trip.id:tripIds.has(item.trip||'')));
  const search=query.trim().toLowerCase();
  const filtered=products.filter(item=>(!purpose||(item.category||'自用')===purpose)&&
    (!search||[item.name,item.place,item.country,item.city,item.note,item.recipient]
      .some(value=>value?.toLowerCase().includes(search))));
  const bought=products.filter(item=>item.bought).length;
  const groups=new Map<string,Item[]>();
  for(const item of filtered){
    const key=item.trip||'';
    const group=groups.get(key);
    if(group)group.push(item);
    else groups.set(key,[item]);
  }

  function selectTrip(id:string){
    router.push(id?'/shopping?trip='+encodeURIComponent(id):'/shopping');
  }

  return <>
    <div className="top">
      <div><h1>購物清單</h1><div className="muted"/></div>
      {trip&&<button className="btn primary" onClick={()=>openItem(undefined,trip.id)}>＋ 新增商品</button>}
    </div>
    {data.trips.length>0&&<section className="gps-panel" aria-label="GPS 購物提醒">
      <h2>GPS｜靠近店家，提醒待購商品</h2>
      <p>可以在原版購物頁設定分店、啟用 GPS 提醒或使用「幫我找店家」。</p>
      <button className="btn" onClick={()=>legacy('shopping',trip?{trip:trip.id}:undefined)}>開啟 GPS 提醒與找店家</button>
    </section>}
    {!data.trips.length?<div className="empty">
      <p>新增旅行後，就能整理該趟的購物清單。也可以先把想買的商品存進收藏庫。</p>
      <div className="actions"><button className="btn primary" onClick={()=>router.push('/trips')}>我的旅行</button>
        <button className="btn" onClick={()=>router.push('/library')}>前往收藏庫</button></div>
    </div>:<>
      <div className="scopebar"><span>查看</span>
        <select aria-label="選擇旅行範圍" value={trip?.id||''} onChange={event=>selectTrip(event.target.value)}>
          <option value="">全部旅行</option>
          {data.trips.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      </div>
      <div className="toolbar">
        <input aria-label="搜尋商品" placeholder="搜尋商品…" value={query} onChange={event=>setQuery(event.target.value)}/>
        {trip&&<>
          <select aria-label="商品分類" value={purpose} onChange={event=>setPurpose(event.target.value)}>
            <option value="">全部分類</option>{purposes.map(value=><option key={value}>{value}</option>)}
          </select>
          <button className="btn" onClick={()=>{setPurpose('');setQuery('');}}>清除篩選</button>
        </>}
      </div>
      {trip?<div className="v3-panel">
        <div className="row"><h2>購物清單</h2><span className="pill">已購 {bought} / {products.length}</span></div>
        <div className="v3-table-wrap"><table className="v3-table">
          <thead><tr>{['商品','分類','單價','數量','合計','狀態','操作'].map(title=><th key={title}>{title}</th>)}</tr></thead>
          <tbody>{filtered.length?filtered.map(item=><tr key={item.id}>
            <td><div className="mini"><ProductPhoto item={item}/><div><strong>{item.name}</strong><small style={{display:'block',color:'#81909f'}}>{item.place||item.city||''}</small></div></div></td>
            <td><span className="pill">{item.category||'自用'}</span></td>
            <td>{money(item.price,item.currency)}</td><td>{item.qty}</td><td>{money(item.price*item.qty,item.currency)}</td>
            <td><label><input type="checkbox" checked={item.bought} onChange={()=>toggleItem(item.id)}/> {item.bought?'已購買':'未購買'}</label></td>
            <td><button className="btn" onClick={()=>openItem(item)}>編輯</button>{' '}<button className="btn danger" onClick={()=>removeItem(item.id)}>刪除</button></td>
          </tr>):<tr><td colSpan={7}>尚無符合條件的商品</td></tr>}</tbody>
        </table></div>
        <p className="notice">不同幣別各自顯示。新增、編輯和購買狀態會保存在這個瀏覽器。</p>
      </div>:filtered.length?data.trips.map(candidate=>{
        const items=groups.get(candidate.id);
        if(!items?.length)return null;
        return <section className="scope-group" key={candidate.id}>
          <div className="scope-group-head"><h2>{candidate.name}</h2><button className="btn" onClick={()=>selectTrip(candidate.id)}>查看這趟</button></div>
          {items.map(item=><div className="scope-entry shopping-scope-entry" key={item.id}>
            <div className="shopping-scope-photo"><ProductPhoto item={item}/></div>
            <div><strong>{item.name}</strong><small>{item.place||''} · {money(item.price*item.qty,item.currency)}</small></div>
            <label><input type="checkbox" checked={item.bought} onChange={()=>toggleItem(item.id)}/> 已購</label>
            <button className="btn" onClick={()=>openItem(item)}>編輯</button>
          </div>)}
        </section>;
      }):<div className="empty">{search?'尚無符合條件的商品':'目前沒有資料。可選擇一趟旅行後新增商品。'}</div>}
    </>}
  </>;
}
