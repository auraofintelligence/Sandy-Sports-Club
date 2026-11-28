// Club calendar: one list of what's on, for everyone and for members.
// Public: ticketed events from the store, plus member announcements the committee ticked
// "Show on the public calendar" (no RSVPs or names). Members also see their announcements
// (Film Club and reminder audiences included), their own reply, and formally released events.
// Feeds are .ics files people add to Apple, Google or Outlook calendars. Nothing is sent.
import {json,dbFor,requireRole,STAFF} from './shared.mjs';
import {ensureStore} from './store.mjs';
import {ensureAnnouncements} from './announcements.mjs';
import {memberPublicationAllowed,visibleRecords} from './record-policy.mjs';

const today=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const until=()=>new Date(Date.now()+36e6+400*864e5).toISOString().slice(0,10);

// "7:30pm", "5pm to 7pm", "9am-12pm", "17:30" -> {start:'19:30',end:''} etc. Unclear text stays all-day.
export function parseTimes(text){
 const found=[...String(text||'').toLowerCase().matchAll(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/g)].filter(m=>Number(m[1])<=24).slice(0,2);
 if(!found.length)return {start:'',end:''};
 const merid=found.map(m=>m[3]||''),last=merid.filter(Boolean).pop()||'';
 const to24=(m,i)=>{let h=Number(m[1]);const min=m[2]||'00',ap=merid[i]||(m[2]||h>12?'':last);
  if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;
  if(!ap&&!m[2]&&h<=12)return '';// a bare number like "7" is too vague
  return h<24&&Number(min)<60?String(h).padStart(2,'0')+':'+min:''};
 const start=to24(found[0],0),end=found[1]?to24(found[1],1):'';
 return {start,end:start&&end>start?end:''};
}
const short=(s,n=220)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trimEnd()+'…':s};

async function ticketEvents(env,db){
 try{
  await ensureStore(env,db);
  const {results=[]}=await db.prepare("SELECT sku,name,description,event_date,event_time,venue FROM store_products WHERE kind='ticket' AND status='active' AND event_date BETWEEN ? AND ? ORDER BY event_date,sort").bind(today(),until()).all();
  return results.map(r=>({id:'tix-'+r.sku.toLowerCase(),kind:'tickets',audience:'public',title:r.name,date:r.event_date,time:r.event_time||'',...parseTimes(r.event_time),location:r.venue||'',summary:short(r.description),link:'/store.html#'+encodeURIComponent(r.sku),linkLabel:'Tickets'}));
 }catch{return []}
}
async function announcementEvents(env,db,where,args,identity){
 try{
  await ensureAnnouncements(env,db);
  const sql=`SELECT a.*${identity?',r.response AS my_response,r.children AS my_children':''} FROM club_announcements a
   ${identity?'LEFT JOIN club_announcement_rsvps r ON r.announcement_id=a.id AND r.account_id=?':''}
   WHERE a.archived_utc IS NULL AND a.event_date BETWEEN ? AND ? AND ${where} ORDER BY a.event_date,a.created_utc`;
  const {results=[]}=await db.prepare(sql).bind(...(identity?[identity.id]:[]),today(),until(),...args).all();
  return results.map(r=>({id:'ann-'+r.id,announcementId:r.id,kind:'club',audience:r.public_calendar?'public':r.audience==='film'?'film':'members',title:r.title,date:r.event_date,time:r.event_time||'',...parseTimes(r.event_time),location:r.location||'',
   summary:short(r.body),...(identity?{rsvp:!!r.rsvp,myResponse:r.my_response||null,myChildren:r.my_children||0}:{})}));
 }catch{return []}
}
async function releasedEvents(db){
 try{
  const rows=await visibleRecords(db,"WHERE kind='event' AND status='approved' AND event_date>=date('now','+10 hours')",[],'event_date,id',40,memberPublicationAllowed);
  return rows.map(r=>{let f={};try{f=JSON.parse(r.body_json).fields||{}}catch{}
   return {id:'rel-'+r.id,recordId:r.id,kind:'club',audience:'members',released:true,title:r.title,date:r.event_date,time:f.startTime||'',start:/^\d\d:\d\d$/.test(f.startTime||'')?f.startTime:'',end:/^\d\d:\d\d$/.test(f.endTime||'')?f.endTime:'',location:f.location||f.venue||'',summary:short(f.summary||f.description||'')}});
 }catch{return []}
}
const byDate=(a,b)=>a.date.localeCompare(b.date)||(a.start||'99').localeCompare(b.start||'99')||a.title.localeCompare(b.title);
export async function publicEvents(env,db){
 return [...await ticketEvents(env,db),...await announcementEvents(env,db,"a.public_calendar=1 AND a.audience='all'",[])].sort(byDate);
}
async function memberEvents(env,db,identity){
 const mine=await db.prepare('SELECT film_member,id_verified_utc FROM club_member_profiles WHERE account_id=?').bind(identity.id).first().catch(()=>null);
 const staff=STAFF.includes(identity.role),film=staff||!!mine?.film_member,unverified=staff||!mine?.id_verified_utc;
 const ann=await announcementEvents(env,db,"(a.audience='all' OR (a.audience='film' AND ?=1) OR (a.audience='unverified' AND ?=1))",[film?1:0,unverified?1:0],identity);
 return [...await ticketEvents(env,db),...ann,...await releasedEvents(db)].sort(byDate);
}

// ---------- .ics ----------
const esc=s=>String(s||'').replace(/[\\;,]/g,m=>'\\'+m).replace(/\r?\n/g,'\\n');
const fold=line=>{const out=[];let s=line;while(s.length>74){out.push(s.slice(0,74));s=' '+s.slice(74)}out.push(s);return out.join('\r\n')};
const plusDay=d=>new Date(Date.parse(d+'T00:00:00Z')+864e5).toISOString().slice(0,10);
export function icsFeed(events,{name,origin}){
 const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z',d=s=>s.replaceAll('-',''),t=s=>s.replace(':','')+'00';
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+esc(name),'X-WR-TIMEZONE:Australia/Brisbane',
  'REFRESH-INTERVAL;VALUE=DURATION:PT6H','X-PUBLISHED-TTL:PT6H',
  'BEGIN:VTIMEZONE','TZID:Australia/Brisbane','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+1000','TZOFFSETTO:+1000','TZNAME:AEST','END:STANDARD','END:VTIMEZONE'];
 for(const e of events){
  lines.push('BEGIN:VEVENT','UID:'+e.id+'@sandy-sports-club','DTSTAMP:'+stamp);
  if(e.start){lines.push('DTSTART;TZID=Australia/Brisbane:'+d(e.date)+'T'+t(e.start));lines.push(e.end?'DTEND;TZID=Australia/Brisbane:'+d(e.date)+'T'+t(e.end):'DURATION:PT2H')}
  else lines.push('DTSTART;VALUE=DATE:'+d(e.date),'DTEND;VALUE=DATE:'+d(plusDay(e.date)));
  lines.push('SUMMARY:'+esc(e.title));
  if(e.location)lines.push('LOCATION:'+esc(e.location));
  const desc=[e.time&&!e.start?'Time: '+e.time:'',e.summary,e.link?'Details: '+origin+e.link:'','Sandy Sports Club (proposed), Minjerribah'].filter(Boolean).join('\n');
  lines.push('DESCRIPTION:'+esc(desc));
  if(e.link)lines.push('URL:'+origin+e.link);
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR','');
 return lines.map(fold).join('\r\n');
}
const icsResponse=(text,file,cache)=>new Response(text,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="'+file+'"','Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});

export async function calendarEndpoint(req,env,path,identity){
 const db=dbFor(env),origin=new URL(req.url).origin;
 if(req.method!=='GET')return json({error:'Calendars are read-only.',code:'method_not_allowed'},405);
 if(path==='/api/calendar')return json({events:await publicEvents(env,db),feed:'/api/calendar.ics'},200,{'Cache-Control':'public, max-age=300'});
 if(path==='/api/calendar.ics')return icsResponse(icsFeed(await publicEvents(env,db),{name:'Sandy Sports Straddie',origin}),'sandy-sports.ics','public, max-age=900');
 requireRole(identity,['member',...STAFF]);
 const events=await memberEvents(env,db,identity);
 if(path==='/api/member/calendar')return json({events,feed:'/api/member/club-calendar.ics'});
 if(path==='/api/member/club-calendar.ics')return icsResponse(icsFeed(events,{name:'Sandy Sports (members)',origin}),'sandy-sports-members.ics','no-store, private');
 return json({error:'No calendar at that address.',code:'not_found'},404);
}
