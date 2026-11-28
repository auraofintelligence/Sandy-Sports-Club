// Members column of the committee room: Applications and joining, Member notices, Member packs and
// types, Birthday offers and Safeguarding. Each desk shows live numbers first and does its job in
// place; the full lists stay in Members & onboarding and Who to verify so there is one source of truth.
import {isReadOnlyView} from './club-view-client.js';
import {ACCESS_GROUPS} from './studio/sandy-access.js';
const AUD={all:'All members',film:'Film Club members',unverified:'Members without a blue tick'};
const day=d=>d?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(String(d).slice(0,10)+'T12:00:00+10:00')):'';
const today=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const ageOn=(dob,on)=>{if(!dob)return null;const [y,m,d]=dob.split('-').map(Number),[Y,M,D]=on.split('-').map(Number);return Y-y-((M<m||(M===m&&D<d))?1:0)};
const DESK={
 applications:['Applications and joining','Joining is instant and free for adults. Watch who has joined, chase interest sign-ups and blue ticks.'],
 'member-notice':['Member notices','Post a notice or event to members’ profiles, or just to those who picked a sport, a town or a way to help. See how many have read it.'],
 'member-packs':['Member packs','What a new member gets when they join, and what still needs setting up.'],
 'member-types':['Membership types','The kinds of membership in use now, and how many members hold each.'],
 birthday:['Birthday offers','Members get 10% off the store in their birthday month, automatically. See whose birthday is coming up.'],
 safety:['Safeguarding','Children registered by guardians, permissions, and ID checks for the blue tick. Restricted to the Webmaster, President and Secretary.']
};
export const MEMBER_DESKS=Object.keys(DESK);

export function setupMembersDesks({api,esc:e,status,showDesk,getIdentity}){
 const root=document.getElementById('committee-members-desk');
 if(!root)return {open(){},close(){}};
 let key='',epoch=0,busy=false,data={};
 const ro=()=>isReadOnlyView();
 const say=(msg,bad=false)=>{const n=root.querySelector('[data-md-message]');if(n){n.textContent=msg;n.classList.toggle('bad',bad)}if(bad)status?.(msg,true)};
 const stat=(n,label,tone='')=>'<div class="md-stat '+tone+'"><strong>'+e(n)+'</strong><span>'+e(label)+'</span></div>';
 const optional=p=>api(p).catch(()=>null);
 const name=m=>m.preferredName||m.name||m.username;

 // ---------- Applications and joining ----------
 function applications(){
  const {members=[],interest=[]}=data,week=new Date(Date.now()+36e6-7*864e5).toISOString().slice(0,10);
  const joinedEmails=new Set(members.map(m=>(m.email||'').toLowerCase()));
  const waiting=interest.filter(i=>!joinedEmails.has((i.email||'').toLowerCase()));
  const unverified=members.filter(m=>!m.idCheck);
  return '<div class="md-stats">'+stat(members.length,'members')+stat(members.filter(m=>(m.joinedOn||'')>=week).length,'joined this week','good')+stat(waiting.length,'interest sign-ups not joined yet',waiting.length?'warn':'')+stat(unverified.length,'without a blue tick',unverified.length?'warn':'')+'</div>'+
   '<div class="ops-actions"><a class="md-btn" href="/webmaster-members.html">Members &amp; onboarding</a><a class="md-btn ghost" href="/verify-members.html">Who to verify</a><button type="button" class="md-btn ghost" data-md-copy="/member-join.html">Copy the join link</button></div>'+
   '<h4>Newest members</h4>'+(members.length?'<ul class="md-list">'+members.slice(0,8).map(m=>'<li><strong>'+e(name(m))+'</strong><span>'+e([m.town,day(m.joinedOn)].filter(Boolean).join(' · '))+'</span>'+(m.idCheck?'<span class="ops-pill ops-green">Blue tick</span>':'<span class="ops-pill ops-muted">No tick yet</span>')+'</li>').join('')+'</ul>':'<p class="ops-empty">Nobody has joined yet.</p>')+
   '<h4>Interested but not joined</h4>'+(waiting.length?'<ul class="md-list">'+waiting.slice(0,8).map(i=>'<li><strong>'+e(i.firstName||'Someone')+'</strong><span>'+e([i.town,day(i.createdAt)].filter(Boolean).join(' · '))+'</span></li>').join('')+'</ul><p class="mt-help">Send them the join link from Members &amp; onboarding.</p>':'<p class="ops-empty">Everyone who registered interest has joined.</p>');
 }
 // ---------- Member notices ----------
 function notices(){
  const list=data.announcements||[];
  return '<details class="ops-compose"'+(list.length?'':' open')+'><summary>Post a notice to members</summary><form data-md-notice><fieldset'+(ro()?' disabled':'')+'>'+
   '<div class="ops-form-grid"><label>Title<input name="title" required maxlength="140" placeholder="e.g. Holiday come-and-try day"></label><label>Who is it for?<select name="audience">'+Object.entries(AUD).map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label></div>'+
   '<label>Message<textarea name="body" rows="4" maxlength="4000"></textarea></label>'+
   '<details class="md-target"><summary>Only send to some members (optional)</summary><p class="mt-help">Pick any. A member gets it if they match every group you tick in.</p><div data-md-target-options>Loading…</div></details>'+
   '<p class="mt-help">Is it an event? Add a date and it goes on the members’ calendar.</p>'+
   '<div class="ops-form-grid"><label>Event date (optional)<input type="date" name="eventDate"></label><label>Time (optional)<input name="eventTime" maxlength="40" placeholder="e.g. 4pm to 6pm"></label><label>Location (optional)<input name="location" maxlength="140" placeholder="e.g. Cylinder Beach"></label></div>'+
   '<label class="ops-check"><input type="checkbox" name="rsvp"> Ask members to RSVP (needs an event date)</label>'+
   '<label class="ops-check"><input type="checkbox" name="publicCalendar"> Also show on the public What’s on calendar (no names shown, all-member notices only)</label>'+
   '<label class="ops-check"><input type="checkbox" name="pinned"> Pin to the top of members’ notices</label>'+
   '<label class="ops-check"><input type="checkbox" name="urgent"> Urgent: a change or cancellation to something already announced</label>'+
   '<div class="md-reach" data-md-reach aria-live="polite"></div>'+
   '<details class="md-guide"><summary>How often should we post?</summary><ul><li>About two notices a week to all members is plenty. Use the sport, town or helping filters for the rest.</li><li>Members choose how often they get an email: as they arrive (at most hourly, never 9pm to 7am), daily, weekly (the default), monthly or never. Lots of notices in one week still arrive as one email.</li><li>Tick Urgent only for changes and cancellations. Those reach people straight away.</li><li>No ads or sponsor offers here. Commercial news goes in the monthly newsletter only.</li></ul></details>'+
   '<button type="submit">Publish to members</button></fieldset></form></details>'+
   '<h4>Live notices</h4>'+(list.length?'<ul class="md-notices">'+list.map(a=>'<li data-md-id="'+e(a.id)+'"><div><strong>'+(a.pinned?'<span class="notice-tag pinned">Pinned</span> ':'')+(a.urgent?'<span class="notice-tag urgent">Change</span> ':'')+e(a.title)+'</strong><span>'+e([AUD[a.audience],a.targetLabel,a.eventDate&&day(a.eventDate)+(a.eventTime?' '+a.eventTime:''),a.location,a.publicCalendar&&'On the public calendar'].filter(Boolean).join(' · '))+'</span>'+
    '<span class="md-rsvp">Reached '+(a.reach||0)+' · read by '+(a.reads||0)+'</span>'+
    (a.rsvp&&a.counts?'<span class="md-rsvp">'+a.counts.going+' going'+(a.counts.children?' (+'+a.counts.children+' kids)':'')+' · '+a.counts.maybe+' maybe · '+a.counts.notGoing+' can’t</span>':'')+'</div>'+
    '<div class="md-row-actions">'+(a.rsvp?'<button type="button" data-md-who>Who’s coming</button>':'')+'<button type="button" data-md-pin'+(ro()?' disabled':'')+'>'+(a.pinned?'Unpin':'Pin')+'</button><button type="button" data-md-down'+(ro()?' disabled':'')+'>Take down</button></div><div data-md-who-panel hidden></div></li>').join('')+'</ul>':'<p class="ops-empty">No live notices.</p>');
 }
 // ---------- Member packs ----------
 function packs(){
  const {members=[]}=data,n=members.length,has=f=>members.filter(f).length;
  const row=(label,done,total,hint)=>'<li><div><strong>'+e(label)+'</strong><span>'+e(hint)+'</span></div><span class="ops-pill '+(done===total?'ops-green':'ops-amber')+'">'+done+' of '+total+'</span></li>';
  return '<p class="mt-help">Every new member is walked through these when they join. The numbers show how many have finished each step.</p>'+
   '<ul class="md-checklist">'+row('Account and welcome',n,n,'Created instantly when they join.')+row('Picture chosen',has(m=>m.profile?.picture),n,'Required before the members area opens.')+
   row('Profile filled in',has(m=>(m.profile?.sports||[]).length||m.profile?.bio),n,'Sports, availability and a short bio.')+row('In the members directory',has(m=>m.profile?.directoryVisible),n,'Their choice. Off by default.')+
   row('Blue tick (ID sighted)',has(m=>m.idCheck),n,'Done in person by the committee.')+'</ul>'+
   '<h4>What they get</h4><ul class="md-plain"><li>Their own profile and avatar, and the members directory</li><li>The calendar, with RSVPs and an .ics download</li><li>Member prices in the store, plus 10% off in their birthday month</li><li>Film Club, if they tick it on their profile</li><li>Child profiles for their kids, through the guardian gateway</li></ul>'+
   '<div class="ops-actions"><a class="md-btn" href="/member-home.html?demo=1">Preview the members area</a><a class="md-btn ghost" href="/webmaster-members.html">Members &amp; onboarding</a></div>';
 }
 // ---------- Membership types ----------
 function types(){
  const {members=[],children=[]}=data,counts={};for(const m of members){const k=m.membershipClass||'founding';counts[k]=(counts[k]||0)+1}
  return '<div class="md-stats">'+Object.entries(counts).map(([k,n])=>stat(n,k.replace(/^\w/,c=>c.toUpperCase())+' members')).join('')+stat(children.length,'children on family profiles')+stat(members.filter(m=>m.profile?.filmMember).length,'Film Club members')+'</div>'+
   '<table class="club-table md-types"><thead><tr><th>Type</th><th>Who</th><th>Cost now</th></tr></thead><tbody>'+
   '<tr><td>Founding member</td><td>Adults 18+ who join before the club is incorporated</td><td>Free</td></tr>'+
   '<tr><td>Child (family profile)</td><td>Under 18s added by a parent or guardian</td><td>Free</td></tr>'+
   '<tr><td>Film Club</td><td>Any member who ticks Film Club on their profile</td><td>Free</td></tr></tbody></table>'+
   '<p class="mt-help">Paid membership types and fees are for the first committee to set once the club is incorporated and has a bank account.</p>';
 }
 // ---------- Birthday offers ----------
 function birthdays(){
  const {members=[]}=data,t=today(),m0=t.slice(5,7),m1=String(Number(m0)%12+1).padStart(2,'0');
  const pick=mm=>members.filter(m=>(m.profile?.dob||'').slice(5,7)===mm).sort((a,b)=>a.profile.dob.slice(8).localeCompare(b.profile.dob.slice(8)));
  const list=(rows,yr)=>rows.length?'<ul class="md-list">'+rows.map(m=>{const d=m.profile.dob,on=yr+'-'+d.slice(5);return '<li><strong>'+e(name(m))+'</strong><span>'+e(day(on))+' · turning '+e(ageOn(d,on))+'</span></li>'}).join('')+'</ul>':'<p class="ops-empty">None.</p>';
  const nextYear=m1==='01'?String(Number(t.slice(0,4))+1):t.slice(0,4);
  return '<div class="md-stats">'+stat(pick(m0).length,'birthdays this month','good')+stat(pick(m1).length,'next month')+stat('10%','off the store, automatically')+'</div>'+
   '<p class="mt-help">The store takes 10% off for a member in their birthday month, at checkout. If they also use a discount code, they get whichever is better, never both.</p>'+
   '<h4>This month</h4>'+list(pick(m0),t.slice(0,4))+'<h4>Next month</h4>'+list(pick(m1),nextYear)+
   '<div class="ops-actions"><a class="md-btn" href="/store-admin.html">Store discount codes</a><button type="button" class="md-btn ghost" data-md-goto="member-notice">Post a birthday shout-out</button></div>';
 }
 // ---------- Safeguarding ----------
 function safety(){
  const {children=null,members=[]}=data;
  if(!children)return '<p class="ops-boundary">Only the Webmaster, President and Secretary can see children’s details.</p>';
  const unverified=members.filter(m=>!m.idCheck).length,noPhotos=children.filter(c=>!c.photoPermission).length;
  return '<div class="md-stats">'+stat(children.length,'children registered')+stat(new Set(children.map(c=>c.guardian?.username)).size,'guardians')+stat(noPhotos,'no photo permission',noPhotos?'warn':'')+stat(unverified,'adults without a blue tick',unverified?'warn':'')+'</div>'+
   '<ul class="md-plain"><li>Children can only be added by a signed-in parent or guardian, from My family.</li><li>Never post a photo of a child whose guardian has not given photo permission.</li><li>Check Queensland Blue Card requirements for coaches and volunteers working with children.</li><li>Blue ticks are given only after ID is sighted in person. Only the ID type is recorded, never the number.</li></ul>'+
   (children.length?'<div class="table-scroll"><table class="club-table"><thead><tr><th>Child</th><th>Age</th><th>Photos OK</th><th>Guardian</th><th>Guardian contact</th></tr></thead><tbody>'+
    children.map(c=>'<tr><td>'+e(c.preferredName||c.fullName)+'</td><td>'+e(c.age??'')+'</td><td>'+(c.photoPermission?'Yes':'<strong>No</strong>')+'</td><td>'+e(c.guardian?.name||c.guardian?.username||'')+'</td><td>'+e([c.guardian?.mobile,c.guardian?.email].filter(Boolean).join(' · '))+'</td></tr>').join('')+'</tbody></table></div>':'<p class="ops-empty">No children registered yet.</p>')+
   '<div class="ops-actions"><a class="md-btn" href="/verify-members.html">Who to verify</a><a class="md-btn ghost" href="/webmaster-members.html">Members &amp; onboarding</a></div>';
 }
 const VIEWS={applications,'member-notice':notices,'member-packs':packs,'member-types':types,birthday:birthdays,safety};
 async function load(){
  const my=++epoch;root.hidden=false;root.textContent='Loading…';
  if(!ACCESS_GROUPS.memberRecords.includes(getIdentity?.()?.role)){root.innerHTML='<header class="ops-header"><div><h3 id="md-desk-title" tabindex="-1">'+e(DESK[key][0])+'</h3></div></header><p class="ops-boundary">Member details are kept to the Webmaster, President or Vice President, Secretary or Assistant Secretary, and Treasurer, as set out in the club’s Schedule of officer access.</p>';return}
  try{
   const need={applications:['members','interest'],'member-notice':['announcements'],'member-packs':['members'],'member-types':['members','children'],birthday:['members'],safety:['members','children']}[key];
   const src={members:()=>api('/api/committee/member-profiles').then(r=>r.members),interest:()=>optional('/api/interest').then(r=>r?.interests||[]),announcements:()=>api('/api/committee/announcements').then(r=>r.announcements),children:()=>optional('/api/committee/families').then(r=>r?r.children:null)};
   const vals=await Promise.all(need.map(k=>src[k]()));if(my!==epoch)return;
   data={};need.forEach((k,i)=>data[k]=vals[i]);render();
  }catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load this desk: '+e(err.message)+'</p>';status?.(err.message,true)}}
 }
 function render(){
  const [title,help]=DESK[key];
  root.innerHTML='<header class="ops-header"><div><h3 id="md-desk-title" tabindex="-1">'+e(title)+'</h3><p>'+e(help)+'</p></div><button type="button" data-md-refresh>Check now</button></header>'+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+'<p data-md-message role="status"></p><div class="md-body">'+VIEWS[key]()+'</div>';
  if(key==='member-notice')preview();
 }
 // ---------- Reach preview: who a notice will reach and how they hear about it ----------
 const FREQ={instant:'as they arrive',daily:'daily',weekly:'weekly',monthly:'monthly',never:'in-app only'};
 const targetOf=f=>{const t={};f.querySelectorAll('[data-md-t]:checked').forEach(i=>(t[i.dataset.mdT]||=[]).push(i.value));return t};
 let previewTimer=0,options=null;
 async function preview(){
  const f=root.querySelector('[data-md-notice]'),box=root.querySelector('[data-md-reach]');if(!f||!box)return;
  try{
   const p=await api('/api/committee/announcements',{method:'POST',data:{action:'preview',audience:f.elements.audience.value,target:targetOf(f)}});
   if(!options&&p.options){options=p.options;const o=p.options,grp=(k,label,vals)=>'<fieldset class="md-tgroup"><legend>'+label+'</legend>'+vals.map(([v,l])=>'<label class="ops-check"><input type="checkbox" data-md-t="'+k+'" value="'+e(v)+'"> '+e(l)+'</label>').join('')+'</fieldset>';
    root.querySelector('[data-md-target-options]').innerHTML=grp('sports','Sport',o.sports.map(s=>[s,s]))+grp('towns','Town',o.towns.map(s=>[s,s]))+grp('connection','Connection to the island',Object.entries(o.connection))+grp('helping','Helping out',o.helping.map(s=>[s,s]));}
   const targeted=Object.keys(targetOf(f)).length||f.elements.audience.value!=='all',over=!targeted&&p.memberWideThisWeek>=p.weeklyGuide;
   const by=Object.entries(p.byFrequency).filter(([,n])=>n).map(([k,n])=>n+' '+FREQ[k]).join(', ');
   box.className='md-reach'+(over&&!f.elements.urgent.checked?' warn':'');
   box.innerHTML='<strong>Reaches '+p.reach+' member'+(p.reach===1?'':'s')+'</strong>'+(by?'<span>Email: '+e(by)+(p.emailEnabled?'':' (club emails aren’t switched on yet, so this shows in-app only)')+'</span>':'')+
    '<span>'+p.memberWideThisWeek+' all-member notice'+(p.memberWideThisWeek===1?'':'s')+' in the last 7 days (guide: '+p.weeklyGuide+').</span>'+
    (over&&!f.elements.urgent.checked?'<span>That’s already the guide for this week. Could this go to a smaller group, or wait for next week or the newsletter?</span>':'');
  }catch(err){box.textContent=''}
 }
 root.addEventListener('change',ev=>{if(ev.target.closest('[data-md-notice]')){clearTimeout(previewTimer);previewTimer=setTimeout(preview,250)}});
 root.addEventListener('submit',async ev=>{
  ev.preventDefault();const f=ev.target;if(!f.matches('[data-md-notice]')||busy||ro())return;
  const v=Object.fromEntries(new FormData(f));busy=true;f.querySelector('[type=submit]').disabled=true;
  try{
   const res=await api('/api/committee/announcements',{method:'POST',data:{action:'create',title:v.title.trim(),body:v.body.trim(),audience:v.audience,eventDate:v.eventDate||'',eventTime:v.eventTime.trim(),location:v.location.trim(),rsvp:f.elements.rsvp.checked,publicCalendar:f.elements.publicCalendar.checked,pinned:f.elements.pinned.checked,urgent:f.elements.urgent.checked,target:targetOf(f)}});
   busy=false;await load();say('Published. It reached '+(res.reach??0)+' member'+(res.reach===1?'':'s')+'.'+(v.eventDate?' It is on their calendar.':''));
  }catch(err){busy=false;f.querySelector('[type=submit]').disabled=false;say(err.message,true)}
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-md-refresh')){await load();say('Up to date.');return}
  if(b.dataset.mdGoto){await showDesk(b.dataset.mdGoto);return}
  if(b.dataset.mdCopy){const url=location.origin+b.dataset.mdCopy;try{await navigator.clipboard.writeText(url);say('Join link copied: '+url)}catch{say('Join link: '+url)}return}
  const li=b.closest('[data-md-id]');if(!li)return;const id=li.dataset.mdId;
  if(b.hasAttribute('data-md-pin')){b.disabled=true;const pin=b.textContent==='Pin';try{await api('/api/committee/announcements',{method:'POST',data:{action:pin?'pin':'unpin',id}});await load();say(pin?'Pinned to the top.':'Unpinned.')}catch(err){b.disabled=false;say(err.message,true)}return}
  if(b.hasAttribute('data-md-down')){if(!confirm('Take this notice down for everyone? Anyone who said they were coming to an upcoming event is told it is cancelled.'))return;b.disabled=true;try{const r=await api('/api/committee/announcements',{method:'POST',data:{action:'archive',id}});await load();say('Notice taken down.'+(r.told?' '+r.told+' who said they were coming will be told.':''))}catch(err){b.disabled=false;say(err.message,true)}return}
  if(b.hasAttribute('data-md-who')){
   const panel=li.querySelector('[data-md-who-panel]');if(!panel.hidden){panel.hidden=true;return}
   panel.hidden=false;panel.textContent='Loading…';
   try{const {rsvps=[]}=await api('/api/committee/announcements?rsvps='+encodeURIComponent(id));const lab={going:'Going',maybe:'Maybe',not_going:'Can’t make it'};
    panel.innerHTML=rsvps.length?'<ul class="md-plain">'+rsvps.map(r=>'<li><strong>'+e(r.name||r.username)+'</strong>: '+e(lab[r.response]||r.response)+(r.children?' (+'+r.children+' kids)':'')+'</li>').join('')+'</ul>':'<p>No replies yet.</p>'}
   catch(err){panel.textContent=err.message}
  }
 });
 return {async open(k){key=k;await load();root.querySelector('#md-desk-title')?.focus({preventScroll:true})},close(){epoch++;key='';root.hidden=true}};
}
