import {escapeIcs,foldIcsLine} from './data.mjs';
import {formalAgenda,validAgendaKind} from './formal-agenda.mjs';
import {currentMeetingActions} from './meeting-actions.mjs';

export async function meetingRegister(request,env,identity,helpers) {
  const {json,response,bodyJson,HttpError,requireRole,requireDb,textField,dateField}=helpers;
  const path=new URL(request.url).pathname;
  if(path==='/api/member/minutes') {
    requireRole(identity,['member','committee']);
    if(request.method!=='GET')throw new HttpError(405,'Choose the minutes in member home.','method_not_allowed');
    const rows=await requireDb(env).prepare(`SELECT r.id,r.title,r.date,m.body AS text,m.released_at AS releasedAt,
      coalesce(json_extract(a.formal_json,'$.kind'),r.agenda_kind) AS kind,
      coalesce(json_extract(a.formal_json,'$.quorumStatus'),'unchecked') AS quorumStatus FROM member_minutes m
      JOIN meeting_register r ON r.id=m.meeting_id LEFT JOIN meeting_agendas a ON a.meeting_id=r.id ORDER BY r.date DESC,r.time DESC LIMIT 150`).all();
    return json({minutes:rows.results});
  }
  requireRole(identity,['committee']);
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  const agenda=path.match(/^\/api\/meetings\/([\w-]{1,80})\/agenda$/);
  if (agenda) return formalAgenda(request,db,agenda[1],identity,helpers);
  if(path==='/api/meetings' && request.method==='POST') {
    const data=await bodyJson(request),id=String(data.id||'');
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))throw new HttpError(400,'Please reopen the meeting form.','invalid_id');
    const title=textField(data.title,'meeting title',140,true);
    const date=dateField(data.date), time=String(data.time||''), location=textField(data.location,'meeting location',180,true);
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new HttpError(400,'Choose a valid Brisbane time.','invalid_time');
    const kind=data.kind??'committee';
    if (!validAgendaKind(kind)) throw new HttpError(400,'Choose the meeting type.','invalid_agenda_kind');
    const createdAt=new Date().toISOString();
    const result=await db.batch([db.prepare('INSERT INTO meeting_register(id,title,date,time,location,created_by,created_at,agenda_kind) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,title,date,time,location,identity.id,createdAt,kind),
      db.prepare("INSERT INTO audit_log SELECT ?,?,'committee','meeting_scheduled',?,? WHERE changes()=1").bind(crypto.randomUUID(),identity.id,id,createdAt),
      db.prepare('SELECT title,date,time,location,agenda_kind FROM meeting_register WHERE id=?').bind(id)]);
    const found=result[2].results[0];
    if(found.title!==title||found.date!==date||found.time!==time||found.location!==location||found.agenda_kind!==kind)throw new HttpError(409,'A different meeting already uses this reference.','conflict');
    return json({meeting:{id,title,date,time,location,kind,status:'draft',openActions:0}},result[0].meta.changes?201:200);
  }
  const release=path.match(/^\/api\/meetings\/([\w-]{1,80})\/release$/);
  if(release && request.method==='POST') {
    const data=await bodyJson(request,80000);
    const text=textField(data.text,'the member minutes',16000,true);
    if(!Number.isInteger(data.version))throw new HttpError(400,'Reload the approved meeting.','invalid_version');
    const id=release[1],when=new Date().toISOString(),marker=crypto.randomUUID();
    const result=await db.batch([db.prepare("INSERT INTO member_minutes SELECT id,version,?,?,?,? FROM meeting_notes WHERE id=? AND version=? AND status='approved' ON CONFLICT(meeting_id) DO NOTHING").bind(text,when,identity.id,marker,id,data.version),
      db.prepare("INSERT INTO audit_log SELECT ?,?,'committee','minutes_shared_with_members',?,? WHERE EXISTS(SELECT 1 FROM member_minutes WHERE mutation=?)").bind(crypto.randomUUID(),identity.id,id,when,marker),
      db.prepare('SELECT body,released_at FROM member_minutes WHERE meeting_id=?').bind(id)]);
    const record=result[2].results[0];
    if(!record||record.body!==text)throw new HttpError(409,'Refresh this meeting and check its approval or previously shared copy.','release_conflict');
    return json({releasedAt:record.released_at});
  }
  if(!['/api/meetings','/api/meetings/calendar.ics'].includes(path))throw new HttpError(404,'Meeting action unavailable.','not_found');
  if(request.method!=='GET' && !(path.endsWith('.ics')&&request.method==='HEAD'))throw new HttpError(405,'Action unavailable.','method_not_allowed');
  const register=db.prepare(`SELECT r.id,r.title,r.date,r.time,r.location,COALESCE(n.status,'draft') AS status,m.released_at AS releasedAt,
    COALESCE(json_extract(g.formal_json,'$.kind'),r.agenda_kind) AS kind,
    COALESCE(json_extract(g.formal_json,'$.quorumStatus'),'unchecked') AS quorumStatus,
    (SELECT COUNT(*) FROM json_each(COALESCE(n.actions_json,'[]')) a WHERE json_extract(a.value,'$.done')=0) AS openActions
    FROM meeting_register r LEFT JOIN meeting_notes n ON n.id=r.id LEFT JOIN member_minutes m ON m.meeting_id=r.id
    LEFT JOIN meeting_agendas g ON g.meeting_id=r.id ORDER BY r.date DESC,r.time DESC`);
  if(path==='/api/meetings') {
    const [rows,jobs]=await db.batch([register,db.prepare(`SELECT id,meetingId,meetingTitle,text,owner,dueDate FROM (${currentMeetingActions}) WHERE done=0
      ORDER BY CASE WHEN dueDate IS NULL OR dueDate='' THEN 1 ELSE 0 END,dueDate,meetingTitle,id`)]);
    return json({meetings:rows.results,openJobs:jobs.results});
  }
  const rows=await register.all();
  const stamp=s=>new Date(s).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//Committee calendar//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Sandy Sports Club committee meetings'];
  const when=stamp(Date.now());
  for(const m of rows.results)lines.push('BEGIN:VEVENT','UID:'+escapeIcs(m.id)+'@sandy-sports-clubhouse','DTSTAMP:'+when,'DTSTART:'+stamp(m.date+'T'+m.time+':00+10:00'),'SUMMARY:'+escapeIcs(m.title),'LOCATION:'+escapeIcs(m.location),'CLASS:PRIVATE','END:VEVENT');
  lines.push('END:VCALENDAR','');
  return response(request.method==='HEAD'?null:lines.map(foldIcsLine).join('\r\n'),200,{'Cache-Control':'private, no-store','Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="sandy-committee-calendar.ics"'});
}
