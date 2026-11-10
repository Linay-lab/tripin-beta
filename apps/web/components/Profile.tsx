'use client';

import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {useRouter} from 'next/navigation';
import {useTripin} from './TripinShell';

const maxBackupBytes=10*1024*1024;

export function Profile(){
  const {exportBackup,importBackup,resetDemo,legacy}=useTripin();
  const router=useRouter();
  const input=useRef<HTMLInputElement>(null);
  const active=useRef(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{text:string;error?:boolean}|null>(null);

  useEffect(()=>{
    active.current=true;
    return ()=>{active.current=false;};
  },[]);

  function downloadBackup(){
    try{
      const text=exportBackup();
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='travel-studio-beta-backup.json';
      link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage({text:'已開始下載備份。'});
    }catch{
      setMessage({text:'無法讀取原始備份，請檢查瀏覽器儲存權限。',error:true});
    }
  }

  async function restoreBackup(event:ChangeEvent<HTMLInputElement>){
    const field=event.currentTarget;
    const file=field.files?.[0];
    field.value='';
    if(!file)return;
    setMessage(null);
    setBusy(true);
    try{
      if(file.size>maxBackupBytes)throw Error('Backup too large');
      const text=await file.text();
      if(active.current&&importBackup(text))setMessage({text:'備份已還原。'});
    }catch{
      if(active.current)setMessage({text:'檔案格式不正確、資料欄位不符或超過 10 MB，原資料已保留。',error:true});
    }finally{
      if(active.current)setBusy(false);
    }
  }

  return <>
    <div className="top"><div><h1>個人中心</h1><div className="muted">帳號管理、偏好設定與 Beta 資料備份</div></div></div>
    <div className="v4-profile">
      <section className="v3-panel">
        <div className="v4-avatar" aria-hidden="true">👤</div>
        <h2>旅點使用者</h2>
        <p className="muted">TRIPIN · 本機測試模式</p>
        <button className="btn" onClick={()=>legacy('profile',{mode:'login'})}>登出測試版</button>
      </section>
      <section className="v3-panel">
        <h2>帳號與設定</h2>
        <div className="v4-setting">👤 帳號資料 <span>本機測試模式</span></div>
        <div className="v4-setting">⚙️ 偏好設定 <span>預設語言：繁體中文</span></div>
        <div className="v4-setting">🔔 通知設定 <button className="btn" onClick={()=>legacy('profile')}>開啟 GPS 提醒設定</button></div>
        <h3>Beta 測試資料</h3>
        <p className="muted">資料保存在此瀏覽器。匯入備份或重設示範資料會取代目前的旅點資料。</p>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={downloadBackup}>匯出備份 JSON</button>
          <button className="btn" disabled={busy} onClick={()=>input.current?.click()}>匯入備份 JSON</button>
          <input hidden ref={input} type="file" accept=".json,application/json" aria-label="選擇備份檔案" onChange={restoreBackup}/>
          <button className="btn danger" disabled={busy} onClick={()=>{if(resetDemo())router.push('/');}}>重設示範資料</button>
        </div>
        {message&&<p className="notice" role={message.error?'alert':'status'}>{message.text}</p>}
      </section>
    </div>
  </>;
}
