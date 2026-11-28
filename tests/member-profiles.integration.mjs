// Member profiles, opt-in directory, Film Club filter, mutual connections, blocking and contact sharing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
async function join(f,username){
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional '+username,preferredName:username,email:username+'@example.test',mobile:'0400 000 000',town:'Amity Point',audienceRegion:'local',
  username,password:'sandy77',adult:true,contactConsent:false,termsAccepted:true,termsVersion:'sandy-participation-v1'});
 assert.equal(res.status,201);return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
const profile=(extra={})=>({version:0,bio:'Keen on sunset volleyball',sports:['Mixed beach volleyball','Not a sport'],skillLevel:'social',availability:['Weekend morning'],
 filmMember:false,crewSkills:[],helping:['Setting up courts'],directoryVisible:true,showTown:true,shareContact:true,...extra});
test('profiles, directory, film filter, connections, contact sharing and blocking',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const ana=await join(f,'ana'),ben=await join(f,'ben'),cat=await join(f,'cat');
 const blank=await f.call(ana,'/api/member/profile');assert.equal(blank.profile.version,0);assert.ok(blank.options.crew.includes('Camera'));
 const saved=await f.call(ana,'/api/member/profile','POST',profile());
 assert.deepEqual(saved.profile.sports,['Mixed beach volleyball']);
 await f.call(ana,'/api/member/profile','POST',profile(),409);
 await f.call(ben,'/api/member/profile','POST',profile({filmMember:true,crewSkills:['Camera','Editing'],showTown:false}));
 await f.call(cat,'/api/member/profile','POST',profile({directoryVisible:false}));
 const dir=await f.call(ana,'/api/member/directory');
 assert.deepEqual(dir.members.map(m=>m.name),['ben']);
 assert.equal(dir.members[0].town,'');assert.equal(dir.members[0].contact,undefined);
 assert.equal((await f.call(ana,'/api/member/directory?film=1')).members.length,1);
 assert.equal((await f.call(ben,'/api/member/directory?film=1')).members.length,0);
 const benId=dir.members[0].accountId,anaId=(await f.call(ben,'/api/member/directory')).members[0].accountId;
 await f.call(cat,'/api/member/connections','POST',{action:'request',accountId:benId},409);
 await f.call(ana,'/api/member/connections','POST',{action:'request',accountId:benId},201);
 assert.equal((await f.call(ben,'/api/member/directory')).incoming,1);
 await f.call(ana,'/api/member/connections','POST',{action:'accept',accountId:benId},409);
 await f.call(ben,'/api/member/connections','POST',{action:'accept',accountId:anaId});
 const connected=(await f.call(ana,'/api/member/directory')).members[0];
 assert.equal(connected.connection,'connected');assert.equal(connected.contact.email,'ben@example.test');
 await f.call(ben,'/api/member/connections','POST',{action:'block',accountId:anaId});
 assert.equal((await f.call(ana,'/api/member/directory')).members.length,0);
 await f.call(ana,'/api/member/connections','POST',{action:'request',accountId:benId},404);
 await f.call(ana,'/api/member/connections','POST',{action:'unblock',accountId:benId},404);
 await f.call(ben,'/api/member/connections','POST',{action:'unblock',accountId:anaId});
 assert.equal((await f.call(ana,'/api/member/directory')).members[0].connection,'none');
 const all=await f.call('web','/api/committee/member-profiles');
 assert.equal(all.members.length,3);assert.ok(all.members.some(m=>m.username==='cat'&&m.profile.directoryVisible===false));
 await f.call(ana,'/api/committee/member-profiles',undefined,undefined,403);
});
