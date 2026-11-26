// Private, versioned, bounded binary store. No public URLs, provider calls or
// automatic release. Distinct encryption key, per-part authenticated encryption.
import {fail,json,now,epoch,id,dbFor,payload,field,dateField,version,requireRole,STAFF,revision,audit} from './shared.mjs';
import {memberSafeguardFlags,participationGuard,participationArgs} from './member-safeguards.mjs';
export const FIXTURE_LIBRARY_KEY='fixture-library-key-not-for-any-production-data';
export const LIBRARY_LIMIT=1048576;
const PART=49152,enc=new TextEncoder(),scopes={owner:[],governance:['webmaster','president','secretary','assistant_secretary'],finance:['webmaster','treasurer'],safety:['webmaster','president','secretary']};
const types={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'};
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
function un64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
const digest=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
function secret(env){
 if(env.SANDY_SYNTHETIC_VIEW===true)return FIXTURE_LIBRARY_KEY;
 const s=env.SANDY_LIBRARY_KEY;
 return typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)?s:null;
}
async function ready(db){return !!await db.prepare("SELECT 1 AS n FROM sqlite_master WHERE type='table' AND name='sandy_library_parts'").first()}
async function keys(env){
 const s=secret(env);if(!s)fail(503,'Private file encryption is not configured. No file can be opened.','library_unavailable');
 const key=async label=>crypto.subtle.digest('SHA-256',enc.encode('sandy-library-v1/'+label+'/'+s));
 return {aes:await crypto.subtle.importKey('raw',await key('content'),'AES-GCM',false,['encrypt','decrypt']),ticket:await crypto.subtle.importKey('raw',await key('ticket'),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])};
}
const aad=(doc,v,part)=>enc.encode('sandy-library-v1/'+doc+'/'+v+'/'+part);
function roleList(row){try{const x=JSON.parse(row.roles_json);return Array.isArray(x)?x:[]}catch{return []}}
export function canReadLibrary(row,actor){
 if(!row||!actor||!Object.hasOwn(scopes,row.scope))return false;
 if(row.scope==='owner')return row.owner_id===actor.id;
 return scopes[row.scope].includes(actor.role)&&(row.owner_id===actor.id||roleList(row).includes(actor.role));
}
const canManage=(row,actor)=>canReadLibrary(row,actor)&&(row.owner_id===actor.id||actor.role==='webmaster'&&row.scope!=='owner');
const rowFor=(db,doc)=>db.prepare('SELECT * FROM sandy_library_documents WHERE id=?').bind(doc).first();
const versionFor=(db,row)=>db.prepare('SELECT * FROM sandy_library_versions WHERE document_id=? AND content_version=?').bind(row.id,row.content_version).first();
function view(row,content,actor){
 return {id:row.id,title:row.title,scope:row.scope,roles:roleList(row),state:row.state,version:row.version,contentVersion:row.content_version,
  ownerId:row.owner_id,reviewDate:row.review_date,createdAt:row.created_utc,updatedAt:row.updated_utc,updatedBy:row.updated_by,
  mediaType:content?.media_type,bytes:content?.byte_length,digest:content?.digest,source:content?.source_note,canManage:canManage(row,actor)};
}
export async function libraryAuditAllowed(db,actor,doc){try{return canReadLibrary(await rowFor(db,doc),actor)}catch{return false}}
export async function ownLibraryMetadata(db,actor){
 if(!await ready(db))return {available:false,documents:[]};
 const {results}=await db.prepare("SELECT d.*,v.media_type,v.byte_length,v.digest,v.source_note FROM sandy_library_documents d JOIN sandy_library_versions v ON d.id=v.document_id AND d.content_version=v.content_version WHERE d.owner_id=? AND d.scope='owner' ORDER BY d.updated_utc DESC").bind(actor.id).all();
 return {available:true,documents:results.map(r=>view(r,r,actor))};
}
function strict(b,allowed){if(Object.keys(b).some(k=>!allowed.includes(k)))fail(400,'Only supported private document fields are allowed.','invalid_library_fields')}
function validatedRoles(scope,roles){
 if(!Array.isArray(roles)||roles.some(x=>!scopes[scope].includes(x))||new Set(roles).size!==roles.length)fail(400,'Choose distinct roles allowed for this classification.','invalid_library_roles');
 return roles;
}
function review(value){
 const d=dateField(value,false);if(d<new Date(Date.now()+36000000).toISOString().slice(0,10))fail(400,'Choose a current or future retention review date.','invalid_review_date');return d;
}
function file(b){
 if(!Object.hasOwn(types,b.mediaType)||typeof b.content!=='string'||b.content.length>Math.ceil(LIBRARY_LIMIT/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.content)||b.content.length%4!==0)fail(400,'Choose a PDF, PNG or JPEG up to 1 MiB.','invalid_file');
 let bytes;try{bytes=un64(b.content)}catch{fail(400,'Invalid file encoding.','invalid_file')}
 if(!bytes.length||bytes.length>LIBRARY_LIMIT)fail(413,'Private files are limited to 1 MiB.','file_too_large');
 const signature=b.mediaType==='application/pdf'?[37,80,68,70,45]:b.mediaType==='image/png'?[137,80,78,71,13,10,26,10]:[255,216,255];
 if(!signature.every((x,i)=>bytes[i]===x))fail(400,'The file signature does not match its selected type.','invalid_file');
 const source=field(b.source,240);if(!source||b.consent!==true)fail(400,'Record the source and confirm permission to store this private file.','consent_required');
 return {bytes,mediaType:b.mediaType,source};
}
async function encryptedParts(db,key,doc,v,content,actor,at){
 const parts=[];
 for(let offset=0,index=0;offset<content.bytes.length;offset+=PART,index++){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(doc,v,index)},key,content.bytes.subarray(offset,offset+PART));
  parts.push({index,iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))});
 }
 const hash=await digest(content.bytes);
 const values=[doc,v,content.mediaType,content.bytes.length,hash,parts.length,content.source,actor.id,at];
 return {hash,statements:[
  db.prepare('INSERT INTO sandy_library_versions(document_id,content_version,media_type,byte_length,digest,part_count,source_note,created_by,created_utc) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1').bind(...values),
  ...parts.map(p=>db.prepare('INSERT INTO sandy_library_parts(document_id,content_version,part,iv,ciphertext) SELECT ?,?,?,?,? WHERE changes()=1').bind(doc,v,p.index,p.iv,p.ciphertext))
 ]};
}
async function writeAllowed(env,db,actor,scope){
 if(env.SANDY_SYNTHETIC_VIEW||env.SANDY_PRIVATE_LIBRARY_ENABLED!=='enabled')fail(409,'Private file storage is not activated. No file was saved.','library_disabled');
 if(actor.role==='member'){
  if(scope!=='owner'||env.SANDY_CLUB_APPROVALS!=='enabled')fail(403,'Member file upload is not available.','library_forbidden');
  const flags=await memberSafeguardFlags(db,actor.id);
  if(!flags.optionalParticipation||!await db.prepare("SELECT id FROM club_people WHERE account_id=? AND status='active' LIMIT 1").bind(actor.id).first())fail(403,'Private file upload requires current adult participation consent.','safeguards_required');
  return flags;
 }
 requireRole(actor,scope==='owner'?STAFF:scopes[scope]||[]);
 return null;
}
async function token(keys,row,actor,expires){
 const value=enc.encode(['sandy-download-v1',row.id,row.version,row.content_version,actor.id,expires].join('/'));
 return hex(await crypto.subtle.sign('HMAC',keys.ticket,value));
}
export async function libraryEndpoint(req,env,path,actor){
 requireRole(actor,[...STAFF,'member']);
 const db=dbFor(env),url=new URL(req.url);
 if(path==='/api/library'&&req.method==='GET'){
  if(!await ready(db)||!secret(env))return json({available:false,writeEnabled:false,documents:[],notice:'Private file storage has not been provisioned.'});
  const page=Math.max(0,Math.min(10000,Math.floor(Number(url.searchParams.get('page'))||0)));
  const allowed=Object.keys(scopes).filter(s=>s!=='owner'&&scopes[s].includes(actor.role));
  const condition="(d.scope='owner' AND d.owner_id=?)"+(allowed.length?" OR (d.scope IN ("+allowed.map(()=>'?').join(',')+") AND (d.owner_id=? OR EXISTS(SELECT 1 FROM json_each(d.roles_json) WHERE value=?)))":'');
  const args=[actor.id,...(allowed.length?[...allowed,actor.id,actor.role]:[])],scope=url.searchParams.get('scope');
  if(scope&&!['owner',...allowed].includes(scope))fail(403,'This document classification is not available to this account.','library_forbidden');
  const {results}=await db.prepare('SELECT d.*,v.media_type,v.byte_length,v.digest,v.source_note FROM sandy_library_documents d JOIN sandy_library_versions v ON d.id=v.document_id AND d.content_version=v.content_version WHERE ('+condition+')'+(scope?' AND d.scope=?':'')+' ORDER BY d.updated_utc DESC,d.id LIMIT 101 OFFSET ?').bind(...args,...(scope?[scope]:[]),page*100).all();
  let writeEnabled=env.SANDY_PRIVATE_LIBRARY_ENABLED==='enabled'&&!env.SANDY_SYNTHETIC_VIEW;
  if(writeEnabled&&actor.role==='member')writeEnabled=env.SANDY_CLUB_APPROVALS==='enabled'&&(await memberSafeguardFlags(db,actor.id)).optionalParticipation&&!!await db.prepare("SELECT id FROM club_people WHERE account_id=? AND status='active' LIMIT 1").bind(actor.id).first();
  return json({available:true,writeEnabled,
   documents:results.slice(0,100).filter(r=>canReadLibrary(r,actor)).map(r=>view(r,r,actor)),page,hasMore:results.length>100,scopes:Object.keys(scopes).filter(s=>s==='owner'||scopes[s].includes(actor.role)),scopeRoles:scopes,limit:LIBRARY_LIMIT,synthetic:!!env.SANDY_SYNTHETIC_VIEW});
 }
 if(!await ready(db))fail(503,'Private file storage has not been provisioned.','library_unavailable');
 if(path==='/api/library'&&req.method==='POST'){
  const b=await payload(req,1450000);strict(b,['title','scope','roles','reviewDate','mediaType','content','source','consent']);
  const title=field(b.title,160),scope=b.scope;
  if(!title||!Object.hasOwn(scopes,scope))fail(400,'Choose a title and private classification.','invalid_library_fields');
  const flags=await writeAllowed(env,db,actor,scope),roles=validatedRoles(scope,b.roles),reviewDate=review(b.reviewDate),content=file(b),k=await keys(env);
  const doc=id(),at=now(),parts=await encryptedParts(db,k.aes,doc,1,content,actor,at);
  const guard=flags?' WHERE '+participationGuard:'';
  const [saved]=await db.batch([
   db.prepare("INSERT INTO sandy_library_documents(id,owner_id,title,scope,roles_json,state,version,content_version,review_date,created_utc,updated_utc,updated_by) SELECT ?,?,?,?,?,'private',1,1,?,?,?,?"+guard).bind(doc,actor.id,title,scope,JSON.stringify(roles),reviewDate,at,at,actor.id,...(flags?participationArgs(actor,flags):[])),
   ...parts.statements,
   revision(db,{kind:'library',resourceId:doc,resourceVersion:1,action:'library_uploaded',actor,at,snapshot:{title,scope,roles,reviewDate,contentVersion:1,digest:parts.hash,source:content.source},guarded:true}),
   audit(db,actor,'library_uploaded','library',doc,at,true,{fromVersion:0,toVersion:1})
  ]);
  if(!saved.meta.changes)fail(409,'Your participation changed. No file was saved.','conflict');
  return json({ok:true,id:doc,version:1},201);
 }
 const m=path.match(/^\/api\/library\/([a-f0-9-]{36})(?:\/(ticket|download|replace|history))?$/);
 if(!m||!uuid(m[1]))fail(404,'Private document unavailable.','library_not_found');
 const doc=m[1],action=m[2],row=await rowFor(db,doc);
 if(!canReadLibrary(row,actor))fail(404,'Private document unavailable.','library_not_found');
 const content=await versionFor(db,row);if(!content)fail(503,'Document content unavailable.','library_unavailable');
 if(!action&&req.method==='GET')return json({document:view(row,content,actor)});
 if(action==='history'&&req.method==='GET'){
  // Historical metadata is intentionally restricted to the current custodian;
  // revoked recipients cannot enumerate former ACLs or source notes.
  if(!canManage(row,actor))fail(403,'Only the current custodian may inspect private version history.','library_forbidden');
  const {results}=await db.prepare("SELECT resource_version AS version,actor_id AS actorId,actor_office AS office,at_utc AS at,operation,changes_json AS changes,snapshot_json AS snapshot FROM club_revisions WHERE resource_kind='library' AND resource_id=? ORDER BY resource_version DESC LIMIT 80").bind(doc).all();
  return json({history:results.map(r=>({...r,changes:JSON.parse(r.changes),snapshot:JSON.parse(r.snapshot)}))});
 }
 if(['ticket','download'].includes(action)&&['GET','HEAD'].includes(req.method)){
  if(row.state!=='private')fail(404,'This document has been withdrawn.','library_withdrawn');
  const k=await keys(env);
  if(action==='ticket'&&req.method==='GET'){const expiry=epoch()+300;return json({ticket:expiry+'.'+await token(k,row,actor,expiry),expiresAt:new Date(expiry*1000).toISOString()})}
  const t=/^(\d{10})\.([a-f0-9]{64})$/.exec(req.headers.get('x-sandy-download')||'');
  if(!t||Number(t[1])<=epoch()||Number(t[1])>epoch()+300||!await crypto.subtle.verify('HMAC',k.ticket,Uint8Array.from(t[2].match(/../g),v=>parseInt(v,16)),enc.encode(['sandy-download-v1',row.id,row.version,row.content_version,actor.id,Number(t[1])].join('/'))))fail(403,'The private download permission expired or changed. Request a new one.','library_ticket_invalid');
  const headers={'Content-Type':content.media_type,'Content-Length':String(content.byte_length),'Content-Disposition':'attachment; filename="sandy-document-'+doc+'.'+types[content.media_type]+'"','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'no-store, private'};
  if(req.method==='HEAD')return new Response(null,{headers});
  const {results}=await db.prepare('SELECT part,iv,ciphertext FROM sandy_library_parts WHERE document_id=? AND content_version=? ORDER BY part').bind(doc,row.content_version).all();
  let bytes=new Uint8Array(content.byte_length),offset=0;
  try{
   if(results.length!==content.part_count)throw Error('parts');
   for(let i=0;i<results.length;i++){
    if(results[i].part!==i)throw Error('sequence');
    const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(results[i].iv),additionalData:aad(doc,row.content_version,i)},k.aes,un64(results[i].ciphertext)));
    bytes.set(plain,offset);offset+=plain.length;
   }
   if(offset!==content.byte_length||await digest(bytes)!==content.digest)throw Error('integrity');
  }catch{fail(503,'Private file integrity check failed. No content was returned.','library_integrity')}
  const latest=await rowFor(db,doc);
  if(!canReadLibrary(latest,actor)||latest.state!=='private'||latest.version!==row.version)fail(403,'Private download permission changed. Request a new one.','library_ticket_invalid');
  return new Response(bytes,{headers});
 }
 if(!canManage(row,actor))fail(403,'Only the current custodian may modify this document.','library_forbidden');
 if(!action&&req.method==='PATCH'){
  // Withdrawal remains available after participation withdrawal or disabling new uploads.
  const b=await payload(req,4096);strict(b,['action','version','roles','reviewDate','reason']);
  if(version(b.version)!==row.version)fail(409,'Document changed. Reload before saving.','conflict');
  if(!['access','withdraw'].includes(b.action)||row.state!=='private')fail(409,'This document cannot be modified in its current state.','library_locked');
  const reason=field(b.reason,240);if(!reason)fail(400,'Record a reason for the change.','reason_required');
  if(b.action==='access')await writeAllowed(env,db,actor,row.scope);
  const roles=b.action==='access'?validatedRoles(row.scope,b.roles):roleList(row),reviewDate=b.action==='access'?review(b.reviewDate):row.review_date,state=b.action==='withdraw'?'withdrawn':'private',at=now(),next=row.version+1;
  const [result]=await db.batch([
   db.prepare("UPDATE sandy_library_documents SET roles_json=?,review_date=?,state=?,version=version+1,updated_utc=?,updated_by=? WHERE id=? AND version=? AND state='private'").bind(JSON.stringify(roles),reviewDate,state,at,actor.id,doc,row.version),
   revision(db,{kind:'library',resourceId:doc,resourceVersion:next,action:'library_'+b.action,actor,at,changes:{reason,fromVersion:row.version,toVersion:next},snapshot:{title:row.title,scope:row.scope,roles,reviewDate,state,contentVersion:row.content_version},guarded:true}),
   audit(db,actor,'library_'+b.action,'library',doc,at,true,{fromVersion:row.version,toVersion:next})
  ]);
  if(!result.meta.changes)fail(409,'Document changed. Reload before saving.','conflict');
  return json({ok:true,version:next});
 }
 if(action==='replace'&&req.method==='POST'){
  const flags=await writeAllowed(env,db,actor,row.scope);
  if(row.state!=='private')fail(409,'Withdrawn documents cannot be replaced.','library_locked');
  const b=await payload(req,1450000);strict(b,['version','mediaType','content','source','consent']);
  if(version(b.version)!==row.version)fail(409,'Document changed. Reload before saving.','conflict');
  const c=file(b),k=await keys(env),at=now(),next=row.version+1,v=row.content_version+1;
  // D1 executes this batch atomically. Every version, part and history insert
  // depends on the previous statement changing exactly one row.
  const parts=await encryptedParts(db,k.aes,doc,v,c,actor,at);
  const [result]=await db.batch([
   db.prepare("UPDATE sandy_library_documents SET content_version=?,version=version+1,updated_utc=?,updated_by=? WHERE id=? AND version=? AND state='private'"+(flags?' AND '+participationGuard:'')).bind(v,at,actor.id,doc,row.version,...(flags?participationArgs(actor,flags):[])),
   ...parts.statements,
   revision(db,{kind:'library',resourceId:doc,resourceVersion:next,action:'library_replaced',actor,at,changes:{fromVersion:row.version,toVersion:next},snapshot:{title:row.title,scope:row.scope,contentVersion:v,digest:parts.hash,source:c.source},guarded:true}),
   audit(db,actor,'library_replaced','library',doc,at,true,{fromVersion:row.version,toVersion:next})
  ]);
  if(!result.meta.changes)fail(409,'Document changed. Reload before saving.','conflict');
  return json({ok:true,version:next,contentVersion:v});
 }
 fail(405,'Choose a supported private library action.','method_not_allowed');
}
