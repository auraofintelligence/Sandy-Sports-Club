import {isReadOnlyView,viewFetch} from './club-view-client.js';
const base='/api/committee/meeting-workspace';
const stages=['Agenda','Capture notes','Review minutes','Follow up'];
const stateLabel={draft:'Working draft',reviewed:'Reviewed draft',approved:'Approved record',cancelled:'Cancelled'};
const informal=t=>['Working group','Informal discussion','Founding meeting'].includes(t);
const lines=s=>String(s||'').split(/\r?\n/).map(t=>t.trim()).filter(Boolean);
const newId=()=>crypto.randomUUID();
const labelDate=d=>d?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00')):'Date to arrange';
const safeName=s=>String(s||'meeting').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,80)||'meeting';
function saveFile(name,content,type='text/plain;charset=utf-8'){
 const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
export function draftFromMeetingNotes(notes){
 const proposals=[],actions=[];
 for(const s of lines(notes)){
  const action=/^(?:action|follow[- ]up|job)\s*:\s*(.+)$/i.exec(s);
  const proposal=/^(?:proposal|suggestion|proposed decision)\s*:\s*(.+)$/i.exec(s);
  if(proposal)proposals.push(proposal[1]);
  if(action){const [text,ownerText='',dueDate='']=action[1].split('|').map(v=>v.trim());if(text)actions.push({text,ownerText,dueDate:/^20\d\d-\d\d-\d\d$/.test(dueDate)&&!Number.isNaN(Date.parse(dueDate))&&new Date(dueDate+'T00:00:00Z').toISOString().slice(0,10)===dueDate?dueDate:'',source:s})}
 }
 return {proposals:proposals.slice(0,50),actions:actions.slice(0,25)};
}
export function setupMeetingDesk({api,esc,status,getIdentity,showDesk}){
 const root=document.getElementById('meeting-workspace'),e=esc;
 let register=null,record=null,draft=null,title='',stage=0,epoch=0,busy=false,dirty=false,createAttempt=null;
 let stream=null,recorder=null,chunks=[],recordingToken=0,recordUrl=null,recordBlob=null,recordName='',suggestions=null;
 const ro=()=>isReadOnlyView(),locked=()=>ro()||record?.locked;
 const disable=()=>locked()?' disabled':'';
 const field=(name,value,kind='text',required=false)=>kind==='textarea'?'<textarea data-meeting-field="'+name+'" rows="4"'+disable()+'>'+e(value||'')+'</textarea>':'<input data-meeting-field="'+name+'" type="'+kind+'" value="'+e(value||'')+'"'+(required?' required':'')+disable()+'>';
 const labelled=(name,label,value,kind='text',required=false)=>'<label>'+label+field(name,value,kind,required)+'</label>';
 const officeOptions=(selected='',withBlank=true)=> (withBlank?'<option value="">Unallocated / name not mapped</option>':'')+(register?.offices||[]).map(o=>'<option value="'+e(o.key)+'"'+(o.key===selected?' selected':'')+'>'+e(o.label)+'</option>').join('');
 const state=()=>record?stateLabel[record.meeting.state]||'Working draft':'';
 function say(msg,bad=false){const el=root.querySelector('[data-meeting-message]');if(el){el.textContent=msg;el.classList.toggle('bad',bad)}status(msg,bad)}
 function stopCapture(dispose=false){
  recordingToken++;
  if(recorder?.state==='recording')try{recorder.stop()}catch{}
  stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;
  if(dispose){if(recordUrl)URL.revokeObjectURL(recordUrl);recordUrl=null;recordBlob=null;recordName='';chunks=[];}
 }
 function recordLink(){return recordUrl?'<a class="button outline" href="'+e(recordUrl)+'" download="'+e(recordName)+'">Download local recording ('+Math.ceil((recordBlob?.size||0)/1024)+' KB)</a>':''}
 function chooseRecord(id,replace=true){const url=new URL(location.href);if(id)url.searchParams.set('meeting',id);else url.searchParams.delete('meeting');if(replace)history.replaceState(null,'',url.pathname+url.search+url.hash)}
 function registerHtml(){
  const rows=register.meetings||[],chosen=record?.id;
  return '<header class="meeting-desk-head"><div><p class="eyebrow">SANDY SPORTS · MEETING WORKSPACE</p><h3 id="meeting-desk-title">Meetings and minutes</h3><p>Private planning register, ordered agenda, notes, reviewed draft minutes and linked officer jobs. No formal approval or publication.</p></div><button data-meeting-calendar type="button">Download private calendar</button></header>'+
   '<div class="meeting-register-bar"><label>Choose a meeting<select id="meeting-picker"><option value="">Choose a saved meeting</option>'+rows.map(m=>'<option value="'+e(m.id)+'"'+(m.id===chosen?' selected':'')+'>'+e(labelDate(m.date)+' · '+m.title+' · '+(stateLabel[m.state]||'Draft'))+'</option>').join('')+'</select></label><button type="button" data-meeting-reload>Refresh</button></div>'+
   '<details class="meeting-register-details"'+(!chosen?' open':'')+'><summary>Meeting register ('+rows.length+')</summary><div class="meeting-register-list">'+(rows.length?rows.map(m=>'<article class="meeting-register-card"><div><strong>'+e(m.title)+'</strong><p>'+e(labelDate(m.date))+' · '+e(m.start)+'–'+e(m.end)+' Brisbane · '+e(m.location)+'</p><small>'+e(m.type)+' · '+m.openActions+' open linked jobs · version '+m.version+'</small></div><span class="meeting-state">'+e(stateLabel[m.state]||'Working draft')+'</span><button type="button" data-meeting-open="'+e(m.id)+'">Open</button></article>').join(''):'<p>No working meetings scheduled yet.</p>')+'</div></details>'+
   '<details class="meeting-create"><summary>Schedule a proposed meeting</summary><form id="meeting-create"><fieldset'+(ro()?' disabled':'')+'><label>Title<input name="title" required maxlength="180"></label><div class="meeting-fields"><label>Meeting type<select name="type">'+Object.keys(register.templates).map(k=>'<option>'+e(k)+'</option>').join('')+'</select></label><label>Date<input name="date" type="date" required value="'+e(register.today)+'"></label><label>Start (Brisbane)<input name="start" type="time" required value="09:00"></label><label>Finish (Brisbane)<input name="end" type="time" required value="10:00"></label></div><label>Venue / location<input name="location" required placeholder="Proposed location, no booking implied"></label><button type="submit">Create meeting and agenda</button></fieldset></form></details>'+
   (register.legacy?.length?'<details class="meeting-register-details"><summary>Older shared notes ('+register.legacy.length+')</summary>'+register.legacy.map(m=>'<p><strong>'+e(m.title)+'</strong> · '+e(m.date||'Undated')+'<br>'+e(m.details)+'</p>').join('')+'<a href="#records">Open advanced register</a></details>':'');
 }
 function agendaHtml(){
  const m=draft;
  return '<details class="meeting-section" open><summary>Schedule, attendance and disclosures</summary><div class="meeting-fields">'+
   '<label>Meeting title<input id="meeting-title-edit" value="'+e(title)+'"'+disable()+'></label><label>Meeting type<select data-meeting-field="type"'+disable()+'>'+Object.keys(register.templates).map(t=>'<option'+(t===m.type?' selected':'')+'>'+e(t)+'</option>').join('')+'</select></label>'+
   labelled('date','Date',m.date,'date',true)+labelled('start','Start (Brisbane)',m.start,'time',true)+labelled('end','Finish (Brisbane)',m.end,'time',true)+labelled('location','Venue / location',m.location)+labelled('chair','Chair / facilitator',m.chair)+labelled('minuteTaker','Minute taker',m.minuteTaker)+labelled('attendance','Attendees',m.attendance,'textarea')+labelled('apologies','Apologies',m.apologies,'textarea')+
   (!informal(m.type)?'<label>Quorum observation (not legal certification)<select data-meeting-field="quorumStatus"'+disable()+'>'+['unchecked','present','absent','lost'].map(v=>'<option value="'+v+'"'+(m.quorumStatus===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label>':'<p>Informal/founding discussion: no formal quorum or vote.</p>')+
   labelled('quorumNote','Quorum / constitution working notes',m.quorumNote)+labelled('conflicts','Opening notes and disclosures',m.conflicts,'textarea')+labelled('adjournment','Adjournment / next arrangements',m.adjournment,'textarea')+'</div></details>'+
   '<div class="meeting-stage-tools"><h4>Ordered agenda</h4><button type="button" data-meeting-add-item'+disable()+'>Add item</button><button type="button" data-meeting-export="agenda">Download agenda</button></div>'+
   m.agenda.map((a,i)=>'<details class="meeting-agenda-item" open><summary><span>'+String(i+1)+'. '+e(a.title||'New item')+'</span></summary><div class="meeting-item-body" data-agenda-id="'+e(a.id)+'"><label>Heading<input data-agenda-field="title" value="'+e(a.title)+'"'+disable()+'></label><label>Discussion notes<textarea data-agenda-field="notes" rows="3"'+disable()+'>'+e(a.notes)+'</textarea></label><div class="meeting-stage-tools"><button type="button" data-agenda-action="up"'+(locked()||i===0?' disabled':'')+'>↑ Move up</button><button type="button" data-agenda-action="down"'+(locked()||i===m.agenda.length-1?' disabled':'')+'>↓ Move down</button><button type="button" data-agenda-action="remove"'+disable()+'>Remove item</button>'+(!informal(m.type)?'<button type="button" data-agenda-action="motion"'+disable()+'>Add proposed motion</button>':'')+'</div>'+
    (a.motions||[]).map(x=>'<div class="meeting-motion" data-motion-id="'+e(x.id)+'"><label>Proposed wording<textarea data-motion-field="text" rows="2"'+disable()+'>'+e(x.text)+'</textarea></label><div class="meeting-fields"><label>Proposed by<input data-motion-field="movedBy" value="'+e(x.movedBy)+'"'+disable()+'></label><label>Seconded by (if proposed)<input data-motion-field="secondedBy" value="'+e(x.secondedBy)+'"'+disable()+'></label><label>Working status<select data-motion-field="outcome"'+disable()+'>'+['pending','deferred','withdrawn'].map(s=>'<option'+(x.outcome===s?' selected':'')+'>'+s+'</option>').join('')+'</select></label></div><button type="button" data-motion-remove'+disable()+'>Remove proposed motion</button></div>').join('')+'</div></details>').join('');
 }
 function captureHtml(){return '<h4>Capture the conversation</h4><p>Enter the actual discussion or paste a transcript. The local recorder never sends media to a provider. All participants must agree first.</p>'+
  '<details class="meeting-section"><summary>Record voice or video locally</summary><label class="meeting-check"><input id="meeting-consent" type="checkbox"'+disable()+'> Everyone present agrees to this recording.</label><div class="meeting-stage-tools"><label>Mode<select id="meeting-record-mode"'+disable()+'><option value="audio">Voice only</option><option value="video">Voice and video</option></select></label><button type="button" data-meeting-record="start" disabled>Start recording</button><button type="button" data-meeting-record="stop" disabled>Stop</button></div><video id="meeting-camera-preview" autoplay muted playsinline hidden></video><p id="meeting-record-status">No media is being captured.</p><div id="meeting-record-download">'+recordLink()+'</div></details>'+
  labelled('notes','Original notes / pasted transcript',draft.notes,'textarea')+
  '<p class="meeting-note">For local suggestions, use “Proposal: …” or “Action: … | Secretary | 2026-12-04”. Nothing is treated as approved or sent to a third party.</p><button type="button" data-meeting-suggest'+disable()+'>Prepare review suggestions from notes</button>'+
  (suggestions?'<div class="meeting-suggestions"><h4>Review suggested items</h4>'+suggestions.proposals.map((x,i)=>'<label class="meeting-check"><input type="checkbox" data-suggestion-proposal="'+i+'" checked'+disable()+'> '+e(x)+'</label>').join('')+suggestions.actions.map((x,i)=>'<label class="meeting-check"><input type="checkbox" data-suggestion-action="'+i+'" checked'+disable()+'> '+e(x.text)+' · '+e(x.ownerText)+' · '+e(x.dueDate||'date to confirm')+'</label><small>Source: '+e(x.source)+'</small>').join('')+'<button type="button" data-meeting-accept-suggestions'+disable()+'>Add selected suggestions to draft</button></div>':'');
 }
 function reviewHtml(){return '<h4>Review the draft minutes</h4><details class="meeting-section"><summary>Read original notes</summary><p class="meeting-pre">'+e(draft.notes||'No notes entered.')+'</p></details>'+
   '<details class="meeting-section"><summary>Read ordered agenda and proposed motions</summary>'+draft.agenda.map(a=>'<p><strong>'+e(a.title)+'</strong><br>'+e(a.notes||'')+'</p>'+a.motions.map(m=>'<p>Proposed: '+e(m.text)+' ('+e(m.outcome)+')</p>').join('')).join('')+'</details>'+
   '<button type="button" data-meeting-compose-minutes'+disable()+'>Compose draft from agenda and notes</button>'+labelled('minutes','Draft minutes (not formally approved)',draft.minutes,'textarea')+
   '<label>Proposals / proposed decisions, one per line<textarea id="meeting-proposals" rows="4"'+disable()+'>'+e(draft.proposals.join('\n'))+'</textarea></label>'+
   '<label class="meeting-check"><input type="checkbox" data-meeting-field="reviewedForPrivacy"'+(draft.reviewedForPrivacy?' checked':'')+disable()+'> I reviewed private information and removed unnecessary details.</label><label class="meeting-check"><input type="checkbox" data-meeting-field="reviewedBySecretary"'+(draft.reviewedBySecretary?' checked':'')+disable()+'> Secretariat review completed for this working draft.</label>'+
   '<div class="meeting-stage-tools"><button type="button" data-meeting-review'+(locked()||!['webmaster','secretary','assistant_secretary'].includes(getIdentity()?.role)?' disabled':'')+'>Save reviewed draft</button><button type="button" data-meeting-export="minutes">Download draft minutes</button><button type="button" disabled title="Formal club authority is not established">Approve formal minutes (disabled)</button><button type="button" disabled>Release to members (disabled)</button></div>';
 }
 function followHtml(){
  const saved=new Map(record.actions.map(a=>[a.id,a.task]));
  return '<div class="meeting-stage-tools"><h4>Follow-up actions and linked officer jobs</h4><button type="button" data-meeting-add-action'+disable()+'>Add action</button><button type="button" data-meeting-go-todos>Open officer work lists</button></div>'+
   '<p>Save the action before creating its linked task. Completion and allocation are read from the same task in Officer to-do lists; no duplicate status entry.</p>'+
   (draft.actions.length?draft.actions.map(a=>{const task=saved.get(a.id),d=locked()||!!task?' disabled':'';return '<article class="meeting-action" data-action-id="'+e(a.id)+'"><div class="meeting-stage-tools"><strong>'+e(a.text||'New follow-up')+'</strong><span class="meeting-state">'+(task?(task.done?'Completed':task.archived?'Filed':'Linked / outstanding'):'Not handed over')+'</span></div><label>Action<input data-action-field="text" value="'+e(a.text)+'"'+d+'></label><div class="meeting-fields"><label>Responsible office<select data-action-field="office"'+d+'>'+officeOptions(a.office)+'</select></label><label>Original name / owner text<input data-action-field="ownerText" value="'+e(a.ownerText)+'"'+d+'></label><label>Due date<input type="date" data-action-field="dueDate" value="'+e(a.dueDate)+'"'+d+'></label><label>Originating agenda item<select data-action-field="sourceItem"'+d+'><option value="">General follow-up</option>'+draft.agenda.map(x=>'<option value="'+e(x.id)+'"'+(a.sourceItem===x.id?' selected':'')+'>'+e(x.title)+'</option>').join('')+'</select></label></div>'+
   (task?'<p>Current task: '+e(officeLabel(task.office))+' · '+e(labelDate(task.dueDate))+(task.completion?' · '+e(task.completion.by)+' recorded completion':'')+'</p>':'<div class="meeting-stage-tools"><button type="button" data-meeting-handoff'+(locked()||dirty||!record.actions.some(x=>x.id===a.id)?' disabled':'')+'>Create linked officer task</button><button type="button" data-meeting-remove-action'+disable()+'>Remove unlinked action</button></div>')+'</article>'}).join(''):'<p>No proposed follow-up actions yet.</p>')+
   (record.otherTasks?.length?'<details class="meeting-section"><summary>Older linked tasks retained</summary>'+record.otherTasks.map(t=>'<p>'+e(t.title)+' · '+(t.done?'Completed':'Outstanding')+'</p>').join('')+'</details>':'');
 }
 function officeLabel(k){return register.offices.find(x=>x.key===k)?.label||'Unallocated'}
 function render(){
  if(!register)return;
  root.innerHTML=registerHtml()+'<p data-meeting-message role="status"></p>'+
   (ro()?'<p class="meeting-note">Synthetic view-only example. Save, recording, cancellation and task handoff are disabled.</p>':'')+
   (record?'<article class="meeting-current"><header class="meeting-current-head"><div><h3>'+e(title)+'</h3><p>'+e(labelDate(draft.date))+' · '+e(draft.start)+'–'+e(draft.end)+' Brisbane · '+e(draft.location)+'</p><small>Version '+record.version+' · '+record.openActions+' open linked jobs'+(record.legacy?' · Existing working record':'')+'</small></div><span class="meeting-state">'+e(state())+'</span></header>'+
   (draft.cancelReason?'<p class="meeting-note">Cancelled: '+e(draft.cancelReason)+'</p>':'')+
   '<nav class="meeting-stage-nav" aria-label="Meeting workflow stages">'+stages.map((s,i)=>'<button type="button" data-meeting-stage="'+i+'"'+(stage===i?' aria-current="step"':'')+'><span>'+String(i+1)+'</span>'+s+'</button>').join('')+'</nav><section class="meeting-stage-panel">'+[agendaHtml,captureHtml,reviewHtml,followHtml][stage]()+'</section><div class="meeting-stage-tools"><button type="button" data-meeting-save'+disable()+'>Save working draft</button><button type="button" data-meeting-history>Officer revision history</button><button type="button" data-meeting-cancel'+disable()+'>Cancel proposed meeting</button><span id="meeting-dirty">'+(dirty?'Unsaved changes':'Saved record')+'</span></div><div data-meeting-history-panel hidden></div></article>':'<p class="meeting-note">Choose a meeting or schedule a proposed meeting to begin.</p>');
 }
 function markDirty(){dirty=true;const n=root.querySelector('#meeting-dirty');if(n)n.textContent='Unsaved changes';root.querySelectorAll('[data-meeting-handoff]').forEach(b=>b.disabled=true)}
 async function refresh(selected=null){
  const my=++epoch;root.hidden=false;root.textContent='Loading private meeting register…';
  try{
   const v=await api(base);if(my!==epoch)return;register=v;
   const key=selected||new URL(location.href).searchParams.get('meeting')||v.meetings[0]?.id;
   if(key&&v.meetings.some(x=>x.id===key)){const item=await api(base+'/'+key);if(my!==epoch)return;record=item;draft=structuredClone(item.meeting);title=item.title;chooseRecord(key)}else{record=null;draft=null;title='';chooseRecord(null)}
   dirty=false;suggestions=null;render();
  }catch(err){if(my===epoch){root.textContent='Meeting register unavailable: '+err.message;status(err.message,true)}}
 }
 async function openRecord(key){
  if(dirty&&!confirm('Discard unsaved changes to this meeting?'))return;
  stopCapture(true);stage=0;chooseRecord(key);await refresh(key);
 }
 async function save(review=false){
  if(!record||locked()||busy)return false;
  busy=true;const key=record.id,currentEpoch=epoch;
  try{
   await api(base+'/'+key,{method:'PATCH',data:{title,version:record.version,meeting:draft,review}});
   if(epoch!==currentEpoch)return false;
   await refresh(key);say(review?'Reviewed working draft saved. It is not approved minutes.':'Working meeting saved with officer attribution.');return true;
  }catch(err){if(epoch===currentEpoch)say('Not saved: '+err.message,true);return false}
  finally{busy=false}
 }
 function captureStatus(msg){const n=root.querySelector('#meeting-record-status');if(n)n.textContent=msg}
 async function startCapture(){
  if(locked()||!root.querySelector('#meeting-consent')?.checked||recorder)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){captureStatus('This browser does not support local recording. Paste notes or a transcript.');return}
  const token=++recordingToken,mode=root.querySelector('#meeting-record-mode').value;
  root.querySelector('[data-meeting-record=start]').disabled=true;
  try{
   const s=await navigator.mediaDevices.getUserMedia({audio:true,video:mode==='video'});
   if(token!==recordingToken||locked()||!root.querySelector('#meeting-consent')?.checked){s.getTracks().forEach(t=>t.stop());return}
   stream=s;chunks=[];const capture=new MediaRecorder(s);recorder=capture;
   const preview=root.querySelector('#meeting-camera-preview');if(mode==='video'&&preview){preview.srcObject=s;preview.hidden=false}
   capture.ondataavailable=ev=>{if(ev.data.size)chunks.push(ev.data)};
   capture.onstop=()=>{
    s.getTracks().forEach(t=>t.stop());if(stream===s)stream=null;if(recorder===capture)recorder=null;
    if(token!==recordingToken)return;
    const type=capture.mimeType||chunks[0]?.type||'application/octet-stream';recordBlob=new Blob(chunks,{type});
    if(recordUrl)URL.revokeObjectURL(recordUrl);recordUrl=URL.createObjectURL(recordBlob);
    recordName='sandy-'+safeName(title)+'-'+draft.date+'-'+mode+'.'+(type.includes('mp4')?'mp4':type.includes('ogg')?'ogg':'webm');
    const download=root.querySelector('#meeting-record-download');if(download)download.innerHTML=recordLink();
    if(preview){preview.srcObject=null;preview.hidden=true}
    const stop=root.querySelector('[data-meeting-record=stop]');if(stop)stop.disabled=true;
    const start=root.querySelector('[data-meeting-record=start]');if(start)start.disabled=locked()||!root.querySelector('#meeting-consent')?.checked;
    captureStatus('Recording stopped. Download the local file. No media was uploaded.');
   };
   capture.start();root.querySelector('[data-meeting-record=stop]').disabled=false;captureStatus('Recording locally. Stop before leaving this meeting.');
  }catch(err){if(token===recordingToken){stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;captureStatus('Could not start recording: '+err.message);const start=root.querySelector('[data-meeting-record=start]');if(start)start.disabled=locked()||!root.querySelector('#meeting-consent')?.checked}}
 }
 function moveStage(next){if(stage===1&&recorder?.state==='recording'){say('Stop and download the local recording before leaving Capture notes.',true);return}if(stage===1)recordingToken++;stage=next;render()}
 function actionIndex(node){return draft.actions.findIndex(x=>x.id===node.closest('[data-action-id]')?.dataset.actionId)}
 function agendaIndex(node){return draft.agenda.findIndex(x=>x.id===node.closest('[data-agenda-id]')?.dataset.agendaId)}
 function update(ev){
  const el=ev.target;
  if(el.id==='meeting-picker'){void openRecord(el.value);return}
  if(el.id==='meeting-consent'){if(!el.checked&&recorder?.state==='recording')recorder.stop();const b=root.querySelector('[data-meeting-record=start]');if(b)b.disabled=locked()||!el.checked||Boolean(recorder);return}
  if(!draft||locked())return;
  if(el.id==='meeting-title-edit'){title=el.value;markDirty()}
  if(el.id==='meeting-proposals'){draft.proposals=lines(el.value);markDirty()}
  if(el.dataset.meetingField){const k=el.dataset.meetingField;draft[k]=el.type==='checkbox'?el.checked:el.value;markDirty();if(k==='type'){if(informal(draft.type)){draft.quorumStatus='unchecked'}render()}}
  if(el.dataset.agendaField){const a=draft.agenda[agendaIndex(el)];if(a){a[el.dataset.agendaField]=el.value;markDirty();if(el.dataset.agendaField==='title'){const summary=el.closest('details')?.querySelector('summary span');if(summary)summary.textContent=String(agendaIndex(el)+1)+'. '+el.value}}}
  if(el.dataset.motionField){const a=draft.agenda[agendaIndex(el)],m=a?.motions.find(x=>x.id===el.closest('[data-motion-id]')?.dataset.motionId);if(m){m[el.dataset.motionField]=el.value;markDirty()}}
  if(el.dataset.actionField){const a=draft.actions[actionIndex(el)];if(a){a[el.dataset.actionField]=el.value;markDirty()}}
 }
 root.addEventListener('input',ev=>{if(ev.target.tagName==='INPUT'&&ev.target.type!=='checkbox'||ev.target.tagName==='TEXTAREA')update(ev)});
 root.addEventListener('change',ev=>{if(ev.target.tagName==='SELECT'||ev.target.type==='checkbox')update(ev)});
 root.addEventListener('submit',async ev=>{
  if(ev.target.id!=='meeting-create')return;ev.preventDefault();if(ro()||busy)return;
  if(dirty&&!confirm('Discard unsaved changes to the open meeting?'))return;
  const data=Object.fromEntries(new FormData(ev.target)),key=JSON.stringify(data);if(!createAttempt||createAttempt.key!==key)createAttempt={key,id:newId()};
  busy=true;try{const res=await api(base,{method:'POST',data:{...data,id:createAttempt.id}});createAttempt=null;stopCapture(true);stage=0;await refresh(res.id);say('Proposed meeting and agenda created. No invitations sent.')}catch(err){say(err.message,true)}finally{busy=false}
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.meetingOpen){await openRecord(b.dataset.meetingOpen);return}
  if(b.hasAttribute('data-meeting-reload')){if(!dirty||confirm('Discard unsaved changes and reload?')){stopCapture(true);await refresh(record?.id)}return}
  if(b.hasAttribute('data-meeting-calendar')){try{const r=await viewFetch(base+'/calendar.ics',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Calendar unavailable');saveFile('sandy-private-meeting-calendar.ics',await r.text(),'text/calendar;charset=utf-8')}catch(err){say(err.message,true)}return}
  if(!record||!draft)return;
  if(b.dataset.meetingStage!==undefined){moveStage(Number(b.dataset.meetingStage));return}
  if(b.hasAttribute('data-meeting-go-todos')){if(!dirty||confirm('Discard unsaved changes before switching to work lists?'))await showDesk('todos');return}
  if(b.hasAttribute('data-meeting-history')){const panel=root.querySelector('[data-meeting-history-panel]');if(!panel.hidden){panel.hidden=true;return}panel.hidden=false;panel.textContent='Loading revision history…';try{const v=await api('/api/suite/meetings/'+record.id+'/history');panel.innerHTML=v.history.map(x=>'<p>Version '+x.version+' · '+e(x.office)+' · '+e(x.at)+' · '+e(x.operation)+'</p>').join('')}catch(err){panel.textContent=err.message}return}
  if(b.dataset.meetingExport){const m=draft,body=['# '+title,'Sandy Sports Club working draft, not approved',m.type+' · '+m.date+' · '+m.start+' Brisbane',m.location,'','## Agenda',...m.agenda.map((a,i)=>String(i+1)+'. '+a.title+'\n'+a.notes+'\n'+a.motions.map(x=>'Proposed motion: '+x.text+' ('+x.outcome+')').join('\n'))];if(b.dataset.meetingExport==='minutes')body.push('','## Original notes',m.notes,'','## Draft minutes',m.minutes,'','## Proposals',...m.proposals,'','## Follow-ups',...m.actions.map(a=>a.text+' | '+officeLabel(a.office)+' | '+a.dueDate));saveFile('sandy-'+safeName(title)+'-'+b.dataset.meetingExport+'.md',body.join('\n'));return}
  if(locked())return;
  if(b.hasAttribute('data-meeting-save')){await save();return}
  if(b.hasAttribute('data-meeting-review')){await save(true);return}
  if(b.hasAttribute('data-meeting-cancel')){if(dirty){say('Save or discard changes before cancelling.',true);return}const reason=prompt('Reason for cancelling the proposed meeting:');if(!reason)return;try{await api(base+'/'+record.id+'/cancel',{method:'POST',data:{version:record.version,reason}});await refresh(record.id);say('Meeting cancelled. History retained and calendar marked cancelled.')}catch(err){say(err.message,true)}return}
  if(b.dataset.meetingRecord==='start'){await startCapture();return}
  if(b.dataset.meetingRecord==='stop'){if(recorder?.state==='recording')recorder.stop();return}
  if(b.hasAttribute('data-meeting-suggest')){suggestions=draftFromMeetingNotes(draft.notes);render();return}
  if(b.hasAttribute('data-meeting-accept-suggestions')){for(const box of root.querySelectorAll('[data-suggestion-proposal]:checked')){const s=suggestions.proposals[Number(box.dataset.suggestionProposal)];if(!draft.proposals.includes(s))draft.proposals.push(s)}for(const box of root.querySelectorAll('[data-suggestion-action]:checked')){const a=suggestions.actions[Number(box.dataset.suggestionAction)],office=register.offices.find(o=>o.label.toLowerCase()===a.ownerText.toLowerCase())?.key||'';if(!draft.actions.some(x=>x.text===a.text&&x.dueDate===a.dueDate&&x.ownerText===a.ownerText))draft.actions.push({id:newId(),text:a.text,ownerText:a.ownerText,office,dueDate:a.dueDate,sourceItem:null})}suggestions=null;markDirty();render();return}
  if(b.hasAttribute('data-meeting-compose-minutes')){draft.minutes=[draft.agenda.map(a=>a.title+'\n'+a.notes).join('\n\n'),draft.notes].filter(Boolean).join('\n\n');markDirty();render();return}
  if(b.hasAttribute('data-meeting-add-item')){draft.agenda.push({id:newId(),title:'New agenda item',notes:'',motions:[]});markDirty();render();return}
  if(b.dataset.agendaAction){const i=agendaIndex(b),a=draft.agenda[i];if(!a)return;const cmd=b.dataset.agendaAction;if(cmd==='remove'){if(draft.agenda.length===1||draft.actions.some(x=>x.sourceItem===a.id)){say('Keep at least one agenda item and preserve any action source.',true);return}draft.agenda.splice(i,1)}else if(cmd==='motion'){a.motions.push({id:newId(),text:'',movedBy:'',secondedBy:'',outcome:'pending',vote:''})}else {const j=i+(cmd==='up'?-1:1);if(j<0||j>=draft.agenda.length)return;[draft.agenda[i],draft.agenda[j]]=[draft.agenda[j],draft.agenda[i]]}markDirty();render();return}
  if(b.hasAttribute('data-motion-remove')){const a=draft.agenda[agendaIndex(b)];a.motions=a.motions.filter(x=>x.id!==b.closest('[data-motion-id]').dataset.motionId);markDirty();render();return}
  if(b.hasAttribute('data-meeting-add-action')){draft.actions.push({id:newId(),text:'',office:'',ownerText:'',dueDate:'',sourceItem:null});markDirty();render();return}
  const i=actionIndex(b),a=draft.actions[i];if(!a)return;
  if(b.hasAttribute('data-meeting-remove-action')){draft.actions.splice(i,1);markDirty();render();return}
  if(b.hasAttribute('data-meeting-handoff')){if(dirty||busy)return;busy=true;try{await api(base+'/'+record.id+'/handoff',{method:'POST',data:{version:record.version,actionId:a.id}});await refresh(record.id);say('Linked officer task recorded once. Completion is shared with this meeting.')}catch(err){say(err.message,true)}finally{busy=false}}
 });
 window.addEventListener('pagehide',()=>stopCapture(true));
 return {async open(){stage=0;root.hidden=false;await refresh()},close(){epoch++;stopCapture(true);root.hidden=true;register=null;record=null;draft=null;dirty=false;suggestions=null}};
}
