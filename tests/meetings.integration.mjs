// GOV-05/06/07/10/11/12: meeting register, formal agenda and outcomes, minutes,
// member minutes edition, meeting actions, AGM jobs and in-app reminders.
// Isolated fictional fixture; nothing is sent, adopted or appointed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const EVIDENCE='https://example.test/fictional-minute';
const day=n=>new Date(Date.now()+36e6+n*864e5).toISOString().slice(0,10);
const M='/api/committee/meetings/';
async function meeting(call,date=day(3),type='Management committee'){
 return (await call('sec','/api/suite/meetings','POST',{title:'Fictional summer committee',fields:{meetingType:type,date,startTime:'18:00',endTime:'19:30',location:'Fictional Dunwich hall'}},201)).id;
}

test('register: reschedule, cancel, calendar and reminders follow the one meeting record',async t=>{
 const {call,count,env}=fixture(t);
 const id=await meeting(call);
 let r=(await call('sec','/api/committee/reminders')).reminders;
 assert.deepEqual(r.map(x=>[x.meetingId,x.daysAway]),[[id,3]]);
 assert.equal((await call('treasurer','/api/committee/reminders')).reminders.length,0);
 assert.equal((await call('other','/api/committee/reminders')).reminders.length,0);
 await call('member','/api/committee/reminders','GET',undefined,403);
 const oldKey=r[0].key;
 await call('sec',M+id,'POST',{action:'schedule',version:1,date:day(20),startTime:'18:00',endTime:'19:30',reason:'Fictional venue clash'});
 assert.equal((await call('sec','/api/committee/reminders')).reminders.length,0,'obsolete reminder removed');
 env.SANDY_MEETING_REMINDER_DAYS='30';
 r=(await call('sec','/api/committee/reminders')).reminders;assert.equal(r.length,1);assert.notEqual(r[0].key,oldKey);
 env.SANDY_MEETING_REMINDER_DAYS='7';
 await call('sec',M+id,'POST',{action:'schedule',version:2,date:day(2),startTime:'17:00',endTime:'18:00'});
 assert.equal((await call('sec','/api/meetings')).meetings[0].date,day(2));
 const v=await call('sec',M+id);
 assert.deepEqual(v.meeting.schedule.map(s=>s.date),[day(3),day(20)]);
 // Stale and invalid edits are refused without history.
 const before=count('club_revisions','resource_id=?',id);
 await call('pres',M+id,'POST',{action:'schedule',version:2,date:day(5)},409);
 await call('sec',M+id,'POST',{action:'schedule',version:3,date:day(5),startTime:'18:00',endTime:'17:00'},400);
 await call('sec',M+id,'POST',{action:'cancel',version:3},400);
 assert.equal(count('club_revisions','resource_id=?',id),before);
 await call('sec',M+id,'POST',{action:'cancel',version:3,reason:'Fictional storm warning'});
 assert.equal((await call('sec','/api/meetings')).meetings[0].status,'cancelled');
 assert.equal((await call('sec','/api/committee/reminders')).reminders.length,0);
 await call('sec',M+id,'POST',{action:'schedule',version:4,date:day(6)},409);
 assert.equal((await call('sec','/api/committee/meetings')).meetings[0].status,'cancelled');
 // Office boundaries.
 for(const who of ['treasurer','other','member'])await call(who,M+id,'GET',undefined,403);
 await call('vp',M+id,'GET');// the Vice President holds the President's access
 await call(null,'/api/committee/meetings','GET',undefined,401);
});

test('agenda, attendance, recorded outcomes and minutes carry through without retyping',async t=>{
 const {call,count,env}=fixture(t);
 const id=await meeting(call);
 const items=[{title:'Welcome and apologies'},{title:'Summer net kit',kind:'motion',proposer:'Fictional A',seconder:'Fictional B',motion:'That the committee seek two quotes for portable net kits.',actions:[{text:'Request two net kit quotes',office:'treasurer',due:day(10)}]},{title:'Volunteer roster',actions:[{text:'Draft roster for Cylinder Beach',office:'secretary'}]}];
 let s=await call('sec',M+id,'POST',{action:'agenda',version:1,items});
 const motionId=s.agenda[1].id;
 // Reorder keeps item identity.
 s=await call('sec',M+id,'POST',{action:'agenda',version:2,items:[s.agenda[0],s.agenda[2],s.agenda[1]]});
 assert.deepEqual(s.agenda.map(x=>x.order+':'+x.title),['1:Welcome and apologies','2:Volunteer roster','3:Summer net kit']);
 assert.equal(s.agenda[2].id,motionId);
 await call('sec',M+id,'POST',{action:'agenda',version:2,items},409);
 await call('sec',M+id,'POST',{action:'agenda',version:3,items:[{title:'Bad',actions:[{text:'x',office:'mayor'}]}]},400);
 // Quorum stays unset until configured by the owner.
 let a=await call('sec',M+id,'POST',{action:'attendance',version:3,present:['Fictional A','Fictional B','Fictional C'],apologies:['Fictional D']});
 assert.equal(a.attendance.quorumRequired,null);assert.equal(a.attendance.quorumMet,null);
 env.SANDY_MEETING_QUORUM='4';
 a=await call('sec',M+id,'POST',{action:'attendance',version:4,present:['Fictional A','Fictional B','Fictional C'],apologies:['Fictional D']});
 assert.equal(a.attendance.quorumRequired,4);assert.equal(a.attendance.quorumMet,false);
 await call('sec',M+id,'POST',{action:'outcome',version:5,itemId:motionId,outcome:'carried',votes:{for:1,against:2,abstain:0}},400);
 await call('sec',M+id,'POST',{action:'outcome',version:5,itemId:'missing-item',outcome:'carried'},404);
 await call('sec',M+id,'POST',{action:'outcome',version:5,itemId:motionId,outcome:'carried',votes:{for:3,against:0,abstain:0},note:'Fictional'});
 const v=(await call('sec',M+id)).meeting;
 assert.match(v.generatedMinutes,/Motion: That the committee seek two quotes/);
 assert.match(v.generatedMinutes,/Recorded outcome: carried \(for 3, against 0, abstain 0\)/);
 assert.match(v.generatedMinutes,/quorum NOT met/);
 assert.match(v.generatedMinutes,/Action: Request two net kit quotes \| treasurer/);
 const m=await call('sec',M+id,'POST',{action:'minutes',version:6});
 assert.equal(m.minutes.fromGenerated,true);
 assert.equal((await call('sec','/api/suite/meetings/'+id)).record.fields.draftMinutes,v.generatedMinutes);
 // Changing the motion wording clears its recorded outcome.
 const changed=v.agenda.map(x=>x.id===motionId?{...x,motion:'That the committee seek three quotes.'}:x);
 const after=await call('sec',M+id,'POST',{action:'agenda',version:7,items:changed});
 assert.equal(after.agenda.find(x=>x.id===motionId).outcome,null);
 assert.ok(count('club_revisions','resource_id=?',id)>=8);
});

test('meeting actions become one task each, reconcile completion, and survive repeats',async t=>{
 const {call}=fixture(t);
 const id=await meeting(call);
 await call('sec',M+id,'POST',{action:'agenda',version:1,items:[{title:'Kit',actions:[{text:'Request two net kit quotes',office:'treasurer',due:day(10)},{text:'Book hall',office:'secretary'}]}]});
 const both=await Promise.all([call('sec',M+id,'POST',{action:'actions',version:2}),call('asst',M+id,'POST',{action:'actions',version:2})]);
 assert.equal(both[0].created+both[1].created,2);
 assert.equal((await call('sec',M+id,'POST',{action:'actions',version:2})).created,0);
 const tasks=(await call('treasurer','/api/committee/todos')).tasks;
 const mine=tasks.find(x=>x.title==='Request two net kit quotes');assert.ok(mine);
 assert.ok(!tasks.some(x=>x.title==='Book hall'),'treasurer sees only own office task');
 await call('treasurer','/api/committee/todos','POST',{action:'complete',id:mine.id,version:1,paper:false});
 const acts=(await call('sec',M+id)).meeting.actions;
 assert.deepEqual(acts.map(a=>[a.text,a.exists,a.complete]),[['Request two net kit quotes',true,true],['Book hall',true,false]]);
});

test('approved minutes and a separately released member edition; withdrawal hides it',async t=>{
 const {call,env,active,verifyAdult}=fixture(t);
 const id=await meeting(call,day(-1));
 await call('sec',M+id,'POST',{action:'minutes',version:1,text:'Committee draft with Fictional Private Name and phone details'});
 await call('sec',M+id+'/member-edition','POST',{text:'Member edition: the committee will seek net kit quotes.'},400);
 const ed=await call('sec',M+id+'/member-edition','POST',{text:'Member edition: the committee will seek net kit quotes.',personalDetailsRemoved:true},201);
 for(const who of ['treasurer','other','member'])await call(who,'/api/committee/minutes/'+ed.id,'GET',undefined,403);
 await call('web','/api/records/'+ed.id,'GET',undefined,404);
 await call('sec','/api/committee/minutes/'+ed.id+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE},409);
 env.SANDY_CLUB_APPROVALS='enabled';active('member');await verifyAdult('member');
 const minutes=async()=>(await call('member','/api/member/workspace')).minutes;
 await call('pres','/api/committee/minutes/'+ed.id+'/decision','POST',{version:1,decision:'approved',evidence:EVIDENCE});
 // Release needs the committee minutes approved first.
 await call('sec','/api/committee/minutes/'+ed.id+'/decision','POST',{version:2,decision:'release',evidence:EVIDENCE},409);
 await call('pres','/api/suite/meetings/'+id+'/decision','POST',{version:2,decision:'approved',evidence:EVIDENCE});
 await call('sec',M+id,'POST',{action:'minutes',version:3,text:'Late edit'},409);
 assert.deepEqual(await minutes(),[]);
 await call('sec','/api/committee/minutes/'+ed.id+'/decision','POST',{version:2,decision:'release',evidence:EVIDENCE});
 const shown=await minutes();
 assert.equal(shown.length,1);assert.match(shown[0].text,/seek net kit quotes/);
 const ws=JSON.stringify(await call('member','/api/member/workspace'));
 assert.ok(!ws.includes('Fictional Private Name'),'committee draft never reaches members');
 await call('sec','/api/committee/minutes/'+ed.id+'/decision','POST',{version:3,decision:'returned',evidence:EVIDENCE,reason:'Fictional correction'});
 assert.deepEqual(await minutes(),[]);
 const view=(await call('sec',M+id)).meeting;
 assert.equal(view.minutesApproved,true);assert.equal(view.memberEditions[0].released,false);
});

test('AGM jobs generate once, follow a date change, and leave completed jobs alone',async t=>{
 const {call}=fixture(t);
 const agm=(await call('sec','/api/suite/agm','POST',{title:'Fictional first AGM',fields:{agmDate:'2027-08-28',venue:'Fictional hall'}},201)).id;
 await call('treasurer','/api/committee/agm/'+agm+'/jobs','POST',{version:1},403);
 const first=await call('sec','/api/committee/agm/'+agm+'/jobs','POST',{version:1});
 assert.equal(first.created,10);assert.match(first.status,/pending owner/);
 assert.equal((await call('sec','/api/committee/agm/'+agm+'/jobs','POST',{version:1})).created,0);
 const tTasks=(await call('treasurer','/api/committee/todos')).tasks.filter(x=>/financial/.test(x.title));
 assert.equal(tTasks.length,2);
 const notice=(await call('sec','/api/committee/todos')).tasks.find(x=>/notice of AGM/.test(x.title));
 assert.equal(notice.dueDate,'2027-08-07');
 await call('sec','/api/committee/todos','POST',{action:'complete',id:notice.id,version:1,paper:false});
 const fields={agmDate:'2027-09-04',venue:'Fictional hall'};
 await call('sec','/api/suite/agm/'+agm,'PATCH',{version:1,title:'Fictional first AGM',fields});
 const moved=await call('sec','/api/committee/agm/'+agm+'/jobs','POST',{version:2});
 assert.equal(moved.created,0);assert.equal(moved.rescheduled,9);
 const all=(await call('sec','/api/committee/todos')).tasks;
 assert.equal(all.find(x=>x.id===notice.id).dueDate,'2027-08-07','completed job kept');
 assert.equal(all.find(x=>/Close nominations/.test(x.title)).dueDate,'2027-08-28');
});
