'use client';

import {useState} from 'react';
import {useTripin} from './TripinShell';
import {Data,type Item} from '../lib/types';

export const collectionTypes=['商品','餐廳','景點','店家','其他'];
export const purposes=['自用','送禮','託買'];
const money=(v:number,c='TWD')=>`${c} ${Number(v||0).toLocaleString()}`;

const cardIcons:Record<string,string>={商品:'🎁',餐廳:'☕',景點:'⛩️',店家:'🏬',其他:'📌'};
const cardStyles:Record<string,string>={商品:'goods',餐廳:'food',景點:'place',店家:'store',其他:'other'};

export function CollectionCards({items}:{items:Item[]}){
  const {openItem,toggleItem,removeItem,photo}=useTripin();
  if(!items.length)return <div className="empty">沒有符合的項目。按「新增」就能開始使用。</div>;

  return <div className="v6-collection-grid">{items.map(item=>{
    const image=Data.safeImage(item.image);
    const source=Data.safeUrl(item.source);
    const type=item.type||'其他';
    const product=type==='商品';
    function openPhoto(){photo(image,item.name||'');}

    return <article className="v6-item" key={item.id}>
      <div className={'v6-photo v6-'+(cardStyles[type]||'other')}>
        {image?<img loading="lazy" src={image} alt={item.name} role="button" tabIndex={0}
          aria-label={`放大 ${item.name} 的照片`} onClick={openPhoto}
          onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openPhoto();}}}
          onError={event=>{event.currentTarget.style.display='none';event.currentTarget.parentElement?.classList.add('v10-image-error');}}/>
          :<div className="v6-placeholder" aria-label="尚未上傳照片"><span>{cardIcons[type]||'📌'}</span></div>}
        <span className="v6-type">{item.type}</span>
      </div>
      <div className="v6-item-body">
        <h3>{item.name}</h3>
        <p className="muted">{item.place||'尚未指定店家'}</p>
        <div className="v6-meta">📍 {item.country||'未分類'} {item.city||''}{item.category?' · '+item.category:''}</div>
        <div className="v6-price">{product&&item.price>0?<>{money(item.price,item.currency)} <small>× {item.qty||1}</small></>:'\u00a0'}</div>
        <div className="v6-card-actions">
          <button className="btn" onClick={()=>openItem(item)}>編輯</button>
          {product&&<button className="btn" onClick={()=>toggleItem(item.id)}>{item.bought?'取消已購':'標記已購'}</button>}
          <button className="btn danger" onClick={()=>removeItem(item.id)}>刪除</button>
          {source&&<a className="btn" href={source} target="_blank" rel="noopener noreferrer">來源</a>}
        </div>
      </div>
    </article>;
  })}</div>;
}

export function Library(){
  const {data,openItem,removeItem,photo}=useTripin();
  const [type,setType]=useState('全部');
  const [query,setQuery]=useState('');
  const [purpose,setPurpose]=useState('');
  const [layout,setLayout]=useState<'grid'|'list'>('grid');
  const search=query.toLowerCase();
  const items=data.items.filter(item=>
    (type==='全部'||item.type===type) &&
    (!purpose||item.category===purpose) &&
    [item.name,item.place,item.country,item.city,item.note,item.recipient].some(value=>value?.toLowerCase().includes(search)||!search)
  );

  return <>
    <div className="top"><div><h1>收藏庫</h1><div className="muted"/></div><button className="btn primary" onClick={()=>openItem()}>＋ 新增收藏</button></div>
    <div className="v5-chips">{['全部',...collectionTypes].map(category=>
      <button key={category} className={'v5-chip'+(type===category?' selected':'')} aria-pressed={type===category} onClick={()=>setType(category)}>
        {category} <span>{category==='全部'?data.items.length:data.items.filter(item=>item.type===category).length}</span>
      </button>
    )}</div>
    <div className="toolbar">
      <input aria-label="搜尋收藏" placeholder="🔎 搜尋收藏…" value={query} onChange={event=>setQuery(event.target.value)}/>
      <select aria-label="用途篩選" value={purpose} onChange={event=>setPurpose(event.target.value)}>
        <option value="">全部用途</option>{purposes.map(value=><option key={value}>{value}</option>)}
      </select>
      <div className="layout-switch" role="group" aria-label="收藏顯示方式">
        <button className={'btn '+(layout==='grid'?'active-layout':'')} aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}>▦ 卡片</button>
        <button className={'btn '+(layout==='list'?'active-layout':'')} aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>☷ 清單</button>
      </div>
    </div>
    <div id="list">{layout==='grid'?<CollectionCards items={items}/>:items.length?
      <div className="library-list">{items.map(item=>{
        const image=Data.safeImage(item.image);
        return <article className="library-list-item" key={item.id}>
          <div className="library-list-thumb">
            {image?<button type="button" className="thumb zoomable-thumb" aria-label={`放大 ${item.name} 的照片`} onClick={()=>photo(image,item.name||'')}><img src={image} alt={item.name}/></button>:<div className="thumb">{({商品:'🎁',餐廳:'🍜',景點:'🌸',店家:'🏬',其他:'📌'} as Record<string,string>)[item.type||'']||'📌'}</div>}
          </div>
          <div className="library-list-main"><strong>{item.name}</strong><small>{item.type} · {item.place||item.city||item.country||'未分類'}</small></div>
          {item.type==='商品'&&<span className="library-list-price">{money(item.price,item.currency)}</span>}
          <div className="library-list-actions">
            <button className="btn" onClick={()=>openItem(item)}>編輯</button>
            <button className="btn danger" onClick={()=>removeItem(item.id)}>刪除</button>
          </div>
        </article>;
      })}</div>:<div className="empty">沒有符合的收藏</div>}
    </div>
  </>;
}
