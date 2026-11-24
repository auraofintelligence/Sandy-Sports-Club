import {setupCommitteeRoom} from './club-committee.js';
import {SUITE_BY_KEY} from './studio/sandy-suite-spec.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;', '>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const allTabs=['overview','people','interests','committee','records','social','constitution','accounts','requests','briefs','audit'];
let committeeRoom=null;
let identity=null,current='overview',sort='name',direction='asc',page=0,people=[],records=[],personById=new Map(),recordById=new Map();
const date=s=>s?String(s).slice(0,10):'—';
function status(msg,bad=false){$('club-status').textContent=msg;$('club-status').className='club-status'+(bad?' bad':'')}
async function api(path,{method='GET',data}={}){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
  ...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
 let json={};try{json=await response.json()}catch{}
 if(!response.ok)throw Error(json.error||'Shared service unavailable ('+response.status+')');
 return json;
}
const formData=form=>Object.fromEntries(new FormData(form));
const maySeePeople=()=>identity&&['webmaster','president','secretary','assistant_secretary','treasurer'].includes(identity.role);

function filterQuickDesks(role){
 document.querySelectorAll('.clubhouse-quick-grid a').forEach(link=>{
  const route=(link.getAttribute('href')||'').replace(/^#/,'');
  if(route.startsWith('committee/')){
   const desk=SUITE_BY_KEY[route.slice('committee/'.length)];
   link.hidden=Boolean(desk&&!desk.roles.includes(role));
  }else if(route==='accounts')link.hidden=role!=='webmaster';
  else if(route==='requests')link.hidden=['member','webmaster_demo'].includes(role);
  else if(route==='constitution')link.hidden=['member','webmaster_demo'].includes(role);
 });
}

function previewMode(){
 const chosen=$('club-view-role').value;
 const memberPreview=$('member-preview-link');
 if(memberPreview)memberPreview.hidden=!['member','webmaster_demo'].includes(chosen);
 const access={
  webmaster:allTabs,
  president:['overview','people','interests','committee','records','social','constitution' ,'requests','briefs','audit'],
  vice_president:['overview','committee','records','social','constitution' ,'requests','briefs'],
  secretary:['overview','people','interests','committee','records','social','constitution' ,'requests','briefs','audit'],
  assistant_secretary:['overview','people','interests','committee','records','social','constitution' ,'requests','briefs'],
  treasurer:['overview','people','interests','committee','records','social','constitution' ,'requests','briefs'],
  committee:['overview','committee','records','social','constitution' ,'requests','briefs'],
  member:['overview'],
  webmaster_demo:['overview']
 };
 const visible=access[chosen]||access.webmaster;
 for(const tab of allTabs){
  const button=document.querySelector('[data-tab="'+tab+'"]');
  if(button)button.hidden=!visible.includes(tab);
 }
 document.body.dataset.previewRole=chosen;
 filterQuickDesks(chosen);
 if(!visible.includes(current))openTab('overview');
 if(chosen!=='webmaster')status('Previewing the '+chosen.replace(/_/g,' ')+' layout as the real Webmaster. This is not impersonation. Return to Webmaster for actual administration.');
 else status('Real Webmaster view restored. You remain signed in with your own account.');
}
function openTab(tab){
 if(!allTabs.includes(tab))return;
 const button=document.querySelector('[data-tab="'+tab+'"]');
 if(button?.hidden){openTab('overview');return}
 current=tab;
 const route=tab==='committee'?(location.hash.startsWith('#committee/')?location.hash.slice(1):'committee/'+(committeeRoom?.currentDesk||'notices')):tab;
 history.replaceState(null,'',location.pathname+location.search+'#'+route);
 const sectionLabel=$('clubhouse-current');
 if(sectionLabel)sectionLabel.textContent=button?.textContent?.trim()||'Overview';
 for(const t of allTabs){$('club-'+t).hidden=t!==tab;const b=document.querySelector('[data-tab="'+t+'"]');if(b)b.setAttribute('aria-current',t===tab?'page':'false')}
 const load={overview:overview,people:loadPeople,interests:loadInterests,committee:()=>committeeRoom?.open(),records:loadRecords,social:()=>loadEmbeddedTool('social'),constitution:()=>loadEmbeddedTool('constitution'),accounts:loadAccounts,requests:()=>window.SandyHelp?.load(),briefs:loadBriefs,audit:loadAudit}[tab];
 load?.().catch(e=>status(e.message,true));
 window.dispatchEvent(new CustomEvent('sandy:clubhouse-section-change',{detail:{tab}}));
}
async function overview(){
 const requests=[api('/api/records'),...(maySeePeople()?[api('/api/people?limit=1'),api('/api/interest')]:[])];
 const results=await Promise.allSettled(requests);
 const records=results[0].status==='fulfilled'?results[0].value.records.length:null;
 const people=results[1]?.status==='fulfilled'?results[1].value.total:null;
 const interest=results[2]?.status==='fulfilled'?results[2].value.interests.length:null;
 $('club-summary').innerHTML=[
  ['Shared committee items',records],['Prospective people',people],['Recent expressions of interest',interest],['Operational club', 'Not established']
 ].map(([title,count])=>'<div class="club-summary-card"><strong>'+esc(count===null?'Restricted':count)+'</strong><span>'+esc(title)+'</span></div>').join('');
}
async function loadPeople(){
 if(!maySeePeople()){status('This role cannot view private member records.',true);return}
 const params=new URLSearchParams({page,limit:100,sort,direction});
 for(const [id,key] of [['people-search','q'],['people-town','town'],['people-class','class'],['people-status','status'],['people-gender','gender'],['people-region','region']]){
  const value=$(id).value.trim();if(value)params.set(key,value);
 }
 const data=await api('/api/people?'+params);
 people=data.people;personById=new Map(people.map(p=>[p.id,p]));
 $('people-rows').innerHTML=people.map(p=>
  '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.membershipClass)+'</td><td>'+esc(p.status)+'</td><td>'+esc(date(p.joinedOn))+'</td>'+
  '<td>'+esc(date(p.renewalOn))+'</td><td>'+esc(p.gender||'—')+'</td><td>'+esc(p.town||'—')+'</td>'+
  '<td>'+esc(p.audienceRegion||'—')+'</td><td><button type="button" data-person="'+p.id+'">Edit</button></td></tr>'
 ).join('')||'<tr><td colspan="9">No records match these filters. No memberships have been fabricated.</td></tr>';
 const total=data.total||0;
 $('people-paging').innerHTML='Showing '+(page*100+Math.min(1,people.length))+'–'+(page*100+people.length)+' of '+total+
  ' <button type="button" id="people-prev" '+(page<=0?'disabled':'')+'>Previous</button>'+
  ' <button type="button" id="people-next" '+((page+1)*100>=total?'disabled':'')+'>Next</button>';
 $('people-prev')?.addEventListener('click',()=>{page=Math.max(0,page-1);loadPeople().catch(e=>status(e.message,true))});
 $('people-next')?.addEventListener('click',()=>{page++;loadPeople().catch(e=>status(e.message,true))});
}
function editPerson(p){
 const form=$('people-form');form.reset();
 form.elements.id.value=p?.id||'';form.elements.version.value=p?.version||'';
 for(const key of ['name','preferredName','email','mobile','membershipClass','status','joinedOn','renewalOn','gender','town','audienceRegion','source','notes']){
  if(form.elements[key]&&p&&p[key]!=null)form.elements[key].value=p[key];
 }
 form.elements.contactConsent.checked=Boolean(p?.contactConsent);
 form.elements.publicationConsent.checked=Boolean(p?.publicationConsent);
 $('person-editor').hidden=false;$('person-editor').open=true;
 $('person-editor').scrollIntoView({behavior:'smooth',block:'start'});
}
async function loadInterests(){
 if(!maySeePeople()){status('Member-contact information is restricted.',true);return}
 const data=await api('/api/interest');
 $('interest-rows').innerHTML=data.interests.map(x=>
  '<tr><td>'+esc(date(x.createdAt))+'</td><td>'+esc(x.firstName)+'</td><td>'+esc(x.town)+'</td><td>'+esc(x.audienceRegion)+'</td>'+
  '<td>'+esc((x.interests||[]).join(', '))+'</td><td>'+esc(x.reviewedAt?'Reviewed':'To review')+'</td></tr>').join('')||
  '<tr><td colspan="6">No consented expressions of interest recorded yet.</td></tr>';
}
async function loadRecords(){
 const choice=$('record-kind').value;const data=await api('/api/records'+(choice?'?kind='+encodeURIComponent(choice):''));
 records=data.records;recordById=new Map(records.map(r=>[r.id,r]));
 $('records-list').innerHTML=records.map(r=>
  '<article class="club-record-card"><div><strong>'+esc(r.title)+'</strong><p>'+esc(r.kind+' · '+r.status+' · '+date(r.eventDate))+'</p></div>'+
  '<button type="button" data-record="'+r.id+'">Open</button></article>').join('')||
  '<p>No shared proposals have been recorded for this category.</p>';
}
function editRecord(r){
 const form=$('record-form');form.reset();
 form.elements.id.value=r?.id||'';form.elements.version.value=r?.version||'';
 form.elements.kind.value=r?.kind||$('record-kind').value||'event';
 form.elements.kind.disabled=Boolean(r);
 form.elements.title.value=r?.title||'';
 form.elements.eventDate.value=r?.eventDate||'';
 form.elements.status.value=r?.status||'proposal';
 form.elements.body.value=JSON.stringify(r?.body||{},null,2);
 $('record-editor').hidden=false;$('record-editor').open=true;
 $('record-editor').scrollIntoView({behavior:'smooth',block:'start'});
}
function loadEmbeddedTool(tool){
 const frame=document.querySelector('iframe[data-tool="'+tool+'"]');
 if(frame&&!frame.hasAttribute('src'))frame.setAttribute('src',frame.dataset.src);
}
async function loadAccounts(){
 if(identity?.role!=='webmaster'){status('Only the real webmaster can manage reserved accounts.',true);return}
 const result=await api('/api/accounts');
 const officeRoles=['president','vice_president','secretary','assistant_secretary','treasurer','committee'];
 $('account-rows').innerHTML=result.accounts.map(a=>{
  let invitation='—';
  if(a.state==='reserved'&&officeRoles.includes(a.role)){
   const pending=Boolean(a.inviteExpiresAt);
   invitation='<button type="button" data-office-invite="'+esc(a.id)+'" data-username="'+esc(a.username)+'" data-pending="'+pending+'">'+(pending?'Replace setup link':'Prepare invite')+'</button>'+
    (pending?'<small class="club-invite-pending">Pending until '+esc(new Date(a.inviteExpiresAt).toLocaleString('en-AU'))+'</small>':'');
  }
  return '<tr><td>'+esc(a.username)+'</td><td>'+esc(a.office)+'</td><td>'+esc(a.role)+'</td><td>'+esc(a.state)+'</td><td>'+esc(a.activatedAt||'Not activated')+'</td><td>'+invitation+'</td></tr>';
 }).join('')||'<tr><td colspan="6">No accounts reserved.</td></tr>';
}
function hidePrivateInvite(){
 $('club-invitation-link').value='';
 $('club-invite-email').removeAttribute('href');
 $('club-invitation-result').hidden=true;
 $('club-invitation-message').textContent='';
}
async function loadBriefs(){
 const result=await api('/api/studio/briefs');
 $('brief-rows').innerHTML=result.briefs.map(b=>
  '<article class="club-record-card"><div><strong>'+esc(b.title)+'</strong><p>'+esc((b.date||'Unscheduled')+' · '+b.producer+' · '+b.status+' · revision '+b.version)+'</p></div>'+
  '<span>'+esc(b.updatedAt?.slice(0,16)||'')+'</span></article>').join('')||
  '<p>No shared production briefs yet. Use Social Studio to prepare one for committee review.</p>';
}
async function loadAudit(){
 if(!['webmaster','president','secretary'].includes(identity.role)){status('Audit access is restricted.',true);return}
 const data=await api('/api/audit');
 $('audit-rows').innerHTML=data.audit.map(r=>
  '<article class="club-audit-item"><strong>'+esc(r.action)+'</strong> · '+esc(r.actor||r.role)+' · '+esc(r.at)+
  '<p>'+esc(r.kind+' / '+r.resourceId)+'</p></article>').join('')||'<p>No server-stamped changes yet.</p>';
}
function bind(){
 committeeRoom=setupCommitteeRoom({api,esc,status,openTab,getIdentity:()=>identity});
 window.addEventListener('hashchange',()=>{
  if(!identity)return;
  const hash=location.hash.slice(1);
  const tab=hash.startsWith('committee/')?'committee':hash;
  if(allTabs.includes(tab))openTab(tab);
 });
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
  openTab(b.dataset.tab);
  const menu=$('clubhouse-menu');if(menu)menu.open=false;
 }));
 $('club-logout').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST',data:{}})}finally{location.href='/club-login.html'}});
 $('club-view-role').addEventListener('change',previewMode);
 // The tool frame belongs to the same site. Only accept size messages from that exact frame.
 window.addEventListener('message',ev=>{
  if(ev.origin!==location.origin||ev.data?.type!=='sandy-club-frame-height')return;
  const frame=document.querySelector('iframe[data-tool="'+ev.data.tool+'"]');
  if(!frame||ev.source!==frame.contentWindow)return;
  const h=Number(ev.data.height);
  if(Number.isFinite(h)&&h>300)frame.style.height=Math.min(24000,Math.ceil(h)+30)+'px';
 });
 $('account-rows').addEventListener('click',async ev=>{
  const b=ev.target.closest('button[data-office-invite]');
  if(!b||identity?.role!=='webmaster')return;
  if(b.dataset.pending==='true'&&!confirm('Replace the existing private setup link? The earlier invitation will stop working.'))return;
  b.disabled=true;
  hidePrivateInvite();
  try{
   const result=await api('/api/accounts/'+b.dataset.officeInvite+'/invite',{method:'POST',data:{manual:true}});
   const link=location.origin+'/club-login.html#invite='+result.token;
   $('club-invitation-link').value=link;
   $('club-invite-email').href='mailto:?subject='+encodeURIComponent('Sandy Sports Club private officer account setup')+
    '&body='+encodeURIComponent('A prospective Sandy Sports office account has been reserved for '+result.username+
     '. If you agree to activate it, use this one-time private link to set your own password (expires in 48 hours):\n\n'+link+
     '\n\nSandy Sports is a proposed club. This invitation does not confer an elected office or active membership.');
   $('club-invitation-result').hidden=false;
   $('club-invitation-message').textContent='Prepared for '+result.username+'. This private link has NOT been sent.';
   status('Private officer invitation prepared. Choose Copy setup link or Prepare email. Nothing has been sent automatically.');
   await loadAccounts();
   $('club-invitation-result').scrollIntoView({block:'nearest'});
  }catch(e){status(e.message,true)}
  finally{b.disabled=false}
 });
 $('club-invite-copy').addEventListener('click',async()=>{
  const input=$('club-invitation-link'),value=input.value;if(!value)return;
  try{await navigator.clipboard.writeText(value);$('club-invitation-message').textContent='Link copied. Send it only to the intended prospective officer.'}
  catch{input.focus();input.select();$('club-invitation-message').textContent='Select the highlighted link and press Ctrl+C to copy.'}
 });
 $('club-invite-clear').addEventListener('click',hidePrivateInvite);
 $('people-search-btn').addEventListener('click',()=>{page=0;loadPeople().catch(e=>status(e.message,true))});
 $('people-new').addEventListener('click',()=>editPerson(null));
 $('people-table').addEventListener('click',ev=>{
  const b=ev.target.closest('button');
  if(!b)return;
  if(b.dataset.sort){const key=b.dataset.sort;direction=sort===key&&direction==='asc'?'desc':'asc';sort=key;page=0;loadPeople().catch(e=>status(e.message,true))}
  else if(b.dataset.person)editPerson(personById.get(b.dataset.person));
 });
 $('person-cancel').addEventListener('click',()=>{$('person-editor').open=false;$('person-editor').hidden=true});
 $('people-form').addEventListener('submit',async ev=>{
  ev.preventDefault();const form=ev.target,raw=formData(form),personId=raw.id;
  const data={...raw,contactConsent:form.elements.contactConsent.checked,publicationConsent:form.elements.publicationConsent.checked};
  delete data.id;delete data.version;
  try{
   if(personId)await api('/api/people/'+personId,{method:'PATCH',data:{...data,version:Number(raw.version)}});
   else await api('/api/people',{method:'POST',data});
   $('person-editor').open=false;$('person-editor').hidden=true;
   status('Shared person record saved. Server revision and actor recorded.');await loadPeople();
  }catch(e){status(e.message,true)}
 });
 const types=[...$('record-kind').options].filter(x=>x.value).map(x=>({value:x.value,text:x.textContent}));
 $('record-edit-kind').innerHTML=types.map(x=>'<option value="'+esc(x.value)+'">'+esc(x.text)+'</option>').join('');
 $('record-kind').addEventListener('change',()=>loadRecords().catch(e=>status(e.message,true)));
 $('record-refresh').addEventListener('click',()=>loadRecords().catch(e=>status(e.message,true)));
 $('record-new').addEventListener('click',()=>editRecord(null));
 $('records-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-record]');if(b)editRecord(recordById.get(b.dataset.record))});
 $('record-cancel').addEventListener('click',()=>{$('record-editor').open=false;$('record-editor').hidden=true});
 $('record-form').addEventListener('submit',async ev=>{
  ev.preventDefault();const form=ev.target,raw=formData(form);
  let details;try{details=JSON.parse(raw.body||'{}')}catch{status('Working details must be valid JSON.',true);return}
  const data={kind:raw.kind,title:raw.title,status:raw.status,eventDate:raw.eventDate,body:details};
  try{
   if(raw.id)await api('/api/records/'+raw.id,{method:'PATCH',data:{...data,version:Number(raw.version)}});
   else await api('/api/records',{method:'POST',data});
   $('record-editor').open=false;$('record-editor').hidden=true;
   status('Shared committee record saved with server revision history.');await loadRecords();
  }catch(e){status(e.message,true)}
 });
 $('account-form').addEventListener('submit',async ev=>{
  ev.preventDefault();const data=formData(ev.target);
  try{
   await api('/api/accounts',{method:'POST',data});
   ev.target.reset();status('Account reserved only. No invitation was issued or sent.');await loadAccounts();
  }catch(e){status(e.message,true)}
 });
}
(async()=>{
 bind();
 try{
  const session=await api('/api/session');
  if(!session.storageReady||!session.authReady){status('The shared Worker and Sandy D1 database are not yet activated. No club records will be stored in this browser.',true);return}
  if(!session.authenticated){status('Sign in to the shared Sandy club system.');$('club-user').innerHTML='<a href="/club-login.html">Sign in</a>';return}
  identity=session.identity;$('club-user').textContent=identity.name+' · '+identity.role;
  filterQuickDesks(identity.role);
  if(identity.role==='webmaster_demo'){
   const preview=await api('/api/demo');
   status('View-only synthetic webmaster demo. No live member or committee data is exposed.');
   $('club-summary').innerHTML=preview.records.map(r=>'<div class="club-panel">'+esc(r.name)+' · '+esc(r.town)+'</div>').join('');
   $('club-console').hidden=false;
   for(const t of allTabs){const b=document.querySelector('[data-tab="'+t+'"]');if(b)b.hidden=t!=='overview'}
   current='overview';for(const t of allTabs){$('club-'+t).hidden=t!=='overview';const tab=document.querySelector('[data-tab="'+t+'"]');if(tab)tab.setAttribute('aria-current',t==='overview'?'page':'false')}return;
  }
  if(!['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'].includes(identity.role)){
   status('This member account does not have committee access. Membership views will be added after the club establishes its policies.');return;
  }
  $('club-console').hidden=false;
  if(identity.role==='webmaster')$('club-view-role-wrap').hidden=false;
  if(!maySeePeople())for(const tab of ['people','interests'])document.querySelector('[data-tab="'+tab+'"]').hidden=true;
  if(identity.role!=='webmaster')document.querySelector('[data-tab="accounts"]').hidden=true;
  if(!['webmaster','president','secretary'].includes(identity.role))document.querySelector('[data-tab="audit"]').hidden=true;
  status('Connected to Sandy shared club records. Proposals are not legal club approvals.');
  const hash=location.hash.slice(1);
  const initial=hash.startsWith('committee/')?'committee':allTabs.includes(hash)?hash:'overview';
  openTab(initial);
 }catch(e){status('Shared club access is not yet configured: '+e.message,true)}
})();
