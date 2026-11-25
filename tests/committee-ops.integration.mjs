import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import worker from '../worker/index.mjs';
import {showcaseSql} from '../backend/showcase/seed.mjs';
import {STAFF} from '../worker/shared.mjs';
const origin='https://sandy.test',digest=s=>createHash('sha256').update(s).digest('hex');
const notices='/api/committee/notices',todos='/api/committee/todos';
function db(t,source){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());sql.exec(source);
 let pending=Promise.resolve();
 const binding={prepare(query){const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>({meta:{changes:Number(q.run(...args).changes)}})});return {...bind(),bind}},withSession(){return this},batch(stmts){const run=pending.then(async()=>{sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}});pending=run.catch(()=>{});return run}};
 return {sql,binding};
}
function setup(t){
 const live=db(t,readFileSync(new URL('../backend/migrations/0001_club.sql',import.meta.url),'utf8')),demo=db(t,showcaseSql()),actors={};
 for(const role of [...STAFF,'member']){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  live.sql.prepare("INSERT INTO club_accounts(id,username,role,office_label,state,password_salt,password_verifier,created_utc) VALUES(?,?,?,?,'active','fixture','fixture','2026-01-01')").run(id,role,role,role);
  live.sql.prepare('INSERT INTO club_sessions VALUES(?,?,0,4102444800)').run(digest(token),id);
  actors[role]={id,cookie:'__Host-sandy_session='+token};
 }
 const env={DB:live.binding,SANDY_SHOWCASE_DB:demo.binding,SANDY_AUTH_PEPPER:'isolated-fictional-pepper-not-production',SANDY_SHOWCASE_KEY:randomBytes(32).toString('hex'),SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
 async function call(role,path,method='GET',body,expected=200,cookie=actors[role]?.cookie){
  const headers={Origin:origin,'Content-Type':'application/json'};if(cookie)headers.Cookie=cookie;
  const r=await worker.fetch(new Request(origin+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  const data=await r.json();assert.equal(r.status,expected,role+' '+path+' '+JSON.stringify(data));return {data,cookies:r.headers.getSetCookie()};
 }
 return {live,demo,actors,env,call};
}
const plus=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+86400000*n).toISOString().slice(0,10);
test('notice scope, personal read receipts, review/version history and archive survive exact retries; legacy records stay readable',async t=>{
 const {live,call}=setup(t);
 await call('',notices,'GET',undefined,401);await call('member',notices,'GET',undefined,403);
 const today=(await call('secretary',notices)).data.today,key=randomUUID(),post={action:'post',id:key,kind:'info',title:'Fictional summer notice',details:'Check Cylinder and Home Beach conditions.',scope:'all',important:true,reviewDate:today};
 const both=await Promise.all([call('secretary',notices,'POST',post),call('secretary',notices,'POST',post)]);
 assert.equal(both[0].data.notices.length,1);assert.equal(both[1].data.notices.length,1);
 assert.equal((await call('president',notices)).data.notices[0].unread,true);
 await call('president',notices,'POST',{action:'seen',id:key,version:1});
 await call('president',notices,'POST',{action:'seen',id:key,version:1});
 assert.equal((await call('president',notices)).data.counts.unread,0);
 assert.equal((await call('treasurer',notices)).data.counts.unread,1);
 assert.equal(live.sql.prepare("SELECT count(*) AS n FROM club_records WHERE json_extract(body_json,'$.sandyCommitteeReceipt')=1").get().n,1);
 await call('treasurer',notices,'POST',{action:'review',id:key,version:1},403);
 const review={action:'review',id:key,version:1,reviewDate:plus(today,15)};
 await call('secretary',notices,'POST',review);await call('secretary',notices,'POST',review);
 assert.equal((await call('president',notices)).data.notices[0].unread,true);
 await call('president',notices,'POST',{action:'seen',id:key,version:1});assert.equal((await call('president',notices)).data.counts.unread,1);
 await call('president',notices,'POST',{action:'seen',id:key,version:2});assert.equal((await call('president',notices)).data.counts.unread,0);
 await call('secretary',notices,'POST',{...review,reviewDate:plus(today,16)},409);
 await call('secretary',notices,'POST',{action:'archive',id:key,version:2});await call('secretary',notices,'POST',{action:'archive',id:key,version:2});
 assert.equal((await call('treasurer',notices+'?archive=1')).data.notices[0].status,'archived');
 const secret=randomUUID();await call('secretary',notices,'POST',{...post,id:secret,title:'Leadership only',scope:'leadership'});
 assert.equal((await call('treasurer',notices)).data.notices.some(x=>x.id===secret),false);
 await call('treasurer','/api/suite/notices/'+secret,'GET',undefined,404);await call('treasurer','/api/suite/notices/'+secret+'/history','GET',undefined,404);
 await call('treasurer','/api/records/'+secret,'GET',undefined,404);
 await call('secretary','/api/suite/notices/'+secret,'PATCH',{version:1,title:'bypass',fields:{subject:'bypass'}},409);
 const legacy=(await call('secretary','/api/suite/notices','POST',{title:'Existing draft',fields:{subject:'Existing draft',message:'Keep original text',audience:'All proposed officers'}},201)).data.id;
 assert.equal((await call('treasurer',notices)).data.notices.find(n=>n.id===legacy).details,'Keep original text');
 const receiptId=live.sql.prepare("SELECT id FROM club_records WHERE json_extract(body_json,'$.sandyCommitteeReceipt')=1").get().id;
 await call('secretary','/api/records/'+receiptId,'GET',undefined,404);
 assert.equal((await call('secretary','/api/audit')).data.audit.some(x=>x.resourceId===receiptId),false);
 assert.equal((await call('webmaster','/api/audit')).data.audit.filter(x=>x.resourceId===receiptId).length,2);
});
test('notice creates one allocated task; role isolation, overdue completion, paper recording and take-up use one source of truth',async t=>{
 const {live,call}=setup(t);const today=(await call('secretary',notices)).data.today;
 const key=randomUUID(),post={action:'post',id:key,kind:'action',title:'Fictional kit quote',details:'Compare two net kits.',scope:'treasurer',important:true,office:'treasurer',dueDate:plus(today,-1)};
 await call('president',notices,'POST',post,403);
 await call('secretary',notices,'POST',{...post,scope:'president'},400);
 await Promise.all([call('secretary',notices,'POST',post),call('secretary',notices,'POST',post)]);
 const n=(await call('treasurer',notices)).data.notices[0],task=n.taskId;
 assert.equal(n.status,'overdue');assert.ok(task);
 assert.equal(live.sql.prepare("SELECT count(*) AS n FROM club_records WHERE title=?").get(post.title).n,2);
 assert.equal((await call('committee',notices)).data.notices.length,0);
 await call('committee','/api/suite/todos/'+task,'GET',undefined,404);
 await call('committee','/api/suite/todos/'+task+'/history','GET',undefined,404);
 await call('committee',todos,'POST',{action:'complete',id:task,version:1,paper:false},404);
 await call('secretary',notices,'POST',{action:'archive',id:key,version:1},409);
 await call('secretary',notices,'POST',{action:'review',id:key,version:1},400);
 await call('treasurer',todos,'POST',{action:'complete',id:task,version:1,paper:true},403);
 const completed={action:'complete',id:task,version:1,paper:true};await call('assistant_secretary',todos,'POST',completed);await call('assistant_secretary',todos,'POST',completed);
 const done=(await call('treasurer',todos)).data.tasks.find(x=>x.id===task);assert.equal(done.done,true);assert.equal(done.completion.paper,true);
 assert.equal((await call('treasurer',notices)).data.notices[0].status,'done');
 assert.equal((await call('treasurer',notices)).data.counts.red,0);
 await call('treasurer',notices,'POST',{action:'archive',id:key,version:1});
 assert.equal((await call('treasurer',notices+'?archive=1')).data.notices[0].status,'archived');
 const manual=randomUUID(),add={action:'add',id:manual,title:'Check proposed shade',details:'No purchase',office:'',dueDate:today};
 await call('secretary',todos,'POST',add);await call('secretary',todos,'POST',add);
 await call('committee',todos,'POST',{action:'take',id:manual,version:1});
 assert.equal((await call('committee',todos)).data.tasks.find(x=>x.id===manual).office,'committee');
 await call('treasurer',todos,'POST',{action:'take',id:manual,version:1},404);
 await call('committee',todos,'POST',{action:'complete',id:manual,version:2,paper:false});
 assert.equal((await call('committee',todos)).data.tasks.find(x=>x.id===manual).done,true);
 const monthly=(await call('secretary',todos)).data.tasks.find(x=>x.source==='monthly');assert.equal(monthly.version,0);
 await call('secretary',todos,'POST',{action:'complete',id:monthly.id,version:0,paper:false});await call('secretary',todos,'POST',{action:'complete',id:monthly.id,version:0,paper:false});
 const entries=(await call('secretary',todos)).data.tasks.filter(x=>x.source==='monthly');assert.equal(entries.length,1);assert.equal(entries[0].done,true);
 const meeting=(await call('secretary','/api/suite/meetings','POST',{title:'Fictional summer planning',fields:{meetingType:'Working group',date:today,followUps:'Check transport | Treasurer | '+today}},201)).data;
 await call('secretary','/api/suite/meetings/'+meeting.id+'/followups','POST',{version:1});
 const linked=(await call('treasurer',todos)).data.tasks.find(x=>x.sourceId===meeting.id);assert.ok(linked);
 await call('treasurer',todos,'POST',{action:'complete',id:linked.id,version:1,paper:false});
 assert.equal(JSON.parse(live.sql.prepare('SELECT body_json FROM club_records WHERE id=?').get(linked.id).body_json).sourceMeeting,meeting.id);
});
test('independent showcase and role preview can read dedicated desks but cannot mutate or leak real records',async t=>{
 const {live,demo,call,env}=setup(t);
 await call('webmaster',notices,'POST',{action:'post',id:randomUUID(),kind:'info',title:'LIVE PRIVATE SENTINEL',details:'Real fixture only',scope:'all',important:false});
 const sign=await call('', '/api/view/login','POST',{key:env.SANDY_SHOWCASE_KEY},200,'');
 const cookie=sign.cookies.find(v=>v.startsWith('__Host-sandy_view=')).split(';')[0],before=demo.sql.prepare('SELECT count(*) AS n FROM club_records').get().n;
 for(const path of [notices,todos]){
  const view=await call('',path,'GET',undefined,200,cookie);assert.match(JSON.stringify(view.data),/\[EXAMPLE\]/);assert.doesNotMatch(JSON.stringify(view.data),/LIVE PRIVATE SENTINEL/);
  await call('',path,'POST',{action:'post'},403,cookie);
 }
 assert.equal(demo.sql.prepare('SELECT count(*) AS n FROM club_records').get().n,before);
});
