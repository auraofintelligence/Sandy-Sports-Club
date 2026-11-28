// Wishes go from members to the committee; members can edit their own details.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
test('member sends a wish, committee reviews it, member sees the status; details editable',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['other','committee']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional Wisher',email:'wish@example.test',town:'Amity Point',audienceRegion:'local',username:'fictional.wisher',password:'sandy77',contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'male',dob:'1980-01-01'});
 const ana=(res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
 await f.call(null,'/api/requests','POST',{title:'Beach volleyball net'},401);
 await f.call(ana,'/api/requests','POST',{title:'Net',purpose:'x',category:'Toys',priority:'Research'},400);
 await f.call(ana,'/api/requests','POST',{title:'Spare volleyball net',purpose:'A second court for juniors',category:'Sport',priority:'First programme',nextStep:'Get a quote'},201);
 await f.call(ana,'/api/committee/requests',undefined,undefined,403);
 const list=await f.call('other','/api/committee/requests');
 assert.equal(list.counts.new,1);assert.equal(list.requests[0].from.username,'fictional.wisher');
 await f.call('other','/api/committee/requests','POST',{id:list.requests[0].id,status:'planned',note:'On the summer kit list'});
 const mine=(await f.call(ana,'/api/requests')).requests[0];assert.equal(mine.status,'planned');assert.equal(mine.note,'On the summer kit list');
 assert.equal((await f.call('web','/api/committee/requests?status=new')).requests.length,0);
 await f.call(ana,'/api/member/details','POST',{preferredName:'Wish',town:'Point Lookout',audienceRegion:'local',mobile:'',contactConsent:false});
 const d=(await f.call(ana,'/api/member/profile')).details;assert.equal(d.town,'Point Lookout');assert.equal(d.contactConsent,false);
});
