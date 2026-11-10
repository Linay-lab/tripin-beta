'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {planDate,planTime} from '../lib/plan-calendar';
import type {Plan} from '../lib/types';
import {useTripin} from './TripinShell';

type Editor={trip:string;plan?:Plan};

export function Plans({requestedTrip}:{requestedTrip:string}){
  const {data,savePlan,removePlan}=useTripin();
  const router=useRouter();
  const [editor,setEditor]=useState<Editor|null>(null);
  const [error,setError]=useState('');
  const trip=data.trips.find(item=>item.id===requestedTrip);
  const groups=new Map<string,Plan[]>();
  const plans=data.plans.map(plan=>({
    ...plan,
    date:planDate(plan.date)||plan.date||'',
    time:planTime(plan.time)||plan.time||'',
  })).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  for(const plan of plans){
    if(!plan.trip)continue;
    const group=groups.get(plan.trip);
    if(group)group.push(plan);
    else groups.set(plan.trip,[plan]);
  }
  const days=new Map<string,Plan[]>();
  if(trip){
    for(const plan of groups.get(trip.id)||[]){
      const date=plan.date||'';
      const day=days.get(date);
      if(day)day.push(plan);
      else days.set(date,[plan]);
    }
  }

  function selectTrip(id:string){
    setEditor(null);
    router.push(id?'/plans?trip='+encodeURIComponent(id):'/plans');
  }

  function openEditor(tripId:string,plan?:Plan){
    setError('');
    setEditor({trip:tripId,plan});
  }

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!editor)return;
    const form=new FormData(event.currentTarget);
    const read=(key:string)=>String(form.get(key)||'');
    const name=read('name').trim();
    if(!name){setError('請填寫行程名稱');return;}
    const plan:Plan={
      id:editor.plan?.id||crypto.randomUUID(),trip:editor.trip,name,
      date:read('date'),time:read('time'),place:read('place'),note:read('note'),
    };
    if(savePlan(plan,Boolean(editor.plan)))setEditor(null);
    else setError('行程未儲存。請確認旅行仍存在，或重新整理後再試。');
  }

  return <>
    <div className="top">
      <div><h1>行程規劃</h1><div className="muted"/></div>
      {trip&&<button className="btn primary" onClick={()=>openEditor(trip.id)}>＋ 新增行程</button>}
    </div>
    {!data.trips.length?<div className="empty">
      <p>建立旅行後就可以新增每日行程。</p>
      <button className="btn primary" onClick={()=>router.push('/trips')}>我的旅行</button>
    </div>:<>
      <div className="scopebar"><span>查看</span>
        <select aria-label="選擇旅行範圍" value={trip?.id||''} onChange={event=>selectTrip(event.target.value)}>
          <option value="">全部旅行</option>
          {data.trips.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {trip?<div className="v3-panel">
        <div className="row"><h2>每日行程</h2><span className="pill">{days.size} 天 · {groups.get(trip.id)?.length||0} 個安排</span></div>
        {days.size?[...days].map(([date,events],index)=><section key={date}>
          <div className="v3-day">Day {index+1}　{date||'日期未定'}</div>
          {events.map(plan=><div className="v3-event" key={plan.id}>
            <strong>{plan.time||'未定'}</strong><span className="v3-dot">📍</span>
            <div><strong>{plan.name}</strong><small>{plan.place||'未填地點'}{plan.note?' · '+plan.note:''}</small></div>
            <div className="actions">
              <button className="btn" onClick={()=>openEditor(trip.id,plan)}>編輯</button>
              <button className="btn danger" onClick={()=>removePlan(plan.id)}>刪除</button>
            </div>
          </div>)}
        </section>):<div className="empty">還沒有行程，點選「新增行程」開始規劃。</div>}
      </div>:data.trips.some(item=>groups.has(item.id))?data.trips.map(item=>{
        const entries=groups.get(item.id);
        if(!entries)return null;
        return <section className="scope-group" key={item.id}>
          <div className="scope-group-head"><h2>{item.name}</h2><button className="btn" onClick={()=>selectTrip(item.id)}>查看這趟</button></div>
          {entries.map(plan=><div className="scope-entry" key={plan.id}>
            <span className="scope-date">{plan.date||'未定'} {plan.time||''}</span>
            <div><strong>{plan.name}</strong><small>{plan.place||''}</small></div>
            <button className="btn" onClick={()=>openEditor(item.id,plan)}>編輯</button>
          </div>)}
        </section>;
      }):<div className="empty">目前沒有行程。選擇一趟旅行後即可新增。</div>}
    </>}
    {editor&&<div className="modalwrap" onClick={event=>{if(event.target===event.currentTarget)setEditor(null);}}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="plan-title"
        onKeyDown={event=>{if(event.key==='Escape')setEditor(null);}}>
        <header><h2 id="plan-title">{editor.plan?'編輯行程':'新增行程'}</h2>
          <button className="btn" aria-label="關閉行程表單" onClick={()=>setEditor(null)}>✕</button>
        </header>
        <form id="editor" onSubmit={submit}>
          <label className="field">行程名稱 *<input name="name" maxLength={300} defaultValue={editor.plan?.name} autoFocus required/></label>
          <div className="two">
            <label className="field">日期<input name="date" type={editor.plan?.date&&!planDate(editor.plan.date)?'text':'date'} defaultValue={editor.plan?.date}/></label>
            <label className="field">時間<input name="time" type={editor.plan?.time&&!planTime(editor.plan.time)?'text':'time'} defaultValue={editor.plan?.time}/></label>
          </div>
          <label className="field">地點<input name="place" maxLength={5000} defaultValue={editor.plan?.place}/></label>
          <label className="field">備註<input name="note" maxLength={5000} defaultValue={editor.plan?.note}/></label>
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
