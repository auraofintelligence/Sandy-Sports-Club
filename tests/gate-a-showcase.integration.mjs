import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import worker from '../worker/index.mjs';
import {showcaseSql} from '../backend/showcase/seed.mjs';
import {SUITE_DESKS} from '../studio/sandy-suite-spec.js';
import {STAFF} from '../worker/shared.mjs';
const origin='https://sandy.test',digest=value=>createHash('sha256').update(value).digest('hex');
function db(t,sqlText){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());sql.exec(sqlText);
 const binding={prepare(query){
  const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>{if(/\bRETURNING\b/i.test(query)){const results=q.all(...args);return {results,meta:{changes:results.length}}}return {meta:{changes:Number(q.run(...args).changes)}}}});
  return {...bind(),bind};
 },withSession(){return this},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
 return {sql,binding};
}
function setup(t){
 const live=db(t,readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8')),demo=db(t,showcaseSql()),actors={};
 for(const role of [...STAFF,'member']){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  live.sql.prepare("INSERT INTO club_accounts(id,username,role,office_label,state,password_salt,password_verifier,created_utc) VALUES(?,?,?,?,'active','fixture','fixture','2026-01-01')").run(id,'live-'+role,role,role);
  live.sql.prepare('INSERT INTO club_sessions VALUES(?,?,0,4102444800)').run(digest(token),id);
  actors[role]={id,token,cookie:'__Host-sandy_session='+token};
 }
 const real=actors.webmaster.id;
 live.sql.prepare("INSERT INTO club_records(id,kind,title,body_json,status,created_by,updated_by,created_utc,updated_utc) VALUES(?,'social_idea','LIVE PRIVATE SENTINEL','{}','draft',?,?,'2026-01-01','2026-01-01')").run(randomUUID(),real,real);
 const env={DB:live.binding,SANDY_SHOWCASE_DB:demo.binding,SANDY_AUTH_PEPPER:'fictional-live-auth-secret-at-least-32-characters',SANDY_SHOWCASE_KEY:randomBytes(32).toString('hex'),SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
 async function call(path,cookie='',method='GET',body,context,expect=200,otherEnv=env){
  const headers={Origin:origin,'Content-Type':'application/json'};
  if(cookie)headers.Cookie=cookie;if(context)headers['X-Sandy-View']=context;
  const r=await worker.fetch(new Request(origin+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),otherEnv);
  const data=await r.json();assert.equal(r.status,expect,path+' '+JSON.stringify(data));return {data,cookies:r.headers.getSetCookie(),headers:r.headers};
 }
 const viewCookie=r=>r.cookies.find(v=>v.startsWith('__Host-sandy_view=')).split(';')[0];
 return {live,demo,actors,env,call,viewCookie};
}
const readPaths=['/api/records','/api/records?kind=governance','/api/people','/api/interest','/api/meetings','/api/committee/events','/api/committee/social-campaign-settings','/api/committee/social-post-edits','/api/committee/social-metrics','/api/studio/briefs','/api/webmaster/requests','/api/audit','/api/accounts','/api/suite/desks'];
test('owner previews use actual role permissions on all desks and private routes, no live records or changes',async t=>{
 const {live,demo,actors,env,call,viewCookie}=setup(t),owner=actors.webmaster.cookie;
 const liveBefore=live.sql.prepare('SELECT count(*) AS n FROM club_records').get().n;
 assert.equal(demo.sql.prepare('SELECT count(*) AS n FROM club_people').get().n,1);
 assert.equal(demo.sql.prepare("SELECT count(*) AS n FROM club_accounts WHERE role='member'").get().n,0);
 for(const role of [...STAFF.filter(r=>r!=='webmaster'),'member','webmaster_demo']){
  const effective=role==='webmaster_demo'?'webmaster':role;
  const chosen=await call('/api/view/select',owner,'POST',{role});
  const cookies=owner+'; '+viewCookie(chosen);
  const session=(await call('/api/session',cookies)).data,context=session.viewContext;
  assert.equal(session.identity.role,effective);assert.equal(session.readOnly,true);assert.equal(session.synthetic,true);
  assert.notEqual(session.identity.id,actors[effective].id);
  assert.equal(session.canSwitchView,true);
  for(const desk of SUITE_DESKS){
   const allowed=desk.roles.includes(effective);
   await call('/api/suite/'+desk.key,actors[effective].cookie,'GET',undefined,undefined,allowed?200:403);
   const view=await call('/api/suite/'+desk.key,cookies,'GET',undefined,context,allowed?200:403);
   if(allowed){
    assert.equal(view.data.records.length,1);
    const row=view.data.records[0];assert.match(row.title,/^\[EXAMPLE\]/);
    assert.equal((await call('/api/suite/'+desk.key+'/'+row.id,cookies,'GET',undefined,context)).data.record.id,row.id);
    assert.equal((await call('/api/suite/'+desk.key+'/'+row.id+'/history',cookies,'GET',undefined,context)).data.history.length,1);
   }
  }
  const staff=STAFF.includes(effective),people=['webmaster','president','secretary','assistant_secretary','treasurer'].includes(effective),audit=['webmaster','president','secretary'].includes(effective);
  for(const path of readPaths){
   const allowed=path==='/api/accounts'?effective==='webmaster':path==='/api/people'||path==='/api/interest'?people:path==='/api/audit'?audit:path==='/api/webmaster/requests'?true:staff;
   await call(path,actors[effective].cookie,'GET',undefined,undefined,allowed?200:403);
   const view=await call(path,cookies,'GET',undefined,context,allowed?200:403);
   assert.doesNotMatch(JSON.stringify(view.data),/LIVE PRIVATE SENTINEL|live-webmaster/);
  }
  const requests=await call('/api/webmaster/requests',cookies,'GET',undefined,context);
  assert.equal(requests.data.requests.length,effective==='webmaster'?STAFF.length:effective==='member'?0:1);
  if(effective==='member'||effective==='webmaster')assert.equal((await call('/api/member/preview',cookies,'GET',undefined,context)).data.synthetic,true);
  await call('/api/member/data-export',cookies,'GET',undefined,context,403);
  for(const path of ['/api/records','/api/suite/stock','/api/accounts','/api/interest','/api/member/preferences','/api/committee/social-campaign-settings','/api/studio/briefs','/api/auth/activate','/api/webmaster/requests'])
   await call(path,cookies,'POST',{},context,403);
  await call('/api/records/'+randomUUID(),cookies,'PATCH',{},context,403);
  await call('/api/session',cookies,'GET',undefined,'live',409);
  const exit=await call('/api/view/exit',cookies,'POST',{});
  assert.equal(exit.data.realRestored,true);assert.ok(exit.cookies.some(c=>c.startsWith('__Host-sandy_view=;')));
  assert.equal((await call('/api/session',owner)).data.identity.id,actors.webmaster.id);
  await call('/api/records',owner,'GET',undefined,context,409);
  await call('/api/records',owner,'POST',{},context,409);
 }
 assert.equal(live.sql.prepare('SELECT count(*) AS n FROM club_records').get().n,liveBefore);
 assert.equal(demo.sql.prepare('SELECT count(*) AS n FROM club_records').get().n,SUITE_DESKS.length+2+STAFF.length);
 assert.equal(demo.sql.prepare('SELECT count(*) AS n FROM club_invites').get().n,0);
 await call('/api/view/select',actors.secretary.cookie,'POST',{role:'webmaster_demo'},undefined,403);
 await call('/api/view/select',owner,'POST',{role:'secretary'},undefined,503,{...env,SANDY_SHOWCASE_DB:undefined});
 await call('/api/view/select',owner,'POST',{role:'secretary'},undefined,503,{...env,SANDY_SHOWCASE_DB:live.binding});
});
test('standalone showcase never opens real storage; stale, tampered and mixed cookies fail closed',async t=>{
 const {live,demo,actors,env,call,viewCookie}=setup(t),owner=actors.webmaster.cookie;
 const noLive={...env,DB:{prepare(){throw Error('Unexpected production access')}}};
 await call('/api/view/login','','POST',{key:'0'.repeat(64)},undefined,401,noLive);
 const login=await call('/api/view/login','','POST',{key:env.SANDY_SHOWCASE_KEY},undefined,200,noLive);
 const cookie=viewCookie(login),session=(await call('/api/session',cookie,'GET',undefined,undefined,200,noLive)).data;
 assert.equal(session.viewMode,'showcase');assert.equal(session.canSwitchView,false);assert.equal(session.readOnly,true);
 assert.equal((await call('/api/accounts',cookie,'GET',undefined,session.viewContext,200,noLive)).data.accounts.length,STAFF.length);
 assert.equal((await call('/api/people',cookie,'GET',undefined,session.viewContext,200,noLive)).data.total,1);
 const mixed=cookie+'; '+owner;
 const rows=await call('/api/records',mixed,'GET',undefined,session.viewContext,200,noLive);
 assert.doesNotMatch(JSON.stringify(rows.data),/LIVE PRIVATE SENTINEL/);
 await call('/api/view/select',mixed,'POST',{role:'webmaster'},undefined,403,noLive);
 await call('/api/auth/login',mixed,'POST',{username:'live-webmaster',password:'fixture'},session.viewContext,403,noLive);
 await call('/api/records',mixed,'PATCH',{},session.viewContext,403,noLive);
 const tampered=cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a')+'; '+owner;
 await call('/api/session',tampered,'GET',undefined,undefined,409,noLive);
 const exit=await call('/api/view/exit',mixed,'POST',{},undefined,200,noLive);
 assert.equal(exit.data.realRestored,false);assert.ok(exit.cookies.some(c=>c.startsWith('__Host-sandy_session=;')));
 await call('/api/records',cookie,'GET',undefined,session.viewContext,503,{...noLive,SANDY_SHOWCASE_DB:undefined});
 const chosen=await call('/api/view/select',owner,'POST',{role:'treasurer'});
 const bound=viewCookie(chosen)+'; '+actors.secretary.cookie;
 await call('/api/session',bound,'GET',undefined,undefined,409);
 const revoked=owner+'; '+viewCookie(chosen);
 live.sql.prepare('DELETE FROM club_sessions WHERE account_id=?').run(actors.webmaster.id);
 await call('/api/session',revoked,'GET',undefined,undefined,409);
 assert.equal(demo.sql.prepare('SELECT count(*) AS n FROM club_sessions').get().n,0);
});
