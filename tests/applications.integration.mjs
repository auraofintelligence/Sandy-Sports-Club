// MEM-01: consented application, deduplication and retry, committee review and a
// controlled transition. No account, invitation, activation or payment is created.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const EVIDENCE='https://example.test/fictional-resolution';
function stubTurnstile(t){
 const real=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  if(String(url).startsWith('https://challenges.cloudflare.com/')){const token=new URLSearchParams(init.body).get('response');return new Response(JSON.stringify({success:token==='fictional-pass'}))}
  throw new Error('Unexpected network call in an isolated test: '+url);
 };
 t.after(()=>{globalThis.fetch=real});
}
const form=(over={})=>({submissionId:crypto.randomUUID(),name:'Fictional Applicant',email:'applicant@example.test',pathway:'Volunteer helper',town:'Fictional Amity',statement:'Happy to help at sand games.',contactConsent:true,privacyConsent:true,turnstileToken:'fictional-pass',...over});
test('public applications stay closed by default and need consent and verification',async t=>{
 const {call,env,count}=fixture(t);stubTurnstile(t);
 assert.equal((await call(null,'/api/apply')).open,false);
 await call(null,'/api/apply','POST',form(),503);
 env.SANDY_APPLICATIONS_ENABLED='enabled';
 await call(null,'/api/apply','POST',form(),503);
 env.SANDY_TURNSTILE_SECRET='fictional-secret';
 assert.equal((await call(null,'/api/apply')).open,true);
 await call(null,'/api/apply','POST',form({privacyConsent:false}),400);
 await call(null,'/api/apply','POST',form({turnstileToken:'wrong'}),403);
 await call(null,'/api/apply','POST',form({pathway:'Life member'}),400);
 const first=form();
 const replies=await Promise.all([call(null,'/api/apply','POST',first,202),call(null,'/api/apply','POST',first,202),call(null,'/api/apply','POST',form(),202),call(null,'/api/apply','POST',form({email:'APPLICANT@example.test'}),202)]);
 assert.ok(replies.every(r=>r.notice===replies[0].notice),'reply never reveals a known email');
 assert.equal(count('club_interest',"source LIKE 'application:%'"),1);
 assert.equal(count('club_people'),0);assert.equal(count('club_records'),0);
});
test('officers open, review, recommend and decide; personal details stay in the private register',async t=>{
 const {call,env,count,sql}=fixture(t);stubTurnstile(t);
 env.SANDY_APPLICATIONS_ENABLED='enabled';env.SANDY_TURNSTILE_SECRET='fictional-secret';
 await call(null,'/api/apply','POST',form(),202);
 const lead=(await call('sec','/api/interest')).interests[0];
 await call('other','/api/committee/applications/from-interest','POST',{interestId:lead.id},403);
 const [a,b]=await Promise.all([call('sec','/api/committee/applications/from-interest','POST',{interestId:lead.id}).catch(e=>e),call('asst','/api/committee/applications/from-interest','POST',{interestId:lead.id}).catch(e=>e)]);
 const appId=a.id||b.id;assert.ok(appId);
 assert.equal(count('club_records',"json_extract(body_json,'$.domain')='applications'"),1);
 assert.equal(count('club_people',"status='applicant'"),1);
 assert.equal((await call('sec','/api/committee/applications/from-interest','POST',{interestId:lead.id})).created,false);
 const record=sql.prepare('SELECT title,body_json FROM club_records WHERE id=?').get(appId);
 assert.ok(!(record.title+record.body_json).includes('applicant@example.test')&&!record.body_json.includes('Fictional Applicant'),'desk record holds a reference, not personal details');
 const P='/api/committee/applications/'+appId;
 let v=(await call('sec',P)).application;
 assert.equal(v.state,'received');assert.equal(v.pathway,'Volunteer helper');assert.equal(v.person.email,'applicant@example.test');
 const committeeView=(await call('other',P)).application;assert.equal(committeeView.person,undefined);
 await call('member',P,'GET',undefined,403);
 await call('sec','/api/suite/applications/'+appId,'PATCH',{version:1,title:'x',fields:{}},409);
 await call('sec',P,'POST',{action:'recommend',outcome:'accept',version:1},409);
 await call('other',P,'POST',{action:'review',version:1});
 await call('other',P,'POST',{action:'checks',version:2,checks:'Fictional reference check noted'});
 await call('other',P,'POST',{action:'recommend',outcome:'accept',version:3},403);
 await call('sec',P,'POST',{action:'recommend',outcome:'accept',version:3,notes:'Fictional recommendation'});
 await call('sec',P,'POST',{action:'recommend',outcome:'accept',version:3},409);
 // Formal decisions stay off until the club is established.
 await call('pres',P,'POST',{action:'decide',decision:'accepted',evidence:EVIDENCE,version:4},409);
 env.SANDY_CLUB_APPROVALS='enabled';
 await call('treasurer',P,'POST',{action:'decide',decision:'accepted',evidence:EVIDENCE,version:4},403);
 await call('pres',P,'POST',{action:'decide',decision:'accepted',version:4},400);
 const done=await call('pres',P,'POST',{action:'decide',decision:'accepted',evidence:EVIDENCE,version:4});
 assert.equal(done.state,'accepted_pending');assert.match(done.notice,/No account, invitation or payment/);
 v=(await call('sec',P)).application;
 assert.equal(v.person.status,'pending');assert.deepEqual(v.history.map(h=>h.state),['received','under_review','recommended_accept','accepted_pending']);
 assert.equal(count('club_accounts',"role='member'"),2,'no account created');
 await call('sec',P,'POST',{action:'withdraw',reason:'x',version:5},409);
 const person=(await call('sec','/api/people/'+v.person.id+'/revisions')).revisions;assert.equal(person[0].changes.to,'pending');
});
test('withdrawal and decline close the application and update the person once',async t=>{
 const {call,sql,env}=fixture(t);
 const mk=async email=>{const lead=crypto.randomUUID();sql.prepare("INSERT INTO club_interest(id,created_utc,first_name,email,town,audience_region,interests_json,comments,contact_consent,source) VALUES(?,?,?,?,'','other','[]','',1,'fictional')").run(lead,'2026-11-01',email,email);return (await call('sec','/api/committee/applications/from-interest','POST',{interestId:lead,pathway:'Sport participant'},201)).id};
 const one=await mk('one@example.test'),two=await mk('two@example.test');
 await call('sec','/api/committee/applications/'+one,'POST',{action:'withdraw',version:1},400);
 await call('sec','/api/committee/applications/'+one,'POST',{action:'withdraw',version:1,reason:'Fictional applicant moved away'});
 assert.equal((await call('sec','/api/committee/applications/'+one)).application.person.status,'withdrawn');
 // A closed application does not block a fresh one from the same email.
 const again=crypto.randomUUID();sql.prepare("INSERT INTO club_interest(id,created_utc,first_name,email,town,audience_region,interests_json,comments,contact_consent,source) VALUES(?,?,?,?,'','other','[]','',1,'fictional')").run(again,'2026-11-02','one','one@example.test');
 assert.equal((await call('sec','/api/committee/applications/from-interest','POST',{interestId:again},201)).created,true);
 const dup=crypto.randomUUID();sql.prepare("INSERT INTO club_interest(id,created_utc,first_name,email,town,audience_region,interests_json,comments,contact_consent,source) VALUES(?,?,?,?,'','other','[]','',1,'fictional')").run(dup,'2026-11-03','two','TWO@example.test');
 const d=await call('sec','/api/committee/applications/from-interest','POST',{interestId:dup});assert.equal(d.duplicate,true);assert.equal(d.id,two);
 const list=(await call('asst','/api/committee/applications')).applications;assert.equal(list.length,3);
 assert.equal(list.filter(x=>x.open).length,2);
 const P='/api/committee/applications/'+two;
 await call('sec',P,'POST',{action:'review',version:1});await call('sec',P,'POST',{action:'recommend',outcome:'decline',version:2});
 env.SANDY_CLUB_APPROVALS='enabled';
 assert.equal((await call('sec',P,'POST',{action:'decide',decision:'declined',evidence:EVIDENCE,version:3})).state,'declined');
 const v=(await call('sec',P)).application;assert.equal(v.person.status,'inactive');assert.equal(v.open,false);assert.deepEqual(v.next,[]);
});
