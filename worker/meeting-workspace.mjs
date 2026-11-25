// Purpose-built meeting register on existing Sandy working records.
// Formal voting, approval and member publication remain separate gated operations.
import {requireRole,dbFor,fail,json,payload,field,dateField,version,now,id,revision,audit,STAFF} from './shared.mjs';
import {suiteBody,visibleRecords,genericAllowed} from './record-policy.mjs';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
const roles=SUITE_BY_KEY.meetings.roles,desk=SUITE_BY_KEY.meetings,todoDesk=SUITE_BY_KEY.todos;
const officeLabels={webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee officer'};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const validId=x=>typeof x==='string'&&uuid.test(x);
const asId=x=>{if(!validId(x))fail(400,'Choose a valid record ID.','invalid_id');return x};
const clean=(v,n)=>field(v,n);
const today=()=>new Date(Date.now()+36000000).toISOString().slice(0,10);
const time=v=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v||''))fail(400,'Choose a valid Brisbane time.','invalid_time');return v};
const types=desk.fields.find(f=>f.key==='meetingType').options;
const informal=t=>['Working group','Informal discussion','Founding meeting'].includes(t);
const lines=v=>String(v||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const rowBy=(db,key)=>db.prepare('SELECT * FROM club_records WHERE id=?').bind(key).first();
const failConflict=()=>fail(409,'Another officer updated this meeting. Reopen the saved record before making changes.','meeting_conflict');
async function stableId(value){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sandy-meeting-v1/'+value))).slice(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
const templates={
 'Management committee':['Opening, attendance and quorum','Declarations of interests','Previous minutes and outstanding actions','Correspondence','Treasurer report and proposed budget','Officer and activity reports','Business for discussion','Read back proposals and follow-ups','Next meeting'],
 'Annual general meeting':['Opening and quorum','Notice and eligibility review','Previous AGM minutes','Annual reports','Financial statements and applicable verification','Nominations and election preparations','Proposed business and follow-ups','Close'],
 'General meeting':['Opening and quorum','Notice and proposed business','Declarations of interests','Reports','Discussion and proposed motions','Follow-ups and close'],
 'Special meeting':['Opening and quorum','Exact notified business','Declarations of interests','Discussion and proposed motions','Next steps and close'],
 'Founding meeting':['Welcome and proposed purpose','Prospective constitution and membership','Proposed office responsibilities','Summer beach programme and safety','Equipment and fundraising','Next steps'],
 'Working group':['Welcome and introductions','Practical matters and constraints','Ideas and proposals','Who can help and with what?','Next steps and review'],
 'Informal discussion':['Welcome','Hear from those present','Ideas and practical considerations','Potential follow-ups','Next contact']
};
const agendaItem=(key,title)=>({id:key,title,notes:'',motions:[]});
function normalizeOffice(v){
 const n=String(v||'').toLowerCase().replace(/^example\s+|^fictional\s+|^proposed\s+/g,'').replace(/[^a-z]/g,'');
 return STAFF.find(k=>k.replace(/_/g,'')===n||officeLabels[k].toLowerCase().replace(/[^a-z]/g,'')===n)||'';
}
async function model(row,b){
 if(b.meetingWorkspace)return structuredClone(b.meetingWorkspace);
 const f=b.fields||{},type=types.includes(f.meetingType)?f.meetingType:'Working group';
 const topics=lines(f.agenda),items=await Promise.all((topics.length?topics:templates[type]).map(async(t,i)=>agendaItem(await stableId(row.id+'/agenda/'+i),t)));
 const actions=await Promise.all(lines(f.followUps).map(async(s,i)=>{
  const [text,owner='',dueDate='']=s.split('|').map(x=>x.trim());
  return {id:await stableId(row.id+'/legacy-action/'+i),text,office:normalizeOffice(owner),ownerText:owner,dueDate:/^\d{4}-\d\d-\d\d$/.test(dueDate)?dueDate:'',sourceItem:null,legacyIndex:i};
 }));
 return {version:1,type,date:f.date||row.event_date||'',start:f.startTime||'09:00',end:f.endTime||'10:00',location:f.location||'',chair:f.chair||'',minuteTaker:f.minuteTaker||'',attendance:f.attendees||'',apologies:'',quorumNote:f.quorum||'',quorumStatus:'unchecked',conflicts:f.openingNotes||'',adjournment:'',agenda:items,notes:f.transcript||'',minutes:f.draftMinutes||'',proposals:lines(f.decisions),actions,reviewedForPrivacy:Boolean(f.reviewedForPersonalData),reviewedBySecretary:Boolean(f.reviewedBySecretary),state:row.status==='archived'?'cancelled':row.status==='approved'?'approved':'draft',cancelReason:'',scheduleRevision:1,reviewVersion:null};
}
function validate(m,old,env){
 if(!m||typeof m!=='object'||Array.isArray(m)||!types.includes(m.type))fail(400,'Choose a meeting type.','invalid_meeting');
 const out={version:1,type:m.type,date:dateField(m.date,false),start:time(m.start),end:time(m.end),location:clean(m.location,700),chair:clean(m.chair,140),minuteTaker:clean(m.minuteTaker,140),attendance:clean(m.attendance,4000),apologies:clean(m.apologies,2000),quorumNote:clean(m.quorumNote,500),quorumStatus:m.quorumStatus||'unchecked',conflicts:clean(m.conflicts,3000),adjournment:clean(m.adjournment,2000),notes:clean(m.notes,14000),minutes:clean(m.minutes,14000),proposals:[],actions:[],agenda:[],reviewedForPrivacy:m.reviewedForPrivacy===true,reviewedBySecretary:m.reviewedBySecretary===true,state:old?.state==='cancelled'?'cancelled':'draft',cancelReason:old?.cancelReason||'',scheduleRevision:old?.scheduleRevision||1,reviewVersion:null};
 if(!out.location||out.end<=out.start)fail(400,'Enter a venue or location and an end time after the start.','invalid_schedule');
 if(!['unchecked','present','absent','lost'].includes(out.quorumStatus))fail(400,'Choose a quorum state.','invalid_quorum');
 if(informal(out.type)&&out.quorumStatus!=='unchecked')fail(400,'Informal and founding discussions cannot certify formal quorum.','informal_quorum');
 if(!Array.isArray(m.agenda)||!m.agenda.length||m.agenda.length>50||!Array.isArray(m.actions)||m.actions.length>25||!Array.isArray(m.proposals)||m.proposals.length>50)fail(400,'Check agenda items, proposals and follow-up limits.','invalid_meeting');
 const used=new Set(),unique=x=>{asId(x);if(used.has(x))fail(400,'Agenda items and actions need distinct IDs.','duplicate_item');used.add(x);return x};
 for(const a of m.agenda){
  if(!a||!Array.isArray(a.motions)||a.motions.length>15)fail(400,'Check the agenda and proposed motions.','invalid_agenda');
  const title=clean(a.title,250);if(!title||/[\r\n]/.test(title))fail(400,'Give each agenda item a title.','invalid_agenda');
  const motions=a.motions.map(x=>{
   if(informal(out.type))fail(400,'Use proposals and follow-ups for informal or founding discussions.','informal_motion');
   if(!x||!['pending','deferred','withdrawn','carried','lost'].includes(x.outcome))fail(400,'Choose a motion status.','invalid_motion');
   const wording=clean(x.text,2000);if(!wording)fail(400,'Enter motion wording.','invalid_motion');
   if(['carried','lost'].includes(x.outcome)){
    if(env.SANDY_CLUB_APPROVALS!=='enabled')fail(409,'Formal votes remain disabled until the club is lawfully established.','club_not_established');
    if(out.date>today())fail(409,'A future meeting cannot record a vote.','future_meeting');
    if(out.quorumStatus!=='present')fail(400,'Confirm quorum before recording a vote.','vote_without_quorum');
   }
   return {id:unique(x.id),text:wording,movedBy:clean(x.movedBy,140),secondedBy:clean(x.secondedBy,140),outcome:x.outcome,vote:clean(x.vote,500)};
  });
  out.agenda.push({id:unique(a.id),title,notes:clean(a.notes,3500),motions});
 }
 const itemIds=new Set(out.agenda.map(a=>a.id));
 out.proposals=m.proposals.map(x=>clean(x,500)).filter(Boolean);
 for(const a of m.actions){
  if(!a||typeof a!=='object')fail(400,'Check the action list.','invalid_action');
  const text=clean(a.text,250);if(!text)fail(400,'Enter an action description.','invalid_action');
  if(a.office&&!STAFF.includes(a.office))fail(400,'Choose a responsible proposed office.','invalid_office');
  if(a.sourceItem&&!itemIds.has(a.sourceItem))fail(400,'Choose an existing agenda item for this action.','invalid_source');
  const prev=old?.actions.find(x=>x.id===a.id);
  const action={id:unique(a.id),text,office:a.office||'',ownerText:a.office?officeLabels[a.office]:clean(a.ownerText,100),dueDate:a.dueDate?dateField(a.dueDate,false):'',sourceItem:a.sourceItem||null};
  if(prev&&own(prev,'legacyIndex'))action.legacyIndex=prev.legacyIndex;
  out.actions.push(action);
 }
 if(old&&(old.date!==out.date||old.start!==out.start||old.end!==out.end||old.location!==out.location||old.type!==out.type))out.scheduleRevision++;
 if(JSON.stringify(out).length>49000)fail(413,'Keep this meeting draft below 49 KB.','too_large');
 return out;
}
function projected(b,m){
 return {...b,meetingWorkspace:m,fields:{...b.fields,meetingType:m.type,date:m.date,startTime:m.start,endTime:m.end,location:m.location,chair:m.chair,minuteTaker:m.minuteTaker,attendees:[m.attendance,m.apologies&&'Apologies: '+m.apologies].filter(Boolean).join('\n'),quorum:m.quorumNote,agenda:m.agenda.map(a=>a.title).join('\n'),openingNotes:m.conflicts,transcript:m.notes,draftMinutes:m.minutes,decisions:m.proposals.join('\n'),followUps:m.actions.map(a=>[a.text,a.office?officeLabels[a.office]:a.ownerText,a.dueDate].join(' | ')).join('\n'),reviewedForPersonalData:m.reviewedForPrivacy,reviewedBySecretary:m.reviewedBySecretary}};
}
function writes(db,actor,at,rowId,v,op,snapshot,changes={}){
 return [revision(db,{kind:'record',resourceId:rowId,resourceVersion:v,action:op,actor,at,snapshot,changes,guarded:true}),audit(db,actor,op,'record',rowId,at,true,{fromVersion:v-1,toVersion:v})];
}
async function tasks(db,key){
 const rows=await visibleRecords(db,"WHERE kind='task' AND json_extract(body_json,'$.sourceMeeting')=?",[key],'created_utc,id',100,r=>Boolean(suiteBody(r,todoDesk)));
 return rows.map(r=>{const b=suiteBody(r,todoDesk);return {id:r.id,actionId:b.sourceActionId||null,legacyIndex:Number.isInteger(b.sourceIndex)?b.sourceIndex:null,title:r.title,office:b.committeeOps?.office||normalizeOffice(b.fields.owner),dueDate:b.fields.dueDate||'',done:r.status==='completed'||b.fields.complete===true,archived:['archived','rejected'].includes(r.status),version:r.version,completion:b.committeeOps?.completion||null}});
}
function linked(action,rows){return rows.find(t=>t.actionId===action.id||(!t.actionId&&own(action,'legacyIndex')&&t.legacyIndex===action.legacyIndex))||null}
async function view(db,row,b){
 const m=await model(row,b),jobs=await tasks(db,row.id);
 return {id:row.id,title:row.title,version:row.version,status:row.status,updatedAt:row.updated_utc,updatedBy:row.updated_by,legacy:!b.meetingWorkspace,meeting:m,actions:m.actions.map(a=>({...a,task:linked(a,jobs)})),otherTasks:jobs.filter(t=>!m.actions.some(a=>linked(a,[t]))),openActions:jobs.filter(t=>!t.done&&!t.archived).length,locked:['approved','archived'].includes(row.status)};
}
async function list(db,actor){
 const rows=await visibleRecords(db,"WHERE kind='meeting' AND json_extract(body_json,'$.sandySuiteVersion')=1 AND json_extract(body_json,'$.domain')='meetings'",[],'event_date DESC,updated_utc DESC,id DESC',300,r=>Boolean(suiteBody(r,desk)));
 const meetings=[];for(const row of rows){
  const b=suiteBody(row,desk),m=await model(row,b),jobs=await tasks(db,row.id);
  meetings.push({id:row.id,title:row.title,date:m.date,start:m.start,end:m.end,location:m.location,type:m.type,state:m.state,version:row.version,openActions:jobs.filter(t=>!t.done&&!t.archived).length,quorum:m.quorumStatus,legacy:!b.meetingWorkspace});
 }
 const older=await visibleRecords(db,"WHERE kind='meeting' AND json_extract(body_json,'$.source')='sandy-committee-room-v1' AND json_extract(body_json,'$.desk')='meetings'",[],'updated_utc DESC,id DESC',100,r=>genericAllowed(r,actor));
 return {meetings,legacy:older.map(r=>({id:r.id,title:r.title,status:r.status,date:r.event_date,details:JSON.parse(r.body_json).notes||''})),templates,today:today(),offices:STAFF.map(key=>({key,label:officeLabels[key]})),formalEnabled:false};
}
async function create(db,actor,req,env){
 const key=asId(req.id),title=clean(req.title,180);
 if(!title)fail(400,'Enter a meeting title.','missing_title');
 const type=req.type;if(!types.includes(type))fail(400,'Choose a meeting type.','invalid_meeting');
 const at=now(),agenda=await Promise.all(templates[type].map(async(t,i)=>agendaItem(await stableId(key+'/agenda/'+i),t)));
 const m=validate({type,date:req.date,start:req.start,end:req.end,location:req.location,agenda,actions:[],proposals:[]},null,env);
 const b=projected({sandySuiteVersion:1,domain:'meetings',fields:{},meetingCreateRequest:JSON.stringify([title,type,m.date,m.start,m.end,m.location])},m);
 const previous=await rowBy(db,key);
 const match=r=>r&&r.created_by===actor.id&&suiteBody(r,desk)?.meetingCreateRequest===b.meetingCreateRequest;
 if(previous){if(!match(previous))failConflict();return json({ok:true,id:key,version:previous.version,replayed:true})}
 const results=await db.batch([db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'meeting',?,?,'draft',?,1,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(key,title,JSON.stringify(b),m.date,actor.id,actor.id,at,at),...writes(db,actor,at,key,1,'meeting_scheduled',b)]);
 if(!results[0].meta.changes&&!match(await rowBy(db,key)))failConflict();
 return json({ok:true,id:key,version:1},results[0].meta.changes?201:200);
}
async function save(db,row,b,actor,req,env){
 const old=await model(row,b),expected=version(req.version),at=now(),title=clean(req.title,180)||row.title;
 if(['approved','archived'].includes(row.status))fail(409,'This meeting is locked. Retain its history.','meeting_locked');
 if(expected!==row.version)failConflict();
 const m=validate(req.meeting,old,env),jobs=await tasks(db,row.id);
 for(const a of old.actions){
  const t=linked(a,jobs);if(!t)continue;
  const n=m.actions.find(x=>x.id===a.id);
  if(!n||n.text!==a.text||n.office!==a.office||n.dueDate!==a.dueDate||n.sourceItem!==a.sourceItem)fail(409,'A linked officer action cannot be removed or rewritten in minutes. Allocate or complete it in the officer work list.','linked_action_locked');
 }
 if(req.review===true){if(!m.minutes.trim())fail(400,'Prepare draft minutes first.','missing_minutes');if(!m.reviewedForPrivacy||!m.reviewedBySecretary)fail(400,'Complete the review checks before marking a draft ready.','review_required');m.state='reviewed';m.reviewVersion=row.version+1}
 const next=projected(b,m);
 const result=await db.batch([db.prepare("UPDATE club_records SET title=?,body_json=?,event_date=?,status=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND status NOT IN ('approved','archived')").bind(title,JSON.stringify(next),m.date,m.state==='reviewed'?'review':'draft',actor.id,at,row.id,row.version),...writes(db,actor,at,row.id,row.version+1,'meeting_workspace_saved',{title,...next},{scheduleRevision:m.scheduleRevision,reviewed:m.state==='reviewed'})]);
 if(!result[0].meta.changes)failConflict();
 return json({ok:true,id:row.id,version:row.version+1});
}
async function cancel(db,row,b,actor,req){
 const expected=version(req.version),reason=clean(req.reason,500);if(!reason)fail(400,'Record why this meeting is cancelled.','cancel_reason');
 if(row.version!==expected||['approved','archived'].includes(row.status))failConflict();
 const m=await model(row,b),jobs=await tasks(db,row.id);
 if(jobs.some(t=>!t.done&&!t.archived))fail(409,'Resolve or archive outstanding linked tasks before cancelling.','meeting_open_actions');
 m.state='cancelled';m.cancelReason=reason;m.scheduleRevision++;
 const at=now(),next=projected(b,m);
 const result=await db.batch([db.prepare("UPDATE club_records SET status='archived',body_json=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND status NOT IN ('approved','archived') AND NOT EXISTS(SELECT 1 FROM club_records WHERE kind='task' AND json_extract(body_json,'$.sourceMeeting')=? AND status NOT IN ('completed','archived','rejected') AND coalesce(json_extract(body_json,'$.fields.complete'),0)!=1)").bind(JSON.stringify(next),actor.id,at,row.id,expected,row.id),...writes(db,actor,at,row.id,expected+1,'meeting_cancelled',next,{reason})]);
 if(!result[0].meta.changes)failConflict();return json({ok:true,version:expected+1});
}
async function handoff(db,row,b,actor,req){
 if(row.version!==version(req.version)||['approved','archived'].includes(row.status))failConflict();
 const m=await model(row,b),action=m.actions.find(x=>x.id===req.actionId);
 if(!action)fail(404,'Choose a saved meeting action.','action_missing');
 const existing=linked(action,await tasks(db,row.id));if(existing)return json({ok:true,id:existing.id,replayed:true});
 const taskId=await stableId(row.id+'/task/'+action.id),at=now(),fields={action:action.text,owner:action.office?officeLabels[action.office]:action.ownerText,dueDate:action.dueDate,priority:'Normal',linkedDesk:row.id,progress:'From meeting: '+row.title,complete:false};
 const tb={sandySuiteVersion:1,domain:'todos',sourceMeeting:row.id,sourceActionId:action.id,sourceVersion:row.version,...(own(action,'legacyIndex')?{sourceIndex:action.legacyIndex}:{}),fields,committeeOps:{version:1,kind:'task',office:action.office,noticeId:null,request:'meeting/'+action.id,claimedBy:null}};
 const result=await db.batch([db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,'task',?,?,'draft',?,1,?,?,?,? WHERE EXISTS(SELECT 1 FROM club_records WHERE id=? AND version=? AND status NOT IN ('approved','archived')) AND NOT EXISTS(SELECT 1 FROM club_records WHERE kind='task' AND json_extract(body_json,'$.sourceMeeting')=? AND (json_extract(body_json,'$.sourceActionId')=? OR (? IS NOT NULL AND json_extract(body_json,'$.sourceIndex')=?))) ON CONFLICT(id) DO NOTHING").bind(taskId,action.text,JSON.stringify(tb),action.dueDate||null,actor.id,actor.id,at,at,row.id,row.version,row.id,action.id,action.legacyIndex??null,action.legacyIndex??null),...writes(db,actor,at,taskId,1,'meeting_followup_created',tb,{sourceMeeting:row.id,sourceActionId:action.id})]);
 const saved=linked(action,await tasks(db,row.id));if(!saved)failConflict();
 return json({ok:true,id:saved.id,replayed:!result[0].meta.changes});
}
const escIcs=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line){let out='',n=0;for(const c of line){const size=new TextEncoder().encode(c).length;if(n+size>75){out+='\r\n ';n=1}out+=c;n+=size}return out}
function calendar(meetings){
 const stamp=now().replace(/[-:]|\.\d{3}/g,'');
 const out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports//Private meeting register//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Sandy Sports proposed meetings'];
 for(const m of meetings){
  if(!m.date||!m.start||!m.end)continue;
  const utc=(d,t)=>new Date(d+'T'+t+':00+10:00').toISOString().replace(/[-:]|\.\d{3}/g,'');
  out.push('BEGIN:VEVENT','UID:'+m.id+'@sandy-sports-club','DTSTAMP:'+stamp,'SEQUENCE:'+m.version,'DTSTART:'+utc(m.date,m.start),'DTEND:'+utc(m.date,m.end),'SUMMARY:'+escIcs('[PROPOSAL] '+m.title),'LOCATION:'+escIcs(m.location),'CLASS:PRIVATE','STATUS:'+(m.state==='cancelled'?'CANCELLED':'TENTATIVE'),'END:VEVENT');
 }
 out.push('END:VCALENDAR','');
 return new Response(out.map(fold).join('\r\n'),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="sandy-meeting-register.ics"','Cache-Control':'private, no-store'}});
}
export async function meetingWorkspaceEndpoint(req,env,path,actor){
 requireRole(actor,roles);const db=dbFor(env),base='/api/committee/meeting-workspace';
 if(path===base){
  if(req.method==='GET')return json(await list(db,actor));
  if(req.method==='POST')return create(db,actor,await payload(req,10000),env);
 }
 if(path===base+'/calendar.ics'&&req.method==='GET')return calendar((await list(db,actor)).meetings);
 const match=path.match(/^\/api\/committee\/meeting-workspace\/([a-f0-9-]{36})(?:\/(cancel|handoff))?$/);
 if(!match||!validId(match[1]))fail(404,'Meeting workspace not found.','not_found');
 const row=await rowBy(db,match[1]),b=suiteBody(row,desk);if(!b)fail(404,'Meeting not found.','not_found');
 if(!match[2]&&req.method==='GET')return json(await view(db,row,b));
 if(!match[2]&&req.method==='PATCH')return save(db,row,b,actor,await payload(req,60000),env);
 if(match[2]==='cancel'&&req.method==='POST')return cancel(db,row,b,actor,await payload(req,5000));
 if(match[2]==='handoff'&&req.method==='POST')return handoff(db,row,b,actor,await payload(req,5000));
 fail(405,'Use the meeting register actions.','method_not_allowed');
}
