'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Data,type Item,type LocalData} from '../lib/types';
import {compress} from '../lib/media';
import {collectionTypes,purposes} from './Library';

type Props={
  item?:Item;
  defaultTrip?:string;
  data:LocalData;
  onSave:(item:Item,editing:boolean)=>boolean;
  onClose:()=>void;
};

const currencies=['JPY','TWD','USD','KRW','EUR','THB','HKD','CNY','SGD'];
const methods=['手動新增','貼連結','上傳圖片'];

export function ItemEditor({item,defaultTrip,data,onSave,onClose}:Props){
  const [method,setMethod]=useState('手動新增');
  const [type,setType]=useState(item?.type||'商品');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState('');
  const active=useRef(false);
  const pending=useRef(false);
  const photo=useRef<HTMLInputElement>(null);
  const source=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    active.current=true;
    return ()=>{active.current=false;};
  },[]);
  useEffect(()=>{
    if(preview)return ()=>URL.revokeObjectURL(preview);
  },[preview]);

  function chooseMethod(value:string){
    setMethod(value);
    if(value==='貼連結')source.current?.focus();
    if(value==='上傳圖片')photo.current?.focus();
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(pending.current)return;
    const form=new FormData(event.currentTarget);
    const field=(name:string)=>String(form.get(name)||'');
    const name=field('name').trim();
    const sourceUrl=Data.safeUrl(field('source'));
    if(!name){setError('請填寫名稱');return;}
    if(field('source').trim()&&!sourceUrl){setError('請輸入有效的來源網址');return;}
    pending.current=true;
    setBusy(true);
    setError('');
    try{
      const file=photo.current?.files?.[0];
      const image=file?await compress(file):item?.image;
      if(!active.current)return;
      const next:Item={
        ...item,id:item?.id||crypto.randomUUID(),name,type,
        category:field('category'),country:field('country'),city:field('city'),
        place:field('place'),recipient:field('recipient'),note:field('note'),
        trip:field('trip'),source:sourceUrl,image,
        price:Number(field('price'))||0,qty:Number(field('qty'))||1,
        currency:field('currency'),bought:type==='商品'&&form.has('bought'),
        shoppingPlaceId:type==='商品'?field('shoppingPlaceId'):'',
      };
      if(onSave(next,Boolean(item)))onClose();
    }catch{
      if(active.current)setError('圖片讀取失敗，請使用 15 MB 以內的 JPG、PNG 或 WebP。');
    }finally{
      pending.current=false;
      if(active.current)setBusy(false);
    }
  }

  function input(name:keyof Item,label:string,maxLength=5000){
    return <div className="field"><label htmlFor={'collection-'+name}>{label}</label>
      <input id={'collection-'+name} name={name} maxLength={maxLength} defaultValue={String(item?.[name]??'')}/>
    </div>;
  }
  const image=preview||Data.safeImage(item?.image);
  return <div className="modalwrap" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="collection-title">
      <header><h2 id="collection-title">{item?'編輯收藏':defaultTrip?'新增商品':'新增收藏'}</h2><button className="btn" onClick={onClose} aria-label="關閉收藏表單">✕</button></header>
      <form id="editor" onSubmit={submit}>
        {image&&<div className="v8-preview"><img src={image} alt="收藏圖片預覽"/><span>{preview?'新圖片預覽':'目前圖片（不選新圖會保留）'}</span></div>}
        <div className="tabs">{methods.map(value=><button key={value} type="button" className={method===value?'selected':''} onClick={()=>chooseMethod(value)}>{value}</button>)}</div>
        <div className="notice">貼連結會保存網址，但不會自動擷取 IG/Threads 內容。上傳圖片可先預覽。</div>
        <div className="field"><label htmlFor="collection-photo">商品／收藏圖片（選填）</label>
          <input id="collection-photo" ref={photo} type="file" name="photo" accept="image/jpeg,image/png,image/webp" onChange={event=>{
            const file=event.target.files?.[0];
            if(file&&(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>15*1024*1024)){
              event.target.value='';
              setPreview('');
              setError('請使用 15 MB 以內的 JPG、PNG 或 WebP。');
              return;
            }
            setError('');
            setPreview(file?URL.createObjectURL(file):'');
          }}/>
        </div>
        {input('name','名稱 *',300)}
        <div className="two">
          <div className="field"><label htmlFor="collection-type">類型</label><select id="collection-type" name="type" value={type} onChange={event=>setType(event.target.value)}>{collectionTypes.map(value=><option key={value}>{value}</option>)}</select></div>
          <div className="field"><label htmlFor="collection-purpose">用途</label><select id="collection-purpose" name="category" defaultValue={item?.category||'自用'}>{purposes.map(value=><option key={value}>{value}</option>)}</select></div>
          {input('country','國家')}{input('city','城市')}{input('place','購買地點／店家')}{input('recipient','給誰')}
          <div className="field"><label htmlFor="collection-price">單價</label><input id="collection-price" name="price" type="number" min="0" max="1000000000000" step="any" defaultValue={item?.price??0}/></div>
          <div className="field"><label htmlFor="collection-currency">幣別</label><select id="collection-currency" name="currency" defaultValue={item?.currency||'JPY'}>{currencies.map(value=><option key={value}>{value}</option>)}</select></div>
          <div className="field"><label htmlFor="collection-quantity">數量</label><input id="collection-quantity" name="qty" type="number" min="1" max="1000000" step="1" defaultValue={item?.qty??1}/></div>
        </div>
        <div className="field"><label htmlFor="collection-trip">加入哪趟旅行（可不選）</label><select id="collection-trip" name="trip" defaultValue={item?.trip??defaultTrip??''}><option value="">不加入旅行</option>{data.trips.map(trip=><option value={trip.id} key={trip.id}>{trip.name}</option>)}</select></div>
        {input('note','備註')}
        <div className="field"><label htmlFor="collection-source">來源網址（選填）</label><input id="collection-source" ref={source} name="source" type="url" maxLength={4096} defaultValue={item?.source||''}/></div>
        {type==='商品'&&<>
          <label><input type="checkbox" name="bought" defaultChecked={item?.bought}/> 已購買</label>
          <div className="gps-link"><label htmlFor="collection-shop">GPS 提醒店家（商品適用）</label>
            <select id="collection-shop" name="shoppingPlaceId" defaultValue={item?.shoppingPlaceId||''}>
              <option value="">不設定定位提醒</option>
              {(data.shoppingPlaces||[]).map(place=><option value={place.id} key={place.id}>{place.name}</option>)}
            </select>
            <p className="muted">可在購物清單的「提醒設定與店家」新增分店。</p>
          </div>
        </>}
        {error&&<p className="notice" role="alert">{error}</p>}
        <div className="actions"><button className="btn primary" disabled={busy} type="submit">{busy?'儲存中…':'儲存'}</button><button type="button" className="btn" onClick={onClose}>取消</button></div>
      </form>
    </div>
  </div>;
}
