// Guardian gateway. A joined adult member registers their children as connected profiles.
// Children have no login or contact details; the guardian is the contact. Date of birth sets the age group and birthday offers.
// Only the guardian and the Webmaster can see a child's profile.
import {fail,json,now,id,dbFor,payload,field,version,requireRole,revision,audit,membersOpen} from './shared.mjs';
import {memberSafeguardFlags} from './member-safeguards.mjs';
import {cleanPhoto,photoResponse} from './profiles.mjs';
import {validAvatar,GENDERS,validDob,ageOn} from '../avatars.js';
const DDL=[`CREATE TABLE IF NOT EXISTS club_guardian_links(child_person_id TEXT PRIMARY KEY REFERENCES club_people(id),guardian_account_id TEXT NOT NULL REFERENCES club_accounts(id),relationship TEXT NOT NULL DEFAULT 'parent' CHECK(relationship IN ('parent','guardian','carer','grandparent','other')),age_band TEXT NOT NULL CHECK(age_band IN ('under16','16-17')),participation_permission INTEGER NOT NULL DEFAULT 1 CHECK(participation_permission IN (0,1)),photo_permission INTEGER NOT NULL DEFAULT 0 CHECK(photo_permission IN (0,1)),interests_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(interests_json)),dob TEXT NOT NULL DEFAULT '',gender TEXT NOT NULL DEFAULT '',avatar_id TEXT NOT NULL DEFAULT '',photo TEXT,picture_type TEXT NOT NULL DEFAULT '' CHECK(picture_type IN ('','avatar','photo')),version INTEGER NOT NULL DEFAULT 1,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL,withdrawn_utc TEXT)`,
 'CREATE INDEX IF NOT EXISTS club_guardian_links_guardian ON club_guardian_links(guardian_account_id)'];
const ready=new WeakSet();
async function ensureTable(env,db){if(ready.has(env))return;for(const sql of DDL)await db.prepare(sql).run();ready.add(env)}
const relationships=['parent','guardian','carer','grandparent','other'],bands=['under16','16-17'];
const MAX_CHILDREN=8;
const brisbaneToday=()=>new Date(Date.now()+10*3600000).toISOString().slice(0,10);
const childPhoto=id=>'/api/member/family/photo/'+id;
function shape(r){return {id:r.id,fullName:r.full_name,preferredName:r.preferred_name,ageBand:r.age_band,dob:r.dob,age:r.dob?ageOn(r.dob):null,relationship:r.relationship,gender:r.gender,picture:r.picture_type?{type:r.picture_type,avatarId:r.avatar_id}:null,photoUrl:r.picture_type==='photo'?childPhoto(r.id):null,
 participationPermission:!!r.participation_permission,photoPermission:!!r.photo_permission,interests:JSON.parse(r.interests_json||'[]'),
 joinedOn:r.joined_on,version:r.version,...(r.guardian_username!==undefined?{guardian:{username:r.guardian_username,name:r.guardian_name,email:r.guardian_email,mobile:r.guardian_mobile}}:{})}}
const SELECT=`SELECT p.id,p.full_name,p.preferred_name,p.joined_on,g.age_band,g.relationship,g.participation_permission,g.photo_permission,g.interests_json,g.dob,g.gender,g.avatar_id,g.picture_type,g.version
 FROM club_guardian_links g JOIN club_people p ON p.id=g.child_person_id WHERE g.withdrawn_utc IS NULL AND p.status='active'`;
function input(b){
 const fullName=field(b.fullName,100),preferredName=field(b.preferredName,60),dob=field(b.dob,10),relationship=field(b.relationship,20)||'parent';
 if(fullName.length<2)fail(400,"Enter your child's name.",'invalid_child');
 if(!validDob(dob))fail(400,"Enter your child's date of birth.",'invalid_dob');
 if(ageOn(dob)>=18)fail(400,'Adults join themselves. Send them the Join free link.','adult_child');
 const ageBand=ageOn(dob)<16?'under16':'16-17';
 if(!relationships.includes(relationship))fail(400,'Choose your relationship to the child.','invalid_child');
 const gender=field(b.gender,20);if(!GENDERS.includes(gender))fail(400,'Choose female, male or non-binary.','invalid_child');
 let avatar=validAvatar(b.avatarId)?b.avatarId:'',photo=null;if(b.photo)photo=cleanPhoto(b.photo,fail);
 const picture=photo?'photo':avatar?'avatar':'';
 const interests=Array.isArray(b.interests)?[...new Set(b.interests.filter(x=>typeof x==='string').map(x=>field(x,60)).filter(Boolean))].slice(0,20):[];
 return {dob,gender,avatar,photo,picture,fullName,preferredName,ageBand,relationship,interests,participation:b.participationPermission!==false?1:0,photoPermission:b.photoPermission===true?1:0};
}
async function requireGuardian(env,db,identity){
 requireRole(identity,['member']);
 if(!membersOpen(env))fail(409,'Member self-service is not open yet.','club_not_established');
 const me=await db.prepare("SELECT id FROM club_people WHERE account_id=? AND status='active' LIMIT 1").bind(identity.id).first();
 if(!me)fail(409,'Join as a member before adding children.','membership_not_active');
 if((await memberSafeguardFlags(db,identity.id)).ageBand!=='adult')fail(403,'Only adult members can register children.','guardian_required');
}
export async function familyEndpoint(req,env,path,identity){
 const db=dbFor(env);
 const photoMatch=path.match(/^\/api\/member\/family\/photo\/([a-f0-9-]{36})$/);
 if(photoMatch&&req.method==='GET'){
  requireRole(identity,['member','webmaster']);await ensureTable(env,db);
  const row=await db.prepare("SELECT photo FROM club_guardian_links WHERE child_person_id=? AND picture_type='photo' AND photo IS NOT NULL AND withdrawn_utc IS NULL"+(identity.role==='webmaster'?'':' AND guardian_account_id=?')).bind(...(identity.role==='webmaster'?[photoMatch[1]]:[photoMatch[1],identity.id])).first();
  if(!row)fail(404,'Photo unavailable.','not_found');
  return photoResponse(row.photo);
 }
 if(path==='/api/committee/families'){
  requireRole(identity,['webmaster']);
  if(req.method!=='GET')fail(405,'Read only.','method_not_allowed');
  await ensureTable(env,db);
  const {results=[]}=await db.prepare(SELECT.replace('FROM club_guardian_links g',",a.username AS guardian_username,gp.full_name AS guardian_name,gp.email AS guardian_email,gp.mobile AS guardian_mobile FROM club_guardian_links g JOIN club_accounts a ON a.id=g.guardian_account_id LEFT JOIN club_people gp ON gp.account_id=a.id")+' ORDER BY a.username,p.full_name LIMIT 500').all();
  return json({children:results.map(shape)});
 }
 await requireGuardian(env,db,identity);await ensureTable(env,db);
 const mine=async()=>(await db.prepare(SELECT+' AND g.guardian_account_id=? ORDER BY p.created_utc').bind(identity.id).all()).results||[];
 if(req.method==='GET')return json({children:(await mine()).map(shape),maxChildren:MAX_CHILDREN});
 if(req.method!=='POST')fail(405,'Use the family form.','method_not_allowed');
 const b=await payload(req,4000),at=now(),actor={...identity,office_label:'Guardian'};
 if(b.action==='add'){
  if(b.guardianDeclaration!==true)fail(400,'Confirm you are the parent or legal guardian, or have their authority.','guardian_declaration_required');
  const c=input(b);
  if(!c.picture)fail(400,'Pick a cartoon avatar or upload a photo for your child.','picture_required');
  if((await mine()).length>=MAX_CHILDREN)fail(409,'You have reached the limit of '+MAX_CHILDREN+' children. Contact the Webmaster.','family_limit');
  const childId=id();
  await db.batch([
   db.prepare("INSERT INTO club_people(id,account_id,full_name,preferred_name,membership_class,status,joined_on,consent_contact,consent_publication,source,created_by,updated_by,created_utc,updated_utc) VALUES(?,NULL,?,?,'youth','active',?,0,?,'guardian-registered',?,?,?,?)")
    .bind(childId,c.fullName,c.preferredName,brisbaneToday(),c.photoPermission,identity.id,identity.id,at,at),
   db.prepare('INSERT INTO club_guardian_links(child_person_id,guardian_account_id,relationship,age_band,participation_permission,photo_permission,interests_json,dob,gender,avatar_id,photo,picture_type,version,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)')
    .bind(childId,identity.id,c.relationship,c.ageBand,c.participation,c.photoPermission,JSON.stringify(c.interests),c.dob,c.gender,c.avatar,c.photo,c.picture,at,at),
   revision(db,{kind:'person',resourceId:childId,resourceVersion:1,action:'child_registered_by_guardian',actor,at,snapshot:{ageBand:c.ageBand,relationship:c.relationship,participation:c.participation,photo:c.photoPermission}}),
   audit(db,actor,'child_registered_by_guardian','person',childId,at)
  ]);
  return json({ok:true,id:childId,children:(await mine()).map(shape)},201);
 }
 const childId=field(b.id,40);
 if(!/^[a-f0-9-]{36}$/.test(childId))fail(400,'Choose a child profile.','invalid_child');
 const current=await db.prepare(SELECT+' AND g.guardian_account_id=? AND p.id=?').bind(identity.id,childId).first();
 if(!current)fail(404,'That child profile is not linked to your account.','child_not_found');
 if(version(b.version)!==current.version)fail(409,'This profile changed. Reload before saving.','conflict');
 if(b.action==='update'){
  const c=input({...shape(current),avatarId:current.avatar_id,...b});
  const keepPhoto=!b.photo&&!b.avatarId&&current.picture_type==='photo';
  const [r]=await db.batch([
   db.prepare('UPDATE club_guardian_links SET relationship=?,age_band=?,participation_permission=?,photo_permission=?,interests_json=?,dob=?,gender=?,avatar_id=?,photo=CASE WHEN ? THEN photo ELSE ? END,picture_type=CASE WHEN ? THEN picture_type ELSE ? END,version=version+1,updated_utc=? WHERE child_person_id=? AND guardian_account_id=? AND version=? AND withdrawn_utc IS NULL')
    .bind(c.relationship,c.ageBand,c.participation,c.photoPermission,JSON.stringify(c.interests),c.dob,c.gender,c.avatar,keepPhoto?1:0,c.photo,keepPhoto?1:0,c.picture||'avatar',at,childId,identity.id,current.version),
   db.prepare('UPDATE club_people SET full_name=?,preferred_name=?,consent_publication=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND changes()=1').bind(c.fullName,c.preferredName,c.photoPermission,identity.id,at,childId),
   revision(db,{kind:'person',resourceId:childId,resourceVersion:current.version+1,action:'child_updated_by_guardian',actor,at,snapshot:{ageBand:c.ageBand,participation:c.participation,photo:c.photoPermission},guarded:true}),
   audit(db,actor,'child_updated_by_guardian','person',childId,at,true)]);
  if(!r.meta.changes)fail(409,'This profile changed. Reload before saving.','conflict');
  return json({ok:true,children:(await mine()).map(shape)});
 }
 if(b.action==='remove'){
  const [r]=await db.batch([
   db.prepare('UPDATE club_guardian_links SET withdrawn_utc=?,version=version+1,updated_utc=? WHERE child_person_id=? AND guardian_account_id=? AND version=? AND withdrawn_utc IS NULL').bind(at,at,childId,identity.id,current.version),
   db.prepare("UPDATE club_people SET status='withdrawn',consent_publication=0,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND changes()=1").bind(identity.id,at,childId),
   audit(db,actor,'child_withdrawn_by_guardian','person',childId,at,true)]);
  if(!r.meta.changes)fail(409,'This profile changed. Reload before saving.','conflict');
  return json({ok:true,children:(await mine()).map(shape)});
 }
 fail(400,'Choose add, update or remove.','invalid_action');
}
