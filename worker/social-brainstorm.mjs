const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const platforms=['facebook','instagram','youtube','tiktok'];
const fields={
  start:['action','id','topic'],
  idea:['action','sessionId','id','title','body','channels'],
  finish:['action','sessionId','version']
};

async function readDesk(db) {
  const sessions=`SELECT * FROM committee_social_brainstorms WHERE finished_at IS NULL OR id IN (
    SELECT id FROM committee_social_brainstorms WHERE finished_at IS NOT NULL ORDER BY finished_at DESC,id LIMIT 8)`;
  const [meetings,plans]=await db.batch([
    db.prepare(`WITH chosen AS (${sessions}) SELECT id,topic,version,started_at AS startedAt,starter_name AS startedBy,
      finished_at AS finishedAt,finisher_name AS finishedBy FROM chosen ORDER BY finished_at DESC,id`),
    db.prepare(`WITH chosen AS (${sessions}) SELECT i.session_id AS sessionId,p.id,p.title,p.body,p.channels,p.plannedDate,
      p.status,p.version,p.createdAt,p.createdBy FROM chosen JOIN committee_brainstorm_ideas i ON i.session_id=chosen.id
      JOIN committee_social_current p ON p.id=i.plan_id ORDER BY i.rowid`)
  ]);
  const bySession=new Map(meetings.results.map(session=>[session.id,{...session,ideas:[]}]));
  for(const {sessionId,channels,...post} of plans.results)bySession.get(sessionId).ideas.push({...post,channels:JSON.parse(channels)});
  const records=[...bySession.values()];
  return {active:records.find(s=>s.finishedAt===null)||null,recent:records.filter(s=>s.finishedAt!==null)};
}

export async function socialBrainstormEndpoint(request,env,identity,helpers) {
  const {requireRole,requireDb,bodyJson,textField,json,HttpError}=helpers;
  requireRole(identity,['committee']);
  const fail=(status,message)=>{throw new HttpError(status,message,status===409?'brainstorm_conflict':'invalid_brainstorm');};
  if(!['GET','POST'].includes(request.method))fail(405,'Open or save an idea in the brainstorming room.');
  const store=requireDb(env),db=store.withSession?store.withSession('first-primary'):store;
  if(request.method==='GET')return json(await readDesk(db));
  const data=await bodyJson(request,48000);
  if(!Object.hasOwn(fields,data.action)||Object.keys(data).some(key=>!fields[data.action].includes(key)))fail(400,'Choose a brainstorming action on the form.');
  const idOf=value=>{
    if(typeof value!=='string'||!uuid.test(value))fail(400,'Open the brainstorming form again.');
    return value.toLowerCase();
  };
  const name=identity.administrator?'Webmaster':identity.name||identity.id;
  const now=new Date().toISOString();
  const audit=(action,id)=>db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1')
    .bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,action,id,now);
  let created=false;
  if(data.action==='start'){
    const sessionId=idOf(data.id),topic=textField(data.topic,'the aim of this session',180,true);
    if(/[\r\n]/.test(topic))fail(400,'Keep the session aim on one line.');
    const saved=await db.batch([
      db.prepare(`INSERT INTO committee_social_brainstorms(id,topic,started_at,started_by,starter_name) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING`)
        .bind(sessionId,topic,now,identity.id,name),
      audit('social_brainstorm_started',sessionId),
      db.prepare('SELECT 1 FROM committee_social_brainstorms WHERE id=? AND started_by=? AND topic=?').bind(sessionId,identity.id,topic)
    ]);
    if(!saved.at(-1).results.length)fail(409,'An officer has already started a session. Refresh to join it.');
    created=Boolean(saved[0].meta.changes);
  }else if(data.action==='idea'){
    const sessionId=idOf(data.sessionId),planId=idOf(data.id);
    const title=textField(data.title,'a short name for the idea',140,true),body=textField(data.body,'the idea details',6000);
    if(/[\r\n]/.test(title))fail(400,'Keep the idea title on one line.');
    const selected=data.channels??[];
    if(!Array.isArray(selected)||selected.length>platforms.length||selected.some(p=>!platforms.includes(p)))fail(400,'Choose a club social platform.');
    const channels=JSON.stringify(platforms.filter(p=>selected.includes(p)));
    // Use the planner's first revision for retries, so an old submit cannot
    // replace subsequent work on the same post.
    const saved=await db.batch([
      db.prepare(`INSERT INTO committee_social_plans(id,current_version,created_at,created_by,creator_name)
        SELECT ?,1,?,?,? WHERE EXISTS(SELECT 1 FROM committee_social_brainstorms WHERE id=? AND finished_at IS NULL)
        ON CONFLICT(id) DO NOTHING`).bind(planId,now,identity.id,name,sessionId),
      db.prepare(`INSERT INTO committee_social_revisions(plan_id,version,title,body,planned_date,channels_json,status,links_json,updated_at,updated_by,editor_name)
        SELECT ?,1,?,?,'',?,'idea','{}',?,?,? WHERE changes()=1`).bind(planId,title,body,channels,now,identity.id,name),
      db.prepare('INSERT INTO committee_brainstorm_ideas(plan_id,session_id) SELECT ?,? WHERE changes()=1').bind(planId,sessionId),
      db.prepare('UPDATE committee_social_brainstorms SET version=version+1 WHERE id=? AND changes()=1').bind(sessionId),
      audit('social_plan_created',planId),
      audit('social_brainstorm_idea_added',sessionId),
      db.prepare(`SELECT 1 FROM committee_brainstorm_ideas i JOIN committee_social_revisions r ON i.plan_id=r.plan_id AND r.version=1
        WHERE i.session_id=? AND i.plan_id=? AND r.updated_by=? AND r.title=? AND r.body=? AND r.channels_json=?`)
        .bind(sessionId,planId,identity.id,title,body,channels)
    ]);
    if(!saved.at(-1).results.length)fail(409,'This idea could not be added to the session. Refresh the room and check your idea.');
    created=Boolean(saved[0].meta.changes);
  }else{
    const sessionId=idOf(data.sessionId);
    if(!Number.isSafeInteger(data.version)||data.version<1||data.version>=2147483647)fail(400,'Refresh the session before finishing it.');
    const [,,matched]=await db.batch([
      db.prepare(`UPDATE committee_social_brainstorms SET finished_at=?,finished_by=?,finisher_name=?,version=version+1
        WHERE id=? AND version=? AND finished_at IS NULL`).bind(now,identity.id,name,sessionId,data.version),
      audit('social_brainstorm_finished',sessionId),
      db.prepare('SELECT 1 FROM committee_social_brainstorms WHERE id=? AND finished_by=? AND version=?').bind(sessionId,identity.id,data.version+1)
    ]);
    if(!matched.results.length)fail(409,'The session has changed. Refresh and check its latest ideas before finishing.');
  }
  return json(await readDesk(db),created?201:200);
}
