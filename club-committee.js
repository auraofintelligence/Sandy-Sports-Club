// PLFC-inspired Sandy committee room. Real draft data, server roles, revisions and audit; no fake approvals.
const DESKS=[
 {key:'notices',group:'Communications',label:'Committee notices',kind:'notice',description:'Prepare internal notices, questions and replies for the future committee.'},
 {key:'todos',group:'Communications',label:'To-do lists',kind:'task',description:'Record an accountable next step, owner and due date.'},
 {key:'news',group:'Communications',label:'Newsletter desk',kind:'newsletter',description:'Draft newsletter topics and production steps. No member email is sent.'},
 {key:'social',group:'Communications',label:'Social Studio',tab:'social',description:'Open the shared 12-month Social Media Hub and its production briefs.'},
 {key:'handover',group:'Governance',label:'Officer handover',kind:'governance',description:'Prepare handover notes, responsibilities and outstanding actions.'},
 {key:'meetings',group:'Governance',label:'Meetings',kind:'meeting',description:'Schedule draft meetings and record agendas and minutes notes. Formal meeting approval is not enabled.'},
 {key:'agm',group:'Governance',label:'AGM jobs',kind:'governance',description:'Plan AGM notices, roles, deadlines, reports and tasks, pending a lawful founding committee.'},
 {key:'documents',group:'Governance',label:'Documents',kind:'governance',description:'Record document titles, locations and review tasks; no private file-upload archive is connected.'},
 {key:'automations',group:'Governance',label:'Membership automations',kind:'governance',description:'Plan optional future reminders. No automated member messages are enabled.'},
 {key:'ready-setco',group:'Governance',label:'Ready SETCO decisions',kind:'partner',description:'Record proposed co-operative referrals and handovers. This does not create a partnership or an authorised transfer.'},
 {key:'access',group:'Governance',label:'Manage club access',tab:'accounts',webmaster:true,description:'Reserve accounts and manually prepare prospective committee password invitations.'},
 {key:'events',group:'Events and funding',label:'Events and fundraising',kind:'event',description:'Record proposed sport, cultural and fundraising events, staffing and follow-ups.'},
 {key:'fundraising',group:'Events and funding',label:'Fundraising register',kind:'fundraising',description:'Track fundraising proposals and their next steps. No payments or financial approvals occur here.'},
 {key:'equipment',group:'Events and funding',label:'Club assets and loans',kind:'equipment',description:'Document planned equipment, proposed loans and maintenance tasks. No binding loan contract is issued.'},
 {key:'sponsors',group:'Events and funding',label:'Sponsors and supporters',kind:'sponsor',description:'Track prospective sponsor conversations and suggested contributions.'},
 {key:'grants',group:'Events and funding',label:'Grant register',kind:'grant',description:'Track grant leads, proposal dates, assigned officers and evidence links.'},
 {key:'leaderboard',group:'Events and funding',label:'Results, prizes and sponsors',kind:'governance',description:'Plan results, prize arrangements and acknowledgement requirements. No results are fabricated.'},
 {key:'stock',group:'Events and funding',label:'Shop, stock and prices',kind:'asset',description:'Draft stock, equipment and price decisions. No active shop inventory, invoices or transactions are connected.'},
 {key:'safety',group:'Members and safeguards',label:'Member age and permissions',kind:'safeguard',restricted:true,description:'Restricted safeguards planning. Do not enter minors’ identifying details into a general planning note.'},
 {key:'applications',group:'Members and safeguards',label:'Applications',kind:'volunteer',description:'Record application-process tasks. Actual people records belong in People & memberships.',related:[['people','People & memberships']]},
 {key:'returning',group:'Members and safeguards',label:'Invite returning members',kind:'volunteer',description:'Plan possible re-engagement; no live member invitations are issued.',related:[['people','People & memberships']]}
];
const $=id=>document.getElementById(id);
const niceDate=value=>value?String(value).slice(0,10):'Not dated';
export function setupCommitteeRoom({api,esc,status,openTab,getIdentity}){
 const nav=$('committee-tools'),form=$('committee-desk-form'),list=$('committee-desk-list');
 if(!nav||!form||!list)return {open(){},showDesk(){}};
 const byKey=new Map(DESKS.map(d=>[d.key,d]));
 let selected='notices',currentRecords=[];
 const canUse=desk=>{
  const role=getIdentity()?.role;
  if(desk.webmaster&&role!=='webmaster')return false;
  if(desk.restricted&&!['webmaster','president','secretary'].includes(role))return false;
  return true;
 };
 const groups=[...new Set(DESKS.map(d=>d.group))];
 nav.innerHTML=groups.map(group=>'<div class="committee-tools-group"><h3>'+esc(group)+'</h3><div>'+
  DESKS.filter(d=>d.group===group).map(d=>'<button type="button" data-committee-desk="'+d.key+'"'+
   (canUse(d)?'':' disabled title="This working area requires additional office access"')+
   (d.key===selected?' aria-current="page"':'')+'>'+esc(d.label)+'</button>').join('')+'</div></div>').join('');
 const refreshAllowed=()=>nav.querySelectorAll('[data-committee-desk]').forEach(button=>{
  const desk=byKey.get(button.dataset.committeeDesk);
  button.disabled=!canUse(desk);
 });
 function closeEditor(){
  $('committee-desk-editor').hidden=true;
  $('committee-desk-editor').open=false;
  form.reset();form.elements.id.value='';form.elements.version.value='';
  $('committee-desk-save-status').textContent='';
 }
 function writeCurrentUrl(){
  const url=new URL(location.href);url.hash='committee/'+selected;
  history.replaceState(null,'',url.pathname+url.search+url.hash);
 }
 function setDeskIntro(desk){
  $('committee-desk-title').textContent=desk.label;
  $('committee-desk-summary').textContent=desk.description;
  $('committee-desk-explainer').textContent=desk.tab?
   'This opens the existing shared clubhouse work area, without a duplicate local-storage copy.':
   'Save a proposal or working note to Sandy D1. Every change has the signed-in officer, time, version and server audit. Specialised PLFC publishing, approvals and payments are not automatically enabled.';
  const related=$('committee-desk-related');related.replaceChildren();
  for(const [tab,text] of desk.related||[]){
   const button=document.createElement('button');button.type='button';button.textContent=text;
   button.addEventListener('click',()=>openTab(tab));related.append(button);
  }
  if(desk.key==='documents'){
   const link=document.createElement('a');link.href='/constitution.html';link.textContent='Constitution and working documents';
   related.append(link);
  }
  if(desk.key==='ready-setco'){
   const link=document.createElement('a');link.href='https://ready-setco.auraofintelligence.workers.dev/index.html';
   link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open Ready SETCO';related.append(link);
  }
 }
 async function load(){
  const desk=byKey.get(selected);
  if(!desk||!canUse(desk)||desk.tab)return;
  list.textContent='Loading shared '+desk.label.toLowerCase()+' records…';
  try{
   const response=await api('/api/records?kind='+encodeURIComponent(desk.kind));
   currentRecords=(response.records||[]).filter(r=>r.body?.desk===desk.key);
   list.innerHTML=currentRecords.length?currentRecords.map(r=>{
    const body=r.body||{},reference=String(body.reference||'');
    const safeLink=reference.startsWith('https://')?
     '<a target="_blank" rel="noopener noreferrer" href="'+esc(reference)+'">Supporting reference</a>':'';
    return '<article class="committee-desk-item" data-committee-record="'+esc(r.id)+'"><div><strong>'+esc(r.title)+
     '</strong><p>'+esc(r.status)+' · '+esc(niceDate(r.eventDate))+' · revision '+esc(r.version)+
     (body.owner?' · owner: '+esc(body.owner):'')+'</p>'+
     (body.notes?'<p>'+esc(body.notes)+'</p>':'')+
     (body.nextStep?'<p><b>Next:</b> '+esc(body.nextStep)+'</p>':'')+
     safeLink+'</div><div class="committee-desk-item-actions"><button type="button" data-committee-edit="'+esc(r.id)+'">Edit</button>'+
     '<button type="button" data-committee-history="'+esc(r.id)+'">History</button></div><div class="committee-desk-history" hidden></div></article>';
   }).join(''):'<p class="committee-empty">No shared '+esc(desk.label.toLowerCase())+' records yet. Choose New working record to begin.</p>';
  }catch(error){list.textContent='Could not load this desk: '+error.message;status(error.message,true)}
 }
 async function showDesk(key,{updateUrl=true}={}){
  const desk=byKey.get(key);
  if(!desk||!canUse(desk))return;
  if(desk.tab){openTab(desk.tab);return}
  selected=key;closeEditor();refreshAllowed();setDeskIntro(desk);
  for(const button of nav.querySelectorAll('[data-committee-desk]')){
   if(button.dataset.committeeDesk===key)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  }
  if(updateUrl)writeCurrentUrl();
  await load();
 }
 function edit(record){
  const desk=byKey.get(selected);if(!desk||!canUse(desk))return;
  closeEditor();
  form.elements.id.value=record?.id||'';
  form.elements.version.value=record?.version||'';
  form.elements.title.value=record?.title||'';
  form.elements.eventDate.value=record?.eventDate||'';
  form.elements.owner.value=record?.body?.owner||'';
  form.elements.status.value=record?.status||'proposal';
  form.elements.notes.value=record?.body?.notes||'';
  form.elements.nextStep.value=record?.body?.nextStep||'';
  form.elements.reference.value=record?.body?.reference||'';
  $('committee-editor-summary').textContent=record?'Edit working '+desk.label.toLowerCase()+' record':'New '+desk.label.toLowerCase()+' record';
  $('committee-desk-editor').hidden=false;$('committee-desk-editor').open=true;
  $('committee-desk-editor').scrollIntoView({block:'start',behavior:'smooth'});
 }
 nav.addEventListener('click',event=>{
  const button=event.target.closest('[data-committee-desk]');
  if(button&&!button.disabled)void showDesk(button.dataset.committeeDesk);
 });
 $('committee-desk-new').addEventListener('click',()=>edit(null));
 $('committee-desk-cancel').addEventListener('click',closeEditor);
 $('committee-desk-refresh').addEventListener('click',()=>void load());
 list.addEventListener('click',async event=>{
  const editButton=event.target.closest('[data-committee-edit]');
  if(editButton){edit(currentRecords.find(x=>x.id===editButton.dataset.committeeEdit));return}
  const historyButton=event.target.closest('[data-committee-history]');if(!historyButton)return;
  const card=historyButton.closest('.committee-desk-item'),box=card.querySelector('.committee-desk-history');
  if(!box.hidden){box.hidden=true;return}
  box.hidden=false;box.textContent='Loading attributed revision history…';
  try{
   const result=await api('/api/records/'+historyButton.dataset.committeeHistory+'/revisions');
   box.innerHTML='<h4>Changes made by officers</h4>'+(result.revisions||[]).map(r=>
    '<p><strong>Revision '+esc(r.version)+'</strong> · '+esc(r.office||r.role)+' · '+esc(r.at)+' · '+esc(r.operation)+'</p>'
   ).join('')||'<p>No revisions found.</p>';
  }catch(error){box.textContent='Could not load revisions: '+error.message}
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const desk=byKey.get(selected);if(!desk||!canUse(desk))return;
  const data=Object.fromEntries(new FormData(form));
  if(data.reference&&!data.reference.startsWith('https://')){$('committee-desk-save-status').textContent='Use an HTTPS supporting reference.';return}
  const record={kind:desk.kind,title:data.title,status:data.status,eventDate:data.eventDate||null,
   body:{source:'sandy-committee-room-v1',desk:selected,owner:data.owner||'',notes:data.notes||'',nextStep:data.nextStep||'',reference:data.reference||''}};
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{
   const result=data.id?await api('/api/records/'+data.id,{method:'PATCH',data:{...record,version:Number(data.version)}}):
    await api('/api/records',{method:'POST',data:record});
   closeEditor();await load();
   status('Shared '+desk.label.toLowerCase()+' record saved as revision '+result.version+'. Your real account and edit time are in the audit history.');
  }catch(error){$('committee-desk-save-status').textContent=error.message;status(error.message,true)}
  finally{submit.disabled=false}
 });
 return {open(){refreshAllowed();const hash=location.hash.slice(1);const key=hash.startsWith('committee/')?hash.slice('committee/'.length):selected;
  return showDesk(byKey.has(key)?key:selected,{updateUrl:false})},showDesk,get currentDesk(){return selected}};
}
