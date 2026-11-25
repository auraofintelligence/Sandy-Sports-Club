// Domain-specific Sandy Sports clubhouse workflows, backed by existing isolated D1 records.
// Every create/change is attributed to the real signed-in user and audited; no approval/payment/email is triggered.
import {ApiError,fail,json,now,id,dbFor,payload,field,dateField,https,version,requireRole,revision,audit} from './shared.mjs';
import {SUITE_BY_KEY,SUITE_DESKS} from '../studio/sandy-suite-spec.js';
import {suiteActionEndpoint} from './suite-actions.mjs';
import {suiteBody,suiteAllowed,visibleRecords} from './record-policy.mjs';
const statuses=['proposal','draft','review','scheduled','completed','archived','rejected'];
const exactDate=value=>dateField(value||'',true);
const isRecordId=value=>/^[a-f0-9-]{36}$/.test(value||'');
function authorised(identity,desk){
 if(!desk)fail(404,'Unknown Sandy clubhouse workflow.','suite_unknown');
 requireRole(identity,desk.roles);
}
function cleanFields(desk,input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Enter the working form fields.','invalid_fields');
 const fields={};
 for(const key of Object.keys(input)){
  if(!desk.fields.some(f=>f.key===key))fail(400,'Unexpected form field: '+field(key,45),'invalid_field');
 }
 for(const f of desk.fields){
  const value=input[f.key];
  if(f.type==='checkbox'){fields[f.key]=value===true;continue}
  if(value===undefined||value===null||value===''){
   if(f.required)fail(400,'Complete '+f.label+'.','missing_required');
   fields[f.key]=f.type==='number'?null:'';continue;
  }
  if(f.type==='number'){
   if(typeof value!=='number'&&typeof value!=='string')fail(400,'Use a numeric value for '+f.label+'.','invalid_number');
   const n=Number(value);
   if(!Number.isFinite(n)||n<0||n>1e9)fail(400,'Check the amount or quantity for '+f.label+'.','invalid_number');
   fields[f.key]=n;continue;
  }
  if(typeof value!=='string')fail(400,'Use text for '+f.label+'.','invalid_field');
  const maximum=f.type==='textarea'||f.type==='lines'?11000:700;
  if(value.length>maximum)fail(413,f.label+' exceeds the draft size limit.','too_large');
  const trimmed=value.trim();
  if(f.type==='date'){fields[f.key]=trimmed?exactDate(trimmed):'';continue}
  if(f.type==='month'){
   if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(trimmed))fail(400,'Use YYYY-MM for '+f.label+'.','invalid_month');
  }
  if(f.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed))fail(400,'Use a 24-hour Brisbane time.','invalid_time');
  if(f.type==='url'&&trimmed)https(trimmed);
  if(f.type==='select'&&!f.options.includes(trimmed))fail(400,'Choose a valid option for '+f.label+'.','invalid_option');
  if(f.type==='lines'&&trimmed.split(/\r?\n/).length>100)fail(400,'Please keep checklists to 100 lines.','too_many_lines');
  fields[f.key]=trimmed;
 }
 if(desk.key==='stock'){
  const onHand=Number(fields.opening||0)+Number(fields.inward||0)-Number(fields.outward||0);
  if(onHand<0)fail(400,'Stock issued cannot exceed opening stock plus stock received.','negative_stock');
 }
 if(desk.key==='meetings'&&fields.startTime&&fields.endTime&&fields.endTime<=fields.startTime)
  fail(400,'The meeting finish time must be after its start time.','invalid_meeting_time');
 if(JSON.stringify(fields).length>21000)fail(413,'This working draft is too long for one version.','too_large');
 return fields;
}
function dueDate(fields){
 return ['date','eventDate','closingDate','dueDate','reviewDate','agmDate','sendAfter','received','targetDate'].map(k=>fields[k]).find(v=>/^\d{4}-\d{2}-\d{2}$/.test(v||''))||null;
}
function summary(row,parsed){
 const body=parsed||JSON.parse(row.body_json);
 return {id:row.id,domain:body.domain,title:row.title,status:row.status,eventDate:row.event_date,
  fields:body.fields,version:row.version,createdBy:row.created_by,updatedBy:row.updated_by,
  createdAt:row.created_utc,updatedAt:row.updated_utc};
}
const validBody=suiteBody;
function checkStatus(data){
 const status=field(data.status,30)||'draft';
 if(!statuses.includes(status))fail(400,'Choose a valid working stage.','invalid_status');
 return status;
}
async function list(db,desk,identity){
 const rows=await visibleRecords(db,"WHERE kind=? AND json_extract(body_json,'$.sandySuiteVersion')=1 AND json_extract(body_json,'$.domain')=?",[desk.kind,desk.key],'updated_utc DESC,id DESC',300,row=>suiteAllowed(row,desk,identity));
 return rows.map(row=>summary(row));
}
async function changed(db,desk,identity,recordId,request){
 const current=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(recordId).first();
 const before=validBody(current,desk);
 if(!before||!suiteAllowed(current,desk,identity))fail(404,'That Sandy working record was not found in this area.','record_not_found');
 if(before.meetingWorkspace)fail(409,'Use the dedicated meeting workspace for this record.','dedicated_workflow');
 if(before.committeeOps)fail(409,'Use the dedicated committee noticeboard or officer task list for this record.','dedicated_workflow');
 const expected=version(request.version);
 if(expected!==current.version)fail(409,'Another officer edited this record. Reload the latest version.','conflict');
 if(current.status==='approved')fail(409,'A formally approved record cannot be changed as a working draft.','locked');
 const fields=cleanFields(desk,request.fields),title=field(request.title,180),status=checkStatus(request);
 if(!title)fail(400,'Enter a working title.','title_required');
 const at=now(),nextVersion=expected+1,body={...before,fields};
 // The origin is server-owned; editing a task cannot sever its original meeting link.
 if(desk.key==='todos'&&before.sourceMeeting)fields.linkedDesk=before.sourceMeeting;
 const [saved]=await db.batch([
  db.prepare("UPDATE club_records SET title=?,body_json=?,status=?,event_date=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND kind=? AND version=? AND status!='approved'")
   .bind(title,JSON.stringify(body),status,dueDate(fields),identity.id,at,recordId,desk.kind,expected),
  revision(db,{kind:'record',resourceId:recordId,resourceVersion:nextVersion,action:'suite_edited_'+desk.key,actor:identity,at,
   changes:{domain:desk.key,from:current.status,to:status,fromVersion:expected,toVersion:nextVersion,reason:field(request.reason,500)||'Working draft edit'},snapshot:{title,status,...body},guarded:true}),
  audit(db,identity,'suite_edited_'+desk.key,'record',recordId,at,true,{fromVersion:expected,toVersion:nextVersion})
 ]);
 if(!saved.meta.changes)fail(409,'This record changed while saving. Reload it.','conflict');
 return json({ok:true,id:recordId,version:nextVersion,updatedBy:identity.id,updatedOffice:identity.office_label,updatedAt:at});
}
async function create(db,desk,identity,request){
 const fields=cleanFields(desk,request.fields),title=field(request.title,180),status=checkStatus(request);
 if(!title)fail(400,'Enter a working title.','title_required');
 const at=now(),recordId=id(),body={sandySuiteVersion:1,domain:desk.key,fields};
 const [saved]=await db.batch([
  db.prepare('INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,?,?,?,?,1,?,?,?,?)')
   .bind(recordId,desk.kind,title,JSON.stringify(body),status,dueDate(fields),identity.id,identity.id,at,at),
  revision(db,{kind:'record',resourceId:recordId,resourceVersion:1,action:'suite_created_'+desk.key,actor:identity,at,
   snapshot:{title,status,fields}}),
  audit(db,identity,'suite_created_'+desk.key,'record',recordId,at,false,{fromVersion:0,toVersion:1})
 ]);
 if(!saved.meta.changes)fail(409,'The draft was not saved. Try again.','save_failed');
 return json({ok:true,id:recordId,version:1,updatedBy:identity.id,updatedOffice:identity.office_label,updatedAt:at},201);
}
export async function suiteEndpoint(req,env,path,identity){
 if(/^\/api\/suite\/(meetings|stock)\/[a-f0-9-]{36}\/(followups|movement)$/.test(path))
  return suiteActionEndpoint(req,env,path,identity);
 if(path==='/api/suite/desks'&&req.method==='GET'){
  requireRole(identity,['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee']);
  return json({desks:SUITE_DESKS.filter(d=>d.roles.includes(identity.role)).map(d=>({
   key:d.key,title:d.title,group:d.group,steps:d.steps,purpose:d.purpose,
   fields:d.fields
  })),disabled:{approvals:env.SANDY_CLUB_APPROVALS!=='enabled',automaticInvites:env.SANDY_INVITES_ENABLED!=='enabled',liveEmail:true,livePayments:true,livePublishing:true}});
 }
 const match=path.match(/^\/api\/suite\/([a-z][a-z0-9-]*)(?:\/([a-f0-9-]{36})(?:\/(history))?)?$/);
 if(!match)fail(404,'Unknown Sandy clubhouse service.','suite_not_found');
 const desk=SUITE_BY_KEY[match[1]],recordId=match[2],history=match[3];
 authorised(identity,desk);
 const db=dbFor(env);
 if(!recordId&&req.method==='GET')return json({records:await list(db,desk,identity),domain:desk.key});
 if(!recordId&&req.method==='POST')return create(db,desk,identity,await payload(req,26000));
 if(!isRecordId(recordId))fail(404,'That record identifier is invalid.','record_not_found');
 const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(recordId).first();
 const body=validBody(row,desk);
 if(!body||!suiteAllowed(row,desk,identity))fail(404,'That record is not in this working area.','record_not_found');
 if(history&&req.method==='GET'){
  const q=await db.prepare("SELECT resource_version AS version,at_utc AS at,actor_id AS actorId,actor_office AS office,actor_role AS role,operation,changes_json AS changes FROM club_revisions WHERE resource_kind='record' AND resource_id=? ORDER BY resource_version DESC LIMIT 100").bind(recordId).all();
  return json({history:(q.results||[]).map(x=>({...x,changes:JSON.parse(x.changes)}))});
 }
 if(!history&&req.method==='GET')return json({record:summary(row,body)});
 if(!history&&req.method==='PATCH')return changed(db,desk,identity,recordId,await payload(req,26000));
 fail(405,'This Sandy workflow only supports reading and saving working drafts.','method_not_allowed');
}
