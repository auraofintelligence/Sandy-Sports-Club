// Notices and events from the committee, with RSVPs, inside My Membership > Notices.
// New notices are flagged until the member has seen them; a count shows on the Notices tab.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const label={going:'Going',maybe:'Maybe',not_going:'Can’t make it'};
let unreadIds=[],marking=false;
async function api(method='GET',body,query=''){
 const response=await fetch('/api/member/announcements'+query,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Service error ('+response.status+').');
 return payload;
}
function setTabBadge(n){
 const tab=document.querySelector('[data-member-tab="notices"]');if(!tab)return;
 let b=tab.querySelector('.nav-badge');
 if(!n){b?.remove();return}
 if(!b){b=document.createElement('span');b.className='nav-badge urgent';tab.append(b)}
 b.textContent=n>9?'9+':String(n);b.setAttribute('aria-label',n+' new');
}
const noticesOpen=()=>!document.querySelector('[data-member-section="notices"]')?.hidden;
async function markRead(){
 if(marking||!unreadIds.length||!noticesOpen())return;marking=true;
 try{await api('POST',{action:'read',ids:unreadIds});unreadIds=[];setTabBadge(0);document.querySelectorAll('.hdr-badge').forEach(b=>b.remove())}catch{}finally{marking=false}
}
async function load(){
 const box=$('member-announcements');
 try{
  const {announcements}=await api();
  unreadIds=announcements.filter(a=>!a.read).map(a=>a.id);setTabBadge(unreadIds.length);
  box.innerHTML='<h3>Club notices</h3>'+(announcements.length?announcements.map(a=>'<article class="member-item'+(a.read?'':' is-new')+'" data-id="'+safe(a.id)+'"><strong>'+(a.pinned?'<span class="notice-tag pinned">Pinned</span> ':'')+(a.read?'':'<span class="notice-tag new">New</span> ')+(a.urgent?'<span class="notice-tag urgent">Change</span> ':'')+safe(a.title)+(a.audience==='film'?' · Film Club':'')+'</strong>'+
   (a.eventDate||a.location?'<span>'+safe([a.eventDate,a.eventTime,a.location].filter(Boolean).join(' · '))+'</span>':'')+(a.body?'<span>'+safe(a.body)+'</span>':'')+
   (a.rsvp?'<span>'+['going','maybe','not_going'].map(r=>'<button type="button" data-reply="'+r+'" aria-pressed="'+(a.myResponse===r)+'">'+label[r]+'</button>').join(' ')+
    ' <label>Kids coming <input type="number" min="0" max="8" value="'+safe(a.myChildren)+'" data-kids style="width:4em"></label>'+(a.myResponse?' <em>You said: '+safe(label[a.myResponse])+'</em>':'')+'</span>':'')+
   '</article>').join(''):'<p>No notices right now.</p>');
  markRead();
 }catch(error){box.innerHTML='<p>'+safe(error.message)+'</p>'}
}
document.addEventListener('click',async e=>{
 if(e.target.closest?.('[data-member-tab="notices"]'))setTimeout(markRead,1500);
 const reply=e.target.dataset?.reply;if(!reply)return;
 const item=e.target.closest('[data-id]'),kids=Number(item.querySelector('[data-kids]')?.value||0);
 try{await api('POST',{id:item.dataset.id,response:reply,children:Math.max(0,Math.min(8,kids|0))});load()}catch(error){alert(error.message)}
});
fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(s?.authenticated&&s.identity?.role==='member'&&!s.readOnly)load()}).catch(()=>{});
