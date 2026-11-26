import {fail,json,now,id,dbFor,payload,field,dateField,version,requireRole,STAFF,ensureApprover,revision,audit,https} from './shared.mjs';
import {recordAuditAllowed} from './record-policy.mjs';
import {libraryAuditAllowed} from './library.mjs';
const states=['draft','proposed','prepared','revision','evidence','closed','assigned','delivered','approved','rejected','published'];
const mutable=['draft','proposed','prepared','revision','evidence','closed'];
const writers=['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'];
const publicFields=['title','date','sourcePostId','sourceUrl','brief','producer','reviewer','status','due','author','decisionBy','evidence','publishedUrl','notes'];
const toView=row=>({
 id:row.id,version:row.version,title:row.title,date:row.date,sourcePostId:row.source_post_id,sourceUrl:row.source_url,
 brief:row.brief,producer:row.producer,reviewer:row.reviewer,status:row.status,due:row.due,
 author:row.author_note,decisionBy:row.decision_by_note,evidence:row.evidence,publishedUrl:row.published_url,
 notes:row.notes,createdBy:row.created_by,updatedBy:row.updated_by,createdAt:row.created_utc,updatedAt:row.updated_utc
});
function clean(b){
 const state=field(b.status,30)||'draft',title=field(b.title,180);
 if(!title||!mutable.includes(state))fail(400,'Enter a title and a valid draft, review or withdrawn state. Formal approvals require a separate decision.','invalid_brief');
 return {title,date:dateField(b.date),sourcePostId:field(b.sourcePostId||b.reference,180),sourceUrl:https(b.sourceUrl),
  brief:field(b.brief,6000),producer:field(b.producer,100)||'in-house',reviewer:field(b.reviewer,100)||'founding',
  status:state,due:dateField(b.due),author:field(b.author,100),decisionBy:field(b.decisionBy,100),
  evidence:https(b.evidence),publishedUrl:https(b.publishedUrl),notes:field(b.notes,6000)};
}
const saveFields='title,date,source_post_id,source_url,brief,producer,reviewer,status,due,author_note,decision_by_note,evidence,published_url,notes';
const values=b=>[b.title,b.date,b.sourcePostId,b.sourceUrl,b.brief,b.producer,b.reviewer,b.status,b.due,b.author,b.decisionBy,b.evidence,b.publishedUrl,b.notes];
async function briefs(db){
 const r=await db.prepare('SELECT * FROM studio_briefs ORDER BY updated_utc DESC LIMIT 300').all();
 return (r.results||[]).map(toView);
}
export async function briefsEndpoint(req,env,path,identity){
 requireRole(identity,STAFF);const db=dbFor(env),at=now();
 if(path==='/api/studio/briefs'&&req.method==='GET')return json({briefs:await briefs(db)});
 if(path==='/api/studio/briefs'&&req.method==='POST'){
  const b=clean(await payload(req,20000)),briefId=id();
  await db.batch([
   db.prepare('INSERT INTO studio_briefs(id,'+saveFields+',version,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)')
    .bind(briefId,...values(b),identity.id,identity.id,at,at),
   revision(db,{kind:'studio-brief',resourceId:briefId,resourceVersion:1,action:'created',actor:identity,at,snapshot:b}),
   audit(db,identity,'production_brief_created','studio-brief',briefId,at,false,{fromVersion:0,toVersion:1})
  ]);
  return json({ok:true,id:briefId,version:1},201);
 }
 const match=path.match(/^\/api\/studio\/briefs\/([a-f0-9-]{36})(?:\/(revisions|decision|handoff|publish-link))?$/);
 if(!match)fail(404,'Unknown production brief operation.','not_found');
 const briefId=match[1],row=await db.prepare('SELECT * FROM studio_briefs WHERE id=?').bind(briefId).first();
 if(!row)fail(404,'The production brief does not exist.','brief_not_found');
 if(req.method==='GET'){
  if(match[2]==='revisions'){
   const q=await db.prepare("SELECT resource_version AS version,at_utc AS at,actor_role AS role,actor_office AS office,changes_json AS changes FROM club_revisions WHERE resource_kind='studio-brief' AND resource_id=? ORDER BY resource_version DESC LIMIT 80").bind(briefId).all();
   return json({revisions:(q.results||[]).map(r=>({...r,changes:JSON.parse(r.changes)}))});
  }
  if(!match[2])return json({brief:toView(row)});
 }
 if(!match[2]&&req.method==='PATCH'){
  const b=await payload(req,20000),expected=version(b.version);
  if(row.version!==expected)fail(409,'Another officer updated this production brief. Reload it.','conflict');
  if(!mutable.includes(row.status))fail(409,'Authorised production records cannot be silently edited. Open a new revision for review.','approved_locked');
  const data=clean({...toView(row),...b});
  const [result]=await db.batch([
   db.prepare('UPDATE studio_briefs SET '+saveFields.split(',').map(f=>f+'=?').join(',')+',version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=?')
    .bind(...values(data),identity.id,at,briefId,expected),
   revision(db,{kind:'studio-brief',resourceId:briefId,resourceVersion:expected+1,action:'updated',actor:identity,at,
    snapshot:data,changes:{changed:publicFields.filter(k=>JSON.stringify(toView(row)[k]??null)!==JSON.stringify(data[k]??null)),fromVersion:expected,toVersion:expected+1,reason:field(b.reason,500)||'Brief edit'},guarded:true}),
   audit(db,identity,'production_brief_updated','studio-brief',briefId,at,true,{fromVersion:expected,toVersion:expected+1})
  ]);
  if(!result.meta.changes)fail(409,'This brief changed before the update completed.','conflict');
  return json({ok:true,id:briefId,version:expected+1});
 }
 if(match[2]==='decision'&&req.method==='POST'){
  ensureApprover(identity,env);
  const b=await payload(req,8192),expected=version(b.version),decision=field(b.decision,32),evidence=https(b.evidence);
  if(row.version!==expected)fail(409,'Review the latest brief revision first.','conflict');
  if(!evidence||!['approved','rejected','returned','publish_authorised'].includes(decision))
   fail(400,'Select a valid decision and add a supporting HTTPS reference.','invalid_decision');
  if(decision==='publish_authorised'&&row.status!=='approved')fail(409,'The brief must be approved before publication may be authorised.','not_approved');
  const newStatus=decision==='returned'?'revision':decision==='publish_authorised'?'approved':decision,newVersion=row.version+1;
  const decisionId=id();
  const [result]=await db.batch([
   db.prepare('UPDATE studio_briefs SET status=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=?')
    .bind(newStatus,identity.id,at,briefId,expected),
   db.prepare("INSERT INTO studio_decisions(id,entity_type,entity_id,entity_version,decision,scope_json,evidence_url,authorised_actor,authorised_office,decided_utc) SELECT ?,'studio_brief',?,?,?,?,?,?,?,? WHERE changes()=1")
    .bind(decisionId,briefId,newVersion,decision,JSON.stringify({title:row.title,producer:row.producer}),evidence,identity.id,identity.office_label,at),
   revision(db,{kind:'studio-brief',resourceId:briefId,resourceVersion:newVersion,action:'decision_'+decision,actor:identity,at,
    snapshot:{...toView(row),status:newStatus,version:newVersion},changes:{decision,evidence,fromVersion:expected,toVersion:newVersion,reason:field(b.reason,500)||'Formal decision'},guarded:true}),
   audit(db,identity,'studio_decision_'+decision,'studio-brief',briefId,at,true,{fromVersion:expected,toVersion:newVersion})
  ]);
  if(!result.meta.changes)fail(409,'This brief changed while recording the decision.','conflict');
  return json({ok:true,decisionId,version:newVersion});
 }
 if(match[2]==='handoff'&&req.method==='POST'){
  const b=await payload(req,8192),producer=field(b.producer,100),due=dateField(b.due);
  if(!producer)fail(400,'Choose a prospective production provider.','invalid_producer');
  const authorised=b.authorised===true;
  if(authorised)ensureApprover(identity,env);
  if(authorised&&row.status!=='approved')fail(409,'The current brief must be approved before commissioning.','approval_required');
  const decision=authorised?await db.prepare("SELECT id FROM studio_decisions WHERE entity_type='studio_brief' AND entity_id=? AND entity_version=? AND decision='approved' LIMIT 1").bind(briefId,row.version).first():null;
  if(authorised&&!decision)fail(409,'An approval for this exact brief revision must exist before commissioning.','approval_required');
  const state=authorised?'authorised':'proposed',handoffId=id();
  const key=[briefId,producer,state,due,decision?.id||null];
  const lookup=()=>db.prepare("SELECT id FROM studio_handoffs WHERE brief_id=? AND producer=? AND status=? AND requested_delivery_on IS ? AND decision_id IS ? LIMIT 1").bind(...key).first();
  const old=await lookup();if(old)return json({ok:true,handoffId:old.id,state,sent:false,replayed:true});
  const [result]=await db.batch([
   db.prepare(`INSERT INTO studio_handoffs(id,brief_id,decision_id,producer,status,requested_delivery_on,updated_utc,issued_by,issued_utc)
    SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_briefs WHERE id=? AND version=?)
    AND NOT EXISTS(SELECT 1 FROM studio_handoffs WHERE brief_id=? AND producer=? AND status=? AND requested_delivery_on IS ? AND decision_id IS ?)`)
    .bind(handoffId,briefId,decision?.id||null,producer,state,due,at,authorised?identity.id:null,authorised?at:null,briefId,row.version,...key),
   audit(db,identity,authorised?'handoff_authorised':'handoff_proposed','studio-brief',briefId,at,true)
  ]);
  if(!result.meta.changes){const old=await lookup();if(old)return json({ok:true,handoffId:old.id,state,sent:false,replayed:true});fail(409,'The brief changed. Reload before recording a handoff.','conflict')}
  return json({ok:true,handoffId,state,sent:false},201);
 }
 if(match[2]==='publish-link'&&req.method==='POST'){
  ensureApprover(identity,env);
  const b=await payload(req,8192),url=https(b.url),platform=field(b.platform,30);
  if(!url||!['youtube','facebook','instagram','tiktok','noticeboard'].includes(platform))fail(400,'Provide a verified platform and HTTPS post link.','invalid_publication_link');
  if(row.status!=='approved')fail(409,'The current brief is not approved.','publication_not_authorised');
  const decision=await db.prepare("SELECT id FROM studio_decisions WHERE entity_type='studio_brief' AND entity_id=? AND entity_version=? AND decision='publish_authorised' LIMIT 1").bind(briefId,row.version).first();
  if(!decision)fail(409,'Publishing has not been authorised for the current brief revision.','publication_not_authorised');
  const linkId=id(),key=[briefId,decision.id,platform,url];
  const lookup=()=>db.prepare('SELECT id FROM studio_post_links WHERE brief_id=? AND decision_id=? AND platform=? AND published_url=? LIMIT 1').bind(...key).first();
  const old=await lookup();if(old)return json({ok:true,linkId:old.id,replayed:true});
  const [result]=await db.batch([
   db.prepare(`INSERT INTO studio_post_links(id,brief_id,decision_id,platform,published_url,published_utc,recorded_by,recorded_utc)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_briefs WHERE id=? AND version=? AND status='approved')
    AND NOT EXISTS(SELECT 1 FROM studio_post_links WHERE brief_id=? AND decision_id=? AND platform=? AND published_url=?)`)
    .bind(linkId,briefId,decision.id,platform,url,dateField(b.publishedOn)?dateField(b.publishedOn)+'T00:00:00+10:00':null,identity.id,at,briefId,row.version,...key),
   audit(db,identity,'published_link_recorded','studio-brief',briefId,at,true)
  ]);
  if(!result.meta.changes){const old=await lookup();if(old)return json({ok:true,linkId:old.id,replayed:true});fail(409,'The brief changed. Reload before recording publication evidence.','conflict')}
  return json({ok:true,linkId},201);
 }
 fail(404,'Unsupported production brief operation.','not_found');
}
const auditKinds=new Set(['account','record','person','interest','studio-brief','social-settings','social-edits','social-metrics','library']);
const auditCsvFields=['at','brisbaneAt','actorId','actor','role','office','action','kind','resourceId','fromVersion','toVersion','reason'];
const csvCell=value=>{
 let s=String(value??'');if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
};
function auditCursor(value){
 if(!value)return null;
 try{
  const p=JSON.parse(atob(value));
  if(!Array.isArray(p)||p.length!==2||typeof p[0]!=='string'||!Number.isFinite(Date.parse(p[0]))||typeof p[1]!=='string'||!/^[a-f0-9-]{36}$/.test(p[1]))throw Error();
  return p;
 }catch{fail(400,'The audit page reference is invalid. Refresh the audit trail.','invalid_cursor')}
}
export async function auditEndpoint(req,env,identity){
 requireRole(identity,['webmaster','president','secretary']);
 if(req.method!=='GET')fail(405,'Audit history is read-only.','method_not_allowed');
 const url=new URL(req.url),db=dbFor(env),visible=[];
 const kind=url.searchParams.get('kind'),format=url.searchParams.get('format'),limitParam=url.searchParams.get('limit');
 if(kind&&!auditKinds.has(kind))fail(400,'Choose a valid audit resource category.','invalid_audit_kind');
 if(format&&format!=='csv')fail(400,'Choose JSON or CSV audit output.','invalid_format');
 const limit=limitParam===null?300:Number(limitParam);
 if(!Number.isInteger(limit)||limit<1||limit>300)fail(400,'Choose an audit page size between 1 and 300.','invalid_limit');
 let cursor=auditCursor(url.searchParams.get('cursor')),nextCursor=null,done=false;
 while(visible.length<limit+1&&!done){
  const conditions=[],args=[];
  if(cursor){conditions.push('(a.occurred_utc<? OR (a.occurred_utc=? AND a.id<?))');args.push(cursor[0],cursor[0],cursor[1])}
  if(kind){conditions.push('a.resource_kind=?');args.push(kind)}
  const q=await db.prepare("SELECT a.id,a.actor_id AS actorId,b.username AS actor,a.actor_role AS role,a.action,a.resource_kind AS kind,a.resource_id AS resourceId,a.occurred_utc AS at,a.context_json AS context,r.kind AS record_kind,r.body_json,r.created_by FROM club_audit a LEFT JOIN club_accounts b ON b.id=a.actor_id LEFT JOIN club_records r ON a.resource_kind='record' AND r.id=a.resource_id "+(conditions.length?'WHERE '+conditions.join(' AND ')+' ':'')+"ORDER BY a.occurred_utc DESC,a.id DESC LIMIT 100").bind(...args).all();
  const rows=q.results||[];
  for(const {record_kind,body_json,created_by,context,...entry} of rows){
   cursor=[entry.at,entry.id];
   if(!auditKinds.has(entry.kind))continue;
   if(entry.kind==='record'&&!recordAuditAllowed(record_kind?{kind:record_kind,body_json,created_by}:null,identity,entry.action))continue;
   if(entry.kind==='account'&&identity.role!=='webmaster')continue;
   if(entry.kind==='library'&&!await libraryAuditAllowed(db,identity,entry.resourceId))continue;
   // Only explicit safe metadata, never context_json, snapshot_json or private record body.
   let c={};try{c=JSON.parse(context)||{}}catch{}
   visible.push({...entry,office:typeof c.office==='string'?c.office:entry.role,reason:entry.action,
    fromVersion:Number.isSafeInteger(c.fromVersion)?c.fromVersion:null,toVersion:Number.isSafeInteger(c.toVersion)?c.toVersion:null,
    brisbaneAt:new Date(entry.at).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})});
   if(visible.length===limit+1)break;
  }
  if(rows.length<100)done=true;
 }
 const page=visible.slice(0,limit);
 if(visible.length>limit){const last=page[page.length-1];nextCursor=btoa(JSON.stringify([last.at,last.id]))}
 if(format==='csv'){
  const body=[auditCsvFields.map(csvCell).join(','),...page.map(r=>auditCsvFields.map(k=>csvCell(r[k])).join(','))].join('\r\n')+'\r\n';
  return new Response(body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="sandy-scoped-audit.csv"','Cache-Control':'no-store, private'}});
 }
 return json({audit:page,nextCursor});
}
