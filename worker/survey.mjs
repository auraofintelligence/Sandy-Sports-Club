// Sports interest survey on sports.html (switched off unless SANDY_SURVEY_ENABLED=enabled).
// Visitors choose and rank the sports they want the club to prioritise and, for each, say
// whether they want casual play, regular training or regional competition. Age group, town
// and how often they would play are optional. No names, emails or contact details.
// Spam protection is the nominations one: Turnstile, a hidden honeypot field, hourly rate
// limits, and the same quarantine so nothing caught is silently dropped. No emails are sent.
import {fail,json,id,dbFor,field,requireRole,withDeputies} from './shared.mjs';
import {stableId} from './meetings.mjs';
import {verifyTurnstile} from './people.mjs';
import {quarantine,sourceHash} from './nominations.mjs';

export const SPORTS=['Mixed beach volleyball','Flag football','Beach cricket','Beach football','Beach rugby league','Beach 5s rugby','AirBadminton','Beach tennis and net games','Ultimate and flying disc','Beach handball','Netball crossover','AFL crossover','Fitness and movement','Island-made formats'];
export const GOALS={casual:'Casual play',training:'Regular training',compete:'Compete in regional competitions'};
export const AGE_GROUPS=['Under 12','12 to 17','18 to 29','30 to 49','50 to 64','65 and over'];
export const TOWNS=['Dunwich','Amity','Point Lookout','Visitor','Other'];
export const FREQUENCIES=['Weekly or more','A few times a month','About once a month','A few times a year','Not sure yet'];
export const SURVEY_LIMITS={perSourcePerHour:5,totalPerHour:120,ipHashDays:30,maxBytes:6000};
const OFFICERS=withDeputies(['webmaster','secretary']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const THANKS='Thanks, your answers are in. They help the organisers plan; they are not a booking or a membership.';
const iso=ms=>new Date(ms).toISOString();
export const surveyOpen=env=>Boolean(env.SANDY_SURVEY_ENABLED==='enabled'&&env.DB?.prepare&&env.SANDY_TURNSTILE_SECRET&&env.SANDY_TURNSTILE_SITE_KEY);

function minimal(b){
 if(!b||typeof b!=='object')return {choices:[]};
 const choices=Array.isArray(b.choices)?b.choices.slice(0,20).map(c=>({sport:field(c?.sport,60),goal:field(c?.goal,20)})):[];
 return {choices,ageGroup:field(b.ageGroup,30),town:field(b.town,30),frequency:field(b.frequency,40)};
}
function validate(d){
 if(!d.choices.length)return 'Choose at least one sport.';
 if(d.choices.length>SPORTS.length)return 'Choose each sport once.';
 const seen=new Set();
 for(const c of d.choices){
  if(!SPORTS.includes(c.sport))return 'Choose sports from the list.';
  if(seen.has(c.sport))return 'Choose each sport once.';
  seen.add(c.sport);
  if(!GOALS[c.goal])return 'For each sport, choose casual play, regular training or regional competition.';
 }
 if(d.ageGroup&&!AGE_GROUPS.includes(d.ageGroup))return 'Choose an age group from the list.';
 if(d.town&&!TOWNS.includes(d.town))return 'Choose a town from the list.';
 if(d.frequency&&!FREQUENCIES.includes(d.frequency))return 'Choose how often from the list.';
 return '';
}
async function purge(db,ms=Date.now()){
 await db.prepare("UPDATE club_survey_responses SET ip_hash='' WHERE ip_hash<>'' AND created_utc<?").bind(iso(ms-SURVEY_LIMITS.ipHashDays*864e5)).run();
}
async function publicSubmit(req,env){
 if(!surveyOpen(env))fail(503,'The sports survey is opening soon.','survey_not_open');
 const db=dbFor(env),ipHash=await sourceHash(req,env,'survey-v1'),userAgent=req.headers.get('user-agent')||'';
 const catchIt=(reason,detail,data)=>quarantine(db,{reason,detail:'Sports survey: '+detail,ipHash,userAgent,data:{survey:data}});
 await purge(db);
 const url=new URL(req.url);
 if(req.headers.get('origin')!==url.origin){await catchIt('cross_origin','Origin: '+(req.headers.get('origin')||'none'),{});fail(403,'This survey must be sent from the Sandy Sports website.','origin_required')}
 let raw='',b=null;
 try{raw=await req.text()}catch{}
 const type=(req.headers.get('content-type')||'').toLowerCase();
 if(raw.length>SURVEY_LIMITS.maxBytes||!type.includes('application/json')){await catchIt('malformed',raw.length>SURVEY_LIMITS.maxBytes?'Oversized: '+raw.length+' bytes':'Content type: '+type.slice(0,60),{});fail(400,'The survey could not be read. Reload the page and try again.','invalid_survey')}
 try{b=JSON.parse(raw)}catch{}
 if(!b||typeof b!=='object'||Array.isArray(b)||!uuid.test(b.submissionId||'')){await catchIt('malformed','Unreadable body or missing submission id',minimal(b));fail(400,'The survey could not be read. Reload the page and try again.','invalid_survey')}
 const data=minimal(b);
 if(field(b.website,200)){await catchIt('honeypot','Hidden field filled',data);return json({ok:true,notice:THANKS},202)}
 if(!await verifyTurnstile(field(b.turnstileToken,2000),req,env.SANDY_TURNSTILE_SECRET)){await catchIt('turnstile_failed','Verification token rejected',data);fail(403,'Complete the verification before sending.','verification_required')}
 const problem=validate(data);if(problem)fail(400,problem,'invalid_survey');
 const responseId=await stableId('survey/'+b.submissionId);
 if(await db.prepare('SELECT 1 FROM club_survey_responses WHERE id=?').bind(responseId).first())return json({ok:true,notice:THANKS},202);
 const since=iso(Date.now()-36e5);
 const fromSource=ipHash?(await db.prepare('SELECT COUNT(*) AS n FROM club_survey_responses WHERE ip_hash=? AND created_utc>=?').bind(ipHash,since).first())?.n||0:0;
 const total=(await db.prepare('SELECT COUNT(*) AS n FROM club_survey_responses WHERE created_utc>=?').bind(since).first())?.n||0;
 if(fromSource>=SURVEY_LIMITS.perSourcePerHour||total>=SURVEY_LIMITS.totalPerHour){await catchIt('rate_limited',fromSource>=SURVEY_LIMITS.perSourcePerHour?'Source hourly limit':'Site hourly limit',data);return json({ok:true,notice:THANKS},202)}
 const at=iso(Date.now());
 await db.batch([
  db.prepare('INSERT INTO club_survey_responses(id,created_utc,age_group,town,frequency,ip_hash) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(responseId,at,data.ageGroup,data.town,data.frequency,ipHash),
  ...data.choices.map((c,i)=>db.prepare('INSERT INTO club_survey_choices(response_id,sport,goal,rank) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(responseId,c.sport,c.goal,i+1))]);
 return json({ok:true,notice:THANKS},202);
}
async function tallies(db){
 const total=(await db.prepare('SELECT COUNT(*) AS n FROM club_survey_responses').first())?.n||0;
 const rows=(await db.prepare('SELECT sport,goal,COUNT(*) AS n,SUM(CASE WHEN rank=1 THEN 1 ELSE 0 END) AS top,AVG(rank) AS avgRank FROM club_survey_choices GROUP BY sport,goal').all()).results||[];
 const bySport=SPORTS.map(sport=>{
  const mine=rows.filter(r=>r.sport===sport);
  const goals=Object.fromEntries(Object.keys(GOALS).map(g=>[g,mine.find(r=>r.goal===g)?.n||0]));
  const chosen=Object.values(goals).reduce((a,b)=>a+b,0);
  const rankSum=mine.reduce((a,r)=>a+r.avgRank*r.n,0);
  return {sport,chosen,firstChoice:mine.reduce((a,r)=>a+(r.top||0),0),averageRank:chosen?Math.round(rankSum/chosen*10)/10:null,goals};
 }).sort((a,b)=>b.chosen-a.chosen||b.firstChoice-a.firstChoice||a.sport.localeCompare(b.sport));
 const count=async col=>((await db.prepare('SELECT '+col+' AS k,COUNT(*) AS n FROM club_survey_responses GROUP BY '+col).all()).results||[]).map(r=>({value:r.k||'Not given',count:r.n}));
 return {total,bySport,ageGroups:await count('age_group'),towns:await count('town'),frequencies:await count('frequency')};
}
const csvCell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
async function csv(db){
 const rows=(await db.prepare('SELECT r.id,r.created_utc,r.age_group,r.town,r.frequency,c.rank,c.sport,c.goal FROM club_survey_responses r JOIN club_survey_choices c ON c.response_id=r.id ORDER BY r.created_utc,r.id,c.rank').all()).results||[];
 const lines=[['response_id','received_utc','age_group','town','how_often','rank','sport','goal'].join(',')];
 for(const r of rows)lines.push([r.id,r.created_utc,r.age_group,r.town,r.frequency,r.rank,r.sport,GOALS[r.goal]||r.goal].map(csvCell).join(','));
 return new Response(lines.join('\r\n')+'\r\n',{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="sandy-sports-survey.csv"','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
}
export async function surveyEndpoint(req,env,path,actor){
 if(path==='/api/survey'&&req.method==='GET')return json({open:surveyOpen(env),siteKey:surveyOpen(env)?env.SANDY_TURNSTILE_SITE_KEY:null,sports:SPORTS,goals:GOALS,ageGroups:AGE_GROUPS,towns:TOWNS,frequencies:FREQUENCIES});
 if(path==='/api/survey'&&req.method==='POST')return publicSubmit(req,env);
 requireRole(actor,OFFICERS);
 const db=dbFor(env);
 try{
  if(path==='/api/committee/survey'&&req.method==='GET')return json({open:surveyOpen(env),goals:GOALS,...await tallies(db)});
  if(path==='/api/committee/survey.csv'&&req.method==='GET')return await csv(db);
 }catch(e){
  // Before migration 0004 is applied the officer view shows empty tallies, not an error.
  if(/no such table/i.test(String(e?.message))&&req.method==='GET'){
   if(path.endsWith('.csv'))return new Response('response_id,received_utc,age_group,town,how_often,rank,sport,goal\r\n',{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="sandy-sports-survey.csv"','Cache-Control':'no-store, private'}});
   return json({open:surveyOpen(env),goals:GOALS,total:0,bySport:SPORTS.map(sport=>({sport,chosen:0,firstChoice:0,averageRank:null,goals:{casual:0,training:0,compete:0}})),ageGroups:[],towns:[],frequencies:[],migrationNeeded:true});
  }
  throw e;
 }
 fail(404,'Unknown survey service.','not_found');
}
