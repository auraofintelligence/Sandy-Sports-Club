// Webmaster announcements and come-and-try events with member RSVPs, including Film Club-only notices.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
async function join(f,username){
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional '+username,email:username+'@example.test',town:'Dunwich',audienceRegion:'local',
  username,password:'sandy77',adult:true,contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob:'1990-06-15'});
 assert.equal(res.status,201);return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
test('webmaster posts, members see and RSVP, film-only notices reach Film Club members only',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['sec','secretary'],['other','committee']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const ana=await join(f,'ana'),ben=await join(f,'ben');
 await f.call(ben,'/api/member/profile','POST',{version:0,bio:'',sports:[],skillLevel:'',availability:[],filmMember:true,crewSkills:['Camera'],helping:[],directoryVisible:false,showTown:false,shareContact:false});
 await f.call('other','/api/committee/announcements','POST',{action:'create',title:'Nope'},403);
 await f.call('sec','/api/committee/announcements','POST',{action:'create',title:'From the secretary'},201);
 await f.call(ana,'/api/committee/announcements','POST',{action:'create',title:'Nope'},403);
 const day=await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Come and try volleyball',body:'Bring a hat.',eventDate:'2099-12-13',eventTime:'4pm',location:'Cylinder Beach',rsvp:true},201);
 await f.call('web','/api/committee/announcements','POST',{action:'create',title:'Film Club edit night',audience:'film'},201);
 assert.deepEqual((await f.call(ana,'/api/member/announcements')).announcements.map(a=>a.title).sort(),['Come and try volleyball','From the secretary']);
 assert.equal((await f.call(ben,'/api/member/announcements')).announcements.length,3);
 await f.call(ana,'/api/member/announcements','POST',{id:day.id,response:'going',children:2});
 await f.call(ben,'/api/member/announcements','POST',{id:day.id,response:'maybe',children:3});
 await f.call(ana,'/api/member/announcements','POST',{id:day.id,response:'party'},400);
 const list=(await f.call('web','/api/committee/announcements')).announcements.find(a=>a.id===day.id);
 assert.deepEqual(list.counts,{going:1,maybe:1,notGoing:0,children:2});
 const rsvps=await f.call('web','/api/committee/announcements?rsvps='+day.id);
 assert.equal(rsvps.rsvps.length,2);assert.ok(rsvps.rsvps.some(r=>r.username==='ana'&&r.children===2));
 assert.equal((await f.call(ana,'/api/member/announcements')).announcements.find(a=>a.id===day.id).myResponse,'going');
 await f.call('web','/api/committee/announcements','POST',{action:'archive',id:day.id});
 assert.equal((await f.call(ana,'/api/member/announcements')).announcements.length,1);
});
