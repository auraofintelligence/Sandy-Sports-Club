// Formal decision and member release for existing club_records (SEC-08).
// Fails closed while SANDY_CLUB_APPROVALS is disabled. Three distinct states:
// a working draft or review, an authorised decision on one exact version, and
// a separate member release of that approved version. Nothing is sent or published
// outside the clubhouse; release only makes an approved record visible to active members.
import {fail,json,now,id,payload,field,https,version,ensureApprover,revision,audit} from './shared.mjs';
import {RELEASE_KEY,releasable,releasedVersion} from './record-policy.mjs';
const DECISIONS=['approved','rejected','returned','release'];
export function rejectClientRelease(body){
 if(body&&typeof body==='object'&&Object.prototype.hasOwnProperty.call(body,RELEASE_KEY))
  fail(400,'Member release is recorded only by an authorised decision.','invalid_record_purpose');
}
/**
 * Record a decision against the current version of a record whose purpose and office
 * access the caller has already verified. `area` labels audit actions (record or suite).
 */
export async function decideRecord(req,env,db,identity,row,area){
 ensureApprover(identity,env);
 const b=await payload(req,8192),decision=field(b.decision,32),expected=version(b.version);
 if(!DECISIONS.includes(decision))fail(400,'Choose approve, reject, return for changes or release to members.','invalid_decision');
 if(row.version!==expected)fail(409,'Review the latest record version before deciding.','conflict');
 const evidence=https(b.evidence);
 if(!evidence)fail(400,'Record a supporting HTTPS decision reference.','evidence_required');
 const reason=field(b.reason,500);
 const at=now(),newVersion=row.version+1,decisionId=id(),body=JSON.parse(row.body_json);
 delete body[RELEASE_KEY];
 let newStatus,stored=decision,approvalId=null;
 if(decision==='release'){
  if(!releasable(row))fail(400,'Only member events, newsletters and member notices can be released to members.','release_not_applicable');
  if(row.status!=='approved')fail(409,'Approve this exact version before releasing it to members.','approval_required');
  if(releasedVersion(row))fail(409,'This version is already released to members.','already_released');
  const approval=await db.prepare("SELECT id FROM studio_decisions WHERE entity_type='record' AND entity_id=? AND entity_version=? AND decision='approved' LIMIT 1").bind(row.id,row.version).first();
  if(!approval)fail(409,'An approval for this exact record version must exist before release.','approval_required');
  approvalId=approval.id;newStatus='approved';stored='publish_authorised';
  body[RELEASE_KEY]={decisionId,approvalId,version:newVersion,releasedBy:identity.id,releasedOffice:identity.office_label||identity.role,releasedUtc:at};
 }else{
  if(decision==='approved'&&row.status==='approved')fail(409,'This version is already approved.','already_decided');
  if(decision==='rejected'&&row.status==='rejected')fail(409,'This record is already rejected.','already_decided');
  newStatus=decision==='approved'?'approved':decision==='rejected'?'rejected':'review';
 }
 const [saved]=await db.batch([
  db.prepare('UPDATE club_records SET status=?,body_json=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=?')
   .bind(newStatus,JSON.stringify(body),identity.id,at,row.id,row.version),
  db.prepare("INSERT INTO studio_decisions(id,entity_type,entity_id,entity_version,decision,scope_json,evidence_url,authorised_actor,authorised_office,decided_utc) SELECT ?,'record',?,?,?,?,?,?,?,? WHERE changes()=1")
   .bind(decisionId,row.id,decision==='release'?row.version:newVersion,stored,JSON.stringify({kind:row.kind,title:row.title,area,...(approvalId?{approvalId,releasedVersion:newVersion}:{})}),evidence,identity.id,identity.office_label||identity.role,at),
  revision(db,{kind:'record',resourceId:row.id,resourceVersion:newVersion,action:area+'_decision_'+decision,actor:identity,at,
   snapshot:{title:row.title,status:newStatus,version:newVersion,...body},changes:{decision,evidence,from:row.status,to:newStatus,fromVersion:row.version,toVersion:newVersion,reason:reason||'Formal decision'},guarded:true}),
  audit(db,identity,area+'_decision_'+decision,'record',row.id,at,true,{fromVersion:row.version,toVersion:newVersion})
 ]);
 if(!saved.meta.changes)fail(409,'This record was already decided or changed.','conflict');
 return json({ok:true,id:row.id,version:newVersion,decisionId,decision,status:newStatus,released:decision==='release',decidedAt:at});
}
