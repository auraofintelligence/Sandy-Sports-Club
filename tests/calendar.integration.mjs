import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
import {parseTimes} from '../worker/calendar.mjs';
async function join(f,username){
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional '+username,email:username+'@example.test',town:'Dunwich',audienceRegion:'local',
  username,password:'sandy77',adult:true,contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob:'1990-06-15'});
 assert.equal(res.status,201);return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
const soon=n=>new Date(Date.now()+36e6+n*864e5).toISOString().slice(0,10);
test('event times in plain words become calendar times',()=>{
 assert.deepEqual(parseTimes('5pm to 7pm'),{start:'17:00',end:'19:00'});
 assert.deepEqual(parseTimes('7:30pm'),{start:'19:30',end:''});
 assert.deepEqual(parseTimes('Sunset'),{start:'',end:''});
});
test('public calendar shows tickets and public announcements only; members see their own events and reply',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';const mem=await join(f,'cally');
 for(const [title,audience,pub] of [['Fictional public beach social','all',true],['Fictional members BBQ','all',false],['Fictional film crew night','film',false]])
  await f.call('web','/api/committee/announcements','POST',{action:'create',title,body:'Fictional details',audience,eventDate:soon(5),eventTime:'5pm to 7pm',location:'Fictional Amity',rsvp:true,publicCalendar:pub},201);
 await f.call('web','/api/committee/store/products','POST',{product:{sku:'TIX-FICTIONAL',name:'Fictional ticketed social',kind:'ticket',status:'active',price:'10',event_date:soon(9),event_time:'5pm',variants:'Adult@10:20'}},201);
 const pub=(await f.call(null,'/api/calendar')).events.map(e=>e.title);
 assert.ok(pub.includes('Fictional public beach social'));assert.ok(!pub.includes('Fictional members BBQ'));assert.ok(!pub.includes('Fictional film crew night'));
 assert.ok(pub.includes('Fictional ticketed social'),'ticketed store events are public');
 const ics=await (await f.request(null,'/api/calendar.ics')).text();
 assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/X-WR-CALNAME:Sandy Sports Straddie/);assert.match(ics,/DTSTART;TZID=Australia\/Brisbane:\d{8}T170000/);assert.doesNotMatch(ics,/members BBQ/);
 const mine=(await f.call(mem,'/api/member/calendar')).events;
 const bbq=mine.find(e=>e.title==='Fictional members BBQ');assert.ok(bbq&&bbq.rsvp);assert.ok(!mine.some(e=>e.title==='Fictional film crew night'),'film night is for Film Club members');
 await f.call(mem,'/api/member/announcements','POST',{id:bbq.announcementId,response:'going',children:1});
 assert.equal((await f.call(mem,'/api/member/calendar')).events.find(e=>e.title==='Fictional members BBQ').myResponse,'going');
 assert.match(await (await f.request(mem,'/api/member/club-calendar.ics')).text(),/Fictional members BBQ/);
 await f.call(null,'/api/member/calendar','GET',undefined,401);
});
