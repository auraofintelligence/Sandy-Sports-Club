// Wishes sent to the committee by signed-in members or officers (the asset wish list). Committee accounts review them.
import {fail,json,now,id,dbFor,payload,field,requireRole,audit,STAFF} from './shared.mjs';
const DDL=[`CREATE TABLE IF NOT EXISTS club_requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL DEFAULT 'wish' CHECK(kind IN ('wish')),title TEXT NOT NULL,category TEXT NOT NULL DEFAULT '',priority TEXT NOT NULL DEFAULT '',purpose TEXT NOT NULL DEFAULT '',next_step TEXT NOT NULL DEFAULT '',from_account TEXT NOT NULL REFERENCES club_accounts(id),status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','planned','declined','done')),committee_note TEXT NOT NULL DEFAULT '',reviewed_by TEXT,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`,
 'CREATE INDEX IF NOT EXISTS club_requests_status ON club_requests(status,created_utc)'];
const ready=new WeakSet();
async function ensure(env,db){if(ready.has(env))return;for(const s of DDL)await db.prepare(s).run();ready.add(env)}
const CATEGORIES=['Sport','Facility','Screen','Media','Events','People'],PRIORITIES=['Research','First programme','Site decision','Quote first'];
const STATUSES=['new','reviewing','planned','declined','done'];
const shape=r=>({id:r.id,title:r.title,category:r.category,priority:r.priority,purpose:r.purpose,nextStep:r.next_step,status:r.status,note:r.committee_note,createdAt:r.created_utc,updatedAt:r.updated_utc,
 ...(r.username!==undefined?{from:{username:r.username,name:r.preferred_name||r.full_name||r.display_name||r.username,role:r.role,email:r.email||''}}:{})});
export async function requestsEndpoint(req,env,path,identity){
 const db=dbFor(env);await ensure(env,db);
 if(path==='/api/committee/requests'){
  requireRole(identity,STAFF);
  if(req.method==='GET'){
   const status=new URL(req.url).searchParams.get('status')||'';
   if(status&&status!=='open'&&!STATUSES.includes(status))fail(400,'Choose a status.','invalid_filter');
   const where=status==='open'?"WHERE r.status IN ('new','reviewing','planned')":status?'WHERE r.status=?':'';
   const {results=[]}=await db.prepare(`SELECT r.*,a.username,a.role,a.display_name,p.full_name,p.preferred_name,p.email FROM club_requests r JOIN club_accounts a ON a.id=r.from_account LEFT JOIN club_people p ON p.account_id=a.id ${where} ORDER BY r.status='new' DESC,r.created_utc DESC LIMIT 300`).bind(...(status&&status!=='open'?[status]:[])).all();
   const counts=await db.prepare("SELECT SUM(status='new') AS new,SUM(status IN ('new','reviewing','planned')) AS open FROM club_requests").first();
   return json({requests:results.map(shape),counts:{new:Number(counts?.new||0),open:Number(counts?.open||0)}});
  }
  if(req.method!=='POST')fail(405,'Use the review form.','method_not_allowed');
  const b=await payload(req,3000),reqId=field(b.id,40),status=field(b.status,20),at=now();
  if(!STATUSES.includes(status))fail(400,'Choose a status.','invalid_status');
  const r=await db.prepare('UPDATE club_requests SET status=?,committee_note=?,reviewed_by=?,updated_utc=? WHERE id=?').bind(status,field(b.note,1000),identity.id,at,reqId).run();
  if(!r.meta.changes)fail(404,'That request is not available.','not_found');
  await audit(db,identity,'request_'+status,'request',reqId,at).run();
  return json({ok:true});
 }
 if(path==='/api/requests'){
  requireRole(identity,['member',...STAFF]);
  if(req.method==='GET'){
   const {results=[]}=await db.prepare('SELECT * FROM club_requests WHERE from_account=? ORDER BY created_utc DESC LIMIT 50').bind(identity.id).all();
   return json({requests:results.map(shape)});
  }
  if(req.method!=='POST')fail(405,'Use the wish form.','method_not_allowed');
  const b=await payload(req,4000),title=field(b.title,100),purpose=field(b.purpose,800),category=field(b.category,20),priority=field(b.priority,30);
  if(title.length<3||purpose.length<3)fail(400,'Give your wish a name and say what it is for.','invalid_request');
  if(!CATEGORIES.includes(category)||!PRIORITIES.includes(priority))fail(400,'Choose a category and priority.','invalid_request');
  const open=await db.prepare("SELECT COUNT(*) AS n FROM club_requests WHERE from_account=? AND status IN ('new','reviewing')").bind(identity.id).first();
  if(Number(open?.n||0)>=20)fail(429,'You have 20 wishes waiting for review. Please wait for the committee to catch up.','too_many_requests');
  const reqId=id(),at=now();
  await db.prepare("INSERT INTO club_requests(id,kind,title,category,priority,purpose,next_step,from_account,status,created_utc,updated_utc) VALUES(?,'wish',?,?,?,?,?,?,'new',?,?)").bind(reqId,title,category,priority,purpose,field(b.nextStep,500),identity.id,at,at).run();
  await audit(db,identity,'wish_sent','request',reqId,at).run();
  return json({ok:true,id:reqId},201);
 }
 fail(404,'That service does not exist.','not_found');
}
