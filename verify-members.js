// Committee "Who to verify" list: recognise members by picture and give the blue tick after sighting photo ID in person.
import {pictureSrc,verifiedBadge} from './picture.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let members=[],current=null;
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Service error ('+r.status+').');return p;
}
function render(){
 const q=$('vm-q').value.trim().toLowerCase(),show=$('vm-show').value;
 const list=members.filter(m=>(show==='all'||(show==='verified')===m.verified)&&(!q||(m.name+' '+m.fullName+' '+m.username+' '+m.town).toLowerCase().includes(q)));
 $('vm-list').innerHTML=list.length?list.map(m=>'<article class="member-item with-pic" data-id="'+safe(m.accountId)+'"><img class="member-pic" alt="" loading="lazy" src="'+safe(pictureSrc(m.picture,m.photoUrl))+'">'+
  '<strong>'+safe(m.fullName)+verifiedBadge(m.verified)+'</strong><span>'+safe([m.username,m.town,'joined '+(m.joinedOn||'')].filter(Boolean).join(' · '))+'</span>'+
  (m.verified?'<span>Verified '+safe(m.idCheck.at.slice(0,10))+' by '+safe(m.idCheck.by)+' ('+safe(m.idCheck.type)+')</span>':'<span><button type="button" data-verify>Verify ID</button></span>')+'</article>').join(''):'<p>Nobody matches.</p>';
}
async function load(){
 ({members}=await api('/api/committee/verify-id'));
 const done=members.filter(m=>m.verified).length;
 $('vm-summary').innerHTML=[['Members',members.length],['Verified',done],['Still to verify',members.length-done]].map(([a,b])=>'<div class="club-summary-card"><strong>'+b+'</strong><span>'+a+'</span></div>').join('');
 render();
}
$('vm-q').addEventListener('input',render);$('vm-show').addEventListener('change',render);
$('vm-list').addEventListener('click',e=>{
 if(!e.target.matches('[data-verify]'))return;
 current=members.find(m=>m.accountId===e.target.closest('[data-id]').dataset.id);
 const f=$('vm-form');f.reset();f.hidden=false;$('vm-status').textContent='';$('vm-name').textContent=current.fullName;f.scrollIntoView({block:'start'});
});
$('vm-cancel').addEventListener('click',()=>{$('vm-form').hidden=true});
$('vm-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;$('vm-status').textContent='Saving…';
 try{const r=await api('/api/committee/verify-id','POST',{action:'verify',accountId:current.accountId,idType:f.elements.idType.value,dob:f.elements.dob.value,sighted:f.elements.sighted.checked});
  f.hidden=true;await load();$('vm-state').textContent=current.fullName+' now has a blue tick.'+(r.dobCorrected?' Their date of birth was corrected to match the ID.':'')}
 catch(error){$('vm-status').textContent=error.message}
});
(async()=>{
 try{const s=await api('/api/session');
  if(!s.authenticated||['member','webmaster_demo'].includes(s.identity?.role)||s.readOnly){$('vm-state').textContent='This page is for committee members and the Webmaster. Sign in first.';$('vm-state').className='club-status bad';return}
  await load();$('vm-panel').hidden=false;$('vm-state').textContent='Signed in as '+s.identity.username+'.';
 }catch(error){$('vm-state').textContent='Could not load: '+error.message;$('vm-state').className='club-status bad'}
})();
