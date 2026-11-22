import {eventTypes} from '../public/event-templates.js';
import {canManageStock} from './stock.mjs';

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const names={president:'President',vicepresident:'Vice President',secretary:'Secretary',assistantsecretary:'Assistant Secretary',treasurer:'Treasurer'};
const details=['title','date','location','goal','notes'];
const allowed={create:['type',...details],edit:['version',...details],money:['version','takingsCents','expensesCents'],
  close:['version','closeNote'],reopenEvent:['version'],addJob:['version','title','detail'],claim:['key','version'],helper:['key','version','helperName','agreed'],
  release:['key','version'],done:['key','version'],reopen:['key','version']};
const jobActions=['claim','helper','release','done','reopen'];
const freshMutation='NOT EXISTS(SELECT 1 FROM club_event_activity WHERE mutation_id=?)';
const openEvent="EXISTS(SELECT 1 FROM club_events WHERE id=club_event_jobs.event_id AND status='open')";
const touchEvent=(db,eventId)=>db.prepare('UPDATE club_events SET version=version+1 WHERE id=? AND changes()=1').bind(eventId);

export const eventOpenOfficerJobs=`SELECT j.event_id AS eventId,e.title AS eventTitle,e.date AS dueDate,
  j.key AS id,j.title,j.detail AS details,j.owner_id AS ownerId,j.owner_name AS ownerName,j.version
  FROM club_event_jobs j JOIN club_events e ON e.id=j.event_id
  WHERE e.status='open' AND j.done_at IS NULL AND j.owner_kind='officer'`;

// The paper to-do desk records the actual officer returning the sheet using
// its own audit entry. These statements must run together inside that batch.
export function eventJobCompletionWrites(db,{eventId,key,version,ownerId,actorId,actorName,stamp}){
  return [db.prepare(`UPDATE club_event_jobs SET done_at=?,done_by=?,done_by_name=?,version=version+1
    WHERE event_id=? AND key=? AND version=? AND owner_kind='officer' AND owner_id=? AND done_at IS NULL AND ${openEvent}`)
    .bind(stamp,actorId,actorName,eventId,key,version,ownerId),touchEvent(db,eventId)];
}

const isSecretary=identity=>identity.accountRole==='committee'&&['secretary','assistantsecretary'].includes(identity.name);
function actorName(identity){
  if(identity.administrator)return 'Webmaster';
  return ['committee','treasurer'].includes(identity.accountRole)&&Object.hasOwn(names,identity.name)?names[identity.name]:identity.name||identity.id;
}

async function readDesk(db,identity,env){
  const [headers,jobs]=await db.batch([
    db.prepare(`SELECT id,type,title,date,location,goal,notes,status,version,created_at AS createdAt,creator_name AS createdBy,
      closed_at AS closedAt,closer_name AS closedBy,close_note AS closeNote,takings_cents AS takingsCents,expenses_cents AS expensesCents,
      takings_cents-expenses_cents AS netCents,money_recorded_at AS moneyRecordedAt,money_recorder_name AS moneyRecordedBy
      FROM club_events ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END,
      CASE WHEN status='open' AND date='' THEN 1 ELSE 0 END, CASE WHEN status='open' THEN date END,closed_at DESC,created_at DESC,id`),
    db.prepare(`SELECT event_id AS eventId,key,title,detail,owner_kind AS ownerKind,owner_id AS ownerId,owner_name AS ownerName,
      helper_recorded_by AS helperRecorder,version,done_at AS doneAt,done_by_name AS doneBy FROM club_event_jobs ORDER BY event_id,position`)
  ]);
  const events=new Map(headers.results.map(row=>[row.id,{...row,jobs:[]}]));
  const led=new Set(jobs.results.filter(job=>job.key==='lead'&&job.ownerId===identity.id).map(job=>job.eventId));
  for(const {eventId,ownerId,helperRecorder,...job} of jobs.results){
    const event=events.get(eventId);
    const canManage=event.status==='open'&&(ownerId===identity.id ||
      (job.ownerKind==='helper'&&(helperRecorder===identity.id||led.has(eventId)||isSecretary(identity))));
    event.jobs.push({...job,canManage});
  }
  const today=new Date(Date.now()+36000000).toISOString().slice(0,10);
  return {today,canRecordMoney:canManageStock(identity,env),events:[...events.values()]};
}

export async function fundraisingEventsEndpoint(request,env,identity,helpers){
  const {requireRole,requireDb,textField,dateField,bodyJson,HttpError,json}=helpers;
  requireRole(identity,['committee']);
  const fail=(status,message)=>{throw new HttpError(status,message,status===409?'event_conflict':'event_runsheet');};
  const conflict=()=>fail(409,'The run sheet changed. Refresh it and check the latest details.');
  if(!['GET','POST'].includes(request.method))fail(405,'Open the event run sheet to update it.');
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  if(request.method==='GET')return json(await readDesk(db,identity,env));
  const b=await bodyJson(request,40000),{action,version,key}=b;
  if(typeof action!=='string'||!Object.hasOwn(allowed,action)||Object.keys(b).some(k=>!['action','id','mutationId',...allowed[action]].includes(k)))fail(400,'Choose an action on the event run sheet.');
  for(const value of [b.id,b.mutationId])if(typeof value!=='string'||!uuid.test(value))fail(400,'Open the event form again.');
  const id=b.id.toLowerCase(),mutation=b.mutationId.toLowerCase(),name=actorName(identity),stamp=new Date().toISOString();
  if(action!=='create'&&(!Number.isSafeInteger(version)||version<1))fail(400,'Refresh this run sheet before saving.');
  if(action==='money'&&!canManageStock(identity,env))fail(403,'The Treasurer or Webmaster records the takings and expenses.');
  const payload=JSON.stringify(b,Object.keys(b).sort());
  const receipt=()=>db.prepare('SELECT actor_id,request_json FROM club_event_activity WHERE mutation_id=?').bind(mutation).first();
  const matched=row=>row && row.actor_id===identity.id && row.request_json===payload;
  const prior=await receipt();
  if(prior){
    if(!matched(prior))conflict();
    return json(await readDesk(db,identity,env));
  }
  let writes;
  if(action==='create'||action==='edit'){
    const title=textField(b.title,'the event name',140,true),date=dateField(b.date,false);
    const location=textField(b.location,'the place',240),goal=textField(b.goal,'the event purpose or beneficiary',500),notes=textField(b.notes,'event notes',4000);
    if(/[\r\n]/.test(title))fail(400,'Keep the event name on one line.');
    if(action==='create'){
      if(typeof b.type!=='string'||!Object.hasOwn(eventTypes,b.type))fail(400,'Choose a type of club event.');
      const jobs=eventTypes[b.type].tasks;
      writes=[db.prepare(`INSERT INTO club_events(id,type,title,date,location,goal,notes,created_at,created_by,creator_name)
        SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${freshMutation} ON CONFLICT(id) DO NOTHING`)
        .bind(id,b.type,title,date,location,goal,notes,stamp,identity.id,name,mutation),
        db.prepare(`INSERT INTO club_event_jobs(event_id,key,position,title,detail)
          SELECT ?,json_extract(value,'$.key'),CAST(j.key AS INTEGER),json_extract(value,'$.title'),json_extract(value,'$.detail')
          FROM json_each(?) j WHERE changes()=1`).bind(id,JSON.stringify(jobs))];
    }else{
      writes=[db.prepare(`UPDATE club_events SET title=?,date=?,location=?,goal=?,notes=?,version=version+1
        WHERE id=? AND status='open' AND version=? AND ${freshMutation}`).bind(title,date,location,goal,notes,id,version,mutation)];
    }
  }else if(action==='addJob'){
    const title=textField(b.title,'the job or shift name',140,true),detail=textField(b.detail,'job or shift details',1000);
    if(/[\r\n]/.test(title))fail(400,'Keep the job or shift name on one line.');
    writes=[db.prepare(`UPDATE club_events SET version=version+1 WHERE id=? AND status='open' AND version=? AND ${freshMutation}`)
      .bind(id,version,mutation),
      db.prepare(`INSERT INTO club_event_jobs(event_id,key,position,title,detail)
        SELECT ?,?,(SELECT COALESCE(MAX(position),-1)+1 FROM club_event_jobs WHERE event_id=?),?,? WHERE changes()=1`)
        .bind(id,'job-'+mutation,id,title,detail)];
  }else if(action==='money'){
    for(const cents of [b.takingsCents,b.expensesCents])if(!Number.isSafeInteger(cents)||cents<0)fail(400,'Enter valid amounts for both takings and expenses.');
    writes=[db.prepare(`UPDATE club_events SET takings_cents=?,expenses_cents=?,money_recorded_at=?,money_recorded_by=?,money_recorder_name=?,version=version+1
      WHERE id=? AND version=? AND ${freshMutation}`).bind(b.takingsCents,b.expensesCents,stamp,identity.id,name,id,version,mutation)];
  }else if(action==='close'){
    const note=textField(b.closeNote,'the closing note',1000);
    writes=[db.prepare(`UPDATE club_events SET status='closed',closed_at=?,closed_by=?,closer_name=?,close_note=?,version=version+1
      WHERE id=? AND status='open' AND version=? AND ${freshMutation}`).bind(stamp,identity.id,name,note,id,version,mutation)];
  }else if(action==='reopenEvent'){
    writes=[db.prepare(`UPDATE club_events SET status='open',closed_at=NULL,closed_by=NULL,closer_name=NULL,close_note='',version=version+1
      WHERE id=? AND status='closed' AND version=? AND ${freshMutation}`).bind(id,version,mutation)];
  }else if(jobActions.includes(action)){
    if(typeof key!=='string'||!/^[a-z0-9_-]{1,80}$/.test(key))fail(400,'Choose a job from the run sheet.');
    let change,guard,values=[];
    if(action==='claim'||action==='helper'){
      guard='owner_kind IS NULL AND done_at IS NULL';
      if(action==='claim'){
        change="owner_kind='officer',owner_id=?,owner_name=?";
        values=[identity.id,name];
      }else{
        const helper=textField(b.helperName,'the helper’s name',100,true);
        if(b.agreed!==true||/[\r\n]/.test(helper))fail(400,'Confirm the named helper agreed to take this job.');
        change="owner_kind='helper',owner_name=?,helper_recorded_by=?";
        values=[helper,identity.id];
      }
    }else{
      const manage=`(owner_id=? OR (owner_kind='helper' AND (helper_recorded_by=? OR ?=1 OR
        EXISTS(SELECT 1 FROM club_event_jobs AS lead WHERE lead.event_id=club_event_jobs.event_id AND lead.key='lead' AND lead.owner_id=?))))`;
      const authority=[identity.id,identity.id,Number(isSecretary(identity)),identity.id];
      const row=await db.prepare(`SELECT version,${manage} AS may_manage FROM club_event_jobs WHERE event_id=? AND key=?`).bind(...authority,id,key).first();
      if(row && row.version===version && !row.may_manage)fail(403,'The volunteer who claimed this job manages it. A helper’s contact, an event lead or a secretary can update an offline helper’s job.');
      guard=manage+(action==='reopen'?' AND done_at IS NOT NULL':' AND done_at IS NULL');
      if(action==='release')change='owner_kind=NULL,owner_name=NULL,owner_id=NULL,helper_recorded_by=NULL';
      if(action==='done'){change='done_at=?,done_by=?,done_by_name=?';values=[stamp,identity.id,name];}
      if(action==='reopen')change='done_at=NULL,done_by=NULL,done_by_name=NULL';
      values.push(...authority);
    }
    writes=[db.prepare(`UPDATE club_event_jobs SET ${change},version=version+1 WHERE ${guard} AND event_id=? AND key=? AND version=? AND ${openEvent} AND ${freshMutation}`)
      .bind(...values,id,key,version,mutation),touchEvent(db,id)];
  }
  const saved=await db.batch([...writes,
    db.prepare(`INSERT INTO club_event_activity(mutation_id,event_id,action,request_json,actor_id,actor_name,recorded_at)
      SELECT ?,?,?,?,?,?,? WHERE changes()>0`).bind(mutation,id,action,payload,identity.id,name,stamp),
    db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1')
      .bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,'club_event_'+action,id+(key?'/'+key:''),stamp)
  ]);
  if(!saved[0].meta.changes && !matched(await receipt()))conflict();
  return json(await readDesk(db,identity,env),action==='create'&&saved[0].meta.changes?201:200);
}
