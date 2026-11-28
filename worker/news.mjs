// Island news and live broadcasts, for the Minjerribah Screen Media Network.
// Film Club members send in short local stories; an officer with publishing authority
// checks them and puts them on the public news page. Live broadcasts are scheduled by
// the committee and link out to whatever platform carries the stream: no lock-in.
import {fail,json,now,id,dbFor,payload,field,requireRole,ACCESS_GROUPS,audit} from './shared.mjs';
import {requireMember} from './profiles.mjs';
import {ensureNotify,enqueue} from './notify.mjs';
export const PLACES=['Dunwich','Amity Point','Point Lookout','Island-wide'];
const DDL=[
 `CREATE TABLE IF NOT EXISTS club_news_stories(id TEXT PRIMARY KEY,author_id TEXT NOT NULL,credit TEXT NOT NULL DEFAULT 'club' CHECK(credit IN ('first','club')),title TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',place TEXT NOT NULL,happened_on TEXT NOT NULL,video_url TEXT NOT NULL DEFAULT '',people_ok INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'sent' CHECK(state IN ('sent','published','declined','withdrawn','unpublished')),review_note TEXT NOT NULL DEFAULT '',reviewer_id TEXT,published_utc TEXT,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`,
 'CREATE INDEX IF NOT EXISTS club_news_state ON club_news_stories(state,published_utc)',
 `CREATE TABLE IF NOT EXISTS club_broadcasts(id TEXT PRIMARY KEY,title TEXT NOT NULL,about TEXT NOT NULL DEFAULT '',place TEXT NOT NULL,starts_at TEXT NOT NULL,stream_url TEXT NOT NULL DEFAULT '',replay_url TEXT NOT NULL DEFAULT '',state TEXT NOT NULL DEFAULT 'scheduled' CHECK(state IN ('scheduled','live','ended','cancelled')),crew TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`];
const ready=new WeakSet();
async function ensureNews(env,db){if(ready.has(env))return;for(const s of DDL)await db.prepare(s).run();await ensureNotify(env,db);ready.add(env)}
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'';
// Any https link to the platform carrying the video: YouTube, Vimeo, Facebook, Twitch, PeerTube, Owncast, a club server.
export function cleanUrl(v){
 const s=String(v||'').trim();if(!s)return '';
 try{const u=new URL(s);if(u.protocol!=='https:')return null;return u.href.slice(0,400)}catch{return null}
}
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return ''}};
const firstName=r=>(r.preferred_name||r.full_name||'').split(' ')[0];
const story=(r,full=false)=>({id:r.id,title:r.title,summary:r.summary,body:r.body,place:r.place,happenedOn:r.happened_on,videoUrl:r.video_url,videoHost:host(r.video_url),
 byline:r.credit==='first'&&firstName(r)?firstName(r)+', Sandy Sports Film Club':'Sandy Sports Film Club',publishedAt:r.published_utc,
 ...(full?{state:r.state,credit:r.credit,peopleOk:!!r.people_ok,reviewNote:r.review_note,author:r.full_name||'',sentAt:r.created_utc}:{})});
const broadcast=(r,full=false)=>({id:r.id,title:r.title,about:r.about,place:r.place,startsAt:r.starts_at,state:r.state,streamUrl:r.state==='ended'?'':r.stream_url,replayUrl:r.replay_url,streamHost:host(r.stream_url||r.replay_url),...(full?{crew:r.crew,stream:r.stream_url}:{})});
async function storyRow(db,sid){return db.prepare('SELECT s.*,p.preferred_name,p.full_name FROM club_news_stories s LEFT JOIN club_people p ON p.account_id=s.author_id WHERE s.id=?').bind(sid).first()}

// Public: published stories and broadcasts. ?live=1 is the tiny check the site header uses.
export async function publicNewsEndpoint(req,env){
 if(req.method!=='GET')fail(405,'Read only.','method_not_allowed');
 const db=dbFor(env);await ensureNews(env,db);
 const live=((await db.prepare("SELECT * FROM club_broadcasts WHERE state='live' ORDER BY starts_at LIMIT 3").all()).results||[]).map(r=>broadcast(r));
 const headers={'Cache-Control':'public, max-age=60'};
 if(new URL(req.url).searchParams.get('live')==='1')return json({live:live.map(({id,title,place,streamUrl,streamHost})=>({id,title,place,streamUrl,streamHost}))},200,headers);
 const since=new Date(Date.now()-21*864e5).toISOString();
 const upcoming=((await db.prepare("SELECT * FROM club_broadcasts WHERE state='scheduled' AND starts_at>=? ORDER BY starts_at LIMIT 12").bind(new Date(Date.now()-3*36e5).toISOString()).all()).results||[]).map(r=>broadcast(r));
 const replays=((await db.prepare("SELECT * FROM club_broadcasts WHERE state='ended' AND replay_url<>'' ORDER BY starts_at DESC LIMIT 12").all()).results||[]).map(r=>broadcast(r));
 const stories=((await db.prepare("SELECT s.*,p.preferred_name,p.full_name FROM club_news_stories s LEFT JOIN club_people p ON p.account_id=s.author_id WHERE s.state='published' ORDER BY s.published_utc DESC LIMIT 30").all()).results||[]).map(r=>story(r));
 return json({live,upcoming,replays,stories,recentSince:since},200,headers);
}

// Members of the Film Club send in stories and see where theirs are up to.
export async function memberNewsEndpoint(req,env,identity){
 const db=dbFor(env);await requireMember(env,db,identity);await ensureNews(env,db);
 const me=identity.id,at=now();
 const film=(await db.prepare('SELECT film_member FROM club_member_profiles WHERE account_id=?').bind(me).first())?.film_member;
 if(req.method==='POST'){
  const b=await payload(req,8000);
  if(b.action==='withdraw'){
   const r=await db.prepare("UPDATE club_news_stories SET state='withdrawn',updated_utc=? WHERE id=? AND author_id=? AND state IN ('sent','published')").bind(at,field(b.id,40),me).run();
   if(!r.meta.changes)fail(404,'That story is not available.','not_found');
  }else{
   if(!film)fail(409,'Join the Film Club to send in a story.','film_member_required');
   const title=field(b.title,90).trim(),summary=field(b.summary,300).trim(),place=field(b.place,20),happened=day(b.happenedOn),video=cleanUrl(b.videoUrl);
   if(!title||!summary)fail(400,'Give your story a headline and a short summary.','story_required');
   if(!PLACES.includes(place)||!happened)fail(400,'Say where and when it happened.','where_when');
   if(video===null)fail(400,'Video links need to start with https://.','invalid_url');
   if(b.peopleOk!==true)fail(400,'Check that everyone shown is happy to be in it (and under 18s have a parent or carer’s OK).','consent_required');
   const open=await db.prepare("SELECT COUNT(*) AS n FROM club_news_stories WHERE author_id=? AND state='sent'").bind(me).first();
   if(Number(open?.n||0)>=5)fail(409,'You have five stories waiting already. Give the editors a moment.','too_many');
   await db.prepare('INSERT INTO club_news_stories(id,author_id,credit,title,summary,body,place,happened_on,video_url,people_ok,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)')
    .bind(id(),me,b.credit==='first'?'first':'club',title,summary,field(b.body,4000).trim(),place,happened,video||'',at,at).run();
  }
 }else if(req.method!=='GET')fail(405,'Use the news form.','method_not_allowed');
 const {results=[]}=await db.prepare('SELECT s.*,p.preferred_name,p.full_name FROM club_news_stories s LEFT JOIN club_people p ON p.account_id=s.author_id WHERE s.author_id=? ORDER BY s.created_utc DESC LIMIT 20').bind(me).all();
 return json({film:!!film,places:PLACES,stories:results.map(r=>story(r,true))});
}

// Committee: review stories, schedule and run broadcasts.
export async function committeeNewsEndpoint(req,env,identity){
 requireRole(identity,ACCESS_GROUPS.officers);
 const db=dbFor(env);await ensureNews(env,db);const at=now();
 if(req.method==='POST'){
  requireRole(identity,ACCESS_GROUPS.memberRecords);
  const b=await payload(req,6000),action=field(b.action,20);
  if(['publish','decline','unpublish'].includes(action)){
   const r=await storyRow(db,field(b.id,40));if(!r)fail(404,'That story is not available.','not_found');
   const ok={publish:['sent','unpublished','declined'],decline:['sent'],unpublish:['published']}[action];
   if(!ok.includes(r.state))fail(409,'That story has moved on. Refresh to see where it is.','story_state');
   const state={publish:'published',decline:'declined',unpublish:'unpublished'}[action],note=field(b.note,300).trim();
   const title=field(b.title,90).trim()||r.title,summary=field(b.summary,300).trim()||r.summary;
   await db.prepare('UPDATE club_news_stories SET state=?,title=?,summary=?,review_note=?,reviewer_id=?,published_utc=CASE WHEN ?=\'published\' THEN COALESCE(published_utc,?) ELSE published_utc END,updated_utc=? WHERE id=?')
    .bind(state,title,summary,note,identity.id,state,at,at,r.id).run();
   await audit(db,identity,'news_'+state,'news',r.id,at).run();
   if(state!=='unpublished')await enqueue(db,{announcementId:r.id,title:state==='published'?'Your story is on Island news: '+title:'Your story was not published this time'+(note?': '+note:''),only:[r.author_id]});
  }else if(action==='broadcast-save'){
   const title=field(b.title,90).trim(),place=field(b.place,20),starts=field(b.startsAt,40),stream=cleanUrl(b.streamUrl),replay=cleanUrl(b.replayUrl);
   if(!title||!PLACES.includes(place)||isNaN(Date.parse(starts)))fail(400,'A broadcast needs a name, a place and a start time.','broadcast_required');
   if(stream===null||replay===null)fail(400,'Stream and replay links need to start with https://.','invalid_url');
   const startIso=new Date(Date.parse(starts)).toISOString();
   if(b.id){
    const r=await db.prepare('UPDATE club_broadcasts SET title=?,about=?,place=?,starts_at=?,stream_url=?,replay_url=?,crew=?,updated_utc=? WHERE id=?').bind(title,field(b.about,600).trim(),place,startIso,stream||'',replay||'',field(b.crew,600).trim(),at,field(b.id,40)).run();
    if(!r.meta.changes)fail(404,'That broadcast is not available.','not_found');
   }else await db.prepare('INSERT INTO club_broadcasts(id,title,about,place,starts_at,stream_url,replay_url,crew,created_by,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id(),title,field(b.about,600).trim(),place,startIso,stream||'',replay||'',field(b.crew,600).trim(),identity.id,at,at).run();
  }else if(['live','ended','cancelled','scheduled'].includes(action)){
   const r=await db.prepare('SELECT * FROM club_broadcasts WHERE id=?').bind(field(b.id,40)).first();if(!r)fail(404,'That broadcast is not available.','not_found');
   if(action==='live'&&!r.stream_url)fail(400,'Add the stream link before going live.','stream_required');
   await db.prepare('UPDATE club_broadcasts SET state=?,updated_utc=? WHERE id=?').bind(action,at,r.id).run();
   await audit(db,identity,'broadcast_'+action,'broadcast',r.id,at).run();
  }else fail(400,'Unknown news action.','invalid_action');
 }else if(req.method!=='GET')fail(405,'Use the news desk.','method_not_allowed');
 const stories=((await db.prepare("SELECT s.*,p.preferred_name,p.full_name FROM club_news_stories s LEFT JOIN club_people p ON p.account_id=s.author_id WHERE s.state<>'withdrawn' ORDER BY CASE s.state WHEN 'sent' THEN 0 ELSE 1 END,s.updated_utc DESC LIMIT 60").all()).results||[]).map(r=>story(r,true));
 const broadcasts=((await db.prepare("SELECT * FROM club_broadcasts ORDER BY CASE state WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,starts_at DESC LIMIT 40").all()).results||[]).map(r=>broadcast(r,true));
 return json({stories,broadcasts,places:PLACES,canPublish:ACCESS_GROUPS.memberRecords.includes(identity.role)});
}
