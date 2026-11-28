import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
test('AGM jobs land on to-do lists tagged with their AGM, and move when the date changes',async t=>{
 const f=fixture(t,{actors:[['sec','secretary'],['tre','treasurer']]});
 const made=await f.call('sec','/api/suite/agm','POST',{title:'Annual general meeting 2099',fields:{agmDate:'2099-03-20',venue:'Fictional hall'}},201);
 assert.equal((await f.call('sec','/api/committee/agm/'+made.id+'/jobs','POST',{version:1})).created,10);
 const jobs=(await f.call('sec','/api/committee/todos')).tasks.filter(x=>x.source==='agm'&&x.sourceId===made.id);
 assert.equal(jobs.length,10);assert.ok(jobs.some(j=>j.agmJob==='notice'&&j.dueDate==='2099-02-27'));
 const rec=(await f.call('sec','/api/suite/agm/'+made.id)).record;
 await f.call('sec','/api/suite/agm/'+made.id,'PATCH',{version:rec.version,title:rec.title,status:rec.status,fields:{...rec.fields,agmDate:'2099-03-27'}});
 const moved=await f.call('sec','/api/committee/agm/'+made.id+'/jobs','POST',{version:rec.version+1});
 assert.equal(moved.rescheduled,10);
 assert.ok((await f.call('sec','/api/committee/todos')).tasks.some(j=>j.agmJob==='notice'&&j.dueDate==='2099-03-06'));
 await f.call('tre','/api/suite/agm','GET',undefined,403);
});
