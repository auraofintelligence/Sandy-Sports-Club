import {ApiError,fail,json,now,epoch,id,dbFor,payload,field,requireRole,revision,audit} from './shared.mjs';
const enc=new TextEncoder(),COOKIE='__Host-sandy_session',SESSION_HOURS=8,PBKDF2=100000;
const nowSec=()=>epoch();
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const hex=buf=>Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('');
const random=n=>hex(bytes(n));
const hash=async value=>hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const cookie=(value,age)=>COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
const name=x=>field(x,80).toLowerCase();
const validName=x=>/^[a-z0-9][a-z0-9._+-]{2,79}$/.test(x);
const ROLES=['webmaster','webmaster_demo','president','vice_president','secretary','assistant_secretary','treasurer','committee','member'];
const strong=x=>typeof x==='string'&&x.length>=12&&x.length<=256;
function constantEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
async function verifier(password,salt,secret){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const source=await crypto.subtle.sign('HMAC',key,enc.encode(password));
 const pass=await crypto.subtle.importKey('raw',source,'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:PBKDF2},pass,256));
}
function requireCrypto(env){
 if(typeof env.SANDY_AUTH_PEPPER!=='string'||env.SANDY_AUTH_PEPPER.length<32)
  fail(503,'Authentication is not configured for this club.','auth_not_configured');
}
const sessionToken=req=>(req.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-sandy_session=([a-f0-9]{64})(?:;|$)/)?.[1]||null;
export async function identityFor(req,env){
 if(!env.DB?.prepare||!env.SANDY_AUTH_PEPPER)return null;
 const token=sessionToken(req);if(!token)return null;
 const db=dbFor(env),digest=await hash(token);
 const row=await db.prepare('SELECT a.id,a.username,a.role,a.office_label,a.display_name,a.state FROM club_sessions s JOIN club_accounts a ON a.id=s.account_id WHERE s.digest=? AND s.expires_epoch>? AND a.state=?')
  .bind(digest,nowSec(),'active').first();
 if(!row)return null;
 return {id:row.id,username:row.username,name:row.display_name||row.username,role:row.role,office_label:row.office_label||row.role};
}
async function rateLimit(req,db,key){
 const bucket=Math.floor(nowSec()/900);
 const ip=req.headers.get('cf-connecting-ip')||'local';
 const digest=await hash('auth-try/'+bucket+'/'+ip+'/'+key);
 const expiry=(bucket+1)*900;
 await db.prepare('INSERT INTO club_login_attempts(key,count,expires_epoch) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_epoch<=? THEN 1 ELSE count+1 END,expires_epoch=?')
  .bind(digest,expiry,nowSec(),expiry).run();
 const row=await db.prepare('SELECT count FROM club_login_attempts WHERE key=?').bind(digest).first();
 if(row?.count>8)fail(429,'Too many login attempts. Try again later.','rate_limited');
}
function safeAccount(row){return {id:row.id,username:row.username,displayName:row.display_name||'',role:row.role,
 office:row.office_label||'',state:row.state,createdAt:row.created_utc,activatedAt:row.activated_utc||null};}
export async function authEndpoint(req,env,path,identity){
 if(path==='/api/session'&&req.method==='GET')return json({authenticated:Boolean(identity),
  storageReady:Boolean(env.DB?.prepare),authReady:Boolean(env.SANDY_AUTH_PEPPER&&env.SANDY_AUTH_PEPPER.length>=32),
  identity:identity?{id:identity.id,username:identity.username,name:identity.name,role:identity.role,office:identity.office_label}:null,
  mode:'shared-worker',sharedRecords:!!env.DB?.prepare,clubEstablished:env.SANDY_CLUB_APPROVALS==='enabled'});
 const db=dbFor(env);
 if(path==='/api/auth/bootstrap'&&req.method==='POST'){
  requireCrypto(env);
  if(!env.SANDY_BOOTSTRAP_KEY||env.SANDY_BOOTSTRAP_KEY.length<32)fail(503,'Webmaster bootstrap has not been enabled in Cloudflare secrets.','bootstrap_not_configured');
  const b=await payload(req,8192),username=name(b.username),key=field(b.bootstrapKey,500);
  if(!validName(username)||!strong(b.password))fail(400,'Enter a valid webmaster username and password of at least 12 characters.','invalid_setup');
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
  requireCrypto(env);
  const b=await payload(req,8192),token=field(b.token,200);
  if(!/^[a-f0-9]{64}$/.test(token)||!strong(b.password))fail(400,'Use a valid one-time invitation and a strong password.','invalid_activation');
  await rateLimit(req,db,'activation');
  const digest=await hash(token),t=nowSec();
  const record=await db.prepare('SELECT i.account_id,a.username,a.role,a.state FROM club_invites i JOIN club_accounts a ON a.id=i.account_id WHERE i.digest=? AND i.redeemed_epoch IS NULL AND i.expires_epoch>?')
   .bind(digest,t).first();
  if(!record||record.state!=='reserved')fail(400,'This invitation is unavailable or has expired.','invalid_activation');
  const salt=random(16),pass=await verifier(b.password,salt,env.SANDY_AUTH_PEPPER),at=now();
  const [updated]=await db.batch([
   db.prepare("UPDATE club_accounts SET password_salt=?,password_verifier=?,state='active',activated_utc=? WHERE id=? AND state='reserved' AND EXISTS(SELECT 1 FROM club_invites WHERE digest=? AND redeemed_epoch IS NULL AND expires_epoch>?)").bind(salt,pass,at,record.account_id,digest,t),
   db.prepare('UPDATE club_invites SET redeemed_epoch=? WHERE digest=? AND redeemed_epoch IS NULL AND changes()=1').bind(t,digest),
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
  const user=await db.prepare('SELECT id,username,role,state,password_salt,password_verifier FROM club_accounts WHERE username=?').bind(username).first();
  const salted=user?.password_salt||'invalid-sandy-account';
  const expected=await verifier(b.password,salted,env.SANDY_AUTH_PEPPER);
  if(!user||user.state!=='active'||!constantEqual(expected,user.password_verifier||'0'.repeat(64)))
   fail(401,'The username or password is incorrect.','invalid_credentials');
  const token=random(32),at=now(),until=nowSec()+SESSION_HOURS*3600;
  await db.batch([
   db.prepare('INSERT INTO club_sessions(digest,account_id,created_epoch,expires_epoch) VALUES(?,?,?,?)').bind(await hash(token),user.id,nowSec(),until),
   db.prepare('UPDATE club_accounts SET last_login_utc=? WHERE id=?').bind(at,user.id),
   audit(db,{id:user.id,role:user.role},'login','account',user.id,at)]);
  return json({ok:true},200,{'Set-Cookie':cookie(token,SESSION_HOURS*3600)});
 }
 if(path==='/api/auth/logout'&&req.method==='POST'){
  const token=sessionToken(req);
  if(token&&env.DB?.prepare)await db.prepare('DELETE FROM club_sessions WHERE digest=?').bind(await hash(token)).run();
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(path==='/api/demo'&&req.method==='GET'){
  if(identity?.role!=='webmaster'&&identity?.role!=='webmaster_demo')fail(identity?403:401,'Demo access requires a permitted view-only account.','forbidden');
  return json({synthetic:true,records:[{name:'Illustrative demo member',town:'Example locality',joinedOn:null,renewalOn:null,membershipClass:'illustrative',status:'demo'}],
   roles:['member','committee','secretary','treasurer','webmaster'],notice:'Synthetic preview only; not real memberships or committee records.'});
 }
 if(path==='/api/accounts'&&req.method==='GET'){
  requireRole(identity,['webmaster']);
  const rows=await db.prepare('SELECT id,username,role,office_label,display_name,state,created_utc,activated_utc FROM club_accounts ORDER BY CASE WHEN role=? THEN 0 ELSE 1 END,username').bind('webmaster').all();
  return json({accounts:(rows.results||[]).map(safeAccount)});
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
 const match=path.match(/^\/api\/accounts\/([a-f0-9-]{36})\/(invite|disable)$/);
 if(match&&req.method==='POST'){
  requireRole(identity,['webmaster']);
  const [_,accountId,action]=match;
  const target=await db.prepare('SELECT id,username,role,state FROM club_accounts WHERE id=?').bind(accountId).first();
  if(!target||target.role==='webmaster')fail(404,'This reserved account is unavailable.','account_not_found');
  const at=now();
  if(action==='invite'){
   if(env.SANDY_INVITES_ENABLED!=='enabled')fail(409,'Invitation generation remains disabled until explicitly activated for the club.','invitations_paused');
   if(target.state!=='reserved')fail(409,'Only reserved accounts may be activated by invitation.','account_not_reserved');
   const token=random(32),digest=await hash(token),expiry=nowSec()+48*3600;
   await db.batch([
    db.prepare('DELETE FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL').bind(accountId),
    db.prepare('INSERT INTO club_invites(digest,account_id,issued_by,created_epoch,expires_epoch) VALUES(?,?,?,?,?)').bind(digest,accountId,identity.id,nowSec(),expiry),
    audit(db,identity,'invitation_prepared_not_sent','account',accountId,at)
   ]);
   return json({token,username:target.username,expiresAt:new Date(expiry*1000).toISOString(),sent:false,
    instruction:'Copy this once-only activation token privately. No email or invitation has been sent.'},201);
  }
  if(action==='disable'){
   const [result]=await db.batch([
    db.prepare("UPDATE club_accounts SET state='disabled' WHERE id=? AND state!='disabled'").bind(accountId),
    db.prepare('DELETE FROM club_sessions WHERE account_id=?').bind(accountId),
    audit(db,identity,'account_disabled','account',accountId,at)
   ]);
   if(!result.meta.changes)fail(409,'This account was already disabled.','already_disabled');
   return json({ok:true});
  }
 }
 fail(404,'This account operation does not exist.','not_found');
}
