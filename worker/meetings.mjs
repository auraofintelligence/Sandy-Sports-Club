// Meeting register, formal agenda, attendance, recorded outcomes, draft and approved
// minutes, member minutes editions, meeting actions, AGM preparation jobs and in-app
// reminders (GOV-05 to GOV-07, GOV-10 to GOV-12). Built on existing meeting and AGM
// desk records; structured state lives in a server-owned `meetingOps` object.
// Nothing here sends email or SMS, adopts rules, appoints anyone or releases minutes
// without the separate authority gate in worker/authority.mjs.
import {fail,json,now,id,dbFor,payload,field,dateField,version,requireRole,revision,audit} from './shared.mjs';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {AGM_JOBS,AGM_JOBS_STATUS} from '../studio/sandy-agm-jobs.js';
import {suiteBody,suiteAllowed,visibleRecords,purposeOf,releasedVersion} from './record-policy.mjs';
import {decideRecord} from './authority.mjs';
const meetings=SUITE_BY_KEY.meetings,agmDesk=SUITE_BY_KEY.agm,todos=SUITE_BY_KEY.todos;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const OFFICES=['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'];
const OUTCOMES=['carried','lost','deferred','withdrawn','noted'];
const time=v=>{const s=field(v,5);if(s&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))fail(400,'Use a 24-hour Brisbane time.','invalid_time');return s};
const brisbaneToday=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const plusDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
// Owner policy defaults: quorum is unset until the adopted constitution says otherwise.
export const quorumDefault=env=>{const n=Number(env.SANDY_MEETING_QUORUM);return Number.isInteger(n)&&n>0&&n<100?n:null};
export const reminderDays=env=>{const n=Number(env.SANDY_MEETING_REMINDER_DAYS);return Number.isInteger(n)&&n>=0&&n<=60?n:7};
export async function stableId(value){
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sandy-meetings-v1/'+value))).slice(0,16);
 b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
const opsOf=body=>({agenda:[],attendance:null,minutes:null,schedule:[],cancelled:null,archive:null,...(body.meetingOps||{})});
// Rule 4B: video, audio and transcript links for the meeting archive. Kept permanently: a link can be
// added or replaced (the old one stays in the archive's history) but never removed.
const ARCHIVE_PARTS=['video','audio','transcript'];
function httpsLink(v){const s=String(v||'').trim();if(!s)return '';try{const u=new URL(s);if(u.protocol!=='https:')throw 0;return u.href.slice(0,500)}catch{fail(400,'Archive links must start with https://.','invalid_archive_link')}}
export const archiveView=a=>a?{video:a.video||'',audio:a.audio||'',transcript:a.transcript||'',updatedAt:a.updatedAt||null,updatedBy:a.updatedBy||'',history:(a.history||[]).length}:null;
async function loadDeskRecord(db,desk,recordId,actor){
 if(!uuid.test(recordId||''))fail(404,'That record identifier is invalid.','record_not_found');
 const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(recordId).first();
 const body=suiteBody(row,desk);
 if(!body||!suiteAllowed(row,desk,actor))fail(404,'That record is not in this working area.','record_not_found');
 return {row,body};
}
export function writeRecord(db,actor,row,body,op,{status=row.status,eventDate=row.event_date,title=row.title,changes={},extra=[]}={}){
 const at=now(),next=row.version+1;
 return {at,next,statements:[
  db.prepare('UPDATE club_records SET title=?,body_json=?,status=?,event_date=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=?')
   .bind(title,JSON.stringify(body),status,eventDate,actor.id,at,row.id,row.version),
  revision(db,{kind:'record',resourceId:row.id,resourceVersion:next,action:op,actor,at,snapshot:{title,status,...body},changes:{...changes,fromVersion:row.version,toVersion:next},guarded:true}),
  audit(db,actor,op,'record',row.id,at,true,{fromVersion:row.version,toVersion:next}),...extra]};
}
export async function commit(db,w,message='This meeting changed. Reload before saving.'){
 const out=await db.batch(w.statements);
 if(!out[0].meta.changes)fail(409,message,'conflict');
 return out;
}
function cleanItems(input,previous){
 if(!Array.isArray(input)||input.length>40)fail(400,'Use up to 40 agenda items.','invalid_agenda');
 const seen=new Set(),known=new Map(previous.map(x=>[x.id,x]));
 return input.map((x,i)=>{
  if(!x||typeof x!=='object')fail(400,'Each agenda item needs a title.','invalid_agenda');
  const title=field(x.title,200);if(!title)fail(400,'Each agenda item needs a title.','invalid_agenda');
  let itemId=typeof x.id==='string'&&/^[a-z0-9-]{6,40}$/.test(x.id)?x.id:crypto.randomUUID().slice(0,13);
  if(seen.has(itemId))fail(400,'Agenda item identifiers must be unique.','invalid_agenda');seen.add(itemId);
  const kind=x.kind==='motion'?'motion':'item';
  const actions=Array.isArray(x.actions)?x.actions.slice(0,10).map(a=>{
   const office=field(a?.office,30);
   if(office&&!OFFICES.includes(office))fail(400,'Choose a valid office for each action.','invalid_office');
   const text=field(a?.text,250);if(!text)fail(400,'Each action needs a description.','invalid_action');
   return {text,office,due:a?.due?dateField(a.due):''};
  }):[];
  // A recorded outcome is preserved unless the motion wording itself changes.
  const old=known.get(itemId),motion=kind==='motion'?field(x.motion,2000):'';
  const outcome=old&&old.motion===motion&&old.kind===kind?old.outcome||null:null;
  return {id:itemId,order:i+1,title,kind,presenter:field(x.presenter,100),proposer:kind==='motion'?field(x.proposer,100):'',seconder:kind==='motion'?field(x.seconder,100):'',motion,notes:field(x.notes,2000),actions,outcome};
 });
}
export function generatedMinutes(row,body){
 const f=body.fields,o=opsOf(body),lines=['DRAFT MINUTES (committee draft, not approved)','Sandy Sports Club (proposed)',
  f.meetingType+': '+row.title,'Date: '+(f.date||'not set')+(f.startTime?' '+f.startTime:'')+(f.endTime?' to '+f.endTime:'')+' (Brisbane)','Location: '+(f.location||'not recorded'),''];
 if(o.cancelled)lines.push('This meeting was cancelled: '+o.cancelled.reason,'');
 const a=o.attendance;
 if(a){lines.push('Present: '+(a.present.join(', ')||'none recorded'),'Apologies: '+(a.apologies.join(', ')||'none'),
  'Quorum: '+(a.quorumRequired?a.present.length+' present of '+a.quorumRequired+' required, '+(a.quorumMet?'quorum met':'quorum NOT met'):'not set (owner to confirm from adopted rules)'),'')}
 for(const item of o.agenda){
  lines.push(item.order+'. '+item.title+(item.presenter?' ('+item.presenter+')':''));
  if(item.kind==='motion')lines.push('   Motion: '+(item.motion||'(wording not recorded)'),'   Moved: '+(item.proposer||'not recorded')+'  Seconded: '+(item.seconder||'not recorded'));
  if(item.outcome)lines.push('   Recorded outcome: '+item.outcome.outcome+(item.outcome.votes?' (for '+item.outcome.votes.for+', against '+item.outcome.votes.against+', abstain '+item.outcome.votes.abstain+')':'')+(item.outcome.note?'. '+item.outcome.note:''));
  if(item.notes)lines.push('   Notes: '+item.notes);
  for(const act of item.actions)lines.push('   Action: '+act.text+' | '+(act.office||'unallocated')+' | '+(act.due||'no date'));
 }
 return lines.join('\n');
}
async function actionTasks(db,row,body){
 const out=[];
 for(const item of opsOf(body).agenda)for(let i=0;i<item.actions.length;i++){
  const taskId=await stableId('meeting/'+row.id+'/'+item.id+'/'+i);
  const t=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(taskId).first();
  const tb=t?suiteBody(t,todos):null;
  out.push({itemId:item.id,index:i,taskId,text:item.actions[i].text,office:item.actions[i].office,due:item.actions[i].due,
   exists:Boolean(tb),complete:Boolean(tb&&(t.status==='completed'||tb.fields.complete===true))});
 }
 return out;
}
async function view(db,env,row,body,actor){
 const o=opsOf(body);
 const editions=await visibleRecords(db,"WHERE kind='governance' AND json_extract(body_json,'$.sandyMinutesEdition')=1 AND json_extract(body_json,'$.sourceMeeting')=?",[row.id],'updated_utc DESC,id DESC',10,r=>purposeOf(r)?.type==='minutes-edition'&&purposeOf(r).roles.includes(actor.role));
 return {id:row.id,title:row.title,status:row.status,version:row.version,fields:body.fields,
  formal:body.fields.meetingType!=='Informal discussion'&&body.fields.meetingType!=='Working group',
  cancelled:o.cancelled,schedule:o.schedule,attendance:o.attendance,agenda:o.agenda,minutes:o.minutes,archive:archiveView(o.archive),
  minutesApproved:row.status==='approved',generatedMinutes:generatedMinutes(row,body),actions:await actionTasks(db,row,body),
  quorumDefault:quorumDefault(env),
  memberEditions:editions.map(e=>{const b=JSON.parse(e.body_json);return {id:e.id,version:e.version,status:e.status,released:releasedVersion(e),sourceVersion:b.sourceVersion,text:b.text,updatedAt:e.updated_utc}})};
}
function people(list){return Array.isArray(list)?[...new Set(list.map(x=>field(x,100)).filter(Boolean))].slice(0,60):[]}
async function meetingAction(req,env,db,actor,row,body){
 const b=await payload(req,60000),expected=version(b.version);
 if(row.version!==expected)fail(409,'This meeting changed. Reload before saving.','conflict');
 const o=opsOf(body),fields={...body.fields};
 if(b.action==='archive'){
  if(o.cancelled)fail(409,'A cancelled meeting has no recording to archive.','meeting_cancelled');
  const old=o.archive||{},next={...old};let changed=false;const history=[...(old.history||[])];
  for(const part of ARCHIVE_PARTS){const link=httpsLink(b[part]);
   if(!link){if(b[part]!==undefined&&old[part])fail(400,'Archived recordings are kept permanently and cannot be removed (rule 4B). Replace the link instead.','archive_permanent');continue}
   if(link!==old[part]){if(old[part])history.push({part,link:old[part],replacedAt:now(),by:actor.office_label||actor.role});next[part]=link;changed=true}}
  if(!changed)return json({ok:true,version:row.version,unchanged:true});
  const archive={...next,history,updatedAt:now(),updatedBy:actor.office_label||actor.role};
  const w=writeRecord(db,actor,row,{...body,meetingOps:{...o,archive}},'meeting_archived',{changes:Object.fromEntries(ARCHIVE_PARTS.filter(k=>next[k]!==old[k]).map(k=>[k,next[k]]))});
  await commit(db,w);return json({ok:true,version:w.next,archive:archiveView(archive)});
 }
 const locked=row.status==='approved';
 if(locked&&b.action!=='actions')fail(409,'Approved minutes are locked. Return them for changes through a formal decision first.','locked');
 if(o.cancelled&&!['actions'].includes(b.action))fail(409,'This meeting is cancelled. Create a new meeting record instead.','meeting_cancelled');
 if(b.action==='schedule'){
  const date=dateField(b.date,false),startTime=time(b.startTime),endTime=time(b.endTime);
  if(startTime&&endTime&&endTime<=startTime)fail(400,'The meeting finish time must be after its start time.','invalid_meeting_time');
  const previous={date:fields.date,startTime:fields.startTime,endTime:fields.endTime,location:fields.location};
  Object.assign(fields,{date,startTime,endTime,location:field(b.location??fields.location,700)});
  const changed=JSON.stringify(previous)!==JSON.stringify({date,startTime,endTime,location:fields.location});
  if(!changed)return json({ok:true,version:row.version,unchanged:true});
  const schedule=[...o.schedule,{...previous,changedAt:now(),changedBy:actor.office_label||actor.role,reason:field(b.reason,300)}].slice(-30);
  const w=writeRecord(db,actor,row,{...body,fields,meetingOps:{...o,schedule}},'meeting_rescheduled',{eventDate:date,changes:{from:previous.date,to:date,reason:field(b.reason,300)||'Rescheduled'}});
  await commit(db,w);return json({ok:true,version:w.next,date});
 }
 if(b.action==='cancel'){
  const reason=field(b.reason,300);if(!reason)fail(400,'Record why the meeting is cancelled.','reason_required');
  const w=writeRecord(db,actor,row,{...body,meetingOps:{...o,cancelled:{reason,at:now(),by:actor.office_label||actor.role}}},'meeting_cancelled',{status:'archived',changes:{reason}});
  await commit(db,w);return json({ok:true,version:w.next,cancelled:true});
 }
 if(b.action==='attendance'){
  const present=people(b.present),apologies=people(b.apologies).filter(x=>!present.includes(x));
  let required=b.quorumRequired===undefined||b.quorumRequired===null||b.quorumRequired===''?quorumDefault(env):Number(b.quorumRequired);
  if(required!==null&&(!Number.isInteger(required)||required<1||required>99))fail(400,'Quorum must be a whole number of people.','invalid_quorum');
  const attendance={present,apologies,quorumRequired:required,quorumMet:required===null?null:present.length>=required,recordedBy:actor.office_label||actor.role};
  fields.attendees=[...present.map(p=>'Present: '+p),...apologies.map(p=>'Apology: '+p)].join('\n');
  fields.quorum=required===null?'Quorum not set':present.length+' present of '+required+' required';
  const w=writeRecord(db,actor,row,{...body,fields,meetingOps:{...o,attendance}},'meeting_attendance_recorded');
  await commit(db,w);return json({ok:true,version:w.next,attendance});
 }
 if(b.action==='agenda'){
  const agenda=cleanItems(b.items,o.agenda);
  fields.agenda=agenda.map(x=>x.order+'. '+x.title+(x.kind==='motion'?' (motion)':'')).join('\n');
  const w=writeRecord(db,actor,row,{...body,fields,meetingOps:{...o,agenda}},'meeting_agenda_saved',{changes:{items:agenda.length}});
  await commit(db,w);return json({ok:true,version:w.next,agenda});
 }
 if(b.action==='outcome'){
  const item=o.agenda.find(x=>x.id===b.itemId);if(!item)fail(404,'That agenda item does not exist.','item_not_found');
  const outcome=field(b.outcome,20);if(!OUTCOMES.includes(outcome))fail(400,'Choose carried, lost, deferred, withdrawn or noted.','invalid_outcome');
  let votes=null;
  if(b.votes!==undefined&&b.votes!==null){
   votes={};for(const k of ['for','against','abstain']){const n=Number(b.votes[k]??0);if(!Number.isInteger(n)||n<0||n>999)fail(400,'Votes must be whole numbers.','invalid_votes');votes[k]=n}
   if(outcome==='carried'&&votes.for<=votes.against)fail(400,'A carried motion needs more votes for than against.','inconsistent_votes');
   if(outcome==='lost'&&votes.for>votes.against)fail(400,'A lost motion cannot have more votes for than against.','inconsistent_votes');
  }
  const agenda=o.agenda.map(x=>x.id===item.id?{...x,outcome:{outcome,votes,note:field(b.note,1000),recordedBy:actor.office_label||actor.role,recordedAt:now()}}:x);
  fields.decisions=agenda.filter(x=>x.outcome).map(x=>x.order+'. '+x.title+': '+x.outcome.outcome).join('\n');
  const w=writeRecord(db,actor,row,{...body,fields,meetingOps:{...o,agenda}},'meeting_outcome_recorded',{changes:{itemId:item.id,outcome}});
  await commit(db,w);return json({ok:true,version:w.next,outcome});
 }
 if(b.action==='minutes'){
  const text=b.text===undefined?generatedMinutes(row,body):field(b.text,20000);
  if(!text)fail(400,'Enter the draft minutes.','minutes_required');
  fields.draftMinutes=text;
  const minutes={committeeDraft:text,draftedBy:actor.office_label||actor.role,draftedAt:now(),fromGenerated:b.text===undefined};
  const w=writeRecord(db,actor,row,{...body,fields,meetingOps:{...o,minutes}},'meeting_minutes_drafted');
  await commit(db,w);return json({ok:true,version:w.next,minutes});
 }
 if(b.action==='actions'){
  // Idempotent: each agenda action has a stable task ID; repeats create nothing new.
  const list=await actionTasks(db,row,body),at=now(),stmts=[];let created=0;
  for(const a of list){
   if(a.exists)continue;
   const item=o.agenda.find(x=>x.id===a.itemId);
   const tb={sandySuiteVersion:1,domain:'todos',sourceMeeting:row.id,fields:{action:a.text,owner:a.office?a.office:'',dueDate:a.due||'',priority:'Normal',linkedDesk:row.id,progress:'From meeting '+row.title+', item '+item.order+': '+item.title,complete:false},
    committeeOps:{version:1,kind:'task',office:a.office||'',noticeId:null,request:'meeting:'+row.id+':'+a.itemId+':'+a.index,claimedBy:null,sourceMeeting:row.id,sourceItem:a.itemId}};
   stmts.push(db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,'task',?,?,'draft',?,1,?,?,?,? WHERE EXISTS(SELECT 1 FROM club_records WHERE id=? AND version=?) ON CONFLICT(id) DO NOTHING")
     .bind(a.taskId,a.text,JSON.stringify(tb),a.due||null,actor.id,actor.id,at,at,row.id,row.version),
    revision(db,{kind:'record',resourceId:a.taskId,resourceVersion:1,action:'meeting_action_task_created',actor,at,snapshot:tb,changes:{sourceMeeting:row.id,sourceItem:a.itemId,fromVersion:0,toVersion:1},guarded:true}),
    audit(db,actor,'meeting_action_task_created','record',a.taskId,at,true,{fromVersion:0,toVersion:1}));
  }
  if(stmts.length){const out=await db.batch(stmts);created=out.filter((_,i)=>i%3===0).reduce((n,x)=>n+Number(x.meta.changes||0),0)}
  return json({ok:true,created,total:list.length,notice:'Tasks are on the officer to-do lists. No one was messaged.'});
 }
 fail(400,'Choose a supported meeting action.','invalid_action');
}
async function memberEdition(req,db,actor,row,body){
 const b=await payload(req,30000);
 const text=field(b.text,20000);if(!text)fail(400,'Enter the member edition text with personal details removed.','minutes_required');
 if(b.personalDetailsRemoved!==true)fail(400,'Confirm personal details were removed before preparing a member edition.','privacy_check_required');
 const existing=(await visibleRecords(db,"WHERE kind='governance' AND json_extract(body_json,'$.sandyMinutesEdition')=1 AND json_extract(body_json,'$.sourceMeeting')=?",[row.id],'updated_utc DESC,id DESC',1,r=>purposeOf(r)?.type==='minutes-edition'))[0];
 const at=now(),nb={sandyMinutesEdition:1,sourceMeeting:row.id,sourceVersion:row.version,text,personalDetailsRemoved:true};
 if(existing){
  if(version(b.version)!==existing.version)fail(409,'The member edition changed. Reload before saving.','conflict');
  if(existing.status==='approved')fail(409,'Return the approved member edition for changes first.','locked');
  const w=writeRecord(db,actor,existing,nb,'minutes_edition_saved',{status:'draft'});
  await commit(db,w,'The member edition changed. Reload before saving.');return json({ok:true,id:existing.id,version:w.next});
 }
 const editionId=id(),title='Member minutes: '+row.title;
 await db.batch([
  db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'governance',?,?,'draft',?,1,?,?,?,?)")
   .bind(editionId,title,JSON.stringify(nb),row.event_date,actor.id,actor.id,at,at),
  revision(db,{kind:'record',resourceId:editionId,resourceVersion:1,action:'minutes_edition_created',actor,at,snapshot:nb,changes:{sourceMeeting:row.id,fromVersion:0,toVersion:1}}),
  audit(db,actor,'minutes_edition_created','record',editionId,at,false,{fromVersion:0,toVersion:1})
 ]);
 return json({ok:true,id:editionId,version:1},201);
}
async function agmJobs(req,db,actor,row,body){
 const b=await payload(req,2000);if(version(b.version)!==row.version)fail(409,'The AGM record changed. Reload it.','conflict');
 const agmDate=body.fields.agmDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(agmDate||''))fail(400,'Set a proposed AGM date first.','agm_date_required');
 const at=now(),stmts=[];let created=0,moved=0;const kinds=[];
 for(const job of AGM_JOBS){
  const taskId=await stableId('agm/'+row.id+'/'+job.key),due=plusDays(agmDate,job.offset);
  const t=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(taskId).first(),tb=t?suiteBody(t,todos):null;
  if(!tb){
   const nb={sandySuiteVersion:1,domain:'todos',fields:{action:job.title,owner:job.office,dueDate:due,priority:'Normal',linkedDesk:row.id,progress:'AGM preparation ('+AGM_JOBS_STATUS+')',complete:false},
    committeeOps:{version:1,kind:'task',office:job.office,noticeId:null,request:'agm:'+row.id+':'+job.key,claimedBy:null,sourceAgm:row.id,agmJob:job.key,offset:job.offset}};
   stmts.push(db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'task',?,?,'draft',?,1,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(taskId,job.title,JSON.stringify(nb),due,actor.id,actor.id,at,at),
    revision(db,{kind:'record',resourceId:taskId,resourceVersion:1,action:'agm_job_created',actor,at,snapshot:nb,changes:{sourceAgm:row.id,job:job.key,fromVersion:0,toVersion:1},guarded:true}),
    audit(db,actor,'agm_job_created','record',taskId,at,true,{fromVersion:0,toVersion:1}));kinds.push('c');
  }else if(!(t.status==='completed'||tb.fields.complete===true)&&tb.fields.dueDate!==due){
   const nb={...tb,fields:{...tb.fields,dueDate:due}};
   const w=writeRecord(db,actor,t,nb,'agm_job_rescheduled',{eventDate:due,changes:{from:tb.fields.dueDate,to:due}});
   stmts.push(...w.statements);kinds.push('m');
  }
 }
 if(stmts.length){
  const out=await db.batch(stmts);let i=0;
  for(const k of kinds){if(out[i].meta.changes)k==='c'?created++:moved++;i+=3}
 }
 return json({ok:true,created,rescheduled:moved,total:AGM_JOBS.length,status:AGM_JOBS_STATUS,notice:'AGM jobs are on the officer to-do lists. Confirm every deadline against the adopted rules.'});
}
// Rule 4B: every member can watch and listen to the meeting archive.
export async function memberMeetingsEndpoint(req,env,actor){
 requireRole(actor,['member',...OFFICES]);if(req.method!=='GET')fail(405,'The archive is read only.','method_not_allowed');
 const db=dbFor(env);
 const {results=[]}=await db.prepare("SELECT id,title,event_date,status,body_json FROM club_records WHERE kind='meeting' AND json_extract(body_json,'$.sandySuiteVersion')=1 ORDER BY COALESCE(event_date,created_utc) DESC LIMIT 200").all();
 const out=[];
 for(const r of results){const b=JSON.parse(r.body_json),o=opsOf(b),t=b.fields?.meetingType||'';
  if(o.cancelled||['Informal discussion','Working group'].includes(t)||!o.archive)continue;
  out.push({id:r.id,title:r.title,date:r.event_date,type:t,minutesApproved:r.status==='approved',archive:archiveView(o.archive)});}
 return json({meetings:out});
}
export async function meetingsEndpoint(req,env,path,actor){
 const db=dbFor(env);
 if(path==='/api/committee/reminders'&&req.method==='GET'){
  requireRole(actor,OFFICES);
  const days=reminderDays(env),today=brisbaneToday(),until=plusDays(today,days);
  const rows=meetings.roles.includes(actor.role)?await visibleRecords(db,"WHERE kind='meeting' AND json_extract(body_json,'$.sandySuiteVersion')=1 AND event_date BETWEEN ? AND ?",[today,until],'event_date,id',50,r=>suiteAllowed(r,meetings,actor)):[];
  const reminders=rows.filter(r=>!JSON.parse(r.body_json).meetingOps?.cancelled).map(r=>{const f=JSON.parse(r.body_json).fields;
   return {key:r.id+'@'+r.event_date+'T'+(f.startTime||''),meetingId:r.id,title:r.title,date:r.event_date,startTime:f.startTime||'',location:f.location||'',daysAway:Math.round((Date.parse(r.event_date)-Date.parse(today))/864e5)}});
  return json({reminders,windowDays:days,delivery:'in-app only',notice:'Reminders are shown in the clubhouse only. No email or SMS is sent.'});
 }
 const edition=path.match(/^\/api\/committee\/minutes\/([a-f0-9-]{36})(?:\/(decision))?$/);
 if(edition){
  requireRole(actor,meetings.roles);
  const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(edition[1]).first();
  if(purposeOf(row)?.type!=='minutes-edition')fail(404,'That member minutes edition does not exist.','record_not_found');
  const b=JSON.parse(row.body_json);
  if(edition[2]==='decision'&&req.method==='POST')return decideRecord(req,env,db,actor,row,'minutes',{beforeRelease:async()=>{
   const m=await db.prepare('SELECT status FROM club_records WHERE id=?').bind(b.sourceMeeting).first();
   if(m?.status!=='approved')fail(409,'The committee minutes must be formally approved before a member edition is released.','minutes_not_approved');
  }});
  if(!edition[2]&&req.method==='GET')return json({edition:{id:row.id,version:row.version,status:row.status,released:releasedVersion(row),sourceMeeting:b.sourceMeeting,text:b.text}});
  fail(405,'Unsupported member minutes operation.','method_not_allowed');
 }
 const agm=path.match(/^\/api\/committee\/agm\/([a-f0-9-]{36})\/jobs$/);
 if(agm){
  requireRole(actor,agmDesk.roles);if(req.method!=='POST')fail(405,'Generate AGM jobs with POST.','method_not_allowed');
  const {row,body}=await loadDeskRecord(db,agmDesk,agm[1],actor);return agmJobs(req,db,actor,row,body);
 }
 requireRole(actor,meetings.roles);
 if(path==='/api/committee/meetings'&&req.method==='GET'){
  const rows=await visibleRecords(db,"WHERE kind='meeting' AND json_extract(body_json,'$.sandySuiteVersion')=1",[],'COALESCE(event_date,created_utc) DESC,id DESC',200,r=>suiteAllowed(r,meetings,actor));
  return json({meetings:rows.map(r=>{const b=JSON.parse(r.body_json),o=opsOf(b);return {id:r.id,title:r.title,date:r.event_date,status:o.cancelled?'cancelled':r.status,version:r.version,type:b.fields.meetingType,agendaItems:o.agenda.length,quorumMet:o.attendance?.quorumMet??null,minutesDrafted:Boolean(o.minutes),minutesApproved:r.status==='approved'}}),quorumDefault:quorumDefault(env)});
 }
 const m=path.match(/^\/api\/committee\/meetings\/([a-f0-9-]{36})(?:\/(member-edition))?$/);
 if(!m)fail(404,'Unknown meeting service.','not_found');
 const {row,body}=await loadDeskRecord(db,meetings,m[1],actor);
 if(!m[2]&&req.method==='GET')return json({meeting:await view(db,env,row,body,actor)});
 if(!m[2]&&req.method==='POST')return meetingAction(req,env,db,actor,row,body);
 if(m[2]&&req.method==='POST')return memberEdition(req,db,actor,row,body);
 fail(405,'Unsupported meeting operation.','method_not_allowed');
}
