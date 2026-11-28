// Member notices: who a notice reaches, what each member has read, how often they want an
// email about new things, and the batching that turns many notices into one email.
// The site only emails a member when a mail provider is configured; until then everything
// is in-app (badges on My Clubhouse). Emails list titles and a link, never private details.
import {fail,json,now,id,dbFor,payload,field,requireRole,membersOpen} from './shared.mjs';
import {SPORTS,HELPING} from './profiles.mjs';
export const FREQUENCIES=['instant','daily','weekly','monthly','never'];
export const CONNECTIONS={local:'Locals',regional:'Regular visitors',tourist:'Holiday visitors',other:'Other'};
export const TOWNS=['Dunwich','Amity Point','Point Lookout'];
export const WEEKLY_GUIDE=2;// member-wide notices per week before the desk warns
const DDL=[
 `CREATE TABLE IF NOT EXISTS club_notify_prefs(account_id TEXT PRIMARY KEY REFERENCES club_accounts(id),frequency TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('instant','daily','weekly','monthly','never')),urgent INTEGER NOT NULL DEFAULT 1 CHECK(urgent IN (0,1)),last_emailed_utc TEXT,updated_utc TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS club_notify_queue(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES club_accounts(id),announcement_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('notice','urgent','cancelled')),title TEXT NOT NULL,created_utc TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'waiting' CHECK(state IN ('waiting','emailed','read','skipped','expired')),done_utc TEXT)`,
 'CREATE INDEX IF NOT EXISTS club_notify_queue_waiting ON club_notify_queue(state,account_id)',
 `CREATE TABLE IF NOT EXISTS club_announcement_reads(announcement_id TEXT NOT NULL,account_id TEXT NOT NULL,read_utc TEXT NOT NULL,PRIMARY KEY(announcement_id,account_id))`];
const ready=new WeakSet();
export async function ensureNotify(env,db){if(ready.has(env))return;for(const s of DDL)await db.prepare(s).run();ready.add(env)}
const parse=s=>{try{return JSON.parse(s||'[]')}catch{return []}};

// ---------- Targeting ----------
export function cleanTarget(t){
 if(!t||typeof t!=='object')return {};
 const pickList=(v,allowed)=>Array.isArray(v)?[...new Set(v.filter(x=>allowed.includes(x)))]:[];
 const out={sports:pickList(t.sports,SPORTS),helping:pickList(t.helping,HELPING),towns:pickList(t.towns,TOWNS),connection:pickList(t.connection,Object.keys(CONNECTIONS))};
 return Object.fromEntries(Object.entries(out).filter(([,v])=>v.length));
}
export function targetLabel(t){
 const parts=[t.sports?.length&&t.sports.join(' or '),t.helping?.length&&'Helping: '+t.helping.join(' or '),t.towns?.length&&t.towns.join(' or '),t.connection?.length&&t.connection.map(c=>CONNECTIONS[c]).join(' or ')].filter(Boolean);
 return parts.join(' · ');
}
// A member matches when they fit the audience and every chosen filter (any value within a filter).
export function matches(m,audience,target){
 if(audience==='film'&&!m.film)return false;
 if(audience==='unverified'&&m.verified)return false;
 if(target.sports?.length&&!target.sports.some(s=>m.sports.includes(s)))return false;
 if(target.helping?.length&&!target.helping.some(s=>m.helping.includes(s)))return false;
 if(target.towns?.length&&!target.towns.some(t=>(m.town||'').toLowerCase().includes(t.toLowerCase())))return false;
 if(target.connection?.length&&!target.connection.includes(m.region))return false;
 return true;
}
export async function activeMembers(db){
 const {results=[]}=await db.prepare(`SELECT a.id,p.town,p.audience_region,p.email,m.sports_json,m.helping_json,m.film_member,m.id_verified_utc,n.frequency,n.urgent
  FROM club_accounts a JOIN club_people p ON p.account_id=a.id LEFT JOIN club_member_profiles m ON m.account_id=a.id LEFT JOIN club_notify_prefs n ON n.account_id=a.id
  WHERE a.role='member' AND a.state='active' AND p.status='active'`).all();
 return results.map(r=>({id:r.id,town:r.town||'',region:r.audience_region||'',email:r.email||'',sports:parse(r.sports_json),helping:parse(r.helping_json),film:!!r.film_member,verified:!!r.id_verified_utc,frequency:r.frequency||'weekly',urgent:r.urgent===null||r.urgent===undefined?true:!!r.urgent}));
}
export async function memberFacts(db,accountId){
 return (await activeMembers(db)).find(m=>m.id===accountId)||null;
}
export async function reachPreview(env,db,audience,target){
 await ensureNotify(env,db);
 const list=(await activeMembers(db)).filter(m=>matches(m,audience,target)),by=Object.fromEntries(FREQUENCIES.map(f=>[f,0]));
 for(const m of list)by[m.frequency]++;
 const week=new Date(Date.now()-7*864e5).toISOString();
 const recent=await db.prepare("SELECT COUNT(*) AS n FROM club_announcements WHERE created_utc>=? AND COALESCE(target_json,'')='' AND audience='all'").bind(week).first().catch(()=>({n:0}));
 return {reach:list.length,byFrequency:by,memberWideThisWeek:Number(recent?.n||0),weeklyGuide:WEEKLY_GUIDE,emailEnabled:emailEnabled(env),options:{sports:SPORTS,helping:HELPING,towns:TOWNS,connection:CONNECTIONS}};
}
export async function enqueue(db,{announcementId,title,audience,target,kind='notice',only=null}){
 const at=now(),list=(await activeMembers(db)).filter(m=>(only?only.includes(m.id):matches(m,audience,target)));
 const rows=list.filter(m=>m.frequency!=='never'||(kind!=='notice'&&m.urgent));
 for(let i=0;i<rows.length;i+=40)await db.batch(rows.slice(i,i+40).map(m=>db.prepare('INSERT INTO club_notify_queue(id,account_id,announcement_id,kind,title,created_utc) VALUES(?,?,?,?,?,?)').bind(id(),m.id,announcementId,kind,title.slice(0,140),at)));
 return list.length;
}

// ---------- Member preferences ----------
export async function notifyPrefsEndpoint(req,env,identity){
 requireRole(identity,['member']);
 if(!membersOpen(env))fail(409,'Member self-service is not open yet.','club_not_established');
 const db=dbFor(env);await ensureNotify(env,db);
 if(req.method==='POST'){
  const b=await payload(req,500),frequency=field(b.frequency,10);
  if(!FREQUENCIES.includes(frequency))fail(400,'Choose how often you would like emails.','invalid_frequency');
  await db.prepare('INSERT INTO club_notify_prefs(account_id,frequency,urgent,updated_utc) VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET frequency=excluded.frequency,urgent=excluded.urgent,updated_utc=excluded.updated_utc')
   .bind(identity.id,frequency,b.urgent===false?0:1,now()).run();
 }else if(req.method!=='GET')fail(405,'Use the notification settings.','method_not_allowed');
 const p=await db.prepare('SELECT frequency,urgent,last_emailed_utc FROM club_notify_prefs WHERE account_id=?').bind(identity.id).first();
 const waiting=await db.prepare("SELECT COUNT(*) AS n FROM club_notify_queue WHERE account_id=? AND state='waiting'").bind(identity.id).first();
 return json({frequency:p?.frequency||'weekly',urgent:p?p.urgent===1:true,lastEmailed:p?.last_emailed_utc||null,waiting:Number(waiting?.n||0),emailEnabled:emailEnabled(env)});
}

// ---------- Batching (scheduled every 15 minutes) ----------
export const emailEnabled=env=>Boolean(env.SANDY_MAIL_FROM&&(typeof env.SANDY_NOTIFY_EMAIL?.send==='function'||(env.SANDY_MAIL_PROVIDER==='resend'&&String(env.SANDY_RESEND_API_KEY||'').length>10)));
const bris=ms=>new Date(ms+36e6);
// When a member's next email is due, given their frequency and when they were last emailed.
export function due(frequency,lastIso,ms,hasUrgent){
 const b=bris(ms),h=b.getUTCHours();
 if(h<7||h>=21)return false;// quiet hours, Brisbane time
 if(hasUrgent)return true;
 const last=lastIso?Date.parse(lastIso):0;
 const at7=y=>Date.UTC(y.getUTCFullYear(),y.getUTCMonth(),y.getUTCDate(),7)-36e6;// 7am Brisbane as UTC ms
 if(frequency==='instant')return ms-last>=60*60e3;
 if(frequency==='daily')return last<at7(b);
 if(frequency==='weekly'){const d=new Date(b);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return last<at7(d)}
 if(frequency==='monthly'){const d=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth(),1));return last<at7(d)}
 return false;
}
async function sendEmail(env,{to,subject,text}){
 const from=env.SANDY_MAIL_FROM;
 try{
  if(typeof env.SANDY_NOTIFY_EMAIL?.send==='function'){await env.SANDY_NOTIFY_EMAIL.send({to,from:{email:from,name:'Sandy Sports'},subject,text});return true}
  const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+env.SANDY_RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:'Sandy Sports <'+from+'>',to:[to],subject,text})});
  return r.ok;
 }catch{return false}
}
export async function processNotifications(env,ms=Date.now(),{limit=80}={}){
 const db=dbFor(env);await ensureNotify(env,db);
 const at=new Date(ms).toISOString(),old=new Date(ms-35*864e5).toISOString();
 // Tidy: anything already read in the app, or older than five weeks, is not emailed.
 await db.batch([
  db.prepare("UPDATE club_notify_queue SET state='read',done_utc=? WHERE state='waiting' AND kind='notice' AND EXISTS(SELECT 1 FROM club_announcement_reads r WHERE r.announcement_id=club_notify_queue.announcement_id AND r.account_id=club_notify_queue.account_id)").bind(at),
  db.prepare("UPDATE club_notify_queue SET state='expired',done_utc=? WHERE state='waiting' AND created_utc<?").bind(at,old)]);
 if(!emailEnabled(env))return {skipped:'email_not_configured'};
 const {results=[]}=await db.prepare(`SELECT q.account_id,GROUP_CONCAT(q.id) AS ids,SUM(q.kind<>'notice') AS urgent_n,COUNT(*) AS n,p.email,COALESCE(n.frequency,'weekly') AS frequency,COALESCE(n.urgent,1) AS urgent_ok,n.last_emailed_utc
  FROM club_notify_queue q JOIN club_people p ON p.account_id=q.account_id LEFT JOIN club_notify_prefs n ON n.account_id=q.account_id
  WHERE q.state='waiting' GROUP BY q.account_id LIMIT ?`).bind(limit).all();
 const origin=env.SANDY_SITE_URL||'https://sandy-sports-club.auraofintelligence.workers.dev';let sent=0;
 for(const r of results){
  const urgent=r.urgent_n>0&&r.urgent_ok===1;
  if(!r.email||!due(r.frequency,r.last_emailed_utc,ms,urgent))continue;
  const ids=String(r.ids).split(','),items=(await db.prepare(`SELECT id,kind,title FROM club_notify_queue WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_utc`).bind(...ids).all()).results||[];
  const send=urgent&&r.frequency==='never'?items.filter(i=>i.kind!=='notice'):items;if(!send.length)continue;
  const lines=send.map(i=>'- '+(i.kind==='cancelled'?'Cancelled: ':i.kind==='urgent'?'Change: ':'')+i.title);
  const subject=send.length===1?'Sandy Sports: '+(send[0].kind==='cancelled'?'Cancelled: ':'')+send[0].title:'Sandy Sports: '+send.length+' new things in My Clubhouse';
  const text=['Hi from Sandy Sports,','',(send.length===1?'There is something new':'There are '+send.length+' new things')+' for you in My Clubhouse:','',...lines,'','Open My Clubhouse: '+origin+'/member-home.html#notices','','Change how often we email you: '+origin+'/member-home.html#profile','Sandy Sports Club (proposed), Minjerribah'].join('\n');
  if(!await sendEmail(env,{to:r.email,subject:subject.slice(0,150),text}))continue;
  await db.batch([db.prepare(`UPDATE club_notify_queue SET state='emailed',done_utc=? WHERE id IN (${send.map(()=>'?').join(',')})`).bind(at,...send.map(i=>i.id)),
   db.prepare('INSERT INTO club_notify_prefs(account_id,frequency,urgent,last_emailed_utc,updated_utc) VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET last_emailed_utc=excluded.last_emailed_utc').bind(r.account_id,r.frequency,r.urgent_ok,at,at)]);
  sent++;
 }
 return {sent};
}
