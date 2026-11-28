// Meetings and minutes desk, following PLFC's flow: 1 Agenda, 2 On the day, 3 Minutes, 4 Follow up.
// Uses the server meeting register (/api/committee/meetings). Nothing is emailed; minutes approval stays
// switched off until the club has a lawful committee (SANDY_CLUB_APPROVALS).
import {isReadOnlyView} from './club-view-client.js';
const OFFICES={webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee officer'};
const TYPES=['Management committee','Founding meeting','Annual general meeting','General meeting','Special meeting','Public meeting','Working group','Informal discussion'];
const OUTCOMES={carried:'Carried',lost:'Lost',deferred:'Deferred',withdrawn:'Withdrawn',noted:'Noted'};
const STANDARD=['Welcome and apologies','Recording of this meeting: video and audio, archived (rule 4B)','Minutes of the last meeting','Correspondence','Treasurer’s report','General business','Next meeting'];
const STEPS=[['agenda','1 Agenda'],['day','2 On the day'],['minutes','3 Minutes'],['follow','4 Follow up']];
const longDate=d=>d?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00')):'No date yet';
const lines=s=>String(s||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean);
const tempId=()=>'n'+crypto.randomUUID().slice(0,12);

export function setupMeetingsDesk({api,esc:e,status,showDesk}){
 const root=document.getElementById('committee-meetings');
 if(!root)return {open(){},close(){}};
 let list=[],meeting=null,items=[],step='agenda',open=false,busy=false,epoch=0,dirty=false;
 const ro=()=>isReadOnlyView(),locked=()=>!meeting||meeting.minutesApproved||Boolean(meeting.cancelled)||ro();
 const off=k=>OFFICES[k]||'Not allocated';
 const officeOptions=sel=>'<option value="">Not allocated</option>'+Object.entries(OFFICES).map(([k,l])=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+l+'</option>').join('');
 const say=(msg,bad=false)=>{const n=root.querySelector('[data-mt-message]');if(n){n.textContent=msg;n.classList.toggle('bad',bad)}if(bad)status?.(msg,true)};
 const dis=()=>locked()?' disabled':'';

 function listView(){
  const today=new Date(Date.now()+36e6).toISOString().slice(0,10);
  const upcoming=list.filter(m=>m.status!=='cancelled'&&m.date&&m.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const past=list.filter(m=>!upcoming.includes(m));
  const row=m=>'<li><button type="button" data-mt-open="'+e(m.id)+'" aria-current="'+(meeting?.id===m.id?'true':'false')+'"><strong>'+e(m.title)+'</strong><span>'+e(longDate(m.date))+' · '+e(m.type||'Meeting')+'</span><span class="ops-badges">'+
   (m.status==='cancelled'?'<span class="ops-pill ops-muted">Cancelled</span>':m.minutesApproved?'<span class="ops-pill ops-green">Minutes approved</span>':m.minutesDrafted?'<span class="ops-pill ops-amber">Draft minutes</span>':'<span class="ops-pill ops-green">'+m.agendaItems+' agenda item'+(m.agendaItems===1?'':'s')+'</span>')+'</span></button></li>';
  return '<details class="ops-compose"'+(list.length?'':' open')+'><summary>Schedule a meeting</summary><form data-mt-new><fieldset'+(ro()?' disabled':'')+'>'+
   '<label>Type of meeting<select name="meetingType">'+TYPES.map(t=>'<option>'+t+'</option>').join('')+'</select></label>'+
   '<label>Meeting title<input name="title" required maxlength="160" placeholder="e.g. December committee meeting"></label>'+
   '<div class="ops-form-grid"><label>Date<input type="date" name="date" required></label><label>Location<input name="location" maxlength="300" placeholder="e.g. Dunwich hall or online"></label>'+
   '<label>Start (Brisbane time)<input type="time" name="startTime"></label><label>Finish<input type="time" name="endTime"></label></div>'+
   '<button type="submit">Create meeting and agenda</button></fieldset></form></details>'+
   (upcoming.length?'<h4>Coming up</h4><ul class="mt-list">'+upcoming.map(row).join('')+'</ul>':'')+
   (past.length?'<h4>Earlier</h4><ul class="mt-list">'+past.map(row).join('')+'</ul>':'')+
   (!list.length?'<p class="ops-empty">No meetings yet. Schedule the first one above.</p>':'');
 }
 function itemEditor(item,i){
  const motion=item.kind==='motion';
  return '<li class="mt-item" data-index="'+i+'"><div class="mt-item-head"><span class="mt-num">'+(i+1)+'</span><input aria-label="Agenda item '+(i+1)+'" data-f="title" value="'+e(item.title)+'" maxlength="200" placeholder="Agenda item"'+dis()+'>'+
   '<span class="mt-move"><button type="button" data-mt-move="-1" aria-label="Move up"'+(i===0?' disabled':dis())+'>↑</button><button type="button" data-mt-move="1" aria-label="Move down"'+(i===items.length-1?' disabled':dis())+'>↓</button><button type="button" data-mt-remove aria-label="Remove item"'+dis()+'>✕</button></span></div>'+
   '<div class="mt-item-meta"><input data-f="presenter" aria-label="Led by (optional)" placeholder="Led by (optional)" value="'+e(item.presenter)+'" maxlength="100"'+dis()+'>'+
   '<label class="ops-check"><input type="checkbox" data-f="motion"'+(motion?' checked':'')+dis()+'> A motion to vote on</label></div>'+
   (motion?'<label>Motion wording<textarea data-f="motionText" rows="2" maxlength="2000" placeholder="That the committee…"'+dis()+'>'+e(item.motion)+'</textarea></label>'+
    '<div class="ops-form-grid"><label>Moved by<input data-f="proposer" value="'+e(item.proposer)+'" maxlength="100"'+dis()+'></label><label>Seconded by<input data-f="seconder" value="'+e(item.seconder)+'" maxlength="100"'+dis()+'></label></div>':'')+'</li>';
 }
 function agendaStep(){
  return '<p class="mt-help">Add what the meeting will cover, in order. Tick “A motion to vote on” for anything that needs a decision.</p>'+
   '<ol class="mt-items">'+items.map(itemEditor).join('')+'</ol>'+(items.length?'':'<p class="ops-empty">No agenda items yet.</p>')+
   '<div class="ops-actions"><button type="button" data-mt-add'+dis()+'>Add an item</button>'+(items.length?'':'<button type="button" data-mt-standard'+dis()+'>Use the standard agenda</button>')+
   '<button type="button" class="mt-primary" data-mt-save-agenda'+dis()+'>Save agenda</button><button type="button" data-mt-print>Print agenda</button></div>';
 }
 function dayStep(){
  const a=meeting.attendance;
  const quorum=a?(a.quorumRequired?a.present.length+' present of '+a.quorumRequired+' needed: '+(a.quorumMet?'quorum met':'quorum NOT met'):a.present.length+' present. Quorum not set yet.'):'';
  const t=meeting.fields?.meetingType||meeting.type||'',pub=/public/i.test(t),general=/general meeting|founding|special/i.test(t);
  return '<p class="ops-boundary">Rule 4B: record video and audio from opening to close, without pausing'+(pub?', and stream it live to the public on <a href="/club-admin.html#committee/island-news">Island news and live</a>':general?', and stream it live to members':'')+'. Add the recording to the archive under step 3.</p>'+
   '<section class="mt-block"><h5>Who came</h5><form data-mt-attendance><fieldset'+dis()+'><div class="ops-form-grid">'+
   '<label>Present (one per line)<textarea name="present" rows="4">'+e((a?.present||[]).join('\n'))+'</textarea></label>'+
   '<label>Apologies (one per line)<textarea name="apologies" rows="4">'+e((a?.apologies||[]).join('\n'))+'</textarea></label></div>'+
   '<label class="mt-narrow">Quorum (people needed, optional)<input type="number" name="quorumRequired" min="1" max="99" value="'+e(a?.quorumRequired??meeting.quorumDefault??'')+'"></label>'+
   '<button type="submit">Save attendance</button></fieldset></form>'+(quorum?'<p class="mt-result">'+e(quorum)+'</p>':'')+'</section>'+
   (items.length?'<section class="mt-block"><h5>Notes, decisions and jobs</h5><p class="mt-help">Type what happened under each item. Add a job for anything someone agreed to do.</p>'+
    items.map((item,i)=>{
     const saved=meeting.agenda.find(x=>x.id===item.id),out=saved?.outcome;
     return '<article class="mt-item" data-index="'+i+'"><h6>'+(i+1)+'. '+e(item.title)+'</h6>'+
      (item.kind==='motion'?'<p class="mt-motion">Motion: '+e(item.motion||'wording not recorded')+'</p>'+
       (out?'<p class="mt-result">Outcome: <strong>'+e(OUTCOMES[out.outcome]||out.outcome)+'</strong>'+(out.votes?' (for '+out.votes.for+', against '+out.votes.against+', abstain '+out.votes.abstain+')':'')+'</p>':'')+
       (saved&&!locked()?'<form class="mt-outcome" data-mt-outcome="'+e(item.id)+'"><label>Outcome<select name="outcome">'+Object.entries(OUTCOMES).map(([k,l])=>'<option value="'+k+'"'+(out?.outcome===k?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
        '<label>For<input type="number" name="for" min="0" max="999" value="'+e(out?.votes?.for??'')+'"></label><label>Against<input type="number" name="against" min="0" max="999" value="'+e(out?.votes?.against??'')+'"></label><label>Abstain<input type="number" name="abstain" min="0" max="999" value="'+e(out?.votes?.abstain??'')+'"></label>'+
        '<button type="submit">Record outcome</button></form>':(saved?'':'<p class="mt-help">Save the agenda first to record the outcome.</p>')):'')+
      '<label>Notes<textarea data-f="notes" rows="'+(item.notes?3:2)+'" maxlength="2000"'+dis()+'>'+e(item.notes)+'</textarea></label>'+
      '<div class="mt-jobs">'+(item.actions||[]).map((act,j)=>'<div class="mt-job" data-job="'+j+'"><input aria-label="Job" data-j="text" value="'+e(act.text)+'" maxlength="250" placeholder="What needs doing"'+dis()+'><select aria-label="Who" data-j="office"'+dis()+'>'+officeOptions(act.office)+'</select><input aria-label="Due" type="date" data-j="due" value="'+e(act.due)+'"'+dis()+'><button type="button" data-mt-drop-job aria-label="Remove job"'+dis()+'>✕</button></div>').join('')+'</div>'+
      '<button type="button" data-mt-add-job'+dis()+'>Add a job</button></article>';
    }).join('')+'<div class="ops-actions"><button type="button" class="mt-primary" data-mt-save-agenda'+dis()+'>Save notes and jobs</button></div></section>':'<p class="ops-empty">Add agenda items first.</p>');
 }
 function archiveBox(){
  const a=meeting.archive||{},link=(k,l)=>a[k]?'<a href="'+e(a[k])+'" target="_blank" rel="noopener">'+l+'</a>':'';
  return '<section class="mt-block"><h5>Meeting archive (rule 4B)</h5><p class="mt-help">Add the video, audio and transcript. They are kept permanently and every member can watch them. A link can be replaced, never removed; replaced links stay in the history.</p>'+
   ([link('video','Video'),link('audio','Audio'),link('transcript','Transcript')].filter(Boolean).join(' · ')||'<p class="ops-empty">Nothing archived yet.</p>')+(a.history?'<p class="mt-help">'+a.history+' earlier link'+(a.history===1?'':'s')+' kept in the history.</p>':'')+
   (meeting.cancelled||ro()?'':'<form data-mt-archive><div class="ops-form-grid"><label>Video link<input type="url" name="video" placeholder="https://" value="'+e(a.video||'')+'"></label><label>Audio link<input type="url" name="audio" placeholder="https://" value="'+e(a.audio||'')+'"></label><label>Transcript link<input type="url" name="transcript" placeholder="https://" value="'+e(a.transcript||'')+'"></label></div><button type="submit">Save to the archive</button></form>')+'</section>';
 }
 function minutesStep(){
  const text=meeting.minutes?.committeeDraft;
  return '<p class="mt-help">Start from the agenda, attendance and outcomes, then correct the wording.</p>'+
   (text?'':'<p>No draft minutes yet.</p>')+
   '<form data-mt-minutes><fieldset'+dis()+'><label>Draft minutes<textarea name="text" rows="16" maxlength="20000">'+e(text||meeting.generatedMinutes)+'</textarea></label>'+
   '<div class="ops-actions"><button type="submit" class="mt-primary">Save draft minutes</button><button type="button" data-mt-rebuild>Rebuild from the agenda</button><button type="button" data-mt-download>Download minutes</button></div></fieldset></form>'+
   archiveBox()+
   '<p class="ops-boundary">'+(meeting.minutesApproved?'These minutes are approved and locked.':'Approving minutes switches on once the club has an elected committee. Until then they stay as drafts.')+'</p>';
 }
 function followStep(){
  const acts=meeting.actions||[],waiting=acts.filter(a=>!a.exists).length;
  return '<p class="mt-help">Send the jobs from this meeting to each officer’s to-do list. Nobody is emailed.</p>'+
   (acts.length?'<ul class="mt-follow">'+acts.map(a=>'<li><strong>'+e(a.text)+'</strong><span>'+e(off(a.office))+(a.due?' · due '+e(longDate(a.due)):'')+'</span>'+
    '<span class="ops-pill '+(a.complete?'ops-muted">Done':a.exists?'ops-green">On the to-do list':'ops-amber">Not sent yet')+'</span></li>').join('')+'</ul>':'<p class="ops-empty">No jobs recorded yet. Add them under step 2.</p>')+
   '<div class="ops-actions">'+(waiting?'<button type="button" class="mt-primary" data-mt-send-jobs'+(ro()?' disabled':'')+'>Put '+waiting+' job'+(waiting===1?'':'s')+' on to-do lists</button>':'')+
   '<button type="button" data-mt-todos>Officer to-do lists</button><button type="button" data-mt-ics>Add to calendar</button></div>';
 }
 function detailView(){
  if(!meeting)return '<p class="ops-empty">'+(list.length?'Choose a meeting.':'Your meetings will show here.')+'</p>';
  const f=meeting.fields||{},when=[longDate(f.date),f.startTime&&(f.startTime+(f.endTime?' to '+f.endTime:''))].filter(Boolean).join(' · ');
  return '<header class="mt-head"><div><h4 tabindex="-1">'+e(meeting.title)+'</h4><p>'+e(f.meetingType||'Meeting')+' · '+e(when)+(f.location?' · '+e(f.location):'')+'</p></div>'+
   (meeting.cancelled?'<span class="ops-pill ops-muted">Cancelled</span>':meeting.minutesApproved?'<span class="ops-pill ops-green">Minutes approved</span>':'')+'</header>'+
   (meeting.cancelled?'<p class="ops-boundary">Cancelled: '+e(meeting.cancelled.reason)+'</p>':'')+
   (!locked()?'<details class="ops-compose mt-change"><summary>Change date or cancel</summary><form data-mt-schedule><div class="ops-form-grid"><label>Date<input type="date" name="date" value="'+e(f.date)+'"></label><label>Location<input name="location" value="'+e(f.location)+'" maxlength="300"></label>'+
    '<label>Start<input type="time" name="startTime" value="'+e(f.startTime)+'"></label><label>Finish<input type="time" name="endTime" value="'+e(f.endTime)+'"></label></div><label>Reason for the change (optional)<input name="reason" maxlength="300"></label><button type="submit">Save new time</button></form>'+
    '<form data-mt-cancel class="mt-cancel"><label>Why is it cancelled?<input name="reason" maxlength="300" required></label><button type="submit">Cancel this meeting</button></form></details>':'')+
   '<nav class="mt-steps" aria-label="Meeting steps">'+STEPS.map(([k,l])=>'<button type="button" data-mt-step="'+k+'" aria-pressed="'+(step===k)+'">'+l+'</button>').join('')+'</nav>'+
   '<div class="mt-step">'+({agenda:agendaStep,day:dayStep,minutes:minutesStep,follow:followStep}[step])()+'</div>';
 }
 function render(){
  const focus=document.activeElement&&root.contains(document.activeElement)?document.activeElement.closest('[data-mt-step]')?.dataset.mtStep:'';
  root.innerHTML='<header class="ops-header"><div><h3 id="mt-desk-title" tabindex="-1">Meetings and minutes</h3><p>Plan the agenda, record what happened, prepare the minutes and send the jobs to officers.</p></div><button type="button" data-mt-refresh>Check now</button></header>'+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+'<p data-mt-message role="status"></p>'+
   '<div class="mt-layout"><aside class="mt-aside">'+listView()+'</aside><section class="mt-detail">'+detailView()+'</section></div>';
  if(focus)root.querySelector('[data-mt-step="'+focus+'"]')?.focus();
 }
 async function loadList(){list=(await api('/api/committee/meetings')).meetings||[]}
 async function loadMeeting(id){meeting=(await api('/api/committee/meetings/'+id)).meeting;items=structuredClone(meeting.agenda||[]);dirty=false}
 async function refresh(id=meeting?.id){
  const my=++epoch;
  try{await loadList();if(id&&list.some(m=>m.id===id))await loadMeeting(id);else{meeting=null;items=[]}if(my===epoch)render()}
  catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load meetings: '+e(err.message)+'</p>';status?.(err.message,true)}}
 }
 async function act(data,msg,{reloadAgenda=true}={}){
  if(busy||ro()||!meeting)return;busy=true;
  for(const b of root.querySelectorAll('button'))b.disabled=true;
  try{
   const r=await api('/api/committee/meetings/'+meeting.id,{method:'POST',data:{...data,version:meeting.version}});
   const keep=reloadAgenda?null:items;
   await loadList();await loadMeeting(meeting.id);if(keep){items=keep;dirty=true}
   render();say(typeof msg==='function'?msg(r):msg);
  }catch(err){render();say(err.message,true);if(/changed|reload/i.test(err.message)){await refresh();say('Someone else changed this meeting. It has been reloaded.',true)}}
  finally{busy=false}
 }
 const cleanItems=()=>items.map(x=>({...x,title:x.title.trim(),actions:(x.actions||[]).filter(a=>a.text.trim())})).filter(x=>x.title);
 function ics(){
  const f=meeting.fields,d=(f.date||'').replace(/-/g,''),t=s=>(s||'').replace(':','')+'00';
  if(!d){say('Set a date first.',true);return}
  const start=f.startTime?'DTSTART;TZID=Australia/Brisbane:'+d+'T'+t(f.startTime):'DTSTART;VALUE=DATE:'+d;
  const end=f.startTime?(f.endTime?'DTEND;TZID=Australia/Brisbane:'+d+'T'+t(f.endTime):'DURATION:PT1H'):'';
  const clean=s=>String(s||'').replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
  const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports//Committee//EN','BEGIN:VTIMEZONE','TZID:Australia/Brisbane','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+1000','TZOFFSETTO:+1000','TZNAME:AEST','END:STANDARD','END:VTIMEZONE',
   'BEGIN:VEVENT','UID:'+meeting.id+'@sandy-sports','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z',start,end,'SUMMARY:'+clean(meeting.title),'LOCATION:'+clean(f.location),
   'DESCRIPTION:'+clean(items.map((x,i)=>(i+1)+'. '+x.title).join('\n')),'END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
  download(body,'text/calendar',meeting.title+'.ics');say('Calendar file saved. Open it to add the meeting to your calendar.');
 }
 function download(text,type,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name.replace(/[^\w .-]+/g,'').trim()||'meeting';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
 function printAgenda(){
  const f=meeting.fields,w=window.open('','_blank');if(!w){say('Allow pop-ups to print the agenda.',true);return}
  w.document.write('<!doctype html><title>'+e(meeting.title)+'</title><style>body{font:12pt Arial,sans-serif;margin:18mm}h1{font-size:18pt;margin:0}li{margin:.6em 0}small{color:#555}</style><h1>'+e(meeting.title)+'</h1><p>'+e(f.meetingType)+' · '+e(longDate(f.date))+(f.startTime?' · '+e(f.startTime):'')+(f.location?' · '+e(f.location):'')+'</p><h2>Agenda</h2><ol>'+
   items.map(x=>'<li><strong>'+e(x.title)+'</strong>'+(x.presenter?' <small>('+e(x.presenter)+')</small>':'')+(x.kind==='motion'?'<br>Motion: '+e(x.motion):'')+'</li>').join('')+'</ol><p><small>Sandy Sports Club (proposed)</small></p>');
  w.document.close();w.focus();w.print();
 }
 // Keep the in-memory agenda in step with what is typed, so saving never loses edits.
 root.addEventListener('input',ev=>{
  const el=ev.target,box=el.closest('[data-index]');if(!box||!items[box.dataset.index])return;
  const item=items[box.dataset.index];dirty=true;
  if(el.dataset.f==='title')item.title=el.value;
  if(el.dataset.f==='presenter')item.presenter=el.value;
  if(el.dataset.f==='motionText')item.motion=el.value;
  if(el.dataset.f==='proposer')item.proposer=el.value;
  if(el.dataset.f==='seconder')item.seconder=el.value;
  if(el.dataset.f==='notes')item.notes=el.value;
  const job=el.closest('[data-job]');if(job&&el.dataset.j)item.actions[job.dataset.job][el.dataset.j]=el.value;
 });
 root.addEventListener('change',ev=>{
  const el=ev.target,box=el.closest('[data-index]');
  if(box&&el.dataset.f==='motion'){items[box.dataset.index].kind=el.checked?'motion':'item';dirty=true;render()}
  else if(box&&el.dataset.j==='office'){items[box.dataset.index].actions[el.closest('[data-job]').dataset.job].office=el.value;dirty=true}
 });
 root.addEventListener('submit',async ev=>{
  ev.preventDefault();const form=ev.target,v=Object.fromEntries(new FormData(form));if(ro())return;
  if(form.matches('[data-mt-new]')){
   if(busy)return;busy=true;form.querySelector('[type=submit]').disabled=true;
   try{
    const r=await api('/api/suite/meetings',{method:'POST',data:{title:v.title.trim(),fields:{meetingType:v.meetingType,date:v.date,startTime:v.startTime,endTime:v.endTime,location:v.location.trim()}}});
    step='agenda';busy=false;await refresh(r.id);say('Meeting created. Now add the agenda.');root.querySelector('.mt-head h4')?.focus();
   }catch(err){busy=false;form.querySelector('[type=submit]').disabled=false;say(err.message,true)}
   return;
  }
  if(form.matches('[data-mt-attendance]'))return act({action:'attendance',present:lines(v.present),apologies:lines(v.apologies),quorumRequired:v.quorumRequired===''?null:Number(v.quorumRequired)},'Attendance saved.',{reloadAgenda:!dirty});
  if(form.matches('[data-mt-outcome]')){
   const votes=['for','against','abstain'].some(k=>v[k]!=='')?{for:Number(v.for||0),against:Number(v.against||0),abstain:Number(v.abstain||0)}:null;
   return act({action:'outcome',itemId:form.dataset.mtOutcome,outcome:v.outcome,votes},'Outcome recorded.',{reloadAgenda:!dirty});
  }
  if(form.matches('[data-mt-minutes]'))return act({action:'minutes',text:v.text},'Draft minutes saved.');
  if(form.matches('[data-mt-archive]'))return act({action:'archive',video:v.video,audio:v.audio,transcript:v.transcript},'Saved to the meeting archive.');
  if(form.matches('[data-mt-schedule]'))return act({action:'schedule',date:v.date,startTime:v.startTime,endTime:v.endTime,location:v.location,reason:v.reason},r=>r.unchanged?'Nothing changed.':'New time saved.');
  if(form.matches('[data-mt-cancel]')){if(!confirm('Cancel “'+meeting.title+'”? It stays on record as cancelled.'))return;return act({action:'cancel',reason:v.reason},'Meeting cancelled.')}
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-mt-refresh')){await refresh();say('Up to date.');return}
  if(b.dataset.mtOpen){if(dirty&&!confirm('You have unsaved changes to this meeting. Leave them?'))return;step='agenda';await refresh(b.dataset.mtOpen);root.querySelector('.mt-head h4')?.focus();if(matchMedia('(max-width:820px)').matches)root.querySelector('.mt-detail')?.scrollIntoView({block:'start'});return}
  if(b.dataset.mtStep){step=b.dataset.mtStep;render();return}
  if(b.hasAttribute('data-mt-todos')){await showDesk('todos');return}
  if(b.hasAttribute('data-mt-ics')){ics();return}
  if(b.hasAttribute('data-mt-print')){printAgenda();return}
  if(b.hasAttribute('data-mt-download')){const t=root.querySelector('[data-mt-minutes] textarea')?.value||'';download(t,'text/plain',meeting.title+' minutes.txt');return}
  if(b.hasAttribute('data-mt-add')){items.push({id:tempId(),title:'',kind:'item',presenter:'',motion:'',proposer:'',seconder:'',notes:'',actions:[]});dirty=true;render();root.querySelector('.mt-items li:last-child [data-f=title]')?.focus();return}
  if(b.hasAttribute('data-mt-standard')){items=STANDARD.map(t=>({id:tempId(),title:t,kind:'item',presenter:'',motion:'',proposer:'',seconder:'',notes:'',actions:[]}));dirty=true;render();say('Standard agenda added. Change anything, then Save agenda.');return}
  if(b.hasAttribute('data-mt-save-agenda')){
   const clean=cleanItems();if(items.some(x=>!x.title.trim())&&!confirm('Items without a title will be dropped. Save anyway?'))return;
   items=clean;
   return act({action:'agenda',items},step==='day'?'Notes and jobs saved.':'Agenda saved.');
  }
  if(b.hasAttribute('data-mt-rebuild')){if(meeting.minutes&&!confirm('Replace the draft minutes with a fresh copy from the agenda?'))return;return act({action:'minutes'},'Draft minutes rebuilt from the agenda.',{reloadAgenda:!dirty})}
  if(b.hasAttribute('data-mt-send-jobs'))return act({action:'actions'},r=>r.created?r.created+' job'+(r.created===1?'':'s')+' added to to-do lists.':'Those jobs are already on the to-do lists.',{reloadAgenda:!dirty});
  const box=b.closest('[data-index]');if(!box)return;const i=Number(box.dataset.index);
  if(b.dataset.mtMove){const j=i+Number(b.dataset.mtMove);[items[i],items[j]]=[items[j],items[i]];dirty=true;render();root.querySelector('[data-index="'+j+'"] [data-mt-move="'+b.dataset.mtMove+'"]')?.focus();return}
  if(b.hasAttribute('data-mt-remove')){if(items[i].title&&!confirm('Remove “'+items[i].title+'” from the agenda?'))return;items.splice(i,1);dirty=true;render();return}
  if(b.hasAttribute('data-mt-add-job')){(items[i].actions||=[]).push({text:'',office:'',due:''});dirty=true;render();root.querySelector('[data-index="'+i+'"] .mt-job:last-child input')?.focus();return}
  if(b.hasAttribute('data-mt-drop-job')){items[i].actions.splice(Number(b.closest('[data-job]').dataset.job),1);dirty=true;render();return}
 });
 window.addEventListener('beforeunload',ev=>{if(open&&dirty){ev.preventDefault();ev.returnValue=''}});
 return {
  async open(){open=true;root.hidden=false;root.textContent='Loading meetings…';await refresh(meeting?.id);
   if(!meeting){const today=new Date(Date.now()+36e6).toISOString().slice(0,10),next=list.filter(m=>m.status!=='cancelled'&&m.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];if(next)await refresh(next.id)}
   root.querySelector('#mt-desk-title')?.focus({preventScroll:true})},
  close(){open=false;epoch++;root.hidden=true}
 };
}
