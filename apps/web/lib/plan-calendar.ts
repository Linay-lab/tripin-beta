export function planDate(value?:string){
  const date=(value||'').trim().replace(/年|月/g,'/').replace(/日$/,'');
  const match=/^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/.exec(date);
  if(!match)return '';
  const [,year,,month,day]=match;
  const y=Number(year),m=Number(month),d=Number(day);
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const limit=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
  if(!y||!limit||d<1||d>limit)return '';
  return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

export function planTime(value?:string){
  const time=(value||'').trim();
  const match=/^(?:(上午|下午|am|pm)\s*)?(\d{1,2}):(\d{2})(?::[0-5]\d)?(?:\s*(上午|下午|am|pm))?$/i.exec(time);
  if(!match)return '';
  const [,prefix,hour,minute,suffix]=match;
  const period=(prefix||suffix||'').toLowerCase();
  let h=Number(hour);
  if(Number(minute)>59||h>23||(prefix&&suffix))return '';
  if(period){
    if(h<1||h>12)return '';
    h=h%12+(period==='下午'||period==='pm'?12:0);
  }
  return `${String(h).padStart(2,'0')}:${minute}`;
}
