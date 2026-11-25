// Restricted age-band and guardian checks; no identity documents, birthdates,
// guardian names, health details or incident narratives are collected.
import {fail,json,now,id,dbFor,payload,field,version,requireRole,revision,audit} from './shared.mjs';
import {purposeOf} from './record-policy.mjs';
export const SAFEGUARD_ROLES=['webmaster','president','secretary'];
export const TERMS_VERSION='sandy-participation-v1';
export const TERMS='Optional participation: an adult may choose to be asked about contact, volunteering or publication. This is not event-specific permission, an assignment or approval of membership. Consent may be withdrawn at any time. Minor accounts require privately verified guardian permission for private self-service and cannot enable optional adult participation under this provisional policy.';
const bands=['unconfirmed','under16','16-17','adult'];
const validId=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
const initial=()=>({ageBand:'unconfirmed',guardianPermission:false,termsAccepted:false,termsVersion:'',verifiedAt:null,verifiedBy:null});
function from(row){
 const f=JSON.parse(row.body_json).fields;
 return {ageBand:bands.includes(f.ageBand)?f.ageBand:'unconfirmed',guardianPermission:f.guardianPermission===true,
  termsAccepted:f.termsAccepted===true,termsVersion:typeof f.termsVersion==='string'?f.termsVersion:'',verifiedAt:f.verifiedAt||null,
  verifiedBy:f.verifiedBy||null,recordId:row.id,version:row.version};
}
async function rowFor(db,accountId){
 const row=await db.prepare("SELECT * FROM club_records WHERE kind='safeguard' AND json_extract(body_json,'$.sandyMemberSafeguard')=1 AND json_extract(body_json,'$.ownerId')=? ORDER BY updated_utc DESC,id DESC LIMIT 1").bind(accountId).first();
 if(purposeOf(row)?.type!=='member-safeguard')return null;
 const origin=await db.prepare("SELECT actor_role,operation FROM club_revisions WHERE resource_kind='record' AND resource_id=? AND resource_version=1").bind(row.id).first();
 return origin?.operation==='safeguard_verified'&&SAFEGUARD_ROLES.includes(origin.actor_role)?row:null;
}
export async function memberSafeguardFlags(db,accountId){
 const row=await rowFor(db,accountId),data=row?from(row):{...initial(),recordId:null,version:0};
 const privateAccess=data.ageBand==='adult'||(['under16','16-17'].includes(data.ageBand)&&data.guardianPermission===true);
 const accepted=data.ageBand==='adult'&&data.termsAccepted===true&&data.termsVersion===TERMS_VERSION;
 return {ageBand:data.ageBand,guardianPermission:data.guardianPermission===true,accepted,termsVersion:TERMS_VERSION,terms:TERMS,
  version:data.version,recordId:data.recordId,verifiedAt:data.verifiedAt,privateAccess,
  optionalParticipation:privateAccess&&accepted,canRequestPublication:privateAccess&&accepted};
}
export async function requireParticipation(db,identity){
 const flags=await memberSafeguardFlags(db,identity.id);
 if(!flags.privateAccess)fail(403,'A designated safeguarding officer must verify your age group and any required guardian permission before self-service is available.','safeguards_required');
 return flags;
}
export const participationGuard="EXISTS(SELECT 1 FROM club_records s WHERE s.id=? AND s.version=? AND s.kind='safeguard' AND json_extract(s.body_json,'$.sandyMemberSafeguard')=1 AND json_extract(s.body_json,'$.ownerId')=?) AND EXISTS(SELECT 1 FROM club_people p JOIN club_accounts a ON a.id=p.account_id WHERE p.account_id=? AND p.status='active' AND a.state='active' AND a.role='member')";
export const participationArgs=(identity,flags)=>[flags.recordId,flags.version,identity.id,identity.id];
const shape=(account,flags)=>({accountId:account.id,username:account.username,state:account.state,ageBand:flags.ageBand,guardianPermission:flags.guardianPermission,accepted:flags.accepted,version:flags.version,verifiedAt:flags.verifiedAt});
function strict(body,keys){if(Object.keys(body).some(k=>!keys.includes(k)))fail(400,'Only minimal safeguarding choices are accepted.','invalid_safeguard')}
async function save(db,identity,accountId,row,fields,action){
 const at=now(),recordId=row?.id||id(),nextVersion=(row?.version||0)+1,body={sandyMemberSafeguard:1,ownerId:accountId,fields};
 const guard="EXISTS(SELECT 1 FROM club_accounts WHERE id=? AND role='member' AND state='active')"+(action==='safeguard_terms_accepted'?" AND EXISTS(SELECT 1 FROM club_people WHERE account_id=? AND status='active')":'');
 const args=action==='safeguard_terms_accepted'?[accountId,accountId]:[accountId];
 const write=row?db.prepare("UPDATE club_records SET body_json=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND "+guard)
  .bind(JSON.stringify(body),identity.id,at,recordId,row.version,...args):
  db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,'safeguard','Restricted participation check',?,'draft',NULL,1,?,?,?,? WHERE "+guard+" AND NOT EXISTS(SELECT 1 FROM club_records WHERE kind='safeguard' AND json_extract(body_json,'$.sandyMemberSafeguard')=1 AND json_extract(body_json,'$.ownerId')=?)")
  .bind(recordId,JSON.stringify(body),identity.id,identity.id,at,at,...args,accountId);
 const [result]=await db.batch([write,
  revision(db,{kind:'record',resourceId:recordId,resourceVersion:nextVersion,action,actor:identity,at,changes:{fromVersion:nextVersion-1,toVersion:nextVersion,reason:action},snapshot:fields,guarded:true}),
  audit(db,identity,action,'record',recordId,at,true)]);
 if(!result.meta.changes)fail(409,'The participation check changed. Reload before saving.','conflict');
 return memberSafeguardFlags(db,accountId);
}
export async function safeguardsEndpoint(req,env,path,identity){
 const committee=path==='/api/committee/safeguards';
 requireRole(identity,committee?SAFEGUARD_ROLES:['member']);
 const db=dbFor(env),url=new URL(req.url);
 if(committee){
  if(req.method==='GET'){
   const q=field(url.searchParams.get('q'),80);
   if(!q)return json({members:[],termsVersion:TERMS_VERSION});
   const a=await db.prepare("SELECT id,username,state FROM club_accounts WHERE role='member' AND username=? COLLATE NOCASE LIMIT 1").bind(q).first();
   return json({members:a?[shape(a,await memberSafeguardFlags(db,a.id))]:[],termsVersion:TERMS_VERSION});
  }
  if(req.method!=='POST')fail(405,'Use the restricted safeguarding review.','method_not_allowed');
  if(env.SANDY_CLUB_APPROVALS!=='enabled')fail(409,'Actual member safeguarding verification is disabled during club formation.','club_not_established');
  const b=await payload(req,2048);
  strict(b,['action','accountId','version','ageBand','guardianPermission','ageCheckedOffline','guardianCheckedOffline']);
  if(b.action!=='verify'||!validId(b.accountId)||!bands.includes(b.ageBand)||typeof b.guardianPermission!=='boolean'||(b.guardianPermission&&!['under16','16-17'].includes(b.ageBand)))fail(400,'Select an age group and applicable guardian permission.','invalid_safeguard');
  const a=await db.prepare("SELECT id,username,state FROM club_accounts WHERE id=? AND role='member'").bind(b.accountId).first();
  if(!a||a.state!=='active')fail(404,'No active member account was found.','member_not_found');
  const row=await rowFor(db,a.id),before=row?from(row):initial();
  if(version(b.version)!==(row?.version||0))fail(409,'The participation check changed. Reload before saving.','conflict');
  if(b.ageBand!=='unconfirmed'&&b.ageBand!==before.ageBand&&b.ageCheckedOffline!==true)fail(400,'Verify the age group privately before recording it.','age_check_required');
  if(b.guardianPermission&&(!before.guardianPermission||before.ageBand!==b.ageBand)&&b.guardianCheckedOffline!==true)fail(400,'Verify guardian authority privately before recording permission.','guardian_check_required');
  if(before.ageBand===b.ageBand&&before.guardianPermission===b.guardianPermission)return json({member:shape(a,await memberSafeguardFlags(db,a.id))});
  const next={ageBand:b.ageBand,guardianPermission:b.guardianPermission,termsAccepted:false,termsVersion:'',verifiedAt:now(),verifiedBy:identity.id};
  return json({member:shape(a,await save(db,identity,a.id,row,next,'safeguard_verified'))});
 }
 const flags=await memberSafeguardFlags(db,identity.id);
 if(req.method==='GET')return json(flags);
 if(req.method!=='POST')fail(405,'Choose accept or withdraw.','method_not_allowed');
 const b=await payload(req,2048);strict(b,['action','version','termsVersion']);
 if(!['accept','withdraw'].includes(b.action)||b.termsVersion!==TERMS_VERSION)fail(409,'Read the current participation terms before recording a choice.','terms_changed');
 if(version(b.version)!==flags.version)fail(409,'The participation check changed. Reload before saving.','conflict');
 const row=await rowFor(db,identity.id);
 if((row?.version||0)!==flags.version)fail(409,'The participation check changed. Reload before saving.','conflict');
 if(b.action==='accept'){
  if(env.SANDY_CLUB_APPROVALS!=='enabled')fail(409,'Member participation is not active during club formation.','club_not_established');
  if(!await db.prepare("SELECT id FROM club_people WHERE account_id=? AND status='active' LIMIT 1").bind(identity.id).first())fail(409,'A linked active membership is required.','membership_not_active');
  if(flags.ageBand!=='adult'||!flags.privateAccess)fail(403,'Optional contact, publication and volunteering choices are unavailable under the provisional minor-safety policy.','safeguards_required');
 }
 if(!row||flags.accepted===(b.action==='accept'))return json(flags);
 const before=from(row),next={ageBand:before.ageBand,guardianPermission:before.guardianPermission,verifiedAt:before.verifiedAt,verifiedBy:before.verifiedBy,termsVersion:TERMS_VERSION,termsAccepted:b.action==='accept'};
 return json(await save(db,identity,identity.id,row,next,b.action==='accept'?'safeguard_terms_accepted':'safeguard_terms_withdrawn'));
}
