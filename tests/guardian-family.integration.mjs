// Guardian gateway: an adult member registers children; only they and the Webmaster can see them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const adult=(username,extra={})=>({fullName:'Fictional '+username,email:username+'@example.test',town:'Dunwich',audienceRegion:'local',
 username,password:'sandy77',adult:true,contactConsent:false,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',ageGroup:'30-49',...extra});
async function join(f,username){
 const res=await f.request(null,'/api/join','POST',adult(username));assert.equal(res.status,201);
 return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
const kid=(extra={})=>({action:'add',fullName:'Fictional Junior',preferredName:'Juni',ageBand:'under16',relationship:'parent',interests:['Mixed beach volleyball'],photoPermission:false,guardianDeclaration:true,gender:'male',avatarId:'sandy-05',...extra});
test('guardian adds, updates and removes a child; other members and officers without Webmaster cannot see it',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['sec','secretary']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const mum=await join(f,'fictional.mum'),other=await join(f,'fictional.other');
 await f.call(mum,'/api/member/family','POST',kid({guardianDeclaration:false}),400);
 await f.call(mum,'/api/member/family','POST',kid({ageBand:'adult'}),400);
 await f.call(mum,'/api/member/family','POST',kid({avatarId:''}),400);
 await f.call(mum,'/api/member/family','POST',kid({gender:'other'}),400);
 const added=await f.call(mum,'/api/member/family','POST',kid(),201);
 assert.equal(added.children.length,1);assert.equal(added.children[0].ageBand,'under16');assert.equal(added.children[0].photoPermission,false);
 assert.equal(f.count('club_people',"membership_class='youth' AND account_id IS NULL"),1);
 assert.equal((await f.call(other,'/api/member/family')).children.length,0);
 const child=added.children[0];
 await f.call(other,'/api/member/family','POST',{action:'remove',id:child.id,version:child.version},404);
 await f.call('sec','/api/committee/families',undefined,undefined,403);
 const all=await f.call('web','/api/committee/families');
 assert.equal(all.children.length,1);assert.equal(all.children[0].guardian.username,'fictional.mum');
 const updated=await f.call(mum,'/api/member/family','POST',{action:'update',id:child.id,version:child.version,photoPermission:true,ageBand:'16-17'});
 assert.equal(updated.children[0].photoPermission,true);assert.equal(updated.children[0].ageBand,'16-17');
 await f.call(mum,'/api/member/family','POST',{action:'update',id:child.id,version:child.version,photoPermission:false},409);
 const removed=await f.call(mum,'/api/member/family','POST',{action:'remove',id:child.id,version:updated.children[0].version});
 assert.equal(removed.children.length,0);
 assert.equal(f.count('club_people',"status='withdrawn'"),1);
});
test('family registration needs an active adult member account',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['member','member']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 await f.call(null,'/api/member/family','GET',undefined,401);
 await f.call('member','/api/member/family','GET',undefined,409);
});
