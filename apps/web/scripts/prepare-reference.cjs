// The reference is byte-for-byte original. The compatibility copy only adds a
// navigation handoff, never injects the original app into React or sends mail.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),output=path.join(__dirname,'../public');
fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
fs.writeFileSync(path.join(output,'reference.html'),html);
const bridge=`<script>
(function(){
 const q=new URLSearchParams(location.search),allowed=['home','trips','library','shopping','plans','wallet','info','profile'];
 if(q.get('mode')==='login'){betaLogout();return;}
 authEnter();
 const p=allowed.includes(q.get('page'))?q.get('page'):'library';
 const t=data.trips.some(t=>t.id===q.get('trip'))?q.get('trip'):undefined;
 const push=history.pushState;history.pushState=history.replaceState.bind(history);
 try{go(p,t);}finally{history.pushState=push;}
 const id=q.get('id'),exists=data.items.some(x=>x.id===id);
 if(q.get('action')==='new-item')openModal('item');
 else if(q.get('action')==='edit-item'&&exists)openModal('item',id);
 else if(q.get('action')==='toggle-item'&&exists)toggle(id);
 else if(q.get('action')==='delete-item'&&exists)remove('item',id);
 else if(q.get('action')==='feedback')openFeedback();
})();
</script>`;
fs.writeFileSync(path.join(output,'legacy.html'),html.replace('</body>',bridge+'</body>'));
console.log('Prepared original reference + explicit legacy compatibility entry');
