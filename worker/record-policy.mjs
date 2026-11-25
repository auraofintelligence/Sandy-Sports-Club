// Shared purpose policy for the existing club_records store. No migration or data copy.
// The generic register never acts as a second editor for dedicated workflows.
import {fail,requireRole,STAFF} from './shared.mjs';
import {SUITE_BY_KEY,SUITE_DESKS} from '../studio/sandy-suite-spec.js';
const owns=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const reserved=['sandySuiteVersion','sandyWebmasterRequest','sandyMemberWorkspace','sandyMemberSafeguard','sandyCommitteeReceipt'];
const safeObject=body=>body&&typeof body==='object'&&!Array.isArray(body);
const restrictedGeneric=kind=>{
 const desks=SUITE_DESKS.filter(d=>d.kind===kind);
 // Unclassified legacy drafts retain access only for roles permitted in every possible desk.
 // No unrestricted kind fallback for safeguarding or internal notices.
 if(kind==='safeguard')return ['webmaster','president','secretary'];
 return STAFF.filter(role=>desks.every(d=>d.roles.includes(role)));
};
export function recordPurpose(kind,body){
 if(!safeObject(body))return null;
 const marks=reserved.filter(k=>owns(body,k));
 if(marks.length>1)return null;
 if(marks.length){
  if(owns(body,'desk')||body.source==='sandy-committee-room-v1'||body.source==='sandy-constitution-builder')return null;
  if(marks[0]==='sandyCommitteeReceipt')
   return kind==='notice'&&body.sandyCommitteeReceipt===1&&typeof body.ownerId==='string'&&typeof body.noticeId==='string'?{type:'committee-receipt',key:'receipt',roles:[]}:null;
  if(marks[0]==='sandyWebmasterRequest')
   return kind==='notice'&&body.sandyWebmasterRequest===1?{type:'help',key:'help',roles:['webmaster']}:null;
  if(marks[0]==='sandyMemberSafeguard')
   return kind==='safeguard'&&body.sandyMemberSafeguard===1&&typeof body.ownerId==='string'&&safeObject(body.fields)?{type:'member-safeguard',key:'participation-check',roles:['webmaster','president','secretary']}:null;
  if(marks[0]==='sandyMemberWorkspace')
   return kind==='safeguard'&&body.sandyMemberWorkspace===1&&['preferences','wish'].includes(body.type)&&typeof body.ownerId==='string'?{type:'member',key:body.type,roles:[]}:null;
  const desk=SUITE_BY_KEY[body.domain];
  return body.sandySuiteVersion===1&&desk&&desk.kind===kind&&safeObject(body.fields)?{type:'suite',key:desk.key,roles:desk.roles}:null;
 }
 if(body.source==='sandy-constitution-builder')
  return kind==='governance'&&!owns(body,'desk')?{type:'generic',key:'constitution',roles:STAFF}:null;
 if(body.source==='sandy-committee-room-v1'||owns(body,'desk')){
  const desk=SUITE_BY_KEY[body.desk];
  return body.source==='sandy-committee-room-v1'&&desk&&desk.kind===kind?{type:'generic',key:'legacy:'+desk.key,roles:desk.roles}:null;
 }
 return {type:'generic',key:'working:'+kind,roles:restrictedGeneric(kind)};
}
export function purposeOf(row){
 if(!row)return null;
 try{
  const body=JSON.parse(row.body_json),purpose=recordPurpose(row.kind,body);
  if(['member','committee-receipt'].includes(purpose?.type)&&body.ownerId!==row.created_by)return null;
  return purpose;
 }catch{return null}
}
export function genericAllowed(row,identity){
 const p=purposeOf(row);
 return p?.type==='generic'&&p.roles.includes(identity?.role);
}
export function requireGeneric(row,identity){
 requireRole(identity,STAFF);
 if(!genericAllowed(row,identity))fail(404,'No working record exists with that identifier.','record_not_found');
}
export function requireGenericWrite(record,identity,before){
 requireRole(identity,STAFF);
 const p=recordPurpose(record.kind,record.body);
 if(p?.type!=='generic')fail(400,'Use the dedicated club workflow for this record purpose.','invalid_record_purpose');
 if(!p.roles.includes(identity.role))fail(403,'This working record requires additional office access.','forbidden');
 if(before&&purposeOf(before)?.key!==p.key)fail(400,'A working edit cannot change the record purpose.','invalid_record_purpose');
}
export function suiteBody(row,desk){
 const p=purposeOf(row);
 return p?.type==='suite'&&p.key===desk.key?JSON.parse(row.body_json):false;
}
export function legacyNoticeRecipients(body){
 const audience=body.fields?.audience;
 if(audience==='President and secretary')return ['webmaster','president','secretary','assistant_secretary'];
 if(audience==='Office holders')return STAFF.filter(r=>r!=='committee');
 if(audience==='Project leads')return ['webmaster'];
 return [...STAFF];
}
export const taskAllocators=['webmaster','secretary','assistant_secretary'];
// Preserve previously shared working drafts; new operational notices and tasks
// have server-owned recipient/office boundaries on every alternate read.
export function suiteAllowed(row,desk,identity){
 const body=suiteBody(row,desk);if(!body||!desk.roles.includes(identity?.role))return false;
 const ops=body.committeeOps;
 if(!ops)return desk.key!=='notices'||identity.role==='webmaster'||row.created_by===identity.id||legacyNoticeRecipients(body).includes(identity.role);
 if(desk.key==='notices')return ops.kind==='notice'&&(identity.role==='webmaster'||row.created_by===identity.id||Array.isArray(ops.recipients)&&ops.recipients.includes(identity.role));
 if(desk.key==='todos')return ops.kind==='task'&&(taskAllocators.includes(identity.role)||!ops.office||(ops.office===identity.role&&(!ops.claimedBy||ops.claimedBy===identity.id)));
 return false;
}
export function helpAllowed(row,identity){
 return purposeOf(row)?.type==='help'&&Boolean(identity&&(identity.role==='webmaster'||row.created_by===identity.id));
}
export function memberOwns(row,identity){
 return purposeOf(row)?.type==='member'&&identity?.role==='member'&&row.created_by===identity.id;
}
export function calendarAllowed(row,identity){
 const p=purposeOf(row);
 return Boolean(p&&['suite','generic'].includes(p.type)&&p.roles.includes(identity?.role)&&['event','meeting'].includes(row.kind));
}
export function memberPublicationAllowed(row){
 const p=purposeOf(row);
 if(!p||row.status!=='approved'||!['generic','suite'].includes(p.type))return false;
 // Internal notices are not member publications, even if their working status says approved.
 if(row.kind==='notice')return p.key==='member-notice'||p.key==='legacy:member-notice';
 return ['event','newsletter'].includes(row.kind);
}
export function recordAuditAllowed(row,identity,action){
 if(!row||!identity)return false;
 const p=purposeOf(row);
 if(!p)return false;
 if(action.startsWith('webmaster_request_')||p.type==='help')return identity.role==='webmaster'&&p.type==='help';
 if(action.startsWith('member_preferences_')||action.startsWith('member_interest_')||p.type==='member')return false;
 if(p.type==='committee-receipt')return identity.role==='webmaster'||row.created_by===identity.id;
 if(p.type==='suite')return suiteAllowed(row,SUITE_BY_KEY[p.key],identity);
 if(p.type==='member-safeguard'||action.startsWith('safeguard_'))return p.type==='member-safeguard'&&p.roles.includes(identity.role);
 return p.roles.includes(identity.role);
}
// Filter before applying the visible limit. The query clauses are server-owned literals.
export async function visibleRecords(db,where,args,order,limit,allowed){
 const visible=[];
 for(let offset=0;visible.length<limit;offset+=100){
  const q=await db.prepare('SELECT * FROM club_records '+where+' ORDER BY '+order+' LIMIT 100 OFFSET ?').bind(...args,offset).all();
  const rows=q.results||[];
  for(const row of rows){if(allowed(row))visible.push(row);if(visible.length===limit)break}
  if(rows.length<100)break;
 }
 return visible;
}
