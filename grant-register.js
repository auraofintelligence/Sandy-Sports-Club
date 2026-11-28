// Researched grants: committee accounts add a programme to the shared Grant register in one tap.
let session=null,registered=new Set();
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Could not save ('+r.status+').');return p;
}
const staff=()=>session?.authenticated&&!['member','webmaster_demo'].includes(session.identity?.role)&&!session.readOnly;
function paint(){
 const buttons=[...document.querySelectorAll('[data-register-grant]')];if(!buttons.length)return false;
 for(const b of buttons){
  const state=document.querySelector('[data-grant-state="'+b.dataset.registerGrant+'"]');
  if(!staff()){b.hidden=true;continue}
  const done=registered.has(b.dataset.name);b.hidden=done;if(state)state.textContent=done?'In the Grant register':'';
 }
 return true;
}
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('[data-register-grant]');if(!b)return;
 const state=document.querySelector('[data-grant-state="'+b.dataset.registerGrant+'"]');b.disabled=true;state.textContent='Adding…';
 try{
  await api('/api/suite/grants','POST',{title:b.dataset.name,status:'draft',fields:{funder:b.dataset.name,scheme:b.dataset.name,officialUrl:b.dataset.url,eligibility:'Not assessed',
   case:'Package: '+b.dataset.fit+'\nApplicant gate: '+b.dataset.gate+'\nAmount: '+b.dataset.amount+'\nRound: '+b.dataset.round}});
  registered.add(b.dataset.name);paint();
 }catch(error){state.textContent=error.message;b.disabled=false}
});
(async()=>{
 session=await api('/api/session').catch(()=>null);
 if(staff())try{registered=new Set(((await api('/api/suite/grants')).records||[]).map(r=>r.title))}catch{}
 for(let i=0;i<20&&!paint();i++)await new Promise(r=>setTimeout(r,150));
})();
