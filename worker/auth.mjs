import {ApiError,fail,json,now,epoch,id,dbFor,payload,field,requireRole,revision,audit} from './shared.mjs';
const enc=new TextEncoder(),COOKIE='__Host-sandy_session',SESSION_HOURS=8,PBKDF2=100000;
const nowSec=()=>epoch();
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const hex=buf=>Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('');
const random=n=>hex(bytes(n));
const hash=async value=>hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const resetDigest=token=>hash('sandy-account-recovery/'+token);
const officeRoles=['president','vice_president','secretary','assistant_secretary','treasurer','committee'];
const invitationsEnabled=env=>env.SANDY_INVITES_ENABLED==='enabled';
const requireInvitations=env=>{if(!invitationsEnabled(env))fail(409,'Private officer activation is disabled until the owner authorises opening it.','invites_disabled')};
const cookie=(value,age)=>COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
const name=x=>field(x,80).toLowerCase();
const validName=x=>/^[a-z0-9][a-z0-9._+-]{2,79}$/.test(x);
const ROLES=['webmaster','webmaster_demo','president','vice_president','secretary','assistant_secretary','treasurer','committee','member'];
const strong=x=>typeof x==='string'&&x.length>=7&&x.length<=256;
// Failed sign-ins: at most 3 per account per connection in each 15-minute window. Successful sign-ins do not count.
const FAILED_LOGIN_LIMIT=3;
async function failedLoginKey(req,username){return hash('sandy-login-fail-v1/'+Math.floor(nowSec()/900)+'/'+(req.headers.get('cf-connecting-ip')||'local')+'/'+username)}
async function failedLogins(db,key){const row=await db.prepare('SELECT count FROM club_login_attempts WHERE key=? AND expires_epoch>?').bind(key,nowSec()).first();return Number(row?.count||0)}
async function recordFailedLogin(db,key){const expiry=(Math.floor(nowSec()/900)+1)*900;await db.prepare('INSERT INTO club_login_attempts(key,count,expires_epoch) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key,expiry).run()}
function constantEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
export async function verifier(password,salt,secret){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const source=await crypto.subtle.sign('HMAC',key,enc.encode(password));
 const pass=await crypto.subtle.importKey('raw',source,'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:PBKDF2},pass,256));
}
function requireCrypto(env){
 if(typeof env.SANDY_AUTH_PEPPER!=='string'||env.SANDY_AUTH_PEPPER.length<32)
  fail(503,'Authentication is not configured for this club.','auth_not_configured');
}
const sessionToken=req=>{
 const cookies=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
 return cookies.length===1&&/^[a-f0-9]{64}$/.test(cookies[0].slice(COOKIE.length+1))?cookies[0].slice(COOKIE.length+1):null;
};
export async function identityFor(req,env){
 if(!env.DB?.prepare||typeof env.SANDY_AUTH_PEPPER!=='string'||env.SANDY_AUTH_PEPPER.length<32)return null;
 const token=sessionToken(req);if(!token)return null;
 const db=dbFor(env),digest=await hash(token);
 const row=await db.prepare('SELECT a.id,a.username,a.role,a.office_label,a.display_name,a.state FROM club_sessions s JOIN club_accounts a ON a.id=s.account_id WHERE s.digest=? AND s.expires_epoch>? AND a.state=?')
  .bind(digest,nowSec(),'active').first();
 if(!row)return null;
 return {id:row.id,username:row.username,name:row.display_name||row.username,role:row.role,office_label:row.office_label||row.role};
}
// Atomic counter increments return their own result rather than rereading a
// counter advanced by another request. IP-only and account-only budgets limit
// password spraying and distributed guesses as well as repeated IP/account pairs.
async function rateLimit(req,db,key){
 const t=nowSec(),bucket=Math.floor(t/900),expiry=(bucket+1)*900;
 const ip=req.headers.get('cf-connecting-ip')||'local';
 const budgets=[['pair/'+ip+'/'+key,8],['source/'+ip,40]];
 if(key.startsWith('login/')||key.startsWith('change/'))budgets.push(['subject/'+key,24]);
 const increments=await Promise.all(budgets.map(async([scope,limit])=>{
  const digest=await hash('sandy-auth-limit-v2/'+bucket+'/'+scope);
  return {digest,limit};
 }));
 // Expired counters are not authentication/audit history. Keep only current buckets.
 // Bounded cleanup avoids unbounded storage of hashed attempts.
 const statements=[db.prepare('DELETE FROM club_login_attempts WHERE key IN (SELECT key FROM club_login_attempts WHERE expires_epoch<=? LIMIT 200)').bind(t)];
 for(const item of increments)statements.push(db.prepare('INSERT INTO club_login_attempts(key,count,expires_epoch) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_epoch<=? THEN 1 ELSE MIN(count+1,1000000) END,expires_epoch=? RETURNING count').bind(item.digest,expiry,t,expiry));
 const results=await db.batch(statements);
 if(results.slice(1).some((r,i)=>!r.results?.[0]||r.results[0].count>increments[i].limit))fail(429,'Too many login attempts. Try again after the current 15-minute window.','rate_limited');
}
function safeAccount(row){return {id:row.id,username:row.username,displayName:row.display_name||'',role:row.role,
 office:row.office_label||'',state:row.state,createdAt:row.created_utc,activatedAt:row.activated_utc||null,
 inviteExpiresAt:row.invite_expires_epoch?new Date(row.invite_expires_epoch*1000).toISOString():null};}
export async function authEndpoint(req,env,path,identity){
 if(path==='/api/session'&&req.method==='GET')return json({authenticated:Boolean(identity),
  storageReady:Boolean(env.DB?.prepare),authReady:Boolean(env.SANDY_AUTH_PEPPER&&env.SANDY_AUTH_PEPPER.length>=32),
  identity:identity?{id:identity.id,username:identity.username,name:identity.name,role:identity.role,office:identity.office_label}:null,
  mode:'shared-worker',sharedRecords:!!env.DB?.prepare,clubEstablished:env.SANDY_CLUB_APPROVALS==='enabled',readOnly:false,viewContext:'live',canSwitchView:identity?.role==='webmaster',showcaseConfigured:Boolean(env.SANDY_SHOWCASE_DB?.prepare)});
 const db=dbFor(env);
 if(path==='/api/auth/bootstrap'&&req.method==='POST'){
  requireCrypto(env);
  if(!env.SANDY_BOOTSTRAP_KEY||env.SANDY_BOOTSTRAP_KEY.length<32)fail(503,'Webmaster bootstrap has not been enabled in Cloudflare secrets.','bootstrap_not_configured');
  const b=await payload(req,8192),username=name(b.username),key=field(b.bootstrapKey,500);
  if(!validName(username)||!strong(b.password))fail(400,'Enter a valid webmaster username and password of at least 7 characters.','invalid_setup');
  await rateLimit(req,db,'bootstrap');
  const count=await db.prepare('SELECT COUNT(*) AS n FROM club_accounts').first();
  if(count?.n>0)fail(409,'The first webmaster has already been created. Use the normal sign-in flow.','already_configured');
  if(!constantEqual(await hash(key),await hash(env.SANDY_BOOTSTRAP_KEY)))fail(403,'The private bootstrap key is incorrect.','invalid_bootstrap');
  const salt=random(16),pass=await verifier(b.password,salt,env.SANDY_AUTH_PEPPER),user=id(),at=now();
  const [result]=await db.batch([
   db.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,state,password_salt,password_verifier,created_utc,activated_utc) SELECT ?,?,'webmaster','Webmaster',?,'active',?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM club_accounts)")
    .bind(user,username,field(b.displayName,100)||username,salt,pass,at,at),
   revision(db,{kind:'account',resourceId:user,resourceVersion:1,action:'webmaster_bootstrapped',
    actor:{id:user,role:'webmaster',office_label:'Webmaster'},at,snapshot:{username,role:'webmaster',state:'active'},guarded:true}),
   audit(db,{id:user,role:'webmaster'},'webmaster_bootstrapped','account',user,at,true)
  ]);
  if(result.meta.changes!==1)fail(409,'Webmaster setup was completed elsewhere.','already_configured');
  return json({ok:true,username,notice:'Remove SANDY_BOOTSTRAP_KEY from Cloudflare secrets after setup.'},201);
 }
 if(path==='/api/auth/activate'&&req.method==='POST'){
  requireCrypto(env);requireInvitations(env);
  const b=await payload(req,8192),token=field(b.token,200);
  if(!/^[a-f0-9]{64}$/.test(token)||!strong(b.password))fail(400,'Use a valid one-time invitation and a strong password.','invalid_activation');
  await rateLimit(req,db,'activation');
  const digest=await hash(token),t=nowSec();
  const record=await db.prepare('SELECT i.account_id,a.username,a.role,a.state FROM club_invites i JOIN club_accounts a ON a.id=i.account_id WHERE i.digest=? AND i.redeemed_epoch IS NULL AND i.expires_epoch>?')
   .bind(digest,t).first();
  if(!record||record.state!=='reserved'||!officeRoles.includes(record.role))fail(400,'This invitation is unavailable or has expired.','invalid_activation');
  const salt=random(16),pass=await verifier(b.password,salt,env.SANDY_AUTH_PEPPER),at=now();
  const redemptionTime=nowSec();
  const [updated]=await db.batch([
   db.prepare("UPDATE club_accounts SET password_salt=?,password_verifier=?,state='active',activated_utc=? WHERE id=? AND state='reserved' AND EXISTS(SELECT 1 FROM club_invites WHERE digest=? AND redeemed_epoch IS NULL AND expires_epoch>?)").bind(salt,pass,at,record.account_id,digest,redemptionTime),
   db.prepare('UPDATE club_invites SET redeemed_epoch=? WHERE digest=? AND redeemed_epoch IS NULL AND changes()=1').bind(redemptionTime,digest),
   audit(db,{id:record.account_id,role:record.role},'account_activated','account',record.account_id,at,true)
  ]);
  if(updated.meta.changes!==1)fail(409,'This invitation has already been redeemed.','invite_conflict');
  return json({ok:true,username:record.username});
 }
 if(path==='/api/auth/login'&&req.method==='POST'){
  requireCrypto(env);
  const b=await payload(req,8192),username=name(b.username);
  if(!validName(username)||typeof b.password!=='string'||b.password.length>256)fail(400,'Enter a username and password.','invalid_credentials');
  await rateLimit(req,db,'login/'+username);
  const failKey=await failedLoginKey(req,username);
  if(await failedLogins(db,failKey)>=FAILED_LOGIN_LIMIT)fail(429,'Too many failed sign-in attempts. Try again in 15 minutes.','rate_limited');
  const user=await db.prepare('SELECT id,username,role,state,password_salt,password_verifier FROM club_accounts WHERE username=?').bind(username).first();
  const salted=user?.password_salt||'invalid-sandy-account';
  const expected=await verifier(b.password,salted,env.SANDY_AUTH_PEPPER);
  if(!user||user.state!=='active'||!constantEqual(expected,user.password_verifier||'0'.repeat(64))){
   await recordFailedLogin(db,failKey);
   fail(401,'The username or password is incorrect.','invalid_credentials');}
  const token=random(32),at=now(),until=nowSec()+SESSION_HOURS*3600;
  // Do not create a session with a verifier that was reset or disabled during password hashing.
  const [issued]=await db.batch([
   db.prepare("INSERT INTO club_sessions(digest,account_id,created_epoch,expires_epoch) SELECT ?,id,?,? FROM club_accounts WHERE id=? AND state='active' AND password_salt=? AND password_verifier=?").bind(await hash(token),nowSec(),until,user.id,user.password_salt,user.password_verifier),
   db.prepare('UPDATE club_accounts SET last_login_utc=? WHERE id=? AND changes()=1').bind(at,user.id),
   audit(db,{id:user.id,role:user.role},'login','account',user.id,at,true)]);
  if(!issued.meta.changes)fail(401,'The username or password is incorrect.','invalid_credentials');
  return json({ok:true},200,{'Set-Cookie':cookie(token,SESSION_HOURS*3600)});
 }
 // Recovery uses the same existing token storage but a domain-separated digest.
 // It cannot activate reserved accounts or reset the sole Webmaster.
 if(path==='/api/auth/recover'&&req.method==='POST'){
  requireCrypto(env);
  const b=await payload(req,8192),token=field(b.token,200);
  if(!/^[a-f0-9]{64}$/.test(token)||!strong(b.password))fail(400,'Use a valid one-time recovery link and strong password.','invalid_recovery');
  await rateLimit(req,db,'recovery');
  const digest=await resetDigest(token);
  const record=await db.prepare("SELECT a.id,a.role,a.state,a.password_verifier FROM club_invites i JOIN club_accounts a ON a.id=i.account_id WHERE i.digest=? AND i.redeemed_epoch IS NULL AND i.expires_epoch>?").bind(digest,nowSec()).first();
  if(!record||record.state!=='active'||record.role==='webmaster')fail(400,'This recovery link is unavailable or expired.','invalid_recovery');
  const salt=random(16),pass=await verifier(b.password,salt,env.SANDY_AUTH_PEPPER),at=now(),t=nowSec();
  const [changed]=await db.batch([
   db.prepare("UPDATE club_accounts SET password_salt=?,password_verifier=? WHERE id=? AND state='active' AND role!='webmaster' AND password_verifier=? AND EXISTS(SELECT 1 FROM club_invites WHERE digest=? AND account_id=? AND redeemed_epoch IS NULL AND expires_epoch>?)").bind(salt,pass,record.id,record.password_verifier,digest,record.id,t),
   db.prepare('UPDATE club_invites SET redeemed_epoch=? WHERE digest=? AND redeemed_epoch IS NULL AND changes()=1').bind(t,digest),
   audit(db,{id:record.id,role:record.role},'password_recovered','account',record.id,at,true),
   db.prepare('DELETE FROM club_sessions WHERE account_id=? AND changes()=1').bind(record.id)
  ]);
  if(!changed.meta.changes)fail(409,'This recovery link is no longer available.','recovery_conflict');
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(path==='/api/auth/change-password'&&req.method==='POST'){
  requireCrypto(env);requireRole(identity,ROLES.filter(role=>role!=='webmaster_demo'));
  const b=await payload(req,8192);
  if(typeof b.currentPassword!=='string'||b.currentPassword.length>256||!strong(b.password)||b.currentPassword===b.password)
   fail(400,'Enter your current password and a different strong password.','invalid_password');
  await rateLimit(req,db,'change/'+identity.id);
  const user=await db.prepare("SELECT password_salt,password_verifier FROM club_accounts WHERE id=? AND state='active'").bind(identity.id).first();
  if(!user||!constantEqual(await verifier(b.currentPassword,user.password_salt,env.SANDY_AUTH_PEPPER),user.password_verifier))
   fail(401,'The current password did not match.','invalid_credentials');
  const salt=random(16),pass=await verifier(b.password,salt,env.SANDY_AUTH_PEPPER),at=now();
  const digest=await hash(sessionToken(req)),t=nowSec();
  const [changed]=await db.batch([
   db.prepare("UPDATE club_accounts SET password_salt=?,password_verifier=? WHERE id=? AND state='active' AND password_salt=? AND password_verifier=? AND EXISTS(SELECT 1 FROM club_sessions WHERE digest=? AND account_id=? AND expires_epoch>?)").bind(salt,pass,identity.id,user.password_salt,user.password_verifier,digest,identity.id,t),
   audit(db,identity,'password_changed','account',identity.id,at,true),
   db.prepare('DELETE FROM club_sessions WHERE account_id=? AND changes()=1').bind(identity.id),
   // Invalidate outstanding recovery tokens after a successful change, even when no other sessions existed.
   db.prepare('DELETE FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL AND EXISTS(SELECT 1 FROM club_accounts WHERE id=? AND password_verifier=?)').bind(identity.id,identity.id,pass)
  ]);
  if(!changed.meta.changes)fail(409,'Your account or session changed. Sign in again.','password_conflict');
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(path==='/api/auth/logout'&&req.method==='POST'){
  const token=sessionToken(req);
  if(token&&identity)await db.batch([db.prepare('DELETE FROM club_sessions WHERE digest=? AND account_id=?').bind(await hash(token),identity.id),audit(db,identity,'logout','account',identity.id,now(),true)]);
  else if(token&&env.DB?.prepare)await db.prepare('DELETE FROM club_sessions WHERE digest=?').bind(await hash(token)).run();
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(path==='/api/demo'&&req.method==='GET'){
  if(identity?.role!=='webmaster'&&identity?.role!=='webmaster_demo')fail(identity?403:401,'Demo access requires a permitted view-only account.','forbidden');
  return json({synthetic:true,records:[{name:'Illustrative demo member',town:'Example locality',joinedOn:null,renewalOn:null,membershipClass:'illustrative',status:'demo'}],
   roles:['member','committee','secretary','treasurer','webmaster'],notice:'Synthetic preview only; not real memberships or committee records.'});
 }
 if(path==='/api/accounts'&&req.method==='GET'){
  requireRole(identity,['webmaster']);
  const rows=await db.prepare('SELECT a.id,a.username,a.role,a.office_label,a.display_name,a.state,a.created_utc,a.activated_utc,(SELECT MAX(i.expires_epoch) FROM club_invites i WHERE i.account_id=a.id AND i.redeemed_epoch IS NULL AND i.expires_epoch>?) AS invite_expires_epoch FROM club_accounts a ORDER BY CASE WHEN a.role=? THEN 0 ELSE 1 END,a.username').bind(nowSec(),'webmaster').all();
  return json({accounts:(rows.results||[]).map(safeAccount),officerActivationEnabled:invitationsEnabled(env)});
 }
 if(path==='/api/accounts'&&req.method==='POST'){
  requireRole(identity,['webmaster']);
  const b=await payload(req,8192),username=name(b.username),role=field(b.role,30);
  if(!validName(username)||!ROLES.includes(role)||role==='webmaster')fail(400,'Choose an unused username and a permitted prospective account role.','invalid_account');
  const at=now(),newId=id(),office=field(b.office,100)||role,display=field(b.displayName,100);
  try{
   await db.batch([
    db.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,state,created_utc) VALUES(?,?,?,?,?,'reserved',?)").bind(newId,username,role,office,display,at),
    revision(db,{kind:'account',resourceId:newId,resourceVersion:1,action:'account_reserved',actor:identity,at,snapshot:{username,role,office,state:'reserved'}}),
    audit(db,identity,'account_reserved','account',newId,at)
   ]);
  }catch(e){if(/UNIQUE|constraint/i.test(String(e.message)))fail(409,'That username is already reserved.','account_exists');throw e}
  return json({ok:true,account:{id:newId,username,role,office,state:'reserved'},invitationSent:false},201);
 }
 const match=path.match(/^\/api\/accounts\/([a-f0-9-]{36})\/(invite|recover|revoke-link|revoke-sessions|disable)$/);
 if(match&&req.method==='POST'){
  requireRole(identity,['webmaster']);
  const [_,accountId,action]=match;
  const target=await db.prepare('SELECT id,username,role,state FROM club_accounts WHERE id=?').bind(accountId).first();
  if(!target||target.role==='webmaster')fail(404,'This reserved account is unavailable.','account_not_found');
  const at=now();
  if(action==='invite'||action==='recover'){
   const b=await payload(req,2048);
   if(b.manual!==true)fail(409,'The webmaster must explicitly prepare a private link.','manual_invite_required');
   const recovery=action==='recover';
   if(!recovery)requireInvitations(env);
   if(!recovery&&!officeRoles.includes(target.role))
    fail(403,'Manual invitations are available only for reserved prospective committee officers.','office_only');
   if(recovery&&target.role==='webmaster_demo')fail(403,'Demo access uses separate setup.','demo_recovery_forbidden');
   const expected=recovery?'active':'reserved';
   if(target.state!==expected)fail(409,recovery?'Only active accounts may recover a password.':'Only reserved accounts may activate by invitation.','account_state_conflict');
   const token=random(32),digest=await (recovery?resetDigest(token):hash(token)),t=nowSec(),expiry=t+48*3600;
   const [,issued]=await db.batch([
    db.prepare('DELETE FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL AND EXISTS(SELECT 1 FROM club_accounts WHERE id=? AND state=?)').bind(accountId,accountId,expected),
    db.prepare('INSERT INTO club_invites(digest,account_id,issued_by,created_epoch,expires_epoch) SELECT ?,id,?,?,? FROM club_accounts WHERE id=? AND state=?').bind(digest,identity.id,t,expiry,accountId,expected),
    audit(db,identity,recovery?'manual_password_recovery_created_not_sent':'manual_officer_invitation_created_not_sent','account',accountId,at,true)
   ]);
   if(!issued.meta.changes)fail(409,'The account changed before the link could be issued.','account_state_conflict');
   return json({token,username:target.username,expiresAt:new Date(expiry*1000).toISOString(),sent:false,recovery,
    instruction:'One-time link prepared. Copy it or open a draft email to send it privately. No message was sent automatically.'},201);
  }
  if(action==='revoke-link'||action==='revoke-sessions'){
   const b=await payload(req,2048);
   if(b.manual!==true)fail(409,'Confirm this account action explicitly.','manual_action_required');
   const link=action==='revoke-link';
   const [result]=await db.batch([
    db.prepare(link?'DELETE FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL':'DELETE FROM club_sessions WHERE account_id=?').bind(accountId),
    // SQLite changes() may exceed one when several sessions are revoked.
    db.prepare("INSERT INTO club_audit(id,actor_id,actor_role,action,resource_kind,resource_id,occurred_utc,context_json) SELECT ?,?,?,?,'account',?,?,'{}' WHERE changes()>0").bind(id(),identity.id,identity.role,link?'private_link_revoked':'account_sessions_revoked',accountId,at)
   ]);
   return json({ok:true,revoked:result.meta.changes});
  }
  if(action==='disable'){
   const b=await payload(req,2048);
   if(b.manual!==true)fail(409,'Confirm disabling the account explicitly.','manual_action_required');
   const [result]=await db.batch([
    db.prepare("UPDATE club_accounts SET state='disabled' WHERE id=? AND state!='disabled'").bind(accountId),
    audit(db,identity,'account_disabled','account',accountId,at,true),
    db.prepare('DELETE FROM club_sessions WHERE account_id=?').bind(accountId),
    db.prepare('DELETE FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL').bind(accountId)
   ]);
   if(!result.meta.changes)fail(409,'This account was already disabled.','already_disabled');
   return json({ok:true});
  }
 }
 fail(404,'This account operation does not exist.','not_found');
}
