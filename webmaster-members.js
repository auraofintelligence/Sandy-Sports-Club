// Webmaster members and onboarding overview. Every endpoint here is Webmaster-only on the server.
import {pictureSrc} from './picture.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const data={members:[],children:[],interest:[]};
async function api(path,method='GET',body){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Service error ('+response.status+').');
 return payload;
}
const pic=src=>({__html:'<img class="member-pic" alt="" loading="lazy" src="'+safe(src)+'">'});
const table=(el,head,rows)=>{$(el).innerHTML='<thead><tr>'+head.map(h=>'<th scope="col">'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(c=>'<td>'+(c&&c.__html?c.__html:safe(c))+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+head.length+'">None yet.</td></tr>')+'</tbody>'};
const yes=v=>v?'Yes':'';
const rows={
 members:()=>data.members.map(m=>[pic(pictureSrc(m.profile.picture,m.photoUrl)),m.name,m.preferredName,m.username,m.email,m.mobile,m.town,m.joinedOn,m.membershipClass,m.profile.sports.join('; '),yes(m.profile.filmMember),m.profile.crewSkills.join('; '),m.profile.helping.join('; '),yes(m.profile.directoryVisible),m.gender,m.profile.ageGroup]),
 children:()=>data.children.map(c=>[pic(pictureSrc(c.picture,c.photoUrl)),c.fullName,c.preferredName,c.ageBand==='under16'?'Under 16':'16 to 17',c.gender,c.interests.join('; '),yes(c.photoPermission),c.guardian?.name,c.guardian?.username,c.guardian?.email,c.guardian?.mobile,c.joinedOn]),
 interest:()=>data.interest.map(i=>[i.firstName,i.email,i.town,i.audienceRegion,(i.interests||[]).join('; '),i.comments,(i.createdAt||'').slice(0,10)])};
const heads={members:['Picture','Name','Called','Username','Email','Mobile','Town','Joined','Class','Sports','Film Club','Crew skills','Can help with','In directory','Gender','Age group'],
 children:['Picture','Child','Called','Age group','Gender','Wants to try','Photos OK','Guardian','Guardian username','Guardian email','Guardian mobile','Added'],
 interest:['First name','Email','Town','Connection','Interests','Comments','Date']};
function csv(kind){
 const cell=v=>{if(v&&v.__html)return '';let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const text=[heads[kind],...rows[kind]()].map(r=>r.map(cell).join(',')).join('\r\n');
 const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([text],{type:'text/csv'})),download:'sandy-'+kind+'-'+new Date().toISOString().slice(0,10)+'.csv'});
 a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function loadAnnouncements(){
 const {announcements}=await api('/api/committee/announcements');
 $('wm-announcements').innerHTML=announcements.length?announcements.map(a=>'<article class="member-item" data-id="'+safe(a.id)+'"><strong>'+safe(a.title)+(a.audience==='film'?' · Film Club':'')+'</strong>'+
  '<span>'+safe([a.eventDate,a.eventTime,a.location].filter(Boolean).join(' · ')||'Notice')+'</span>'+
  (a.rsvp?'<span>Going '+a.counts.going+' (+'+a.counts.children+' kids) · Maybe '+a.counts.maybe+' · Not going '+a.counts.notGoing+' <button type="button" data-rsvps>Who is coming</button></span>':'')+
  '<span><button type="button" data-archive>Take down</button></span></article>').join(''):'<p>No live announcements.</p>';
 return announcements;
}
let announcements=[];
async function load(){
 const [m,c,i]=await Promise.all([api('/api/committee/member-profiles'),api('/api/committee/families'),api('/api/interest')]);
 data.members=m.members;data.children=c.children;data.interest=i.interests;announcements=await loadAnnouncements();
 const count=f=>data.members.filter(f).length;
 $('wm-summary').innerHTML=[['Founding members',data.members.length],['Children',data.children.length],['Film Club',count(x=>x.profile.filmMember)],
  ['In directory',count(x=>x.profile.directoryVisible)],['Can volunteer',count(x=>x.profile.helping.length)],['Interest sign-ups',data.interest.length]]
  .map(([a,b])=>'<div class="club-summary-card"><strong>'+safe(b)+'</strong><span>'+safe(a)+'</span></div>').join('');
 for(const k of ['members','children','interest'])table('wm-'+k,heads[k],rows[k]());
}
document.addEventListener('click',async e=>{
 const kind=e.target.dataset?.csv;if(kind)return csv(kind);
 const item=e.target.closest?.('[data-id]');if(!item)return;
 try{
  if(e.target.matches('[data-archive]')){if(!confirm('Take this announcement down for everyone?'))return;await api('/api/committee/announcements','POST',{action:'archive',id:item.dataset.id});announcements=await loadAnnouncements();$('wm-rsvps').innerHTML=''}
  if(e.target.matches('[data-rsvps]')){const {rsvps}=await api('/api/committee/announcements?rsvps='+encodeURIComponent(item.dataset.id));
   $('wm-rsvps').innerHTML='<h3>RSVPs: '+safe(announcements.find(a=>a.id===item.dataset.id)?.title)+'</h3><table class="club-table"><thead><tr><th>Name</th><th>Reply</th><th>Kids</th><th>Email</th><th>Mobile</th></tr></thead><tbody>'+
    (rsvps.map(r=>'<tr><td>'+safe(r.fullName||r.username)+'</td><td>'+safe(r.response.replace('_',' '))+'</td><td>'+safe(r.children)+'</td><td>'+safe(r.email)+'</td><td>'+safe(r.mobile)+'</td></tr>').join('')||'<tr><td colspan="5">No replies yet.</td></tr>')+'</tbody></table>'}
 }catch(error){$('wm-announce-status').textContent=error.message}
});
$('wm-announce').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target,d=new FormData(f);$('wm-announce-status').textContent='Publishing…';
 try{await api('/api/committee/announcements','POST',{action:'create',title:d.get('title'),body:d.get('body'),audience:d.get('audience'),eventDate:d.get('eventDate')||'',eventTime:d.get('eventTime'),location:d.get('location'),rsvp:f.elements.rsvp.checked});
  f.reset();announcements=await loadAnnouncements();$('wm-announce-status').textContent='Published. Members see it in Notices.'}catch(error){$('wm-announce-status').textContent=error.message}
});
(async()=>{
 try{
  const s=await api('/api/session');
  if(!s.authenticated||s.identity?.role!=='webmaster'||s.readOnly){$('wm-state').textContent='This page is for the Webmaster account. Sign in first.';$('wm-state').className='club-status bad';return}
  await load();$('wm-panel').hidden=false;$('wm-state').textContent='Signed in as '+s.identity.username+'.';
 }catch(error){$('wm-state').textContent='Could not load: '+error.message;$('wm-state').className='club-status bad'}
})();
