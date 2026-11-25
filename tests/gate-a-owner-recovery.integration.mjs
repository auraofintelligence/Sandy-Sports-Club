import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import worker from '../worker/index.mjs';
import {recoverExistingWebmaster} from '../backend/recovery/owner-recovery.mjs';
const origin='https://owner-recovery.test';
function fixture(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 sql.exec(readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8'));
 const db={prepare(query){const q=sql.prepare(query);const bind=(...args)=>({
  first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),
  run:async()=>{if(/\bRETURNING\b/i.test(query)){const results=q.all(...args);return {results,meta:{changes:results.length}}}return {meta:{changes:Number(q.run(...args).changes)}}}
 });return {...bind(),bind}},withSession(){return this},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const stmt of stmts)out.push(await stmt.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
 const env={DB:db,SANDY_AUTH_PEPPER:randomBytes(32).toString('hex'),SANDY_BOOTSTRAP_KEY:randomBytes(32).toString('hex'),SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
 async function call(path,method='GET',body,cookie='',expected=200){const headers={Origin:origin,'Content-Type':'application/json',Cookie:cookie};const response=await worker.fetch(new Request(origin+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),env);const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return {result,cookie:response.headers.getSetCookie().find(x=>x.startsWith('__Host-sandy_session='))?.split(';')[0]}}
 return {sql,db,env,call};
}
test('owner-authorised offline recovery preserves original Webmaster identity and all club records, revokes old access and is replay-safe',async t=>{
 const {sql,db,env,call}=fixture(t),username='fictional-webmaster',password='fictional-original-password';
 await call('/api/auth/bootstrap','POST',{username,password,bootstrapKey:env.SANDY_BOOTSTRAP_KEY},'',201);
 delete env.SANDY_BOOTSTRAP_KEY;
 const first=(await call('/api/auth/login','POST',{username,password})).cookie;
 const owner=(await call('/api/session','GET',undefined,first)).result.identity;
 const second=(await call('/api/auth/login','POST',{username,password})).cookie;
 const member=(await call('/api/accounts','POST',{username:'reserved-secretary',role:'secretary'},first,201)).result.account;
 const record=(await call('/api/records','POST',{kind:'social_idea',title:'Fictional existing draft',body:{notes:'Preserve exactly'}},first,201)).result;
 sql.prepare('INSERT INTO club_invites(digest,account_id,issued_by,created_epoch,expires_epoch) VALUES(?,?,?,?,?)').run('fictional-obsolete-owner-token',owner.id,owner.id,0,4102444800);
 const original=sql.prepare('SELECT * FROM club_accounts WHERE id=?').get(owner.id),before=sql.prepare('SELECT * FROM club_records').all();
 const input={accountId:owner.id,username,observedSalt:original.password_salt,observedVerifier:original.password_verifier,password:'fictional-recovered-password',pepper:env.SANDY_AUTH_PEPPER,confirmation:'RECOVER EXISTING '+owner.id,approvalRef:'FIXTURE-APPROVAL-1'};
 await assert.rejects(recoverExistingWebmaster(db,{...input,confirmation:'yes'}));
 await assert.rejects(recoverExistingWebmaster(db,{...input,accountId:member.id,confirmation:'RECOVER EXISTING '+member.id}));
 sql.exec("CREATE TRIGGER refuse_recovery_audit BEFORE INSERT ON club_audit WHEN NEW.action='owner_maintenance_recovery' BEGIN SELECT RAISE(ABORT,'fictional audit failure'); END");
 await assert.rejects(recoverExistingWebmaster(db,input));
 assert.equal(sql.prepare('SELECT password_verifier FROM club_accounts WHERE id=?').get(owner.id).password_verifier,original.password_verifier);
 assert.equal((await call('/api/session','GET',undefined,first)).result.authenticated,true);
 sql.exec('DROP TRIGGER refuse_recovery_audit');
 const recovered=await recoverExistingWebmaster(db,input);
 assert.equal(recovered.accountId,owner.id);
 await assert.rejects(recoverExistingWebmaster(db,input));
 for(const cookie of [first,second])assert.equal((await call('/api/session','GET',undefined,cookie)).result.authenticated,false);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL').get(owner.id).n,0);
 await call('/api/auth/login','POST',{username,password},'',401);
 const fresh=(await call('/api/auth/login','POST',{username,password:input.password})).cookie;
 assert.equal((await call('/api/session','GET',undefined,fresh)).result.identity.id,owner.id);
 assert.equal((await call('/api/records/'+record.id,'GET',undefined,fresh)).result.record.title,'Fictional existing draft');
 assert.deepEqual(sql.prepare('SELECT * FROM club_records').all(),before);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_accounts').get().n,2);
 assert.equal(sql.prepare('SELECT state FROM club_accounts WHERE id=?').get(member.id).state,'reserved');
 const evidence=JSON.stringify(sql.prepare("SELECT * FROM club_audit WHERE action='owner_maintenance_recovery'").all())+JSON.stringify(sql.prepare("SELECT * FROM club_revisions WHERE operation='owner_maintenance_recovery'").all());
 assert.match(evidence,/FIXTURE-APPROVAL-1/);assert.ok(!evidence.includes(input.password)&&!evidence.includes(input.pepper)&&!evidence.includes(input.observedVerifier));
 await call('/api/auth/owner-recovery','POST',{},'',404);
 await call('/api/auth/bootstrap','POST',{username,password,bootstrapKey:'fictional-not-configured'},'',503);
});
