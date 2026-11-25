import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import worker from '../worker/index.mjs';

function fixture(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 sql.exec(readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8'));
 const DB={prepare(query){
  const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>({meta:{changes:Number(q.run(...args).changes)}})});
  return {...bind(),bind};
 },withSession(){return this},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
 const env={DB,SANDY_AUTH_PEPPER:'isolated-fictional-pepper-not-for-production',SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
 const actors={};
 for(const [name,role] of [['web','webmaster'],['treasurer','treasurer'],['sec','secretary'],['other','committee'],['member','member'],['member2','member'],['demo','webmaster_demo']]){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  sql.prepare("INSERT INTO club_accounts(id,username,role,office_label,state,password_salt,password_verifier,created_utc) VALUES(?,?,?,?,'active','fake','fake','2026-01-01')").run(id,name,role,role);
  sql.prepare('INSERT INTO club_sessions VALUES(?,?,0,4102444800)').run(createHash('sha256').update(token).digest('hex'),id);
  actors[name]={id,token};
 }
 async function call(who,path,method='GET',body,status=200){
  const headers={Origin:'https://sandy.test','Content-Type':'application/json'};
  if(who)headers.Cookie='__Host-sandy_session='+actors[who].token;
  const res=await worker.fetch(new Request('https://sandy.test'+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
  const value=await res.json();assert.equal(res.status,status,JSON.stringify(value));return value;
 }
 function active(who){const id=actors[who].id;sql.prepare("INSERT INTO club_people(id,account_id,full_name,status,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,'Fictional member','active',?,?,'2026-01-01','2026-01-01')").run(randomUUID(),id,id,id)}
 return {sql,env,actors,call,active};
}
test('restricted stock, legacy desk and meeting purpose cannot escape through broad register, history or calendar routes',async t=>{
 const {call,sql,env}=fixture(t);
 const stock=await call('treasurer','/api/suite/stock','POST',{title:'Private stock fixture',fields:{sku:'STOCK-1',category:'Sports gear',opening:4,inward:0,outward:0}},201);
 const legacy=await call('treasurer','/api/records','POST',{kind:'asset',title:'Legacy stock fixture',body:{source:'sandy-committee-room-v1',desk:'stock',notes:'Private inventory'}},201);
 const meeting=await call('sec','/api/suite/meetings','POST',{title:'Restricted meeting fixture',fields:{meetingType:'Working group',date:'2027-03-14',startTime:'09:00',location:'Fictional venue'}},201);
 const general=await call('other','/api/records','POST',{kind:'social_idea',title:'Shared fixture',body:{notes:'Ordinary idea'}},201);
 for(const who of ['other','sec','treasurer','web']){
  const all=await call(who,'/api/records');
  assert.ok(all.records.some(r=>r.id===general.id));
  assert.ok(!all.records.some(r=>r.id===stock.id||r.id===meeting.id));
  assert.equal(all.records.some(r=>r.id===legacy.id),['treasurer','web'].includes(who));
  const byKind=await call(who,'/api/records?kind=asset');
  assert.ok(!byKind.records.some(r=>r.id===stock.id));
  for(const suffix of ['', '/revisions'])await call(who,'/api/records/'+stock.id+suffix,'GET',undefined,404);
  await call(who,'/api/records/'+stock.id,'PATCH',{version:1,title:'Bypass'},404);
  await call(who,'/api/records/'+stock.id+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test'},404);
 }
 await call('other','/api/suite/stock/'+stock.id,'GET',undefined,403);
 await call('other','/api/records/'+legacy.id,'GET',undefined,404);
 await call('other','/api/records/'+legacy.id+'/revisions','GET',undefined,404);
 assert.equal((await call('treasurer','/api/suite/stock/'+stock.id)).record.fields.opening,4);
 assert.equal((await call('treasurer','/api/records/'+legacy.id)).record.title,'Legacy stock fixture');
 assert.equal((await call('sec','/api/meetings')).meetings[0].location,'Fictional venue');
 assert.equal((await call('other','/api/meetings')).meetings.length,0);
 assert.equal((await call('treasurer','/api/meetings')).meetings.length,0);
 assert.equal((await call('sec','/api/audit')).audit.some(x=>x.resourceId===stock.id||x.resourceId===legacy.id),false);
 assert.equal((await call('web','/api/audit')).audit.some(x=>x.resourceId===stock.id),true);
 await call('other','/api/records','POST',{kind:'asset',title:'Fake stock',body:{sandySuiteVersion:1,domain:'stock',fields:{}}},400);
 await call('other','/api/records','POST',{kind:'asset',title:'Fake legacy stock',body:{source:'sandy-committee-room-v1',desk:'stock'}},403);
 await call('treasurer','/api/records/'+legacy.id,'PATCH',{version:1,body:{}},400);
 await call('other','/api/records/'+general.id,'PATCH',{version:1,body:{sandyWebmasterRequest:1}},400);
 await call('other','/api/records/'+general.id,'PATCH',{version:1,body:{notes:'Legitimate change'}});
 assert.equal((await call('other','/api/records/'+general.id)).record.version,2);
 assert.equal(sql.prepare('SELECT version FROM club_records WHERE id=?').get(stock.id).version,1);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_revisions WHERE resource_id=?').get(stock.id).n,1);
 env.SANDY_CLUB_APPROVALS='enabled';
 await call('web','/api/records/'+stock.id+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test'},404);
});
test('help owner and Webmaster retain reply workflow; every alternate list, audit, member publication and edit denies disclosure',async t=>{
 const {call,sql,env,active}=fixture(t);
 const help=await call('sec','/api/webmaster/requests','POST',{subject:'Private support fixture',category:'Site or account issue',message:'Fictional private request'},201);
 for(const who of ['other','treasurer','sec','web']){
  const own=await call(who,'/api/webmaster/requests');
  assert.equal(own.requests.some(r=>r.id===help.id),['sec','web'].includes(who));
  assert.ok(!(await call(who,'/api/records')).records.some(r=>r.id===help.id));
  assert.ok(!(await call(who,'/api/records?kind=notice')).records.some(r=>r.id===help.id));
  assert.ok(!(await call(who,'/api/suite/notices')).records.some(r=>r.id===help.id));
  for(const suffix of ['', '/revisions'])await call(who,'/api/records/'+help.id+suffix,'GET',undefined,404);
  await call(who,'/api/records/'+help.id,'PATCH',{version:1,title:'Altered'},404);
  await call(who,'/api/records/'+help.id+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test'},404);
 }
 await call('other','/api/webmaster/requests/'+help.id,'PATCH',{version:1,stage:'completed',reply:'Not allowed'},403);
 await call('sec','/api/webmaster/requests','POST',{subject:'Credential fixture',category:'Access or password',message:'password: fake-example'},400);
 await call('demo','/api/webmaster/requests','GET',undefined,403);
 await call(null,'/api/webmaster/requests','GET',undefined,401);
 await call('other','/api/records','POST',{kind:'notice',title:'Forged support',body:{sandyWebmasterRequest:1}},400);
 assert.ok(!(await call('sec','/api/audit')).audit.some(x=>x.resourceId===help.id));
 assert.equal((await call('web','/api/webmaster/requests')).counters.unread,1);
 await call('web','/api/webmaster/requests/'+help.id,'PATCH',{version:1,stage:'completed',reply:'Fictional reply'});
 assert.equal((await call('sec','/api/webmaster/requests')).requests[0].reply,'Fictional reply');
 assert.equal((await call('other','/api/webmaster/requests')).requests.length,0);
 assert.equal((await call('web','/api/webmaster/requests')).counters.unread,0);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_revisions WHERE resource_id=?').get(help.id).n,2);
 env.SANDY_CLUB_APPROVALS='enabled';active('member');
 // Simulate a legacy wrongly-approved support row without touching real data.
 sql.prepare("UPDATE club_records SET status='approved' WHERE id=?").run(help.id);
 const workspace=await call('member','/api/member/workspace');
 assert.ok(!JSON.stringify(workspace).includes(help.id));
 assert.ok(!JSON.stringify(await call('member','/api/member/data-export')).includes(help.id));
});
test('private member preferences stay owner-only across register, suite, audit and exports',async t=>{
 const {call,env,active}=fixture(t);env.SANDY_CLUB_APPROVALS='enabled';active('member');active('member2');
 const saved=await call('member','/api/member/preferences','POST',{version:0,sports:['Flag football'],notes:'Private preference fixture'},201);
 assert.equal((await call('member','/api/member/data-export')).preferences.id,saved.id);
 assert.equal((await call('member2','/api/member/data-export')).preferences,null);
 for(const who of ['web','sec','other','treasurer']){
  assert.ok(!(await call(who,'/api/records?kind=safeguard')).records.some(r=>r.id===saved.id));
  await call(who,'/api/records/'+saved.id,'GET',undefined,404);
  await call(who,'/api/records/'+saved.id+'/revisions','GET',undefined,404);
  await call(who,'/api/records/'+saved.id,'PATCH',{version:1,body:{}},404);
 }
 assert.ok(!(await call('sec','/api/suite/safety')).records.some(r=>r.id===saved.id));
 assert.ok(!(await call('web','/api/audit')).audit.some(r=>r.resourceId===saved.id));
 assert.equal((await call('member','/api/member/workspace')).preferences.fields.notes,'Private preference fixture');
});
