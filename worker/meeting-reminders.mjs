import {agendaTitles} from './formal-agenda.mjs';

// New Sandy databases contain no inherited meetings or example reminder slots.
const exampleTiming = '0';

function topicsFor(meeting, saved) {
  return saved?.topics ?? (meeting.status==='approved' ? '' : agendaTitles(meeting.kind,meeting.id).join('\n'));
}

function advance(db,seconds,meetingId) {
  const scoped=meetingId ? ' AND meeting_id=?' : '';
  const args=meetingId ? [meetingId] : [];
  return db.batch([
    db.prepare(`UPDATE meeting_reminders SET state='elapsed',elapsed_at=? WHERE channel IN ('email','chat') AND state IN ('scheduled','ready')
      AND (expires_at<=? OR (due_at<=? AND ${exampleTiming}))`+scoped).bind(seconds,seconds,seconds,...args),
    db.prepare(`UPDATE meeting_reminders SET state='ready',ready_at=? WHERE channel IN ('email','chat') AND state='scheduled'
      AND due_at<=? AND expires_at>? AND NOT ${exampleTiming}`+scoped).bind(seconds,seconds,seconds,...args),
  ]);
}

export async function runMeetingReminders(env,at=Date.now()) {
  if (!env.DB) throw new Error('The meeting database is unavailable.');
  const seconds=Math.floor(new Date(at).getTime()/1000);
  if (!Number.isFinite(seconds)) throw new Error('The meeting schedule needs a valid time.');
  const [elapsed,ready]=await advance(env.DB,seconds);
  return {ready:ready.meta.changes,elapsed:elapsed.meta.changes};
}

function draft(channel,meeting,saved,now) {
  const start=new Date(meeting.date+'T'+meeting.time+':00+10:00');
  const when=start.toLocaleString('en-AU',{timeZone:'Australia/Brisbane',weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit'})+' AEST';
  const informal=(saved?.formalKind || meeting.kind)==='informal';
  if (channel==='email') {
    const topics=topicsFor(meeting,saved),numbered=!saved || Boolean(saved.formalKind);
    const headings=topics ? topics.split('\n').map((s,i)=>(numbered?(i+1)+'. ':'• ')+s).join('\n') : 'No agenda was recorded.';
    return meeting.title+'\n\n'+when+'\n'+meeting.location+'\n\n'+(informal?'Catch-up topics':'Meeting agenda')+'\n'+headings;
  }
  const minutesLeft=Math.ceil((start.getTime()-now)/60000);
  const lead=minutesLeft>=1 && minutesLeft<=60 ? ' starts in '+minutesLeft+' minute'+(minutesLeft===1?'':'s')+'.' : ' is scheduled for '+when+'.';
  return meeting.title+lead+' Meet at '+meeting.location+'.';
}

export async function meetingRemindersEndpoint(request,env,identity,helpers) {
  const {json,HttpError,bodyJson,requireRole,requireDb,textField}=helpers;
  requireRole(identity,['committee']);
  const db=requireDb(env), url=new URL(request.url), method=request.method;
  if (!['GET','POST','PUT'].includes(method)) throw new HttpError(405,'Choose a reminder or edit this agenda.','invalid_method');
  const data=method==='GET' ? {} : await bodyJson(request);
  const id=method==='GET' ? url.searchParams.get('id') : data.id;
  if (typeof id!=='string' || !/^[\w-]{1,80}$/.test(id)) throw new HttpError(400,'Choose a meeting first.','invalid_meeting');
  const meeting=await db.prepare(`SELECT r.id,r.title,r.date,r.time,r.location,n.status,
    coalesce(json_extract(a.formal_json,'$.kind'),r.agenda_kind) AS kind FROM meeting_register r
    LEFT JOIN meeting_agendas a ON a.meeting_id=r.id LEFT JOIN meeting_notes n ON n.id=r.id WHERE r.id=?`).bind(id).first();
  if (!meeting) throw new HttpError(404,'This meeting is unavailable.','not_found');
  const now=Date.now(),sec=Math.floor(now/1000),stamp=new Date(now).toISOString();
  if (method==='PUT') {
    const topics=textField(data.agenda,'the agenda topics',3500,true).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join('\n');
    if (!topics || !Number.isSafeInteger(data.version) || data.version<0) throw new HttpError(400,'Open the current agenda and enter a topic on each line.','invalid_agenda');
    const [,,found]=await db.batch([
      db.prepare(`INSERT INTO meeting_agendas(meeting_id,topics,revision,updated_at,updated_by)
        SELECT ?,?,?,?,? WHERE COALESCE((SELECT revision FROM meeting_agendas WHERE meeting_id=?),0)=?
        AND NOT EXISTS(SELECT 1 FROM meeting_notes WHERE id=? AND status='approved')
        AND NOT EXISTS(SELECT 1 FROM meeting_agendas WHERE meeting_id=? AND formal_json IS NOT NULL)
        ON CONFLICT(meeting_id) DO UPDATE SET topics=excluded.topics,revision=excluded.revision,
          updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE meeting_agendas.topics<>excluded.topics`)
        .bind(id,topics,data.version+1,stamp,identity.id,id,data.version,id,id),
      db.prepare("INSERT INTO audit_log SELECT ?,?,'committee','meeting_agenda_saved',?,? WHERE changes()=1").bind(crypto.randomUUID(),identity.id,id,stamp),
      db.prepare('SELECT topics,revision FROM meeting_agendas WHERE meeting_id=?').bind(id),
    ]);
    if (found.results[0]?.topics!==topics) throw new HttpError(409,'The agenda changed or these minutes have been approved. Reopen the agenda to read the saved version.','agenda_conflict');
  }
  if(method!=='GET' || (!identity.readOnly && !env.SHOWCASE_READ_ONLY)) await advance(db,sec,id);
  if (method==='POST') {
    if (!['email','chat'].includes(data.channel)) throw new HttpError(400,'Choose an email or club chat reminder.','invalid_channel');
    if (!Number.isInteger(data.preparedAt) || data.preparedAt>sec || !Number.isInteger(data.version) || data.version<0)
      throw new HttpError(400,'Open the current reminder before reviewing it.','invalid_review');
    const current=await db.prepare("SELECT topics,revision,json_extract(formal_json,'$.kind') AS formalKind FROM meeting_agendas WHERE meeting_id=?").bind(id).first();
    const reviewedText=draft(data.channel,meeting,current,data.preparedAt*1000);
    const [,,found]=await db.batch([
      db.prepare(`UPDATE meeting_reminders SET state='reviewed',reviewed_at=?,reviewed_by=?,reviewed_text=?
        WHERE meeting_id=? AND channel=? AND state='ready' AND due_at<=? AND expires_at>?
        AND NOT ${exampleTiming}
        AND COALESCE((SELECT revision FROM meeting_agendas WHERE meeting_id=?),0)=? AND ?=?`)
        .bind(sec,identity.name || identity.id,reviewedText,id,data.channel,data.preparedAt,sec,id,data.version,current?.revision || 0,data.version),
      db.prepare("INSERT INTO audit_log SELECT ?,?,'committee',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),identity.id,'meeting_reminder_reviewed_'+data.channel,id,stamp),
      db.prepare(`SELECT state,${exampleTiming} AS isExample FROM meeting_reminders WHERE meeting_id=? AND channel=?`).bind(id,data.channel),
    ]);
    if (found.results[0]?.isExample) throw new HttpError(409,'This example timing has no reminder to review.','reminder_example');
    if (found.results[0]?.state!=='reviewed') throw new HttpError(409,'Refresh the reminders to check the current agenda and review window.','reminder_window');
  }
  const [agenda,rows]=await db.batch([
    db.prepare("SELECT topics,revision,json_extract(formal_json,'$.kind') AS formalKind FROM meeting_agendas WHERE meeting_id=?").bind(id),
    db.prepare(`SELECT channel,state,due_at AS dueAt,expires_at AS expiresAt,reviewed_at AS reviewedAt,
      reviewed_by AS reviewedBy,reviewed_text AS snapshot,${exampleTiming} AS isExample
      FROM meeting_reminders WHERE meeting_id=? AND (channel IN ('email','chat') OR state='reviewed') ORDER BY due_at`).bind(id),
  ]);
  const saved=agenda.results[0],topics=topicsFor(meeting,saved);
  const started=sec>=Date.parse(meeting.date+'T'+meeting.time+':00+10:00')/1000;
  return json({agenda:topics,version:saved?.revision || 0,preparedAt:sec,started,
    examples:rows.results.filter(row=>row.isExample).map(row=>({channel:row.channel})),
    reminders:rows.results.filter(row=>!row.isExample || row.state==='reviewed').map(({snapshot,isExample,...row})=>({
      ...row,exampleReview:Boolean(isExample),text:snapshot ?? (row.state==='elapsed' || row.state==='reviewed' ? '' : draft(row.channel,meeting,saved,sec*1000))
    }))});
}
