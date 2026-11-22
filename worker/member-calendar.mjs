import {EVENTS, escapeIcs, foldIcsLine} from './data.mjs';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const columns = 'event_id AS id,title,event_date AS date,start_time AS time,place,details';
const empty = {title:'',date:'',time:'',place:'',details:'',published:false,version:0};
const brisbane = value => new Date(new Date(value).getTime() + 36000000).toISOString();
const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');

function privateIcs(row) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//Members calendar//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT','UID:'+row.id+'@sandy-sports-club.invalid','DTSTAMP:'+stamp(row.updatedAt),'SEQUENCE:'+row.version,
    row.time ? 'DTSTART:'+stamp(row.date+'T'+row.time+':00+10:00') : 'DTSTART;VALUE=DATE:'+row.date.replaceAll('-',''),
    'SUMMARY:'+escapeIcs(row.title),'LOCATION:'+escapeIcs(row.place),'DESCRIPTION:'+escapeIcs(row.details),'CLASS:PRIVATE','END:VEVENT','END:VCALENDAR'];
  return lines.map(foldIcsLine).join('\r\n')+'\r\n';
}

async function officerNotice(request, db, identity, id, h) {
  const plan = await db.prepare('SELECT status FROM club_events WHERE id=?').bind(id).first();
  if (!plan) throw new h.HttpError(404,'This event plan could not be found.','not_found');
  const read = async () => {
    const row = await db.prepare('SELECT '+columns+',published,version FROM member_event_notices WHERE event_id=?').bind(id).first();
    return {notice:row ? {...row,published:Boolean(row.published)} : {...empty,id},canPublish:plan.status==='open'};
  };
  if (request.method==='GET') return h.json(await read());
  if (request.method!=='POST') throw new h.HttpError(405,'Use the calendar notice form.','method_not_allowed');
  const data = await h.bodyJson(request,12000);
  const {action,version,mutationId} = data;
  const publish = action==='publish';
  const fields = ['action','version','mutationId',...(publish?['title','date','time','place','details']:[])];
  const invalid = message => {throw new h.HttpError(400,message,'invalid_notice');};
  if ((!publish && action!=='withdraw') || Object.keys(data).some(k=>!fields.includes(k)) || typeof mutationId!=='string' || !uuid.test(mutationId) || !Number.isSafeInteger(version) || version<0) invalid('Open the current member notice before saving.');
  const payload=JSON.stringify(data,Object.keys(data).sort()),now=new Date().toISOString();
  const receipt=()=>db.prepare('SELECT actor_id,event_id,request_json FROM club_event_activity WHERE mutation_id=?').bind(mutationId).first();
  const matches=row=>row && row.event_id===id && row.actor_id===identity.id && row.request_json===payload;
  const conflict=()=>{throw new h.HttpError(409,'The notice or event plan changed. Open the current notice and check the details.','notice_conflict');};
  const prior=await receipt();
  if(prior){if(!matches(prior))conflict();return h.json(await read());}
  let update;
  if(publish){
    const title=h.textField(data.title,'the member event title',140,true),date=h.dateField(data.date,true);
    const time=h.textField(data.time,'the start time',5),place=h.textField(data.place,'the meeting place',240),details=h.textField(data.details,'the member event details',2000);
    if(/[\r\n]/.test(title) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))invalid('Use a single-line title and a valid Brisbane start time.');
    const guard="EXISTS(SELECT 1 FROM club_events WHERE id=? AND status='open') AND NOT EXISTS(SELECT 1 FROM club_event_activity WHERE mutation_id=?)";
    update=version===0 ?
      db.prepare('INSERT INTO member_event_notices(event_id,title,event_date,start_time,place,details,published,version,updated_at) SELECT ?,?,?,?,?,?,1,1,? WHERE '+guard+' ON CONFLICT(event_id) DO NOTHING')
        .bind(id,title,date,time,place,details,now,id,mutationId):
      db.prepare('UPDATE member_event_notices SET title=?,event_date=?,start_time=?,place=?,details=?,published=1,version=version+1,updated_at=? WHERE event_id=? AND version=? AND '+guard)
        .bind(title,date,time,place,details,now,id,version,id,mutationId);
  } else {
    update=db.prepare('UPDATE member_event_notices SET published=0,updated_at=?,version=version+1 WHERE event_id=? AND version=? AND published=1 AND NOT EXISTS(SELECT 1 FROM club_event_activity WHERE mutation_id=?)')
      .bind(now,id,version,mutationId);
  }
  const [written]=await db.batch([update,db.prepare('INSERT INTO club_event_activity(mutation_id,event_id,action,request_json,actor_id,actor_name,recorded_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1')
    .bind(mutationId,id,'member_notice_'+action,payload,identity.id,identity.name||identity.id,now),
    db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,'member_notice_'+action,id,now)]);
  if (!written.meta.changes && !matches(await receipt())) conflict();
  return h.json(await read());
}

export async function memberCalendarEndpoint(request,env,identity,h) {
  const {pathname,searchParams}=new URL(request.url);
  const committee=pathname.startsWith('/api/committee/');
  h.requireRole(identity,committee?['committee']:['member','committee']);
  const binding=h.requireDb(env),db=binding.withSession?binding.withSession('first-primary'):binding;
  const missing=()=>{throw new h.HttpError(404,'This calendar notice is no longer available.','not_found');};
  if (committee) {
    const match=/^\/api\/committee\/events\/([^/]+)\/member-notice$/.exec(pathname);
    if(!match || !uuid.test(match[1]))missing();
    return officerNotice(request,db,identity,match[1].toLowerCase(),h);
  }
  if(!['GET','HEAD'].includes(request.method))throw new h.HttpError(405,'Open the member calendar to view events.','method_not_allowed');
  if(pathname!=='/api/member/calendar') {
    const match=/^\/api\/member\/calendar\/([^/]+)\.ics$/.exec(pathname);
    if(!match||!uuid.test(match[1]))missing();
    const row=await db.prepare('SELECT '+columns+',updated_at AS updatedAt,version FROM member_event_notices WHERE published=1 AND event_id=?').bind(match[1].toLowerCase()).first();
    if(!row)missing();
    return h.response(request.method==='HEAD'?null:privateIcs(row),200,{'Cache-Control':'private, no-store','Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="sandy-member-event.ics"'});
  }
  const today=brisbane(Date.now()).slice(0,10),month=searchParams.get('month')??today.slice(0,7);
  if(!/^(?:19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])$/.test(month)||searchParams.getAll('month').length>1||[...searchParams.keys()].some(k=>k!=='month'))
    throw new h.HttpError(400,'Choose a valid calendar month.','invalid_month');
  const rows=await db.prepare('SELECT '+columns+' FROM member_event_notices WHERE published=1 AND event_date>=? AND event_date<date(?,\'+1 month\') ORDER BY event_date,start_time,title,event_id')
    .bind(month+'-01',month+'-01').all();
  const member=rows.results.map(row=>({...row,source:'members',calendarUrl:'/api/member/calendar/'+row.id+'.ics'}));
  const shared=EVENTS.map(event=>{
    const local=brisbane(event.startsAt);
    return {id:event.id,source:'public',title:event.title,date:local.slice(0,10),time:local.slice(11,16),place:event.location,details:event.description,calendarUrl:event.calendarUrl};
  }).filter(event=>event.date.slice(0,7)===month);
  const events=[...shared,...member].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)||a.title.localeCompare(b.title));
  return h.json({today,month,events},200,{'Cache-Control':'private, no-store'});
}
