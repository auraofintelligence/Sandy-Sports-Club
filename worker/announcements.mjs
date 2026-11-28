// Webmaster announcements to members, optionally an event with RSVPs (including how many children are coming).
// Audience "film" reaches Film Club members only; "unverified" reaches members without a blue tick. Works in founding mode without formal committee approvals.
import {fail,json,now,id,dbFor,payload,field,dateField,requireRole,audit,membersOpen,MEMBER_ADMIN} from './shared.mjs';
import {ensureProfileTables} from './profiles.mjs';
import {ensureNotify,cleanTarget,targetLabel,matches,memberFacts,reachPreview,enqueue} from './notify.mjs';
const DDL=[`CREATE TABLE IF NOT EXISTS club_announcements(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',event_date TEXT,event_time TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',rsvp INTEGER NOT NULL DEFAULT 0 CHECK(rsvp IN (0,1)),audience TEXT NOT NULL DEFAULT 'all' CHECK(audience IN ('all','film','unverified')),created_by TEXT NOT NULL REFERENCES club_accounts(id),created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL,archived_utc TEXT)`,
 `CREATE TABLE IF NOT EXISTS club_announcement_rsvps(announcement_id TEXT NOT NULL REFERENCES club_announcements(id),account_id TEXT NOT NULL REFERENCES club_accounts(id),response TEXT NOT NULL CHECK(response IN ('going','maybe','not_going')),children INTEGER NOT NULL DEFAULT 0 CHECK(children BETWEEN 0 AND 8),updated_utc TEXT NOT NULL,PRIMARY KEY(announcement_id,account_id))`];
const ready=new WeakSet();
export async function ensureAnnouncements(env,db){if(ready.has(env))return;await ensureProfileTables(env,db);for(const sql of DDL)await db.prepare(sql).run();
 // Events the committee chooses to show on the public calendar (no RSVPs or names are public).
 const cols=new Set(((await db.prepare('PRAGMA table_info(club_announcements)').all()).results||[]).map(c=>c.name));
 if(!cols.has('public_calendar'))await db.prepare('ALTER TABLE club_announcements ADD COLUMN public_calendar INTEGER NOT NULL DEFAULT 0').run();
 // Links a calendar listing back to the committee event it was published from.
 if(!cols.has('source_id'))await db.prepare("ALTER TABLE club_announcements ADD COLUMN source_id TEXT NOT NULL DEFAULT ''").run();
 // Targeting by interest, pinning, urgent changes, and how many members a notice reached.
 for(const [c,d] of [['target_json',"TEXT NOT NULL DEFAULT ''"],['pinned','INTEGER NOT NULL DEFAULT 0'],['urgent','INTEGER NOT NULL DEFAULT 0'],['reach','INTEGER NOT NULL DEFAULT 0']])if(!cols.has(c))await db.prepare('ALTER TABLE club_announcements ADD COLUMN '+c+' '+d).run();
 await ensureNotify(env,db);
 ready.add(env)}
const ensure=ensureAnnouncements;
const responses=['going','maybe','not_going'];
const targetOf=r=>{try{return r.target_json?JSON.parse(r.target_json):{}}catch{return {}}};
const shape=r=>({id:r.id,title:r.title,body:r.body,eventDate:r.event_date,eventTime:r.event_time,location:r.location,rsvp:!!r.rsvp,audience:r.audience,publicCalendar:!!r.public_calendar,sourceId:r.source_id||'',createdAt:r.created_utc,
 target:targetOf(r),targetLabel:targetLabel(targetOf(r)),pinned:!!r.pinned,urgent:!!r.urgent,reach:r.reach||0,...(r.reads!==undefined?{reads:r.reads}:{}),...(r.is_read!==undefined?{read:!!r.is_read}:{}),
 ...(r.going!==undefined?{counts:{going:r.going,maybe:r.maybe,notGoing:r.not_going,children:r.kids}}:{}),...(r.my_response!==undefined?{myResponse:r.my_response,myChildren:r.my_children||0}:{})});
const COUNTS=`(SELECT COUNT(*) FROM club_announcement_rsvps x WHERE x.announcement_id=a.id AND x.response='going') AS going,
 (SELECT COUNT(*) FROM club_announcement_rsvps x WHERE x.announcement_id=a.id AND x.response='maybe') AS maybe,
 (SELECT COUNT(*) FROM club_announcement_rsvps x WHERE x.announcement_id=a.id AND x.response='not_going') AS not_going,
 (SELECT COALESCE(SUM(children),0) FROM club_announcement_rsvps x WHERE x.announcement_id=a.id AND x.response='going') AS kids`;
export async function announcementsEndpoint(req,env,path,identity){
 const db=dbFor(env);
 if(path==='/api/committee/announcements'){
  requireRole(identity,MEMBER_ADMIN);await ensure(env,db);
  if(req.method==='GET'){
   const url=new URL(req.url),which=url.searchParams.get('rsvps');
   if(which){
    const {results=[]}=await db.prepare(`SELECT r.response,r.children,r.updated_utc,a.username,p.full_name,p.preferred_name,p.email,p.mobile FROM club_announcement_rsvps r
     JOIN club_accounts a ON a.id=r.account_id LEFT JOIN club_people p ON p.account_id=a.id WHERE r.announcement_id=? ORDER BY r.response,p.full_name`).bind(field(which,40)).all();
    return json({rsvps:results.map(r=>({response:r.response,children:r.children,username:r.username,name:r.preferred_name||r.full_name,fullName:r.full_name,email:r.email,mobile:r.mobile,updatedAt:r.updated_utc}))});
   }
   const {results=[]}=await db.prepare('SELECT a.*,'+COUNTS+',(SELECT COUNT(*) FROM club_announcement_reads x WHERE x.announcement_id=a.id) AS reads FROM club_announcements a WHERE a.archived_utc IS NULL ORDER BY a.pinned DESC,COALESCE(a.event_date,substr(a.created_utc,1,10)) DESC LIMIT 100').all();
   return json({announcements:results.map(shape)});
  }
  if(req.method!=='POST')fail(405,'Use the announcement form.','method_not_allowed');
  const b=await payload(req,8000),at=now();
  if(b.action==='preview')return json(await reachPreview(env,db,['all','film','unverified'].includes(b.audience)?b.audience:'all',cleanTarget(b.target)));
  if(b.action==='pin'||b.action==='unpin'){
   const r=await db.prepare('UPDATE club_announcements SET pinned=?,updated_utc=? WHERE id=? AND archived_utc IS NULL').bind(b.action==='pin'?1:0,at,field(b.id,40)).run();
   if(!r.meta.changes)fail(404,'That announcement is not available.','not_found');
   return json({ok:true});
  }
  if(b.action==='archive'){
   const annId=field(b.id,40),ann=await db.prepare('SELECT * FROM club_announcements WHERE id=? AND archived_utc IS NULL').bind(annId).first();
   if(!ann)fail(404,'That announcement is not available.','not_found');
   await db.prepare('UPDATE club_announcements SET archived_utc=?,updated_utc=? WHERE id=? AND archived_utc IS NULL').bind(at,at,annId).run();
   // Taking down an upcoming event tells the people who said they were coming, straight away.
   let told=0;
   if(ann.rsvp&&ann.event_date&&ann.event_date>=new Date(Date.now()+36e6).toISOString().slice(0,10)){
    const {results=[]}=await db.prepare("SELECT account_id FROM club_announcement_rsvps WHERE announcement_id=? AND response IN ('going','maybe')").bind(annId).all();
    if(results.length)told=await enqueue(db,{announcementId:annId,title:ann.title,kind:'cancelled',only:results.map(r=>r.account_id)});
   }
   return json({ok:true,told});
  }
  if(b.action!=='create')fail(400,'Choose create or archive.','invalid_action');
  const title=field(b.title,140),body=field(b.body,4000),audience=field(b.audience,10)||'all';
  if(title.length<3)fail(400,'Give the announcement a title.','invalid_announcement');
  if(!['all','film','unverified'].includes(audience))fail(400,'Choose who it is for.','invalid_announcement');
  const eventDate=dateField(b.eventDate),rsvp=b.rsvp===true&&!!eventDate?1:0,annId=id();
  const publicCalendar=b.publicCalendar===true&&!!eventDate&&audience==='all'?1:0;
  const sourceId=/^[a-f0-9-]{36}$/.test(b.sourceId||'')?b.sourceId:'';
  const target=cleanTarget(b.target),targetJson=Object.keys(target).length?JSON.stringify(target):'',urgent=b.urgent===true?1:0;
  await db.prepare('INSERT INTO club_announcements(id,title,body,event_date,event_time,location,rsvp,audience,public_calendar,source_id,target_json,urgent,pinned,created_by,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(annId,title,body,eventDate,field(b.eventTime,40),field(b.location,140),rsvp,audience,publicCalendar&&!targetJson?1:0,sourceId,targetJson,urgent,b.pinned===true?1:0,identity.id,at,at).run();
  const reach=await enqueue(db,{announcementId:annId,title,audience,target,kind:urgent?'urgent':'notice'});
  await db.prepare('UPDATE club_announcements SET reach=? WHERE id=?').bind(reach,annId).run();
  await audit(db,identity,'announcement_published','announcement',annId,at).run();
  return json({ok:true,id:annId,reach},201);
 }
 if(path==='/api/member/announcements'){
  requireRole(identity,['member']);
  if(!membersOpen(env))fail(409,'Member self-service is not open yet.','club_not_established');
  const me=await db.prepare("SELECT id FROM club_people WHERE account_id=? AND status='active' LIMIT 1").bind(identity.id).first();
  if(!me)fail(409,'There is no active membership linked to this account.','membership_not_active');
  await ensure(env,db);
  const mine=await db.prepare('SELECT film_member,id_verified_utc FROM club_member_profiles WHERE account_id=?').bind(identity.id).first(),film=!!mine?.film_member,unverified=!mine?.id_verified_utc;
  const facts=await memberFacts(db,identity.id),forMe=r=>!facts||matches(facts,'all',targetOf(r));
  const audienceOk="(a.audience='all' OR (a.audience='film' AND ?=1) OR (a.audience='unverified' AND ?=1))";
  if(req.method==='GET'){
   const {results=[]}=await db.prepare(`SELECT a.*,r.response AS my_response,r.children AS my_children,(SELECT COUNT(*) FROM club_announcement_reads x WHERE x.announcement_id=a.id AND x.account_id=?) AS is_read FROM club_announcements a
    LEFT JOIN club_announcement_rsvps r ON r.announcement_id=a.id AND r.account_id=? WHERE a.archived_utc IS NULL AND `+audienceOk+` AND (a.event_date IS NULL OR a.event_date>=date('now','+10 hours','-1 day'))
    ORDER BY a.pinned DESC,COALESCE(a.event_date,'9999') ASC,a.created_utc DESC LIMIT 80`).bind(identity.id,identity.id,film?1:0,unverified?1:0).all();
   const list=results.filter(forMe);
   if(new URL(req.url).searchParams.get('unread')==='1')return json({unread:list.filter(r=>!r.is_read).length});
   return json({announcements:list.map(r=>{const{target_json,reach,...rest}=r;return {...shape(rest),myResponse:r.my_response||null,myChildren:r.my_children||0}})});
  }
  if(req.method!=='POST')fail(405,'Use the RSVP buttons.','method_not_allowed');
  const b=await payload(req,4000);
  if(b.action==='read'){
   const ids=Array.isArray(b.ids)?b.ids.filter(x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x)).slice(0,80):[],at=now();
   if(ids.length)await db.batch(ids.map(x=>db.prepare('INSERT OR IGNORE INTO club_announcement_reads(announcement_id,account_id,read_utc) VALUES(?,?,?)').bind(x,identity.id,at)));
   return json({ok:true,read:ids.length});
  }
  const annId=field(b.id,40),response=field(b.response,20),children=Number(b.children||0);
  if(!responses.includes(response)||!Number.isInteger(children)||children<0||children>8)fail(400,'Choose going, maybe or not going.','invalid_rsvp');
  const ann=await db.prepare('SELECT a.id FROM club_announcements a WHERE a.id=? AND a.rsvp=1 AND a.archived_utc IS NULL AND '+audienceOk).bind(annId,film?1:0,unverified?1:0).first();
  if(!ann)fail(404,'That event is not open for RSVPs.','not_found');
  await db.prepare('INSERT INTO club_announcement_rsvps(announcement_id,account_id,response,children,updated_utc) VALUES(?,?,?,?,?) ON CONFLICT(announcement_id,account_id) DO UPDATE SET response=excluded.response,children=excluded.children,updated_utc=excluded.updated_utc')
   .bind(annId,identity.id,response,response==='going'?children:0,now()).run();
  return json({ok:true,response});
 }
 fail(404,'That service does not exist.','not_found');
}
