// SEC-08: every approval, activation, publishing, commissioning and member release
// path fails closed while SANDY_CLUB_APPROVALS is disabled; an isolated enabled
// fixture demonstrates authorised decision, separate release, and replay rejection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SUITE_DESKS} from '../studio/sandy-suite-spec.js';
import {fixture} from './d1-fixture.mjs';
const EVIDENCE='https://example.test/fictional-minute';
const sample=desk=>{
 const fields={};
 for(const f of desk.fields){
  if(f.type==='checkbox')fields[f.key]=false;
  else if(f.type==='select')fields[f.key]=f.options[0];
  else if(f.type==='date')fields[f.key]='2027-02-14';
  else if(f.type==='month')fields[f.key]='2027-02';
  else if(f.type==='time')fields[f.key]=f.key==='endTime'?'11:00':'09:00';
  else if(f.type==='number')fields[f.key]=1;
  else if(f.type==='url')fields[f.key]='https://example.test/fictional';
  else fields[f.key]='Fictional Straddie example';
 }
 return {title:'Fictional '+desk.title,fields};
};
const creatorFor=desk=>['web','sec','treasurer'].find(w=>desk.roles.includes({web:'webmaster',sec:'secretary',treasurer:'treasurer'}[w]));

test('while approvals are disabled every authority path fails closed and changes nothing',async t=>{
 const {call,count,actors,sql}=fixture(t);
 const created=[];
 for(const desk of SUITE_DESKS){
  if(['notices','todos'].includes(desk.key))continue;
  const who=creatorFor(desk);
  const r=await call(who,'/api/suite/'+desk.key,'POST',sample(desk),201);created.push([desk,r.id]);
 }
 const generic=await call('other','/api/records','POST',{kind:'event',title:'Fictional generic event',eventDate:'2027-02-14',body:{notes:'Example'}},201);
 const brief=await call('web','/api/studio/briefs','POST',{title:'Fictional clip'},201);
 const person=await call('web','/api/people','POST',{name:'Fictional prospect'},201);
 const before={records:sql.prepare('SELECT id,status,version FROM club_records ORDER BY id').all(),decisions:count('studio_decisions')};
 for(const who of ['web','pres','sec']){
  for(const [desk,rid] of created)for(const decision of ['approved','rejected','returned','release'])
   await call(who,'/api/suite/'+desk.key+'/'+rid+'/decision','POST',{version:1,decision,evidence:EVIDENCE},desk.roles.includes(actors[who].role)?409:403);
  for(const decision of ['approved','release'])await call(who,'/api/records/'+generic.id+'/decision','POST',{version:1,decision,evidence:EVIDENCE},409);
  await call(who,'/api/studio/briefs/'+brief.id+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE},409);
  await call(who,'/api/studio/briefs/'+brief.id+'/handoff','POST',{producer:'Example',authorised:true},409);
  await call(who,'/api/studio/briefs/'+brief.id+'/publish-link','POST',{platform:'noticeboard',url:'https://example.test/post'},409);
 }
 // Activation and enrolment paths.
 await call('web','/api/people','POST',{name:'Fictional active',status:'active'},409);
 await call('web','/api/people/'+person.id,'PATCH',{version:1,status:'active'},409);
 await call('web','/api/people/'+person.id+'/link-account','POST',{version:1,accountId:actors.member.id},409);
 await call('web','/api/committee/safeguards','POST',{action:'verify',accountId:actors.member.id,version:0,ageBand:'adult',guardianPermission:false,ageCheckedOffline:true},409);
 await call('member','/api/member/preferences','POST',{version:0,sports:[]},409);
 const reserved=await call('web','/api/accounts','POST',{username:'fixture-president',role:'president'},201);
 await call('web','/api/accounts/'+reserved.account.id+'/invite','POST',{manual:true},409);
 // Working edits cannot smuggle an approved stage or a release marker.
 await call('sec','/api/suite/events','POST',{...sample(SUITE_DESKS.find(d=>d.key==='events')),status:'approved'},400);
 await call('other','/api/records','POST',{kind:'event',title:'Forged',status:'approved'},400);
 await call('other','/api/records','POST',{kind:'event',title:'Forged release',body:{sandyRelease:{version:2,decisionId:'x',approvalId:'y'}}},400);
 await call('other','/api/records/'+generic.id,'PATCH',{version:1,body:{sandyRelease:{version:2}}},400);
 // Only the expected two creations happened; no status, version or decision changed.
 assert.deepEqual(sql.prepare("SELECT id,status,version FROM club_records WHERE id IN ("+before.records.map(()=>'?').join(',')+") ORDER BY id").all(...before.records.map(r=>r.id)),before.records);
 assert.equal(count('studio_decisions'),0);assert.equal(count('studio_handoffs'),0);assert.equal(count('studio_post_links'),0);
 assert.equal(count('club_invites'),0);assert.equal(count('club_people',"status='active'"),0);
 assert.equal(count('club_records',"status='approved'"),0);
});

test('isolated enabled fixture: authorised decision, separate member release, replay and unauthorised rejection',async t=>{
 const {call,env,count,active,verifyAdult}=fixture(t);
 env.SANDY_CLUB_APPROVALS='enabled';active('member');await verifyAdult('member');
 const events=SUITE_DESKS.find(d=>d.key==='events');
 const ev=await call('sec','/api/suite/events','POST',sample(events),201),path='/api/suite/events/'+ev.id;
 const memberEvents=async()=>(await call('member','/api/member/workspace')).events.map(e=>e.id);
 // Unauthorised offices: committee cannot decide, treasurer cannot see the desk, member/demo never.
 await call('other',path+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE},403);
 await call('treasurer',path+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE},403);
 await call('member',path+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE},403);
 // The Vice President holds the President's access, so the VP may decide (tested below with the Secretary).
 await call('sec',path+'/decision','POST',{version:1,decision:'approved'},400);
 await call('sec',path+'/decision','POST',{version:1,decision:'approved',evidence:'http://insecure.test'},400);
 // Release before approval is refused.
 await call('sec',path+'/decision','POST',{version:1,decision:'release',evidence:EVIDENCE},409);
 const approved=await call('pres',path+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE,reason:'Fictional committee motion'});
 assert.equal(approved.status,'approved');assert.equal(approved.version,2);
 // Approval is authority, not release: members still see nothing.
 assert.deepEqual(await memberEvents(),[]);
 assert.equal((await call('sec',path)).record.released,false);
 // Replayed or stale decisions are rejected and write nothing.
 const decisions=count('studio_decisions'),revisions=count('club_revisions','resource_id=?',ev.id);
 await call('pres',path+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE},409);
 await call('pres',path+'/decision','POST',{version:2,decision:'approved',evidence:EVIDENCE},409);
 await call('sec',path,'PATCH',{version:2,...sample(events)},409);
 assert.equal(count('studio_decisions'),decisions);assert.equal(count('club_revisions','resource_id=?',ev.id),revisions);
 // Explicit release of the exact approved version.
 const released=await call('sec',path+'/decision','POST',{version:2,decision:'release',evidence:EVIDENCE});
 assert.equal(released.version,3);assert.equal(released.released,true);
 assert.deepEqual(await memberEvents(),[ev.id]);
 assert.equal((await call('sec',path)).record.released,true);
 await call('sec',path+'/decision','POST',{version:3,decision:'release',evidence:EVIDENCE},409);
 await call('sec',path+'/decision','POST',{version:2,decision:'release',evidence:EVIDENCE},409);
 // Approvals switched off again: no further decision, existing record unchanged.
 env.SANDY_CLUB_APPROVALS='disabled';
 await call('sec',path+'/decision','POST',{version:3,decision:'returned',evidence:EVIDENCE},409);
 env.SANDY_CLUB_APPROVALS='enabled';
 // Returning for changes withdraws the release and reopens editing.
 await call('web',path+'/decision','POST',{version:3,decision:'returned',evidence:EVIDENCE});
 assert.deepEqual(await memberEvents(),[]);
 await call('sec',path,'PATCH',{version:4,...sample(events),title:'Revised fictional event'});
 // Decisions, revisions and audit carry the real actor and versions.
 const audit=(await call('web','/api/audit')).audit.filter(a=>a.resourceId===ev.id&&a.action.startsWith('suite_decision_'));
 assert.deepEqual(audit.map(a=>[a.action,a.fromVersion,a.toVersion]).reverse(),[['suite_decision_approved',1,2],['suite_decision_release',2,3],['suite_decision_returned',3,4]]);
 const history=(await call('sec',path+'/history')).history.find(h=>h.operation==='suite_decision_approved');
 assert.equal(history.role,'president');assert.equal(history.changes.reason,'Fictional committee motion');
 // Internal desks can be approved but never released to members.
 const meeting=await call('sec','/api/suite/meetings','POST',sample(SUITE_DESKS.find(d=>d.key==='meetings')),201);
 await call('sec','/api/suite/meetings/'+meeting.id+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE});
 await call('sec','/api/suite/meetings/'+meeting.id+'/decision','POST',{version:2,decision:'release',evidence:EVIDENCE},400);
 // Dedicated noticeboard records keep their own closure workflow.
 const noticeId=randomUUID(),today=(await call('sec','/api/committee/notices')).today;
 await call('sec','/api/committee/notices','POST',{action:'post',id:noticeId,kind:'info',title:'Fictional notice',details:'Example',scope:'all',important:false,reviewDate:today});
 await call('sec','/api/suite/notices/'+noticeId+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE},409);
 // Generic legacy events use the same separation.
 const generic=await call('other','/api/records','POST',{kind:'event',title:'Fictional generic event',eventDate:'2027-03-01',body:{notes:'Example'}},201);
 await call('sec','/api/records/'+generic.id+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE});
 assert.ok(!(await memberEvents()).includes(generic.id));
 await call('sec','/api/records/'+generic.id+'/decision','POST',{version:2,decision:'release',evidence:EVIDENCE});
 assert.ok((await memberEvents()).includes(generic.id));
});
