// Sports interest survey: switched off by default, anonymous, the nominations spam
// protection (Turnstile, honeypot, rate limits, quarantine), officer-only tallies and CSV.
// Fictional answers only; Turnstile is mocked. No email is ever sent by the survey.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.mjs';
import {fixture} from './d1-fixture.mjs';
import {SURVEY_LIMITS,SPORTS} from '../worker/survey.mjs';

const realFetch=globalThis.fetch;
function mockNetwork(t){
 const calls=[];
 globalThis.fetch=async(url,init={})=>{
  const u=String(url);calls.push(u);
  if(u.startsWith('https://challenges.cloudflare.com/')){const token=new URLSearchParams(init.body).get('response');return new Response(JSON.stringify({success:token==='pass-fictional'}))}
  throw new Error('Unexpected network call in test: '+u);
 };
 t.after(()=>{globalThis.fetch=realFetch});
 return calls;
}
const switchOn=env=>Object.assign(env,{SANDY_SURVEY_ENABLED:'enabled',SANDY_TURNSTILE_SECRET:'fictional-secret',SANDY_TURNSTILE_SITE_KEY:'fictional-site-key'});
const answer=(extra={})=>({submissionId:randomUUID(),choices:[{sport:'Mixed beach volleyball',goal:'compete'},{sport:'Flag football',goal:'casual'},{sport:'Beach cricket',goal:'training'}],
 ageGroup:'30 to 49',town:'Amity',frequency:'Weekly or more',website:'',turnstileToken:'pass-fictional',...extra});
const ip=n=>({'cf-connecting-ip':'198.51.100.'+n,'user-agent':'FictionalBrowser/2.0'});
const opts={nominations:true,survey:true};

test('switched off by default: wrangler keeps it disabled, nothing is stored and the page says opening soon',async t=>{
 const f=fixture(t,opts);mockNetwork(t);
 const cfg=await f.call(null,'/api/survey');
 assert.equal(cfg.open,false);assert.equal(cfg.siteKey,null);assert.deepEqual(cfg.sports,SPORTS);
 assert.equal((await f.request(null,'/api/survey','POST',answer(),'https://sandy.test',ip(1))).status,503);
 assert.equal(f.count('club_survey_responses'),0);assert.equal(f.count('club_spam_quarantine'),0);
 assert.equal((await f.call(null,'/api/public-config')).publicSurveyReady,false);
 const w=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(w.vars.SANDY_SURVEY_ENABLED,'disabled');
 const page=readFileSync(new URL('../sports.html',import.meta.url),'utf8');
 assert.match(page,/id="survey"/);assert.match(page,/Survey opening soon/);
 const js=readFileSync(new URL('../survey.js',import.meta.url),'utf8');
 assert.match(js,/\/api\/survey/);
});

test('an anonymous response stores ranked sports with goals and optional details only',async t=>{
 const f=fixture(t,opts),calls=mockNetwork(t);switchOn(f.env);
 const cfg=await f.call(null,'/api/survey');assert.equal(cfg.open,true);assert.equal(cfg.siteKey,'fictional-site-key');
 const body=answer();
 const res=await f.request(null,'/api/survey','POST',body,'https://sandy.test',ip(1));
 assert.equal(res.status,202);assert.match((await res.json()).notice,/Thanks, your answers are in/);
 assert.equal(f.count('club_survey_responses',"town='Amity' AND age_group='30 to 49' AND frequency='Weekly or more'"),1);
 assert.deepEqual(f.sql.prepare('SELECT sport,goal,rank FROM club_survey_choices ORDER BY rank').all().map(r=>[r.sport,r.goal,r.rank]),
  [['Mixed beach volleyball','compete',1],['Flag football','casual',2],['Beach cricket','training',3]]);
 const row=f.sql.prepare('SELECT * FROM club_survey_responses').get();
 assert.match(row.ip_hash,/^[a-f0-9]{24}$/);assert.ok(!JSON.stringify(row).includes('198.51.100'));
 assert.deepEqual(Object.keys(row).sort(),['age_group','created_utc','frequency','id','ip_hash','town'],'no name or email columns');
 // Retrying the same submission adds nothing.
 assert.equal((await f.request(null,'/api/survey','POST',body,'https://sandy.test',ip(1))).status,202);
 assert.equal(f.count('club_survey_responses'),1);
 // Optional details may be left out.
 assert.equal((await f.request(null,'/api/survey','POST',answer({ageGroup:'',town:'',frequency:''}),'https://sandy.test',ip(2))).status,202);
 // Invalid answers are explained, not stored.
 for(const bad of [{choices:[]},{choices:[{sport:'Darts',goal:'casual'}]},{choices:[{sport:'Flag football',goal:'casual'},{sport:'Flag football',goal:'compete'}]},{choices:[{sport:'Flag football',goal:'win'}]},{town:'Brisbane'}])
  assert.equal((await f.request(null,'/api/survey','POST',answer(bad),'https://sandy.test',ip(3))).status,400,JSON.stringify(bad));
 assert.equal(f.count('club_survey_responses'),2);
 assert.ok(calls.every(u=>u.startsWith('https://challenges.cloudflare.com/')),'only Turnstile is contacted; no mail');
});

test('spam is quarantined with its reason, the same as nominations',async t=>{
 const f=fixture(t,opts);mockNetwork(t);switchOn(f.env);
 assert.equal((await f.request(null,'/api/survey','POST',answer({website:'http://spam.example'}),'https://sandy.test',ip(1))).status,202);
 assert.equal((await f.request(null,'/api/survey','POST',answer({turnstileToken:'bot'}),'https://sandy.test',ip(2))).status,403);
 assert.equal((await f.request(null,'/api/survey','POST',answer(),'https://evil.example',ip(3))).status,403);
 const bad=await worker.fetch(new Request('https://sandy.test/api/survey',{method:'POST',headers:{Origin:'https://sandy.test','Content-Type':'application/json',...ip(4)},body:'{not json'}),f.env);
 assert.equal(bad.status,400);
 const caught=f.sql.prepare('SELECT reason,detail FROM club_spam_quarantine').all();
 assert.deepEqual(caught.map(r=>r.reason).sort(),['cross_origin','honeypot','malformed','turnstile_failed']);
 for(const r of caught)assert.match(r.detail,/^Sports survey: /);
 assert.equal(f.count('club_survey_responses'),0);
});

test('hourly rate limit per source quarantines the extra responses',async t=>{
 const f=fixture(t,opts);mockNetwork(t);switchOn(f.env);
 for(let i=0;i<=SURVEY_LIMITS.perSourcePerHour;i++)assert.equal((await f.request(null,'/api/survey','POST',answer(),'https://sandy.test',ip(9))).status,202);
 assert.equal(f.count('club_survey_responses'),SURVEY_LIMITS.perSourcePerHour);
 assert.equal(f.count('club_spam_quarantine',"reason='rate_limited'"),1);
});

test('Webmaster and Secretary see tallies by sport and goal and can export CSV; nobody else can',async t=>{
 const f=fixture(t,opts);mockNetwork(t);switchOn(f.env);
 await f.request(null,'/api/survey','POST',answer(),'https://sandy.test',ip(1));
 await f.request(null,'/api/survey','POST',answer({choices:[{sport:'Flag football',goal:'compete'},{sport:'Mixed beach volleyball',goal:'compete'}],town:'Visitor'}),'https://sandy.test',ip(2));
 assert.equal(await f.statusOf('asst','/api/committee/survey'),200,'the Assistant Secretary holds the Secretary’s access');
 for(const who of ['pres','vp','treasurer','other','member','demo']){
  assert.equal(await f.statusOf(who,'/api/committee/survey'),403,who);assert.equal(await f.statusOf(who,'/api/committee/survey.csv'),403,who);
 }
 assert.equal(await f.statusOf(null,'/api/committee/survey'),401);
 const t1=await f.call('sec','/api/committee/survey');
 assert.equal(t1.total,2);
 const vb=t1.bySport.find(s=>s.sport==='Mixed beach volleyball'),flag=t1.bySport.find(s=>s.sport==='Flag football');
 assert.deepEqual(vb.goals,{casual:0,training:0,compete:2});assert.equal(vb.firstChoice,1);assert.equal(vb.averageRank,1.5);
 assert.deepEqual(flag.goals,{casual:1,training:0,compete:1});
 assert.equal(t1.bySport.length,14);
 assert.deepEqual(t1.towns.map(x=>x.value).sort(),['Amity','Visitor']);
 const res=await f.request('web','/api/committee/survey.csv');
 assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/csv/);assert.match(res.headers.get('content-disposition'),/attachment/);
 const lines=(await res.text()).trim().split('\r\n');
 assert.equal(lines[0],'response_id,received_utc,age_group,town,how_often,rank,sport,goal');
 assert.equal(lines.length,1+5);
 assert.ok(lines.some(l=>l.endsWith(',1,Mixed beach volleyball,Compete in regional competitions')));
});

test('before migration 0004 the officer view shows empty tallies instead of an error',async t=>{
 const f=fixture(t,{nominations:true});mockNetwork(t);
 const t1=await f.call('web','/api/committee/survey');
 assert.equal(t1.total,0);assert.equal(t1.migrationNeeded,true);
 assert.equal((await f.request('sec','/api/committee/survey.csv')).status,200);
});
