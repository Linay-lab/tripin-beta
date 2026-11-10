'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {Expense} from '../lib/types';
import {planDate} from '../lib/plan-calendar';
import {useTripin} from './TripinShell';

const currencies=['TWD','JPY','USD','KRW','EUR','THB','HKD'];
type Editor={trip:string;expense?:Expense};

function money(amount:number,currency='TWD'){
  return `${currency} ${amount.toLocaleString()}`;
}

function localToday(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

export function Wallet({requestedTrip}:{requestedTrip:string}){
  const {data,saveExpense,removeExpense}=useTripin();
  const router=useRouter();
  const [editor,setEditor]=useState<Editor|null>(null);
  const [error,setError]=useState('');
  const trip=data.trips.find(candidate=>candidate.id===requestedTrip);
  const byTrip=new Map<string,Expense[]>();
  for(const entry of data.expenses){
    if(!entry.trip)continue;
    const entries=byTrip.get(entry.trip);
    if(entries)entries.push(entry);
    else byTrip.set(entry.trip,[entry]);
  }
  const entries=trip?byTrip.get(trip.id)||[]:[];
  const totals=new Map<string,number>();
  for(const entry of entries){
    const currency=entry.currency||'TWD';
    totals.set(currency,(totals.get(currency)||0)+entry.amount);
  }
  const spent=totals.get('TWD')||0;
  const budget=trip?.budget||0;
  const percent=budget?Math.min(100,Math.round(spent/budget*100)):0;
  const currency=editor?.expense?.currency||'TWD';
  const options=currencies.includes(currency)?currencies:[currency,...currencies];
  const rawDate=editor?.expense?.date;
  const normalizedDate=planDate(rawDate);

  function selectTrip(id:string){
    setEditor(null);
    router.push(id?'/wallet?trip='+encodeURIComponent(id):'/wallet');
  }

  function openEditor(tripId:string,expense?:Expense){
    setError('');
    setEditor({trip:tripId,expense});
  }

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!editor)return;
    const form=new FormData(event.currentTarget);
    const read=(name:string)=>String(form.get(name)||'');
    const name=read('name').trim();
    const amount=Number(read('amount'));
    if(!name||!read('amount')||!Number.isFinite(amount)||amount<0||amount>1e12){
      setError('請填寫支出項目與有效金額。');
      return;
    }
    const expense:Expense={
      id:editor.expense?.id||crypto.randomUUID(),trip:editor.trip,name,amount,
      currency:read('currency'),payer:read('payer'),date:read('date'),
    };
    if(saveExpense(expense,Boolean(editor.expense)))setEditor(null);
    else setError('支出未儲存。請確認旅行仍存在，或重新整理後再試。');
  }

  return <>
    <div className="top">
      <div><h1>旅行錢包</h1><div className="muted"/></div>
      {trip&&<button className="btn primary" onClick={()=>openEditor(trip.id)}>＋ 新增支出</button>}
    </div>
    {!data.trips.length?<div className="empty">
      <p>建立旅行後就可以記錄預算與支出。</p>
      <button className="btn primary" onClick={()=>router.push('/trips')}>我的旅行</button>
    </div>:<>
      <div className="scopebar"><span>查看</span>
        <select aria-label="選擇旅行範圍" value={trip?.id||''} onChange={event=>selectTrip(event.target.value)}>
          <option value="">全部旅行</option>
          {data.trips.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      </div>
      {trip?<>
        <section className="v3-panel">
          <h2>Budget / 預算總覽</h2>
          <div className="v3-budget">
            <div>總預算（TWD）<b>{money(budget)}</b></div>
            <div>已支出（TWD）<b style={{color:'#d75e5e'}}>{money(spent)}</b></div>
            <div>剩餘（TWD）<b style={{color:'#2e8e78'}}>{money(budget-spent)}</b></div>
          </div>
          <div className="v3-progress"><span style={{width:percent+'%'}}/></div>
          <small>台幣預算使用 {percent}%（其他幣別未換算）</small>
        </section>
        <section className="v3-panel">
          <div className="row"><h2>支出紀錄</h2><span className="pill">{entries.length} 筆</span></div>
          <div className="v3-table-wrap"><table className="v3-table">
            <thead><tr>{['日期','項目','金額','付款人','操作'].map(label=><th key={label}>{label}</th>)}</tr></thead>
            <tbody>{entries.length?entries.map(entry=><tr key={entry.id}>
              <td>{entry.date}</td><td>{entry.name}</td><td>{money(entry.amount,entry.currency||'TWD')}</td><td>{entry.payer}</td>
              <td><button className="btn" onClick={()=>openEditor(trip.id,entry)}>編輯</button>{' '}
                <button className="btn danger" onClick={()=>removeExpense(entry.id)}>刪除</button></td>
            </tr>):<tr><td colSpan={5}>尚無支出</td></tr>}</tbody>
          </table></div>
          {totals.size>0&&<p className="muted">幣別：{[...totals].map(([code,total])=>money(total,code)).join(' · ')}</p>}
        </section>
      </>:<>
        <div className="scope-summary">{data.trips.map(candidate=>{
          const total=(byTrip.get(candidate.id)||[]).reduce((sum,entry)=>
            (entry.currency||'TWD')==='TWD'?sum+entry.amount:sum,0);
          return <div className="scope-summary-card" key={candidate.id}>
            <small>{candidate.name}</small><strong>{money(total)}</strong><span>台幣支出</span>
          </div>;
        })}</div>
        {data.trips.some(candidate=>byTrip.has(candidate.id))?data.trips.map(candidate=>{
          const expenses=byTrip.get(candidate.id);
          if(!expenses)return null;
          return <section className="scope-group" key={candidate.id}>
            <div className="scope-group-head"><h2>{candidate.name}</h2>
              <button className="btn" onClick={()=>selectTrip(candidate.id)}>查看這趟</button>
            </div>
            {expenses.map(entry=><div className="scope-entry" key={entry.id}>
              <div><strong>{entry.name}</strong><small>{entry.date||''} · {entry.payer||''}</small></div>
              <strong>{money(entry.amount,entry.currency||'TWD')}</strong>
              <button className="btn" onClick={()=>openEditor(candidate.id,entry)}>編輯</button>
            </div>)}
          </section>;
        }):<div className="empty">目前沒有支出。選擇一趟旅行後即可新增。</div>}
      </>}
    </>}
    {editor&&<div className="modalwrap" onClick={event=>{if(event.target===event.currentTarget)setEditor(null);}}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title"
        onKeyDown={event=>{if(event.key==='Escape')setEditor(null);}}>
        <header><h2 id="expense-title">{editor.expense?'編輯支出':'新增支出'}</h2>
          <button className="btn" aria-label="關閉支出表單" onClick={()=>setEditor(null)}>✕</button>
        </header>
        <form id="editor" onSubmit={submit}>
          <label className="field">支出項目 *<input name="name" maxLength={300} defaultValue={editor.expense?.name} autoFocus required/></label>
          <div className="two">
            <label className="field">金額<input name="amount" type="number" min="0" max="1000000000000" step="any" defaultValue={editor.expense?.amount??0} required/></label>
            <label className="field">幣別<select name="currency" defaultValue={currency}>{options.map(code=><option key={code}>{code}</option>)}</select></label>
            <label className="field">付款人<input name="payer" maxLength={5000} defaultValue={editor.expense?.payer??'自己'}/></label>
            <label className="field">日期<input name="date" type={rawDate&&!normalizedDate?'text':'date'} defaultValue={normalizedDate||rawDate||(editor.expense?'':localToday())}/></label>
          </div>
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
