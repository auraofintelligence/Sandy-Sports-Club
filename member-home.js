import {viewFetch,isReadOnlyView,protectView,installExitControl} from './club-view-client.js';
import {setupPrivateLibrary} from './club-library-ui.js';
// Sandy Sports member clubhouse: real self-service when incorporated, synthetic preview only for the webmaster.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sports=['Mixed beach volleyball','Beach cricket','Flag football','Beach soccer','Beach rugby','AirBadminton','Beach tennis','Beach handball','Fitness and movement','Multi-sport'];
const times=['Weekday morning','Weekday afternoon','Weekday evening','Weekend morning','Weekend afternoon','School holidays','Occasional events'];
let workspace=null,preview=false;
const privateLibrary=setupPrivateLibrary(document.querySelector('#member-library-mount'));
async function api(path,method='GET',data){
 const response=await viewFetch(path,{method,credentials:'same-origin',cache:'no-store',
  ...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Shared service error ('+response.status+').');
 return payload;
}
function banner(text,bad=false){$('member-state').textContent=text;$('member-state').className='club-status'+(bad?' bad':'')}
function options(){
 $('member-sport-options').innerHTML=sports.map(v=>'<label><input name="sport" type="checkbox" value="'+safe(v)+'"> '+safe(v)+'</label>').join('');
 $('member-time-options').innerHTML=times.map(v=>'<label><input name="time" type="checkbox" value="'+safe(v)+'"> '+safe(v)+'</label>').join('');
}
function selectTab(name){
 document.querySelectorAll('[data-member-tab]').forEach(button=>button.setAttribute('aria-current',button.dataset.memberTab===name?'page':'false'));
 document.querySelectorAll('[data-member-section]').forEach(section=>section.hidden=section.dataset.memberSection!==name);
 location.hash=name;
}
function cardList(data,empty){
 return data?.length?data.map(row=>'<article class="member-item"><strong>'+safe(row.title)+'</strong>'+
  '<span>'+safe(row.date||row.updatedAt||'')+'</span></article>').join(''):'<p>'+safe(empty)+'</p>';
}
const replyLabels={going:'Going',maybe:'Maybe',not_going:'Not going'};
// Released events with a private personal reply, change/withdrawal notices and a calendar file.
function renderEvents(){
 const updates=(workspace.eventUpdates||[]).map(u=>'<p class="club-status bad" role="status">'+safe(u.title)+': '+(u.change==='withdrawn'?'withdrawn or cancelled since you replied.':'details changed'+(u.previousDate&&u.previousDate!==u.date?' (was '+safe(u.previousDate)+', now '+safe(u.date)+')':'')+'. Please confirm your reply.')+'</p>').join('');
 const list=workspace.events?.length?workspace.events.map(row=>'<article class="member-item"><strong>'+safe(row.title)+'</strong><span>'+safe(row.date)+'</span>'+
  '<span role="group" aria-label="Your reply to '+safe(row.title)+'">'+Object.entries(replyLabels).map(([value,text])=>'<button type="button" data-rsvp-event="'+safe(row.id)+'" data-rsvp-value="'+value+'" data-rsvp-version="'+safe(row.rsvpVersion||0)+'" aria-pressed="'+(row.myRsvp===value)+'"'+(workspace.active&&!preview?'':' disabled')+'>'+text+'</button>').join(' ')+'</span></article>').join('')+
  (workspace.active&&!preview?'<p><a href="/api/member/calendar.ics" download>Download released events as a calendar file</a>. It does not update automatically; download again after changes.</p>':''):
  '';
 $('member-events').innerHTML=updates+list;
}
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-rsvp-event]');if(!button||!workspace?.active||preview)return;
 button.disabled=true;
 try{
  await api('/api/member/rsvp','POST',{eventId:button.dataset.rsvpEvent,response:button.dataset.rsvpValue,version:Number(button.dataset.rsvpVersion)||0});
  workspace=await api('/api/member/workspace');showReal();banner('Your reply was saved privately. No message was sent.');
 }catch(error){banner(error.message,true);button.disabled=false}
});
function fillProfile(profile){
 $('member-profile').innerHTML=profile?'<p><strong>Name:</strong> '+safe(profile.full_name||profile.name)+'</p>'+
  '<p><strong>Class:</strong> '+safe(profile.membership_class||profile.membershipClass||'Not specified')+'</p>'+
  '<p><strong>Town:</strong> '+safe(profile.town||'Not specified')+'</p>':
  '<p>Your member details are not linked yet. Ask the Webmaster to check your account.</p>';
}
function showDemo(){
 preview=true;
 $('member-panel').hidden=false;
 $('member-summary').innerHTML=[
  ['Account','Synthetic demo only'],['Membership','Not real'],['Proposed activity','Mixed beach volleyball'],['Access','View-only']
 ].map(([a,b])=>'<div class="club-summary-card"><strong>'+safe(b)+'</strong><span>'+safe(a)+'</span></div>').join('');
 fillProfile(workspace.profile);
 $('member-interest-list').textContent='Sample interests: Mixed beach volleyball, beach cricket, film nights.';
 $('member-events').innerHTML='<p>Fictional proposed activities only, not approved or booked.</p>'+cardList(workspace.examplePlans,'No example activities.');
 $('member-notices').textContent=workspace.exampleNotice||'No actual member notices or private messages in this preview.';
 $('member-newsletters').textContent=workspace.exampleNewsletter||'Newsletter archive preview only.';
 $('member-film-interests').textContent='Example interest: community film club and a proposed Dunwich / Goompi screening.';
 for(const section of document.querySelectorAll('.member-workspace-form')){
  for(const control of section.querySelectorAll('input,select,textarea,button'))control.disabled=true;
 }
 $('member-safeguard-state').textContent='Synthetic preview: no age verification, guardian authority or terms acceptance exists.';
 $('member-terms-accept').disabled=true;$('member-terms-withdraw').disabled=true;
 $('member-export').disabled=true;$('member-export').title='Synthetic preview; no personal record exists';
 $('member-wish-status').textContent='View-only demonstration; nothing is submitted.';
 $('member-sport-status').textContent='View-only demonstration; nothing is saved.';
 $('member-privacy-status').textContent='View-only demonstration; no permissions are changed.';
 $('member-logout').hidden=true;
 banner('Previewing one synthetic Sandy member. This is not a sign-in account, membership or real person.');
}
function showReal(){
 const profile=workspace.profile,prefs=workspace.preferences;
 $('member-panel').hidden=false;
 $('member-summary').innerHTML=[
  ['Account',profile?.full_name||'No linked member profile'],
  ['Membership',profile?.status||'Not approved'],
  ['Joined',profile?.joined_on||'Not recorded'],
  ['Renewal',profile?.renewal_on||'Not recorded']
 ].map(([a,b])=>'<div class="club-summary-card"><strong>'+safe(b)+'</strong><span>'+safe(a)+'</span></div>').join('');
 fillProfile(profile);
 renderEvents();
 $('member-notices').innerHTML=cardList(workspace.notices,'No authorised member notices have been released.');
 $('member-newsletters').innerHTML=cardList(workspace.newsletters,'No formally released newsletters in the archive.');
 $('member-interest-list').innerHTML=workspace.wishes?.length?workspace.wishes.map(r=>'<p>'+safe(r.fields?.area)+': '+safe(r.fields?.request)+'</p>').join(''):
  '<p>You have not submitted any private interest requests.</p>';
 const fields=prefs?.fields||{};
 for(const checkbox of $('member-sport-preferences').querySelectorAll('input[name=sport]'))
  checkbox.checked=(fields.sports||[]).includes(checkbox.value);
 for(const checkbox of $('member-sport-preferences').querySelectorAll('input[name=time]'))
  checkbox.checked=(fields.availability||[]).includes(checkbox.value);
 for(const key of ['filmClub','volunteer','communityEvents','publicationConsent']){
  const input=$('member-privacy-form').elements.namedItem(key);if(input)input.checked=fields[key]===true;
 }
 $('member-privacy-form').elements.contactPreference.value=fields.contactPreference||'no_contact';
 $('member-privacy-form').elements.notes.value=fields.notes||'';
 $('member-film-interests').textContent=fields.filmClub?
  'You have indicated interest in film-club opportunities. Actual screenings and permissions are decided separately.':
  'No film-club preference saved yet.';
 const flags=workspace.safeguards||{};
 $('member-safeguard-state').textContent='Age group: '+(flags.ageBand||'unconfirmed')+' | Guardian permission: '+(flags.guardianPermission?'verified':'not recorded')+' | Optional consent: '+(flags.accepted?'accepted':'not accepted')+' | Terms: '+(flags.termsVersion||'unavailable');
 $('member-terms-text').textContent=flags.terms||'Participation terms unavailable. No new consent can be recorded.';
 $('member-terms-accept').disabled=!workspace.enrolled||flags.ageBand!=='adult'||flags.accepted||!flags.termsVersion;
 $('member-terms-withdraw').disabled=!flags.accepted;
 for(const section of document.querySelectorAll('.member-workspace-form'))for(const control of section.querySelectorAll('input,select,textarea,button'))control.disabled=!workspace.active;
 for(const key of ['volunteer','publicationConsent','contactPreference'])$('member-privacy-form').elements.namedItem(key).disabled=!workspace.active||!flags.optionalParticipation;
 const volunteer=$('member-wish-form').elements.area.querySelector('[value=volunteer]');if(volunteer)volunteer.disabled=!flags.optionalParticipation;
 if(!workspace.active){
  for(const section of document.querySelectorAll('.member-workspace-form')){
   for(const control of section.querySelectorAll('input,select,textarea,button'))control.disabled=true;
  }
  banner(workspace.notice,true);
  $('member-wish-status').textContent='Member self-service is inactive until Sandy Sports is established.';
 }else banner('Your own shared account is connected. Your changes are saved only when you choose Save.');
}
function preferenceBody(){
 const form=$('member-privacy-form');
 return {version:workspace.preferences?.version||0,
  sports:[...$('member-sport-preferences').querySelectorAll('input[name=sport]:checked')].map(x=>x.value),
  availability:[...$('member-sport-preferences').querySelectorAll('input[name=time]:checked')].map(x=>x.value),
  filmClub:form.elements.filmClub.checked,volunteer:form.elements.volunteer.checked,
  communityEvents:form.elements.communityEvents.checked,contactPreference:form.elements.contactPreference.value,
  publicationConsent:form.elements.publicationConsent.checked,notes:form.elements.notes.value
 };
}
async function savePreferences(out){
 if(!workspace?.active||preview)return;
 try{
  const result=await api('/api/member/preferences','POST',preferenceBody());
  workspace=await api('/api/member/workspace');showReal();
  out.textContent='Your own preferences were securely saved as revision '+result.version+'.';
  banner('Member preferences saved to Sandy D1.');
 }catch(error){out.textContent='Not saved: '+error.message;banner(error.message,true)}
}
document.querySelectorAll('[data-member-tab]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.memberTab)));
$('member-sport-preferences').addEventListener('submit',event=>{event.preventDefault();void savePreferences($('member-sport-status'))});
$('member-privacy-form').addEventListener('submit',event=>{event.preventDefault();void savePreferences($('member-privacy-status'))});
$('member-wish-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!workspace?.active||preview)return;
 const body=Object.fromEntries(new FormData(event.target));
 try{
  await api('/api/member/interest','POST',body);
  event.target.reset();
  $('member-wish-status').textContent='Your private interest was saved. No external contact or booking was made.';
  const fresh=await api('/api/member/workspace');workspace=fresh;showReal();
 }catch(error){$('member-wish-status').textContent='Not saved: '+error.message}
});
for(const [id,action] of [['member-terms-accept','accept'],['member-terms-withdraw','withdraw']])$(id).addEventListener('click',async()=>{
 if(preview||!workspace?.safeguards)return;
 try{await api('/api/member/safeguards','POST',{action,version:workspace.safeguards.version,termsVersion:workspace.safeguards.termsVersion});workspace=await api('/api/member/workspace');showReal();await privateLibrary.open('owner')}
 catch(e){$('member-safeguard-state').textContent=e.message}
});
$('member-export').addEventListener('click',async()=>{
 if(preview)return;
 try{
  const data=await api('/api/member/data-export');
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='sandy-my-member-record.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){banner('Could not export your account data: '+error.message,true)}
});
$('member-logout').addEventListener('click',async()=>{
 try{await api('/api/auth/logout','POST',{})}finally{location.href='/club-login.html'}
});
installExitControl('member-exit-view');
(async()=>{
 options();
 try{
  const session=await api('/api/session');
  if(!session?.authenticated){banner('Please sign in to open your member area. Not a member yet? Joining is free: /member-join.html',true);return}
  if(session.readOnly&&['member','webmaster'].includes(session.identity.role)){
   workspace=await api('/api/member/preview');showDemo();
   $('member-exit-view').hidden=false;$('member-return-showcase').hidden=session.identity.role!=='webmaster';
   if(session.identity.role==='member')await privateLibrary.open('owner');
   const wanted=location.hash.slice(1);selectTab(['home','profile','directory','sports','calendar','volunteer','film','notices','family','privacy'].includes(wanted)?wanted:'home');return;
  }
  if(new URLSearchParams(location.search).get('demo')==='1'&&session.identity.role==='webmaster'){
   workspace=await api('/api/member/preview');showDemo();selectTab('home');return;
  }
  if(session.identity.role==='webmaster_demo'){
   workspace=await api('/api/member/preview');showDemo();selectTab('home');return;
  }
  if(session.identity.role!=='member'){
   banner('This page is for member accounts. For a view-only example, open My Clubhouse and choose the member preview.',true);
   return;
  }
  workspace=await api('/api/member/workspace');showReal();await privateLibrary.open('owner');
  const wanted=location.hash.slice(1);selectTab(['home','profile','directory','sports','calendar','volunteer','film','notices','family','privacy'].includes(wanted)?wanted:'home');
 }catch(error){$('member-exit-view').hidden=false;banner('Could not load your member area: '+error.message,true)}
})();
