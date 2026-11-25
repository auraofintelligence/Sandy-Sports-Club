import {SUITE_BY_KEY} from './studio/sandy-suite-spec.js';
import {isReadOnlyView,protectView} from './club-view-client.js';
import {setupWorkflowAssist} from './club-workflow-assist.js';
// Working Sandy Sports desks, not fake PLFC parity. All saves use authenticated D1 APIs.
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeFilename=s=>String(s||'record').toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,60);
const statusValues=['proposal','draft','review','scheduled','completed','archived','rejected'];
const statusNames=['Proposal','Draft','For review','Scheduled (not approved)','Completed record','Archived','Not proceeding'];
function download(name,text,type='text/plain;charset=utf-8'){
 const href=URL.createObjectURL(new Blob([text],{type}));
 const anchor=document.createElement('a');anchor.href=href;anchor.download=name;anchor.hidden=true;document.body.append(anchor);
 anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function recordMarkdown(d,r){
 const lines=['# '+r.title,'','Sandy Sports Club proposal','Area: '+d.title,'Stage: '+r.status,'Revision: '+r.version,
  'Updated by account: '+r.updatedBy,'Last update: '+r.updatedAt,''];
 for(const section of d.steps){
  lines.push('## '+section,'');
  for(const f of d.fields.filter(x=>x.step===section)){
   const v=r.fields[f.key];
   lines.push('**'+f.label+'**',v===true?'Yes':v===false?'No':v===null?'Not set':String(v||'Not set'),'');
  }
 }
 lines.push('---','Working record only. Not adopted, published, contracted, charged or formally approved.');
 return lines.join('\n')+'\n';
}
function ics(r){
 const d=r.fields.date||r.fields.eventDate||r.fields.agmDate;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))throw Error('Save a valid event or meeting date first.');
 const day=d.replace(/-/g,''),start=/^\d{2}:\d{2}$/.test(r.fields.startTime||'')?r.fields.startTime:'09:00',
  end=/^\d{2}:\d{2}$/.test(r.fields.endTime||'')?r.fields.endTime:'10:00';
 const cell=s=>String(s||'').replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
 const dt=s=>day+'T'+s.replace(':','')+'00';
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports//Proposed Events//EN','BEGIN:VEVENT',
  'UID:'+r.id+'@sandy-sports-club','DTSTAMP:'+new Date().toISOString().replace(/[-:]|\.\d{3}/g,''),
  'DTSTART;TZID=Australia/Brisbane:'+dt(start),'DTEND;TZID=Australia/Brisbane:'+dt(end),
  'SUMMARY:'+cell('[PROPOSAL] '+r.title),'LOCATION:'+cell(r.fields.location||r.fields.site||r.fields.venue||r.fields.town||''),
  'DESCRIPTION:'+cell('Draft event only. Confirm date, site, permissions and insurance independently.'),
  'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
function control(field,value){
 const id='sandy-suite-'+field.key,existing=value===null||value===undefined?'':String(value);
 let el='';
 if(field.type==='checkbox')el='<input type="checkbox" name="'+esc(field.key)+'" id="'+id+'"'+(value===true?' checked':'')+'>';
 else if(field.type==='select')el='<select name="'+esc(field.key)+'" id="'+id+'"'+(field.required?' required':'')+'><option value="">Choose one…</option>'+
  field.options.map(op=>'<option value="'+esc(op)+'"'+(existing===op?' selected':'')+'>'+esc(op)+'</option>').join('')+'</select>';
 else if(['lines','textarea'].includes(field.type))el='<textarea rows="'+(field.type==='lines'?5:7)+'" maxlength="11000" name="'+esc(field.key)+'" id="'+id+'"'+(field.required?' required':'')+'>'+esc(existing)+'</textarea>';
 else el='<input type="'+(field.type==='text'?'text':field.type)+'" name="'+esc(field.key)+'" id="'+id+'" value="'+esc(existing)+'"'+
  (field.required?' required':'')+(field.type==='number'?' min="0" step="any"':' maxlength="700"')+'>';
 return '<label class="suite-field'+(field.type==='checkbox'?' suite-checkbox':'')+'"><span>'+esc(field.label)+'</span>'+el+'</label>';
}
export function setupSandySuite({api,status,getIdentity}){
 const root=document.getElementById('committee-suite');
 if(!root)return {open(){return Promise.resolve()}};
 let desk=null,rows=[],editing=null,step=0,query='',filter='';
 root.innerHTML=
 '<div class="suite-heading"><div><p class="eyebrow">SANDY SPORTS · SHARED WORKFLOWS</p><h3 id="suite-desk-name"></h3><p id="suite-desk-intro"></p></div><span id="suite-count"></span></div>'+
 '<p class="suite-boundary">Every Save writes an attributed revision to Sandy D1. Formal approvals, bulk invitations, outbound email, SMS, sales and social publishing remain disabled.</p>'+
 '<div class="suite-filters"><label>Search<input id="suite-search" type="search" placeholder="Title or officer"></label><label>Stage<select id="suite-filter"><option value="">All stages</option>'+
 statusValues.map((v,i)=>'<option value="'+v+'">'+statusNames[i]+'</option>').join('')+'</select></label>'+
 '<button id="suite-new" type="button">New working record</button><button id="suite-export" type="button">Export CSV</button><button id="suite-reload" type="button">Refresh</button></div>'+
 '<p id="suite-notice" role="status" hidden></p><div id="suite-records" class="suite-records" aria-live="polite"></div>'+
 '<section id="suite-editor" class="suite-editor" hidden><header><h4 id="suite-editor-label"></h4><button id="suite-close" type="button">Close</button></header>'+
 '<form id="suite-form" novalidate><div class="suite-core"><label>Working title<input name="title" required maxlength="180"></label>'+
 '<label>Working stage<select name="status">'+statusValues.map((v,i)=>'<option value="'+v+'">'+statusNames[i]+'</option>').join('')+'</select></label></div>'+
 '<nav id="suite-steps" class="suite-steps" aria-label="Stages of this working process"></nav>'+
 '<p id="suite-stage-notice">Work through the stages, then explicitly save the shared draft.</p>'+
 '<div id="suite-fields"></div><div class="suite-actions"><button id="suite-previous" type="button">Previous</button>'+
 '<button id="suite-next" type="button">Next stage</button><button id="suite-save" type="submit">Save to Sandy D1</button></div>'+
 '<p id="suite-save-status" role="status"></p></form></section>';
 const find=id=>root.querySelector('#'+id);
 const form=find('suite-form'),editor=find('suite-editor'),list=find('suite-records');
 const helper=setupWorkflowAssist({root,getDesk:()=>desk,getValues:collect,getTitle:()=>form.elements.title.value});
 function say(text,bad=false){const n=find('suite-notice');n.textContent=text;n.hidden=false;n.classList.toggle('bad',bad)}
 function currentSearch(row){
  return [row.title,row.status,row.fields.owner,row.fields.officer,row.fields.editor,row.fields.chair,row.fields.funder,
   row.fields.sandyOwner,row.fields.organisation].filter(Boolean).join(' ').toLowerCase();
 }
 function drawList(){
  find('suite-count').textContent=rows.length+' saved records';
  const visible=rows.filter(row=>(!filter||row.status===filter)&&(!query||currentSearch(row).includes(query)));
  list.innerHTML=visible.map(row=>
   '<article class="suite-record" data-suite-id="'+esc(row.id)+'"><div><strong>'+esc(row.title)+'</strong>'+
   '<p>'+esc(row.status)+' · '+(row.eventDate?esc(row.eventDate):'Undated')+' · Version '+row.version+'</p>'+
   '<small>Last edit: '+esc(row.updatedAt||'')+' · '+esc(row.updatedBy||'')+'</small></div>'+
   '<div class="suite-record-buttons"><button type="button" data-suite-action="open">Open/edit</button>'+
   '<button type="button" data-suite-action="history">Officer history</button><button type="button" data-suite-action="md">Download draft</button>'+
   (['meetings','events','agm','sport-programme','venues','film'].includes(desk.key)?'<button type="button" data-suite-action="ics">Calendar file</button>':'')+
   (desk.key==='meetings'?'<button type="button" data-suite-action="followups">Create officer to-dos</button>':'')+
   (desk.key==='stock'?'<button type="button" data-suite-action="movement">Receive / issue stock</button>':'')+
   '</div>'+
   (desk.key==='stock'?'<form data-stock-move class="suite-stock-move" hidden>'+
    '<label>Movement<select name="direction"><option value="receive">Receive stock</option><option value="issue">Issue stock</option></select></label>'+
    '<label>Quantity<input name="quantity" type="number" min="1" step="1" required></label>'+
    '<label>Reason / receipt<input name="note" maxlength="500"></label>'+
    '<button type="submit">Record audited movement</button></form>':'')+
   '<div class="suite-history" hidden></div></article>').join('')||
   '<p class="suite-empty">No '+esc(desk.title.toLowerCase())+' records yet. Choose New working record to begin.</p>';
 }
 function drawStep(){
  find('suite-steps').innerHTML=desk.steps.map((name,i)=>'<button type="button" data-suite-step="'+i+'"'+(i===step?' aria-current="step"':'')+
   '><span>'+(i+1)+'</span>'+esc(name)+'</button>').join('');
  root.querySelectorAll('[data-stage]').forEach(area=>{area.hidden=Number(area.dataset.stage)!==step});
  find('suite-previous').disabled=step===0;find('suite-next').disabled=step===desk.steps.length-1;
  find('suite-stage-notice').textContent='Stage '+(step+1)+' of '+desk.steps.length+'. Required fields must be completed before saving; unfinished work stays a draft.';
 }
 function close(){editor.hidden=true;editing=null;form.reset();find('suite-save-status').textContent=''}
 function edit(row){
  editing=row||null;
  find('suite-editor-label').textContent=row?'Edit '+row.title:'New '+desk.title.toLowerCase();
  form.elements.title.value=row?.title||'';
  form.elements.status.value=row?.status||'draft';
  find('suite-fields').innerHTML=desk.steps.map((name,i)=>
   '<fieldset class="suite-stage" data-stage="'+i+'"><legend>'+esc(name)+'</legend><div class="suite-field-grid">'+
   desk.fields.filter(f=>f.step===name).map(f=>control(f,row?.fields?.[f.key])).join('')+'</div></fieldset>').join('');
  editor.hidden=false;step=0;drawStep();helper.render();
  if(isReadOnlyView()){find('suite-editor-label').textContent='View '+(row?.title||desk.title);protectView('#suite-form input,#suite-form textarea,#suite-form select,#suite-save',root)}
  find('suite-save-status').textContent=isReadOnlyView()?'Synthetic view only. No change can be saved.':'This is unsaved until you choose Save to Sandy D1.';
  editor.scrollIntoView({block:'start',behavior:'smooth'});
 }
 function collect(){
  const fields={};
  for(const field of desk.fields){
   const input=form.elements.namedItem(field.key);
   fields[field.key]=field.type==='checkbox'?input.checked:field.type==='number'?(input.value===''?null:Number(input.value)):input.value;
  }
  return fields;
 }
 async function refresh(){
  list.textContent='Loading shared records…';
  try{const answer=await api('/api/suite/'+desk.key);rows=answer.records||[];drawList()}
  catch(e){list.textContent='Could not load these records: '+e.message;say(e.message,true)}
 }
 async function open(key){
  const schema=SUITE_BY_KEY[key];
  if(!schema||!schema.roles.includes(getIdentity()?.role)){say('This role cannot access the selected desk.',true);return}
  desk=schema;rows=[];editing=null;query='';filter='';
  if(isReadOnlyView()){root.querySelector('.suite-boundary').textContent='Synthetic example records, read-only. Open records and review stages, history and example exports without saving.';protectView('#suite-new,#suite-save,[data-suite-action="followups"],[data-suite-action="movement"],[data-stock-move] button[type=submit]',root)}
  find('suite-search').value='';find('suite-filter').value='';
  find('suite-desk-name').textContent=desk.title;find('suite-desk-intro').textContent=desk.purpose;
  find('suite-notice').hidden=true;close();root.hidden=false;
  await refresh();
 }
 find('suite-search').addEventListener('input',event=>{query=event.target.value.toLowerCase();drawList()});
 find('suite-filter').addEventListener('change',event=>{filter=event.target.value;drawList()});
 find('suite-new').addEventListener('click',()=>{if(desk)edit(null)});
 find('suite-reload').addEventListener('click',()=>{if(desk)void refresh()});
 find('suite-close').addEventListener('click',close);
 find('suite-previous').addEventListener('click',()=>{step=Math.max(0,step-1);drawStep()});
 find('suite-next').addEventListener('click',()=>{step=Math.min(desk.steps.length-1,step+1);drawStep()});
 find('suite-steps').addEventListener('click',event=>{const b=event.target.closest('[data-suite-step]');if(b){step=Number(b.dataset.suiteStep);drawStep()}});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!desk||isReadOnlyView())return;
  const request={title:form.elements.title.value.trim(),status:form.elements.status.value,fields:collect()};
  if(!request.title){form.elements.title.focus();return}
  const missing=desk.fields.find(def=>def.required&&!String(request.fields[def.key]??'').trim());
  if(missing){
   step=desk.steps.indexOf(missing.step);drawStep();
   find('suite-save-status').textContent='Complete the required field: '+missing.label+'.';
   const input=form.elements.namedItem(missing.key);input?.focus({preventScroll:false});
   return;
  }
  const button=find('suite-save');button.disabled=true;find('suite-save-status').textContent='Saving to shared database…';
  try{
   const response=editing?await api('/api/suite/'+desk.key+'/'+editing.id,{method:'PATCH',data:{...request,version:editing.version}}):
    await api('/api/suite/'+desk.key,{method:'POST',data:request});
   close();await refresh();say('Saved '+request.title+' · version '+response.version+'. The real officer and time are in the revision history.');
   status('Shared '+desk.title.toLowerCase()+' saved successfully. Version '+response.version+'.');
  }catch(e){find('suite-save-status').textContent='Not saved: '+e.message;say('Save failed: '+e.message,true)}
  finally{button.disabled=false}
 });
 list.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-stock-move]');
  if(!form)return;
  event.preventDefault();
  const card=form.closest('[data-suite-id]'),r=rows.find(x=>x.id===card?.dataset.suiteId);
  if(!r||desk?.key!=='stock')return;
  const input=Object.fromEntries(new FormData(form));
  const signature=JSON.stringify([r.version,input.direction,Number(input.quantity),input.note]);
  if(form.dataset.movementSignature!==signature){form.dataset.movementSignature=signature;form.dataset.mutationId=crypto.randomUUID()}
  const button=form.querySelector('[type=submit]');button.disabled=true;
  try{
   const result=await api('/api/suite/stock/'+r.id+'/movement',{method:'POST',data:{
    version:r.version,direction:input.direction,quantity:Number(input.quantity),note:input.note,mutationId:form.dataset.mutationId}});
   say('Stock '+input.direction+' recorded. Available balance: '+result.balance+' · revision '+result.version+'.');
   await refresh();
  }catch(error){say('Stock movement not saved: '+error.message,true);button.disabled=false}
 });
 list.addEventListener('click',async event=>{
  const button=event.target.closest('[data-suite-action]'),card=button?.closest('[data-suite-id]');
  if(!card||!desk)return;
  const r=rows.find(row=>row.id===card.dataset.suiteId);if(!r)return;
  try{
   if(button.dataset.suiteAction==='open')edit((await api('/api/suite/'+desk.key+'/'+r.id)).record);
   if(button.dataset.suiteAction==='history'){
    const box=card.querySelector('.suite-history');if(!box.hidden){box.hidden=true;return}
    const answer=await api('/api/suite/'+desk.key+'/'+r.id+'/history');
    box.innerHTML='<h4>Attributed officer revisions</h4>'+(answer.history||[]).map(x=>
     '<p>Revision '+x.version+' · '+esc(x.office||x.role)+' · '+esc(x.at)+' · '+esc(x.operation)+'</p>').join('');
    box.hidden=false;
   }
   if(button.dataset.suiteAction==='md')download('sandy-'+desk.key+'-'+safeFilename(r.title)+'.md',recordMarkdown(desk,r),'text/markdown;charset=utf-8');
   if(button.dataset.suiteAction==='ics')download('sandy-'+desk.key+'-'+safeFilename(r.title)+'.ics',ics(r),'text/calendar;charset=utf-8');
   if(button.dataset.suiteAction==='movement'){
    const form=card.querySelector('[data-stock-move]');if(form)form.hidden=!form.hidden;
   }
   if(button.dataset.suiteAction==='followups'){
    if(!r.fields.followUps?.trim())throw Error('First add and save real follow-up actions in the meeting record.');
    if(!window.confirm('Create individual To-do records from this meeting follow-up list? Existing links will not be duplicated.'))return;
    button.disabled=true;
    try{
     const result=await api('/api/suite/meetings/'+r.id+'/followups',{method:'POST',data:{version:r.version}});
     say(result.created+' new officer tasks recorded; '+result.alreadyPresent+' already existed. Open Officer to-do lists to review them. No messages were sent.');
    }finally{button.disabled=false}
   }
  }catch(e){say(e.message,true)}
 });
 find('suite-export').addEventListener('click',()=>{
  if(!desk)return;
  const quote=x=>'"'+String(x??'').replace(/"/g,'""').replace(/\r?\n/g,' ')+'"';
  const keys=desk.fields.map(field=>field.key),lines=[['id','title','status','version','updatedAt','updatedBy',...keys].map(quote).join(',')];
  for(const r of rows)lines.push([r.id,r.title,r.status,r.version,r.updatedAt,r.updatedBy,...keys.map(key=>r.fields?.[key])].map(quote).join(','));
  download('sandy-'+desk.key+'-working-register.csv',lines.join('\r\n')+'\r\n','text/csv;charset=utf-8');
 });
 return {open,close,get active(){return desk?.key}};
}
