import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUITE_DESKS,SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {suiteEndpoint} from '../worker/suite.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('the full Sandy suite has distinct valid fields for the PLFC committee topics',()=>{
 assert.ok(SUITE_DESKS.length>=28);
 const keys=SUITE_DESKS.map(x=>x.key);
 assert.equal(new Set(keys).size,keys.length);
 for(const desk of SUITE_DESKS){
  assert.ok(['event','meeting','task','calendar','grant','asset','equipment','fundraising','film','sponsor','partner','volunteer','newsletter','notice','governance','production','safeguard','social_idea'].includes(desk.kind),desk.key);
  assert.ok(desk.fields.length>=4,desk.key);
  assert.ok(desk.steps.length>=2,desk.key);
  assert.ok(desk.roles.includes('webmaster'));
  assert.ok(!desk.roles.includes('member')&&!desk.roles.includes('webmaster_demo'));
  assert.equal(new Set(desk.fields.map(f=>f.key)).size,desk.fields.length);
  for(const field of desk.fields){
   assert.ok(['text','textarea','lines','date','month','time','url','number','checkbox','select'].includes(field.type),desk.key+' '+field.key);
   assert.ok(desk.steps.includes(field.step),desk.key);
   if(field.type==='select')assert.ok(field.options.length>=2);
  }
 }
 assert.ok(SUITE_BY_KEY['meetings'].fields.some(f=>f.key==='draftMinutes'));
 assert.ok(SUITE_BY_KEY['news'].fields.some(f=>f.key==='articles'));
 assert.ok(SUITE_BY_KEY['equipment'].fields.some(f=>f.key==='returnDate'));
 assert.ok(SUITE_BY_KEY['grants'].fields.some(f=>f.key==='officialUrl'));
 assert.ok(SUITE_BY_KEY['film'].fields.some(f=>f.key==='rights'));
 assert.ok(SUITE_BY_KEY['venues'].fields.some(f=>f.key==='town'));
 assert.ok(SUITE_BY_KEY['safety'].roles.includes('secretary'));
 assert.ok(!SUITE_BY_KEY['safety'].roles.includes('committee'));
});
test('backend mounts a dedicated D1 workflow API and browser has distinct stage editors',()=>{
 const worker=read('../worker/index.mjs'),backend=read('../worker/suite.mjs');
 const ui=read('../club-suite-ui.js'),room=read('../club-committee.js');
 assert.ok(worker.includes("suiteEndpoint(req,env,path,identity)"));
 assert.ok(backend.includes("revision(db,"));
 assert.ok(backend.includes("audit(db,"));
 assert.ok(backend.includes('if(expected!==current.version)'));
 assert.ok(backend.includes('requireRole(identity,desk.roles)'));
 assert.ok(backend.includes("SANDY_CLUB_APPROVALS!=='enabled'"));
 assert.ok(room.includes("await suite.open(key)"));
 assert.ok(ui.includes("Save to Sandy D1"));
 assert.ok(ui.includes("data-suite-step"));
 assert.ok(ui.includes("text/calendar;charset=utf-8"));
 assert.ok(ui.includes("text/markdown;charset=utf-8"));
 assert.ok(!ui.includes('localStorage.setItem'));
});
test('a member and demo account cannot access the committee suite even without a database',async()=>{
 for(const role of ['member','webmaster_demo']){
  await assert.rejects(()=>suiteEndpoint(new Request('https://sandy.local/api/suite/desks'),{},'/api/suite/desks',{id:'x',role}),e=>e.status===403);
 }
 await assert.rejects(()=>suiteEndpoint(new Request('https://sandy.local/api/suite/desks'),{},'/api/suite/desks',null),e=>e.status===401);
});

test('the high-value PLFC operations have real purpose-specific editor assistance',()=>{
 const app=read('../club-workflow-assist.js');
 assert.ok(app.includes('Prepare draft minutes'));
 assert.ok(app.includes('Download newsletter HTML'));
 assert.ok(app.includes('Calculate stock available'));
 assert.ok(app.includes('Download member pack'));
 assert.ok(app.includes('Download grant checklist')||app.includes('Prepare grant checklist'));
 assert.ok(app.includes('Tick, Flick & Debrief'));
 assert.ok(!app.includes('fetch('));
 assert.ok(read('../club-suite-ui.js').includes('setupWorkflowAssist'));
 assert.deepEqual(SUITE_BY_KEY['stock'].roles,['webmaster','treasurer']);
 assert.ok(!SUITE_BY_KEY['meetings'].roles.includes('committee'));
});
