const AGREEMENT = '2026-11-20-v1';
const KINDS = new Set(['volunteer','employment','event']);
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

function visibleRecord(row, viewer) {
  return {
    id:row.id, kind:row.kind, scope:row.scope, owner:row.owner_name, mine:row.owner_id === viewer.id,
    eventId:row.event_id, eventTitle:row.event_title, eventDate:row.event_date, meetingId:row.meeting_id,
    motion:row.motion, status:row.status, consentAt:row.consent_at, reviewedAt:row.reviewed_at,
    reviewedBy:row.reviewed_by, revokedAt:row.revoked_at, revokedBy:row.revoked_by, version:row.version,
  };
}

function audit(db,actor,mutation,action) {
  return db.prepare(`INSERT INTO audit_log (id,actor_id,actor_role,action,entity_id,occurred_at)
    SELECT lower(hex(randomblob(16))),?,?,?,id,COALESCE(revoked_at,reviewed_at,consent_at)
    FROM partner_handoffs WHERE mutation=?`).bind(actor.id,actor.role,action,mutation);
}

async function listing(db, identity) {
  const committee = identity.role === 'committee';
  const [own,events] = await db.batch([
    db.prepare('SELECT * FROM partner_handoffs WHERE owner_id=? ORDER BY consent_at DESC').bind(identity.id),
    db.prepare("SELECT id,event_title AS title,event_date AS date FROM partner_handoffs WHERE kind='event' AND status='authorised' ORDER BY event_date DESC"),
  ]);
  const data = {mine:own.results.map(row=>visibleRecord(row,identity)),events:events.results,consentVersion:AGREEMENT};
  if (committee) {
    const [queue,motions] = await db.batch([
      db.prepare("SELECT * FROM partner_handoffs ORDER BY CASE status WHEN 'requested' THEN 0 ELSE 1 END, consent_at DESC"),
      db.prepare("SELECT id,title,date,json_group_array(motion) AS decisions_json FROM formal_authority_decisions GROUP BY id,title,date ORDER BY date DESC"),
    ]);
    data.queue = queue.results.map(row=>visibleRecord(row,identity));
    data.motions = motions.results.map(row=>({meetingId:row.id,title:row.title,date:row.date,decisions:JSON.parse(row.decisions_json)}));
  }
  return data;
}

async function create(db, identity, body, helpers) {
  const {HttpError,textField,dateField} = helpers;
  const {id,kind} = body;
  if (!UUID.test(id) || !KINDS.has(kind) || body.consent !== true || body.consentVersion !== AGREEMENT)
    throw new HttpError(400,'Check the scope and confirm your choice before saving.','invalid_consent');
  const event = kind === 'event';
  const allowed = ['id','kind','scope','consent','consentVersion',...(event ? ['eventTitle','eventDate','meetingId','motion'] : ['eventId'])];
  if (Object.keys(body).some(key => !allowed.includes(key)))
    throw new HttpError(400,'Use only the details shown on this request form.','invalid_input');
  if (event && identity.role !== 'committee') throw new HttpError(403,'A committee member must request event coordination.','forbidden');
  const scope = textField(body.scope,'the specific help requested',350,true);
  const eventId = body.eventId || null;
  if (eventId && (event || !UUID.test(eventId))) throw new HttpError(400,'Choose an authorised club event.','invalid_event');
  if (!event && (body.eventTitle || body.eventDate || body.meetingId || body.motion))
    throw new HttpError(400,'Choose the personal enquiry form.','invalid_input');
  const eventTitle = event ? textField(body.eventTitle,'the approved event title',140,true) : '';
  const eventDate = event ? dateField(body.eventDate) : '';
  const meetingId = event ? textField(body.meetingId,'the authorising meeting',64,true) : null;
  const motion = event ? textField(body.motion,'the approved decision',500,true) : '';
  const mutation = crypto.randomUUID(), now = new Date().toISOString();
  const sameRequest = row => row && row.owner_id===identity.id && row.kind===kind && row.scope===scope && row.event_id===eventId &&
    (!event || (row.event_title===eventTitle && row.event_date===eventDate)) && row.meeting_id===meetingId && row.motion===motion;
  const [insert,,read] = await db.batch([
    db.prepare(`INSERT INTO partner_handoffs (id,kind,owner_id,owner_name,scope,event_id,event_title,event_date,meeting_id,motion,status,consent_version,consent_at,mutation)
      SELECT ?,?,?,?,?,?,COALESCE((SELECT event_title FROM partner_handoffs WHERE id=?),?),COALESCE((SELECT event_date FROM partner_handoffs WHERE id=?),?),?,?,'requested',?,?,?
      WHERE (? IS NULL OR EXISTS(SELECT 1 FROM partner_handoffs WHERE id=? AND kind='event' AND status='authorised'))
      AND (? IS NULL OR EXISTS(SELECT 1 FROM formal_authority_decisions WHERE id=? AND motion=?))
      ON CONFLICT(id) DO NOTHING`)
      .bind(id,kind,identity.id,identity.name || identity.email || 'Club account',scope,eventId,eventId,eventTitle,eventId,eventDate,meetingId,motion,AGREEMENT,now,mutation,eventId,eventId,meetingId,meetingId,motion),
    audit(db,identity,mutation,'handoff_requested'),
    db.prepare('SELECT * FROM partner_handoffs WHERE id=?').bind(id),
  ]);
  const row = read.results[0];
  if (!sameRequest(row)) throw new HttpError(409,'The authority or event changed. Reload the choices before sending this request.','handoff_conflict');
  return {record:visibleRecord(row,identity),created:Boolean(insert.meta.changes)};
}

async function change(db, identity, id, body, helpers) {
  const {HttpError} = helpers;
  if (Object.keys(body).some(key => !['action','version','confirm'].includes(key)))
    throw new HttpError(400,'Use only the decision controls shown on this request.','invalid_input');
  const states = {authorise:'authorised',decline:'declined',withdraw:'withdrawn'};
  const next = Object.hasOwn(states,body.action) && states[body.action];
  if (!next || !Number.isInteger(body.version) || body.version < 1 || body.confirm !== true)
    throw new HttpError(400,'Review the request before confirming a decision.','invalid_input');
  const row = await db.prepare('SELECT * FROM partner_handoffs WHERE id=?').bind(id).first();
  const committee = identity.role === 'committee';
  if (!row || (!committee && (row.owner_id!==identity.id || next!=='withdrawn'))) throw new HttpError(404,'The request is unavailable.','not_found');
  if (row.status===next && row.version===body.version+1) return visibleRecord(row,identity);
  if (row.version!==body.version || !(row.status==='requested' || (row.status==='authorised' && next==='withdrawn')))
    throw new HttpError(409,'This request has changed. Refresh its current status.','handoff_conflict');
  const now = new Date().toISOString(), actor = identity.name || identity.email || 'Club account', mutation = crypto.randomUUID();
  const stamp = next==='withdrawn' ? 'revoked_at=?,revoked_by=?' : 'reviewed_at=?,reviewed_by=?';
  const statements = [
    db.prepare(`UPDATE partner_handoffs SET status=?,mutation=?,version=version+1,${stamp}
      WHERE id=? AND version=? AND status=? AND (?<>'authorised' OR event_id IS NULL OR EXISTS
      (SELECT 1 FROM partner_handoffs parent WHERE parent.id=partner_handoffs.event_id AND parent.status='authorised'))`)
      .bind(next,mutation,now,actor,id,body.version,row.status,next),
    audit(db,identity,mutation,'handoff_'+next),
  ];
  if (row.kind==='event' && next==='withdrawn') {
    const cascade = crypto.randomUUID();
    statements.push(
      db.prepare(`UPDATE partner_handoffs SET status='withdrawn',mutation=?,version=version+1,revoked_at=?,revoked_by=?
        WHERE event_id=? AND status IN ('requested','authorised') AND EXISTS(SELECT 1 FROM partner_handoffs WHERE id=? AND mutation=?)`).bind(cascade,now,actor,id,id,mutation),
      audit(db,identity,cascade,'handoff_event_withdrawn'),
    );
  }
  statements.push(db.prepare('SELECT * FROM partner_handoffs WHERE id=?').bind(id));
  const result = await db.batch(statements);
  const updated = result.at(-1).results[0];
  if (updated.status!==next || updated.version!==body.version+1)
    throw new HttpError(409,'The request changed while you were reviewing it. Refresh to see the latest decision.','handoff_conflict');
  return visibleRecord(updated,identity);
}

export async function handoffEndpoint(request,env,identity,helpers) {
  const {json,requireRole,requireDb,bodyJson,HttpError} = helpers;
  requireRole(identity,['member','committee']);
  const db = requireDb(env), path = new URL(request.url).pathname;
  if (path==='/api/handoffs' && request.method==='GET') return json(await listing(db,identity));
  if (path==='/api/handoffs' && request.method==='POST') {
    const body = await bodyJson(request);
    const outcome = await create(db,identity,body,helpers);
    return json({record:outcome.record},outcome.created ? 201 : 200);
  }
  const match = /^\/api\/handoffs\/([a-f0-9-]+)$/i.exec(path);
  if (match && UUID.test(match[1]) && request.method==='POST')
    return json({record:await change(db,identity,match[1],await bodyJson(request),helpers)});
  throw new HttpError(404,'The handover service could not find that request.','not_found');
}

