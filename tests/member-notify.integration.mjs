import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
import {due,processNotifications,matches} from '../worker/notify.mjs';
import {earnedBadges} from '../badges.js';
async function join(f,username,{town='Dunwich',region='local'}={}){
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional '+username,email:username+'@example.test',town,audienceRegion:region,
  username,password:'sandy77',adult:true,contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob:'1990-06-15'});
 assert.equal(res.status,201);return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
async function profile(f,mem,patch){
 await f.call(mem,'/api/member/picture','POST',{avatarId:'a01'}).catch(()=>{});
 const {profile:p}=await f.call(mem,'/api/member/profile');
 return f.call(mem,'/api/member/profile','POST',{version:p.version,bio:'',skillLevel:'',sports:[],availability:[],filmMember:false,crewSkills:[],helping:[],directoryVisible:false,showTown:false,shareContact:false,...patch});
}
const soon=n=>new Date(Date.now()+36e6+n*864e5).toISOString().slice(0,10);
// 9am Monday 1 Feb 2027 Brisbane = 23:00 UTC Sunday 31 Jan.
const BRIS=(y,mo,d,h,mi=0)=>Date.UTC(y,mo-1,d,h-10,mi);

test('email due windows respect frequency and quiet hours',()=>{
 const mon9=BRIS(2027,2,1,9);
 assert.equal(due('weekly',null,mon9,false),true);
 assert.equal(due('weekly',new Date(BRIS(2027,2,1,7,15)).toISOString(),mon9,false),false,'already emailed this Monday');
 assert.equal(due('weekly',new Date(BRIS(2027,1,25,8)).toISOString(),BRIS(2027,2,3,9),false),true,'Wednesday after a missed Monday');
 assert.equal(due('daily',new Date(BRIS(2027,2,1,7,5)).toISOString(),BRIS(2027,2,1,15),false),false);
 assert.equal(due('daily',new Date(BRIS(2027,2,1,7,5)).toISOString(),BRIS(2027,2,2,7,10),false),true);
 assert.equal(due('instant',new Date(BRIS(2027,2,1,9)).toISOString(),BRIS(2027,2,1,9,30),false),false,'at most hourly');
 assert.equal(due('instant',new Date(BRIS(2027,2,1,9)).toISOString(),BRIS(2027,2,1,10,15),false),true);
 assert.equal(due('instant',null,BRIS(2027,2,1,22),true),false,'quiet hours hold even urgent changes');
 assert.equal(due('monthly',new Date(BRIS(2027,2,1,8)).toISOString(),BRIS(2027,2,20,9),false),false);
 assert.equal(due('never',null,mon9,false),false);
 assert.equal(due('never',null,mon9,true),true,'never still gets changes to events they are going to');
});
test('badges come from participation',()=>{
 const base={joinedOn:'2026-12-01',foundingUntil:'2027-06-30',verified:false,picture:true,bio:true,sports:1,availability:1,going:5,film:true,crew:0,helping:1,connections:0};
 assert.deepEqual(earnedBadges(base),['founding','profile','first','regular','film','helper']);
 assert.deepEqual(earnedBadges({...base,joinedOn:'2027-08-01',bio:false,going:1,film:false,helping:0}),['first']);
});
test('targeted notices reach only matching members; reads, pins, unread counts and preview work',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const vb=await join(f,'vollie'),tour=await join(f,'tourie',{town:'Point Lookout',region:'tourist'}),other=await join(f,'otto');
 await profile(f,vb,{sports:['Mixed beach volleyball'],helping:['First aid']});
 await profile(f,tour,{sports:['Beach cricket']});
 await f.call(tour,'/api/member/notifications','POST',{frequency:'never',urgent:true});
 const pv=await f.call('web','/api/committee/announcements','POST',{action:'preview',audience:'all',target:{sports:['Mixed beach volleyball']}});
 assert.equal(pv.reach,1);assert.equal(pv.byFrequency.weekly,1);assert.equal(pv.emailEnabled,false);assert.ok(pv.options.sports.length>5);
 const all=await f.call('web','/api/committee/announcements','POST',{action:'preview',audience:'all',target:{}});assert.equal(all.reach,3);assert.equal(all.byFrequency.never,1);
 const vbNotice=await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Fictional volleyball court change',body:'x',audience:'all',target:{sports:['Mixed beach volleyball'],towns:['Dunwich'],bogus:['x']},publicCalendar:true,eventDate:soon(3)},201);
 assert.equal(vbNotice.reach,1);
 await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Fictional visitors welcome',body:'x',audience:'all',target:{connection:['tourist']}},201);
 const everyone=await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Fictional everyone notice',body:'x',audience:'all'},201);
 assert.equal(everyone.reach,3);
 const titles=async m=>(await f.call(m,'/api/member/announcements')).announcements.map(a=>a.title);
 assert.deepEqual((await titles(vb)).sort(),['Fictional everyone notice','Fictional volleyball court change']);
 assert.deepEqual((await titles(tour)).sort(),['Fictional everyone notice','Fictional visitors welcome']);
 assert.deepEqual(await titles(other),['Fictional everyone notice']);
 assert.ok(!(await f.call(null,'/api/calendar')).events.some(e=>e.title.includes('volleyball court')),'targeted notices never go on the public calendar');
 assert.ok((await f.call(vb,'/api/member/calendar')).events.some(e=>e.title.includes('volleyball court')));
 assert.ok(!(await f.call(other,'/api/member/calendar')).events.some(e=>e.title.includes('volleyball court')));
 assert.equal((await f.call(vb,'/api/member/announcements?unread=1')).unread,2);
 await f.call('web','/api/committee/announcements','POST',{action:'pin',id:everyone.id});
 const list=(await f.call(vb,'/api/member/announcements')).announcements;
 assert.equal(list[0].title,'Fictional everyone notice');assert.equal(list[0].pinned,true);assert.equal(list[0].read,false);assert.equal(list[0].target_json,undefined);
 await f.call(vb,'/api/member/announcements','POST',{action:'read',ids:list.map(a=>a.id)});
 assert.equal((await f.call(vb,'/api/member/announcements?unread=1')).unread,0);
 const desk=(await f.call('web','/api/committee/announcements')).announcements;
 const e1=desk.find(a=>a.id===everyone.id);assert.equal(e1.reach,3);assert.equal(e1.reads,1);assert.equal(e1.pinned,true);
 assert.match(desk.find(a=>a.id===vbNotice.id).targetLabel,/Mixed beach volleyball · Dunwich/);
 assert.equal(desk.find(a=>a.id===vbNotice.id).publicCalendar,false);
 await f.call(vb,'/api/member/announcements','POST',{action:'read',ids:['not-an-id']});
 assert.equal((await f.call('web','/api/committee/announcements','POST',{action:'preview',audience:'all',target:{}})).memberWideThisWeek,1);
});
test('notification preferences, batching and cancellation emails',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const a=await join(f,'alice'),b=await join(f,'bobby'),c=await join(f,'carla');
 const d0=await f.call(a,'/api/member/notifications');assert.equal(d0.frequency,'weekly');assert.equal(d0.urgent,true);assert.equal(d0.emailEnabled,false);
 await f.call(a,'/api/member/notifications','POST',{frequency:'hourly'},400);
 await f.call(b,'/api/member/notifications','POST',{frequency:'never',urgent:true});
 await f.call(c,'/api/member/notifications','POST',{frequency:'instant',urgent:false});
 await f.call('web','/api/member/notifications','GET',undefined,403);
 const ev=await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Fictional sunset social',body:'x',audience:'all',eventDate:soon(4),rsvp:true},201);
 await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Fictional court roster',body:'x',audience:'all'},201);
 assert.equal((await f.call(a,'/api/member/notifications')).waiting,2);
 assert.equal((await f.call(b,'/api/member/notifications')).waiting,0,'never: nothing queued for ordinary notices');
 // No mail provider: the queue is kept, nothing is sent.
 assert.deepEqual(await processNotifications(f.env,Date.now()),{skipped:'email_not_configured'});
 const sent=[];f.env.SANDY_MAIL_FROM='hello@sandy.example';f.env.SANDY_NOTIFY_EMAIL={send:async m=>{sent.push(m)}};
 await f.call(a,'/api/member/announcements','POST',{id:ev.id,response:'going'});
 await f.call(b,'/api/member/announcements','POST',{id:ev.id,response:'going'});
 await f.call(c,'/api/member/announcements','POST',{id:ev.id,response:'maybe'});
 // Carla reads one notice in the app, so it is not emailed.
 const cl=(await f.call(c,'/api/member/announcements')).announcements;await f.call(c,'/api/member/announcements','POST',{action:'read',ids:[cl.find(x=>x.title==='Fictional court roster').id]});
 const r1=await processNotifications(f.env,Date.now()-Date.now()%864e5+23*36e5);// 9am Brisbane today
 assert.equal(r1.sent,2,'alice weekly is due on first send, carla instant');
 const toA=sent.find(m=>m.to==='alice@example.test');assert.match(toA.subject,/2 new things/);assert.match(toA.text,/Fictional sunset social/);assert.match(toA.text,/member-home.html#profile/);
 const toC=sent.find(m=>m.to==='carla@example.test');assert.doesNotMatch(toC.text,/court roster/);
 sent.length=0;
 const down=await f.call('web','/api/committee/announcements','POST',{action:'archive',id:ev.id});
 assert.equal(down.told,3);
 const r2=await processNotifications(f.env,Date.now()-Date.now()%864e5+23.5*36e5);// 9:30am, half an hour later
 const subj=Object.fromEntries(sent.map(m=>[m.to,m.subject]));
 assert.match(subj['alice@example.test'],/Cancelled: Fictional sunset social/,'urgent goes out even though weekly was used');
 assert.match(subj['bobby@example.test'],/Cancelled/,'never still hears about cancellations they asked for');
 assert.equal(subj['carla@example.test'],undefined,'carla turned urgent off and her instant hour has not passed');
 assert.equal(r2.sent,2);
 // Quiet hours: nothing at 10pm Brisbane.
 sent.length=0;await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Fictional late notice',body:'x',audience:'all'},201);
 assert.equal((await processNotifications(f.env,Date.now()-Date.now()%864e5+12*36e5)).sent,0);
});
test('scheduled job runs the batch every 15 minutes',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 const worker=(await import('../worker/index.mjs')).default,waits=[];
 await worker.scheduled({scheduledTime:Date.now(),cron:'*/15 * * * *'},f.env,{waitUntil:p=>waits.push(p)});
 const out=await Promise.all(waits);assert.deepEqual(out[0],{skipped:'email_not_configured'});
 assert.equal(matches({film:false,verified:true,sports:[],helping:[],town:'',region:''},'film',{}),false);
});
