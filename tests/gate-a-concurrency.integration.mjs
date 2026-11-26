// SEC-09: across every versioned shared-record editor, two sessions saving the same
// version produce exactly one change; the loser writes no revision or audit; the
// recorded actor is always the authenticated session, never a submitted field.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {fixture,ROLE_ACTORS} from './d1-fixture.mjs';
const FORGED={createdBy:'forged',updatedBy:'forged',actorId:'forged',actor_id:'forged',updated_by:'forged',office:'President'};
const eventFields=()=>{const f={};for(const x of SUITE_BY_KEY.events.fields)f[x.key]=x.type==='checkbox'?false:x.type==='select'?x.options[0]:x.type==='date'?'2027-01-09':x.type==='time'?(x.key==='endTime'?'11:00':'09:00'):x.type==='number'?1:x.type==='url'?'':'Fictional';return f};

test('one winner per version on every versioned editor; rejected saves leave no trace; actor cannot be forged',async t=>{
 const {call,request,sql,count,actors}=fixture(t,{actors:[...ROLE_ACTORS,['web2','webmaster']]});
 const help=await call('sec','/api/webmaster/requests','POST',{subject:'Fictional request',category:'Other',message:'Example only'},201);
 const cases=[
  {name:'generic record',who:['other','sec'],kind:'record',id:(await call('other','/api/records','POST',{kind:'social_idea',title:'Fictional idea',body:{notes:'a'}},201)).id,
   path:id=>'/api/records/'+id,method:'PATCH',body:(v,n)=>({version:v,title:'Edit '+n,body:{notes:n}}),table:'club_records'},
  {name:'suite desk',who:['sec','pres'],kind:'record',id:(await call('sec','/api/suite/events','POST',{title:'Fictional event',fields:eventFields()},201)).id,
   path:id=>'/api/suite/events/'+id,method:'PATCH',body:(v,n)=>({version:v,title:'Edit '+n,fields:eventFields(),reason:'Fictional '+n}),table:'club_records'},
  {name:'people directory',who:['web','sec'],kind:'person',id:(await call('web','/api/people','POST',{name:'Fictional prospect'},201)).id,
   path:id=>'/api/people/'+id,method:'PATCH',body:(v,n)=>({version:v,town:'Town '+n,reason:'Fictional '+n}),table:'club_people'},
  {name:'production brief',who:['other','treasurer'],kind:'studio-brief',id:(await call('other','/api/studio/briefs','POST',{title:'Fictional brief'},201)).id,
   path:id=>'/api/studio/briefs/'+id,method:'PATCH',body:(v,n)=>({version:v,notes:'Note '+n}),table:'studio_briefs'},
  {name:'private help reply',who:['web','web2'],kind:'record',id:help.id,
   path:id=>'/api/webmaster/requests/'+id,method:'PATCH',body:(v,n)=>({version:v,stage:'review',reply:'Reply '+n}),table:'club_records'},
  {name:'Social Studio edits',who:['other','sec'],kind:'social-edits',id:'sandy-social',
   path:()=>'/api/committee/social-post-edits',method:'POST',body:(v,n)=>({version:v,edits:{['post-'+n]:{note:'Fictional '+n}}}),table:'studio_post_edits',v0:0},
  {name:'Social Studio metrics',who:['treasurer','asst'],kind:'social-metrics',id:'sandy-social',
   path:()=>'/api/committee/social-metrics',method:'POST',body:(v,n)=>({version:v,metrics:[{post:'Fictional '+n,reach:1}]}),table:'studio_metrics',v0:0}
 ];
 for(const c of cases){
  const v=c.v0??1,revs=()=>count('club_revisions','resource_kind=? AND resource_id=?',c.kind,c.id),audits=()=>count('club_audit','resource_id=?',c.id);
  const r0=revs(),a0=audits();
  const responses=await Promise.all(c.who.map((w,i)=>request(w,c.path(c.id),c.method,{...FORGED,...c.body(v,'n'+i)})));
  const statuses=responses.map(r=>r.status);
  assert.deepEqual([...statuses].sort(),[200,409],c.name+' '+statuses);
  const winner=c.who[statuses.indexOf(200)],loser=c.who[statuses.indexOf(409)];
  assert.equal(revs(),r0+1,c.name+' revisions');assert.equal(audits(),a0+1,c.name+' audit');
  const rev=sql.prepare('SELECT actor_id,actor_role,resource_version FROM club_revisions WHERE resource_kind=? AND resource_id=? ORDER BY resource_version DESC LIMIT 1').get(c.kind,c.id);
  assert.equal(rev.actor_id,actors[winner].id,c.name+' revision actor');assert.equal(rev.resource_version,v+1);
  const au=sql.prepare('SELECT actor_id,context_json FROM club_audit WHERE resource_id=? ORDER BY occurred_utc DESC,rowid DESC LIMIT 1').get(c.id);
  assert.equal(au.actor_id,actors[winner].id,c.name+' audit actor');
  const ctx=JSON.parse(au.context_json);assert.equal(ctx.fromVersion,v,c.name+' from');assert.equal(ctx.toVersion,v+1,c.name+' to');
  assert.ok(!JSON.stringify(ctx).includes('forged'));
  const stored=c.table.startsWith('studio_')&&c.id==='sandy-social'?sql.prepare('SELECT version,updated_by FROM '+c.table+' WHERE id=1').get():sql.prepare('SELECT version,updated_by,created_by FROM '+c.table+' WHERE id=?').get(c.id);
  assert.equal(stored.version,v+1);assert.equal(stored.updated_by,actors[winner].id);
  if(stored.created_by)assert.notEqual(stored.created_by,'forged');
  // The loser's stale retry is still rejected and writes nothing.
  assert.equal((await request(loser,c.path(c.id),c.method,c.body(v,'retry'))).status,409);
  assert.equal(revs(),r0+1);assert.equal(audits(),a0+1);
 }
 // Revision history records only genuine changed field names, never submitted junk keys.
 const person=cases[2],h=(await call('web','/api/people/'+person.id+'/revisions')).revisions[0];
 assert.deepEqual(h.changes.updatedFields,['town']);assert.equal(h.changes.fromVersion,1);assert.match(h.changes.reason,/^Fictional/);
 // Scoped audit shows version transitions to authorised reviewers only.
 const entry=(await call('sec','/api/audit?kind=person')).audit.find(a=>a.resourceId===person.id&&a.action==='person_updated');
 assert.equal(entry.fromVersion,1);assert.equal(entry.toVersion,2);
 await call('other','/api/audit','GET',undefined,403);await call('treasurer','/api/audit','GET',undefined,403);await call('member','/api/audit','GET',undefined,403);
});
