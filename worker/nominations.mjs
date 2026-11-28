// Public join.html nominations (switched off unless SANDY_NOMINATIONS_ENABLED=enabled).
// Genuine nominations go to the private people register; everything spam protection
// catches is kept apart in a quarantine with its reason, never silently dropped.
// Owner alerts carry no personal contact details: a short summary and an admin link.
// Spam never triggers an instant alert; it appears in the daily 10:00 AM digest.
import {fail,json,now,id,dbFor,field,bool,requireRole,audit,withDeputies} from './shared.mjs';
import {stableId} from './meetings.mjs';
import {verifyTurnstile} from './people.mjs';
import {sendAlert,mailConfigured} from './mailer.mjs';

export const PATHWAYS=['Founding member interest','Committee nomination','Sport working group','Film club / media crew','Partner club conversation','Sponsor or in-kind supporter'];
export const TOWNS=['Dunwich (Goompi)','Amity Point (Pulan)','Point Lookout (Mulumba)','Elsewhere'];
export const REASONS={turnstile_failed:'Failed the Turnstile check',honeypot:'Hidden bot field was filled',rate_limited:'Too many submissions in an hour',malformed:'Malformed or oversized request',cross_origin:'Sent from another website'};
export const LIMITS={perSourcePerHour:5,genuinePerHour:60,quarantinePerHour:200,quarantineDays:90,ipHashDays:30,maxBytes:12000};
const OFFICERS=withDeputies(['webmaster','secretary']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const THANKS="Thanks, we've got it. This is an expression of interest in a proposed club, not membership or an appointment.";
const DEFAULT_ORIGIN='https://sandy-sports-club.auraofintelligence.workers.dev';
export const siteOrigin=env=>(env.SANDY_PUBLIC_ORIGIN||DEFAULT_ORIGIN).replace(/\/$/,'');
export const adminLink=(env,kind,itemId)=>siteOrigin(env)+'/club-admin.html#nominations'+(itemId?'/'+kind+'/'+itemId:'');
export const nominationsOpen=env=>Boolean(env.SANDY_NOMINATIONS_ENABLED==='enabled'&&env.DB?.prepare&&env.SANDY_TURNSTILE_SECRET&&env.SANDY_TURNSTILE_SITE_KEY);
const iso=ms=>new Date(ms).toISOString();
const hourKey=ms=>iso(ms).slice(0,13);

export async function sourceHash(req,env,scope='nominations-v1'){
 const ip=req.headers.get('cf-connecting-ip')||'';
 if(!ip)return '';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode((env.SANDY_AUTH_PEPPER||'')+'/'+scope),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip)));
 return Array.from(sig.slice(0,12),b=>b.toString(16).padStart(2,'0')).join('');
}
export function summary(n){return 'New nomination: '+n.pathway+(n.town?', '+n.town:'')}
function minimal(b){
 // Only the form's own fields, truncated, so an officer can release a false positive.
 if(!b||typeof b!=='object')return {};
 return {name:field(b.name,120),email:field(b.email,254),town:field(b.town,60),pathway:field(b.pathway,60),interests:field(b.interests,600),offer:field(b.offer,1500),consent:bool(b.consent),recordingConsent:bool(b.recordingConsent)};
}
export async function purge(db,ms=Date.now()){
 await db.batch([
  db.prepare('DELETE FROM club_spam_quarantine WHERE expires_utc<?').bind(iso(ms)),
  db.prepare("DELETE FROM club_spam_overflow WHERE hour_utc<?").bind(hourKey(ms-LIMITS.quarantineDays*864e5)),
  db.prepare("UPDATE club_nominations SET ip_hash='' WHERE ip_hash<>'' AND created_utc<?").bind(iso(ms-LIMITS.ipHashDays*864e5))]);
}
export async function quarantine(db,{reason,detail='',ipHash='',userAgent='',data={}},ms=Date.now()){
 const since=hourKey(ms)+':00:00.000Z';
 const count=(await db.prepare('SELECT COUNT(*) AS n FROM club_spam_quarantine WHERE created_utc>=?').bind(since).first())?.n||0;
 if(count>=LIMITS.quarantinePerHour){
  await db.prepare('INSERT INTO club_spam_overflow(hour_utc,dropped) VALUES(?,1) ON CONFLICT(hour_utc) DO UPDATE SET dropped=dropped+1').bind(hourKey(ms)).run();
  return {stored:false};
 }
 const qid=id();
 await db.prepare('INSERT INTO club_spam_quarantine(id,created_utc,reason,detail,ip_hash,user_agent,payload_json,expires_utc) VALUES(?,?,?,?,?,?,?,?)')
  .bind(qid,iso(ms),reason,field(detail,300),ipHash,field(userAgent,200),JSON.stringify(data),iso(ms+LIMITS.quarantineDays*864e5)).run();
 return {stored:true,id:qid};
}
// Standing for office includes agreeing to meeting recording (draft constitution rule 4B); the time is kept.
async function ensureRecordingColumn(db){
 const cols=new Set(((await db.prepare('PRAGMA table_info(club_nominations)').all()).results||[]).map(c=>c.name));
 if(!cols.has('recording_consent_utc'))await db.prepare('ALTER TABLE club_nominations ADD COLUMN recording_consent_utc TEXT').run();
}
async function register(db,env,data,{nominationId,origin,ipHash}){
 const at=now(),email=data.email.toLowerCase();
 const known=await db.prepare('SELECT id FROM club_people WHERE lower(email)=? LIMIT 1').bind(email).first();
 const personId=known?.id||await stableId('nominee/'+nominationId);
 const stmts=[];
 if(!known)stmts.push(db.prepare("INSERT INTO club_people(id,full_name,email,membership_class,status,town,consent_contact,consent_publication,source,notes,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,?,'interested','interested',?,1,0,?,?,1,'public-nomination-form','public-nomination-form',?,?)")
  .bind(personId,data.name,data.email,data.town,'nomination:'+data.pathway,'Nominated via join.html: '+data.pathway,at,at));
 await ensureRecordingColumn(db);
 stmts.push(db.prepare("INSERT INTO club_nominations(id,person_id,created_utc,pathway,town,interests,offer,origin,ip_hash,recording_consent_utc) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
  .bind(nominationId,personId,at,data.pathway,data.town,data.interests,data.offer,origin,ipHash,data.recordingConsent?at:null));
 await db.batch(stmts);
 const n={id:nominationId,pathway:data.pathway,town:data.town};
 const sent=await sendAlert(env,{subject:summary(n),text:[summary(n),'','Open it in the admin area (sign in required):',adminLink(env,'nomination',nominationId),'','Personal details are kept in the admin area only.'].join('\n')});
 await db.prepare('UPDATE club_nominations SET alert_state=?,alert_utc=? WHERE id=?').bind(sent.state,now(),nominationId).run();
 return {id:nominationId,personId,alert:sent.state};
}
function validate(data){
 if(!data.name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))return 'Enter your name and a valid email.';
 if(!PATHWAYS.includes(data.pathway))return 'Choose how you want to contribute.';
 if(data.town&&!TOWNS.includes(data.town))return 'Choose a town from the list.';
 if(!data.consent)return 'Confirm that you understand this is an expression of interest.';
 if(data.pathway==='Committee nomination'&&!data.recordingConsent)return 'Standing for office includes agreeing to every meeting being recorded on video and audio and archived for members (draft constitution rule 4B). Tick that box to continue.';
 return '';
}
async function publicNominate(req,env){
 if(!nominationsOpen(env))fail(503,'Online nominations are not switched on yet. Use the email option instead.','nominations_not_open');
 const db=dbFor(env),ipHash=await sourceHash(req,env),userAgent=req.headers.get('user-agent')||'';
 const catchIt=(reason,detail,data)=>quarantine(db,{reason,detail,ipHash,userAgent,data});
 await purge(db);
 const url=new URL(req.url);
 if(req.headers.get('origin')!==url.origin){await catchIt('cross_origin','Origin: '+(req.headers.get('origin')||'none'),{});fail(403,'This change must come from the Sandy Sports website.','origin_required')}
 let raw='',b=null;
 try{raw=await req.text()}catch{}
 const type=(req.headers.get('content-type')||'').toLowerCase();
 if(raw.length>LIMITS.maxBytes||!type.includes('application/json')){await catchIt('malformed',raw.length>LIMITS.maxBytes?'Oversized: '+raw.length+' bytes':'Content type: '+type.slice(0,60),{});fail(400,'The nomination could not be read. Reload the page and try again.','invalid_nomination')}
 try{b=JSON.parse(raw)}catch{}
 if(!b||typeof b!=='object'||Array.isArray(b)||!uuid.test(b.submissionId||'')){await catchIt('malformed','Unreadable body or missing submission id',minimal(b));fail(400,'The nomination could not be read. Reload the page and try again.','invalid_nomination')}
 const data=minimal(b);
 if(field(b.website,200)){await catchIt('honeypot','Hidden field filled',data);return json({ok:true,notice:THANKS},202)}
 if(!await verifyTurnstile(field(b.turnstileToken,2000),req,env.SANDY_TURNSTILE_SECRET)){await catchIt('turnstile_failed','Verification token rejected',data);fail(403,'Complete the verification before sending.','verification_required')}
 const problem=validate(data);if(problem)fail(400,problem,'invalid_nomination');
 const nominationId=await stableId('nomination/'+b.submissionId);
 if(await db.prepare('SELECT 1 FROM club_nominations WHERE id=?').bind(nominationId).first())return json({ok:true,notice:THANKS},202);
 const since=iso(Date.now()-36e5);
 const fromSource=ipHash?(await db.prepare('SELECT COUNT(*) AS n FROM club_nominations WHERE ip_hash=? AND created_utc>=?').bind(ipHash,since).first())?.n||0:0;
 const total=(await db.prepare('SELECT COUNT(*) AS n FROM club_nominations WHERE created_utc>=?').bind(since).first())?.n||0;
 if(fromSource>=LIMITS.perSourcePerHour||total>=LIMITS.genuinePerHour){await catchIt('rate_limited',fromSource>=LIMITS.perSourcePerHour?'Source hourly limit':'Site hourly limit',data);return json({ok:true,notice:THANKS},202)}
 await register(db,env,data,{nominationId,origin:'form',ipHash});
 return json({ok:true,notice:THANKS},202);
}
export async function nominationsEndpoint(req,env,path,actor){
 if(path==='/api/nominate'&&req.method==='GET')return json({open:nominationsOpen(env),siteKey:nominationsOpen(env)?env.SANDY_TURNSTILE_SITE_KEY:null,pathways:PATHWAYS,towns:TOWNS});
 if(path==='/api/nominate'&&req.method==='POST')return publicNominate(req,env);
 requireRole(actor,OFFICERS);
 const db=dbFor(env);
 try{return await officer(req,env,path,actor,db)}
 catch(e){
  // Before migration 0003 is applied the officer view shows empty lists, not an error.
  if(/no such table/i.test(String(e?.message))&&req.method==='GET')return json(path.endsWith('/spam')?{items:[],droppedOverflow:0,retentionDays:LIMITS.quarantineDays,hourlyCap:LIMITS.quarantinePerHour,migrationNeeded:true}:{nominations:[],open:nominationsOpen(env),mailConfigured:mailConfigured(env),migrationNeeded:true});
  throw e;
 }
}
async function officer(req,env,path,actor,db){
 if(path==='/api/committee/nominations'&&req.method==='GET'){
  await ensureRecordingColumn(db);
  const rows=await db.prepare('SELECT n.id,n.created_utc AS createdAt,n.recording_consent_utc AS recordingConsentAt,n.pathway,n.town,n.interests,n.offer,n.origin,n.alert_state AS alertState,p.id AS personId,p.full_name AS name,p.email FROM club_nominations n JOIN club_people p ON p.id=n.person_id ORDER BY n.created_utc DESC LIMIT 200').all();
  return json({nominations:rows.results||[],open:nominationsOpen(env),mailConfigured:mailConfigured(env)});
 }
 if(path==='/api/committee/spam'&&req.method==='GET'){
  await purge(db);
  const rows=await db.prepare('SELECT id,created_utc AS createdAt,reason,detail,user_agent AS userAgent,payload_json,expires_utc AS expiresAt FROM club_spam_quarantine ORDER BY created_utc DESC LIMIT 300').all();
  const overflow=await db.prepare('SELECT COALESCE(SUM(dropped),0) AS n FROM club_spam_overflow').first();
  return json({items:(rows.results||[]).map(({payload_json,...r})=>{const p=JSON.parse(payload_json);return {...r,reasonLabel:REASONS[r.reason],name:p.name||'',email:p.email||'',pathway:p.pathway||'',town:p.town||'',interests:p.interests||'',offer:p.offer||''}}),
   droppedOverflow:overflow?.n||0,retentionDays:LIMITS.quarantineDays,hourlyCap:LIMITS.quarantinePerHour});
 }
 const m=path.match(/^\/api\/committee\/spam\/([a-f0-9-]{36})$/);
 if(m&&req.method==='POST'){
  const b=await req.json().catch(()=>({}));
  const row=await db.prepare('SELECT * FROM club_spam_quarantine WHERE id=?').bind(m[1]).first();
  if(!row)fail(404,'That caught item no longer exists.','not_found');
  const at=now();
  if(b.action==='delete'){
   await db.batch([db.prepare('DELETE FROM club_spam_quarantine WHERE id=?').bind(row.id),audit(db,actor,'spam_deleted','spam',row.id,at,true)]);
   return json({ok:true,deleted:true});
  }
  if(b.action==='genuine'){
   const data={...minimal(JSON.parse(row.payload_json)),consent:true};
   const problem=validate(data);
   if(problem)fail(409,'This item cannot be moved to the register: '+problem.toLowerCase(),'not_releasable');
   const nominationId=await stableId('released/'+row.id);
   await db.batch([db.prepare('DELETE FROM club_spam_quarantine WHERE id=?').bind(row.id),audit(db,actor,'spam_marked_genuine','spam',row.id,at,true)]);
   const out=await register(db,env,data,{nominationId,origin:'released_from_spam',ipHash:''});
   return json({ok:true,nominationId:out.id,alert:out.alert});
  }
  fail(400,'Choose Mark as genuine or Delete.','invalid_action');
 }
 fail(404,'Unknown nominations service.','not_found');
}
const brisbane=ms=>new Date(ms+36e6).toISOString();
const when=ms=>brisbane(ms).slice(0,16).replace('T',' ')+' AEST';
// Daily 10:00 AM Australia/Brisbane digest (cron 0 0 * * * UTC). Lists the last 24 hours
// of genuine nominations and quarantined items with reasons and counts, as links only.
export async function dailyDigest(env,ms=Date.now()){
 if(!nominationsOpen(env))return {skipped:'switched_off'};
 if(!mailConfigured(env))return {skipped:'mail_not_configured'};
 const db=dbFor(env),day=brisbane(ms).slice(0,10),since=iso(ms-864e5);
 if(await db.prepare('SELECT 1 FROM club_alert_digests WHERE digest_date=? AND state=\'sent\'').bind(day).first())return {skipped:'already_sent'};
 await purge(db,ms);
 const genuine=(await db.prepare('SELECT id,created_utc,pathway,town,origin FROM club_nominations WHERE created_utc>=? ORDER BY created_utc').bind(since).all()).results||[];
 const caught=(await db.prepare('SELECT id,created_utc,reason FROM club_spam_quarantine WHERE created_utc>=? ORDER BY created_utc').bind(since).all()).results||[];
 const overflow=(await db.prepare('SELECT COALESCE(SUM(dropped),0) AS n FROM club_spam_overflow WHERE hour_utc>=?').bind(hourKey(ms-864e5)).first())?.n||0;
 if(!genuine.length&&!caught.length&&!overflow)return {skipped:'nothing_to_report'};
 const counts={};for(const c of caught)counts[c.reason]=(counts[c.reason]||0)+1;
 const lines=['Sandy Sports daily summary for the 24 hours to '+when(ms),'',
  'Genuine nominations: '+genuine.length,
  ...genuine.map(n=>'  '+when(Date.parse(n.created_utc))+'  '+summary(n).replace('New nomination: ','')+(n.origin==='released_from_spam'?' (released from spam)':'')+'\n    '+adminLink(env,'nomination',n.id)),
  '','Caught by spam protection: '+caught.length+(overflow?' stored, plus '+overflow+' more counted but not stored (hourly cap)':''),
  ...Object.entries(counts).map(([r,n])=>'  '+REASONS[r]+': '+n),
  ...caught.slice(0,50).map(c=>'  '+when(Date.parse(c.created_utc))+'  '+REASONS[c.reason]+'\n    '+adminLink(env,'spam',c.id)),
  ...(caught.length>50?['  and '+(caught.length-50)+' more in the admin area']:[]),
  '','Review everything: '+adminLink(env),'Personal details are kept in the admin area only.'];
 const sent=await sendAlert(env,{subject:'Sandy Sports daily summary: '+genuine.length+' new, '+(caught.length+overflow)+' caught',text:lines.join('\n')});
 const state=sent.state==='sent'?'sent':'failed';
 await db.prepare('INSERT INTO club_alert_digests(digest_date,sent_utc,genuine,quarantined,overflow,state) VALUES(?,?,?,?,?,?) ON CONFLICT(digest_date) DO UPDATE SET sent_utc=excluded.sent_utc,genuine=excluded.genuine,quarantined=excluded.quarantined,overflow=excluded.overflow,state=excluded.state')
  .bind(day,now(),genuine.length,caught.length,overflow,state).run();
 return {state,genuine:genuine.length,quarantined:caught.length,overflow};
}
