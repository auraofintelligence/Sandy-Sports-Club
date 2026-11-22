import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {database} from './d1-fixture.mjs';
import {handleRequest} from '../worker/index.mjs';
import {privateAreaKeys,sealPrivateText} from '../worker/member-network.mjs';

const origin='https://club.example', path='/api/committee/equipment';
async function setup(t,withLinks=true) {
  const db=database(t,['0000_clubhouse.sql','0001_access_and_meetings.sql','0007_members_and_conversation.sql','0037_club_equipment.sql','0038_sponsor_offers.sql',...(withLinks?['0039_sponsor_loan_items.sql']:[])]);
  const env={DB:db,PRIVATE_AUTH_KEY:'equipment-fixture'}, cookies={};
  for (const [name,role] of [['secretary','committee'],['president','committee'],['treasurer','treasurer'],['member','member']]) {
    const token=randomBytes(32).toString('hex');
    await db.batch([db.prepare("INSERT INTO club_accounts(id,login,role,salt,verifier,created_at,paid_through) VALUES(?,?,?,'s','v',0,'2099-12-31')").bind(name,name,role),
      db.prepare('INSERT INTO club_sessions VALUES(?,?,4102444800)').bind(createHash('sha256').update(token).digest('hex'),name)]);
    cookies[name]='__Host-sandy_session='+token;
  }
  async function api(role,body=null,status=200,query='') {
    const headers={Origin:origin,'Content-Type':'application/json'};if(cookies[role])headers.Cookie=cookies[role];
    const r=await handleRequest(new Request(origin+path+query,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);
    const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));
    if(r.ok)assert.match(r.headers.get('Cache-Control'),/private, no-store/);
    return data;
  }
  const packet=(action,id,extra={})=>({action,id,mutationId:randomUUID(),...extra});
  const hand={onDate:'2024-05-01',custodian:'Club volunteer',location:'Private shed'};
  return {db,api,packet,hand};
}

test('a single-item sponsor loan recorded before the multi-item migration keeps its identity and rejects an unintentional duplicate',async t=>{
  const {db,api,packet,hand}=await setup(t,false), offer=randomUUID(), id=randomUUID();
  const keys=await privateAreaKeys('equipment-fixture','Sandy private equipment register v1');
  const fields={name:'Marquee',lender:'Private donor',lenderContact:'',custodian:hand.custodian,location:hand.location,notes:''};
  const cipher=await sealPrivateText(keys.content,'club-equipment:'+id+':1',JSON.stringify(fields));
  await db.prepare("INSERT INTO sponsor_offers(id,request_key,source,offer_cipher,status,loan_eligible,created_at,updated_at) VALUES(?,?,'nomination','sample','agreed',1,'2024','2024')").bind(offer,offer).run();
  await db.prepare("INSERT INTO club_equipment(id,owner_type,status,on_date,private_details,source_offer_id,updated_at) VALUES(?,'sponsor','available','2024-05-01',?,?,'2024-05-01')").bind(id,cipher,offer).run();
  db.migrate('0039_sponsor_loan_items.sql');
  const linked=(await api('president',null,200,'?offer='+offer)).items;
  assert.equal(linked[0].id,id);assert.equal(linked[0].name,'Marquee');
  const add=packet('create',randomUUID(),{...hand,name:'Marquee',lender:'Private donor',ownerType:'sponsor',sourceOfferId:offer});
  await api('secretary',add,409);await api('secretary',{...add,name:'Esky 2'},201);
  assert.equal((await api('secretary',null,200,'?offer='+offer)).items.length,2);
});

test('committee records real club and borrowed gear, overdue loans and handovers with encrypted private details',async t=>{
  const {db,api,packet,hand}=await setup(t),id=randomUUID(),club=randomUUID();
  const create=packet('create',id,{...hand,ownerType:'member',name:'Member table',lender:'Private lender',lenderContact:'0400 123 456',lenderDue:'2024-05-04',notes:'One spare leg'});
  for(const [role,status] of [['visitor',401],['member',403]]){await api(role,null,status);await api(role,create,status);}
  assert.equal((await api('president')).total,0);
  await api('president',{...create,lender:''},400);
  const first=await api('president',create,201);assert.equal(first.item.lender,create.lender);assert.ok(first.item.overdue);assert.equal(first.history[0].officer,'President');
  await api('president',create);await api('secretary',create,409);await api('president',{...create,name:'Different table'},409);
  const lend=packet('lend',id,{version:1,...hand,custodian:'Event volunteer',location:'Hotel',loanDue:'2024-05-03'});
  await api('secretary',{...lend,loanDue:'2024-06-01'},400);
  const out=await api('secretary',lend);assert.equal(out.item.status,'out');await api('secretary',lend);
  await api('president',{...lend,mutationId:randomUUID()},409);
  assert.equal((await api('treasurer',null,200,'?filter=out')).items[0].custodian,'Event volunteer');
  assert.equal((await api('treasurer',null,200,'?filter=overdue')).total,1);
  const checked=await api('treasurer',packet('checkIn',id,{version:2,...hand,onDate:'2024-05-02'}));
  assert.equal(checked.item.status,'available');assert.equal(checked.item.loanDue,'');
  const returned=await api('president',packet('returnOwner',id,{version:3,...hand,custodian:'Private lender',onDate:'2024-05-03'}));
  assert.equal(returned.item.status,'returned');assert.equal(returned.item.overdue,false);assert.equal(returned.history.length,4);
  assert.deepEqual(returned.history.map(x=>x.officer),['President','Treasurer','Secretary','President']);
  await api('treasurer',packet('lend',id,{...hand,version:4,loanDue:'2024-05-04'}),409);
  const clubGear=packet('create',club,{...hand,ownerType:'club',name:'Club marquee'});
  await api('secretary',clubGear,201);
  await api('treasurer',packet('returnOwner',club,{...hand,version:1}),400);
  await api('secretary',packet('lend',club,{...hand,custodian:'Gear keeper',location:'The oval',version:1,loanDue:'2024-05-03'}));
  await api('president',packet('edit',club,{...hand,name:'Club marquee',version:2,loanDue:'2024-06-03',location:'Other storage'}));
  const raw=JSON.stringify(await db.batch([db.prepare('SELECT * FROM club_equipment'),db.prepare('SELECT * FROM club_equipment_history'),db.prepare('SELECT * FROM audit_log')]));
  for(const privateValue of ['Private lender','0400 123 456','Private shed','Event volunteer','One spare leg','Other storage','Club marquee'])assert.ok(!raw.includes(privateValue));
  assert.equal((await api('secretary',null,200,'?id='+club)).item.location,'Other storage');
  assert.equal((await api('treasurer',null,200,'?filter=returned')).total,1);
});

test('separately named sponsor equipment can be returned independently and failed activity writes roll back custody',async t=>{
  const {db,api,packet,hand}=await setup(t),offer=randomUUID(),id=randomUUID();
  await db.prepare("INSERT INTO sponsor_offers(id,request_key,source,offer_cipher,status,loan_eligible,created_at,updated_at) VALUES(?,?,'nomination','sample','reviewing',1,'2024','2024')").bind(offer,offer).run();
  const create=packet('create',id,{...hand,name:'Shelter',lender:'Private supporter',ownerType:'sponsor',sourceOfferId:offer});
  await api('secretary',create,409);assert.deepEqual((await api('secretary',null,200,'?offer='+offer)).items,[]);
  await db.prepare("UPDATE sponsor_offers SET status='agreed' WHERE id=?").bind(offer).run();
  await api('secretary',create,201);
  await api('treasurer',{...create,name:'  SHELTER ',id:randomUUID(),mutationId:randomUUID()},409);
  const esky=randomUUID();
  await api('secretary',{...create,name:'Esky 1',id:esky,mutationId:randomUUID(),lenderDue:'2024-05-08'},201);
  await api('secretary',packet('edit',esky,{...hand,name:'Shelter',lender:'Private supporter',version:1}),409);
  await api('treasurer',packet('returnOwner',esky,{...hand,onDate:'2024-05-05',version:1}));
  const linked=(await api('treasurer',null,200,'?offer='+offer)).items;
  assert.equal(linked.length,2);assert.equal(linked.find(i=>i.id===id).status,'available');
  assert.equal(linked.find(i=>i.id===esky).status,'returned');assert.equal(linked.find(i=>i.id===esky).lenderDue,'2024-05-08');
  const loan=packet('lend',id,{...hand,version:1,loanDue:'2024-05-12'});
  await db.prepare("CREATE TRIGGER fail_equipment_audit BEFORE INSERT ON audit_log WHEN NEW.action='equipment_lend' BEGIN SELECT raise(abort,'failed fixture'); END").run();
  await api('secretary',loan,500);
  const result=await api('president',null,200,'?id='+id);
  assert.equal(result.history.length,1);assert.equal(result.item.status,'available');assert.equal(result.item.version,1);
});
