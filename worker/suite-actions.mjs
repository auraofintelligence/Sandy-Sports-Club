// Cross-desk operational actions, all explicitly triggered by a real signed-in officer.
// Creates meeting follow-up tasks and maintains an audited stock movement balance.
import {fail,json,now,id,dbFor,payload,field,dateField,version,requireRole,revision,audit,ACCESS_GROUPS} from './shared.mjs';
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
 requireRole(identity,domain==='stock'?ACCESS_GROUPS.money:ACCESS_GROUPS.secretariat);
 const db=dbFor(env),row=await db.prepare('SELECT * FROM club_records WHERE id=? AND kind=?').bind(recordId,domain==='stock'?'asset':'meeting').first();
 const body=readRecord(row,domain),request=await payload(req,5000),at=now();
 if(domain==='meetings'){
  if(version(request.version)!==row.version)fail(409,'The meeting has changed. Reload before creating its follow-ups.','conflict');
  const lines=String(body.fields.followUps||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length)fail(400,'Add actual follow-up actions to the meeting record before creating tasks.','no_followups');
  if(lines.length>25)fail(400,'Create at most 25 follow-up tasks from one meeting version.','too_many_followups');
  // Keep the existing sourceMeeting/sourceIndex key, including old task IDs.
  // The conditional insert is evaluated inside the same transaction as its history/audit.
  const stmts=[];
  for(let i=0;i<lines.length;i++){
   const parts=lines[i].split('|').map(x=>x.trim()),actionText=field(parts[0],250);
   if(!actionText)continue;
   let due='';if(parts[2])due=dateField(parts[2])||'';
   const fields={action:actionText,owner:field(parts[1],100),dueDate:due,priority:'Normal',
    linkedDesk:recordId,progress:'Created from meeting '+row.title,complete:false};
   const bodyJSON=JSON.stringify({sandySuiteVersion:1,domain:'todos',sourceMeeting:recordId,sourceIndex:i,sourceVersion:row.version,fields});
   const taskId=id();
   stmts.push(
    db.prepare(`INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc)
      SELECT ?,'task',?,?,'draft',?,1,?,?,?,?
      WHERE EXISTS(SELECT 1 FROM club_records WHERE id=? AND version=? AND kind='meeting')
      AND NOT EXISTS(SELECT 1 FROM club_records WHERE kind='task' AND json_extract(body_json,'$.sandySuiteVersion')=1
       AND json_extract(body_json,'$.sourceMeeting')=? AND json_extract(body_json,'$.sourceIndex')=?)`)
     .bind(taskId,actionText,bodyJSON,due||null,identity.id,identity.id,at,at,recordId,row.version,recordId,i),
    revision(db,{kind:'record',resourceId:taskId,resourceVersion:1,action:'meeting_followup_created',actor:identity,at,
     snapshot:{sourceMeeting:recordId,sourceIndex:i,sourceVersion:row.version,title:actionText,fields},guarded:true}),
    audit(db,identity,'meeting_followup_created','record',taskId,at,true,{fromVersion:0,toVersion:1})
   );
  }
  const results=stmts.length?await db.batch(stmts):[];
  const created=results.filter((_,i)=>i%3===0).reduce((n,x)=>n+Number(x.meta.changes||0),0);
  if(!created){
   const latest=await db.prepare('SELECT version FROM club_records WHERE id=?').bind(recordId).first();
   if(latest?.version!==row.version)fail(409,'The meeting changed before follow-ups could be created. Reload it.','conflict');
  }
  return json({ok:true,created,alreadyPresent:stmts.length/3-created,total:lines.length,notice:'Tasks are now recorded in Officer to-do lists. No one was notified or assigned without their acceptance.'});
 }
 const direction=field(request.direction,20),qty=Number(request.quantity),note=field(request.note,500),expected=version(request.version);
 const mutationId=request.mutationId;
 if(mutationId!==undefined&&(typeof mutationId!=='string'||!isUuid(mutationId)))fail(400,'Use a valid stock movement request ID.','invalid_mutation');
 // receive/issue move stock; count records a stocktake; adjust is a reasoned correction.
 const signed=direction==='adjust';
 if(!['receive','issue','count','adjust'].includes(direction)||!Number.isInteger(qty)||(direction==='count'?qty<0:signed?qty===0:qty<1)||Math.abs(qty)>100000)
  fail(400,'Choose Receive, Issue, Count or Adjust with a whole quantity.','invalid_movement');
 if(signed&&!note)fail(400,'Record the reason for a stock correction.','reason_required');
 let unitCost=null;
 if(direction==='receive'&&request.unitCost!==undefined&&request.unitCost!==null&&request.unitCost!==''){
  unitCost=Number(request.unitCost);if(!Number.isFinite(unitCost)||unitCost<0||unitCost>1e6)fail(400,'Use a valid unit cost in AUD.','invalid_cost');
  unitCost=Math.round(unitCost*100)/100;
 }
 const supplier=direction==='receive'?field(request.supplier,150):'';
 const today=new Date(Date.now()+36e6).toISOString().slice(0,10);
 const movementDate=request.movementDate?dateField(request.movementDate,false):today;
 if(movementDate>today)fail(400,'A movement cannot be dated in the future.','future_movement');
 const replay=async()=>{
  if(!mutationId)return null;
  const old=await db.prepare("SELECT resource_version,actor_id,changes_json FROM club_revisions WHERE resource_kind='record' AND resource_id=? AND json_extract(changes_json,'$.mutationId')=? LIMIT 1").bind(recordId,mutationId).first();
  if(!old)return null;
  const change=JSON.parse(old.changes_json);
  if(old.actor_id!==identity.id||old.resource_version!==expected+1||change.direction!==direction||change.quantity!==qty||change.note!==note)
   fail(409,'This stock movement request ID belongs to a different operation.','mutation_conflict');
  return json({ok:true,version:old.resource_version,balance:change.balanceAfter,direction,quantity:qty,replayed:true,notice:'Existing movement confirmed. No second movement was recorded.'});
 };
 const previous=await replay();if(previous)return previous;
 if(expected!==row.version)fail(409,'Stock changed. Reload the latest balance before recording this movement.','conflict');
 if(row.status==='approved'||row.status==='archived')fail(409,'This stock record is locked. Open an authorised working record.','locked');
 const fields={...body.fields},ops={adjust:0,...(body.stockOps||{})},opening=Number(fields.opening||0),inward=Number(fields.inward||0),outward=Number(fields.outward||0);
 const available=opening+inward-outward+Number(ops.adjust||0);
 const delta=direction==='receive'?qty:direction==='issue'?-qty:direction==='count'?qty-available:qty;
 if(available+delta<0)fail(409,direction==='issue'?'Not enough stock is available to issue that quantity.':'A correction cannot take stock below zero.','insufficient_stock');
 if(direction==='receive')fields.inward=inward+qty;
 if(direction==='issue')fields.outward=outward+qty;
 if(direction==='count'||signed)ops.adjust=Number(ops.adjust||0)+delta;
 const nextVersion=row.version+1,newBalance=available+delta;
 const nextBody=JSON.stringify({...body,fields,stockOps:ops});
 const [saved]=await db.batch([
  db.prepare("UPDATE club_records SET body_json=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND kind='asset' AND status NOT IN ('approved','archived')")
   .bind(nextBody,identity.id,at,recordId,row.version),
  revision(db,{kind:'record',resourceId:recordId,resourceVersion:nextVersion,action:'stock_'+direction,actor:identity,at,
   changes:{direction,quantity:qty,delta,note,balanceBefore:available,balanceAfter:newBalance,movementDate,...(unitCost!==null?{unitCost}:{}),...(supplier?{supplier}:{}),fromVersion:expected,toVersion:nextVersion,...(mutationId?{mutationId}:{})},snapshot:{title:row.title,status:row.status,fields,stockOps:ops,balance:newBalance},guarded:true}),
  audit(db,identity,'stock_'+direction,'record',recordId,at,true,{fromVersion:expected,toVersion:nextVersion})
 ]);
 if(!saved.meta.changes){const previous=await replay();if(previous)return previous;fail(409,'Stock changed during this movement. Reload it.','conflict');}
 return json({ok:true,version:nextVersion,balance:newBalance,direction,quantity:qty,delta,
  notice:'The movement and its officer attribution were recorded in Sandy D1. No sale or payment was processed.'});
}
