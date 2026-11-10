'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {Info} from '../lib/types';
import {useTripin} from './TripinShell';

const types=['機票','住宿','交通','訂位','其他'];
type Editor={trip:string;entry?:Info};

export function TripInfo({requestedTrip}:{requestedTrip:string}){
  const {data,saveInfo,removeInfo}=useTripin();
  const router=useRouter();
  const [editor,setEditor]=useState<Editor|null>(null);
  const [error,setError]=useState('');
  const trip=data.trips.find(candidate=>candidate.id===requestedTrip);
  const groups=new Map<string,Info[]>();
  for(const entry of data.info){
    if(!entry.trip)continue;
    const group=groups.get(entry.trip);
    if(group)group.push(entry);
    else groups.set(entry.trip,[entry]);
  }
  const entries=trip?groups.get(trip.id)||[]:[];
  const type=editor?.entry?.type||types[0];
  const options=types.includes(type)?types:[type,...types];

  function selectTrip(id:string){
    setEditor(null);
    router.push(id?'/info?trip='+encodeURIComponent(id):'/info');
  }

  function openEditor(tripId:string,entry?:Info){
    setError('');
    setEditor({trip:tripId,entry});
  }

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!editor)return;
    const form=new FormData(event.currentTarget);
    const read=(key:string)=>String(form.get(key)||'');
    const name=read('name').trim();
    if(!name){setError('請填寫標題。');return;}
    const entry:Info={
      id:editor.entry?.id||crypto.randomUUID(),trip:editor.trip,name,
      type:read('type'),value:read('value'),note:read('note'),
    };
    if(saveInfo(entry,Boolean(editor.entry)))setEditor(null);
    else setError('旅行資訊未儲存。請確認旅行仍存在，或重新整理後再試。');
  }

  return <>
    <div className="top">
      <div><h1>旅行資訊</h1><div className="muted"/></div>
      {trip&&<button className="btn primary" onClick={()=>openEditor(trip.id)}>＋ 新增資訊</button>}
    </div>
    {!data.trips.length?<div className="empty">
      <p>建立旅行後就可以新增機票、住宿與交通資訊。</p>
      <button className="btn primary" onClick={()=>router.push('/trips')}>我的旅行</button>
    </div>:<>
      <div className="scopebar"><span>查看</span>
        <select aria-label="選擇旅行範圍" value={trip?.id||''} onChange={event=>selectTrip(event.target.value)}>
          <option value="">全部旅行</option>
          {data.trips.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      </div>
      {trip?entries.length?<div className="grid">
        {entries.map(entry=><article className="card" key={entry.id}>
          <span className="pill">{entry.type}</span><h3>{entry.name}</h3>
          <p style={{overflowWrap:'anywhere'}}>{entry.value}</p><p className="muted">{entry.note}</p>
          <div className="actions">
            <button className="btn" onClick={()=>openEditor(trip.id,entry)}>編輯</button>
            <button className="btn danger" onClick={()=>removeInfo(entry.id)}>刪除</button>
          </div>
        </article>)}
      </div>:<div className="empty">還沒有旅行資訊。</div>:data.trips.some(candidate=>groups.has(candidate.id))?data.trips.map(candidate=>{
        const items=groups.get(candidate.id);
        if(!items)return null;
        return <section className="scope-group" key={candidate.id}>
          <div className="scope-group-head"><h2>{candidate.name}</h2>
            <button className="btn" onClick={()=>selectTrip(candidate.id)}>查看這趟</button>
          </div>
          {items.map(entry=><div className="scope-entry" key={entry.id}>
            <span className="pill">{entry.type}</span>
            <div style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{entry.name}</strong><small>{entry.value}</small></div>
            <button className="btn" onClick={()=>openEditor(candidate.id,entry)}>編輯</button>
          </div>)}
        </section>;
      }):<div className="empty">目前沒有旅行資訊。選擇一趟旅行後即可新增。</div>}
    </>}
    {editor&&<div className="modalwrap" onClick={event=>{if(event.target===event.currentTarget)setEditor(null);}}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="info-title"
        onKeyDown={event=>{if(event.key==='Escape')setEditor(null);}}>
        <header><h2 id="info-title">{editor.entry?'編輯資訊':'新增資訊'}</h2>
          <button className="btn" aria-label="關閉旅行資訊表單" onClick={()=>setEditor(null)}>✕</button>
        </header>
        <form id="editor" onSubmit={submit}>
          <label className="field">類型<select name="type" defaultValue={type}>{options.map(value=><option key={value}>{value}</option>)}</select></label>
          <label className="field">標題 *<input name="name" maxLength={300} defaultValue={editor.entry?.name} autoFocus required/></label>
          <label className="field">內容／編號／連結<input name="value" maxLength={5000} defaultValue={editor.entry?.value}/></label>
          <label className="field">備註<input name="note" maxLength={5000} defaultValue={editor.entry?.note}/></label>
          {error&&<p className="notice" role="alert">{error}</p>}
          <div className="actions">
            <button className="btn primary" type="submit">儲存</button>
            <button className="btn" type="button" onClick={()=>setEditor(null)}>取消</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
