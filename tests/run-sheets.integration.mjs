// EVT-01/EVT-02: run-sheet jobs linked to one event, capacity-safe shift claims,
// assignment, printable roster without private data, completion and task handoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const EVIDENCE='https://example.test/fictional-event-approval';
async function setup(t){
 const f=fixture(t);
 const ev=(await f.call('pres','/api/suite/events','POST',{title:'Fictional Cylinder Beach sand games',fields:{activity:'Sand games',eventDate:'2027-01-16',startTime:'08:00',endTime:'11:00',town:'Point Lookout / Mulumba',site:'Fictional Cylinder Beach north'}},201)).id;
 return {...f,ev,RS:'/api/committee/events/'+ev+'/run-sheet'};
}
test('jobs are added once, shown on the Volunteers desk and protected from generic edits',async t=>{
 const {call,RS,ev}=await setup(t);
 const requestId=crypto.randomUUID(),job={title:'Set up nets',start:'07:00',finish:'08:00',capacity:2,notes:'Two portable nets'};
 const [a,b]=await Promise.all([call('sec',RS,'POST',{action:'add',requestId,job},201),call('sec',RS,'POST',{action:'add',requestId,job}).catch(()=>null)]);
 assert.ok(a.created);if(b)assert.equal(b.created,false);
 await call('treasurer',RS,'POST',{action:'add',job},403);
 await call('sec',RS,'POST',{action:'add',job:{...job,finish:'06:00'}},400);
 await call('sec',RS,'POST',{action:'add',job:{...job,capacity:0}},400);
 await call('pres',RS,'POST',{action:'add',job:{title:'First aid point',start:'08:00',finish:'11:00',capacity:1,office:'secretary'}},201);
 const s=await call('other',RS);
 assert.equal(s.jobs.length,2);assert.equal(s.totals.capacity,3);assert.equal(s.canManage,false);
 const vols=(await call('other','/api/suite/volunteers')).records;
 assert.equal(vols.filter(r=>r.title.includes('Fictional Cylinder Beach')).length,2);
 await call('sec','/api/suite/volunteers/'+a.id,'PATCH',{version:1,title:'x',fields:{role:'x'}},409);
 await call('member',RS,'GET',undefined,403);
 await call('sec','/api/committee/events/'+crypto.randomUUID()+'/run-sheet','GET',undefined,404);
 assert.ok(ev);
});
test('helpers claim within capacity; concurrent claims cannot overbook; assign and release',async t=>{
 const {call,RS,actors,count}=await setup(t);
 const {id}=await call('sec',RS,'POST',{action:'add',job:{title:'Scorekeeper',start:'08:00',finish:'09:30',capacity:2}},201);
 await call('treasurer',RS,'POST',{action:'claim',jobId:id},400);
 const results=await Promise.all(['treasurer','other','vp'].map(w=>call(w,RS,'POST',{action:'claim',jobId:id,consent:true}).then(()=>'ok',e=>/shift_full/.test(e.message)?'full':e.message)));
 assert.deepEqual(results.sort(),['full','ok','ok']);
 let s=await call('sec',RS);assert.equal(s.jobs[0].filled,2);assert.equal(s.jobs[0].open,0);
 // A repeat claim by someone already rostered is harmless.
 const winner=['treasurer','other','vp'].find(w=>s.jobs[0].claims.some(c=>c.label===actors[w].role));
 const before=count('club_revisions','resource_id=?',id);
 await call(winner,RS,'POST',{action:'claim',jobId:id,consent:true});
 assert.equal(count('club_revisions','resource_id=?',id),before);
 await call('sec',RS,'POST',{action:'edit',jobId:id,version:s.jobs[0].version,job:{title:'Scorekeeper',start:'08:00',finish:'09:30',capacity:1}},409);
 await call(winner,RS,'POST',{action:'unclaim',jobId:id});
 await call('treasurer',RS,'POST',{action:'unclaim',jobId:id,accountId:actors.other.id},403);
 s=await call('sec',RS);assert.equal(s.jobs[0].filled,1);
 await call('treasurer',RS,'POST',{action:'assign',jobId:id,accountId:actors.asst.id},403);
 await call('sec',RS,'POST',{action:'assign',jobId:id,accountId:actors.member.id},404);
 await call('sec',RS,'POST',{action:'assign',jobId:id,accountId:actors.asst.id});
 await call('sec',RS,'POST',{action:'assign',jobId:id,accountId:actors.web.id},409);
 s=await call('asst',RS);assert.equal(s.jobs[0].mine,true);assert.equal(s.jobs[0].claims.find(c=>c.mine).consent,false);
});
test('handoff to personal tasks, completion, printable roster, date change and cancellation',async t=>{
 const {call,RS,ev,actors}=await setup(t);
 const {id}=await call('sec',RS,'POST',{action:'add',job:{title:'Pack down',start:'11:00',finish:'12:00',capacity:2,notes:'Return shade to shed'}},201);
 await call('treasurer',RS,'POST',{action:'claim',jobId:id,consent:true});
 await call('vp',RS,'POST',{action:'claim',jobId:id,consent:true});
 const h=await call('sec',RS,'POST',{action:'handoff',jobId:id});assert.equal(h.created,2);
 assert.equal((await call('sec',RS,'POST',{action:'handoff',jobId:id})).created,0);
 const tTask=(await call('treasurer','/api/committee/todos')).tasks.find(x=>x.title.startsWith('Pack down'));assert.ok(tTask);
 assert.ok(!(await call('other','/api/committee/todos')).tasks.some(x=>x.title.startsWith('Pack down')));
 await call('treasurer','/api/committee/todos','POST',{action:'complete',id:tTask.id,version:1,paper:false});
 let s=await call('sec',RS);
 assert.deepEqual(s.jobs[0].claims.map(c=>c.task.complete).sort(),[false,true]);assert.equal(s.jobs[0].completed,null);
 const print=await call('other',RS+'?format=text');
 assert.match(print,/11:00-12:00  Pack down  \[2\/2\]/);assert.match(print,/Helpers: treasurer, vice_president/);
 for(const secret of [actors.treasurer.id,actors.vp.id,'@',actors.treasurer.token])assert.ok(!print.includes(secret));
 await call('other',RS,'POST',{action:'complete',jobId:id,version:s.jobs[0].version},403);
 await call('vp',RS,'POST',{action:'complete',jobId:id,version:s.jobs[0].version});
 s=await call('sec',RS);assert.ok(s.jobs[0].completed);assert.equal(s.totals.completed,1);
 assert.match(await call('sec',RS+'?format=text'),/DONE/);
 // Event date change flows to linked jobs.
 const e=(await call('pres','/api/suite/events/'+ev)).record;
 await call('pres','/api/suite/events/'+ev,'PATCH',{version:e.version,title:e.title,status:'draft',fields:{...e.fields,eventDate:'2027-01-23'}});
 s=await call('sec',RS);assert.deepEqual(s.outOfDate,[id]);
 await call('treasurer',RS,'POST',{action:'sync'},403);
 assert.equal((await call('sec',RS,'POST',{action:'sync'})).updated,1);
 s=await call('sec',RS);assert.deepEqual(s.outOfDate,[]);assert.equal(s.jobs[0].date,'2027-01-23');
 // Approval and release of the event itself stay on the separate authority gate.
 await call('pres','/api/suite/events/'+ev+'/decision','POST',{version:e.version+1,decision:'approved',evidence:EVIDENCE},409);
 // Cancelled events freeze claims.
 const e2=(await call('pres','/api/suite/events/'+ev)).record;
 const {id:j2}=await call('sec',RS,'POST',{action:'add',job:{title:'Water station',capacity:1}},201);
 await call('pres','/api/suite/events/'+ev,'PATCH',{version:e2.version,title:e2.title,status:'archived',fields:e2.fields});
 s=await call('sec',RS);assert.equal(s.event.cancelled,true);
 await call('other',RS,'POST',{action:'claim',jobId:j2,consent:true},409);
 assert.match(await call('sec',RS+'?format=text'),/STATUS: CANCELLED/);
});
