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
  const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>{if(/\bRETURNING\b/i.test(query)){const results=q.all(...args);return {results,meta:{changes:results.length}}}return {meta:{changes:Number(q.run(...args).changes)}}}});
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
 async function request(who,path,method='GET',body,origin='https://sandy.test',extraHeaders={}){
  const headers={Origin:origin,'Content-Type':'application/json',...extraHeaders};
  if(who)headers.Cookie='__Host-sandy_session='+(actors[who]?.token||who);
  return worker.fetch(new Request('https://sandy.test'+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
 }
 async function call(who,path,method='GET',body,status=200){
  const res=await request(who,path,method,body);
  const value=await res.json();assert.equal(res.status,status,JSON.stringify(value));return value;
 }
 function active(who){const id=actors[who].id;sql.prepare("INSERT INTO club_people(id,account_id,full_name,status,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,'Fictional member','active',?,?,'2026-01-01','2026-01-01')").run(randomUUID(),id,id,id)}
 async function verifyAdult(who){await call('web','/api/committee/safeguards','POST',{action:'verify',accountId:actors[who].id,version:0,ageBand:'adult',guardianPermission:false,ageCheckedOffline:true})}
 return {sql,env,actors,call,active,request,verifyAdult};
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
 const {call,sql,env,active,verifyAdult}=fixture(t);
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
 env.SANDY_CLUB_APPROVALS='enabled';active('member');await verifyAdult('member');
 // Simulate a legacy wrongly-approved support row without touching real data.
 sql.prepare("UPDATE club_records SET status='approved' WHERE id=?").run(help.id);
 const workspace=await call('member','/api/member/workspace');
 assert.ok(!JSON.stringify(workspace).includes(help.id));
 assert.ok(!JSON.stringify(await call('member','/api/member/data-export')).includes(help.id));
});
test('private member preferences stay owner-only across register, suite, audit and exports',async t=>{
 const {call,env,active,verifyAdult}=fixture(t);env.SANDY_CLUB_APPROVALS='enabled';active('member');active('member2');await verifyAdult('member');await verifyAdult('member2');
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
 const {call,request,sql,env,actors,active,verifyAdult}=fixture(t);
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
 active('member');env.SANDY_CLUB_APPROVALS='enabled';await verifyAdult('member');
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

test('private participation checks verify age and guardian authority, gate minor access, and preserve owner export after withdrawal',async t=>{
 const {call,sql,env,actors,active}=fixture(t);active('member');active('member2');env.SANDY_CLUB_APPROVALS='enabled';
 const own='/api/member/safeguards',desk='/api/committee/safeguards',prefs='/api/member/preferences',id=actors.member.id;
 const verify=(v,age,guardian,extra={},status=200,who='sec')=>call(who,desk,'POST',{action:'verify',accountId:id,version:v,ageBand:age,guardianPermission:guardian,...extra},status);
 const initial=await call('member',own);assert.equal(initial.ageBand,'unconfirmed');assert.equal(initial.privateAccess,false);
 assert.equal((await call('member','/api/member/workspace')).active,false);
 await call('member',prefs,'POST',{version:0,sports:['Flag football']},403);
 await call('member',desk+'?q=member','GET',undefined,403);await call('treasurer',desk+'?q=member','GET',undefined,403);
 assert.equal((await call('sec',desk)).members.length,0);
 assert.equal((await call('sec',desk+'?q=member')).members[0].accountId,id);
 await verify(0,'under16',true,{},400);await verify(0,'under16',true,{ageCheckedOffline:true},400);
 await verify(0,'under16',true,{ageCheckedOffline:true,guardianCheckedOffline:true,guardianName:'DO NOT STORE'},400);
 await verify(0,'under16',true,{ageCheckedOffline:true,guardianCheckedOffline:true});
 const child=await call('member',own);assert.equal(child.privateAccess,true);assert.equal(child.optionalParticipation,false);
 await call('member',prefs,'POST',{version:0,sports:['Flag football'],publicationConsent:true},403);
 const saved=await call('member',prefs,'POST',{version:0,sports:['Flag football']},201);
 await call('member','/api/member/interest','POST',{area:'volunteer',request:'Example'},403);
 await call('member',own,'POST',{action:'accept',version:1,termsVersion:child.termsVersion},403);
 await verify(1,'under16',false);assert.equal((await call('member','/api/member/workspace')).active,false);
 await call('member',prefs,'POST',{version:1,sports:['Beach cricket']},403);
 await verify(1,'16-17',true,{ageCheckedOffline:true,guardianCheckedOffline:true},409);
 await verify(2,'16-17',true,{ageCheckedOffline:true,guardianCheckedOffline:true});
 assert.equal((await call('member',own)).privateAccess,true);
 await call('member',own,'POST',{action:'accept',version:3,termsVersion:child.termsVersion},403);
 await verify(3,'adult',false,{ageCheckedOffline:true});
 const adult=await call('member',own);assert.equal(adult.privateAccess,true);assert.equal(adult.accepted,false);
 await call('member',own,'POST',{action:'accept',version:4,termsVersion:'old'},409);
 const accepted=await call('member',own,'POST',{action:'accept',version:4,termsVersion:adult.termsVersion});
 assert.equal(accepted.optionalParticipation,true);
 await call('member',prefs,'POST',{version:1,sports:['Flag football'],volunteer:true,publicationConsent:true,contactPreference:'email_when_consented'});
 await call('member','/api/member/interest','POST',{area:'volunteer',request:'Example help'},201);
 const withdrawn=await call('member',own,'POST',{action:'withdraw',version:5,termsVersion:adult.termsVersion});assert.equal(withdrawn.accepted,false);
 const ws=await call('member','/api/member/workspace');assert.equal(ws.active,true);assert.equal(ws.preferences.fields.publicationConsent,false);assert.equal(ws.preferences.fields.volunteer,false);
 const exported=await call('member','/api/member/data-export');assert.equal(exported.preferences.id,saved.id);assert.equal(exported.preferences.fields.publicationConsent,true);assert.equal(exported.safeguards.accepted,false);
 assert.equal((await call('member2','/api/member/data-export')).preferences,null);
 await call('member',own,'POST',{action:'accept',version:6,termsVersion:adult.termsVersion});
 assert.equal((await call('member','/api/member/workspace')).preferences.fields.publicationConsent,false);
 for(const who of ['web','sec','treasurer','other']){
  const all=await call(who,'/api/records?kind=safeguard');assert.ok(!all.records.some(x=>x.id===child.recordId));
  await call(who,'/api/records/'+child.recordId,'GET',undefined,404);
  await call(who,'/api/records/'+child.recordId+'/revisions','GET',undefined,404);
 }
 await call('other','/api/records','POST',{kind:'safeguard',title:'Forged',body:{sandyMemberSafeguard:1,ownerId:id,fields:{ageBand:'adult'}}},400);
 assert.equal((await call('member2',own)).ageBand,'unconfirmed');
 assert.doesNotMatch(JSON.stringify(sql.prepare("SELECT body_json FROM club_records WHERE json_extract(body_json,'$.sandyMemberSafeguard')=1").all()),/guardianName|DO NOT STORE/);
 env.SANDY_CLUB_APPROVALS='disabled';await verify(7,'unconfirmed',false,{},409);
});

test('encrypted private library enforces owner and role ACLs, immutable versions and revocable download tickets',async t=>{
 const {call,request,sql,env,actors,active,verifyAdult}=fixture(t);
 sql.exec(readFileSync(new URL('../backend/migrations/0002_private_library.sql',import.meta.url),'utf8'));
 const path='/api/library',png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=';
 const upload={title:'Fictional finance attachment',scope:'finance',roles:['webmaster'],reviewDate:'2099-01-01',mediaType:'image/png',content:png,source:'Fictional test source',consent:true};
 assert.equal((await call('web',path)).available,false);
 env.SANDY_LIBRARY_KEY=randomBytes(32).toString('hex');
 await call('treasurer',path,'POST',upload,409);
 env.SANDY_PRIVATE_LIBRARY_ENABLED='enabled';
 await call(null,path,'GET',undefined,401);
 await call('sec',path,'POST',upload,403);
 await call('treasurer',path,'POST',{...upload,roles:['committee']},400);
 await call('treasurer',path,'POST',{...upload,consent:false},400);
 await call('treasurer',path,'POST',{...upload,mediaType:'application/pdf'},400);
 const saved=await call('treasurer',path,'POST',upload,201),doc=path+'/'+saved.id;
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM sandy_library_parts').all()).includes(png));
 assert.equal((await call('web',path)).documents[0].id,saved.id);
 assert.equal((await call('sec',path)).documents.length,0);
 assert.equal((await call('other',path)).documents.length,0);
 await call('sec',doc,'GET',undefined,404);await call('sec',doc+'/ticket','GET',undefined,404);
 await call(null,doc+'/ticket','GET',undefined,401);
 const ticket=(await call('web',doc+'/ticket')).ticket;
 const raw=async(who,ticket,method='GET')=>worker.fetch(new Request('https://sandy.test'+doc+'/download',{method,headers:{Cookie:'__Host-sandy_session='+actors[who].token,'X-Sandy-Download':ticket}}),env);
 const download=await raw('web',ticket);assert.equal(download.status,200);assert.match(download.headers.get('Cache-Control'),/no-store/);
 assert.match(download.headers.get('Content-Disposition'),/^attachment/);assert.equal(Buffer.from(await download.arrayBuffer()).toString('base64'),png);
 const head=await raw('web',ticket,'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.equal((await raw('treasurer',ticket)).status,403);
 assert.equal((await raw('web','1000000000.'+ticket.split('.')[1])).status,403);
 await call('treasurer',doc,'PATCH',{action:'access',version:1,roles:[],reviewDate:'2099-01-02',reason:'Fictional permission change'});
 assert.equal((await raw('web',ticket)).status,404);
 const old=(await call('treasurer',doc+'/ticket')).ticket;
 const jpeg=Buffer.from([255,216,255,217]).toString('base64');
 await call('treasurer',doc+'/replace','POST',{version:2,mediaType:'image/jpeg',content:jpeg,source:'Fictional revised source',consent:true});
 assert.equal((await raw('treasurer',old)).status,403);
 const history=(await call('treasurer',doc+'/history')).history;assert.equal(history.length,3);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM sandy_library_versions WHERE document_id=?').get(saved.id).n,2);
 const current=(await call('treasurer',doc+'/ticket')).ticket;
 const updated=await raw('treasurer',current);assert.equal(updated.status,200);assert.equal(Buffer.from(await updated.arrayBuffer()).toString('base64'),jpeg);
 sql.prepare("UPDATE sandy_library_parts SET ciphertext='AAAA' WHERE document_id=? AND content_version=2").run(saved.id);
 assert.equal((await raw('treasurer',current)).status,503);
 env.SANDY_PRIVATE_LIBRARY_ENABLED='disabled';
 await call('treasurer',doc,'PATCH',{action:'withdraw',version:3,reason:'Fictional withdrawal'});
 assert.equal((await raw('treasurer',current)).status,404);
 await call('treasurer',doc+'/ticket','GET',undefined,404);
 assert.equal((await call('treasurer',doc)).document.state,'withdrawn');
 assert.equal((await call('web','/api/audit')).audit.some(x=>x.resourceId===saved.id),false);
 assert.equal((await call('sec','/api/audit')).audit.some(x=>x.resourceId===saved.id),false);
 env.SANDY_PRIVATE_LIBRARY_ENABLED='enabled';env.SANDY_CLUB_APPROVALS='enabled';
 active('member');active('member2');await verifyAdult('member');await verifyAdult('member2');
 const memberUpload={...upload,title:'Fictional private member image',scope:'owner',roles:[]};
 await call('member',path,'POST',memberUpload,403);
 const flags=await call('member','/api/member/safeguards');
 await call('member','/api/member/safeguards','POST',{action:'accept',version:flags.version,termsVersion:flags.termsVersion});
 const own=await call('member',path,'POST',memberUpload,201);
 assert.equal((await call('member',path)).documents[0].id,own.id);
 assert.equal((await call('member2',path)).documents.length,0);
 await call('member2',path+'/'+own.id,'GET',undefined,404);
 await call('web',path+'/'+own.id,'GET',undefined,404);
 const exported=await call('member','/api/member/data-export');assert.equal(exported.privateFiles.documents[0].id,own.id);
 assert.equal((await call('member2','/api/member/data-export')).privateFiles.documents.length,0);
});

test('authentication limits are atomic, bound to source and subject, clean expired counters and reject ambiguous cookies',async t=>{
 const {sql,request,actors}=fixture(t);
 sql.prepare('INSERT INTO club_login_attempts(key,count,expires_epoch) VALUES(?,?,?)').run('expired-fixture-counter',999,0);
 const login=(username,ip)=>request(null,'/api/auth/login','POST',{username,password:'fictional incorrect password'},'https://sandy.test',{'cf-connecting-ip':ip});
 // Concurrent calls from a single address must admit only the first eight guesses.
 const replies=await Promise.all(Array.from({length:12},()=>login('missing-fixture','192.0.2.10')));
 assert.equal(replies.filter(r=>r.status===401).length,8);
 assert.equal(replies.filter(r=>r.status===429).length,4);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM club_login_attempts WHERE key='expired-fixture-counter'").get().n,0);
 // A separate address cannot bypass the aggregate account-name budget.
 const distributed=await Promise.all(Array.from({length:20},(_,i)=>login('missing-fixture','198.51.100.'+(i+1))));
 assert.equal(distributed.filter(r=>r.status===401).length,12);
 assert.equal(distributed.filter(r=>r.status===429).length,8);
 // Distinct usernames cannot bypass the aggregate source budget.
 const spray=await Promise.all(Array.from({length:43},(_,i)=>login('fixture-spray-'+i,'203.0.113.7')));
 assert.equal(spray.filter(r=>r.status===401).length,40);
 assert.equal(spray.filter(r=>r.status===429).length,3);
 const cookies='__Host-sandy_session='+actors.web.token+'; __Host-sandy_session='+actors.sec.token;
 const ambiguous=await request(null,'/api/session','GET',undefined,'https://sandy.test',{Cookie:cookies});
 assert.equal((await ambiguous.json()).authenticated,false);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_login_attempts WHERE key LIKE ?').get('%missing-fixture%').n,0);
});

test('private help status and history remain requester/Webmaster only, and scoped audit pagination and CSV do not leak records',async t=>{
 const {call,request,sql,actors}=fixture(t);
 const help=await call('other','/api/webmaster/requests','POST',{subject:'Fictional private support',category:'Committee workflow',message:'Private fictional request'},201);
 const path='/api/webmaster/requests/'+help.id;
 await call('web',path,'PATCH',{version:1,stage:'review',reply:'Here is https://example.test/#recover=secret'},400);
 await call('web',path,'PATCH',{version:1,stage:'review',reply:'Fictional private reply'});
 assert.equal((await call('other',path)).request.reply,'Fictional private reply');
 const status=await call('other',path+'/status');assert.equal(status.stage,'review');assert.equal(status.version,2);assert.equal(status.reply,undefined);
 const history=(await call('other',path+'/history')).history;assert.equal(history.length,2);assert.equal(history[0].version,2);
 assert.doesNotMatch(JSON.stringify(history),/Private fictional request|Fictional private reply/);
 for(const who of ['sec','treasurer','member'])for(const suffix of ['','/status','/history'])await call(who,path+suffix,'GET',undefined,404);
 await call(null,path+'/history','GET',undefined,401);
 await call('other',path+'/history','PATCH',{version:2},404);
 const stock=await call('treasurer','/api/suite/stock','POST',{title:'Restricted finance fixture',fields:{sku:'FIXTURE',category:'Sports gear',opening:2}},201);
 const allowed=await call('sec','/api/records','POST',{kind:'social_idea',title:'Fictional common audit',body:{notes:'Common'}},201);
 for(let i=0;i<3;i++)await call('sec','/api/records','POST',{kind:'social_idea',title:'Fictional draft '+i,body:{}},201);
 let cursor=null,seen=[];
 do{
  const page=await call('sec','/api/audit?limit=2'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  seen.push(...page.audit);cursor=page.nextCursor;
 }while(cursor);
 assert.equal(new Set(seen.map(x=>x.id)).size,seen.length);
 assert.ok(seen.some(x=>x.resourceId===allowed.id));
 assert.ok(!seen.some(x=>[help.id,stock.id].includes(x.resourceId)));
 const csv=await request('sec','/api/audit?kind=record&format=csv&limit=300');
 assert.equal(csv.status,200);assert.match(csv.headers.get('Cache-Control'),/no-store/);assert.match(csv.headers.get('Content-Type'),/text\/csv/);
 const text=await csv.text();assert.ok(text.includes(allowed.id));assert.ok(!text.includes(help.id)&&!text.includes(stock.id));
 assert.ok(text.includes('brisbaneAt')&&text.includes('office'));
 await call('sec','/api/audit?cursor=bad','GET',undefined,400);
 await call('other','/api/audit?format=csv','GET',undefined,403);
 assert.ok((await call('web','/api/audit?kind=record')).audit.some(x=>x.resourceId===help.id));
});
