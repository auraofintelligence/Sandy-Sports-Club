// Sandy member portal: privacy-scoped real member preferences, activity choices and club data exports.
// Nothing here enrolls a member, charges fees, sends email or claims an event is approved.
import {fail,json,now,id,dbFor,payload,field,version,revision,audit,requireRole} from './shared.mjs';
import {memberOwns,memberPublicationAllowed,visibleRecords} from './record-policy.mjs';
import {memberSafeguardFlags,requireParticipation,participationGuard,participationArgs} from './member-safeguards.mjs';
const sports=['Mixed beach volleyball','Beach cricket','Flag football','Beach soccer','Beach rugby','AirBadminton','Beach tennis','Beach handball','Fitness and movement','Multi-sport'];
const availability=['Weekday morning','Weekday afternoon','Weekday evening','Weekend morning','Weekend afternoon','School holidays','Occasional events'];
const options=['sport','film','volunteer','community'];
const allowedStatuses=['interested','going','not_going'];
const convert=row=>{const b=JSON.parse(row.body_json);return {id:row.id,type:b.type,version:row.version,
 fields:b.fields,createdAt:row.created_utc,updatedAt:row.updated_utc}};
async function linkedActiveMember(db,identity){
 const profile=await db.prepare("SELECT id,full_name,membership_class,status,town,joined_on,renewal_on,consent_contact,consent_publication FROM club_people WHERE account_id=? AND status='active' LIMIT 1").bind(identity.id).first();
 if(!profile)fail(409,'There is no active membership linked to this account. Contact an authorised officer.','membership_not_active');
 return profile;
}
function cleanPreferences(body,flags){
 const list=(value,allowed,max)=>Array.isArray(value)?[...new Set(value)].filter(v=>typeof v==='string'&&allowed.includes(v)).slice(0,max):[];
 return {sports:list(body.sports,sports,10),availability:list(body.availability,availability,7),
  filmClub:body.filmClub===true,volunteer:body.volunteer===true,communityEvents:body.communityEvents===true,
  contactPreference:['no_contact','email_when_consented','phone_when_consented'].includes(body.contactPreference)?body.contactPreference:'no_contact',
  publicationConsent:flags.optionalParticipation&&body.publicationConsent===true,notes:field(body.notes,1600),
  ...(flags.optionalParticipation?{sharingRevision:flags.version}:{volunteer:false,contactPreference:'no_contact',sharingRevision:null})};
}
async function ownRecords(db,identity,type){
 const rows=await visibleRecords(db,"WHERE kind='safeguard' AND json_extract(body_json,'$.sandyMemberWorkspace')=1 AND json_extract(body_json,'$.ownerId')=? AND json_extract(body_json,'$.type')=?",[identity.id,type],'updated_utc DESC,id DESC',80,row=>memberOwns(row,identity));
 return rows.map(convert);
}
async function savePreference(db,identity,fields,expected,flags){
 const current=(await ownRecords(db,identity,'preferences'))[0],at=now(),body={sandyMemberWorkspace:1,type:'preferences',ownerId:identity.id,fields};
 if(current){
  if(current.version!==version(expected))fail(409,'These member preferences have changed. Reload them.','conflict');
  const nextVersion=current.version+1;
  const [updated]=await db.batch([
   db.prepare("UPDATE club_records SET body_json=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND "+participationGuard)
    .bind(JSON.stringify(body),identity.id,at,current.id,current.version,...participationArgs(identity,flags)),
   revision(db,{kind:'record',resourceId:current.id,resourceVersion:nextVersion,action:'member_preferences_updated',actor:identity,at,snapshot:fields,guarded:true}),
   audit(db,identity,'member_preferences_updated','record',current.id,at,true)
  ]);
  if(!updated.meta.changes)fail(409,'Your preferences were updated elsewhere. Reload before saving.','conflict');
  return json({ok:true,id:current.id,version:nextVersion});
 }
 if(expected!==0&&expected!==undefined)fail(409,'Reload your member profile before saving.','conflict');
 const recordId=id();
 const [inserted]=await db.batch([
  db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,'safeguard','Private member preferences',?,'draft',NULL,1,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM club_records WHERE kind='safeguard' AND created_by=? AND json_extract(body_json,'$.sandyMemberWorkspace')=1 AND json_extract(body_json,'$.ownerId')=? AND json_extract(body_json,'$.type')='preferences') AND "+participationGuard)
   .bind(recordId,JSON.stringify(body),identity.id,identity.id,at,at,identity.id,identity.id,...participationArgs(identity,flags)),
  revision(db,{kind:'record',resourceId:recordId,resourceVersion:1,action:'member_preferences_created',actor:identity,at,snapshot:fields,guarded:true}),
  audit(db,identity,'member_preferences_created','record',recordId,at,true)
 ]);
 if(!inserted.meta.changes)fail(409,'Your preferences were created in another session. Reload before saving.','conflict');
 return json({ok:true,id:recordId,version:1},201);
}
async function saveWish(db,identity,data,flags){
 const area=field(data.area,40);
 if(!['equipment','sport','training','film','volunteer'].includes(area))fail(400,'Choose a valid membership interest category.','invalid_category');
 if(area==='volunteer'&&!flags.optionalParticipation)fail(403,'Optional volunteering requires an adult participation check and current consent.','safeguards_required');
 const request=field(data.request,400);
 if(!request)fail(400,'Describe the requested equipment, opportunity or idea.','missing_detail');
 const at=now(),recordId=id();
 const body={sandyMemberWorkspace:1,type:'wish',ownerId:identity.id,fields:{area,request,details:field(data.details,1200)}};
 const [saved]=await db.batch([
  db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,'safeguard',?,?,'proposal',NULL,1,?,?,?,? WHERE "+participationGuard)
   .bind(recordId,'Member '+area+' interest',JSON.stringify(body),identity.id,identity.id,at,at,...participationArgs(identity,flags)),
  revision(db,{kind:'record',resourceId:recordId,resourceVersion:1,action:'member_interest_recorded',actor:identity,at,snapshot:body.fields,guarded:true}),
  audit(db,identity,'member_interest_recorded','record',recordId,at,true)
 ]);
 if(!saved.meta.changes)fail(409,'Your participation check changed. Reload before saving.','conflict');
 return json({ok:true,id:recordId},201);
}
export async function memberWorkspaceEndpoint(req,env,path,identity){
 if(path==='/api/member/preview'&&req.method==='GET'){
  requireRole(identity,env.SANDY_SYNTHETIC_VIEW===true?['webmaster','member']:['webmaster','webmaster_demo']);
  return json({synthetic:true,
   profile:{name:'Illustrative demo member',town:'Example island locality',status:'preview only',membershipClass:'sample, not enrolled'},
   sports:['Mixed beach volleyball','Beach cricket'],filmClub:true,volunteer:true,
   areas:['My sports','Calendar','Volunteering','Film club','Member notices','My privacy choices'],
   notice:'A synthetic role-layout preview; no real memberships, fees, accounts or messages are created.'});
 }
 requireRole(identity,['member']);
 const db=dbFor(env);
 if(path==='/api/member/workspace'&&req.method==='GET'){
  const profile=await db.prepare("SELECT id,full_name,membership_class,status,town,joined_on,renewal_on,consent_contact,consent_publication FROM club_people WHERE account_id=? LIMIT 1").bind(identity.id).first();
  const safeguards=await memberSafeguardFlags(db,identity.id);
  const enrolled=Boolean(profile&&profile.status==='active'&&env.SANDY_CLUB_APPROVALS==='enabled');
  const active=enrolled&&safeguards.privateAccess;
  const prefs=(await ownRecords(db,identity,'preferences'))[0]||null;
  if(prefs&&(!enrolled||!safeguards.optionalParticipation||prefs.fields.sharingRevision!==safeguards.version))prefs.fields={...prefs.fields,volunteer:false,contactPreference:'no_contact',publicationConsent:false};
  const wishes=await ownRecords(db,identity,'wish');
  let events=[],notices=[],newsletters=[];
  if(active){
   const ev=await visibleRecords(db,"WHERE kind='event' AND status='approved' AND event_date>=date('now','+10 hours')",[],'event_date,id',40,memberPublicationAllowed);
   events=ev.map(r=>({id:r.id,title:r.title,date:r.event_date,status:r.status}));
   const ns=await visibleRecords(db,"WHERE kind='notice' AND status='approved'",[],'updated_utc DESC,id DESC',30,memberPublicationAllowed);
   notices=ns.map(r=>({id:r.id,title:r.title,date:r.updated_utc}));
   const nl=await visibleRecords(db,"WHERE kind='newsletter' AND status='approved'",[],'updated_utc DESC,id DESC',18,memberPublicationAllowed);
   newsletters=nl.map(r=>({id:r.id,title:r.title,date:r.updated_utc}));
  }
  const displayProfile=profile?{...profile,consent_publication:active&&safeguards.optionalParticipation&&!!profile.consent_publication?1:0,consent_contact:active&&safeguards.optionalParticipation&&!!profile.consent_contact?1:0}:null;
  return json({active,enrolled,safeguards,profile:displayProfile,preferences:prefs,wishes,events,notices,newsletters,
   notice:active?'Your personal record and authorised club information.':enrolled?'A verified age group and any required guardian permission are needed for member self-service. Your own data remains available.':'The club is not established, or your account is not linked to an approved membership. No draft events or private committee material is displayed.'});
 }
 if(path==='/api/member/data-export'&&req.method==='GET'){
  const profile=await db.prepare("SELECT full_name,preferred_name,email,mobile,membership_class,status,joined_on,renewal_on,town,consent_contact,consent_publication FROM club_people WHERE account_id=? LIMIT 1").bind(identity.id).first();
  return json({exportedAt:now(),account:{username:identity.username,office:identity.office_label},
   profile:profile||null,preferences:(await ownRecords(db,identity,'preferences'))[0]||null,wishes:await ownRecords(db,identity,'wish'),safeguards:await memberSafeguardFlags(db,identity.id),
   notice:'This is your own data. Other members and committee records are not included.'});
 }
 if(!env.SANDY_CLUB_APPROVALS||env.SANDY_CLUB_APPROVALS!=='enabled')fail(409,'Member self-service is not active before the club is established.','club_not_established');
 await linkedActiveMember(db,identity);
 const flags=await requireParticipation(db,identity);
 if(path==='/api/member/preferences'&&req.method==='POST'){
  const data=await payload(req,5000);
  if(!flags.optionalParticipation&&(data.volunteer===true||data.publicationConsent===true||['email_when_consented','phone_when_consented'].includes(data.contactPreference)))fail(403,'Optional participation choices require current adult consent.','safeguards_required');
  return savePreference(db,identity,cleanPreferences(data,flags),data.version,flags);
 }
 if(path==='/api/member/interest'&&req.method==='POST')
  return saveWish(db,identity,await payload(req,4000),flags);
 fail(404,'No member service exists at that address.','not_found');
}
