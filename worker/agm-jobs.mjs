import {escapeIcs,foldIcsLine} from './data.mjs';

const tasks={
  papers:{days:21,title:'Get the AGM papers together',help:'A planning target. Confirm the reporting year and registered rules. Ask the Treasurer for the accounts and any required review. Check the last AGM record and any Fair Trading correspondence.'},
  notice:{days:14,title:'Give members the AGM notice',help:'The Secretary checks the notice reaches each member in time. Include the date, place, how to attend and business to be considered. Keep the notice and a record of how it was given.'},
  nominations:{days:14,title:'Receive signed nominations',help:'Under the club’s archive rules, two members nominate the candidate. Both nominators and the candidate sign. Give the written nomination to the Secretary.'},
  candidates:{days:7,title:'Post the candidate list',help:'List candidates alphabetically with their nominators. The archive rules call for the list at the office or usual meeting place for at least seven days before the AGM.'},
  adjournment:{days:0,title:'Check how this AGM can resume',help:'Find the original notice and record of adjournment. Check the registered rules for unfinished business, the new date and whether fresh notice is required.'},
  attendance:{days:0,title:'Check attendance and quorum',help:'Record the members present and the quorum required under the registered rules. Check separately who may vote. If quorum is absent, record what happened and the next step.'},
  record:{days:0,title:'Check the AGM record',help:'Check the actual meeting date, attendance, quorum and what business was completed. Record the outcome at the meeting desk before choosing the next step.'},
  resume:{days:0,title:'Arrange the next AGM step',help:'Read the attendance and adjournment record. Identify any unfinished business, check the registered rules and original notice, then arrange the next properly called meeting.'},
  filing:{title:'Check and lodge the annual return',help:'The date shown is one calendar month after the meeting date on file. Check whether a return is required, the actual AGM date and any extension with Fair Trading. Mark done after lodging or confirming an exemption. Keep the receipt or reference with the club records.'}
};
const fresh=['papers','notice','nominations','candidates','attendance'],adjourned=['adjournment','attendance'];
const dayAt=(day,offset)=>new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
const agms=`SELECT r.id,r.title,r.date,r.date<? AS past,coalesce(n.status,'draft') AS recordStatus,
  coalesce(json_extract(a.formal_json,'$.quorumStatus'),'unchecked') AS quorumStatus,
  coalesce(p.basis,'fresh') AS basis,coalesce(p.version,0) AS planVersion
  FROM meeting_register r LEFT JOIN agm_job_plans p ON r.id=p.meeting_id
  LEFT JOIN meeting_agendas a ON a.meeting_id=r.id LEFT JOIN meeting_notes n ON n.id=r.id
  WHERE coalesce(json_extract(a.formal_json,'$.kind'),r.agenda_kind)='agm'`;

function jobKeys(plan) {
  if(plan.recordStatus==='approved'){
    if(plan.quorumStatus==='present')return ['filing'];
    if(['absent','lost'].includes(plan.quorumStatus))return ['resume'];
    return ['record'];
  }
  if(plan.past)return ['record'];
  return plan.basis==='adjourned'?adjourned:fresh;
}
function nextMonth(day){
  const [y,m,d]=day.split('-').map(Number);
  const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  return new Date(Date.UTC(y,m,Math.min(d,last))).toISOString().slice(0,10);
}
export async function readPlans(db,today) {
  const [plans,rows]=await db.batch([db.prepare(agms+' ORDER BY r.date,r.time,r.id').bind(today),
    db.prepare('SELECT s.* FROM agm_job_state s JOIN ('+agms+') eligible ON eligible.id=s.meeting_id').bind(today)]);
  const result=new Map(rows.results.map(row=>[row.meeting_id+'/'+row.job,row]));
  return plans.results.map(plan=>({...plan,jobs:jobKeys(plan).map(key=>{
    const row=result.get(plan.id+'/'+key),task=tasks[key];
    return {key,title:task.title,help:task.help,due:key==='filing'?nextMonth(plan.date):dayAt(plan.date,-task.days),version:row?.version||0,
      owner:row?.owner_name||'',ownerId:row?.owner_id||'',doneAt:row?.done_at||null,doneBy:row?.done_by||''};
  })}));
}

function calendar(plan,helpers) {
  const format=day=>day.replaceAll('-','');
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//AGM jobs//EN','CALSCALE:GREGORIAN'];
  for(const job of plan.jobs.filter(j=>!j.doneAt))lines.push('BEGIN:VEVENT','UID:'+escapeIcs(plan.id+'-'+job.key)+'@sandy-sports.example',
    'DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+format(job.due),'DTEND;VALUE=DATE:'+format(dayAt(job.due,1)),
    'SUMMARY:'+escapeIcs('Sandy Sports · '+job.title),'DESCRIPTION:'+escapeIcs(plan.title+'\n'+job.help),'CLASS:PRIVATE',
    'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:'+escapeIcs(job.title),'END:VALARM','END:VEVENT');
  lines.push('END:VCALENDAR');
  return helpers.response(lines.map(foldIcsLine).join('\r\n')+'\r\n',200,{'Cache-Control':'private, no-store','Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="Sandy-AGM-reminders.ics"'});
}

export async function agmJobs(request,env,identity,helpers) {
  const {requireRole,requireDb,json,bodyJson,HttpError}=helpers;
  requireRole(identity,['committee']);
  const binding=requireDb(env),db=binding.withSession?binding.withSession('first-primary'):binding;
  const now=new Date(),today=new Date(+now+36000000).toISOString().slice(0,10);
  if(request.method==='GET'){
    const plans=await readPlans(db,today),id=new URL(request.url).searchParams.get('calendar');
    if(id){
      const plan=plans.find(p=>p.id===id);
      if(!plan)throw new HttpError(404,'Open an upcoming AGM first.','agm_missing');
      return calendar(plan,helpers);
    }
    return json({today,plans});
  }
  if(request.method!=='POST')throw new HttpError(405,'Open the AGM jobs list.','method_not_allowed');
  const body=await bodyJson(request),{id,key,version,action,basis}=body;
  if(typeof id!=='string'||!Number.isSafeInteger(version)||version<0)throw new HttpError(400,'Open the current list of AGM jobs.','invalid_job');
  const plan=(await readPlans(db,today)).find(p=>p.id===id);
  if(!plan)throw new HttpError(404,'This AGM is no longer in the upcoming list.','agm_missing');
  let write;
  // Recheck the meeting, notice basis and job versions at write time. Two
  // volunteers cannot both acquire the same unclaimed job.
  const active='EXISTS(SELECT 1 FROM ('+agms+') WHERE id=? AND planVersion=? AND recordStatus=? AND quorumStatus=?)';
  if(action==='basis' && !plan.past && plan.recordStatus!=='approved' && ['fresh','adjourned'].includes(basis)){
    write=db.prepare(`INSERT INTO agm_job_plans(meeting_id,basis,version) SELECT ?,?,? WHERE ${active}
      ON CONFLICT(meeting_id) DO UPDATE SET basis=excluded.basis,version=excluded.version`)
      .bind(id,basis,version+1,today,id,version,plan.recordStatus,plan.quorumStatus);
  }else{
    const job=plan.jobs.find(j=>j.key===key);
    if(!job||!['claim','release','done','reopen'].includes(action))throw new HttpError(400,'Choose a job and its next step.','invalid_job');
    const own=job.ownerId===identity.id || (job.ownerId==='office:'+identity.name && ['committee','treasurer'].includes(identity.accountRole));
    if(job.ownerId && !own && ['done','release','reopen'].includes(action))throw new HttpError(403,'This job belongs to another officer. The secretaries can record returned paper lists at To-do lists.','job_owner');
    if(body.planVersion!==plan.planVersion || job.version!==version || (action==='claim' && (job.owner||job.doneAt)) ||
      (action==='release' && (!own||job.doneAt)) || (action==='done' && job.doneAt) || (action==='reopen' && !job.doneAt)){
      throw new HttpError(409,'The job changed. Check the latest list.','job_changed');
    }
    const take=action==='claim'||(action==='done'&&!job.ownerId);
    const who=take?identity.name||identity.id:action==='release'?null:job.owner||null;
    const ownerId=take?identity.id:action==='release'?null:job.ownerId||null;
    write=db.prepare(`INSERT INTO agm_job_state(meeting_id,job,owner_id,owner_name,done_at,done_by,version)
      SELECT ?,?,?,?,?,?,? WHERE ${active} AND coalesce((SELECT version FROM agm_job_state WHERE meeting_id=? AND job=?),0)=?
      ON CONFLICT(meeting_id,job) DO UPDATE SET owner_id=excluded.owner_id,owner_name=excluded.owner_name,
      done_at=excluded.done_at,done_by=excluded.done_by,version=excluded.version`)
      .bind(id,key,ownerId,who,action==='done'?now.toISOString():null,action==='done'?identity.name||identity.id:null,version+1,today,id,body.planVersion,plan.recordStatus,plan.quorumStatus,id,key,version);
  }
  const [saved]=await db.batch([write,db.prepare("INSERT INTO audit_log SELECT ?,?,'committee',?,?,? WHERE changes()=1")
    .bind(crypto.randomUUID(),identity.id,'agm_job_'+action,id+'/'+(key||'notice'),now.toISOString())]);
  if(!saved.meta.changes)throw new HttpError(409,'Another officer updated this job. Check the latest list.','job_changed');
  return json({today,plans:await readPlans(db,today)});
}
