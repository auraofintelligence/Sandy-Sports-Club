// Sandy member profiles: sports, skill, availability, Film Club and crew skills, helping out.
// Directory is opt-in and adult members only. Connections are mutual; either side can block.
// Contact details are shown only to connected members, and only if the member chose to share them.
import {fail,json,now,dbFor,payload,field,version,requireRole,audit,membersOpen,STAFF} from './shared.mjs';
import {memberSafeguardFlags} from './member-safeguards.mjs';
import {validAvatar,validDob,ageOn} from '../avatars.js';
const DDL=[`CREATE TABLE IF NOT EXISTS club_member_profiles(account_id TEXT PRIMARY KEY REFERENCES club_accounts(id),bio TEXT NOT NULL DEFAULT '',sports_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(sports_json)),skill_level TEXT NOT NULL DEFAULT '' CHECK(skill_level IN ('','new','social','competitive','coach')),availability_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(availability_json)),film_member INTEGER NOT NULL DEFAULT 0 CHECK(film_member IN (0,1)),crew_skills_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(crew_skills_json)),helping_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(helping_json)),directory_visible INTEGER NOT NULL DEFAULT 0 CHECK(directory_visible IN (0,1)),show_town INTEGER NOT NULL DEFAULT 0 CHECK(show_town IN (0,1)),share_contact INTEGER NOT NULL DEFAULT 0 CHECK(share_contact IN (0,1)),dob TEXT NOT NULL DEFAULT '',avatar_id TEXT NOT NULL DEFAULT '',photo TEXT,picture_type TEXT NOT NULL DEFAULT '' CHECK(picture_type IN ('','avatar','photo')),id_verified_utc TEXT,id_verified_by TEXT,id_verified_type TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,updated_utc TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS club_member_connections(low_id TEXT NOT NULL REFERENCES club_accounts(id),high_id TEXT NOT NULL REFERENCES club_accounts(id),requested_by TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','connected','blocked')),blocked_by TEXT,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL,PRIMARY KEY(low_id,high_id),CHECK(low_id<high_id))`];
const ready=new WeakSet();
export async function ensureProfileTables(env,db){if(ready.has(env))return;for(const sql of DDL)await db.prepare(sql).run();ready.add(env)}
export const SPORTS=['Mixed beach volleyball','Beach cricket','Flag football','Beach soccer','Beach rugby','AirBadminton','Beach tennis','Beach handball','Ultimate and flying disc','Netball crossover','AFL crossover','Fitness and movement','Multi-sport'];
export const CREW=['Camera','Sound','Editing','Directing','Writing','Acting','Lighting','Projection and screen','Live streaming','Photography','Producing','Music'];
export const HELPING=['Setting up courts','Running a session','Coaching','First aid','Events and markets','Social media','Grants and admin','Driving and transport','Cooking and catering'];
export const AVAILABILITY=['Weekday morning','Weekday afternoon','Weekday evening','Weekend morning','Weekend afternoon','School holidays','Occasional events'];
const SKILLS=['','new','social','competitive','coach'];
export const ID_TYPES=['Driver licence','Passport','Proof of age card','Photo ID card','Other government photo ID'];
// Photos arrive as a small square JPEG data URL prepared in the browser.
export function cleanPhoto(value,fail){
 if(typeof value!=='string'||value.length>200000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value))fail(400,'Upload a JPG, PNG or WebP photo.','invalid_photo');
 const head=atob(value.slice(23,31));if(head.charCodeAt(0)!==0xff||head.charCodeAt(1)!==0xd8)fail(400,'Upload a JPG, PNG or WebP photo.','invalid_photo');
 return value;
}
export function photoResponse(dataUrl){
 const bin=atob(dataUrl.slice(23)),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
const pictureOf=r=>r&&r.picture_type?{type:r.picture_type,avatarId:r.avatar_id||''}:null;
const photoUrl=id=>'/api/member/photo/'+id;
const pick=(list,allowed)=>Array.isArray(list)?[...new Set(list.filter(x=>allowed.includes(x)))]:[];
const parse=s=>{try{return JSON.parse(s||'[]')}catch{return []}};
const blank=()=>({picture:null,dob:'',verified:false,verifiedAt:null,bio:'',sports:[],skillLevel:'',availability:[],filmMember:false,crewSkills:[],helping:[],directoryVisible:false,showTown:false,shareContact:false,version:0});
function shape(r){return r?{picture:pictureOf(r),dob:r.dob||'',verified:!!r.id_verified_utc,verifiedAt:r.id_verified_utc||null,bio:r.bio,sports:parse(r.sports_json),skillLevel:r.skill_level,availability:parse(r.availability_json),filmMember:!!r.film_member,
 crewSkills:parse(r.crew_skills_json),helping:parse(r.helping_json),directoryVisible:!!r.directory_visible,showTown:!!r.show_town,shareContact:!!r.share_contact,version:r.version}:blank()}
const pair=(a,b)=>a<b?[a,b]:[b,a];
async function requireMember(env,db,identity){
 requireRole(identity,['member']);
 if(!membersOpen(env))fail(409,'Member self-service is not open yet.','club_not_established');
 const me=await db.prepare("SELECT p.full_name,p.preferred_name,p.town,p.email,p.mobile,p.gender FROM club_people p JOIN club_accounts a ON a.id=p.account_id WHERE p.account_id=? AND p.status='active' AND a.state='active' LIMIT 1").bind(identity.id).first();
 if(!me)fail(409,'There is no active membership linked to this account.','membership_not_active');
 if((await memberSafeguardFlags(db,identity.id)).ageBand!=='adult')fail(403,'Member profiles are for adult members.','adult_required');
 await ensureProfileTables(env,db);
 return me;
}
// Directory rows: active adult members who opted in. Adult status is the self-declared or verified safeguard check.
const DIRECTORY=`SELECT a.id,a.username,p.full_name,p.preferred_name,p.town,p.email,p.mobile,m.* FROM club_member_profiles m
 JOIN club_accounts a ON a.id=m.account_id AND a.state='active' AND a.role='member'
 JOIN club_people p ON p.account_id=a.id AND p.status='active'
 WHERE m.directory_visible=1 AND m.picture_type<>''`;
export async function profilesEndpoint(req,env,path,identity){
 const db=dbFor(env);
 if(path==='/api/committee/member-profiles'){
  requireRole(identity,['webmaster']);await ensureProfileTables(env,db);
  const {results=[]}=await db.prepare(`SELECT a.id,a.username,p.full_name,p.preferred_name,p.town,p.email,p.mobile,p.joined_on,p.membership_class,p.gender,m.*,v.username AS verifier FROM club_accounts a
   JOIN club_people p ON p.account_id=a.id LEFT JOIN club_member_profiles m ON m.account_id=a.id LEFT JOIN club_accounts v ON v.id=m.id_verified_by WHERE a.role='member' ORDER BY p.joined_on DESC,a.username LIMIT 1000`).all();
  return json({members:results.map(r=>({accountId:r.id,username:r.username,name:r.full_name,preferredName:r.preferred_name,town:r.town,email:r.email,mobile:r.mobile,
   joinedOn:r.joined_on,membershipClass:r.membership_class,gender:r.gender,idCheck:r.id_verified_utc?{type:r.id_verified_type,at:r.id_verified_utc,by:r.verifier||''}:null,profile:shape(r.account_id?r:null),photoUrl:r.picture_type==='photo'?photoUrl(r.id):null}))});
 }
 // Blue tick: a committee member or the Webmaster sighted photo ID in person and confirmed the date of birth.
 // Only the ID type is kept; ID numbers and copies of documents are never stored.
 if(path==='/api/committee/verify-id'){
  requireRole(identity,STAFF);if(req.method!=='POST')fail(405,'Use the verify form.','method_not_allowed');await ensureProfileTables(env,db);
  const b=await payload(req,1000),target=field(b.accountId,40),at=now();
  const member=await db.prepare("SELECT a.id,m.dob,m.id_verified_utc FROM club_accounts a JOIN club_member_profiles m ON m.account_id=a.id WHERE a.id=? AND a.role='member' AND a.state='active'").bind(target).first();
  if(!member)fail(404,'That member has no profile yet. Ask them to finish joining first.','member_not_found');
  if(b.action==='revoke'){
   await db.prepare('UPDATE club_member_profiles SET id_verified_utc=NULL,id_verified_by=NULL,id_verified_type=\'\',version=version+1,updated_utc=? WHERE account_id=?').bind(at,target).run();
   await audit(db,identity,'id_verification_revoked','profile',target,at).run();return json({ok:true,verified:false});
  }
  if(b.action!=='verify')fail(400,'Choose verify or revoke.','invalid_action');
  if(b.sighted!==true)fail(400,'Confirm you sighted the photo ID in person.','sighting_required');
  const type=field(b.idType,40);if(!ID_TYPES.includes(type))fail(400,'Choose the type of ID you sighted.','invalid_id_type');
  const dob=field(b.dob,10);if(!validDob(dob)||ageOn(dob)<18)fail(400,'Enter the date of birth shown on the ID (18 or over).','invalid_dob');
  await db.prepare('UPDATE club_member_profiles SET dob=?,id_verified_utc=?,id_verified_by=?,id_verified_type=?,version=version+1,updated_utc=? WHERE account_id=?').bind(dob,at,identity.id,type,at,target).run();
  await audit(db,identity,'id_verified_in_person','profile',target,at).run();
  return json({ok:true,verified:true,dobCorrected:dob!==member.dob});
 }
 const photoMatch=path.match(/^\/api\/member\/photo\/([a-f0-9-]{36})$/);
 if(photoMatch&&req.method==='GET'){
  requireRole(identity,['member','webmaster']);await ensureProfileTables(env,db);
  const target=photoMatch[1];
  if(identity.role!=='webmaster'&&target!==identity.id){
   const [low,high]=pair(identity.id,target);
   if(!await db.prepare("SELECT 1 AS x FROM club_member_connections WHERE low_id=? AND high_id=? AND state='connected'").bind(low,high).first())fail(404,'Photo unavailable.','not_found');
  }
  const row=await db.prepare("SELECT photo FROM club_member_profiles WHERE account_id=? AND picture_type='photo' AND photo IS NOT NULL").bind(target).first();
  if(!row)fail(404,'Photo unavailable.','not_found');
  return photoResponse(row.photo);
 }
 const me=await requireMember(env,db,identity);
 if(path==='/api/member/picture'&&req.method==='POST'){
  const b=await payload(req,210000),at=now();
  let avatar='',photo=null,type='avatar';
  if(b.photo){photo=cleanPhoto(b.photo,fail);type='photo';avatar=validAvatar(b.avatarId)?b.avatarId:''}
  else if(validAvatar(b.avatarId))avatar=b.avatarId;
  else fail(400,'Pick a cartoon avatar or upload a photo.','picture_required');
  await db.prepare("INSERT INTO club_member_profiles(account_id,avatar_id,photo,picture_type,version,updated_utc) VALUES(?,?,?,?,1,?) ON CONFLICT(account_id) DO UPDATE SET avatar_id=CASE WHEN excluded.avatar_id<>'' THEN excluded.avatar_id ELSE avatar_id END,photo=excluded.photo,picture_type=excluded.picture_type,version=version+1,updated_utc=excluded.updated_utc")
   .bind(identity.id,avatar,photo,type,at).run();
  await audit(db,identity,'member_picture_saved','profile',identity.id,at).run();
  return json({ok:true,profile:shape(await db.prepare('SELECT * FROM club_member_profiles WHERE account_id=?').bind(identity.id).first()),photoUrl:type==='photo'?photoUrl(identity.id):null});
 }
 if(path==='/api/member/profile'){
  const row=await db.prepare('SELECT * FROM club_member_profiles WHERE account_id=?').bind(identity.id).first();
  if(req.method==='GET')return json({profile:shape(row),gender:me.gender||'',photoUrl:row?.picture_type==='photo'?photoUrl(identity.id):null,name:me.preferred_name||me.full_name,options:{sports:SPORTS,crew:CREW,helping:HELPING,availability:AVAILABILITY,skills:SKILLS.slice(1)}});
  if(req.method!=='POST')fail(405,'Use the profile form.','method_not_allowed');
  const b=await payload(req,6000),expected=version(b.version);
  if(expected!==(row?.version||0))fail(409,'Your profile changed in another window. Reload before saving.','conflict');
  const skill=field(b.skillLevel,20);if(!SKILLS.includes(skill))fail(400,'Choose a skill level.','invalid_profile');
  if(b.directoryVisible===true&&!row?.picture_type)fail(409,'Pick an avatar or photo before joining the directory.','picture_required');
  const v=[field(b.bio,400),JSON.stringify(pick(b.sports,SPORTS)),skill,JSON.stringify(pick(b.availability,AVAILABILITY)),b.filmMember===true?1:0,
   JSON.stringify(pick(b.crewSkills,CREW)),JSON.stringify(pick(b.helping,HELPING)),b.directoryVisible===true?1:0,b.showTown===true?1:0,b.shareContact===true?1:0];
  const at=now(),result=row?
   await db.prepare('UPDATE club_member_profiles SET bio=?,sports_json=?,skill_level=?,availability_json=?,film_member=?,crew_skills_json=?,helping_json=?,directory_visible=?,show_town=?,share_contact=?,version=version+1,updated_utc=? WHERE account_id=? AND version=?').bind(...v,at,identity.id,expected).run():
   await db.prepare('INSERT INTO club_member_profiles(account_id,bio,sports_json,skill_level,availability_json,film_member,crew_skills_json,helping_json,directory_visible,show_town,share_contact,version,updated_utc) SELECT ?,?,?,?,?,?,?,?,?,?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM club_member_profiles WHERE account_id=?)').bind(identity.id,...v,at,identity.id).run();
  if(!result.meta.changes)fail(409,'Your profile changed in another window. Reload before saving.','conflict');
  await audit(db,identity,'member_profile_saved','profile',identity.id,at).run();
  return json({ok:true,profile:shape(await db.prepare('SELECT * FROM club_member_profiles WHERE account_id=?').bind(identity.id).first())});
 }
 if(path==='/api/member/directory'&&req.method==='GET'){
  const url=new URL(req.url),sport=field(url.searchParams.get('sport'),60),film=url.searchParams.get('film')==='1',q=field(url.searchParams.get('q'),60).toLowerCase();
  const {results=[]}=await db.prepare(DIRECTORY+' AND a.id<>? ORDER BY COALESCE(NULLIF(p.preferred_name,\'\'),p.full_name) LIMIT 1000').bind(identity.id).all();
  const {results:links=[]}=await db.prepare('SELECT * FROM club_member_connections WHERE low_id=? OR high_id=?').bind(identity.id,identity.id).all();
  const link=other=>links.find(l=>l.low_id===other||l.high_id===other);
  const members=results.filter(r=>{
   const l=link(r.id);if(l?.state==='blocked')return false;
   const p=shape(r);
   if(film&&!p.filmMember)return false;if(sport&&!p.sports.includes(sport))return false;
   if(q&&!((r.preferred_name||r.full_name)+' '+p.bio).toLowerCase().includes(q))return false;
   return true;
  }).map(r=>{
   const p=shape(r),l=link(r.id),connected=l?.state==='connected';
   return {accountId:r.id,verified:!!r.id_verified_utc,picture:{type:connected&&r.picture_type==='photo'?'photo':'avatar',avatarId:r.avatar_id},photoUrl:connected&&r.picture_type==='photo'?photoUrl(r.id):null,name:r.preferred_name||r.full_name,town:p.showTown?r.town:'',bio:p.bio,sports:p.sports,skillLevel:p.skillLevel,availability:p.availability,
    filmMember:p.filmMember,crewSkills:p.crewSkills,helping:p.helping,
    connection:!l?'none':l.state==='connected'?'connected':l.requested_by===identity.id?'requested':'incoming',
    ...(connected&&p.shareContact?{contact:{email:r.email,mobile:r.mobile}}:{})};
  });
  const mine=await db.prepare('SELECT directory_visible FROM club_member_profiles WHERE account_id=?').bind(identity.id).first();
  return json({members,visible:!!mine?.directory_visible,incoming:members.filter(m=>m.connection==='incoming').length});
 }
 if(path==='/api/member/connections'&&req.method==='POST'){
  const b=await payload(req,1000),other=field(b.accountId,40),action=field(b.action,20),at=now();
  if(!/^[a-f0-9-]{36}$/.test(other)||other===identity.id)fail(400,'Choose another member.','invalid_member');
  const [low,high]=pair(identity.id,other);
  const current=await db.prepare('SELECT * FROM club_member_connections WHERE low_id=? AND high_id=?').bind(low,high).first();
  if(current?.state==='blocked'&&!(action==='unblock'&&current.blocked_by===identity.id))fail(404,'That member is not available.','member_unavailable');
  if(action==='block'){
   await db.prepare("INSERT INTO club_member_connections(low_id,high_id,requested_by,state,blocked_by,created_utc,updated_utc) VALUES(?,?,?,'blocked',?,?,?) ON CONFLICT(low_id,high_id) DO UPDATE SET state='blocked',blocked_by=excluded.blocked_by,updated_utc=excluded.updated_utc").bind(low,high,identity.id,identity.id,at,at).run();
   return json({ok:true,connection:'blocked'});
  }
  if(action==='unblock'||action==='remove'||action==='decline'){
   await db.prepare('DELETE FROM club_member_connections WHERE low_id=? AND high_id=?').bind(low,high).run();
   return json({ok:true,connection:'none'});
  }
  const target=await db.prepare(DIRECTORY+' AND a.id=?').bind(other).first();
  if(!target)fail(404,'That member is not in the directory.','member_unavailable');
  if(action==='request'){
   if(current)return json({ok:true,connection:current.state==='connected'?'connected':current.requested_by===identity.id?'requested':'incoming'});
   const mine=await db.prepare('SELECT directory_visible FROM club_member_profiles WHERE account_id=?').bind(identity.id).first();
   if(!mine?.directory_visible)fail(409,'Turn on "Show me in the member directory" before connecting with others.','directory_required');
   await db.prepare("INSERT INTO club_member_connections(low_id,high_id,requested_by,state,created_utc,updated_utc) VALUES(?,?,?,'pending',?,?) ON CONFLICT DO NOTHING").bind(low,high,identity.id,at,at).run();
   return json({ok:true,connection:'requested'},201);
  }
  if(action==='accept'){
   const r=await db.prepare("UPDATE club_member_connections SET state='connected',updated_utc=? WHERE low_id=? AND high_id=? AND state='pending' AND requested_by<>?").bind(at,low,high,identity.id).run();
   if(!r.meta.changes)fail(409,'There is no request from this member to accept.','no_request');
   return json({ok:true,connection:'connected'});
  }
  fail(400,'Choose request, accept, decline, remove, block or unblock.','invalid_action');
 }
 fail(404,'That member service does not exist.','not_found');
}
