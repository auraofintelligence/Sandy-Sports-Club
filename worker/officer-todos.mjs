import {currentMeetingActions} from './meeting-actions.mjs';
import {readPlans} from './agm-jobs.mjs';
import {eventOpenOfficerJobs,eventJobCompletionWrites} from './fundraising-events.mjs';

const seats={president:'President',vicepresident:'Vice President',secretary:'Secretary',assistantsecretary:'Assistant Secretary',treasurer:'Treasurer'};
const normalize = name=>String(name||'').toLowerCase().trim().replace(/^the\s+/,'').replace(/[\s-]+/g,'');
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
function accountOffice(id,login,role) {
  return ['committee','treasurer'].includes(role) && Object.hasOwn(seats,login) ? login : 'other:'+id;
}
export {seats as officerSeats,accountOffice};
function officeRights(identity) {
  const viewerOffice=accountOffice(identity.id,identity.name,identity.accountRole);
  return {viewerOffice,canAssign:['secretary','assistantsecretary'].includes(viewerOffice)};
}
async function deskData(db,identity,today,rights,filter) {
  const {viewerOffice,canAssign}=rights;
  const [accounts,manual,meeting,news,history,events]=await db.batch([
    db.prepare("SELECT id,login,role FROM club_accounts WHERE disabled=0 AND role IN ('committee','treasurer','administrator') ORDER BY created_at,id"),
    db.prepare(`SELECT t.id,t.office,t.title,t.details,t.due_date AS dueDate,t.version,n.id AS noticeId
      FROM officer_todo_items t LEFT JOIN committee_notices n ON n.task_id=t.id
      WHERE t.done_at IS NULL AND (? OR t.office=?)`).bind(+canAssign,viewerOffice),
    db.prepare(`SELECT m.*,a.office FROM (${currentMeetingActions}) m LEFT JOIN officer_action_owners a
      ON a.meeting_id=m.meetingId AND a.action_id=m.id AND a.original_owner=m.owner WHERE m.done=0`),
    db.prepare(`SELECT month,title,version FROM newsletter_editions e WHERE ? AND status='review'
      AND (president_message<>'' OR EXISTS(SELECT 1 FROM newsletter_contributions c WHERE c.month=e.month AND c.office='president' AND c.status='included'))`)
      .bind(Number(canAssign || viewerOffice==='president')),
    db.prepare(`SELECT title,office,recorded_by AS recorderId,recorder_name AS recordedBy,recorded_at AS recordedAt,source,paper FROM (
      SELECT l.*,row_number() OVER(PARTITION BY office ORDER BY recorded_at DESC,mutation DESC) AS rank
      FROM officer_todo_log l WHERE action='complete' AND (? OR office=?)) WHERE rank<=20 ORDER BY recorded_at DESC`).bind(+canAssign,viewerOffice),
    db.prepare('SELECT * FROM ('+eventOpenOfficerJobs+') WHERE ? OR ownerId=?').bind(+canAssign,identity.id)
  ]);
  const directory=new Map(Object.entries(seats).map(([key,label])=>[key,{key,label}]));
  const byId=new Map();
  const owners=accounts.results.filter(account=>account.role==='administrator');
  const ownerLabels=new Map(owners.map((account,index)=>[account.id,owners.length===1?'Webmaster':'Webmaster '+(index+1)]));
  for(const account of accounts.results) {
    const key=accountOffice(account.id,account.login,account.role);
    directory.set(key,{key,label:ownerLabels.get(account.id)||seats[key]||account.login,accountId:account.id});byId.set(account.id,key);
  }
  if(!directory.has(viewerOffice)) directory.set(viewerOffice,{key:viewerOffice,label:identity.name||'Committee member',accountId:identity.id});
  const visible=office=>(canAssign || office===viewerOffice) && (!filter||filter==='all'||filter===office);
  const tasks=[],extra=new Map();
  const put=(task,internal={})=>{
    if(!visible(task.office))return;
    const record={details:'',dueDate:'',ownerText:'',meetingId:null,href:'#committee/todos',...task};
    record.canComplete=Boolean(record.office) && record.source!=='newsletter';
    tasks.push(record);extra.set(taskKey(record),internal);
  };
  for(const m of manual.results)put({...m,source:'manual',sourceLabel:m.noticeId?'Committee notice':'Officer task',
    href:m.noticeId?'#committee/notices':'#committee/todos'});
  for(const job of events.results){
    const office=byId.get(job.ownerId)||'other:'+job.ownerId;
    if(!directory.has(office))directory.set(office,{key:office,label:job.ownerName||'Committee member',accountId:job.ownerId});
    put({id:job.id,source:'event',office,title:job.title,details:job.details,dueDate:job.dueDate||'',
      meetingId:job.eventId,sourceLabel:job.eventTitle,href:'#committee/events',version:job.version},{ownerId:job.ownerId});
  }
  for(const m of meeting.results){
    const named=normalize(m.owner);
    const office=m.office || (Object.hasOwn(seats,named)?named:null);
    put({id:m.id,source:'meeting',title:m.text,sourceLabel:m.meetingTitle,ownerText:m.owner,
      office,version:m.version,dueDate:m.dueDate||'',meetingId:m.meetingId,href:'#committee/meetings'},{position:m.position});
  }
  for(const plan of await readPlans(db,today)) for(const job of plan.jobs){
    if(job.doneAt)continue;
    const reserved=job.ownerId?.startsWith('office:')?job.ownerId.slice(7):null;
    const office=byId.get(job.ownerId) || (Object.hasOwn(seats,reserved)?reserved:null);
    put({id:job.key,source:'agm',office,title:job.title,details:job.help,dueDate:job.due,
      ownerText:ownerLabels.get(job.ownerId)||job.owner,sourceLabel:plan.title,href:'#committee/meetings',meetingId:plan.id,
      version:job.version,planVersion:plan.planVersion},{ownerId:job.ownerId,recordStatus:plan.recordStatus,quorumStatus:plan.quorumStatus});
  }
  for(const e of news.results)put({id:e.month,source:'newsletter',office:'president',
    title:'Review the President’s message',details:e.title,sourceLabel:'Newsletter · '+e.month,href:'#committee/news',version:e.version});
  tasks.sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999') || a.title.localeCompare(b.title));
  const completions=history.results.filter(h=>visible(h.office)).map(({recorderId,...h})=>({...h,recordedBy:ownerLabels.get(recorderId)||h.recordedBy,paper:Boolean(h.paper)}));
  const usedOffices=new Set([...tasks,...completions].map(entry=>entry.office));
  const offices=[...directory.values()].filter(o=>visible(o.key) &&
    (!ownerLabels.has(o.accountId)||o.key===viewerOffice||usedOffices.has(o.key))).map(({key,label})=>({key,label}));
  return {view:{today,...rights,offices,tasks,completions},directory,extra};
}
const taskKey=t=>JSON.stringify([t.source,t.meetingId||'',t.id]);

export async function officerTodosEndpoint(request,env,identity,helpers) {
  const {requireRole,requireDb,bodyJson,HttpError,textField,dateField,json}=helpers;
  requireRole(identity,['committee']);
  const fail=(status,message)=>{throw new HttpError(status,message,'officer_tasks');};
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  const now=new Date(),stamp=now.toISOString(),today=new Date(+now+36000000).toISOString().slice(0,10);
  const rights=officeRights(identity),{viewerOffice,canAssign}=rights;
  const params=new URL(request.url).searchParams,filter=params.get('office');
  if([...params.keys()].some(k=>k!=='office'))fail(400,'Choose an office from the task desk.');
  if(filter && !canAssign && filter!==viewerOffice)fail(403,'Your sign-in opens your own to-do list.');
  if(!['GET','POST'].includes(request.method))fail(405,'Open the officer to-do list.');
  const {view,directory,extra}=await deskData(db,identity,today,rights,filter);
  if(filter && filter!=='all' && !directory.has(filter))fail(400,'Choose an office from the task desk.');
  if(request.method==='GET')return json(view);
  const b=await bodyJson(request),{action,source,id}=b;
  const conflict=()=>fail(409,'This task changed. Open the latest list before recording the update.');
  if(!['add','assign','complete'].includes(action))fail(400,'Choose a task action.');
  const mutation=crypto.randomUUID();
  let office,title,baseVersion,kind=source,meetingId='',paper=false;
  let writes;
  if(action==='add') {
    if(!uuid.test(id)||typeof id!=='string')fail(400,'Open a new task first.');
    office=b.office;if(!canAssign && office!==viewerOffice)fail(403,'You can add tasks to your own list.');
    if(!directory.has(office))fail(400,'Choose the office responsible.');
    title=textField(b.title,'the task',240,true);
    const details=textField(b.details,'task details',1000),due=dateField(b.dueDate,false);
    const previous=await db.prepare('SELECT * FROM officer_todo_items WHERE id=?').bind(id).first();
    if(previous){
      if(previous.office!==office || previous.title!==title || previous.details!==details || previous.due_date!==due || previous.created_by!==identity.id)conflict();
      return json(view);
    }
    kind='manual';baseVersion=0;
    writes=[db.prepare(`INSERT INTO officer_todo_items(id,office,title,details,due_date,created_at,created_by)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(id,office,title,details,due,stamp,identity.id)];
  } else {
    if(action==='assign' && !canAssign)fail(403,'The Secretary and Assistant Secretary allocate tasks to another office.');
    if(source==='newsletter')fail(403,'Use the newsletter desk to review and approve an edition.');
    if(source==='event' && action==='assign')fail(403,'Offer or take an event job in Events and fundraising.');
    if(!['manual','meeting','agm','event'].includes(source)||typeof id!=='string'||!Number.isSafeInteger(b.version)||b.version<0)fail(400,'Choose a current task.');
    if(action==='complete' && typeof b.paper!=='boolean')fail(400,'Indicate how this completion was recorded.');
    paper=action==='complete' && b.paper;
    if(paper && !canAssign)fail(403,'A secretary records returned paper lists.');
    meetingId=b.meetingId||'';
    if(typeof meetingId!=='string')fail(400,'Choose a current meeting.');
    const entry=view.tasks.find(t=>taskKey(t)===taskKey(b));
    if(!entry) {
      // Identical retries after a completed write must not tick another task or send another update.
      const prior=await db.prepare(`SELECT office FROM officer_todo_log WHERE action=? AND source=? AND task_id=? AND meeting_id=?
        AND base_version=? AND paper=? AND recorded_by=?`).bind(action,source,id,meetingId,b.version,+paper,identity.id).first();
      if(prior && (canAssign || prior.office===viewerOffice) && (action!=='assign'||prior.office===b.office))return json(view);
      if(!canAssign)fail(403,'Choose an item on your own list.');
      conflict();
    }
    if(b.version!==entry.version)conflict();
    baseVersion=entry.version;office=action==='assign'?b.office:entry.office;title=entry.title;
    if(action==='assign' && (!directory.has(office) || source==='manual'))fail(400,'Choose an office for this meeting or AGM task.');
    if(action==='complete' && (!entry.canComplete || (!paper && entry.office!==viewerOffice)))
      fail(403,'Complete your own task, or record a returned paper list as Secretary.');
    const internal=extra.get(taskKey(entry));
    if(source==='event')writes=eventJobCompletionWrites(db,{eventId:meetingId,key:id,version:baseVersion,ownerId:internal.ownerId,
      actorId:identity.id,actorName:identity.administrator?'Webmaster':identity.name||identity.id,stamp});
    if(source==='manual')writes=[db.prepare('UPDATE officer_todo_items SET done_at=?,version=version+1 WHERE id=? AND office=? AND version=? AND done_at IS NULL')
      .bind(stamp,id,office,baseVersion)];
    if(source==='meeting') {
      // Touch only the checked job in the confirmed action array. Neither the
      // approved text nor the decisions change. Minutes saves share this version.
      const guard=`id=? AND version=? AND status='approved' AND EXISTS(SELECT 1 FROM (${currentMeetingActions})
        WHERE meetingId=? AND id=? AND done=0 AND position=?)`;
      const args=[stamp,identity.id,mutation,meetingId,baseVersion,meetingId,id,internal.position];
      writes=[action==='complete'
        ? db.prepare(`UPDATE meeting_notes SET actions_json=json_set(actions_json,?,json('true')),version=version+1,
          updated_at=?,updated_by=?,last_mutation_id=? WHERE ${guard}`).bind('$['+internal.position+'].done',...args)
        : db.prepare(`UPDATE meeting_notes SET version=version+1,updated_at=?,updated_by=?,last_mutation_id=? WHERE ${guard}`).bind(...args)];
      if(action==='assign')writes.push(db.prepare(`INSERT INTO officer_action_owners(meeting_id,action_id,original_owner,office)
        SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM meeting_notes WHERE id=? AND last_mutation_id=?)
        ON CONFLICT(meeting_id,action_id) DO UPDATE SET original_owner=excluded.original_owner,office=excluded.office`)
        .bind(meetingId,id,entry.ownerText,office,meetingId,mutation));
    }
    if(source==='agm') {
      if(!Number.isSafeInteger(b.planVersion) || b.planVersion!==entry.planVersion)conflict();
      const guard=`EXISTS(SELECT 1 FROM meeting_register r LEFT JOIN meeting_agendas a ON a.meeting_id=r.id
        LEFT JOIN meeting_notes n ON n.id=r.id WHERE r.id=? AND coalesce(n.status,'draft')=?
        AND coalesce(json_extract(a.formal_json,'$.quorumStatus'),'unchecked')=?
        AND coalesce(json_extract(a.formal_json,'$.kind'),r.agenda_kind)='agm')
        AND coalesce((SELECT version FROM agm_job_plans WHERE meeting_id=?),0)=?`;
      const checkPlan=[meetingId,internal.recordStatus,internal.quorumStatus,meetingId,entry.planVersion];
      if(action==='assign') {
        if(internal.ownerId)fail(409,'This AGM job is already claimed. Ask the holder to release it before assigning a different office.');
        const chosen=directory.get(office);
        writes=[db.prepare(`INSERT INTO agm_job_state(meeting_id,job,owner_id,owner_name,done_at,done_by,version)
          SELECT ?,?,?,?,NULL,NULL,? WHERE ${guard} AND coalesce((SELECT version FROM agm_job_state WHERE meeting_id=? AND job=?),0)=?
          ON CONFLICT(meeting_id,job) DO UPDATE SET owner_id=excluded.owner_id,owner_name=excluded.owner_name,version=excluded.version
          WHERE agm_job_state.owner_id IS NULL AND agm_job_state.done_at IS NULL`)
          .bind(meetingId,id,chosen.accountId||'office:'+office,chosen.label,baseVersion+1,...checkPlan,meetingId,id,baseVersion)];
      } else {
        writes=[db.prepare(`UPDATE agm_job_state SET done_at=?,done_by=?,version=version+1 WHERE meeting_id=? AND job=?
          AND version=? AND owner_id=? AND done_at IS NULL AND ${guard}`)
          .bind(stamp,identity.name||identity.id,meetingId,id,baseVersion,internal.ownerId,...checkPlan)];
      }
    }
  }
  const results=await db.batch([...writes,
    db.prepare(`INSERT INTO officer_todo_log SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1`)
      .bind(mutation,action,kind,id,meetingId,office,title,baseVersion,+paper,identity.id,identity.name||identity.id,stamp),
    db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM officer_todo_log WHERE mutation=?)')
      .bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,'officer_task_'+action+(paper?'_paper':''),kind+'/'+(meetingId?meetingId+'/':'')+id,stamp,mutation)
  ]);
  if(!results[0].meta.changes)conflict();
  return json((await deskData(db,identity,today,rights,filter)).view);
}
