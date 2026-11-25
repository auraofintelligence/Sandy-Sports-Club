import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import worker from '../worker/index.mjs';

function fixture(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 sql.exec(readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8'));
 let pending=Promise.resolve();
 const DB={prepare(query){
  const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>({meta:{changes:Number(q.run(...args).changes)}})});
  return {...bind(),bind};
 },withSession(){return this},async batch(stmts){const run=pending.then(async()=>{sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}});pending=run.catch(()=>{});return run}};
 const env={DB,SANDY_AUTH_PEPPER:'isolated-fictional-pepper-not-for-production',SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
 const actors={};
 for(const [name,role] of [['web','webmaster'],['treasurer','treasurer'],['sec','secretary'],['other','committee'],['member','member'],['member2','member'],['demo','webmaster_demo']]){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  sql.prepare("INSERT INTO club_accounts(id,username,role,office_label,state,password_salt,password_verifier,created_utc) VALUES(?,?,?,?,'active','fake','fake','2026-01-01')").run(id,name,role,role);
  sql.prepare('INSERT INTO club_sessions VALUES(?,?,0,4102444800)').run(createHash('sha256').update(token).digest('hex'),id);
  actors[name]={id,token};
 }
 async function request(who,path,method='GET',body,origin='https://sandy.test'){
  const headers={Origin:origin,'Content-Type':'application/json'};
  if(who)headers.Cookie='__Host-sandy_session='+(actors[who]?.token||who);
  return worker.fetch(new Request('https://sandy.test'+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
 }
 async function call(who,path,method='GET',body,status=200){
  const res=await request(who,path,method,body);
  const value=await res.json();assert.equal(res.status,status,JSON.stringify(value));return value;
 }
 function active(who){const id=actors[who].id;sql.prepare("INSERT INTO club_people(id,account_id,full_name,status,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,'Fictional member','active',?,?,'2026-01-01','2026-01-01')").run(randomUUID(),id,id,id)}
 return {sql,env,actors,call,active,request};
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

test('reserved officer setup is closed by default; explicit isolated issuance, replacement, expiry, redemption and revocation preserve account identity',async t=>{
 const {call,env,sql,request}=fixture(t);
 const ids={};
 for(const role of ['president','vice_president','secretary','assistant_secretary','treasurer','committee']){
  const r=await call('web','/api/accounts','POST',{username:'fixture-'+role,role},201);ids[role]=r.account.id;
 }
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_invites').get().n,0);
 const target=ids.secretary,path='/api/accounts/'+target,username='fixture-secretary',password='fictional-password-1';
 await call('web',path+'/invite','POST',{manual:true},409);
 await call(null,'/api/auth/activate','POST',{token:'a'.repeat(64),password},409);
 env.SANDY_INVITES_ENABLED='enabled';
 await call('other',path+'/invite','POST',{manual:true},403);
 await call('web',path+'/invite','POST',{},409);
 const first=await call('web',path+'/invite','POST',{manual:true},201);
 const replacement=await call('web',path+'/invite','POST',{manual:true},201);
 assert.equal(first.sent,false);assert.notEqual(first.token,replacement.token);
 await call(null,'/api/auth/activate','POST',{token:first.token,password},400);
 sql.prepare('UPDATE club_invites SET expires_epoch=0 WHERE account_id=?').run(target);
 await call(null,'/api/auth/activate','POST',{token:replacement.token,password},400);
 const revoked=await call('web',path+'/invite','POST',{manual:true},201);
 await call('web',path+'/revoke-link','POST',{manual:true});
 await call(null,'/api/auth/activate','POST',{token:revoked.token,password},400);
 const valid=await call('web',path+'/invite','POST',{manual:true},201);
 env.SANDY_INVITES_ENABLED='disabled';
 await call(null,'/api/auth/activate','POST',{token:valid.token,password},409);
 env.SANDY_INVITES_ENABLED='enabled';
 await call(null,'/api/auth/activate','POST',{token:valid.token,password});
 await call(null,'/api/auth/activate','POST',{token:valid.token,password},400);
 const login=await request(null,'/api/auth/login','POST',{username,password});
 assert.equal(login.status,200);
 const session=login.headers.get('set-cookie').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
 assert.equal((await call(session,'/api/session')).identity.id,target);
 await call('web',path+'/revoke-sessions','POST',{manual:true});
 assert.equal((await call(session,'/api/session')).authenticated,false);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_accounts WHERE role=? AND state=?').get('webmaster','active').n,1);
});
test('password recovery, self-change, stale tokens, expiry and disable are fail-closed in actual session routing',async t=>{
 const {call,env,sql,request,actors}=fixture(t);
 const reserved=await call('web','/api/accounts','POST',{username:'recover-fixture',role:'treasurer'},201);
 const target=reserved.account.id,path='/api/accounts/'+target;
 const password='fictional-password-1',next='fictional-password-2',third='fictional-password-3';
 await call('web',path+'/recover','POST',{manual:true},409);
 env.SANDY_INVITES_ENABLED='enabled';
 const invite=await call('web',path+'/invite','POST',{manual:true},201);
 await call(null,'/api/auth/recover','POST',{token:invite.token,password},400);
 await call(null,'/api/auth/activate','POST',{token:invite.token,password});
 env.SANDY_INVITES_ENABLED='disabled';
 const login=async(p)=>{const r=await request(null,'/api/auth/login','POST',{username:'recover-fixture',password:p});assert.equal(r.status,200);return r.headers.get('set-cookie').match(/__Host-sandy_session=([a-f0-9]{64})/)[1]};
 const one=await login(password),two=await login(password);
 await call('other',path+'/recover','POST',{manual:true},403);
 await call('web','/api/accounts/'+actors.web.id+'/recover','POST',{manual:true},404);
 const reset=await call('web',path+'/recover','POST',{manual:true},201);
 env.SANDY_INVITES_ENABLED='enabled';
 await call(null,'/api/auth/activate','POST',{token:reset.token,password:next},400);
 env.SANDY_INVITES_ENABLED='disabled';
 const result=await call(null,'/api/auth/recover','POST',{token:reset.token,password:next});
 assert.equal(result.ok,true);
 await call(null,'/api/auth/recover','POST',{token:reset.token,password:next},400);
 for(const token of [one,two])assert.equal((await call(token,'/api/session')).authenticated,false);
 await call(null,'/api/auth/login','POST',{username:'recover-fixture',password},401);
 const current=await login(next);
 const cross=await request(current,'/api/auth/change-password','POST',{currentPassword:next,password:third},'https://elsewhere.test');assert.equal(cross.status,403);
 await call(current,'/api/auth/change-password','POST',{currentPassword:password,password:third},401);
 const pending=await call('web',path+'/recover','POST',{manual:true},201);
 await call(current,'/api/auth/change-password','POST',{currentPassword:next,password:third});
 assert.equal((await call(current,'/api/session')).authenticated,false);
 await call(null,'/api/auth/recover','POST',{token:pending.token,password:next},400);
 const expired=await login(third);
 sql.prepare('UPDATE club_sessions SET expires_epoch=0 WHERE digest=?').run(createHash('sha256').update(expired).digest('hex'));
 assert.equal((await call(expired,'/api/session')).authenticated,false);
 const live=await login(third);
 const stillPending=await call('web',path+'/recover','POST',{manual:true},201);
 await call('web',path+'/disable','POST',{manual:true});
 assert.equal((await call(live,'/api/session')).authenticated,false);
 await call(null,'/api/auth/login','POST',{username:'recover-fixture',password:third},401);
 await call(null,'/api/auth/recover','POST',{token:stillPending.token,password:next},400);
 assert.equal((await call('web','/api/session')).identity.id,actors.web.id);
 assert.equal(sql.prepare('SELECT state FROM club_accounts WHERE id=?').get(target).state,'disabled');
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL').get(target).n,0);
});

test('simultaneous edits, repeated meeting handoffs, stock retries and first preference saves are transactional',async t=>{
 const {call,request,sql,env,actors,active}=fixture(t);
 const draft={title:'Fictional concurrent meeting',fields:{meetingType:'Working group',date:'2027-04-12',followUps:'Check nets | Treasurer | 2027-04-13'}};
 const meet=await call('web','/api/suite/meetings','POST',draft,201),path='/api/suite/meetings/'+meet.id;
 const edits=await Promise.all([request('web',path,'PATCH',{...draft,version:1,reason:'Owner review',actorId:'forged'}),request('sec',path,'PATCH',{...draft,version:1,reason:'Secretary review',actorId:'forged'})]);
 assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
 const revs=(await call('web',path+'/history')).history;
 assert.equal(revs.length,2);assert.ok([actors.web.id,actors.sec.id].includes(revs[0].actorId));
 assert.equal(revs[0].changes.fromVersion,1);assert.equal(revs[0].changes.toVersion,2);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_audit WHERE resource_id=?').get(meet.id).n,2);
 const follows=await Promise.all([request('web',path+'/followups','POST',{version:2}),request('sec',path+'/followups','POST',{version:2})]);
 assert.ok(follows.every(x=>x.status===200));const counts=await Promise.all(follows.map(x=>x.json()));
 assert.equal(counts.reduce((n,x)=>n+x.created,0),1);
 const [todo]=(await call('web','/api/suite/todos')).records;
 await call('sec','/api/suite/todos/'+todo.id,'PATCH',{title:todo.title,version:1,fields:{...todo.fields,linkedDesk:'forged',complete:true}});
 assert.equal((await call('web','/api/suite/todos/'+todo.id)).record.fields.linkedDesk,meet.id);
 assert.equal((await call('web',path+'/followups','POST',{version:2})).created,0);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM club_records WHERE kind='task'").get().n,1);
 const stock=await call('treasurer','/api/suite/stock','POST',{title:'Fixture nets',fields:{sku:'FIXTURE',category:'Sports gear',opening:5,inward:0,outward:0}},201);
 const movePath='/api/suite/stock/'+stock.id+'/movement',mutationId=randomUUID(),move={version:1,direction:'receive',quantity:2,note:'Fictional delivery',mutationId};
 const moves=await Promise.all([request('treasurer',movePath,'POST',move),request('treasurer',movePath,'POST',move)]);
 assert.ok(moves.every(x=>x.status===200));const results=await Promise.all(moves.map(x=>x.json()));
 assert.equal(results.filter(x=>x.replayed).length,1);assert.ok(results.every(x=>x.balance===7));
 await call('treasurer',movePath,'POST',{...move,quantity:3},409);
 await call('web',movePath,'POST',move,409);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_revisions WHERE resource_id=?').get(stock.id).n,2);
 sql.exec("CREATE TRIGGER refuse_fixture_audit BEFORE INSERT ON club_audit WHEN NEW.action='stock_issue' BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END");
 await call('treasurer',movePath,'POST',{version:2,direction:'issue',quantity:1,mutationId:randomUUID()},500);
 assert.equal((await call('treasurer','/api/suite/stock/'+stock.id)).record.version,2);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_revisions WHERE resource_id=?').get(stock.id).n,2);
 sql.exec('DROP TRIGGER refuse_fixture_audit');
 active('member');env.SANDY_CLUB_APPROVALS='enabled';
 const prefs=await Promise.all([request('member','/api/member/preferences','POST',{version:0,sports:['Flag football']}),request('member','/api/member/preferences','POST',{version:0,sports:['Beach cricket']})]);
 assert.deepEqual(prefs.map(r=>r.status).sort(),[201,409]);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM club_records WHERE json_extract(body_json,'$.type')='preferences'").get().n,1);
});
test('production handoff and publication authority is scoped to the current revision and fails closed',async t=>{
 const {call,sql,env}=fixture(t);
 const brief=await call('web','/api/studio/briefs','POST',{title:'Fictional event clip',producer:'Example provider'},201),path='/api/studio/briefs/'+brief.id;
 const proposal={producer:'Example provider',due:'2027-03-12',authorised:false};
 const proposed=await call('other',path+'/handoff','POST',proposal,201);
 assert.equal((await call('other',path+'/handoff','POST',proposal)).handoffId,proposed.handoffId);
 await call('web',path+'/handoff','POST',{...proposal,authorised:true},409);
 await call('web',path+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test/fictional'},409);
 const link={platform:'youtube',url:'https://example.test/fictional-post'};
 await call('web',path+'/publish-link','POST',link,409);
 env.SANDY_CLUB_APPROVALS='enabled';
 await call('other',path+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test/fictional'},403);
 await call('web',path+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test/fictional'});
 const authorised=await call('web',path+'/handoff','POST',{...proposal,authorised:true},201);
 assert.equal(authorised.state,'authorised');assert.equal(authorised.sent,false);
 assert.equal((await call('web',path+'/handoff','POST',{...proposal,authorised:true})).handoffId,authorised.handoffId);
 await call('web',path+'/publish-link','POST',link,409);
 await call('web',path+'/decision','POST',{version:2,decision:'publish_authorised',evidence:'https://example.test/fictional'});
 await call('other',path+'/publish-link','POST',link,403);
 const published=await call('sec',path+'/publish-link','POST',link,201);
 assert.equal((await call('sec',path+'/publish-link','POST',link)).linkId,published.linkId);
 env.SANDY_CLUB_APPROVALS='disabled';
 await call('web',path+'/publish-link','POST',link,409);
 env.SANDY_CLUB_APPROVALS='enabled';
 await call('web',path+'/decision','POST',{version:3,decision:'returned',evidence:'https://example.test/review'});
 await call('web',path+'/publish-link','POST',link,409);
 await call('web',path+'/handoff','POST',{...proposal,authorised:true},409);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM studio_handoffs').get().n,2);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM studio_post_links').get().n,1);
});
