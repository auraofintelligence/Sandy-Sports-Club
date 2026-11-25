// Owner rehearsal and independent showcase share real read handlers, not live records.
import {fail,json,epoch,payload,requireRole,STAFF} from './shared.mjs';
import {identityFor,authEndpoint} from './auth.mjs';
const COOKIE='__Host-sandy_view',LIVE='__Host-sandy_session',DURATION=3600,MARKER_AGE=7*24*3600;
const roles=[...STAFF,'member','webmaster_demo'];
const prefix='f1c71000-0000-4000-8000-';
export const fixtureId=n=>prefix+String(n).padStart(12,'0');
const enc=new TextEncoder(),hex=value=>Array.from(new Uint8Array(value),v=>v.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
const rawCookie=(req,name)=>{
 const fields=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='));
 return fields.length===0?null:fields.length===1?fields[0].slice(name.length+1):'invalid-duplicate';
};
const cookie=(name,value,age)=>name+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
function clear(res,...names){
 const headers=new Headers(res.headers);
 for(const name of names)headers.append('Set-Cookie',cookie(name,'',0));
 return new Response(res.body,{status:res.status,headers});
}
async function sign(secret,message){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,enc.encode(message)));
}
function same(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
const showcaseSecret=env=>typeof env.SANDY_SHOWCASE_KEY==='string'&&/^[a-f0-9]{64}$/.test(env.SANDY_SHOWCASE_KEY)?env.SANDY_SHOWCASE_KEY:null;
const ownerSecret=env=>typeof env.SANDY_AUTH_PEPPER==='string'&&env.SANDY_AUTH_PEPPER.length>=32?env.SANDY_AUTH_PEPPER:null;
function fictionalIdentity(role){
 const effective=role==='webmaster_demo'?'webmaster':role,n=STAFF.indexOf(effective)+1;
 return {id:fixtureId(n||99),role:effective,username:'example-'+effective,name:'Example '+effective.replace(/_/g,' '),office_label:'Example '+effective.replace(/_/g,' ')};
}
// Only the fixture DB can reach handlers. Even a future GET handler cannot
// obtain a writable statement, batch, production credentials or service binding.
function readOnlyDB(db){
 return {withSession(){return this},prepare(query){
  if(!/^\s*SELECT\b/i.test(query)||/;\s*\S/.test(query))fail(403,'View-only database permits reads only.','view_read_only');
  const q=db.prepare(query);
  const wrap=s=>({first:(...args)=>s.first(...args),all:()=>s.all(),run:()=>fail(403,'View-only database permits reads only.','view_read_only')});
  return {...wrap(q),bind:(...args)=>wrap(q.bind(...args))};
 },batch(){fail(403,'View-only database permits reads only.','view_read_only')}};
}
async function syntheticEnv(env){
 const db=env.SANDY_SHOWCASE_DB;
 if(!db?.prepare||db===env.DB)fail(503,'The separate synthetic showcase database is not configured. No live data will be opened.','showcase_unavailable');
 let marker,unsafe;
 try{
  marker=await db.prepare("SELECT version,classification FROM sandy_showcase_marker WHERE id=1").first();
  unsafe=await db.prepare("SELECT (SELECT count(*) FROM club_accounts WHERE id NOT LIKE 'f1c71000-0000-4000-8000-%' OR state!='reserved' OR password_verifier IS NOT NULL OR password_salt IS NOT NULL OR role='member')+(SELECT count(*) FROM club_sessions)+(SELECT count(*) FROM club_invites)+(SELECT count(*) FROM club_people WHERE id NOT LIKE 'f1c71000-0000-4000-8000-%' OR account_id IS NOT NULL)+(SELECT count(*) FROM club_records WHERE id NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM club_interest WHERE id NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM studio_briefs WHERE id NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM club_audit WHERE actor_id NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM club_revisions WHERE actor_id NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM studio_settings WHERE updated_by NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM studio_post_edits WHERE updated_by NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM studio_metrics WHERE updated_by NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM studio_decisions)+(SELECT count(*) FROM studio_handoffs)+(SELECT count(*) FROM studio_post_links)+(SELECT count(*) FROM club_login_attempts)+(SELECT count(*) FROM sandy_library_documents WHERE id NOT LIKE 'f1c71000-0000-4000-8000-%' OR owner_id NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM sandy_library_versions WHERE document_id NOT LIKE 'f1c71000-0000-4000-8000-%' OR created_by NOT LIKE 'f1c71000-0000-4000-8000-%')+(SELECT count(*) FROM sandy_library_parts WHERE document_id NOT LIKE 'f1c71000-0000-4000-8000-%') AS n,(SELECT count(*) FROM club_people) AS people,(SELECT count(*) FROM club_accounts) AS officers").first();
 }catch{fail(503,'The synthetic showcase schema is unavailable. No live data will be opened.','showcase_unavailable')}
 if(marker?.version!==1||marker.classification!=='SANDY_SYNTHETIC_ONLY'||unsafe?.n!==0||unsafe.people!==1||unsafe.officers!==STAFF.length)
  fail(503,'The showcase data boundary did not validate. No live data will be opened.','showcase_unavailable');
 return {DB:readOnlyDB(db),SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled',SANDY_SYNTHETIC_VIEW:true};
}
async function issue(req,env,mode,role){
 const expiry=epoch()+DURATION,nonce=random(),value=[mode,role,expiry,nonce].join('.');
 const secret=mode==='owner'?ownerSecret(env):showcaseSecret(env);
 const binding=mode==='owner'?rawCookie(req,LIVE):'standalone';
 if(!secret||!binding)fail(503,'View-only sign-in is not configured.','showcase_unavailable');
 const sig=await sign(secret,'sandy-view-v1/'+value+'/'+binding);
 return json({ok:true,viewMode:mode,role,expiresAt:new Date(expiry*1000).toISOString()},200,{'Set-Cookie':cookie(COOKIE,value+'.'+sig,MARKER_AGE)});
}
async function parse(req,env,allowExpired=false){
 const value=rawCookie(req,COOKIE);
 if(value===null)return null;
 const m=/^(owner|showcase)\.([a-z_]+)\.(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
 if(!m)return false;
 const [,mode,role,expiry,nonce,sig]=m;
 if(!roles.includes(role)||(!allowExpired&&Number(expiry)<=epoch())||(mode==='showcase'&&role!=='webmaster_demo'))return false;
 const secret=mode==='owner'?ownerSecret(env):showcaseSecret(env);
 const binding=mode==='owner'?rawCookie(req,LIVE):'standalone';
 if(!secret||!binding||!same(sig,await sign(secret,'sandy-view-v1/'+[mode,role,expiry,nonce].join('.')+'/'+binding)))return false;
 if(mode==='owner'&&(await identityFor(req,env))?.role!=='webmaster')return false;
 return {mode,role,nonce,expiry:Number(expiry)};
}
function readSession(view){
 const actor=fictionalIdentity(view.role);
 return json({authenticated:true,storageReady:true,authReady:true,
  identity:{id:actor.id,username:actor.username,name:actor.name,role:actor.role,office:actor.office_label},
  mode:'synthetic-view',sharedRecords:false,clubEstablished:false,readOnly:true,synthetic:true,viewMode:view.mode,
  viewRole:view.role,viewContext:view.nonce,canSwitchView:view.mode==='owner',viewExpiresAt:new Date(view.expiry*1000).toISOString()});
}
const closed=()=>fail(409,'This view has changed or expired. Reload or explicitly exit the view before opening live records.','view_changed');
export async function viewMode(req,env,path,serve){
 const marker=rawCookie(req,COOKIE),context=req.headers.get('x-sandy-view');
 if(path==='/api/view/exit'&&req.method==='POST'){
  const view=await parse(req,env,true);
  // A standalone, invalid or missing view must not reveal a prior live session.
  return clear(json({ok:true,realRestored:view?.mode==='owner'}),COOKIE,...(view?.mode==='owner'?[]:[LIVE]));
 }
 if(path==='/api/view/login'&&req.method==='POST'){
  if(marker!==null||rawCookie(req,LIVE)!==null)fail(409,'Exit the current session before opening the independent showcase.','view_session_exists');
  const b=await payload(req,2048),secret=showcaseSecret(env);
  if(!secret)fail(503,'The independent showcase access key is not configured.','showcase_unavailable');
  if(!same(b.key,secret))fail(401,'The showcase access key did not match.','invalid_showcase_key');
  await syntheticEnv(env);
  return issue(req,env,'showcase','webmaster_demo');
 }
 if(path==='/api/view/select'&&req.method==='POST'){
  const view=await parse(req,env);
  if(marker!==null&&view?.mode!=='owner')fail(403,'Only the real Webmaster may change role previews.','view_forbidden');
  const identity=await identityFor(req,env);requireRole(identity,['webmaster']);
  const b=await payload(req,2048);
  if(!roles.includes(b.role))fail(400,'Choose a supported view role.','invalid_view_role');
  if(b.role==='webmaster')return clear(json({ok:true,realRestored:true}),COOKIE);
  await syntheticEnv(env);
  return issue(req,env,'owner',b.role);
 }
 if(marker===null){
  if(context&&context!=='live')closed();
  return serve(req,env,path);
 }
 const view=await parse(req,env);
 if(!view)closed();
 if(context&&context!==view.nonce)closed();
 if(path==='/api/auth/logout'&&req.method==='POST'){
  const result=view.mode==='owner'?await authEndpoint(req,env,path,await identityFor(req,env)):json({ok:true});
  return clear(result,COOKIE,LIVE);
 }
 if(req.method!=='GET'&&req.method!=='HEAD')fail(403,'This is a view-only synthetic workspace. No changes are permitted.','view_read_only');
 if(path==='/api/session'&&req.method==='GET'){await syntheticEnv(env);return readSession(view)}
 if(path.startsWith('/api/view/')||path.startsWith('/api/auth/')||path.startsWith('/api/accounts/')||path==='/api/member/data-export')
  fail(403,'This private operation is unavailable in view-only mode.','view_read_only');
 const isolated=await syntheticEnv(env),identity=fictionalIdentity(view.role);
 if(path==='/api/public-config')return json({clubEstablished:false,publicInterestReady:false,turnstileSiteKey:null,invitationSendingEnabled:false,synthetic:true});
 if(path==='/api/health')return json({service:'sandy-showcase',synthetic:true,storageConfigured:true,operationalApprovals:false,livePublishing:false,smsEnabled:false,paymentsEnabled:false});
 return serve(req,isolated,path,identity);
}
