import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {database} from './d1-fixture.mjs';
import {handleRequest} from '../worker/index.mjs';

const origin='https://club.example',member='/api/member/equipment-wishes',committee='/api/committee/equipment-wishes';
const grantRegister='/api/committee/grants';
async function fixture(t,extraMigrations=[]) {
  const db=database(t,['0000_clubhouse.sql','0001_access_and_meetings.sql','0007_members_and_conversation.sql','0040_equipment_wishes.sql',...extraMigrations]);
  const env={DB:db,PRIVATE_AUTH_KEY:'private-key-for-unit-test'},cookies={};
  for(const [login,role] of [['treasurer','treasurer'],['web','administrator'],['secretary','committee'],['assistantsecretary','committee'],['member','member'],['expired','member']]){
    const token=randomBytes(32).toString('hex');
    await db.batch([db.prepare("INSERT INTO club_accounts(id,login,role,salt,verifier,created_at,paid_through) VALUES(?,?,?,'s','v',0,?)").bind(login,login,role,login==='expired'?'2010-01-01':'2099-12-31'),
      db.prepare('INSERT INTO club_sessions VALUES(?,?,4102444800)').bind(createHash('sha256').update(token).digest('hex'),login)]);
    cookies[login]='__Host-sandy_session='+token;
  }
  async function api(who,path=committee,data=null,status=200) {
    const headers={Origin:origin,'Content-Type':'application/json'};if(cookies[who])headers.Cookie=cookies[who];
    const res=await handleRequest(new Request(origin+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined}),env);
    const body=await res.json();
    if(Array.isArray(status)){assert.ok(status.includes(res.status),JSON.stringify(body));return res.status;}
    assert.equal(res.status,status,JSON.stringify(body));if(res.ok)assert.match(res.headers.get('Cache-Control'),/private, no-store/);
    return body;
  }
  const packet=(action,id,fields={})=>({action,id,mutationId:randomUUID(),...fields});
  return {db,api,packet};
}

test('only active members can read explicitly published wishes, including in-kind and fulfilled equipment',async t=>{
  const {api,packet}=await fixture(t),id=randomUUID(),details={name:'Folding tables',purpose:'Tables for the club barbecue.',goalCents:0};
  const create=packet('create',id,details);
  for(const [role,status] of [['visitor',401],['expired',403]]){await api(role,member,null,status);await api(role,committee,null,status);}
  await api('member',committee,null,403);await api('member',member,create,405);
  const created=await api('secretary',committee,create,201);
  assert.equal(created.canRecordMoney,false);assert.equal(created.wishes[0].published,false);
  assert.equal((await api('treasurer')).canRecordMoney,true);
  assert.deepEqual((await api('member',member)).wishes,[]);
  await api('assistantsecretary',committee,packet('edit',id,{...details,name:'Two folding tables',version:1}));
  await api('secretary',committee,packet('publish',id,{version:1}),409);
  await api('secretary',committee,packet('publish',id,{version:2}));
  const visible=(await api('member',member)).wishes[0];
  assert.deepEqual(visible,{id,name:'Two folding tables',purpose:details.purpose,goalCents:0,totalCents:0,status:'active',history:[]});
  await api('treasurer',committee,packet('money',id,{version:3,kind:'receipt',amountCents:180,onDate:'2023-10-01',note:'Cash for tables'}),400);
  await api('assistantsecretary',committee,packet('fulfil',id,{version:3}));
  assert.equal((await api('member',member)).wishes[0].status,'fulfilled');
  await api('secretary',committee,packet('unpublish',id,{version:4}));
  assert.deepEqual((await api('member',member)).wishes,[]);
  await api('assistantsecretary',committee,packet('reopen',id,{version:5}));assert.equal((await api('secretary')).wishes[0].published,false);
  await api('secretary',committee,packet('edit',id,{...details,name:'<b>Unsafe</b>',version:6}),400);
  await api('secretary',committee,packet('create',randomUUID(),{...details,published:true}),400);
});

const grantMigrations=['0049_grant_register.sql','0055_grant_equipment_wishes.sql'];
const newGrant=title=>({id:randomUUID(),version:0,title,stage:'checking',office:'president'});

test('Sandy starter wishes are private drafts and reapplying them preserves officer work',async t=>{
  const {api,db,packet}=await fixture(t,grantMigrations);
  const existing=randomUUID(),migration='0060_sandy_starter_wishes.sql';
  await api('secretary',committee,packet('create',existing,{name:'Existing equipment idea',purpose:'Officer request',goalCents:0}),201);
  db.migrate(migration);
  const records=(await api('secretary')).wishes;
  assert.equal(records.length,9);
  const added=records.filter(w=>w.id!==existing);
  assert.ok(added.every(w=>!w.published && w.goalCents===0 && w.totalCents===0 && w.ledger.length===0 && w.name.length<=100 && w.purpose.length<=360));
  assert.ok(added.some(w=>w.name.includes('volleyball')) && added.some(w=>w.name.includes('Modular outdoor LED')));
  assert.deepEqual((await api('member',member)).wishes,[]);
  const [wish]=added;
  await api('secretary',committee,packet('edit',wish.id,{name:'Gear for our next local meet',purpose:'Officer edit',goalCents:0,version:1}));
  db.migrate(migration);
  const after=(await api('secretary')).wishes;
  assert.equal(after.length,9);
  assert.equal(after.find(w=>w.id===existing).purpose,'Officer request');
  assert.equal(after.find(w=>w.id===wish.id).name,'Gear for our next local meet');
  const history=await db.prepare("SELECT COUNT(*) AS count FROM equipment_wish_activity WHERE action='starter_draft'").first();
  assert.equal(history.count,0);
  const grants=await api('secretary',grantRegister);
  assert.equal(grants.wishes.length,9);assert.equal(grants.grants.length,0);
});

test('existing grants and wishes survive migration and an in-flight legacy grant save can be retried',async t=>{
  const {api,db,packet}=await fixture(t,[grantMigrations[0]]);
  const grant=newGrant('Earlier grant round'),id=randomUUID();
  await db.prepare("INSERT INTO committee_grants(id,title,funder,office,stage,updated_by,updated_at) VALUES(?,?,'',?,?,'secretary','2025-08-20T00:00:00Z')")
    .bind(grant.id,grant.title,grant.office,grant.stage).run();
  await api('secretary',committee,packet('create',id,{name:'Existing table',purpose:'Club meals',goalCents:5000}),201);
  db.migrate(grantMigrations[1]);
  const existing=await api('secretary',grantRegister,grant);
  assert.deepEqual(existing.grants[0].wishIds,[]);assert.equal(existing.grants[0].version,1);assert.equal(existing.wishes[0].id,id);
  const linked=await api('secretary',grantRegister,{...grant,version:1,wishIds:[id]});
  assert.equal(linked.grants[0].version,2);assert.deepEqual(linked.grants[0].wishIds,[id]);
});

test('retired PLFC wish migrations cannot seed fishing gear into Sandy',async t=>{
  const practical='0057_practical_club_wishes.sql';
  const {api,db,packet}=await fixture(t,[...grantMigrations,'0056_starter_equipment_wishes.sql',practical]);
  const initial=(await api('secretary')).wishes;
  assert.equal(initial.length,0);
  db.migrate(practical);
  const refreshed=(await api('secretary')).wishes;
  assert.equal(refreshed.length,0);
  assert.deepEqual((await api('member',member)).wishes,[]);
});

test('grant links are many to many, private to the committee, and never change received funds',async t=>{
  const {api,packet,db}=await fixture(t,grantMigrations);
  const shade=randomUUID(),tub=randomUUID();
  await api('secretary',committee,packet('create',shade,{name:'Marquee',purpose:'Shade for club events',goalCents:75000}),201);
  await api('secretary',committee,packet('create',tub,{name:'Bait tub',purpose:'Club meet-ups',goalCents:0}),201);
  await api('secretary',committee,packet('publish',shade,{version:1}));
  await api('treasurer',committee,packet('money',shade,{version:2,kind:'receipt',amountCents:5000,onDate:'2025-10-01',note:'Private reference 4402'}));
  const memberBefore=await api('member',member),cashBefore=(await api('secretary')).wishes;
  const grant={...newGrant('Community equipment round'),wishIds:[shade,tub]},other=newGrant('Second funder');
  for(const [role,status] of [['visitor',401],['member',403],['expired',403]]){
    await api(role,grantRegister,null,status);await api(role,grantRegister,grant,status);
  }
  const register=await api('secretary',grantRegister,grant);
  assert.deepEqual(register.grants[0].wishIds,[shade,tub].sort());
  assert.deepEqual(register.wishes.find(w=>w.id===shade),{id:shade,name:'Marquee',purpose:'Shade for club events',goalCents:75000,totalCents:5000,status:'active',published:true});
  assert.equal(register.wishes.find(w=>w.id===tub).published,false);
  assert.ok(!JSON.stringify(register).includes('Private reference'));
  await api('secretary',grantRegister,{...grant,wishIds:[tub,shade,shade]});
  await api('secretary',grantRegister,{...grant,wishIds:[shade]},409);
  await api('assistantsecretary',grantRegister,other);
  const link={action:'linkWish',id:other.id,version:1,wishId:shade};
  const linked=await api('treasurer',grantRegister,link);
  assert.equal(linked.grants.filter(row=>row.wishIds.includes(shade)).length,2);
  await api('treasurer',grantRegister,link);await api('secretary',grantRegister,link,409);
  const oldClient={...other,version:2,stage:'delivery'};
  const approved=await api('assistantsecretary',grantRegister,oldClient);
  assert.deepEqual(approved.grants.find(g=>g.id===other.id).wishIds,[shade]);
  await api('assistantsecretary',grantRegister,oldClient);
  assert.deepEqual(await api('member',member),memberBefore);
  assert.deepEqual((await api('secretary')).wishes,cashBefore);
  const unlink={action:'unlinkWish',id:other.id,version:3,wishId:shade};
  await api('secretary',grantRegister,unlink);await api('secretary',grantRegister,unlink);
  const final=await api('secretary',grantRegister,{...grant,version:1,wishIds:[]});
  assert.ok(final.grants.every(g=>g.wishIds.length===0));
  const audit=await db.prepare("SELECT action FROM audit_log WHERE action LIKE 'grant_%' ORDER BY rowid").all();
  assert.deepEqual(audit.results.map(r=>r.action),['grant_added','grant_added','grant_wish_linked','grant_updated','grant_wish_unlinked','grant_updated']);
});

test('simultaneous edits, unknown wishes and a failed link cannot partially save a grant',async t=>{
  const {api,db,packet}=await fixture(t,grantMigrations);
  const first=randomUUID(),second=randomUUID(),grant=newGrant('Council round');
  for(const id of [first,second])await api('secretary',committee,packet('create',id,{name:'Club kit',purpose:'Community events',goalCents:20000}),201);
  await api('secretary',grantRegister,{...grant,wishIds:[first,randomUUID()]},400);
  assert.equal((await api('secretary',grantRegister)).grants.length,0);
  await api('secretary',grantRegister,grant);
  const outcomes=await Promise.all([
    api('secretary',grantRegister,{...grant,version:1,wishIds:[first]},[200,409]),
    api('assistantsecretary',grantRegister,{action:'linkWish',id:grant.id,version:1,wishId:second},[200,409])
  ]);
  assert.deepEqual([...outcomes].sort(),[200,409]);
  const current=(await api('secretary',grantRegister)).grants[0],winner=outcomes[0]===200?first:second,other=winner===first?second:first;
  assert.deepEqual(current.wishIds,[winner]);assert.equal(current.version,2);
  await api('secretary',grantRegister,{...grant,version:2,title:'Should roll back',wishIds:[randomUUID()]},400);
  await api('secretary',grantRegister,{action:'unlinkWish',id:grant.id,version:2,wishId:randomUUID()},400);
  await db.prepare("CREATE TRIGGER fail_link BEFORE INSERT ON committee_grant_wishes BEGIN SELECT raise(abort,'failed link write'); END").run();
  await api('secretary',grantRegister,{...grant,version:2,title:'Should roll back',wishIds:[other]},500);
  assert.deepEqual((await api('secretary',grantRegister)).grants[0],current);
});

test('creating a wish from a saved grant atomically links the draft with safe retries',async t=>{
  const {api,db,packet}=await fixture(t,grantMigrations);
  const grant=newGrant('Island fund');
  await api('secretary',grantRegister,grant);
  const create=packet('create',randomUUID(),{name:'Loan rods',purpose:'Let families try fishing',goalCents:10000,sourceGrantId:grant.id,sourceGrantVersion:1});
  await api('secretary',committee,{...create,sourceGrantVersion:0},400);
  await api('secretary',committee,{...create,sourceGrantVersion:2},409);
  assert.deepEqual((await api('secretary')).wishes,[]);
  await db.prepare("CREATE TRIGGER fail_link BEFORE INSERT ON committee_grant_wishes BEGIN SELECT raise(abort,'failed link write'); END").run();
  await api('secretary',committee,create,500);
  assert.deepEqual((await api('secretary')).wishes,[]);assert.equal((await api('secretary',grantRegister)).grants[0].version,1);
  await db.prepare('DROP TRIGGER fail_link').run();
  const created=(await api('secretary',committee,create,201)).wishes[0];
  assert.equal(created.published,false);assert.equal(created.totalCents,0);assert.deepEqual(created.ledger,[]);
  await api('secretary',committee,create);await api('treasurer',committee,create,409);
  const linked=(await api('secretary',grantRegister)).grants[0];
  assert.equal(linked.version,2);assert.deepEqual(linked.wishIds,[create.id]);
  assert.deepEqual((await api('member',member)).wishes,[]);
  await api('secretary',grantRegister,{action:'unlinkWish',id:grant.id,version:2,wishId:create.id});
  await api('secretary',committee,create);
  assert.deepEqual((await api('secretary',grantRegister)).grants[0].wishIds,[]);
});

test('financial writes are atomic, private, dated and retry-safe; members receive only daily running totals',async t=>{
  const {api,db,packet}=await fixture(t),id=randomUUID(),details={name:'Club marquee',purpose:'Shade at local meets',goalCents:75000};
  const money=(kind,amountCents,onDate,version,note='Internal reference M-19')=>packet('money',id,{kind,amountCents,onDate,version,note});
  await api('secretary',committee,packet('create',id,details),201);await api('secretary',committee,packet('publish',id,{version:1}));
  const first=money('receipt',10000,'2023-07-01',2);
  await api('secretary',committee,first,403);await api('treasurer',committee,{...first,onDate:'2099-01-01'},400);
  await api('treasurer',committee,{...first,note:''},400);await api('treasurer',committee,{...first,amountCents:-10},400);
  const initial=(await api('treasurer',committee,first)).wishes[0];assert.equal(initial.ledger[0].actor,'Treasurer');
  await api('treasurer',committee,first);await api('web',committee,first,409);await api('treasurer',committee,{...first,amountCents:159},409);
  const a=money('receipt',2000,'2023-07-01',3),b=money('receipt',3000,'2023-07-01',3);
  const concurrent=await Promise.all([api('treasurer',committee,a,[200,409]),api('web',committee,b,[200,409])]);
  assert.deepEqual([...concurrent].sort(),[200,409]);
  const won=concurrent[0]===200?2000:3000;
  const third=money('receipt',10500,'2023-07-03',4);
  await api('web',committee,third);await api('treasurer',committee,money('adjustment',-17000,'2023-07-02',5),400);
  const correct=money('adjustment',-500,'2023-07-02',5,'Bank adjustment, private transaction T88');
  const corrected=await api('web',committee,correct);
  assert.equal(corrected.wishes[0].ledger.length,4);assert.ok(corrected.wishes[0].ledger.every(e=>e.note&&e.actor&&e.recordedAt));
  await api('secretary',committee,packet('edit',id,{...details,version:6,goalCents:0}),400);
  await api('treasurer',committee,first);
  const memberRead=await api('member',member),visible=memberRead.wishes[0];
  assert.deepEqual(visible.history,[{day:'2023-07-01',totalCents:10000+won},{day:'2023-07-02',totalCents:9500+won},{day:'2023-07-03',totalCents:20000+won}]);
  assert.equal(visible.totalCents,20000+won);
  for(const term of ['T88','M-19','receipt','ledger','actor','Treasurer','Webmaster','recordedAt',first.mutationId])assert.ok(!JSON.stringify(memberRead).includes(term));
  const raw=JSON.stringify(await db.prepare('SELECT * FROM equipment_wish_activity').all());
  assert.ok(!raw.includes('M-19')&&!raw.includes('T88'));
  const sql='UPDATE equipment_wish_activity SET amount_cents=1 WHERE mutation_id=?';
  await assert.rejects(db.prepare(sql).bind(first.mutationId).run(),/permanent/);
  await db.prepare("CREATE TRIGGER fail_wish_log BEFORE INSERT ON audit_log WHEN NEW.action='equipment_wish_money' BEGIN SELECT raise(abort,'fixture failure'); END").run();
  await api('treasurer',committee,money('receipt',5000,'2023-07-04',6),500);
  const final=(await api('member',member)).wishes[0];assert.deepEqual(final,visible);
});
