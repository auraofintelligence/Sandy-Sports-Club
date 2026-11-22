import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,webcrypto} from 'node:crypto';
import {readdirSync} from 'node:fs';
import {database} from './d1-fixture.mjs';
import {handleRequest} from '../worker/index.mjs';

globalThis.crypto??=webcrypto;
const hex=()=>randomBytes(32).toString('hex');
const origin='https://sandy.test';
const migrations=()=>readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
const cookie=response=>response.headers.get('set-cookie')?.split(';')[0];
function call(env,path,{method='GET',data,session,viewAs}={}){
  const headers={Origin:origin};
  if(data)headers['Content-Type']='application/json';
  if(session)headers.Cookie=session;
  if(viewAs)headers['X-Sandy-View-As']=viewAs;
  return handleRequest(new Request(origin+path,{method,headers,body:data?JSON.stringify(data):undefined}),env);
}

test('fresh Sandy database provisions one Webmaster and activates a reserved office only by private invitation',async t=>{
  const db=database(t,migrations()),token=hex(),password='A distinct secure Webmaster password';
  const env={DB:db,PRIVATE_AUTH_KEY:hex(),SANDY_BOOTSTRAP_TOKEN:token};
  const state=()=>db.prepare(`SELECT
    (SELECT count(*) FROM club_accounts WHERE role='member') AS members,
    (SELECT count(*) FROM club_accounts WHERE role='administrator') AS admins,
    (SELECT count(*) FROM club_accounts WHERE disabled=1) AS disabled,
    (SELECT count(*) FROM club_invites WHERE used_by IS NULL AND expires>strftime('%s','now')) AS liveInvites,
    (SELECT count(*) FROM club_sessions) AS sessions`).first();
  assert.deepEqual(await state(),{members:0,admins:0,disabled:5,liveInvites:0,sessions:0});
  assert.equal((await db.prepare("SELECT count(*) AS n FROM office_slots WHERE status='reserved' AND assigned_at IS NULL AND assigned_by IS NULL").first()).n,5);
  const unpriced=await call(env,'/api/shop/requests',{method:'POST',data:{
    requestId:crypto.randomUUID(),kind:'enquiry',productId:'shirt',name:'Example visitor',
    email:'example@example.invalid',mobile:'',quantity:1,size:'',message:'Is the sample shirt available?',consent:true
  }});
  assert.equal(unpriced.status,409);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM merch_shop_requests').first()).n,0);
  assert.equal((await call(env,'/api/auth/login',{method:'POST',data:{login:'secretary',password:'any password'}})).status,401);
  const bootstrap=data=>call(env,'/api/auth/bootstrap',{method:'POST',data:{login:'webmaster',password,...data}});
  assert.equal((await bootstrap({token:hex()})).status,403);
  assert.equal((await state()).admins,0);
  const created=await bootstrap({token});assert.equal(created.status,200);
  const adminSession=cookie(created);assert.match(adminSession,/^__Host-sandy_session=/);
  assert.equal((await bootstrap({token})).status,409);
  assert.equal((await state()).admins,1);
  const admin=(await call(env,'/api/session',{session:adminSession}));
  assert.equal((await admin.json()).administrator,true);
  const officeView=await (await call(env,'/api/session',{session:adminSession,viewAs:'secretary'})).json();
  assert.equal(officeView.administrator,false);assert.equal(officeView.webmasterViewer,true);
  assert.equal(officeView.accountRole,'committee');assert.equal(officeView.viewAs,'secretary');assert.equal(officeView.readOnly,true);
  const tasks=await (await call(env,'/api/committee/todos',{session:adminSession,viewAs:'secretary'})).json();
  assert.equal(tasks.viewerOffice,'secretary');assert.equal(tasks.offices.length,5);
  const grants=await (await call(env,'/api/committee/grants',{session:adminSession,viewAs:'secretary'})).json();
  for(const office of ['president','vicepresident','secretary','assistantsecretary','treasurer'])
    assert.ok(Object.hasOwn(grants.offices,office));
  const memberView=await (await call(env,'/api/session',{session:adminSession,viewAs:'member'})).json();
  assert.equal(memberView.role,'signed_in');assert.equal(memberView.readOnly,true);
  assert.equal((await call(env,'/api/accounts/invite',{session:adminSession,viewAs:'secretary',method:'POST',data:{login:'secretary',role:'committee'}})).status,403);
  const reserved=await db.prepare("SELECT id,disabled,role FROM club_accounts WHERE login='secretary'").first();
  assert.equal(reserved.disabled,1);assert.equal(reserved.role,'committee');
  const issue=data=>call(env,'/api/accounts/invite',{method:'POST',session:adminSession,data});
  assert.equal((await issue({login:'president',role:'treasurer'})).status,400);
  assert.equal((await call(env,'/api/accounts/invite',{method:'POST',data:{login:'secretary',role:'committee'}})).status,401);
  const invite=await issue({login:'secretary',role:'committee'});assert.equal(invite.status,201);
  const {token:officeToken}=await invite.json();
  const stored=await db.prepare("SELECT reset_id,invite_ref,invite_copy,used_by FROM club_invites WHERE login='secretary'").first();
  assert.equal(stored.reset_id,reserved.id);assert.equal(stored.invite_ref.length,32);
  assert.ok(stored.invite_copy&&!stored.invite_copy.includes(officeToken));assert.equal(stored.used_by,null);
  assert.equal((await db.prepare("SELECT disabled FROM club_accounts WHERE login='secretary'").first()).disabled,1);
  assert.equal((await call(env,'/api/auth/login',{method:'POST',data:{login:'secretary',password:'any password'}})).status,401);
  const pending=await (await call(env,'/api/accounts/invitations',{session:adminSession})).json();
  assert.equal(pending.invitations.length,1);assert.equal(pending.invitations[0].login,'secretary');
  const recovered=await (await call(env,'/api/accounts/invitations',{method:'POST',session:adminSession,data:{action:'copy',id:stored.invite_ref}})).json();
  assert.equal(recovered.token,officeToken);
  const info=await (await call(env,'/api/auth/invitation',{method:'POST',data:{token:officeToken}})).json();
  assert.equal(info.resetting,false);assert.equal(info.destination,'committee');
  const officePassword='A distinct secure Secretary password';
  const activation=await call(env,'/api/auth/activate',{method:'POST',data:{login:'secretary',password:officePassword,token:officeToken}});
  assert.equal(activation.status,200);
  assert.equal((await call(env,'/api/auth/activate',{method:'POST',data:{login:'secretary',password:officePassword,token:officeToken}})).status,400);
  assert.equal((await call(env,'/api/auth/login',{method:'POST',data:{login:'secretary',password:officePassword}})).status,200);
  const assigned=await db.prepare("SELECT s.status,s.assigned_at AS assignedAt,s.assigned_by AS assignedBy,a.disabled FROM office_slots s JOIN club_accounts a ON a.id=s.account_id WHERE s.office='secretary'").first();
  assert.equal(assigned.status,'active');assert.ok(assigned.assignedAt);assert.equal(assigned.disabled,0);
  assert.equal(assigned.assignedBy,(await db.prepare("SELECT id FROM club_accounts WHERE login='webmaster'").first()).id);
  assert.equal((await state()).members,0);assert.equal((await state()).disabled,4);
  assert.equal((await (await call(env,'/api/accounts/invitations',{session:adminSession})).json()).invitations.length,0);
  assert.equal((await call(env,'/api/accounts/disable',{method:'POST',session:adminSession,data:{id:reserved.id}})).status,200);
  assert.equal((await call(env,'/api/auth/login',{method:'POST',data:{login:'secretary',password:officePassword}})).status,401);
  assert.deepEqual(await db.prepare("SELECT status,assigned_at,assigned_by FROM office_slots WHERE office='secretary'").first(),
    {status:'reserved',assigned_at:null,assigned_by:null});
});
