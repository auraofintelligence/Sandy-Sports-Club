// Film Club, a club within the club: joining by lane, members' own kit, the shared kit shelf
// and simple borrow requests between members. Nothing here exposes where kit is kept.
import {fail,json,now,id,dbFor,payload,field} from './shared.mjs';
import {requireMember} from './profiles.mjs';
import {ensureNotify,enqueue} from './notify.mjs';
export const LANES={watch:'Watch: film nights and the movie vote',make:'Make: shoot, edit and tell stories',crew:'Sport crew: highlights and live streams of club games',learn:'Learn: workshops and editing basics'};
export const KINDS={phone:'Phone or phone rig',camera:'Camera',mic:'Microphone or recorder',light:'Light',tripod:'Tripod',gimbal:'Gimbal or stabiliser',drone:'Drone',edit:'Laptop or editing computer',storage:'Drive or memory cards',screen:'Screen or projector',sound:'Speaker or PA',other:'Other'};
export const SHARE={private:'Just mine (only I see it)',club:'Lend to Film Club members',with_me:'Only when I come along'};
const STATES=['asked','yes','no','returned','withdrawn'];
const DDL=[
 `CREATE TABLE IF NOT EXISTS club_film_kit(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES club_accounts(id),name TEXT NOT NULL,kind TEXT NOT NULL,share TEXT NOT NULL DEFAULT 'private' CHECK(share IN ('private','club','with_me')),care TEXT NOT NULL DEFAULT '',created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL,removed_utc TEXT)`,
 `CREATE TABLE IF NOT EXISTS club_film_kit_requests(id TEXT PRIMARY KEY,kit_id TEXT NOT NULL,owner_id TEXT NOT NULL,requester_id TEXT NOT NULL,from_date TEXT NOT NULL,to_date TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',state TEXT NOT NULL DEFAULT 'asked' CHECK(state IN ('asked','yes','no','returned','withdrawn')),created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`,
 'CREATE INDEX IF NOT EXISTS club_film_kit_owner ON club_film_kit(account_id)'];
const ready=new WeakSet();
async function ensureFilm(env,db){
 if(ready.has(env))return;
 for(const s of DDL)await db.prepare(s).run();
 const cols=new Set(((await db.prepare('PRAGMA table_info(club_member_profiles)').all()).results||[]).map(c=>c.name));
 if(!cols.has('film_lanes_json'))await db.prepare("ALTER TABLE club_member_profiles ADD COLUMN film_lanes_json TEXT NOT NULL DEFAULT '[]'").run();
 await ensureNotify(env,db);ready.add(env);
}
const parse=s=>{try{return JSON.parse(s||'[]')}catch{return []}};
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'';
const first=r=>(r.preferred_name||r.full_name||'A member').split(' ')[0];
const kit=r=>({id:r.id,name:r.name,kind:r.kind,share:r.share,care:r.care,updatedAt:r.updated_utc});
const request=r=>({id:r.id,kitId:r.kit_id,kitName:r.kit_name,from:r.from_date,to:r.to_date,note:r.note,state:r.state,who:first(r),updatedAt:r.updated_utc});

export async function filmEndpoint(req,env,identity){
 const db=dbFor(env);await requireMember(env,db,identity);await ensureFilm(env,db);
 const me=identity.id,at=now();
 const mine=async()=>db.prepare('SELECT film_member,film_lanes_json FROM club_member_profiles WHERE account_id=?').bind(me).first();
 if(req.method==='POST'){
  const b=await payload(req,4000),action=field(b.action,20);
  if(action==='join'){
   const lanes=Array.isArray(b.lanes)?[...new Set(b.lanes.filter(l=>l in LANES))]:[];
   if(!lanes.length)fail(400,'Pick at least one way to take part.','lanes_required');
   await db.prepare("INSERT INTO club_member_profiles(account_id,film_member,film_lanes_json,updated_utc) VALUES(?,1,?,?) ON CONFLICT(account_id) DO UPDATE SET film_member=1,film_lanes_json=excluded.film_lanes_json,version=version+1,updated_utc=excluded.updated_utc").bind(me,JSON.stringify(lanes),at).run();
  }else if(action==='leave'){
   await db.prepare("UPDATE club_member_profiles SET film_member=0,version=version+1,updated_utc=? WHERE account_id=?").bind(at,me).run();
   await db.prepare("UPDATE club_film_kit SET share='private',updated_utc=? WHERE account_id=? AND share<>'private' AND removed_utc IS NULL").bind(at,me).run();
  }else if(action==='kit-save'){
   const name=field(b.name,80).trim(),kind=field(b.kind,20),share=field(b.share,10),care=field(b.care,300).trim();
   if(!name)fail(400,'Give the item a name, like "Rode mic" or "iPhone 13 and clip lens".','name_required');
   if(!(kind in KINDS)||!(share in SHARE))fail(400,'Choose what it is and who can use it.','invalid_kit');
   const film=(await mine())?.film_member;
   if(share!=='private'&&!film)fail(409,'Join the Film Club before you lend kit.','film_member_required');
   if(b.id){
    const r=await db.prepare('UPDATE club_film_kit SET name=?,kind=?,share=?,care=?,updated_utc=? WHERE id=? AND account_id=? AND removed_utc IS NULL').bind(name,kind,share,care,at,field(b.id,40),me).run();
    if(!r.meta.changes)fail(404,'That item is not on your list.','not_found');
   }else{
    const n=await db.prepare('SELECT COUNT(*) AS n FROM club_film_kit WHERE account_id=? AND removed_utc IS NULL').bind(me).first();
    if(Number(n?.n||0)>=40)fail(409,'That is a lot of kit. Remove something before adding more.','kit_limit');
    await db.prepare('INSERT INTO club_film_kit(id,account_id,name,kind,share,care,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?)').bind(id(),me,name,kind,share,care,at,at).run();
   }
  }else if(action==='kit-remove'){
   const kitId=field(b.id,40);
   const r=await db.prepare('UPDATE club_film_kit SET removed_utc=?,updated_utc=? WHERE id=? AND account_id=? AND removed_utc IS NULL').bind(at,at,kitId,me).run();
   if(!r.meta.changes)fail(404,'That item is not on your list.','not_found');
   await db.prepare("UPDATE club_film_kit_requests SET state='withdrawn',updated_utc=? WHERE kit_id=? AND state IN ('asked','yes')").bind(at,kitId).run();
  }else if(action==='ask'){
   if(!(await mine())?.film_member)fail(409,'Join the Film Club to borrow kit.','film_member_required');
   const item=await db.prepare("SELECT * FROM club_film_kit WHERE id=? AND removed_utc IS NULL AND share IN ('club','with_me')").bind(field(b.kitId,40)).first();
   if(!item||item.account_id===me)fail(404,'That kit is not on the shelf.','not_found');
   const from=day(b.from),to=day(b.to)||from;
   if(!from||to<from)fail(400,'Choose the day you need it, and when you will give it back.','invalid_dates');
   const open=await db.prepare("SELECT 1 FROM club_film_kit_requests WHERE kit_id=? AND requester_id=? AND state='asked'").bind(item.id,me).first();
   if(open)fail(409,'You have already asked for this. Wait for an answer.','already_asked');
   const rid=id();
   await db.prepare('INSERT INTO club_film_kit_requests(id,kit_id,owner_id,requester_id,from_date,to_date,note,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?)').bind(rid,item.id,item.account_id,me,from,to,field(b.note,300).trim(),at,at).run();
   await enqueue(db,{announcementId:rid,title:'Film Club: someone would like to borrow your '+item.name,only:[item.account_id]});
  }else if(['yes','no','returned','withdraw'].includes(action)){
   const r=await db.prepare('SELECT q.*,k.name AS kit_name FROM club_film_kit_requests q JOIN club_film_kit k ON k.id=q.kit_id WHERE q.id=?').bind(field(b.id,40)).first();
   if(!r)fail(404,'That request is not available.','not_found');
   const owner=r.owner_id===me,asker=r.requester_id===me;
   const ok=(action==='withdraw'&&asker&&['asked','yes'].includes(r.state))||(owner&&((['yes','no'].includes(action)&&r.state==='asked')||(action==='returned'&&r.state==='yes')));
   if(!ok)fail(409,'That request has moved on. Refresh to see where it is.','request_state');
   const state=action==='withdraw'?'withdrawn':action;
   await db.prepare('UPDATE club_film_kit_requests SET state=?,updated_utc=? WHERE id=?').bind(state,at,r.id).run();
   if(state==='yes'||state==='no')await enqueue(db,{announcementId:r.id,title:'Film Club: '+(state==='yes'?'yes, you can borrow the ':'sorry, not this time for the ')+r.kit_name,only:[r.requester_id]});
  }else fail(400,'Unknown Film Club action.','invalid_action');
 }else if(req.method!=='GET')fail(405,'Use the Film Club page.','method_not_allowed');

 const p=await mine(),film=!!p?.film_member;
 const myKit=((await db.prepare('SELECT * FROM club_film_kit WHERE account_id=? AND removed_utc IS NULL ORDER BY created_utc').bind(me).all()).results||[]).map(kit);
 const shelf=film?((await db.prepare(`SELECT k.*,p.preferred_name,p.full_name,(SELECT state FROM club_film_kit_requests q WHERE q.kit_id=k.id AND q.requester_id=? ORDER BY q.created_utc DESC LIMIT 1) AS my_state
  FROM club_film_kit k JOIN club_people p ON p.account_id=k.account_id JOIN club_accounts a ON a.id=k.account_id AND a.state='active' JOIN club_member_profiles m ON m.account_id=k.account_id AND m.film_member=1
  WHERE k.removed_utc IS NULL AND k.share IN ('club','with_me') AND k.account_id<>? ORDER BY k.kind,k.name LIMIT 200`).bind(me,me).all()).results||[]).map(r=>({...kit(r),owner:first(r),myRequest:r.my_state||null})):[];
 const reqs=async(col,who)=>((await db.prepare(`SELECT q.*,k.name AS kit_name,p.preferred_name,p.full_name FROM club_film_kit_requests q JOIN club_film_kit k ON k.id=q.kit_id JOIN club_people p ON p.account_id=q.${who}
  WHERE q.${col}=? AND (q.state IN ('asked','yes') OR q.updated_utc>=?) ORDER BY q.created_utc DESC LIMIT 50`).bind(me,new Date(Date.now()-21*864e5).toISOString()).all()).results||[]).map(request);
 const crew=((await db.prepare("SELECT COUNT(*) AS n FROM club_member_profiles m JOIN club_accounts a ON a.id=m.account_id AND a.state='active' WHERE m.film_member=1").first())?.n)||0;
 return json({film,lanes:parse(p?.film_lanes_json),options:{lanes:LANES,kinds:KINDS,share:SHARE},members:Number(crew),myKit,shelf,incoming:await reqs('owner_id','requester_id'),outgoing:await reqs('requester_id','owner_id')});
}
