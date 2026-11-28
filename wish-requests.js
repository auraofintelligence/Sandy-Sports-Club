// Asset wish list: wishes go to the committee (signed-in members and officers). Visitors are invited to join.
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const labels={new:'Sent',reviewing:'Being reviewed',planned:'Planned',declined:'Not this time',done:'Done'};
let session=null;
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Could not send ('+r.status+').');return p;
}
const signedIn=()=>session?.authenticated&&session.identity?.role!=='webmaster_demo'&&!session.readOnly;
async function paint(){
 const form=document.querySelector('[data-wish-request]');if(!form)return false;
 const status=document.querySelector('[data-wish-status]'),mine=document.querySelector('[data-my-wishes]');
 if(!signedIn()){form.hidden=true;status.innerHTML='<a href="/member-join.html">Join free</a> or <a href="/club-login.html">sign in</a> to send a wish to the committee.';return true}
 form.hidden=false;
 try{const {requests}=await api('/api/requests');
  mine.innerHTML=requests.length?'<h4>Your wishes</h4>'+requests.map(r=>'<p><strong>'+safe(r.title)+'</strong> · '+safe(labels[r.status]||r.status)+(r.note?' · '+safe(r.note):'')+'</p>').join(''):'';
 }catch{}
 return true;
}
document.addEventListener('submit',async e=>{
 const form=e.target.closest?.('[data-wish-request]');if(!form)return;
 e.preventDefault();e.stopImmediatePropagation();
 const d=new FormData(form),status=document.querySelector('[data-wish-status]');status.textContent='Sending…';
 try{await api('/api/requests','POST',{title:d.get('name'),category:d.get('group'),priority:d.get('priority'),purpose:d.get('detail'),nextStep:d.get('next')});
  form.reset();status.textContent='Sent to the committee. You will see its progress here.';paint();
 }catch(error){status.textContent=error.message}
},true);
(async()=>{
 session=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
 for(let i=0;i<20&&!await paint();i++)await new Promise(r=>setTimeout(r,150));
})();
