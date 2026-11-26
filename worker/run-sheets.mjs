// Event run sheets (EVT-01, EVT-02): jobs and shifts for one event, stored as linked
// records on the existing Volunteers desk so the work area shows the same data.
// Officers take or are assigned shifts within a fixed capacity; claims are rechecked on
// the latest record so two helpers cannot overbook one shift. The printable roster shows
// office labels only, never emails, phones or usernames. Nothing is sent to anyone.
import {fail,json,now,dbFor,payload,field,dateField,version,requireRole,revision,audit,STAFF} from './shared.mjs';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {suiteBody,suiteAllowed,visibleRecords,taskAllocators} from './record-policy.mjs';
import {stableId,writeRecord,commit} from './meetings.mjs';
const events=SUITE_BY_KEY.events,vols=SUITE_BY_KEY.volunteers,todos=SUITE_BY_KEY.todos;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const time=v=>{const s=field(v,5);if(s&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))fail(400,'Use a 24-hour Brisbane time.','invalid_time');return s};
const managers=['webmaster','president','vice_president',...taskAllocators];
const canManage=(actor,event)=>managers.includes(actor.role)||event.created_by===actor.id;
const label=a=>a.office_label||a.role;
const opsOf=b=>({capacity:1,office:'',claims:[],completed:null,...b.runSheet});
async function loadEvent(db,eventId,actor){
 if(!uuid.test(eventId||''))fail(404,'That event identifier is invalid.','record_not_found');
 const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(eventId).first(),body=suiteBody(row,events);
 if(!body||!suiteAllowed(row,events,actor))fail(404,'That event is not in this working area.','record_not_found');
 return {row,body};
}
async function jobsFor(db,eventId,actor){
 return visibleRecords(db,"WHERE kind='volunteer' AND json_extract(body_json,'$.domain')='volunteers' AND json_extract(body_json,'$.runSheet.eventId')=?",[eventId],"json_extract(body_json,'$.fields.start'),created_utc,id",80,r=>suiteAllowed(r,vols,actor));
}
async function loadJob(db,eventId,jobId,actor){
 if(!uuid.test(jobId||''))fail(404,'That run-sheet job does not exist.','job_not_found');
 const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(jobId).first(),body=suiteBody(row,vols);
 if(!body||!body.runSheet||body.runSheet.eventId!==eventId||!suiteAllowed(row,vols,actor))fail(404,'That run-sheet job does not exist.','job_not_found');
 return {row,body};
}
function jobInput(j,claims=0){
 if(!j||typeof j!=='object')fail(400,'Describe the job.','invalid_job');
 const title=field(j.title,160);if(!title)fail(400,'Name the job or role.','job_title_required');
 const start=time(j.start),finish=time(j.finish);
 if(start&&finish&&finish<=start)fail(400,'The shift must finish after it starts.','invalid_shift');
 const capacity=Number(j.capacity??1);
 if(!Number.isInteger(capacity)||capacity<1||capacity>50)fail(400,'Capacity must be between 1 and 50 helpers.','invalid_capacity');
 if(capacity<claims)fail(409,'Capacity cannot drop below the helpers already rostered.','capacity_below_claims');
 const office=field(j.office,30);if(office&&!STAFF.includes(office))fail(400,'Choose a valid responsible office.','invalid_office');
 return {title,start,finish,capacity,office,notes:field(j.notes,1000)};
}
function jobFields(event,eventBody,j,ops){
 return {event:event.title,role:j.title,person:ops.claims.map(c=>c.label).join(', '),date:eventBody.fields.eventDate||'',start:j.start,finish:j.finish,training:'',consent:ops.claims.length>0&&ops.claims.every(c=>c.consent===true),followUp:j.notes};
}
async function taskState(db,jobId,claim){
 const tid=await stableId('runsheet/'+jobId+'/'+claim.accountId),t=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(tid).first(),tb=t?suiteBody(t,todos):null;
 return {taskId:tid,exists:Boolean(tb),complete:Boolean(tb&&(t.status==='completed'||tb.fields.complete===true))};
}
async function jobView(db,row,actor){
 const b=JSON.parse(row.body_json),o=opsOf(b),claims=[];
 for(const c of o.claims)claims.push({label:c.label,mine:c.accountId===actor.id,consent:c.consent===true,at:c.at,task:await taskState(db,row.id,c)});
 const allTasksDone=claims.length>0&&claims.every(c=>c.task.complete);
 return {id:row.id,version:row.version,title:b.fields.role,start:b.fields.start,finish:b.fields.finish,date:b.fields.date,notes:b.fields.followUp,
  capacity:o.capacity,office:o.office,filled:claims.length,open:o.capacity-claims.length,claims,mine:claims.some(c=>c.mine),
  completed:o.completed||(allTasksDone?{by:'Helper tasks',at:null,fromTasks:true}:null)};
}
async function sheet(db,actor,event,eventBody){
 const rows=await jobsFor(db,event.id,actor),jobs=[];for(const r of rows)jobs.push(await jobView(db,r,actor));
 const date=eventBody.fields.eventDate||'';
 return {event:{id:event.id,title:event.title,date,startTime:eventBody.fields.startTime||'',endTime:eventBody.fields.endTime||'',site:eventBody.fields.site||'',status:event.status,cancelled:event.status==='archived',version:event.version},
  jobs,outOfDate:jobs.filter(j=>j.date!==date).map(j=>j.id),canManage:canManage(actor,event),
  totals:{jobs:jobs.length,capacity:jobs.reduce((n,j)=>n+j.capacity,0),filled:jobs.reduce((n,j)=>n+j.filled,0),completed:jobs.filter(j=>j.completed).length},
  notice:'Run sheets are in-app only. No helper is messaged.'};
}
export function printable(s){
 const e=s.event,lines=['RUN SHEET (working copy)','Sandy Sports Club (proposed)',e.title,'Date: '+(e.date||'not set')+(e.startTime?' '+e.startTime:'')+(e.endTime?' to '+e.endTime:'')+' (Brisbane)','Site: '+(e.site||'not recorded'),...(e.cancelled?['STATUS: CANCELLED']:[]),''];
 for(const j of s.jobs)lines.push((j.start||'--:--')+'-'+(j.finish||'--:--')+'  '+j.title+'  ['+j.filled+'/'+j.capacity+']'+(j.completed?'  DONE':''),'   Helpers: '+(j.claims.map(c=>c.label).join(', ')||'unfilled')+(j.office?'  Lead office: '+j.office:''),...(j.notes?['   Notes: '+j.notes]:[]));
 lines.push('','Office labels only. Contact details stay in the private people register.');
 return lines.join('\n');
}
// Claims re-read the latest job so a stale screen cannot overbook a shift.
async function changeClaims(db,actor,eventId,jobId,apply,attempts=4){
 for(let i=0;i<attempts;i++){
  const {row,body}=await loadJob(db,eventId,jobId,actor),o=opsOf(body);
  const next=apply(o);if(!next)return {version:row.version,unchanged:true};
  const {op,...change}=next,ops={...o,...change};
  const ev=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(eventId).first(),eb=JSON.parse(ev.body_json);
  const f=jobFields(ev,eb,{title:body.fields.role,start:body.fields.start,finish:body.fields.finish,notes:body.fields.followUp},ops);
  const w=writeRecord(db,actor,row,{...body,fields:f,runSheet:ops},op,{changes:{helpers:ops.claims.length}});
  const out=await db.batch(w.statements);if(out[0].meta.changes)return {version:w.next};
 }
 fail(409,'Several people changed this shift at once. Reload and try again.','conflict');
}
async function action(req,db,actor,event,eventBody){
 const b=await payload(req,20000);
 const cancelled=event.status==='archived';
 if(b.action==='add'){
  if(!canManage(actor,event))fail(403,'Only the event lead or an allocating officer can change the run sheet.','forbidden');
  if(cancelled)fail(409,'This event is cancelled.','event_cancelled');
  const j=jobInput(b.job),request=uuid.test(b.requestId||'')?b.requestId:crypto.randomUUID();
  const jobId=await stableId('runsheet/'+event.id+'/'+request),at=now(),ops={capacity:j.capacity,office:j.office,eventId:event.id,claims:[],completed:null};
  const body={sandySuiteVersion:1,domain:'volunteers',fields:jobFields(event,eventBody,j,ops),runSheet:ops};
  const out=await db.batch([
   db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'volunteer',?,?,'draft',?,1,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(jobId,j.title+' ('+event.title+')',JSON.stringify(body),eventBody.fields.eventDate||null,actor.id,actor.id,at,at),
   revision(db,{kind:'record',resourceId:jobId,resourceVersion:1,action:'run_sheet_job_created',actor,at,snapshot:body,changes:{eventId:event.id,fromVersion:0,toVersion:1},guarded:true}),
   audit(db,actor,'run_sheet_job_created','record',jobId,at,true,{fromVersion:0,toVersion:1})]);
  return json({ok:true,id:jobId,created:Boolean(out[0].meta.changes)},out[0].meta.changes?201:200);
 }
 if(b.action==='sync'){
  // Event date changes flow to every linked job without retyping.
  if(!canManage(actor,event))fail(403,'Only the event lead or an allocating officer can change the run sheet.','forbidden');
  let updated=0;
  for(const r of await jobsFor(db,event.id,actor)){
   const jb=JSON.parse(r.body_json),o=opsOf(jb),f=jobFields(event,eventBody,{title:jb.fields.role,start:jb.fields.start,finish:jb.fields.finish,notes:jb.fields.followUp},o);
   if(f.date===jb.fields.date&&f.event===jb.fields.event)continue;
   const w=writeRecord(db,actor,r,{...jb,fields:f},'run_sheet_job_synced',{eventDate:f.date||null,changes:{from:jb.fields.date,to:f.date}});
   const out=await db.batch(w.statements);updated+=Number(out[0].meta.changes||0);
  }
  return json({ok:true,updated});
 }
 const {row,body}=await loadJob(db,event.id,b.jobId,actor),o=opsOf(body);
 if(b.action==='edit'){
  if(!canManage(actor,event))fail(403,'Only the event lead or an allocating officer can change the run sheet.','forbidden');
  if(row.version!==version(b.version))fail(409,'This job changed. Reload before saving.','conflict');
  const j=jobInput(b.job,o.claims.length),ops={...o,capacity:j.capacity,office:j.office};
  const w=writeRecord(db,actor,row,{...body,fields:jobFields(event,eventBody,j,ops),runSheet:ops},'run_sheet_job_edited',{title:j.title+' ('+event.title+')'});
  await commit(db,w,'This job changed. Reload before saving.');return json({ok:true,version:w.next});
 }
 if(b.action==='claim'||b.action==='assign'){
  if(cancelled)fail(409,'This event is cancelled.','event_cancelled');
  let who=actor;
  if(b.action==='assign'){
   if(!canManage(actor,event))fail(403,'Only the event lead or an allocating officer can assign helpers.','forbidden');
   const a=uuid.test(b.accountId||'')?await db.prepare("SELECT id,role,office_label FROM club_accounts WHERE id=? AND state='active'").bind(b.accountId).first():null;
   if(!a||!STAFF.includes(a.role))fail(404,'Assign an active officer account.','account_not_found');who=a;
  }else if(b.consent!==true)fail(400,'Confirm your office label may appear on the roster.','consent_required');
  const r=await changeClaims(db,actor,event.id,row.id,ops=>{
   if(ops.completed)fail(409,'This job is already complete.','job_complete');
   if(ops.claims.some(c=>c.accountId===who.id))return null;
   if(ops.claims.length>=ops.capacity)fail(409,'This shift is full.','shift_full');
   return {op:b.action==='claim'?'run_sheet_shift_claimed':'run_sheet_shift_assigned',claims:[...ops.claims,{accountId:who.id,label:label(who),role:who.role,consent:b.action==='claim',at:now(),by:actor.id}]};
  });
  return json({ok:true,...r});
 }
 if(b.action==='unclaim'){
  const target=b.accountId&&b.accountId!==actor.id?(canManage(actor,event)?b.accountId:fail(403,'Only the event lead or an allocating officer can remove another helper.','forbidden')):actor.id;
  const r=await changeClaims(db,actor,event.id,row.id,ops=>ops.claims.some(c=>c.accountId===target)?{op:'run_sheet_shift_released',claims:ops.claims.filter(c=>c.accountId!==target)}:null);
  return json({ok:true,...r});
 }
 if(b.action==='complete'){
  if(!(canManage(actor,event)||o.claims.some(c=>c.accountId===actor.id)))fail(403,'Only a rostered helper or the event lead can complete this job.','forbidden');
  if(row.version!==version(b.version))fail(409,'This job changed. Reload before saving.','conflict');
  if(o.completed)return json({ok:true,version:row.version,unchanged:true});
  const ops={...o,completed:{at:now(),by:label(actor),note:field(b.note,500)}};
  const w=writeRecord(db,actor,row,{...body,runSheet:ops},'run_sheet_job_completed');
  await commit(db,w,'This job changed. Reload before saving.');return json({ok:true,version:w.next});
 }
 if(b.action==='handoff'){
  // One personal task per rostered helper; repeats create nothing new.
  const at=now(),stmts=[];let n=0;
  for(const c of o.claims){
   const s=await taskState(db,row.id,c);if(s.exists)continue;
   const tb={sandySuiteVersion:1,domain:'todos',fields:{action:body.fields.role+' at '+event.title,owner:c.role,dueDate:body.fields.date||'',priority:'Normal',linkedDesk:event.id,progress:'Run-sheet shift '+(body.fields.start||'')+(body.fields.finish?'-'+body.fields.finish:''),complete:false},
    committeeOps:{version:1,kind:'task',office:c.role,noticeId:null,request:'runsheet:'+row.id+':'+c.accountId,claimedBy:c.accountId,sourceEvent:event.id,sourceJob:row.id}};
   stmts.push(db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'task',?,?,'draft',?,1,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(s.taskId,tb.fields.action,JSON.stringify(tb),body.fields.date||null,actor.id,actor.id,at,at),
    revision(db,{kind:'record',resourceId:s.taskId,resourceVersion:1,action:'run_sheet_task_created',actor,at,snapshot:tb,changes:{sourceJob:row.id,fromVersion:0,toVersion:1},guarded:true}),
    audit(db,actor,'run_sheet_task_created','record',s.taskId,at,true,{fromVersion:0,toVersion:1}));
  }
  if(stmts.length)n=(await db.batch(stmts)).filter((_,i)=>i%3===0).reduce((x,r)=>x+Number(r.meta.changes||0),0);
  return json({ok:true,created:n,notice:'Shift tasks are on each helper\'s own to-do list. No one was messaged.'});
 }
 fail(400,'Choose a supported run-sheet action.','invalid_action');
}
export async function runSheetEndpoint(req,env,path,actor){
 requireRole(actor,events.roles);
 const db=dbFor(env),m=path.match(/^\/api\/committee\/events\/([a-f0-9-]{36})\/run-sheet$/);
 if(!m)fail(404,'Unknown run-sheet service.','not_found');
 const {row,body}=await loadEvent(db,m[1],actor);
 if(req.method==='GET'){
  const s=await sheet(db,actor,row,body);
  if(new URL(req.url).searchParams.get('format')==='text')return new Response(printable(s),{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  return json(s);
 }
 if(req.method==='POST')return action(req,db,actor,row,body);
 fail(405,'Unsupported run-sheet operation.','method_not_allowed');
}
