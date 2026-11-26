// MEM-08 member calendar: only explicitly released events reach members; personal
// replies persist privately; withdrawal or change shows an in-app update and an
// ICS cancellation. Fictional fixture only, no email or external calendar push.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {fixture,ROLE_ACTORS} from './d1-fixture.mjs';
const EVIDENCE='https://example.test/fictional-minute';
const fields=(date='2027-02-14')=>{const f={};for(const x of SUITE_BY_KEY.events.fields)f[x.key]=x.type==='checkbox'?false:x.type==='select'?x.options[0]:x.type==='date'?date:x.type==='time'?(x.key==='endTime'?'11:00':'09:00'):x.type==='number'?1:x.type==='url'?'':'Fictional Cylinder Beach example';return f};

test('released events, private replies, change and withdrawal notices, ICS feed',async t=>{
 const {call,request,env,active,verifyAdult,count}=fixture(t,{actors:[...ROLE_ACTORS,['member3','member']]});
 const ev=await call('sec','/api/suite/events','POST',{title:'Fictional sunset volleyball',fields:fields()},201),path='/api/suite/events/'+ev.id;
 // Before establishment nothing is available to members.
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'going'},409);
 env.SANDY_CLUB_APPROVALS='enabled';
 for(const m of ['member','member2','member3'])active(m);
 await verifyAdult('member');await verifyAdult('member2');
 await call('member3','/api/member/rsvp','POST',{eventId:ev.id,response:'going'},403); // unverified participation
 await call('pres',path+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE});
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'going'},404); // approved, not released
 await call('sec',path+'/decision','POST',{version:2,decision:'release',evidence:EVIDENCE});
 let ws=await call('member','/api/member/workspace');
 assert.deepEqual(ws.events.map(e=>[e.id,e.myRsvp]),[[ev.id,null]]);
 const first=await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'going'},201);
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'going',version:0},409);
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'maybe',version:1});
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'going',version:1},409);
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'sure'},400);
 // Concurrent first replies from another member create exactly one record.
 const pair=await Promise.all([1,2].map(()=>request('member2','/api/member/rsvp','POST',{eventId:ev.id,response:'going'})));
 assert.deepEqual(pair.map(r=>r.status).sort(),[201,409]);
 ws=await call('member','/api/member/workspace');
 assert.equal(ws.events[0].myRsvp,'maybe');assert.equal(ws.eventUpdates.length,0);
 // Organisers see totals only; no office sees individual replies through any register.
 assert.deepEqual((await call('sec',path)).record.rsvpTotals,{going:1,maybe:1,not_going:0});
 for(const who of ['web','sec','pres','other','treasurer']){
  assert.ok(!(await call(who,'/api/records?kind=safeguard')).records.some(r=>r.id===first.id));
  await call(who,'/api/records/'+first.id,'GET',undefined,404);
 }
 assert.ok(!(await call('web','/api/audit')).audit.some(a=>a.resourceId===first.id));
 assert.ok(!JSON.stringify(await call('member2','/api/member/data-export')).includes(first.id));
 assert.equal((await call('member','/api/member/data-export')).eventReplies[0].fields.response,'maybe');
 // Calendar feed lists the released event with its version as sequence.
 let ics=await (await request('member','/api/member/calendar.ics')).text();
 assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,new RegExp('UID:'+ev.id+'@sandy-sports-club'));
 assert.match(ics,/DTSTART;VALUE=DATE:20270214/);assert.match(ics,/SEQUENCE:3/);assert.match(ics,/STATUS:CONFIRMED/);
 assert.equal((await request('other','/api/member/calendar.ics')).status,403);
 assert.equal((await request(null,'/api/member/calendar.ics')).status,401);
 // Withdrawal: event leaves the feed, member sees an in-app notice and an ICS cancellation.
 await call('sec',path+'/decision','POST',{version:3,decision:'returned',evidence:EVIDENCE,reason:'Fictional weather cancellation'});
 ws=await call('member','/api/member/workspace');
 assert.equal(ws.events.length,0);assert.deepEqual(ws.eventUpdates.map(u=>[u.eventId,u.change]),[[ev.id,'withdrawn']]);
 ics=await (await request('member','/api/member/calendar.ics')).text();
 assert.match(ics,/STATUS:CANCELLED/);assert.doesNotMatch(ics,/STATUS:CONFIRMED/);
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'going',version:2},404);
 // Change: a revised date re-approved and re-released is flagged as updated until re-confirmed.
 await call('sec',path,'PATCH',{version:4,title:'Fictional sunset volleyball',fields:fields('2027-02-21')});
 await call('pres',path+'/decision','POST',{version:5,decision:'approved',evidence:EVIDENCE});
 await call('sec',path+'/decision','POST',{version:6,decision:'release',evidence:EVIDENCE});
 ws=await call('member','/api/member/workspace');
 assert.deepEqual(ws.eventUpdates.map(u=>[u.change,u.previousDate,u.date]),[['updated','2027-02-14','2027-02-21']]);
 await call('member','/api/member/rsvp','POST',{eventId:ev.id,response:'going',version:2});
 ws=await call('member','/api/member/workspace');
 assert.equal(ws.eventUpdates.length,0);assert.equal(ws.events[0].myRsvp,'going');
 assert.equal(count('club_records',"json_extract(body_json,'$.type')='rsvp'"),2);
});
