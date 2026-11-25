// Cross-desk operational actions, all explicitly triggered by a real signed-in officer.
// Creates meeting follow-up tasks and maintains an audited stock movement balance.
import {fail,json,now,id,dbFor,payload,field,dateField,version,requireRole,revision,audit} from './shared.mjs';
import {suiteBody} from './record-policy.mjs';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
const isUuid=s=>/^[a-f0-9-]{36}$/.test(s);
function readRecord(row,domain){
 if(!row)fail(404,'The working record was not found.','not_found');
 const body=suiteBody(row,SUITE_BY_KEY[domain]);
 if(!body)fail(404,'That record belongs to another work area.','invalid_area');
 return body;
}
export async function suiteActionEndpoint(req,env,path,identity){
 if(req.method!=='POST')fail(405,'This action requires an explicit officer request.','method_not_allowed');
 const parsed=path.match(/^\/api\/suite\/(meetings|stock)\/([a-f0-9-]{36})\/(followups|movement)$/);
 if(!parsed||!isUuid(parsed[2]))fail(404,'Unknown Sandy committee action.','not_found');
 const [_,domain,recordId,action]=parsed;
 if((domain==='meetings'&&action!=='followups')||(domain==='stock'&&action!=='movement'))
  fail(404,'This operation does not belong to that work area.','not_found');
 requireRole(identity,domain==='stock'?['webmaster','treasurer']:['webmaster','president','secretary','assistant_secretary']);
 const db=dbFor(env),row=await db.prepare('SELECT * FROM club_records WHERE id=? AND kind=?').bind(recordId,domain==='stock'?'asset':'meeting').first();
 const body=readRecord(row,domain),request=await payload(req,5000),at=now();
 if(domain==='meetings'){
  if(version(request.version)!==row.version)fail(409,'The meeting has changed. Reload before creating its follow-ups.','conflict');
  const lines=String(body.fields.followUps||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length)fail(400,'Add actual follow-up actions to the meeting record before creating tasks.','no_followups');
  if(lines.length>25)fail(400,'Create at most 25 follow-up tasks from one meeting version.','too_many_followups');
  let skipped=0,created=0;const stmts=[];
  for(let i=0;i<lines.length;i++){
   const source=lines[i],parts=source.split('|').map(x=>x.trim()),actionText=field(parts[0],250);
   if(!actionText)continue;
   const known=await db.prepare("SELECT id FROM club_records WHERE kind='task' AND json_extract(body_json,'$.sandySuiteVersion')=1 AND json_extract(body_json,'$.sourceMeeting')=? AND json_extract(body_json,'$.sourceIndex')=? LIMIT 1").bind(recordId,i).first();
   if(known){skipped++;continue}
   let due='';if(parts[2])due=dateField(parts[2])||'';
   const fields={action:actionText,owner:field(parts[1],100),dueDate:due,priority:'Normal',
    linkedDesk:recordId,progress:'Created from meeting '+row.title,complete:false};
   const bodyJSON=JSON.stringify({sandySuiteVersion:1,domain:'todos',sourceMeeting:recordId,sourceIndex:i,fields});
   const taskId=id();created++;
   stmts.push(
    db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'task',? ,?,'draft',?,1,?,?,?,?)")
     .bind(taskId,actionText,bodyJSON,due||null,identity.id,identity.id,at,at),
    revision(db,{kind:'record',resourceId:taskId,resourceVersion:1,action:'meeting_followup_created',actor:identity,at,
     snapshot:{sourceMeeting:recordId,title:actionText,fields}}),
    audit(db,identity,'meeting_followup_created','record',taskId,at)
   );
  }
  if(stmts.length)await db.batch(stmts);
  return json({ok:true,created,alreadyPresent:skipped,total:lines.length,notice:'Tasks are now recorded in Officer to-do lists. No one was notified or assigned without their acceptance.'});
 }
 const direction=field(request.direction,20),qty=Number(request.quantity),note=field(request.note,500);
 if(!['receive','issue'].includes(direction)||!Number.isInteger(qty)||qty<1||qty>100000)
  fail(400,'Choose Receive or Issue and a positive whole quantity.','invalid_movement');
 if(version(request.version)!==row.version)fail(409,'Stock changed. Reload the latest balance before recording this movement.','conflict');
 const fields={...body.fields},opening=Number(fields.opening||0),inward=Number(fields.inward||0),outward=Number(fields.outward||0);
 const available=opening+inward-outward;
 if(direction==='issue'&&qty>available)fail(409,'Not enough stock is available to issue that quantity.','insufficient_stock');
 fields.inward=inward+(direction==='receive'?qty:0);
 fields.outward=outward+(direction==='issue'?qty:0);
 const nextVersion=row.version+1,newBalance=opening+Number(fields.inward||0)-Number(fields.outward||0);
 const nextBody=JSON.stringify({...body,fields});
 const [saved]=await db.batch([
  db.prepare("UPDATE club_records SET body_json=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND kind='asset'")
   .bind(nextBody,identity.id,at,recordId,row.version),
  revision(db,{kind:'record',resourceId:recordId,resourceVersion:nextVersion,action:'stock_'+direction,actor:identity,at,
   changes:{direction,quantity:qty,note,balanceAfter:newBalance},snapshot:{sku:fields.sku,balance:newBalance},guarded:true}),
  audit(db,identity,'stock_'+direction,'record',recordId,at,true)
 ]);
 if(!saved.meta.changes)fail(409,'Stock changed during this movement. Reload it.','conflict');
 return json({ok:true,version:nextVersion,balance:newBalance,direction,quantity:qty,
  notice:'The movement and its officer attribution were recorded in Sandy D1. No sale or payment was processed.'});
}
