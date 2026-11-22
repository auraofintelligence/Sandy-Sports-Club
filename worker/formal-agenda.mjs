const opening = 'Opening, chair, attendance, apologies and quorum';
const interests = 'Declarations of material personal interests';
const previous = 'Confirmation of previous minutes';
const matters = 'Matters arising and outstanding actions';
const close = 'Next meeting and close';
const directions = {
  committee: [opening, interests, previous, matters, 'Correspondence', 'Treasurer’s report and accounts',
    'Officer and working group reports', 'Business for decision', 'Other business', 'Read back resolutions and actions', close],
  general: [opening, 'Notice of meeting and business to be considered', interests, 'Committee disclosures to members',
    previous, matters, 'Reports to members', 'Notified business and resolutions', 'Read back resolutions and actions', close],
  agm: [opening, 'Notice of annual general meeting', interests, 'Committee disclosures to members', 'Confirmation of previous AGM minutes',
    matters, 'President’s annual report', 'Presentation and adoption of financial statements and applicable audit or verification report',
    'Disclosure of remuneration and benefits, including a nil disclosure', 'Appointment of auditor, accountant or verifier, if applicable',
    'Election of the management committee', 'Other notified business and resolutions', 'Read back resolutions and actions', close],
  special: [opening, 'Notice, purpose and exact business of this special meeting', interests,
    'Consider the resolutions specified in the notice', 'Read back outcomes and actions', 'Close'],
  informal: ['Welcome and introductions', 'Hear from the people present', 'Ideas and practical considerations',
    'Who can help, and with what?', 'Next steps and items for the committee', 'Next contact and who will circulate the notes']
};
export const validAgendaKind = kind => typeof kind==='string' && Object.hasOwn(directions, kind);
export const agendaTitles = (kind,id) => directions[kind] || directions.committee;
const blank = (kind, titles) => ({kind, chair:'',minuteTaker:'',attendance:'',apologies:'',quorum:'',quorumStatus:'unchecked',conflicts:'',
  openedAt:'',closedAt:'',adjournment:'',nextMeeting:'',items:titles.map(title=>({title,notes:'',motions:[]}))});
const outcomes = ['pending','carried','lost','deferred','withdrawn'];
function parseAgenda(raw, fixedKind, {textField,HttpError}) {
  const invalid = message => { throw new HttpError(400, message, 'invalid_agenda'); };
  if (!raw || typeof raw!=='object' || Array.isArray(raw) || !validAgendaKind(raw.kind)) invalid('Choose the kind of meeting.');
  
  const result={kind:raw.kind,quorumStatus:raw.quorumStatus??'unchecked'};
  if (!['unchecked','present','absent','lost'].includes(result.quorumStatus)) invalid('Record whether the meeting had a quorum.');
  for (const [name,max] of Object.entries({chair:140,minuteTaker:140,attendance:2000,apologies:2000,quorum:500,conflicts:2000,adjournment:1000,nextMeeting:500})) {
    result[name]=textField(raw[name],name,max);
  }
  for (const name of ['openedAt','closedAt']) {
    result[name]=textField(raw[name],'the meeting time',5);
    if (result[name] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(result[name])) invalid('Enter the actual meeting time in hours and minutes.');
  }
  if (result.kind==='informal' && (result.quorum || result.quorumStatus!=='unchecked')) invalid('A quorum applies to a formal meeting. Use the attendance field for this catch-up.');
  if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length>1750) invalid('Add at least one agenda item.');
  result.items=raw.items.map(item=>{
    if (!item || typeof item!=='object' || !Array.isArray(item.motions) || item.motions.length>100) invalid('Check the agenda items and their motions.');
    const title=textField(item.title,'the agenda heading',3500,true);
    if (/[\r\n]/.test(title)) invalid('Give each agenda item its own heading on a single line.');
    if (result.kind==='informal' && item.motions.length) invalid('Record a suggestion or a follow-up for this catch-up. Formal motions belong in a separately convened meeting.');
    const motions=item.motions.map(m=>{
      if (!m || typeof m!=='object' || !outcomes.includes(m.outcome)) invalid('Choose a motion outcome or leave it pending.');
      return {text:textField(m.text,'the wording of the motion',2000,true),movedBy:textField(m.movedBy,'the mover',140),
        secondedBy:textField(m.secondedBy,'the seconder',140),outcome:m.outcome,vote:textField(m.vote,'the voting record',500)};
    });
    return {title,notes:textField(item.notes,'the item notes',3500),motions};
  });
  return result;
}

export function containsProceedings(agenda) {
  return Boolean(agenda && (agenda.openedAt || agenda.closedAt || agenda.attendance || agenda.adjournment ||
    agenda.items.some(item=>item.notes || item.motions.some(m=>m.text && m.outcome!=='pending'))));
}

// A meeting can lose its quorum after valid decisions. Keep those decisions as recorded
// while preventing a new vote during the adjournment.
function checkVotes(agenda,previous,HttpError) {
  if (agenda.quorumStatus==='present') return;
  const ballots=record=>record.items.flatMap(item=>item.motions.filter(m=>m.outcome==='carried'||m.outcome==='lost').map(m=>JSON.stringify([item.title,m])));
  const allowed=agenda.quorumStatus==='lost' && ['present','lost'].includes(previous.quorumStatus) ? ballots(previous) : [];
  for (const motion of ballots(agenda)) {
    const index=allowed.indexOf(motion);
    if (index<0) throw new HttpError(400,'Confirm that a quorum was present before recording a vote. With no quorum, record the adjournment and next step.','vote_without_quorum');
    allowed.splice(index,1);
  }
  if (allowed.length) throw new HttpError(400,'Keep the votes recorded before quorum was lost. Record the later adjournment separately.','previous_votes_changed');
}

const meetingState = (db,id) => db.prepare(`SELECT r.agenda_kind AS kind,n.status,a.topics,a.formal_json AS formal,a.revision,a.updated_by AS editor
  FROM meeting_register r LEFT JOIN meeting_notes n ON n.id=r.id LEFT JOIN meeting_agendas a ON a.meeting_id=r.id WHERE r.id=?`).bind(id);

function view(row,id) {
  const locked=row.status==='approved',legacy=row.topics!=null && !row.formal;
  const titles=legacy?row.topics.split(/\r?\n/).filter(Boolean):locked?[]:agendaTitles(row.kind,id);
  return {agenda:row.formal?JSON.parse(row.formal):blank(row.kind,titles), version:row.revision||0,
    templates:directions,legacy,locked,
    fixedKind:null};
}

export async function formalAgenda(request,db,id,identity,helpers) {
  const {json,bodyJson,HttpError}=helpers;
  if (!['GET','PUT'].includes(request.method)) throw new HttpError(405,'Open or save the meeting agenda.','method_not_allowed');
  const state=await meetingState(db,id).first();
  if (!state) throw new HttpError(404,'This meeting is unavailable.','not_found');
  const current=view(state,id);
  if (request.method==='GET') return json(current);
  const input=await bodyJson(request,500000);
  if (!Number.isSafeInteger(input.version) || input.version<0 || input.version>=2147483647) throw new HttpError(400,'Reopen this agenda before saving it.','invalid_version');
  const agenda=parseAgenda(input.agenda,current.fixedKind,helpers);
  checkVotes(agenda,current.agenda,helpers.HttpError);
  const doc=JSON.stringify(agenda),topics=agenda.items.map(i=>i.title).join('\n');
  const conflict=()=>new HttpError(409,'The agenda changed or the record was approved. Open the saved agenda before making further changes.','agenda_conflict');
  if (state.formal===doc && (current.version===input.version || (current.version===input.version+1 && state.editor===identity.id))) return json(current);
  if (current.locked || current.version!==input.version) throw conflict();
  const becomingInformal=agenda.kind==='informal' && current.agenda.kind!=='informal';
  if (becomingInformal && current.agenda.items.some(item=>item.motions.length)) {
    throw new HttpError(409,'This record already has formal motions. Keep its meeting type or schedule a separate catch-up.','formal_motions_recorded');
  }
  const when=new Date().toISOString();
  const result=await db.batch([
    db.prepare(`INSERT INTO meeting_agendas(meeting_id,topics,revision,updated_at,updated_by,formal_json)
      SELECT ?1,?2,?3+1,?4,?5,?6 WHERE COALESCE((SELECT revision FROM meeting_agendas WHERE meeting_id=?1),0)=?3
      AND NOT EXISTS(SELECT 1 FROM meeting_notes WHERE id=?1 AND status='approved')
      AND (?7=0 OR NOT EXISTS(SELECT 1 FROM meeting_notes WHERE id=?1 AND json_array_length(decisions_json)>0))
      ON CONFLICT(meeting_id) DO UPDATE SET topics=excluded.topics,revision=excluded.revision,updated_at=excluded.updated_at,
        updated_by=excluded.updated_by,formal_json=excluded.formal_json WHERE meeting_agendas.revision=?3`)
      .bind(id,topics,input.version,when,identity.id,doc,Number(becomingInformal || agenda.quorumStatus==='absent')),
    db.prepare("INSERT INTO audit_log SELECT ?,?,'committee','meeting_agenda_saved',?,? WHERE changes()=1").bind(crypto.randomUUID(),identity.id,id,when),
    meetingState(db,id)
  ]);
  const saved=result[2].results[0];
  if (saved.formal!==doc || saved.editor!==identity.id || saved.revision!==input.version+1) throw conflict();
  return json(view(saved,id));
}
