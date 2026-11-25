import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {suiteEndpoint} from '../worker/suite.mjs';
import {memberWorkspaceEndpoint} from '../worker/member-workspace.mjs';
import {safeguardsEndpoint} from '../worker/member-safeguards.mjs';
import {helpEndpoint} from '../worker/help.mjs';
const database=new DatabaseSync(':memory:');
database.exec(readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8'));
const webId='11111111-1111-4111-8111-111111111111';
database.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,state,password_salt,password_verifier,created_utc) VALUES(?,?,'webmaster','Webmaster','Webmaster','active','fake-salt','fake-hash',?)").run(webId,'webmaster','2026-11-24T09:00:00Z');
const fakeDB={
 prepare(sql){
  const q=database.prepare(sql);
  const args=values=>({
   async first(){return q.get(...values)||null},
   async all(){return {results:q.all(...values)}},
   async run(){const r=q.run(...values);return {meta:{changes:Number(r.changes)}}}
  });
  return {...args([]),bind(...values){return args(values)}};
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

test('member portal uses a synthetic preview and excludes member writes until lawful activation',async()=>{
 const preview=await memberWorkspaceEndpoint(new Request('https://sandy.example/api/member/preview'),env,
  '/api/member/preview',webmaster);
 const sample=await preview.json();
 assert.equal(sample.synthetic,true);
 assert.match(sample.notice,/synthetic/i);
 const candidate={id:'66666666-6666-4666-8666-666666666666',role:'member',office_label:'Member',username:'prospective'};
 const before=await memberWorkspaceEndpoint(new Request('https://sandy.example/api/member/workspace'),env,
  '/api/member/workspace',candidate);
 assert.equal((await before.json()).active,false);
 const req=new Request('https://sandy.example/api/member/preferences',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({sports:['Mixed beach volleyball']})});
 await assert.rejects(()=>memberWorkspaceEndpoint(req,env,'/api/member/preferences',candidate),e=>e.status===409);
 await assert.rejects(()=>memberWorkspaceEndpoint(new Request('https://sandy.example/api/member/preview'),env,
  '/api/member/preview',candidate),e=>e.status===403);
});
test('future active member can save only own preferences, contribute interests and export only own data',async()=>{
 const memberId='77777777-7777-4777-8777-777777777777';
 const member={id:memberId,role:'member',office_label:'Member',username:'examplemember'};
 database.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,state,password_salt,password_verifier,created_utc) VALUES(?,?,'member','Member','Example Member','active','fake-salt','fake-hash',?)").run(memberId,'examplemember','2026-11-24T09:00:00Z');
 database.prepare("INSERT INTO club_people(id,account_id,full_name,membership_class,status,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,'Example Member','adult','active',1,?,?,?,?)")
  .run('88888888-8888-4888-8888-888888888888',memberId,webId,webId,'2026-11-24T09:00:00Z','2026-11-24T09:00:00Z');
 env.SANDY_CLUB_APPROVALS='enabled';
 const verifyPath='/api/committee/safeguards';
 await safeguardsEndpoint(new Request('https://sandy.example'+verifyPath,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',accountId:memberId,version:0,ageBand:'adult',guardianPermission:false,ageCheckedOffline:true})}),env,verifyPath,webmaster);
 async function portal(path,method='GET',body){
  const req=new Request('https://sandy.example'+path,{method,headers:{'Content-Type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{})});
  const res=await memberWorkspaceEndpoint(req,env,path,member);
  return {status:res.status,data:await res.json()};
 }
 const saved=await portal('/api/member/preferences','POST',{version:0,sports:['Mixed beach volleyball','Beach cricket','Unlisted sport'],
  availability:['Weekend morning'],filmClub:true,contactPreference:'no_contact'});
 assert.equal(saved.status,201);
 assert.equal(saved.data.version,1);
 const w=await portal('/api/member/workspace');
 assert.equal(w.data.active,true);
 assert.deepEqual(w.data.preferences.fields.sports,['Mixed beach volleyball','Beach cricket']);
 const newer=await portal('/api/member/preferences','POST',{version:1,sports:['Flag football'],publicationConsent:false});
 assert.equal(newer.data.version,2);
 const interest=await portal('/api/member/interest','POST',{area:'equipment',request:'Portable volleyball net'});
 assert.equal(interest.status,201);
 const memberData=await portal('/api/member/data-export');
 assert.equal(memberData.data.profile.full_name,'Example Member');
 assert.equal(memberData.data.wishes.length,1);
 assert.equal(memberData.data.preferences.fields.sports[0],'Flag football');
 assert.ok(!JSON.stringify(memberData.data).includes('Founding team planning meeting'));
 env.SANDY_CLUB_APPROVALS='disabled';
});

test('meeting follow-ups become separately audited to-dos exactly once',async()=>{
 const draft={title:'Preseason sport planning',status:'draft',
  fields:{meetingType:'Working group',date:'2027-03-14',startTime:'09:00',endTime:'10:00',
   followUps:'Ask venue about shade | Secretary | 2027-03-18\nCheck sport equipment | Treasurer | 2027-03-20'}};
 const created=await call('meetings','POST',draft);
 const meetingId=created.data.id;
 async function follow(){
  const path='/api/suite/meetings/'+meetingId+'/followups';
  const req=new Request('https://sandy.example'+path,{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1})});
  const res=await suiteEndpoint(req,env,path,webmaster);return res.json();
 }
 const first=await follow();assert.equal(first.created,2);
 const second=await follow();assert.equal(second.created,0);assert.equal(second.alreadyPresent,2);
 const todos=(await call('todos')).data.records;
 assert.equal(todos.length,2);
 assert.ok(todos.some(x=>x.fields.owner==='Secretary'));
 assert.ok(todos.some(x=>x.fields.owner==='Treasurer'));
 assert.equal(database.prepare("SELECT COUNT(*) AS n FROM club_records WHERE kind='task'").get().n,2);
});
test('stock receipts and issues maintain a safe versioned balance',async()=>{
 const created=await call('stock','POST',{title:'Portable volleyball kits',status:'draft',
  fields:{sku:'SANDY-VB-01',category:'Sports gear',opening:4,inward:0,outward:0}});
 assert.equal(created.status,201);
 const recordId=created.data.id;
 async function move(version,direction,quantity,role=webmaster){
  const path='/api/suite/stock/'+recordId+'/movement';
  const req=new Request('https://sandy.example'+path,{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({version,direction,quantity,note:'Test stock movement'})});
  return suiteEndpoint(req,env,path,role);
 }
 const received=await move(1,'receive',6);
 const r=await received.json();assert.equal(r.version,2);assert.equal(r.balance,10);
 const issued=await move(2,'issue',3);
 assert.equal((await issued.json()).balance,7);
 const latest=(await call('stock','GET',undefined,webmaster,'/'+recordId)).data.record;
 assert.equal(latest.version,3);
 assert.equal(latest.fields.inward,6);assert.equal(latest.fields.outward,3);
 await assert.rejects(()=>move(2,'issue',1),e=>e.status===409);
 await assert.rejects(()=>move(3,'issue',100),e=>e.status===409);
 await assert.rejects(()=>move(3,'receive',1,{role:'committee',id:'committee'}),e=>e.status===403);
 const history=(await call('stock','GET',undefined,webmaster,'/'+recordId+'/history')).data.history;
 assert.equal(history.length,3);
 assert.ok(history.some(h=>h.operation==='stock_issue'));
 assert.ok(history.some(h=>h.operation==='stock_receive'));
});

test('Webmaster request inbox maintains real unread counts, officer ownership and internal audited replies',async()=>{
 const secretaryId='99999999-9999-4999-8999-999999999999';
 const secretary={id:secretaryId,role:'secretary',office_label:'Secretary',username:'secretary'};
 database.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,state,password_salt,password_verifier,created_utc) VALUES(?,?,'secretary','Secretary','Secretary','active','fake-salt','fake-hash',?)").run(secretaryId,'secretary','2026-11-24T09:00:00Z');
 async function help(path,role,method='GET',body){
  const req=new Request('https://sandy.example'+path,{method,headers:{'Content-Type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{})});
  const res=await helpEndpoint(req,env,path,role);
  return {status:res.status,data:await res.json()};
 }
 const initial=await help('/api/webmaster/requests',secretary,'POST',
  {subject:'Help with a shared calendar',category:'Committee workflow',message:'Need a review of proposed dates.'});
 assert.equal(initial.status,201);
 const inbox=await help('/api/webmaster/requests',webmaster);
 assert.equal(inbox.data.counters.unread,1);assert.equal(inbox.data.counters.open,1);
 assert.equal(inbox.data.requests.length,1);assert.equal(inbox.data.requests[0].createdBy,secretaryId);
 const mine=await help('/api/webmaster/requests',secretary);
 assert.equal(mine.data.requests.length,1);assert.equal(mine.data.counters,null);
 const route='/api/webmaster/requests/'+initial.data.id;
 await assert.rejects(()=>help(route,secretary,'PATCH',{version:1,stage:'completed',reply:'Not allowed'}),e=>e.status===403);
 const solved=await help(route,webmaster,'PATCH',{version:1,stage:'completed',reply:'This answer is stored inside the clubhouse.'});
 assert.equal(solved.data.version,2);
 const after=await help('/api/webmaster/requests',webmaster);
 assert.equal(after.data.counters.unread,0);assert.equal(after.data.counters.open,0);
 assert.equal(after.data.requests[0].stage,'completed');
 assert.equal(after.data.requests[0].reply,'This answer is stored inside the clubhouse.');
 assert.equal(database.prepare("SELECT COUNT(*) AS n FROM club_audit WHERE resource_id=?").get(initial.data.id).n,2);
});
