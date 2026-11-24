import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {suiteEndpoint} from '../worker/suite.mjs';
const database=new DatabaseSync(':memory:');
database.exec(readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8'));
const webId='11111111-1111-4111-8111-111111111111';
database.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,state,password_salt,password_verifier,created_utc) VALUES(?,?,'webmaster','Webmaster','Webmaster','active','fake-salt','fake-hash',?)").run(webId,'webmaster','2026-11-24T09:00:00Z');
const fakeDB={
 prepare(sql){
  const q=database.prepare(sql);
  return {bind(...values){
   return {
    async first(){return q.get(...values)||null},
    async all(){return {results:q.all(...values)}},
    async run(){const r=q.run(...values);return {meta:{changes:Number(r.changes)}}}
   }
  }}
 },
 withSession(){return this},
 async batch(stmts){
  database.exec('BEGIN');
  try{const result=[];for(const s of stmts)result.push(await s.run());database.exec('COMMIT');return result}
  catch(e){database.exec('ROLLBACK');throw e}
 }
};
const env={DB:fakeDB,SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
const webmaster={id:webId,role:'webmaster',username:'webmaster',office_label:'Webmaster'};
async function call(domain,method='GET',body,role=webmaster,path=''){
 const pathname='/api/suite/'+domain+path;
 const req=new Request('https://sandy.example'+pathname,{method,headers:{'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})});
 const res=await suiteEndpoint(req,env,pathname,role);
 return {status:res.status,data:await res.json()};
}
test('real D1 workflow creates, lists, updates, audits and versions a meeting',async()=>{
 const draft={title:'Founding team planning meeting',status:'draft',
  fields:{meetingType:'Management committee',date:'2027-02-12',startTime:'09:30',location:'Dunwich / Goompi',
   agenda:'Venue options\nVolunteer roles',chair:'Proposed convenor',draftMinutes:'Working notes only'}};
 const created=await call('meetings','POST',draft);
 assert.equal(created.status,201);
 assert.equal(created.data.version,1);
 const meetingId=created.data.id;
 const list=await call('meetings');
 assert.equal(list.data.records.length,1);
 assert.equal(list.data.records[0].title,draft.title);
 assert.equal(list.data.records[0].fields.meetingType,'Management committee');
 const v1=await call('meetings','GET',undefined,webmaster,'/'+meetingId);
 assert.equal(v1.data.record.fields.location,'Dunwich / Goompi');
 const update=await call('meetings','PATCH',{...draft,version:1,status:'review',
  fields:{...draft.fields,draftMinutes:'Agenda and 3 action owners reviewed.',followUps:'Send venue questions | Secretary | 2027-02-19'}},webmaster,'/'+meetingId);
 assert.equal(update.data.version,2);
 const latest=await call('meetings','GET',undefined,webmaster,'/'+meetingId);
 assert.equal(latest.data.record.status,'review');
 const history=await call('meetings','GET',undefined,webmaster,'/'+meetingId+'/history');
 assert.equal(history.data.history.length,2);
 assert.deepEqual(history.data.history.map(x=>x.version),[2,1]);
 assert.ok(history.data.history.every(x=>x.office==='Webmaster'));
 assert.equal(database.prepare("SELECT COUNT(*) AS n FROM club_audit WHERE resource_id=?").get(meetingId).n,2);
 assert.equal(database.prepare("SELECT COUNT(*) AS n FROM club_revisions WHERE resource_id=?").get(meetingId).n,2);
 await assert.rejects(()=>call('meetings','PATCH',{...draft,version:1},webmaster,'/'+meetingId),e=>e.status===409);
});
test('real D1 workflow validates a grant and isolates its data',async()=>{
 const good={title:'Sand sport funding expression',status:'proposal',
  fields:{funder:'Example funder',scheme:'Community inclusion',officialUrl:'https://example.org/guidelines',closingDate:'2027-05-02',amount:1000}};
 const record=await call('grants','POST',good);
 assert.equal(record.status,201);
 assert.equal((await call('grants')).data.records.length,1);
 assert.equal((await call('meetings')).data.records.length,1);
 await assert.rejects(()=>call('grants','POST',{title:'Bad grant',fields:{funder:'Example',officialUrl:'http://not-allowed.test'}}),e=>e.status===400);
 await assert.rejects(()=>call('grants','POST',{title:'Bad grant',fields:{funder:'Example',amount:-2}}),e=>e.status===400);
});
test('ordinary member, demo webmaster and unapproved roles cannot read sensitive work',async()=>{
 const member={id:'22222222-2222-4222-8222-222222222222',role:'member',office_label:'Member'};
 const demo={id:'33333333-3333-4333-8333-333333333333',role:'webmaster_demo',office_label:'Demo'};
 const committee={id:'44444444-4444-4444-8444-444444444444',role:'committee',office_label:'Committee'};
 for(const role of [member,demo])await assert.rejects(()=>call('meetings','GET',undefined,role),e=>e.status===403);
 await assert.rejects(()=>call('safety','GET',undefined,committee),e=>e.status===403);
 await assert.rejects(()=>call('safety','POST',{title:'Safeguard',fields:{policy:'Code of conduct'}},committee),e=>e.status===403);
});
test('no unsupported approvals or unexpected fields can be inserted',async()=>{
 await assert.rejects(()=>call('notices','POST',{title:'Not approved',status:'approved',fields:{subject:'Test'}}),e=>e.status===400);
 await assert.rejects(()=>call('notices','POST',{title:'Not accepted',status:'draft',fields:{subject:'Test',password:'secret'}}),e=>e.status===400);
 const checks=await call('desks');
 assert.equal(checks.data.disabled.approvals,true);
 assert.equal(checks.data.disabled.livePayments,true);
 assert.equal(checks.data.disabled.livePublishing,true);
});
