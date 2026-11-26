// Shared isolated SQLite stand-in for Sandy D1 used by Gate A acceptance tests.
// Fictional accounts only; nothing here touches Cloudflare or real club data.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import worker from '../worker/index.mjs';
export const ROLE_ACTORS=[['web','webmaster'],['pres','president'],['vp','vice_president'],['sec','secretary'],['asst','assistant_secretary'],['treasurer','treasurer'],['other','committee'],['member','member'],['member2','member'],['demo','webmaster_demo']];
export function fixture(t,{actors:list=ROLE_ACTORS,library=false}={}){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 sql.exec(readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8'));
 if(library)sql.exec(readFileSync(new URL('../backend/migrations/0002_private_library.sql',import.meta.url),'utf8'));
 let pending=Promise.resolve();
 const DB={prepare(query){
  const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>{if(/\bRETURNING\b/i.test(query)){const results=q.all(...args);return {results,meta:{changes:results.length}}}return {meta:{changes:Number(q.run(...args).changes)}}}});
  return {...bind(),bind};
 },withSession(){return this},async batch(stmts){const run=pending.then(async()=>{sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}});pending=run.catch(()=>{});return run}};
 const env={DB,SANDY_AUTH_PEPPER:'isolated-fictional-pepper-not-for-production',SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
 const actors={};
 for(const [name,role] of list){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  sql.prepare("INSERT INTO club_accounts(id,username,role,office_label,state,password_salt,password_verifier,created_utc) VALUES(?,?,?,?,'active','fake','fake','2026-01-01')").run(id,name,role,role);
  sql.prepare('INSERT INTO club_sessions VALUES(?,?,0,4102444800)').run(createHash('sha256').update(token).digest('hex'),id);
  actors[name]={id,token,role};
 }
 async function request(who,path,method='GET',body,origin='https://sandy.test',extraHeaders={}){
  const headers={Origin:origin,'Content-Type':'application/json',...extraHeaders};
  if(who)headers.Cookie='__Host-sandy_session='+(actors[who]?.token||who);
  return worker.fetch(new Request('https://sandy.test'+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
 }
 async function call(who,path,method='GET',body,status=200){
  const res=await request(who,path,method,body);
  const text=await res.text();let value;try{value=JSON.parse(text)}catch{value=text}
  assert.equal(res.status,status,who+' '+method+' '+path+' '+text.slice(0,300));return value;
 }
 async function statusOf(who,path,method='GET',body){return (await request(who,path,method,body)).status}
 function active(who){const id=actors[who].id;sql.prepare("INSERT INTO club_people(id,account_id,full_name,status,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,'Fictional member','active',?,?,'2026-01-01','2026-01-01')").run(randomUUID(),id,id,id)}
 async function verifyAdult(who){await call('web','/api/committee/safeguards','POST',{action:'verify',accountId:actors[who].id,version:0,ageBand:'adult',guardianPermission:false,ageCheckedOffline:true})}
 const count=(table,where='1=1',...args)=>sql.prepare('SELECT count(*) AS n FROM '+table+' WHERE '+where).get(...args).n;
 return {sql,env,actors,call,request,statusOf,active,verifyAdult,count};
}
