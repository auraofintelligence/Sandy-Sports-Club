// Free founding membership: instant self-service join for adults while Sandy Sports is
// a proposal working toward incorporation. Open only when SANDY_FOUNDING_MEMBERS=enabled.
// Date of birth is required (18+ to join; also used for birthday offers). Children are added later by a joined guardian.
import {fail,json,now,epoch,id,dbFor,payload,field,bool,revision,audit} from './shared.mjs';
import {verifier} from './auth.mjs';
import {publicFormAllowed} from './people.mjs';
import {TERMS,TERMS_VERSION} from './member-safeguards.mjs';
import {ensureProfileTables} from './profiles.mjs';
import {GENDERS,validDob,ageOn} from '../avatars.js';
const enc=new TextEncoder(),COOKIE='__Host-sandy_session',SESSION_HOURS=8;
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const sha=async v=>hex(await crypto.subtle.digest('SHA-256',enc.encode(v)));
const regions=['local','regional','tourist','other'];
export const brisbaneToday=()=>new Date(Date.now()+10*3600000).toISOString().slice(0,10);
export const joinOpen=env=>env.SANDY_FOUNDING_MEMBERS==='enabled'&&Boolean(env.DB?.prepare)&&typeof env.SANDY_AUTH_PEPPER==='string'&&env.SANDY_AUTH_PEPPER.length>=32;
export async function joinEndpoint(req,env,path,identity){
 if(req.method==='GET')return json({open:joinOpen(env),terms:TERMS,termsVersion:TERMS_VERSION,minimumPassword:7,genders:GENDERS});
 if(req.method!=='POST')fail(405,'Use the join form.','method_not_allowed');
 if(!joinOpen(env))fail(503,'Online joining is not open yet. Register your interest instead.','join_closed');
 if(identity)fail(409,'You are already signed in. Sign out before creating another account.','already_signed_in');
 const b=await payload(req,6000);
 if(field(b.website,200))return json({ok:true},201);
 const fullName=field(b.fullName,100),preferredName=field(b.preferredName,60),email=field(b.email,254).toLowerCase(),mobile=field(b.mobile,25);
 const town=field(b.town,100),region=field(b.audienceRegion,20),username=field(b.username,80).toLowerCase();
 if(fullName.length<2)fail(400,'Enter your full name.','invalid_join');
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))fail(400,'Enter a valid email address.','invalid_join');
 if(mobile&&!/^[+0-9 ()-]{7,25}$/.test(mobile))fail(400,'Check the mobile number or leave it blank.','invalid_join');
 if(!regions.includes(region))fail(400,'Choose your connection to Straddie.','invalid_join');
 if(!/^[a-z0-9][a-z0-9._+-]{2,79}$/.test(username))fail(400,'Choose a username of at least 3 letters or numbers (dots, dashes and underscores are fine).','invalid_username');
 if(typeof b.password!=='string'||b.password.length<7||b.password.length>256)fail(400,'Choose a password of at least 7 characters.','weak_password');
 const gender=field(b.gender,20),dob=field(b.dob,10);
 if(!GENDERS.includes(gender))fail(400,'Choose female, male or non-binary.','invalid_join');
 if(!validDob(dob)||ageOn(dob)>110)fail(400,'Enter your date of birth.','invalid_dob');
 if(ageOn(dob)<18)fail(400,'You need to be 18 or over to join yourself. A parent or guardian can join and add you from their member area.','adult_required');
 if(b.termsAccepted!==true||b.termsVersion!==TERMS_VERSION)fail(400,'Read and accept the participation terms.','terms_required');
 if(!await publicFormAllowed(env,req,'join',5))fail(429,'Too many sign-ups from this connection. Please try again in 15 minutes.','rate_limited');
 const db=dbFor(env);
 await ensureProfileTables(env,db);
 if(await db.prepare('SELECT 1 AS x FROM club_accounts WHERE username=?').bind(username).first())fail(409,'That username is taken. Try another.','username_taken');
 const accountId=id(),personId=id(),recordId=id(),at=now(),today=brisbaneToday();
 const salt=random(16),pass=await verifier(b.password,salt,env.SANDY_AUTH_PEPPER);
 const actor={id:accountId,role:'member',office_label:'Founding member'};
 const token=random(32),t=epoch(),until=t+SESSION_HOURS*3600;
 const fields={ageBand:'adult',guardianPermission:false,termsAccepted:true,termsVersion:TERMS_VERSION,verifiedAt:at,verifiedBy:accountId,selfDeclared:true};
 const exists='EXISTS(SELECT 1 FROM club_accounts WHERE id=? AND password_verifier=?)';
 let results;
 try{
  results=await db.batch([
   db.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,person_id,state,password_salt,password_verifier,created_utc,activated_utc,last_login_utc) SELECT ?,?,'member','Founding member',?,?,'active',?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM club_accounts WHERE username=?)")
    .bind(accountId,username,preferredName||fullName,personId,salt,pass,at,at,at,username),
   db.prepare("INSERT INTO club_people(id,account_id,full_name,preferred_name,email,mobile,membership_class,status,joined_on,gender,town,audience_region,consent_contact,consent_publication,source,created_by,updated_by,created_utc,updated_utc) SELECT ?,?,?,?,?,?,'founding','active',?,?,?,?,?,0,'online-join',?,?,?,? WHERE "+exists)
    .bind(personId,accountId,fullName,preferredName,email,mobile,today,gender,town,region,bool(b.contactConsent)?1:0,accountId,accountId,at,at,accountId,pass),
   db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,'safeguard','Restricted participation check',?,'draft',NULL,1,?,?,?,? WHERE "+exists)
    .bind(recordId,JSON.stringify({sandyMemberSafeguard:1,ownerId:accountId,fields}),accountId,accountId,at,at,accountId,pass),
   revision(db,{kind:'record',resourceId:recordId,resourceVersion:1,action:'safeguard_self_declared',actor,at,changes:{fromVersion:0,toVersion:1,reason:'safeguard_self_declared'},snapshot:fields,guarded:true}),
   revision(db,{kind:'person',resourceId:personId,resourceVersion:1,action:'founding_member_joined',actor,at,snapshot:{membershipClass:'founding',status:'active',joinedOn:today}}),
   db.prepare("INSERT INTO club_member_profiles(account_id,dob,version,updated_utc) SELECT ?,?,0,? WHERE "+exists).bind(accountId,dob,at,accountId,pass),
   db.prepare("INSERT INTO club_sessions(digest,account_id,created_epoch,expires_epoch) SELECT ?,?,?,? WHERE "+exists).bind(await sha(token),accountId,t,until,accountId,pass),
   audit(db,actor,'founding_member_joined','account',accountId,at)
  ]);
 }catch(error){
  if(String(error?.message).includes('UNIQUE'))fail(409,'That username is taken. Try another.','username_taken');
  throw error;
 }
 if(!results[0].meta.changes)fail(409,'That username is taken. Try another.','username_taken');
 return json({ok:true,username,next:'/member-home.html'},201,{'Set-Cookie':COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+SESSION_HOURS*3600});
}
