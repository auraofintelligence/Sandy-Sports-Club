// Announcements and events from the Webmaster, with RSVPs, inside My Membership > Notices.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const label={going:'Going',maybe:'Maybe',not_going:'Not going'};
async function api(method='GET',body){
 const response=await fetch('/api/member/announcements',{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Service error ('+response.status+').');
 return payload;
}
async function load(){
 const box=$('member-announcements');
 try{
  const {announcements}=await api();
  box.innerHTML='<h3>Club announcements</h3>'+(announcements.length?announcements.map(a=>'<article class="member-item" data-id="'+safe(a.id)+'"><strong>'+safe(a.title)+(a.audience==='film'?' · Film Club':'')+'</strong>'+
   (a.eventDate||a.location?'<span>'+safe([a.eventDate,a.eventTime,a.location].filter(Boolean).join(' · '))+'</span>':'')+(a.body?'<span>'+safe(a.body)+'</span>':'')+
   (a.rsvp?'<span>'+['going','maybe','not_going'].map(r=>'<button type="button" data-reply="'+r+'" aria-pressed="'+(a.myResponse===r)+'">'+label[r]+'</button>').join(' ')+
    ' <label>Kids coming <input type="number" min="0" max="8" value="'+safe(a.myChildren)+'" data-kids style="width:4em"></label>'+(a.myResponse?' <em>You said: '+safe(label[a.myResponse])+'</em>':'')+'</span>':'')+
   '</article>').join(''):'<p>No announcements right now.</p>');
 }catch(error){box.innerHTML='<p>'+safe(error.message)+'</p>'}
}
document.addEventListener('click',async e=>{
 const reply=e.target.dataset?.reply;if(!reply)return;
 const item=e.target.closest('[data-id]'),kids=Number(item.querySelector('[data-kids]')?.value||0);
 try{await api('POST',{id:item.dataset.id,response:reply,children:Math.max(0,Math.min(8,kids|0))});load()}catch(error){alert(error.message)}
});
fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(s?.authenticated&&s.identity?.role==='member'&&!s.readOnly)load()}).catch(()=>{});
