// Member Calendar tab: everything on for this member, with replies and .ics export.
import {renderCalendar} from './calendar-ui.js';
const root=document.getElementById('member-club-calendar');
async function load(){
 if(!root)return;
 const r=await fetch('/api/member/calendar',{credentials:'same-origin',cache:'no-store'});
 if(!r.ok){root.textContent=r.status===401?'Sign in to see your calendar.':'Your calendar is not available right now.';return}
 const data=await r.json(),events=(data.events||[]).filter(e=>!e.released);
 renderCalendar(root,{events,feed:data.feed,member:true,empty:'Nothing on yet. New club events will show here.',onReply:async(e,response)=>{
  const res=await fetch('/api/member/announcements',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:e.announcementId,response,children:e.myChildren||0})});
  if(!res.ok){const j=await res.json().catch(()=>({}));alert(j.error||'Could not save your reply.');return}
  await load();
 }});
}
load().catch(()=>{if(root)root.textContent='Your calendar is not available right now.'});
