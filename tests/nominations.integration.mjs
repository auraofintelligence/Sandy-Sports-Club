// Join form nominations, spam quarantine, owner alerts and the daily digest.
// Fictional people only; Turnstile and the mail provider are mocked. Nothing is sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import worker from '../worker/index.mjs';
import {fixture} from './d1-fixture.mjs';
import {LIMITS,dailyDigest} from '../worker/nominations.mjs';
import {mimeMessage,mailConfigured} from '../worker/mailer.mjs';

const realFetch=globalThis.fetch;
function mockNetwork(t){
 const mail=[],turnstile=[];
 globalThis.fetch=async(url,init={})=>{
  const u=String(url);
  if(u.startsWith('https://challenges.cloudflare.com/')){const token=new URLSearchParams(init.body).get('response');turnstile.push(token);return new Response(JSON.stringify({success:token==='pass-fictional'}))}
  if(u==='https://api.resend.com/emails'){mail.push(JSON.parse(init.body));return new Response('{"id":"fictional"}',{status:200})}
  throw new Error('Unexpected network call in test: '+u);
 };
 t.after(()=>{globalThis.fetch=realFetch});
 return {mail,turnstile};
}
function switchOn(env){
 Object.assign(env,{SANDY_NOMINATIONS_ENABLED:'enabled',SANDY_TURNSTILE_SECRET:'fictional-secret',SANDY_TURNSTILE_SITE_KEY:'fictional-site-key',
  SANDY_MAIL_PROVIDER:'resend',SANDY_RESEND_API_KEY:'re_fictional_test_key',SANDY_MAIL_FROM:'alerts@sandy.test',SANDY_PUBLIC_ORIGIN:'https://sandy.test'});
}
const person=(n=1,extra={})=>({submissionId:randomUUID(),name:'Fictional Nominee '+n,email:'nominee'+n+'@example.test',town:'Dunwich (Goompi)',
 pathway:'Committee nomination',interests:'Beach volleyball',offer:'Fictional event skills',consent:true,recordingConsent:true,website:'',turnstileToken:'pass-fictional',...extra});
const ip=n=>({'cf-connecting-ip':'203.0.113.'+n,'user-agent':'FictionalBrowser/1.0'});

test('switched off by default: no storage, no mail, form stays on email fallback',async t=>{
 const f=fixture(t,{nominations:true}),net=mockNetwork(t);
 const cfg=await f.call(null,'/api/nominate');
 assert.equal(cfg.open,false);assert.equal(cfg.siteKey,null);
 assert.equal((await f.request(null,'/api/nominate','POST',person())).status,503);
 assert.equal(f.count('club_nominations'),0);assert.equal(f.count('club_spam_quarantine'),0);assert.equal(net.mail.length,0);
 const pub=await f.call(null,'/api/public-config');assert.equal(pub.publicNominationsReady,false);
 assert.deepEqual(await dailyDigest(f.env),{skipped:'switched_off'});
});

test('genuine nomination goes to the private register and alerts the owner without contact details',async t=>{
 const f=fixture(t,{nominations:true}),net=mockNetwork(t);switchOn(f.env);
 const cfg=await f.call(null,'/api/nominate');assert.equal(cfg.open,true);assert.equal(cfg.siteKey,'fictional-site-key');
 const body=person(1);
 const res=await f.request(null,'/api/nominate','POST',body,'https://sandy.test',ip(1));
 assert.equal(res.status,202);assert.match((await res.json()).notice,/Thanks, we've got it/);
 assert.equal(f.count('club_people',"email='nominee1@example.test' AND status='interested' AND consent_contact=1"),1);
 assert.equal(f.count('club_nominations',"alert_state='sent' AND origin='form'"),1);
 assert.equal(f.count('club_nominations',"recording_consent_utc IS NOT NULL"),1,'standing for office records agreement to meeting recording (rule 4B)');
 assert.equal(net.mail.length,1);
 const m=net.mail[0];
 assert.deepEqual(m.to,['sbt4183@gmail.com']);
 assert.equal(m.subject,'New nomination: Committee nomination, Dunwich (Goompi)');
 assert.match(m.text,/https:\/\/sandy\.test\/club-admin\.html#nominations\/nomination\/[a-f0-9-]{36}/);
 for(const secret of ['Fictional Nominee','nominee1@example.test','Fictional event skills','203.0.113'])assert.ok(!m.text.includes(secret)&&!m.subject.includes(secret),'alert leaked '+secret);
 // A retry of the same submission adds nothing and sends nothing.
 assert.equal((await f.request(null,'/api/nominate','POST',body,'https://sandy.test',ip(1))).status,202);
 assert.equal(f.count('club_nominations'),1);assert.equal(net.mail.length,1);
 // Invalid fields are told to the visitor, not stored or quarantined.
 assert.equal((await f.request(null,'/api/nominate','POST',person(2,{email:'not-an-email'}),'https://sandy.test',ip(2))).status,400);
 assert.equal(f.count('club_spam_quarantine'),0);
 // The stored IP is a keyed hash, never the address itself.
 const row=f.sql.prepare('SELECT ip_hash FROM club_nominations').get();assert.match(row.ip_hash,/^[a-f0-9]{24}$/);
});

test('spam is quarantined with its reason, never silently dropped and never alerted',async t=>{
 const f=fixture(t,{nominations:true}),net=mockNetwork(t);switchOn(f.env);
 assert.equal((await f.request(null,'/api/nominate','POST',person(1,{website:'http://spam.example'}),'https://sandy.test',ip(1))).status,202);
 assert.equal((await f.request(null,'/api/nominate','POST',person(2,{turnstileToken:'bot'}),'https://sandy.test',ip(2))).status,403);
 assert.equal((await f.request(null,'/api/nominate','POST',person(3),'https://evil.example',ip(3))).status,403);
 const bad=await worker.fetch(new Request('https://sandy.test/api/nominate',{method:'POST',headers:{Origin:'https://sandy.test','Content-Type':'application/json',...ip(4)},body:'{not json'}),f.env);
 assert.equal(bad.status,400);
 const big=await worker.fetch(new Request('https://sandy.test/api/nominate',{method:'POST',headers:{Origin:'https://sandy.test','Content-Type':'application/json',...ip(4)},body:JSON.stringify({...person(4),offer:'x'.repeat(20000)})}),f.env);
 assert.equal(big.status,400);
 const reasons=f.sql.prepare('SELECT reason,user_agent,ip_hash,expires_utc,created_utc FROM club_spam_quarantine ORDER BY created_utc').all();
 assert.deepEqual(reasons.map(r=>r.reason).sort(),['cross_origin','honeypot','malformed','malformed','turnstile_failed']);
 for(const r of reasons){assert.equal(r.user_agent,'FictionalBrowser/1.0');assert.ok(!r.ip_hash.includes('203.0.113'));
  const days=(Date.parse(r.expires_utc)-Date.parse(r.created_utc))/864e5;assert.equal(Math.round(days),90)}
 assert.equal(f.count('club_nominations'),0);assert.equal(f.count('club_people'),0);
 assert.equal(net.mail.length,0,'no instant alert for spam');
});

test('rate limits quarantine floods, and the storage cap only counts overflow',async t=>{
 const f=fixture(t,{nominations:true}),net=mockNetwork(t);switchOn(f.env);
 for(let i=1;i<=LIMITS.perSourcePerHour+1;i++)assert.equal((await f.request(null,'/api/nominate','POST',person(i),'https://sandy.test',ip(9))).status,202);
 assert.equal(f.count('club_nominations'),LIMITS.perSourcePerHour);
 assert.equal(f.count('club_spam_quarantine',"reason='rate_limited'"),1);
 assert.equal(net.mail.length,LIMITS.perSourcePerHour);
 const cap=LIMITS.quarantinePerHour;LIMITS.quarantinePerHour=3;t.after(()=>{LIMITS.quarantinePerHour=cap});
 for(let i=0;i<6;i++)await f.request(null,'/api/nominate','POST',person(50+i,{website:'bot'}),'https://sandy.test',ip(50));
 assert.equal(f.count('club_spam_quarantine'),3,'storage capped per hour');
 assert.equal(f.sql.prepare('SELECT SUM(dropped) AS n FROM club_spam_overflow').get().n,4);
});

test('officer-only Spam caught view: Mark as genuine moves to the register and alerts; Delete removes',async t=>{
 const f=fixture(t,{nominations:true}),net=mockNetwork(t);switchOn(f.env);
 await f.request(null,'/api/nominate','POST',person(7,{turnstileToken:'bot'}),'https://sandy.test',ip(7));
 await f.request(null,'/api/nominate','POST',person(8,{website:'bot'}),'https://sandy.test',ip(8));
 for(const who of ['pres','vp','treasurer','other','member','demo'])assert.equal(await f.statusOf(who,'/api/committee/spam'),403,who);
 assert.equal(await f.statusOf('asst','/api/committee/spam'),200,'the Assistant Secretary holds the Secretary’s access');
 assert.equal(await f.statusOf(null,'/api/committee/spam'),401);
 const list=await f.call('sec','/api/committee/spam');
 assert.equal(list.items.length,2);assert.equal(list.retentionDays,90);
 const turn=list.items.find(x=>x.reason==='turnstile_failed'),honey=list.items.find(x=>x.reason==='honeypot');
 assert.equal(turn.reasonLabel,'Failed the Turnstile check');assert.equal(turn.email,'nominee7@example.test');
 const out=await f.call('web','/api/committee/spam/'+turn.id,'POST',{action:'genuine'});
 assert.equal(out.alert,'sent');
 assert.equal(f.count('club_nominations',"origin='released_from_spam'"),1);
 assert.equal(f.count('club_people',"email='nominee7@example.test'"),1);
 assert.equal(net.mail.length,1);assert.ok(!net.mail[0].text.includes('nominee7'));
 await f.call('sec','/api/committee/spam/'+honey.id,'POST',{action:'delete'});
 assert.equal(f.count('club_spam_quarantine'),0);
 assert.equal(f.count('club_audit',"action IN ('spam_marked_genuine','spam_deleted')"),2);
 const noms=await f.call('sec','/api/committee/nominations');assert.equal(noms.nominations.length,1);assert.equal(noms.nominations[0].name,'Fictional Nominee 7');
 assert.equal(await f.statusOf('pres','/api/committee/nominations'),403);
 // Malformed items without a name and email cannot be released.
 await worker.fetch(new Request('https://sandy.test/api/nominate',{method:'POST',headers:{Origin:'https://sandy.test','Content-Type':'application/json'},body:'[]'}),f.env);
 const mal=(await f.call('sec','/api/committee/spam')).items[0];
 assert.equal(await f.statusOf('sec','/api/committee/spam/'+mal.id,'POST',{action:'genuine'}),409);
});

test('daily 10:00 AM digest lists genuine and caught items as links, once, and skips empty days',async t=>{
 const f=fixture(t,{nominations:true}),net=mockNetwork(t);switchOn(f.env);
 assert.deepEqual(await dailyDigest(f.env),{skipped:'nothing_to_report'});assert.equal(net.mail.length,0);
 await f.request(null,'/api/nominate','POST',person(1),'https://sandy.test',ip(1));
 await f.request(null,'/api/nominate','POST',person(2,{website:'bot'}),'https://sandy.test',ip(2));
 await f.request(null,'/api/nominate','POST',person(3,{turnstileToken:'bot'}),'https://sandy.test',ip(3));
 net.mail.length=0;
 const waits=[];await worker.scheduled({scheduledTime:Date.now(),cron:'0 0 * * *'},f.env,{waitUntil:p=>waits.push(p)});await Promise.all(waits);
 const r=await dailyDigest(f.env);
 // scheduled() already sent today's digest, so the direct call is skipped.
 assert.deepEqual(r,{skipped:'already_sent'});
 assert.equal(net.mail.length,1);
 const d=net.mail[0];
 assert.equal(d.subject,'Sandy Sports daily summary: 1 new, 2 caught');
 assert.match(d.text,/Genuine nominations: 1/);assert.match(d.text,/Caught by spam protection: 2/);
 assert.match(d.text,/Hidden bot field was filled: 1/);assert.match(d.text,/Failed the Turnstile check: 1/);
 assert.match(d.text,/#nominations\/spam\/[a-f0-9-]{36}/);assert.match(d.text,/#nominations\/nomination\/[a-f0-9-]{36}/);
 for(const secret of ['Fictional Nominee','@example.test','Beach volleyball','Fictional event skills'])assert.ok(!d.text.includes(secret),'digest leaked '+secret);
 assert.ok(![8211,8212].some(c=>(d.text+d.subject).includes(String.fromCharCode(c))),'no en or em dashes in the digest');
 assert.equal(f.count('club_alert_digests',"state='sent'"),1);
 delete f.env.SANDY_RESEND_API_KEY;assert.equal(mailConfigured(f.env),false);
 assert.deepEqual(await dailyDigest(f.env,Date.now()+864e5),{skipped:'mail_not_configured'});
});

test('retention purge removes expired quarantine and old source hashes',async t=>{
 const f=fixture(t,{nominations:true});mockNetwork(t);switchOn(f.env);
 f.sql.prepare("INSERT INTO club_spam_quarantine(id,created_utc,reason,expires_utc) VALUES('old','2020-01-01T00:00:00.000Z','honeypot','2020-03-31T00:00:00.000Z')").run();
 await f.call('sec','/api/committee/spam');
 assert.equal(f.count('club_spam_quarantine'),0);
});

test('alert mail headers cannot be injected and wrangler keeps nominations off with a daily cron',async()=>{
 const raw=mimeMessage({from:'a@sandy.test',to:'b@sandy.test',subject:'Hi\r\nBcc: x@evil.example',text:'Body',messageId:'m@sandy.test'});
 assert.ok(!/\r\nBcc:/i.test(raw));
 const {readFileSync}=await import('node:fs');
 const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(cfg.vars.SANDY_NOMINATIONS_ENABLED,'disabled');assert.deepEqual(cfg.triggers.crons,['0 0 * * *','*/15 * * * *']);
 assert.ok(!('SANDY_RESEND_API_KEY' in cfg.vars)&&!cfg.send_email,'no mail secret or binding in config');
});

test('standing for office requires agreeing to meeting recording (draft constitution rule 4B)',async t=>{
 const f=fixture(t,{nominations:true}),net=mockNetwork(t);switchOn(f.env);
 const res=await f.request(null,'/api/nominate','POST',person(7,{recordingConsent:false}),'https://sandy.test',ip(7));
 assert.equal(res.status,400);assert.match((await res.json()).error,/rule 4B/);
 const ok=await f.request(null,'/api/nominate','POST',person(8,{pathway:'Film club / media crew',recordingConsent:false}),'https://sandy.test',ip(8));
 assert.equal(ok.status,202,'other pathways do not need it');
 assert.equal(f.count('club_nominations','recording_consent_utc IS NULL'),1);
});
