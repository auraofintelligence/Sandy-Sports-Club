// Free founding membership: instant adult join, members area opens, login failure limit, 7+ character passwords.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const person=(extra={})=>({fullName:'Fictional Founder',preferredName:'Fin',email:'founder@example.test',mobile:'',town:'Point Lookout',audienceRegion:'local',
 username:'fictional.founder',password:'sandy77',adult:true,contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob:'1990-06-15',...extra});
const tokenOf=res=>(res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)?.[1];
test('joining is closed unless founding membership is enabled',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 assert.equal((await f.call(null,'/api/join')).open,false);
 await f.call(null,'/api/join','POST',person(),503);
 assert.equal((await f.call(null,'/api/public-config')).joinReady,false);
});
test('an adult joins instantly, is signed in and the members area is open',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 assert.equal((await f.call(null,'/api/public-config')).joinReady,true);
 const res=await f.request(null,'/api/join','POST',person());
 assert.equal(res.status,201,await res.clone().text());
 const token=tokenOf(res);assert.ok(token,'session cookie issued');
 const ws=await f.call(token,'/api/member/workspace');
 assert.equal(ws.enrolled,true);assert.equal(ws.active,true);
 assert.equal(ws.safeguards.ageBand,'adult');assert.equal(ws.safeguards.optionalParticipation,true);
 assert.equal(ws.profile.membership_class,'founding');assert.equal(ws.profile.status,'active');
 const me=await f.call(token,'/api/member/me');assert.equal(me.profile.contactConsent,true);
 const people=await f.call('web','/api/people');
 assert.ok(JSON.stringify(people).includes('Fictional Founder'),'webmaster sees the new member');
 assert.equal(f.count('club_audit',"action='founding_member_joined'"),1);
});
test('join validation: duplicates, minors, short passwords, terms, honeypot',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 await f.call(null,'/api/join','POST',person({password:'sandy6'}),400);
 await f.call(null,'/api/join','POST',person({gender:'prefer-not'}),400);
 await f.call(null,'/api/join','POST',person({dob:'1990-02-30'}),400);
 await f.call(null,'/api/join','POST',person({dob:new Date(Date.now()+10*3600000-17*365.25*86400000).toISOString().slice(0,10)}),400);
 await f.call(null,'/api/join','POST',person({gender:'non-binary',username:'nb.member',email:'nb@example.test'}),201);
 assert.equal(f.count('club_people',"gender='non-binary'"),1);
 await f.call(null,'/api/join','POST',person({termsAccepted:false}),400);
 await f.call(null,'/api/join','POST',person({website:'spam'}),201);
 assert.equal(f.count('club_accounts',"role='member'"),1);
 await f.call(null,'/api/join','POST',person(),201);
 await f.call(null,'/api/join','POST',person({email:'other@example.test'}),409);
 assert.equal(f.count('club_accounts',"role='member'"),2);
});
test('three failed sign-ins lock that account on that connection for 15 minutes; successes do not count',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 await f.call(null,'/api/join','POST',person(),201);
 for(let i=0;i<4;i++)await f.call(null,'/api/auth/login','POST',{username:'fictional.founder',password:'sandy77'},200);
 for(let i=0;i<3;i++)await f.call(null,'/api/auth/login','POST',{username:'fictional.founder',password:'wrong-one'},401);
 await f.call(null,'/api/auth/login','POST',{username:'fictional.founder',password:'sandy77'},429);
});
test('joining checks Turnstile when it is configured',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';f.env.SANDY_TURNSTILE_SECRET='x';f.env.SANDY_TURNSTILE_SITE_KEY='y';
 const realFetch=globalThis.fetch;let verdict=false;globalThis.fetch=async()=>new Response(JSON.stringify({success:verdict}));t.after(()=>{globalThis.fetch=realFetch});
 await f.call(null,'/api/join','POST',person({turnstileToken:'bad'}),403);
 verdict=true;await f.call(null,'/api/join','POST',person({turnstileToken:'good'}),201);
 assert.equal((await f.call(null,'/api/public-config')).turnstileSiteKey,'y');
});
