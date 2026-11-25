import {fail,json,now,id,dbFor,payload,field,dateField,version,requireRole,STAFF,ensureApprover,revision,audit,https} from './shared.mjs';
const types=['event','meeting','task','calendar','grant','asset','equipment','fundraising','film','sponsor','partner','volunteer','newsletter','notice','governance','production','safeguard','social_idea'];
const states=['proposal','draft','review','scheduled','completed','archived','rejected'];
import {genericAllowed,requireGeneric,requireGenericWrite,calendarAllowed,visibleRecords} from './record-policy.mjs';
const convert=row=>({
 id:row.id,kind:row.kind,title:row.title,body:JSON.parse(row.body_json),status:row.status,eventDate:row.event_date,
 version:row.version,createdBy:row.created_by,updatedBy:row.updated_by,createdAt:row.created_utc,updatedAt:row.updated_utc
});
function validate(body){
 const kind=field(body.kind,40),title=field(body.title,180),status=field(body.status,30)||'proposal';
 if(!types.includes(kind)||!title||!states.includes(status))fail(400,'Choose a recognised club record type, title and planning status.','invalid_record');
 if(body.body&& (typeof body.body!=='object'||Array.isArray(body.body)))fail(400,'Working details must be a JSON object.','invalid_record');
 const data=body.body||{};
 const size=JSON.stringify(data);
 if(size.length>24000)fail(413,'Working details are too large.','too_large');
 // An imported object may contain untrusted text but is never executed as HTML.
 return {kind,title,status,eventDate:dateField(body.eventDate),body:data};
}
async function list(db,kind,allowed){
 const where=kind?'WHERE kind=?':'',args=kind?[kind]:[];
 return (await visibleRecords(db,where,args,'COALESCE(event_date,created_utc) DESC,id DESC',300,allowed)).map(convert);
}
export async function recordsEndpoint(req,env,path,identity){
 const db=dbFor(env),at=now(),url=new URL(req.url);
 if(path==='/api/committee/events'&&req.method==='GET'){
  requireRole(identity,STAFF);
  const records=await list(db,'event',row=>calendarAllowed(row,identity));
  return json({events:records.map(r=>({id:r.id,title:r.title,date:r.eventDate,
    goal:r.body.goal||r.body.description||r.body.fields?.goal||'',status:r.status==='archived'?'closed':'open'}))});
 }
 if(path==='/api/meetings'&&req.method==='GET'){
  requireRole(identity,STAFF);
  const records=await list(db,'meeting',row=>calendarAllowed(row,identity));
  return json({meetings:records.map(r=>({id:r.id,title:r.title,date:r.eventDate,
    location:r.body.location||r.body.fields?.location||'',status:r.status==='approved'?'approved':r.status==='archived'?'cancelled':'draft'}))});
 }
 if(path==='/api/records'&&req.method==='GET'){
  const kind=field(url.searchParams.get('kind'),40);
  if(kind&&!types.includes(kind))fail(400,'Unknown record category.','invalid_kind');
  requireRole(identity,STAFF);
  const records=await list(db,kind,row=>genericAllowed(row,identity));
  return json({records,kinds:types});
 }
 if(path==='/api/records'&&req.method==='POST'){
  requireRole(identity,STAFF);
  const b=await payload(req,30000),record=validate(b);requireGenericWrite(record,identity);
  if(record.status==='approved')fail(400,'A planning edit cannot approve a club record.','approval_required');
  const recordId=id();
  await db.batch([
   db.prepare('INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,?,?,?,?,1,?,?,?,?)')
    .bind(recordId,record.kind,record.title,JSON.stringify(record.body),record.status,record.eventDate,identity.id,identity.id,at,at),
   revision(db,{kind:'record',resourceId:recordId,resourceVersion:1,action:'created',actor:identity,at,snapshot:record}),
   audit(db,identity,'record_created','record',recordId,at)
  ]);
  return json({ok:true,id:recordId,version:1},201);
 }
 const match=path.match(/^\/api\/records\/([a-f0-9-]{36})(?:\/(revisions|decision))?$/);
 if(match){
  requireRole(identity,STAFF);
  const recordId=match[1],row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(recordId).first();
  if(!row)fail(404,'No club record exists with that identifier.','record_not_found');
  requireGeneric(row,identity);
  if(match[2]==='revisions'&&req.method==='GET'){
   const q=await db.prepare("SELECT resource_version AS version,at_utc AS at,actor_office AS office,actor_role AS role,operation,changes_json AS changes FROM club_revisions WHERE resource_kind='record' AND resource_id=? ORDER BY resource_version DESC LIMIT 80")
    .bind(recordId).all();
   return json({revisions:(q.results||[]).map(x=>({...x,changes:JSON.parse(x.changes)}))});
  }
  if(!match[2]&&req.method==='GET')return json({record:convert(row)});
  if(!match[2]&&req.method==='PATCH'){
   const b=await payload(req,30000),expected=version(b.version),before=convert(row);
   if(row.version!==expected)fail(409,'Another officer updated this record. Refresh before editing.','conflict');
   if(row.status==='approved')fail(409,'An approved record must be formally reviewed before changing it.','approval_locked');
   const record=validate({...before,...b,kind:row.kind});
   requireGenericWrite(record,identity,row);
   if(record.status==='approved')fail(400,'Use an authorised decision rather than changing a status field.','approval_required');
   const [result]=await db.batch([
    db.prepare('UPDATE club_records SET title=?,body_json=?,status=?,event_date=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND status!=?')
     .bind(record.title,JSON.stringify(record.body),record.status,record.eventDate,identity.id,at,recordId,expected,'approved'),
    revision(db,{kind:'record',resourceId:recordId,resourceVersion:expected+1,action:'edited',actor:identity,at,snapshot:record,
     changes:{changed:Object.keys(b).filter(k=>k!=='version')},guarded:true}),
    audit(db,identity,'record_edited','record',recordId,at,true,{fromVersion:expected,toVersion:expected+1})
   ]);
   if(!result.meta.changes)fail(409,'The record changed during saving.','conflict');
   return json({ok:true,id:recordId,version:expected+1});
  }
  if(match[2]==='decision'&&req.method==='POST'){
   ensureApprover(identity,env);
   const b=await payload(req,8192),decision=field(b.decision,32);
   if(!['approved','rejected','returned'].includes(decision))fail(400,'Choose approve, reject or return for changes.','invalid_decision');
   if(row.version!==version(b.version))fail(409,'Review the latest record version before deciding.','conflict');
   const evidence=https(b.evidence);
   if(!evidence)fail(400,'Record a supporting HTTPS decision reference.','evidence_required');
   const newStatus=decision==='approved'?'approved':decision==='rejected'?'rejected':'review';
   const newVersion=row.version+1;
   const decisionId=id();
   const [saved]=await db.batch([
    db.prepare('UPDATE club_records SET status=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=?')
     .bind(newStatus,identity.id,at,recordId,row.version),
    db.prepare("INSERT INTO studio_decisions(id,entity_type,entity_id,entity_version,decision,scope_json,evidence_url,authorised_actor,authorised_office,decided_utc) SELECT ?,'record',?,?,?,?,?,?,?,? WHERE changes()=1")
     .bind(decisionId,recordId,newVersion,decision,JSON.stringify({kind:row.kind,title:row.title}),evidence,identity.id,identity.office_label,at),
    revision(db,{kind:'record',resourceId:recordId,resourceVersion:newVersion,action:'decision_'+decision,actor:identity,at,
      snapshot:{...convert(row),status:newStatus,version:newVersion},changes:{decision,evidence},guarded:true}),
    audit(db,identity,'record_decision_'+decision,'record',recordId,at,true,{fromVersion:row.version,toVersion:newVersion})
   ]);
   if(!saved.meta.changes)fail(409,'This record was already decided or changed.','conflict');
   return json({ok:true,id:recordId,version:newVersion,decisionId,decision,decidedAt:at});
  }
 }
 fail(404,'Unknown committee record operation.','not_found');
}
