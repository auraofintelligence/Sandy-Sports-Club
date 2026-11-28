// Committee onboarding end to end: Webmaster reserves officers, prepares private invite links, officers
// activate and sign in, then work across accounts (notices, members, blue ticks, announcements, children by role).
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const tokenOf=res=>(res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)?.[1];
async function officer(f,username,role){
 const made=await f.call('web','/api/accounts','POST',{username,role,office:role,displayName:'Fictional '+role},201);
 const id=made.id||made.account?.id||(await f.call('web','/api/accounts')).accounts.find(a=>a.username===username).id;
 const invite=await f.call('web','/api/accounts/'+id+'/invite','POST',{manual:true},201);
 await f.call(null,'/api/auth/activate','POST',{token:invite.token,password:'sandy-'+role},200);
 const res=await f.request(null,'/api/auth/login','POST',{username,password:'sandy-'+role});
 assert.equal(res.status,200);return tokenOf(res);
}
test('officers are invited, activate, sign in and work across accounts',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';f.env.SANDY_INVITES_ENABLED='enabled';
 const sec=await officer(f,'fictional.secretary','secretary'),tre=await officer(f,'fictional.treasurer','treasurer'),gen=await officer(f,'fictional.committee','committee');
 assert.equal((await f.call(sec,'/api/session')).identity.role,'secretary');
 // A founding member joins and adds a child.
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional Parent',email:'parent@example.test',town:'Dunwich',audienceRegion:'local',username:'fictional.parent',password:'sandy77',contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob:'1988-04-02'});
 const mum=tokenOf(res);await f.call(mum,'/api/member/picture','POST',{avatarId:'angler-03'});
 await f.call(mum,'/api/member/family','POST',{action:'add',fullName:'Fictional Kid',dob:'2017-09-09',gender:'male',avatarId:'angler-14',relationship:'parent',interests:[],guardianDeclaration:true},201);
 // Notices travel between officers.
 const today=(await f.call(sec,'/api/committee/notices')).today;
 await f.call(sec,'/api/committee/notices','POST',{action:'post',id:crypto.randomUUID(),kind:'info',title:'Fictional come and try roster',details:'Who can run the net?',scope:'all',important:false,reviewDate:today});
 assert.equal((await f.call(tre,'/api/committee/notices')).notices.length,1);
 assert.equal((await f.call(gen,'/api/committee/notices')).notices.length,1);
 // Membership officers see members; children stay with safeguarding officers.
 assert.equal((await f.call(tre,'/api/committee/member-profiles')).members.length,1);
 await f.call(gen,'/api/committee/member-profiles',undefined,undefined,403);
 assert.equal((await f.call(sec,'/api/committee/families')).children.length,1);
 await f.call(tre,'/api/committee/families',undefined,undefined,403);
 // Any committee account can give a blue tick in person; officers can post announcements to members.
 const parentId=(await f.call(gen,'/api/committee/verify-id')).members[0].accountId;
 await f.call(gen,'/api/committee/verify-id','POST',{action:'verify',accountId:parentId,idType:'Driver licence',dob:'1988-04-02',sighted:true});
 assert.equal((await f.call(mum,'/api/member/profile')).profile.verified,true);
 await f.call(sec,'/api/committee/announcements','POST',{action:'create',title:'Fictional AGM date'},201);
 assert.equal((await f.call(mum,'/api/member/announcements')).announcements.length,1);
 // Members cannot reach committee tools.
 await f.call(mum,'/api/committee/notices',undefined,undefined,403);
 await f.call(mum,'/api/committee/verify-id',undefined,undefined,403);
});
