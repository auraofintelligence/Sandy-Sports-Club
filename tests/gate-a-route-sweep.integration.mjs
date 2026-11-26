// SEC-01 / SEC-02 route sweep: every structured desk record and a private help request
// is checked against every fictional office, member, demo and signed-out session on
// every alternate read and write path (list, kind filter, direct ID, history, edit,
// decision, calendar, counts, member pages, audit JSON and CSV export).
import test from 'node:test';
import assert from 'node:assert/strict';
import {SUITE_DESKS} from '../studio/sandy-suite-spec.js';
import {fixture} from './d1-fixture.mjs';
const OFFICERS=['web','pres','vp','sec','asst','treasurer','other'];
const EVERYONE=[...OFFICERS,'member','demo',null];
const sample=desk=>{const fields={};for(const f of desk.fields)fields[f.key]=f.type==='checkbox'?false:f.type==='select'?f.options[0]:f.type==='date'?'2027-02-14':f.type==='month'?'2027-02':f.type==='time'?(f.key==='endTime'?'11:00':'09:00'):f.type==='number'?1:f.type==='url'?'https://example.test/fictional':'Fictional Straddie example';return {title:'Sweep '+desk.key,fields}};
const ROLE={web:'webmaster',pres:'president',vp:'vice_president',sec:'secretary',asst:'assistant_secretary',treasurer:'treasurer',other:'committee',member:'member',demo:'webmaster_demo'};

test('every desk record is visible only to its permitted offices on every alternate route',async t=>{
 const {call,statusOf,request,sql,env,count,active,verifyAdult}=fixture(t);
 const records=[];
 for(const desk of SUITE_DESKS){
  if(['notices','todos'].includes(desk.key))continue; // dedicated noticeboard rules: tests/committee-ops.integration.mjs
  const creator=OFFICERS.find(w=>desk.roles.includes(ROLE[w]));
  records.push({desk,id:(await call(creator,'/api/suite/'+desk.key,'POST',sample(desk),201)).id});
 }
 const help=await call('sec','/api/webmaster/requests','POST',{subject:'Sweep private help',category:'Other',message:'Fictional private request'},201);
 const snapshot=()=>sql.prepare('SELECT id,version,title,body_json FROM club_records ORDER BY id').all();
 const before=snapshot(),revisions=count('club_revisions');
 const genericKinds=[...new Set(SUITE_DESKS.map(d=>d.kind))];
 for(const who of EVERYONE){
  const role=ROLE[who];
  const officer=OFFICERS.includes(who);
  // Generic register never lists or opens dedicated desk or help records.
  if(officer){
   const listed=new Set((await call(who,'/api/records')).records.map(r=>r.id));
   for(const kind of genericKinds)for(const r of (await call(who,'/api/records?kind='+kind)).records)listed.add(r.id);
   for(const r of [...records,{id:help.id}])assert.ok(!listed.has(r.id),who+' generic list leaked '+r.id);
  }else assert.equal(await statusOf(who,'/api/records'),who?403:401);
  for(const r of [...records,{id:help.id}]){
   for(const suffix of ['','/revisions'])assert.ok([401,403,404].includes(await statusOf(who,'/api/records/'+r.id+suffix)),who+' generic read');
   assert.ok([401,403,404].includes(await statusOf(who,'/api/records/'+r.id,'PATCH',{version:1,title:'Bypass'})));
   assert.ok([401,403,404].includes(await statusOf(who,'/api/records/'+r.id+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test'})));
  }
  // Dedicated desk routes follow each desk's office list exactly.
  for(const {desk,id} of records){
   const allowed=Boolean(role&&desk.roles.includes(role));
   const listStatus=await statusOf(who,'/api/suite/'+desk.key);
   assert.equal(listStatus,allowed?200:who?403:401,who+' list '+desk.key);
   if(allowed)assert.ok((await call(who,'/api/suite/'+desk.key)).records.some(r=>r.id===id));
   for(const suffix of ['','/history'])assert.equal(await statusOf(who,'/api/suite/'+desk.key+'/'+id+suffix),allowed?200:who?403:401,who+' read '+desk.key+suffix);
   if(!allowed){
    assert.equal(await statusOf(who,'/api/suite/'+desk.key+'/'+id,'PATCH',{version:1,...sample(desk)}),who?403:401);
    assert.equal(await statusOf(who,'/api/suite/'+desk.key+'/'+id+'/decision','POST',{version:1,decision:'approved',evidence:'https://example.test'}),who?403:401);
   }
   // A record ID addressed through a different desk never resolves.
   const other=SUITE_DESKS.find(d=>d.key!==desk.key&&d.roles.includes(role||'')&&!['notices','todos'].includes(d.key));
   if(other)assert.equal(await statusOf(who,'/api/suite/'+other.key+'/'+id),404,who+' cross-desk '+other.key);
  }
  // Calendar adapters.
  for(const [path,key,prop] of [['/api/committee/events','events','events'],['/api/meetings','meetings','meetings']]){
   const r=records.find(x=>x.desk.key===key);
   if(!officer){assert.ok([401,403].includes(await statusOf(who,path)));continue}
   const ids=(await call(who,path))[prop].map(x=>x.id);
   assert.equal(ids.includes(r.id),r.desk.roles.includes(role),who+' calendar '+key);
  }
  // Private help: requester and Webmaster only, including status, history and counts.
  const helpAllowed=['sec','web'].includes(who);
  for(const suffix of ['','/status','/history'])assert.equal(await statusOf(who,'/api/webmaster/requests/'+help.id+suffix),helpAllowed?200:!who?401:who==='demo'?403:404,who+' help'+suffix);
  if(officer||who==='member'){
   const mine=await call(who,'/api/webmaster/requests');
   assert.equal(mine.requests.some(r=>r.id===help.id),helpAllowed);
   assert.equal(mine.counters===null,who!=='web');
  }
  if(officer){
   const board=JSON.stringify(await call(who,'/api/committee/notices'))+JSON.stringify(await call(who,'/api/committee/todos'));
   assert.ok(!board.includes(help.id),who+' noticeboard leaked help');
   assert.ok(!(await call(who,'/api/suite/notices')).records.some(r=>r.id===help.id));
  }
  // Audit index and CSV export apply the same policy before paging.
  if(['web','pres','sec'].includes(who)){
   const audit=(await call(who,'/api/audit')).audit;
   for(const {desk,id} of records)assert.equal(audit.some(a=>a.resourceId===id),desk.roles.includes(role),who+' audit '+desk.key);
   assert.equal(audit.some(a=>a.resourceId===help.id),who==='web');
   const csv=await (await request(who,'/api/audit?format=csv')).text();
   for(const {desk,id} of records)assert.equal(csv.includes(id),desk.roles.includes(role),who+' csv '+desk.key);
   assert.equal(csv.includes(help.id),who==='web');
   assert.ok(!csv.includes('Fictional Straddie example')&&!csv.includes('Fictional private request'),'CSV never includes record bodies');
  }else assert.ok([401,403].includes(await statusOf(who,'/api/audit')));
 }
 // Nothing above changed any record or wrote any history.
 assert.deepEqual(snapshot(),before);assert.equal(count('club_revisions'),revisions);
 // Members, even active and verified, see no unreleased desk record or help request.
 env.SANDY_CLUB_APPROVALS='enabled';active('member');await verifyAdult('member');
 const memberView=JSON.stringify(await call('member','/api/member/workspace'))+JSON.stringify(await call('member','/api/member/events'))+JSON.stringify(await call('member','/api/member/data-export'));
 for(const r of [...records,{id:help.id}])assert.ok(!memberView.includes(r.id));
});
