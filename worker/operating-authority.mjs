export async function operatingAuthority(request,env,identity,{requireRole,requireDb,bodyJson,textField,dateField,HttpError,json}) {
  requireRole(identity,['committee']);
  const db=requireDb(env);
  const today=new Date(Date.now()+10*3600000).toISOString().slice(0,10);
  if(request.method==='GET'){
    const rows=await db.prepare(`SELECT h.id,h.kind,h.scope,h.event_title AS eventTitle,h.owner_name AS requester,
      a.motion,a.work,a.retained,a.club_lead AS clubLead,a.review_day AS reviewDay,a.partner_lead AS partnerLead,
      a.acceptance_ref AS acceptanceRef,a.accepted_at AS acceptedAt,a.closed_at AS closedAt
      FROM partner_handoffs h LEFT JOIN operating_authorities a ON h.id=a.request_id
      WHERE h.status='authorised' OR a.request_id IS NOT NULL ORDER BY h.consent_at DESC`).all();
    return json({tasks:rows.results,today});
  }
  if(request.method!=='POST')throw new HttpError(405,'Choose a committee decision.','method_not_allowed');
  const b=await bodyJson(request),id=textField(b.id,'the request',64,true);
  const now=new Date().toISOString(),actor=identity.id;
  let change;
  if(b.action==='record'){
    const meeting=textField(b.meetingId,'the meeting',64,true),motion=textField(b.motion,'the approved decision',500,true);
    const work=textField(b.work,'the task being delegated',400,true),retained=textField(b.retained,'what Sandy Sports keeps',400,true);
    const lead=textField(b.lead,'the club contact',100,true),review=dateField(b.review);
    if(review<today)throw new HttpError(400,'Choose today or a future review date.','invalid_date');
    change=db.prepare(`INSERT INTO operating_authorities(request_id,meeting_id,motion,work,retained,club_lead,review_day,recorded_by,recorded_at)
      SELECT h.id,?,?,?,?,?,?,?,? FROM partner_handoffs h WHERE h.id=? AND h.status='authorised'
      AND EXISTS(SELECT 1 FROM formal_authority_decisions WHERE id=? AND motion=?)
      ON CONFLICT(request_id) DO NOTHING`).bind(meeting,motion,work,retained,lead,review,actor,now,id,meeting,motion);
  }else if(b.action==='accept'){
    const lead=textField(b.partnerLead,'the partner contact or role',100,true),ref=textField(b.reference,'the acceptance reference',200,true);
    if(b.confirm!==true)throw new HttpError(400,'Check the partner’s written acceptance first.','confirmation_required');
    change=db.prepare(`UPDATE operating_authorities SET partner_lead=?,acceptance_ref=?,accepted_at=?,accepted_by=?
      WHERE request_id=? AND accepted_at IS NULL AND closed_at IS NULL AND review_day>=?
      AND EXISTS(SELECT 1 FROM partner_handoffs WHERE id=? AND status='authorised')`).bind(lead,ref,now,actor,id,today,id);
  }else if(b.action==='close' && b.confirm===true){
    change=db.prepare('UPDATE operating_authorities SET closed_at=?,closed_by=? WHERE request_id=? AND closed_at IS NULL').bind(now,actor,id);
  }else throw new HttpError(400,'Choose an action for this task.','invalid_action');
  const [result]=await db.batch([change,db.prepare("INSERT INTO audit_log SELECT ?,?,'committee',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),actor,'operating_authority_'+b.action,id,now)]);
  if(!result.meta.changes)throw new HttpError(409,'Refresh this task and check its approved decision, consent and review date.','authority_changed');
  return json({saved:true});
}
