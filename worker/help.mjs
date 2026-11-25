// Sandy's authenticated Webmaster help inbox. All replies remain in the club; no email is sent.
import {fail,json,now,id,dbFor,payload,field,version,requireRole,revision,audit} from './shared.mjs';
import {helpAllowed,visibleRecords} from './record-policy.mjs';
const writers=['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee','member'];
const categories=['Access or password','Site or account issue','Member or safety concern','Committee workflow','Sports or events','Media or notices','Other'];
const credentialPattern=/(?:[?#&](?:activate|invite|token|reset|recover|receipt|code|key)=|\b[a-f0-9]{64}\b|\b(?:my (?:password|passcode|pin) is|(?:password|passcode|pin|verification code|login code|access key|secret)\s*[:=])\s*\S|\b\d{6}\b)/i;
const rejectCredentials=text=>{if(credentialPattern.test(text))fail(400,'Remove passwords, private links or access codes before submitting.','private_credentials')};
const convert=row=>{const b=JSON.parse(row.body_json);return {id:row.id,category:b.category,subject:row.title,
 message:b.message,createdBy:row.created_by,createdAt:row.created_utc,updatedAt:row.updated_utc,
 stage:row.status,readAt:b.readAt||null,reply:b.reply||'',version:row.version}};
export async function helpEndpoint(req,env,path,identity){
 requireRole(identity,writers);
 const db=dbFor(env),at=now();
 if(path==='/api/webmaster/requests'&&req.method==='GET'){
  const webmaster=identity.role==='webmaster';
  const where=webmaster?'':' AND created_by=?';
  const rows=await visibleRecords(db,"WHERE kind='notice' AND json_extract(body_json,'$.sandyWebmasterRequest')=1"+where,webmaster?[]:[identity.id],'updated_utc DESC,id DESC',200,row=>helpAllowed(row,identity));
  const records=rows.map(convert);
  return json({requests:records,counters:webmaster?{
   unread:records.filter(x=>!x.readAt).length,open:records.filter(x=>x.stage!=='completed'&&x.stage!=='archived').length
  }:null});
 }
 if(path==='/api/webmaster/requests'&&req.method==='POST'){
  const p=await payload(req,8000),subject=field(p.subject,160),message=field(p.message,5000),
   category=field(p.category,40);
  if(!subject||!message||!categories.includes(category))
   fail(400,'Enter a subject, category and a request message.','invalid_help_request');
  rejectCredentials(subject+' '+message);
  const rid=id(),body={sandyWebmasterRequest:1,category,message,readAt:null,reply:''};
  await db.batch([
   db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'notice',?,?,'draft',NULL,1,?,?,?,?)")
    .bind(rid,subject,JSON.stringify(body),identity.id,identity.id,at,at),
   revision(db,{kind:'record',resourceId:rid,resourceVersion:1,action:'webmaster_request_submitted',actor:identity,at,
    snapshot:{subject,category,message}}),
   audit(db,identity,'webmaster_request_submitted','record',rid,at)
  ]);
  return json({ok:true,id:rid,version:1,note:'Request saved privately for webmaster review. No email was sent.'},201);
 }
 const match=path.match(/^\/api\/webmaster\/requests\/([a-f0-9-]{36})(?:\/(history|status))?$/);
 if(match&&req.method==='GET'){
  const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(match[1]).first();
  if(!helpAllowed(row,identity))fail(404,'This request does not exist.','help_not_found');
  if(!match[2])return json({request:convert(row)});
  if(match[2]==='status')return json({id:row.id,stage:row.status,version:row.version,updatedAt:row.updated_utc});
  const {results}=await db.prepare("SELECT resource_version AS version,actor_role AS role,actor_office AS office,at_utc AS at,operation,changes_json AS changes FROM club_revisions WHERE resource_kind='record' AND resource_id=? ORDER BY resource_version DESC LIMIT 80").bind(row.id).all();
  return json({history:results.filter(x=>x.operation.startsWith('webmaster_request_')||x.operation==='synthetic_fixture').map(x=>({...x,changes:JSON.parse(x.changes),brisbaneAt:new Date(x.at).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})}))});
 }
 if(match&&!match[2]&&req.method==='PATCH'){
  requireRole(identity,['webmaster']);
  const rid=match[1],row=await db.prepare('SELECT * FROM club_records WHERE id=? AND kind=?').bind(rid,'notice').first();
  if(!row)fail(404,'This request does not exist.','help_not_found');
  const before=JSON.parse(row.body_json);
  if(!helpAllowed(row,identity))fail(404,'This is not a webmaster request.','help_not_found');
  const p=await payload(req,8000),expected=version(p.version);
  if(expected!==row.version)fail(409,'This request was updated by another officer. Reload.','conflict');
  const stage=field(p.stage,24);
  if(!['draft','review','completed','archived'].includes(stage))
   fail(400,'Choose open, reviewing, resolved or archived.','invalid_help_stage');
  const next={...before,readAt:before.readAt||at,reply:field(p.reply,4000)};
  rejectCredentials(next.reply);
  const [result]=await db.batch([
   db.prepare('UPDATE club_records SET status=?,body_json=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=?')
    .bind(stage,JSON.stringify(next),identity.id,at,rid,expected),
   revision(db,{kind:'record',resourceId:rid,resourceVersion:expected+1,action:'webmaster_request_'+stage,actor:identity,at,
    changes:{from:row.status,to:stage,fromVersion:expected,toVersion:expected+1,reason:'Private request review'},snapshot:{stage,subject:row.title,reply:next.reply},guarded:true}),
   audit(db,identity,'webmaster_request_'+stage,'record',rid,at,true)
  ]);
  if(!result.meta.changes)fail(409,'Request changed during update. Reload it.','conflict');
  return json({ok:true,id:rid,version:expected+1,notice:'Reply saved internally. No email has been sent.'});
 }
 fail(404,'No such Webmaster assistance operation.','not_found');
}
