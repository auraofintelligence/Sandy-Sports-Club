// AGM jobs desk (PLFC pattern): pick the AGM date and the jobs leading up to it are laid out
// on the officers' to-do lists with due dates counted back from the meeting. Changing the date
// moves every unfinished job. Deadlines are planning defaults until the constitution is adopted.
import {isReadOnlyView} from './club-view-client.js';
import {AGM_JOBS} from './studio/sandy-agm-jobs.js';
const OFFICES={webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee officer'};
const longDate=d=>d?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00')):'No date';
const plus=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const todayBris=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const daysBetween=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
const when=n=>n===0?'on the day':n<0?(-n)+' days before':n+' days after';

export function setupAgmDesk({api,esc:e,status,showDesk}){
 const root=document.getElementById('committee-agm');
 if(!root)return {open(){},close(){}};
 let agms=[],current=null,tasks=[],busy=false,epoch=0;
 const ro=()=>isReadOnlyView();
 const say=(msg,bad=false)=>{const n=root.querySelector('[data-agm-message]');if(n){n.textContent=msg;n.classList.toggle('bad',bad)}if(bad)status?.(msg,true)};
 function jobRows(){
  const date=current.fields.agmDate,today=todayBris();
  return AGM_JOBS.map(job=>{
   const due=plus(date,job.offset),task=tasks.find(t=>t.source==='agm'&&t.sourceId===current.id&&t.agmJob===job.key);
   const state=!task?'none':task.done?'done':due<today?'overdue':daysBetween(today,due)<=7?'soon':'ok';
   return {job,due,task,state};
  });
 }
 function listView(){
  return '<details class="ops-compose"'+(agms.length?'':' open')+'><summary>Prepare an AGM</summary><form data-agm-new><fieldset'+(ro()?' disabled':'')+'>'+
   '<div class="ops-form-grid"><label>AGM date<input type="date" name="agmDate" required></label><label>Venue<input name="venue" maxlength="300" placeholder="e.g. Dunwich hall"></label></div>'+
   '<label class="ops-check"><input type="checkbox" name="meeting" checked> Also add it to Meetings and minutes for the agenda</label>'+
   '<button type="submit">Lay out the AGM jobs</button></fieldset></form></details>'+
   (agms.length?'<ul class="mt-list">'+agms.map(a=>'<li><button type="button" data-agm-open="'+e(a.id)+'" aria-current="'+(current?.id===a.id)+'"><strong>'+e(a.title)+'</strong><span>'+e(longDate(a.fields.agmDate))+(a.fields.venue?' · '+e(a.fields.venue):'')+'</span></button></li>').join('')+'</ul>':'<p class="ops-empty">No AGM planned yet.</p>');
 }
 function detailView(){
  if(!current)return '<p class="ops-empty">'+(agms.length?'Choose an AGM.':'Pick a date to see the jobs leading up to it.')+'</p>';
  const f=current.fields,away=f.agmDate?daysBetween(todayBris(),f.agmDate):null,rows=f.agmDate?jobRows():[],missing=rows.filter(r=>!r.task).length,done=rows.filter(r=>r.state==='done').length;
  const pill={none:'<span class="ops-pill ops-muted">Not on a list yet</span>',done:'<span class="ops-pill ops-green">Done</span>',overdue:'<span class="ops-pill ops-red">Overdue</span>',soon:'<span class="ops-pill ops-amber">Due soon</span>',ok:'<span class="ops-pill ops-green">On the to-do list</span>'};
  return '<header class="mt-head"><div><h4 tabindex="-1">'+e(current.title)+'</h4><p>'+e(longDate(f.agmDate))+(f.venue?' · '+e(f.venue):'')+(away!==null?' · '+(away>0?away+' days to go':away===0?'today':(-away)+' days ago'):'')+'</p></div>'+
   (rows.length?'<span class="ops-pill '+(done===rows.length?'ops-green':'ops-amber')+'">'+done+' of '+rows.length+' done</span>':'')+'</header>'+
   '<details class="ops-compose mt-change"><summary>Change the date or venue</summary><form data-agm-edit><fieldset'+(ro()?' disabled':'')+'><div class="ops-form-grid"><label>AGM date<input type="date" name="agmDate" value="'+e(f.agmDate)+'" required></label><label>Venue<input name="venue" value="'+e(f.venue)+'" maxlength="300"></label></div><small>Unfinished jobs move with the new date. Finished jobs stay as they are.</small><button type="submit">Save and move the jobs</button></fieldset></form></details>'+
   '<p class="mt-help">Each job lands on that officer’s to-do list. Days are counted from the AGM date. These are planning defaults: check every deadline against the adopted constitution and Queensland rules for incorporated associations.</p>'+
   (missing?'<div class="ops-actions"><button type="button" class="mt-primary" data-agm-jobs'+(ro()?' disabled':'')+'>Put '+missing+' job'+(missing===1?'':'s')+' on the to-do lists</button></div>':'')+
   '<ol class="agm-jobs">'+rows.map(r=>'<li class="agm-job agm-'+r.state+'"><div class="agm-when"><strong>'+e(longDate(r.due))+'</strong><span>'+e(when(r.job.offset))+'</span></div>'+
    '<div class="agm-what"><strong>'+e(r.job.title)+'</strong><span>'+e(OFFICES[r.task?.office||r.job.office]||'Not allocated')+'</span></div><div class="agm-state">'+pill[r.state]+
    (r.task&&!r.task.done&&(r.task.canComplete||r.task.canPaper)?'<button type="button" data-agm-done="'+e(r.task.id)+'"'+(ro()?' disabled':'')+'>Mark done</button>':'')+'</div></li>').join('')+'</ol>'+
   '<div class="ops-actions"><button type="button" data-agm-todos>Officer to-do lists</button><button type="button" data-agm-meetings>Meetings and minutes</button><button type="button" data-agm-ics>Add the deadlines to my calendar</button></div>';
 }
 function render(){
  root.innerHTML='<header class="ops-header"><div><h3 id="agm-desk-title" tabindex="-1">AGM jobs</h3><p>Pick the AGM date and the jobs leading up to it go onto each officer’s to-do list, with due dates counted back from the meeting.</p></div><button type="button" data-agm-refresh>Check now</button></header>'+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+'<p data-agm-message role="status"></p>'+
   '<div class="mt-layout"><aside class="mt-aside">'+listView()+'</aside><section class="mt-detail">'+detailView()+'</section></div>';
 }
 async function refresh(id=current?.id){
  const my=++epoch;
  try{
   const [a,t]=await Promise.all([api('/api/suite/agm'),api('/api/committee/todos').catch(()=>({tasks:[]}))]);
   if(my!==epoch)return;
   agms=(a.records||[]).filter(r=>r.status!=='archived').sort((x,y)=>String(y.fields.agmDate).localeCompare(String(x.fields.agmDate)));tasks=t.tasks||[];
   current=agms.find(x=>x.id===id)||agms.find(x=>x.fields.agmDate>=todayBris())||agms[0]||null;render();
  }catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load AGM jobs: '+e(err.message)+'</p>';status?.(err.message,true)}}
 }
 async function guarded(fn){if(busy||ro())return;busy=true;for(const b of root.querySelectorAll('button'))b.disabled=true;try{await fn()}catch(err){await refresh();say(err.message,true)}finally{busy=false}}
 const layJobs=async id=>{const rec=(await api('/api/suite/agm/'+id)).record;return api('/api/committee/agm/'+id+'/jobs',{method:'POST',data:{version:rec.version}})};
 function ics(){
  const f=current.fields,x=s=>String(s||'').replace(/[\\;,]/g,m=>'\\'+m),d=s=>s.replaceAll('-',''),stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const ev=(uid,date,title)=>['BEGIN:VEVENT','UID:'+uid+'@sandy-sports-club','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+d(date),'DTEND;VALUE=DATE:'+d(plus(date,1)),'SUMMARY:'+x(title),'END:VEVENT'];
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//AGM//EN',...ev('agm-'+current.id,f.agmDate,'Sandy Sports AGM'+(f.venue?' ('+f.venue+')':'')),...jobRows().filter(r=>r.state!=='done').flatMap(r=>ev('agm-'+current.id+'-'+r.job.key,r.due,'AGM job: '+r.job.title)),'END:VCALENDAR'];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/calendar'}));a.download='Sandy Sports AGM jobs.ics';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  say('Calendar file saved. Open it to add the AGM and its deadlines to your calendar.');
 }
 root.addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.target,v=Object.fromEntries(new FormData(form));
  if(form.matches('[data-agm-new]'))return guarded(async()=>{
   const year=v.agmDate.slice(0,4),title='Annual general meeting '+year;
   const made=await api('/api/suite/agm',{method:'POST',data:{title,fields:{agmDate:v.agmDate,venue:v.venue.trim()}}});
   const r=await layJobs(made.id);
   if(form.elements.meeting.checked)await api('/api/suite/meetings',{method:'POST',data:{title:'Sandy Sports '+title,fields:{meetingType:'Annual general meeting',date:v.agmDate,location:v.venue.trim()}}});
   await refresh(made.id);say(r.created+' jobs put on the officers’ to-do lists.'+(form.elements.meeting.checked?' The AGM is also in Meetings and minutes.':''));
  });
  if(form.matches('[data-agm-edit]'))return guarded(async()=>{
   await api('/api/suite/agm/'+current.id,{method:'PATCH',data:{version:current.version,title:current.title.replace(/^(Annual general meeting )\d{4}$/,'$1'+v.agmDate.slice(0,4)),status:current.status,fields:{...current.fields,agmDate:v.agmDate,venue:v.venue.trim()}}});
   const r=await layJobs(current.id);await refresh(current.id);say('Saved. '+(r.rescheduled?r.rescheduled+' unfinished job'+(r.rescheduled===1?'':'s')+' moved to the new dates.':'No jobs needed moving.'));
  });
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-agm-refresh')){await refresh();say('Up to date.');return}
  if(b.dataset.agmOpen){await refresh(b.dataset.agmOpen);root.querySelector('.mt-head h4')?.focus();return}
  if(b.hasAttribute('data-agm-todos')){await showDesk('todos');return}
  if(b.hasAttribute('data-agm-meetings')){await showDesk('meetings');return}
  if(b.hasAttribute('data-agm-ics')){ics();return}
  if(b.hasAttribute('data-agm-jobs'))return guarded(async()=>{const r=await layJobs(current.id);await refresh(current.id);say(r.created?r.created+' job'+(r.created===1?'':'s')+' put on the to-do lists.':'Every job is already on a list.')});
  if(b.dataset.agmDone)return guarded(async()=>{const t=tasks.find(x=>x.id===b.dataset.agmDone);await api('/api/committee/todos',{method:'POST',data:{action:'complete',id:t.id,version:t.version,paper:!t.canComplete}});await refresh(current.id);say('Marked done.')});
 });
 return {
  async open(){root.hidden=false;root.textContent='Loading AGM jobs…';await refresh();root.querySelector('#agm-desk-title')?.focus({preventScroll:true})},
  close(){epoch++;root.hidden=true}
 };
}
