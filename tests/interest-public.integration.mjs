// Public expression of interest works without Turnstile: honeypot and per-connection rate limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const lead=(extra={})=>({firstName:'Fictional',email:'fictional@example.test',town:'Amity Point',audienceRegion:'local',interests:['volleyball'],comments:'',contactConsent:true,source:'test',...extra});
test('public config reports interest ready without Turnstile',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 const config=await f.call(null,'/api/public-config');
 assert.equal(config.publicInterestReady,true);assert.equal(config.turnstileSiteKey,null);
});
test('interest saves, honeypot is silently dropped, consent required, rate limited',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 await f.call(null,'/api/interest','POST',lead(),201);
 assert.equal(f.count('club_interest'),1);
 await f.call(null,'/api/interest','POST',lead({website:'http://spam.test'}),201);
 assert.equal(f.count('club_interest'),1);
 await f.call(null,'/api/interest','POST',lead({contactConsent:false}),400);
 for(let i=0;i<7;i++)await f.call(null,'/api/interest','POST',lead(),201);
 await f.call(null,'/api/interest','POST',lead(),429);
 const list=await f.call('web','/api/interest');
 assert.equal(list.interests.length,8);
});
test('Turnstile is still enforced when configured',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 f.env.SANDY_TURNSTILE_SECRET='x';f.env.SANDY_TURNSTILE_SITE_KEY='y';
 const realFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({success:false}));t.after(()=>{globalThis.fetch=realFetch});
 await f.call(null,'/api/interest','POST',lead(),403);
});
