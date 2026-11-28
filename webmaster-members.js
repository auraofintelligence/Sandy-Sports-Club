// Members and onboarding overview for the Webmaster and membership officers. The server enforces each section's roles:
// members and announcements for officers, children for safeguarding officers (Webmaster, President, Secretary).
import {pictureSrc,verifiedBadge} from './picture.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const data={members:[],children:[],interest:[]};
async function api(path,method='GET',body){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Service error ('+response.status+').');
 return payload;
}
const idCell=m=>({__html:m.idCheck?'Verified '+safe(m.idCheck.at.slice(0,10))+' by '+safe(m.idCheck.by)+' ('+safe(m.idCheck.type)+') <button type="button" data-unverify="'+safe(m.accountId)+'">Remove tick</button>':'<button type="button" data-verify="'+safe(m.accountId)+'">Verify ID</button>',text:m.idCheck?'Verified '+m.idCheck.at.slice(0,10)+' '+m.idCheck.type:''});
const pic=src=>({__html:'<img class="member-pic" alt="" loading="lazy" src="'+safe(src)+'">'});
const table=(el,head,rows)=>{$(el).innerHTML='<thead><tr>'+head.map(h=>'<th scope="col">'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(c=>'<td>'+(c&&c.__html?c.__html:safe(c))+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+head.length+'">None yet.</td></tr>')+'</tbody>'};
const yes=v=>v?'Yes':'';
const joined=i=>data.members.some(m=>(m.email||'').toLowerCase()===(i.email||'').toLowerCase());
const shownMembers=()=>{const f=$('wm-filter')?.value||'all';return data.members.filter(m=>f==='all'||(f==='verified')===!!m.idCheck)};
const today=()=>new Date(Date.now()+10*3600000).toISOString().slice(0,10);
const age=dob=>{if(!dob)return '';const [y,m,d]=dob.split('-').map(Number),[ty,tm,td]=today().split('-').map(Number);return ty-y-((tm<m||(tm===m&&td<d))?1:0)};
const rows={
 members:()=>shownMembers().map(m=>[pic(pictureSrc(m.profile.picture,m.photoUrl)),{__html:safe(m.name)+verifiedBadge(!!m.idCheck),text:m.name},idCell(m),m.preferredName,m.username,m.email,m.mobile,m.town,m.joinedOn,m.membershipClass,m.profile.sports.join('; '),yes(m.profile.filmMember),m.profile.crewSkills.join('; '),m.profile.helping.join('; '),yes(m.profile.directoryVisible),m.gender,m.profile.dob,age(m.profile.dob)]),
 children:()=>data.children.map(c=>[pic(pictureSrc(c.picture,c.photoUrl)),c.fullName,c.preferredName,c.dob,c.age,c.gender,c.interests.join('; '),yes(c.photoPermission),c.guardian?.name,c.guardian?.username,c.guardian?.email,c.guardian?.mobile,c.joinedOn]),
 interest:()=>data.interest.map(i=>[joined(i)?'Yes':'Not yet',i.firstName,i.email,i.town,i.audienceRegion,(i.interests||[]).join('; '),i.comments,(i.createdAt||'').slice(0,10)])};
const heads={members:['Picture','Name','ID check','Called','Username','Email','Mobile','Town','Joined','Class','Sports','Film Club','Crew skills','Can help with','In directory','Gender','Date of birth','Age'],
 children:['Picture','Child','Called','Date of birth','Age','Gender','Wants to try','Photos OK','Guardian','Guardian username','Guardian email','Guardian mobile','Added'],
 interest:['Joined?','First name','Email','Town','Connection','Interests','Comments','Date']};
function csv(kind){
 const cell=v=>{if(v&&v.__html)v=v.text||'';let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
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
 const optional=p=>api(p).catch(()=>null);
 const [m,c,i]=await Promise.all([api('/api/committee/member-profiles'),optional('/api/committee/families'),optional('/api/interest')]);
 data.members=m.members;data.children=c?.children||[];data.interest=i?.interests||[];
 $('wm-children').closest('section').hidden=!c;$('wm-interest').closest('section').hidden=!i;announcements=await loadAnnouncements();
 const count=f=>data.members.filter(f).length;
 $('wm-summary').innerHTML=[['Founding members',data.members.length],['Children',data.children.length],['Film Club',count(x=>x.profile.filmMember)],
  ['In directory',count(x=>x.profile.directoryVisible)],['Can volunteer',count(x=>x.profile.helping.length)],['Interest sign-ups',data.interest.length]]
  .map(([a,b])=>'<div class="club-summary-card"><strong>'+safe(b)+'</strong><span>'+safe(a)+'</span></div>').join('');
 for(const k of ['members','children','interest'])table('wm-'+k,heads[k],rows[k]());
 const month=today().slice(5,7),bdays=[...data.members.map(m=>({name:m.name,dob:m.profile.dob,who:'Member'})),...data.children.map(c=>({name:c.fullName,dob:c.dob,who:'Child of '+(c.guardian?.name||c.guardian?.username||'')}))]
  .filter(p=>p.dob&&p.dob.slice(5,7)===month).sort((a,b)=>a.dob.slice(8).localeCompare(b.dob.slice(8)));
 table('wm-birthdays',['Day','Name','Turning','Who'],bdays.map(p=>[p.dob.slice(8),p.name,age(p.dob)+(p.dob.slice(5)>today().slice(5)?1:0),p.who]));
}
$('wm-filter').addEventListener('change',()=>{table('wm-members',heads.members,rows.members());$('wm-remind-note').textContent=''});
$('wm-remind').addEventListener('click',()=>{
 const list=shownMembers().filter(m=>m.contactConsent&&m.email),skipped=shownMembers().length-list.length;
 if(!list.length){$('wm-remind-note').textContent='Nobody shown has agreed to be contacted by email.';return}
 const subject=$('wm-filter').value==='unverified'?'Get your Sandy Sports blue tick':'Sandy Sports';
 const body=$('wm-filter').value==='unverified'?'Hi! Next time you are at a Sandy Sports session, bring your photo ID and show it to a committee member to get your blue tick. It only takes a minute.':'';
 location.href='mailto:?bcc='+encodeURIComponent(list.map(m=>m.email).join(','))+'&subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 $('wm-remind-note').textContent='Opened your email app with '+list.length+' address(es) in BCC.'+(skipped?' '+skipped+' skipped (no email consent).':'');
});
$('wm-invite-join').addEventListener('click',()=>{
 const list=[...new Set(data.interest.filter(i=>i.email&&!joined(i)).map(i=>i.email))];
 if(!list.length){$('wm-invite-note').textContent='Everyone who registered interest has joined.';return}
 location.href='mailto:?bcc='+encodeURIComponent(list.join(','))+'&subject='+encodeURIComponent('Join Sandy Sports free')+'&body='+encodeURIComponent('Thanks for registering interest in Sandy Sports. Founding membership is free and takes a minute: '+location.origin+'/member-join.html');
 $('wm-invite-note').textContent='Opened your email app with '+list.length+' address(es) in BCC.';
});
let verifying=null;
document.addEventListener('click',async e=>{
 const kind=e.target.dataset?.csv;if(kind)return csv(kind);
 if(e.target.dataset?.verify){verifying=data.members.find(m=>m.accountId===e.target.dataset.verify);const f=$('wm-verify');f.hidden=false;f.reset();$('wm-verify-status').textContent='';
  $('wm-verify-name').textContent=verifying.name+' ('+verifying.username+')';f.elements.dob.value=verifying.profile.dob||'';f.scrollIntoView({block:'center'});return}
 if(e.target.id==='wm-verify-cancel'){$('wm-verify').hidden=true;return}
 if(e.target.dataset?.unverify){if(!confirm('Remove this member\'s blue tick?'))return;
  try{await api('/api/committee/verify-id','POST',{action:'revoke',accountId:e.target.dataset.unverify});await load()}catch(error){alert(error.message)}return}
 const item=e.target.closest?.('[data-id]');if(!item)return;
 try{
  if(e.target.matches('[data-archive]')){if(!confirm('Take this announcement down for everyone?'))return;await api('/api/committee/announcements','POST',{action:'archive',id:item.dataset.id});announcements=await loadAnnouncements();$('wm-rsvps').innerHTML=''}
  if(e.target.matches('[data-rsvps]')){const {rsvps}=await api('/api/committee/announcements?rsvps='+encodeURIComponent(item.dataset.id));
   $('wm-rsvps').innerHTML='<h3>RSVPs: '+safe(announcements.find(a=>a.id===item.dataset.id)?.title)+'</h3><div class="table-scroll"><table class="club-table"><thead><tr><th>Name</th><th>Reply</th><th>Kids</th><th>Email</th><th>Mobile</th></tr></thead><tbody>'+
    (rsvps.map(r=>'<tr><td>'+safe(r.fullName||r.username)+'</td><td>'+safe(r.response.replace('_',' '))+'</td><td>'+safe(r.children)+'</td><td>'+safe(r.email)+'</td><td>'+safe(r.mobile)+'</td></tr>').join('')||'<tr><td colspan="5">No replies yet.</td></tr>')+'</tbody></table></div>'}
 }catch(error){$('wm-announce-status').textContent=error.message}
});
$('wm-verify').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;$('wm-verify-status').textContent='Saving…';
 try{const r=await api('/api/committee/verify-id','POST',{action:'verify',accountId:verifying.accountId,idType:f.elements.idType.value,dob:f.elements.dob.value,sighted:f.elements.sighted.checked});
  f.hidden=true;await load();if(r.dobCorrected)alert('Blue tick given. Their date of birth was corrected to match the ID.')}catch(error){$('wm-verify-status').textContent=error.message}
});
$('wm-announce').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target,d=new FormData(f);$('wm-announce-status').textContent='Publishing…';
 try{await api('/api/committee/announcements','POST',{action:'create',title:d.get('title'),body:d.get('body'),audience:d.get('audience'),eventDate:d.get('eventDate')||'',eventTime:d.get('eventTime'),location:d.get('location'),rsvp:f.elements.rsvp.checked});
  f.reset();announcements=await loadAnnouncements();$('wm-announce-status').textContent='Published. Members see it in Notices.'}catch(error){$('wm-announce-status').textContent=error.message}
});
(async()=>{
 try{
  const s=await api('/api/session');
  if(!s.authenticated||!['webmaster','president','vice_president','secretary','assistant_secretary','treasurer'].includes(s.identity?.role)||s.readOnly){$('wm-state').textContent='This page is for the Webmaster and membership officers. Sign in first.';$('wm-state').className='club-status bad';return}
  await load();$('wm-panel').hidden=false;$('wm-state').textContent='Signed in as '+s.identity.username+'.';
 }catch(error){$('wm-state').textContent='Could not load: '+error.message;$('wm-state').className='club-status bad'}
})();
