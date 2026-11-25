import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync,chmodSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import worker from '../worker/index.mjs';
import {defaultCampaignSettings} from '../studio/social-campaign-engine.js';
const origin='https://sandy-restore.test';
const sha=value=>createHash('sha256').update(value).digest('hex');
function adapter(sql){
 return {prepare(query){
  const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>({meta:{changes:Number(q.run(...args).changes)}})});
  return {...bind(),bind};
 },withSession(){return this},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
}
function manifest(sql){
 const tables=sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
 return {schema:sha(JSON.stringify(sql.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all())),tables:Object.fromEntries(tables.map(({name})=>{
  if(!/^[a-z_]+$/.test(name))throw Error('Invalid fixture table name');
  const rows=sql.prepare('SELECT * FROM '+name+' ORDER BY 1').all();return [name,{count:rows.length,digest:sha(JSON.stringify(rows))}];
 }))};
}
async function call(env,path,cookie='',method='GET',data,expected=200){
 const headers={Origin:origin,'Content-Type':'application/json'};
 if(cookie)headers.Cookie=cookie;
 const response=await worker.fetch(new Request(origin+path,{method,headers,...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
 const result=await response.json();
 assert.equal(response.status,expected,path+' '+JSON.stringify(result));
 return {data:result,cookie:response.headers.getSetCookie().find(x=>x.startsWith('__Host-sandy_session='))?.split(';')[0]};
}
test('isolated SQL export and restore preserve accounts, relationships, audit history and actual login',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'sandy-recovery-fixture-'));chmodSync(dir,0o700);
 const sourcePath=join(dir,'source.sqlite'),restorePath=join(dir,'restored.sqlite'),dumpPath=join(dir,'fictional-backup.sql');
 const source=new DatabaseSync(sourcePath);let restored;
 t.after(()=>{restored?.close();source.close();rmSync(dir,{recursive:true,force:true})});
 source.exec(readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8'));
 const pepper=randomBytes(32).toString('hex'),bootstrap=randomBytes(32).toString('hex'),password='fictional-restore-owner-'+randomBytes(8).toString('hex');
 const env={DB:adapter(source),SANDY_AUTH_PEPPER:pepper,SANDY_BOOTSTRAP_KEY:bootstrap,SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
 const username='restore-fixture-webmaster';
 await call(env,'/api/auth/bootstrap','','POST',{username,password,displayName:'Fictional restore owner',bootstrapKey:bootstrap},201);
 delete env.SANDY_BOOTSTRAP_KEY;
 const login=await call(env,'/api/auth/login','','POST',{username,password}),owner=login.cookie;
 assert.ok(owner);
 const account=(await call(env,'/api/session',owner)).data.identity;
 const reserved=(await call(env,'/api/accounts',owner,'POST',{username:'restore-fixture-secretary',role:'secretary',office:'Secretary'},201)).data.account;
 assert.equal(reserved.state,'reserved');
 const draft={title:'Fictional recovery meeting',fields:{meetingType:'Working group',date:'2027-02-13',startTime:'09:00',endTime:'10:00',location:'Example venue',agenda:'Check equipment\nReview accessibility',followUps:'Check stock | Secretary | 2027-02-20'}};
 const meeting=(await call(env,'/api/suite/meetings',owner,'POST',draft,201)).data;
 await call(env,'/api/suite/meetings/'+meeting.id,owner,'PATCH',{...draft,version:1,fields:{...draft.fields,draftMinutes:'Fictional second revision'}});
 const follow=(await call(env,'/api/suite/meetings/'+meeting.id+'/followups',owner,'POST',{version:2})).data;
 assert.equal(follow.created,1);
 const settings=(await call(env,'/api/committee/social-campaign-settings',owner,'POST',{version:0,settings:defaultCampaignSettings()})).data;
 assert.equal(settings.version,1);
 const help=(await call(env,'/api/webmaster/requests',owner,'POST',{subject:'Fictional recovery check',category:'Committee workflow',message:'Example request, no personal information'},201)).data;
 await call(env,'/api/webmaster/requests/'+help.id,owner,'PATCH',{version:1,stage:'completed',reply:'Example resolved'});
 const before=manifest(source);
 assert.ok(before.tables.club_revisions.count>=4);assert.ok(before.tables.club_audit.count>=4);
 // SQL export/import is the shape of the D1 restore workflow. This is an
 // explicitly fictional rehearsal, not a live Cloudflare export.
 const py=String.raw`
import os, sqlite3, sys
src, out, dest=sys.argv[1:]
with sqlite3.connect(src) as original:
    fd=os.open(out,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as f:
        for line in original.iterdump():
            f.write(line+'\n')
with sqlite3.connect(dest) as restored:
    restored.executescript(open(out,encoding='utf-8').read())
    assert restored.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    assert restored.execute('PRAGMA foreign_key_check').fetchall()==[]
`;
 const result=spawnSync('python3',['-c',py,sourcePath,dumpPath,restorePath],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 assert.equal(statSync(dumpPath).mode&0o777,0o600);assert.ok(statSync(dumpPath).size>0);
 const backupHash=sha(readFileSync(dumpPath));assert.match(backupHash,/^[a-f0-9]{64}$/);
 restored=new DatabaseSync(restorePath);restored.exec('PRAGMA foreign_keys=ON');
 assert.deepEqual(manifest(restored),before,'schema and every table match the original export');
 assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length,0);
 const restoredEnv={...env,DB:adapter(restored)};
 // A recovered snapshot must not re-enable historical session or invitation
 // tokens. This operation targets ONLY the new, disconnected fixture database.
 restored.exec('BEGIN; DELETE FROM club_sessions; DELETE FROM club_invites WHERE redeemed_epoch IS NULL; COMMIT;');
 assert.equal((await call(restoredEnv,'/api/session',owner)).data.authenticated,false);
 await call(restoredEnv,'/api/records',owner,'GET',undefined,401);
 await call(restoredEnv,'/api/auth/bootstrap','','POST',{username,password,bootstrapKey:bootstrap},503);
 await call(restoredEnv,'/api/auth/login','','POST',{username,password:'fictional-wrong-password'},401);
 const afterLogin=await call(restoredEnv,'/api/auth/login','','POST',{username,password});
 const restoredOwner=afterLogin.cookie;
 assert.equal((await call(restoredEnv,'/api/session',restoredOwner)).data.identity.id,account.id);
 const accounts=(await call(restoredEnv,'/api/accounts',restoredOwner)).data.accounts;
 assert.equal(accounts.find(a=>a.id===reserved.id)?.state,'reserved');
 assert.equal(accounts.find(a=>a.id===account.id)?.role,'webmaster');
 assert.equal(accounts.length,2);
 const row=(await call(restoredEnv,'/api/suite/meetings/'+meeting.id,restoredOwner)).data.record;
 assert.equal(row.version,2);assert.equal(row.fields.draftMinutes,'Fictional second revision');
 const history=(await call(restoredEnv,'/api/suite/meetings/'+meeting.id+'/history',restoredOwner)).data.history;
 assert.equal(history.length,2);assert.equal(history[0].version,2);
 const todos=(await call(restoredEnv,'/api/suite/todos',restoredOwner)).data.records;
 assert.equal(todos.length,1);assert.equal(todos[0].fields.linkedDesk,meeting.id);
 assert.equal((await call(restoredEnv,'/api/committee/social-campaign-settings',restoredOwner)).data.version,1);
 const requests=(await call(restoredEnv,'/api/webmaster/requests',restoredOwner)).data.requests;
 assert.equal(requests.find(r=>r.id===help.id)?.reply,'Example resolved');
 const audit=(await call(restoredEnv,'/api/audit',restoredOwner)).data.audit;
 assert.ok(audit.some(a=>a.resourceId===meeting.id));
 // Reopen and write to prove the restored database is usable, not just readable.
 await call(restoredEnv,'/api/suite/meetings/'+meeting.id,restoredOwner,'PATCH',{...draft,version:2,fields:{...draft.fields,draftMinutes:'Fictional restored follow-up'}});
 assert.equal((await call(restoredEnv,'/api/suite/meetings/'+meeting.id,restoredOwner)).data.record.version,3);
 assert.deepEqual(manifest(source),before,'original source never modified by restore');
});
