import {setupMeetingReminders} from './meeting-reminders.js?v=20261121-club-funding';
import {setupFormalAgenda} from './formal-agenda.js';

const SAMPLE = [
  'The committee discussed a mixed beach sport session for families.',
  'We agreed to test a portable court layout before choosing a venue.',
  'The secretary will confirm an accessible meeting place.',
  'The treasurer will check equipment estimates before any purchase.',
].join('\n');

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const EMPTY = () => ({notes: '', actions: [], decisions: [], status: 'draft', version: 0});
const dayLabel = iso => new Intl.DateTimeFormat('en-AU', {timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(iso + 'T12:00:00Z'));
const timeLabel = time => new Intl.DateTimeFormat('en-AU', {timeZone:'UTC',hour:'numeric',minute:'2-digit'}).format(new Date('2000-01-01T'+time+'Z'));
const meetingPath = id => '/api/meeting?id=' + encodeURIComponent(id);

function calendarDate(value) {
  let y, m, d;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  const spelled = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})$/i.exec(value);
  if (iso) [, y, m, d] = iso;
  else if (dayFirst) [, d, m, y] = dayFirst;
  else if (spelled) {
    [,d,,y] = spelled;
    m = MONTHS.findIndex(month => month === spelled[2].toLowerCase() || month.slice(0,3) === spelled[2].toLowerCase()) + 1;
  } else return '';
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number(y) >= 1900 && Number(y) <= 2100 && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? date.toISOString().slice(0,10) : '';
}

export function draftFromNotes(notes) {
  const decisions = new Set();
  const jobs = new Map();
  for (const part of notes.split(/[\r\n]+|(?<=[.!?])\s+/u)) {
    const line = part.replace(/^[\s•*-]+/, '').replace(/[.!;]+$/, '').trim();
    if (!line || line.endsWith('?')) continue;
    const agreed = /^(?:(?:we|the committee|members|the meeting)\s+(?:unanimously\s+)?(?:agreed|decided|resolved)\b|(?:decision|agreed|resolved|motion carried)\s*:)\s*(.*)$/i.exec(line);
    if (agreed && agreed[1]) {
      const decision = agreed[1].replace(/^that\s+/i, '').replace(/^to\s+/i, '');
      decisions.add(decision.charAt(0).toUpperCase() + decision.slice(1));
      continue;
    }
    const explicit = /^(?:action|follow[- ]up|job)\s*:\s*(.+)$/i.exec(line);
    const raw = explicit ? explicit[1] : line;
    const assigned = /^(?:the\s+)?([\p{L}][\p{L}’'-]*(?:\s+[\p{L}][\p{L}’'-]*){0,2})\s+(?:will|to)\s+(.+)$/iu.exec(raw);
    if (!explicit && (!assigned || !/\bwill\b/i.test(raw) || /^(?:not|never)\b/i.test(assigned[2]))) continue;
    let text = assigned ? assigned[2] : raw;
    let owner = assigned ? assigned[1] : '';
    if (/^(?:we|they|someone|somebody|who|i|he|she|you)$/i.test(owner)) owner = '';
    const due = /\s+(?:by|on)\s+(?:the\s+)?(\d{4}-\d\d-\d\d|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+\s+\d{4})$/i.exec(text);
    const dueDate = due ? calendarDate(due[1]) : '';
    if (dueDate) text = text.slice(0, due.index);
    text = text.charAt(0).toUpperCase() + text.slice(1);
    owner = owner.charAt(0).toUpperCase() + owner.slice(1);
    if (text.length <= 500 && owner.length <= 100) jobs.set([text.toLowerCase(), owner.toLowerCase(), dueDate].join('|'), {text, owner, dueDate, done: false});
  }
  return {decisions: [...decisions].filter(line => line.length <= 500).slice(0,50), actions: [...jobs.values()].slice(0,50)};
}

function icsValue(value) {
  return String(value).replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
}

function foldCalendarLine(value) {
  let line = '', bytes = 0;
  const lines = [];
  const encoder = new TextEncoder();
  for (const char of value) {
    const width = encoder.encode(char).length;
    if (bytes + width > 75) { lines.push(line); line = ' '; bytes = 1; }
    line += char;
    bytes += width;
  }
  return [...lines, line].join('\r\n');
}

export function actionCalendar(action, practice = false, stamp = new Date()) {
  if (!calendarDate(action.dueDate)) throw Error('A valid due date is needed.');
  const end = new Date(action.dueDate + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  const title = (practice ? 'Sandy practice: ' : 'Sandy Sports: ') + action.text;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//Follow-ups//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:' + icsValue(action.id) + '@sandy-sports-clubhouse','DTSTAMP:' + stamp.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/, 'Z'),
    'DTSTART;VALUE=DATE:' + action.dueDate.replaceAll('-',''),'DTEND;VALUE=DATE:' + end.toISOString().slice(0,10).replaceAll('-',''),
    'SUMMARY:' + icsValue(title),'DESCRIPTION:' + icsValue('Responsible: ' + action.owner),'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',
    'DESCRIPTION:' + icsValue(title),'END:VALARM','END:VEVENT','END:VCALENDAR',''].map(foldCalendarLine).join('\r\n');
}

export function memberMinuteCopy(decisions) {
  const contact = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\b0[23478]|\+61[ .()-]*(?:\(0\)[ .()-]*)?[23478])(?:[ .()\u2013-]*\d){8}\b|\b1[38]00(?:[ .-]*\d){6}\b|\b\d{4}[ .-]\d{4}\b/i;
  return decisions.filter(line => !contact.test(line)).map(line => '• '+line).join('\n').slice(0,8000);
}

export function setupMeetingWorkflow({api, toast, download, esc, modal, setupRecording}) {
  const desk = document.getElementById('meeting-desk');
  const byId = id => document.getElementById(id);
  const notes = byId('meeting-notes'), decisions = byId('desk-decisions'), confirm = byId('desk-confirm');
  const statusLine = byId('notes-status');
  const formal = setupFormalAgenda({api,esc,clearSession,onSaved(id){
    reminders.refresh(id); applyMeetingLabels(); syncMemberDraft();window.dispatchEvent(new Event('plfc:meeting-register-changed'));
  },onChange(){confirm.checked=false;applyMeetingLabels();syncMemberDraft();}});
  const reminders = setupMeetingReminders({api,esc,clearSession,unsaved:formal.changed,meetingKind:()=>formal.kind()??meeting.kind});
  let meeting = EMPTY(), live = null, practice = false, stage = 'agenda', dirty = false;
  let readOnly = false;
  let pending = false, generation = 0, conflict = false, cleanupRecorder;
  let generatedInput = null;
  let jobsRefresh=0;
  let register = [], createAttempt = null, suggestions = [], aiSource = '';
  const releaseDrafts = new Map();
  const approved = () => meeting.status === 'approved';
  const note = message => { statusLine.textContent = message; };
  function stopRecorder() {
    if (!byId('record-stop').disabled) byId('record-stop').click();
  }
  function clearRecorder() {
    cleanupRecorder?.();
    cleanupRecorder = null;
    byId('record-download').replaceChildren();
    byId('record-transcript').value = '';
    byId('record-consent').checked = false;
    byId('record-preview').srcObject = null;
    byId('record-preview').hidden = true;
    byId('record-status').textContent = '';
  }
  function clearSession() {
    generation++;
    formal.reset();reminders.reset();
    if (byId('save-job-calendar')) {
      const dialog=byId('sandy-info-dialog');
      if(dialog.open)dialog.close();
      dialog.querySelector('[data-dialog-body]').replaceChildren();
    }
    clearRecorder();
    meeting = EMPTY(); live = null; practice = false; dirty = false; conflict = false; pending = false; generatedInput = null;
    register = []; createAttempt = null; suggestions = []; aiSource = '';
    releaseDrafts.clear(); byId('desk-release').open = false;
    jobsRefresh++;byId('desk-all-followups').hidden=true;byId('desk-all-followups').open=false;byId('desk-all-followups').querySelector('[data-all-followups]').replaceChildren();
    byId('desk-picker').replaceChildren();
    byId('desk-create-form').reset(); byId('desk-create-message').textContent = ''; byId('desk-calendar-status').textContent = '';
    desk.hidden = true; desk.inert = false;
    readOnly = false;
    byId('committee-mode').textContent = 'Sign in with a committee account to open the meeting desk.';
    render();
  }
  async function setSession(session) {
    clearSession();
    if (session?.role !== 'committee' || !session.storageReady) return;
    readOnly = Boolean(session.readOnly || session.demo || session.showcase);
    const id = generation;
    byId('committee-mode').textContent = 'Opening the committee meeting record…';
    try {
      const listing = await api('/api/meetings');
      if (id !== generation) return;
      register = listing.meetings;renderAllJobs(listing.openJobs);
      const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const ordered = [...register].sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
      const first = ordered.find(item => item.date >= today) || ordered.at(-1);
      if (!first) {
        desk.hidden = false;
        byId('desk-create').open = !readOnly;
        byId('desk-create').hidden = readOnly;
        byId('desk-picker').disabled = true;
        desk.querySelector('.desk-meeting-header').hidden = true;
        desk.querySelector('.meeting-steps').hidden = true;
        desk.querySelectorAll('[data-meeting-panel]').forEach(panel => panel.hidden = true);
        desk.querySelector('.desk-save-line').hidden = true;
        byId('desk-all-followups').hidden = true;
        byId('committee-mode').textContent = readOnly
          ? 'No Sandy meetings have been scheduled. This role view is read only.'
          : 'No Sandy meetings have been scheduled. Use Schedule a meeting to create the first agenda.';
        return;
      }
      await openMeeting(first.id);
    } catch {
      if (id === generation) byId('committee-mode').textContent = 'The private meeting could not load. Refresh this page to try again.';
    }
  }
  function renderAllJobs(jobs) {
    const panel=byId('desk-all-followups'), body=panel.querySelector('[data-all-followups]');
    panel.hidden=practice || !Array.isArray(jobs);
    if(panel.hidden){body.replaceChildren();return;}
    panel.querySelector('summary').textContent='Open follow-ups across meetings · '+jobs.length;
    body.innerHTML=jobs.length?'<ul class="desk-all-jobs">'+jobs.map(job=>'<li><div><strong>'+esc(job.text)+'</strong><p>'+esc(job.owner||'No owner recorded')+' · '+(job.dueDate?'Due '+esc(dayLabel(job.dueDate)):'No due date recorded')+'</p></div><button class="text-link" data-open-job-meeting="'+esc(job.meetingId)+'" data-open-job-id="'+esc(job.id)+'" type="button">Open '+esc(job.meetingTitle)+'</button></li>').join('')+'</ul>':'<p>There are no unfinished jobs in the finalised meeting records.</p>';
  }
  async function refreshAllJobs() {
    const id=generation,ticket=++jobsRefresh;
    try{const data=await api('/api/meetings',{cache:'no-store'});if(id===generation&&ticket===jobsRefresh){register=data.meetings;renderAllJobs(data.openJobs);}}
    catch{if(id===generation&&ticket===jobsRefresh){const panel=byId('desk-all-followups');panel.hidden=false;panel.querySelector('summary').textContent='Open follow-ups across meetings';panel.querySelector('[data-all-followups]').innerHTML='<p>The job list could not refresh.</p><button type="button" class="text-link" data-retry-jobs>Try again</button>';}}
  }
  async function showMeetingJob(id,jobId){
    if(pending||!canSwitch())return;
    if(live?.id!==id)await openMeeting(id);
    if(live?.id===id){
      choose('follow');const checkbox=byId('desk-follow-actions').querySelector('[data-done="'+CSS.escape(jobId)+'"]');
      if(checkbox)checkbox.focus();
    }
  }
  byId('desk-all-followups').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-retry-jobs')){refreshAllJobs();return;}
    showMeetingJob(button.dataset.openJobMeeting,button.dataset.openJobId);
  });
  window.addEventListener('plfc:officer-meeting-job',event=>{
    if(location.hash==='#committee/meetings' && live && typeof event.detail?.id==='string')showMeetingJob(event.detail.meetingId,event.detail.id);
  });
  function canSwitch() {
    let message = '';
    if (dirty) message = 'Save the current draft before changing meetings.';
    else if (formal.changed()) message = 'Save the current agenda before changing meetings.';
    else if (!byId('record-stop').disabled) message = 'Stop the recording before changing meetings.';
    else if (byId('record-download').querySelector('a:not([data-saved])')) message = 'Download the current recording before changing meetings.';
    else if (byId('record-transcript').value.trim() && !notes.value.includes(byId('record-transcript').value.trim())) message = 'Use the transcript in your notes and save the draft before changing meetings.';
    if (message) { note(message); toast(message); }
    return !message;
  }
  async function openMeeting(meetingId) {
    const id = generation, selected = register.find(item => item.id === meetingId);
    if (!selected) return;
    pending = true; desk.inert = true;
    try {
      const {meeting: record} = await api(meetingPath(meetingId));
      if (id !== generation) return;
      live = {...EMPTY(),...selected,...record};
      enter(live, false);
    } catch (error) {
      if (id !== generation) return;
      if (error.status === 401 || error.status === 403) { clearSession(); return; }
      if (!live) throw error;
      byId('desk-picker').value = live.id;
      note('The selected record could not open. Your current meeting remains on screen.');
    } finally { if (id === generation) { pending = false; desk.inert = false; } }
  }
  function enter(record, example) {
    clearRecorder();
    meeting = structuredClone(record);
    practice = example; dirty = false; conflict = false; generatedInput = null; suggestions = []; aiSource = '';
    byId('desk-ai').open = false; byId('desk-ai-note').textContent = '';
    byId('desk-release').open = false;
    if (example) {reminders.reset();formal.reset();}
    else {formal.open(meeting);reminders.open(meeting.id);}
    cleanupRecorder = setupRecording();
    desk.hidden = false;
    byId('desk-create').hidden = readOnly;
    byId('desk-picker').disabled = false;
    desk.querySelector('.desk-meeting-header').hidden = false;
    desk.querySelector('.meeting-steps').hidden = false;
    desk.querySelector('.desk-save-line').hidden = false;
    byId('committee-mode').textContent = readOnly ? 'Private committee record. This view is read only.' : example ? 'Practice meeting. Your example stays in this tab and is cleared when you leave practice.' : 'Private committee record. Save drafts to the club database.';
    render();
    choose(approved() ? 'follow' : example ? 'capture' : 'agenda', false);
    note(example ? 'Read the example, then choose Prepare draft minutes.' : meeting.version ? 'Saved meeting loaded.' : 'Your agenda is ready.');
  }
  function choose(next, focus = true) {
    if (stage === 'capture' && next !== stage) stopRecorder();
    stage = next;
    for (const button of desk.querySelectorAll('[data-meeting-step]')) {
      if (button.dataset.meetingStep === stage) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    }
    for (const panel of desk.querySelectorAll('[data-meeting-panel]')) panel.hidden = panel.dataset.meetingPanel !== stage;
    byId('desk-original-notes').textContent = notes.value || 'No notes recorded yet.';
    if (stage === 'follow') renderFollow();
    if (focus) desk.querySelector('[data-meeting-panel="' + stage + '"] h3')?.focus();
  }
  function formRecord() {
    return {...meeting, notes: notes.value.trim(), decisions: decisions.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      actions: [...byId('desk-edit-actions').querySelectorAll('[data-job]')].map(row => ({
        id: row.dataset.job, text: row.querySelector('[data-field=text]').value.trim(), owner: row.querySelector('[data-field=owner]').value.trim(),
        dueDate: row.querySelector('[data-field=dueDate]').value, done: meeting.actions.find(a => a.id === row.dataset.job)?.done || false,
      }))};
  }
  function jobCard(job) {
    return `<div class="desk-edit-job" data-job="${esc(job.id)}"><label>Job<input data-field="text" maxlength="500" value="${esc(job.text)}"></label><div class="field-pair"><label>Owner<input data-field="owner" maxlength="100" value="${esc(job.owner)}" placeholder="Who agreed to it?"></label><label>Due date<input type="date" data-field="dueDate" value="${esc(job.dueDate)}"></label></div><button type="button" class="text-link" data-drop-job>Remove job</button></div>`;
  }
  function renderFollow() {
    const jobs = formRecord().actions;
    if (draftHotelCatchup()) {
      const proposed = jobs.filter(job => job.text).length;
      byId('desk-follow-summary').textContent = proposed
        ? 'The draft contains '+proposed+' proposed follow-up'+(proposed===1?'':'s')+'. Choose Review catch-up notes to check who volunteered and agree a date. Finalise the notes to record the agreed jobs.'
        : 'There are no agreed follow-ups from this catch-up yet. After the conversation, record who volunteered and when they agreed to do it.';
      byId('desk-follow-actions').replaceChildren();
      return;
    }
    const complete = jobs.filter(a => a.done).length;
    byId('desk-follow-summary').textContent = approved()
      ? `${complete} of ${jobs.length} jobs complete.${jobs.length ? ' Add dated jobs to your calendar and tick them off here.' : ' Your minutes are ready to download.'}`
      : informal()?'Finalise the catch-up notes to use the follow-up list and calendar reminders.':'Review and approve the minutes to activate the follow-up list and calendar reminders.';
    const sorted = jobs.sort((a,b) => Number(a.done) - Number(b.done) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    byId('desk-follow-actions').innerHTML = sorted.map(job => `<article class="desk-follow-job"><label><input type="checkbox" data-done="${esc(job.id)}" ${job.done?'checked':''} ${approved()?'':'disabled'}>${esc(job.text || 'Untitled job')}</label><p>${esc(job.owner || 'Owner to confirm')} · ${job.dueDate ? esc(dayLabel(job.dueDate)) : 'Date to confirm'}</p>${approved() && job.dueDate ? '<button type="button" class="text-link" data-calendar-job="'+esc(job.id)+'">Add a calendar reminder</button>' : ''}</article>`).join('');
  }
  function informal() {return !practice && (formal.kind()??meeting.kind)==='informal';}
  function draftHotelCatchup() {return false;}
  function noQuorum() {return !informal() && (formal.quorumStatus()??meeting.quorumStatus)==='absent';}
  function paused() {return !practice&&!informal()&&(formal.quorumStatus()??meeting.quorumStatus)!=='present';}
  function syncMemberDraft() {
    if(!approved()||practice||meeting.releasedAt||releaseDrafts.has(meeting.id))return;
    if(noQuorum()){byId('desk-release-text').value='A quorum was not present. No substantive business was conducted.';return;}
    const choices=informal()?meeting.decisions:[...new Set([...meeting.decisions,...formal.carried()])];
    byId('desk-release-text').value=memberMinuteCopy(choices);
  }
  function applyMeetingLabels() {
    const casual=informal(),failed=noQuorum();
    byId('desk-review-heading').textContent=casual?'Review catch-up notes':'Check the draft minutes';
    byId('desk-review-help').textContent=casual?'Check what people suggested, what someone volunteered to do and which proposals need a committee decision.':'Read the saved formal record and the notes. Check each motion, outcome and follow-up before confirming the minutes.';
    byId('desk-approval-instruction').textContent=casual?'I have checked that these notes accurately record the catch-up.':'I checked that the meeting approved this record. Arrange the chair’s signature on the minutes.';
    byId('desk-approve').textContent=casual?'Finalise catch-up notes':practice?'Approve practice minutes':'Approve minutes';
    byId('desk-release-label').textContent=casual?'Share catch-up notes with paid members':'Share the minutes with paid members';
    byId('desk-release-help').textContent=casual?'Choose the wording members should see. Distinguish any proposals still needing a committee decision. Once shared, this copy stays in the member area.':'Check the wording for members. Start with the approved decisions and carried motions, and leave personal contact details and private discussion out. Once shared, this copy stays in the member area.';
    byId('desk-release-submit').textContent=casual?'Share checked notes with paid members':'Share minutes with paid members';
    desk.querySelector('[for="desk-decisions"]').textContent=casual?'Suggestions and referrals, one per line':'Other agreed decisions, one per line';
    decisions.placeholder=casual?'Which ideas should the committee consider?':'Record agreed decisions that are not already entered as motions.';
    byId('meeting-badge').textContent=(practice?'Practice · ':'')+(approved()?(casual?'Finalised':'Approved'):'Draft');
    byId('prepare-minutes').textContent=casual?'Prepare catch-up notes':'Prepare draft minutes';
    byId('export-meeting').textContent=casual?'Download catch-up notes':'Download minutes';
    desk.querySelector('[data-meeting-step="review"]').lastChild.textContent=casual?'Review notes':'Review minutes';
    desk.querySelector('[data-meeting-go="review"]').textContent=draftHotelCatchup()?'Review catch-up notes':casual?'Read the notes':'Read the minutes';
    if(failed){
      byId('desk-review-heading').textContent='Review the record of no quorum';
      byId('desk-review-help').textContent='Record attendance, the time quorum was checked and the arrangements to adjourn or let the meeting lapse.';
      byId('desk-approval-instruction').textContent='I checked the attendance and the record of what happened when quorum was not reached.';
      byId('desk-approve').textContent='Finalise the no-quorum record';
      byId('meeting-badge').textContent=approved()?'Finalised · No quorum':'No quorum';
      byId('desk-release-label').textContent='Share the no-quorum record with paid members';
      byId('desk-release-help').textContent='Tell members the outcome and the next arrangements. Check the wording before sharing.';
      byId('export-meeting').textContent='Download no-quorum record';
    }
    decisions.readOnly=approved()||(paused() && !decisions.value.trim());
    if(paused()){
      desk.querySelector('[for="desk-decisions"]').textContent=failed?'No decisions can be made without a quorum':'Other decisions · first record a quorum in the agenda';
      decisions.placeholder='Use the agenda to record the quorum before entering decisions.';
    }
    const approval=byId('desk-approved-on');
    if(approved()&&meeting.approvedAt)approval.textContent=(failed?'No-quorum record finalised ':casual?'Notes finalised ':'Approval recorded ')+new Date(meeting.approvedAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'long',timeStyle:'short'})+' AEST.';
  }
  function render() {
    formal.setApproved(approved());
    notes.value = meeting.notes;
    decisions.value = meeting.decisions.join('\n');
    confirm.checked = false;
    byId('desk-edit-actions').innerHTML = meeting.actions.map(jobCard).join('');
    byId('desk-original-notes').textContent = meeting.notes;
    byId('desk-register').hidden = practice;
    byId('desk-picker').replaceChildren(...register.map(item => new Option(dayLabel(item.date)+' · '+item.title, item.id)));
    if (live) byId('desk-picker').value = live.id;
    byId('desk-meeting-title').textContent = meeting.title || '';
    byId('desk-meeting-place').textContent = meeting.location || '';
    byId('desk-meeting-when').textContent = meeting.date && meeting.time ? dayLabel(meeting.date) + ' · ' + timeLabel(meeting.time) + ' AEST' : '';
    byId('desk-ai').hidden = practice || approved();
    const release = byId('desk-release'), published = Boolean(meeting.releasedAt);
    release.hidden = practice || !approved();
    byId('desk-release-text').value = release.hidden ? '' : (published ? meeting.releasedText : releaseDrafts.get(meeting.id) ?? memberMinuteCopy(meeting.decisions)) || '';
    byId('desk-release-text').readOnly = published;
    byId('desk-release-submit').hidden = published;
    byId('desk-release-status').textContent = published ? 'Shared with paid members on '+new Date(meeting.releasedAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' AEST.' : '';
    renderSuggestions();
    byId('meeting-badge').textContent = (practice ? 'Practice · ' : '') + (approved() ? 'Approved' : 'Draft');
    const approval = byId('desk-approved-on');
    approval.hidden = !approved() || !meeting.approvedAt;
    approval.textContent = approval.hidden ? '' : 'Approval recorded ' + new Date(meeting.approvedAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'long',timeStyle:'short'}) + ' AEST.';
    byId('desk-exit-practice').hidden = !practice;
    byId('desk-reload').hidden = !conflict;
    byId('desk-approve').textContent = practice ? 'Approve practice minutes' : 'Approve minutes';
    for (const element of desk.querySelectorAll('#meeting-notes,#desk-decisions,#desk-edit-actions input')) element.readOnly = approved();
    for (const element of desk.querySelectorAll('.desk-approval,#desk-add-action,[data-drop-job],#save-meeting,#prepare-minutes,.desk-record')) element.hidden = approved();
    applyMeetingLabels();syncMemberDraft();renderFollow();
    if (readOnly) {
      byId('desk-create').hidden=true;
      for(const element of desk.querySelectorAll('input,textarea'))element.disabled=true;
      for(const element of desk.querySelectorAll('#desk-approve,#desk-save-review,#save-meeting,#prepare-minutes,#desk-add-action,#desk-ask-ai,#desk-release-submit,[data-drop-job],[data-done],[data-keep-suggestion],[data-skip-suggestion]'))element.hidden=true;
      desk.querySelectorAll('[data-meeting-panel="agenda"] button:not([data-meeting-go])').forEach(button=>button.disabled=true);
    }
  }
  function markDirty() {
    if (approved() || pending || !live) return;
    dirty = true; confirm.checked = false;
    note(practice ? 'Practice changes stay in this tab.' : 'Changes ready to save.');
  }
  function prepare() {
    if (!byId('record-stop').disabled) {
      stopRecorder(); note('Recording is stopping. Check the transcript, then prepare the minutes again.'); return;
    }
    if (!byId('transcript-to-notes').disabled && byId('record-transcript').value.trim()) byId('transcript-to-notes').click();
    const record = formRecord();
    if (!record.notes && formal.substantive()) {choose('review');note('Check the saved meeting record and any follow-ups.');return;}
    if (!record.notes) { notes.focus(); note('Add meeting notes, a transcript or proceedings on the agenda first.'); return; }
    if (record.notes.length > 16000) { notes.focus(); note('Shorten the notes to 16,000 characters before drafting.'); return; }
    if (record.notes !== generatedInput) {
      const draft = draftFromNotes(record.notes);
      if(informal()||paused())draft.decisions=[];
      const grouped = new Set(record.decisions.map(d => d.toLowerCase()));
      for (const d of draft.decisions) if (!grouped.has(d.toLowerCase()) && record.decisions.length < 50) record.decisions.push(d);
      const keys = new Set(record.actions.map(a => [a.text.toLowerCase(),a.owner.toLowerCase(),a.dueDate].join('|')));
      for (const job of draft.actions) if (!keys.has([job.text.toLowerCase(),job.owner.toLowerCase(),job.dueDate].join('|')) && record.actions.length < 50) record.actions.push({...job,id:crypto.randomUUID()});
      meeting = record; generatedInput = record.notes; render(); markDirty();
    }
    choose('review');
    note(informal()?'Draft prepared. Check the suggestions and any follow-ups before finalising the catch-up notes.':'Draft prepared. Read the original notes, check every decision and job, then confirm approval.');
  }
  function validate(record, approving) {
    if(approving && formal.changed()) return 'Save the edited agenda before approving the meeting.';
    if (record.notes.length > 16000) return 'Keep the notes within 16,000 characters.';
    if (record.decisions.length > 50 || record.decisions.some(d => d.length > 500)) return 'Use up to 50 decisions of 500 characters each.';
    if (record.actions.some(a => !a.text)) return 'Give every job a description or remove its empty row.';
    if (approving && !practice && formal.version()==null) return 'Open the saved meeting agenda before finalising this record.';
    if (approving && !record.notes && !formal.substantive()) return 'Record what happened in the agenda, or add meeting notes first.';
    if (approving && record.actions.some(a => !a.owner || !calendarDate(a.dueDate))) return 'Add an owner and a full due date for each job before approval.';
    if (approving && !confirm.checked && noQuorum())return 'Tick the confirmation when you have checked the no-quorum record.';
    if (approving && !confirm.checked) return informal()?'Tick the confirmation when you have checked the catch-up notes.':'Tick the confirmation once the meeting has approved the record.';
    return '';
  }
  async function persist(record, approving = false) {
    if (readOnly || pending || conflict || !live) return false;
    const message = validate(record, approving);
    if (message) { note(message); toast(message); return false; }
    const id = generation;
    pending = true; desk.inert = true;
    try {
      const payload = {notes:record.notes, actions:record.actions, decisions:record.decisions, version:record.version, status:approving?'approved':record.status};
      if(!practice && formal.version()!=null)payload.agendaVersion=formal.version();
      const saved = practice ? {...record,...payload,version:record.version+1} : (await api(meetingPath(record.id),{method:'PUT',body:JSON.stringify(payload)})).meeting;
      if (id !== generation) return false;
      meeting = {...record,...saved};
      if (!practice) live = structuredClone(meeting);
      dirty = false;
      render();
      note(approving ? (practice ? 'Practice approved. Your example jobs are ready.' : informal()?'Catch-up notes finalised. Your follow-up list is ready.':noQuorum()?'No-quorum record finalised. Your follow-up list is ready.':'Approval recorded. Your follow-up list is ready.') : (practice ? 'Saved in this practice session.' : 'Saved to the private committee record.'));
      if(!practice&&approved()){refreshAllJobs();window.dispatchEvent(new Event('plfc:meeting-register-changed'));}
      if (approving) choose('follow');
      return true;
    } catch (error) {
      if (id !== generation) return false;
      if (error.status === 401 || error.status === 403) {
        clearSession();
        toast('Committee access has ended. Sign in again to continue.');
        return false;
      }
      if (error.status === 409) {
        conflict = true; byId('desk-reload').hidden = false;
        note('Another committee member saved changes. Download your copy from Follow up, then load the latest meeting.');
      } else { note(error.message); toast(error.message); }
      return false;
    } finally {
      if (id === generation) { pending = false; desk.inert = false; }
    }
  }
  function minutesText() {
    const record = formRecord();
    return ['Sandy Sports Club', (practice ? 'PRACTICE · ' : '') + (noQuorum()?(approved()?'FINALISED NO-QUORUM RECORD':'DRAFT NO-QUORUM RECORD'):informal()?(approved()?'FINALISED CATCH-UP NOTES':'DRAFT CATCH-UP NOTES'):approved()?'APPROVED MINUTES':'DRAFT MINUTES'), record.title, dayLabel(record.date) + ', ' + timeLabel(record.time) + ' AEST', record.location,
      ...(record.approvedAt ? [(informal()?'Notes finalised ':'Approval recorded ')+new Date(record.approvedAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' AEST'] : []),
      ...(formal.summary()?['',informal()?'Catch-up record':'Formal meeting record',formal.summary()]:[]),
      '', 'Meeting notes', record.notes || 'No separate notes recorded.', '', informal()?'Suggestions and referrals':'Other agreed decisions', ...record.decisions.map(d => '• '+d), '', 'Follow-ups',
      ...record.actions.map(a => `[${a.done?'x':' '}] ${a.text} | ${a.owner || 'Owner to confirm'} | ${a.dueDate || 'Date to confirm'}`)].join('\n');
  }
  function calendarHelp(job) {
    modal('Add this job to your calendar', `<p><strong>${esc(job.text)}</strong><br>${esc(job.owner)} · due ${esc(dayLabel(job.dueDate))}</p><ol><li>Choose <strong>Save reminder file</strong> below. Look in Downloads.</li><li>Open the file in Apple Calendar or Outlook and choose Add or Save. In Google Calendar on a computer, choose Settings, then Import &amp; export, then Import.</li><li>Check the due date and choose your alert. The file requests a reminder one day before.</li></ol><button type="button" class="button" id="save-job-calendar">Save reminder file</button><p id="job-calendar-status" role="status"></p>`);
    byId('save-job-calendar').onclick = () => {
      download('sandy-job-'+job.dueDate+'.ics',actionCalendar(job,practice),'text/calendar;charset=utf-8');
      byId('job-calendar-status').textContent = 'Now open Downloads and continue with step 2.';
    };
  }
  function renderSuggestions() {
    const list = byId('desk-suggestion-list');
    list.hidden = practice || approved() || !suggestions.length;
    list.replaceChildren();
    if (list.hidden) return;
    list.innerHTML = '<h4>Suggestions from the notes</h4><p>Read each source quote, then keep or dismiss the suggestion.</p>' + suggestions.map((item,i) => `<article class="desk-ai-item"><strong>${item.kind === 'decision' ? 'Decision' : 'Job'} · ${esc(item.text)}</strong>${item.kind === 'action' ? '<p>'+esc(item.owner || 'Owner to confirm')+' · '+esc(item.dueDate ? dayLabel(item.dueDate) : 'Date to confirm')+'</p>':''}<blockquote>${esc(item.quote)}</blockquote><div class="desk-tools"><button type="button" class="button outline small" data-keep-suggestion="${i}">Add to draft</button><button type="button" class="text-link" data-skip-suggestion="${i}">Dismiss</button></div></article>`).join('');
  }
  async function askAi() {
    if (practice || approved() || pending || !live) return;
    const noteText = notes.value.trim(), message = byId('desk-ai-note');
    if (!noteText || noteText.length > 8000) { message.textContent = 'Use between 1 and 8,000 characters of notes for AI review, or choose Prepare draft minutes.'; return; }
    const id = generation;
    pending = true; desk.inert = true;
    message.textContent = 'Cloudflare AI is reading the selected notes…';
    try {
      const result = await api('/api/meeting/assist',{method:'POST',body:JSON.stringify({notes:noteText})});
      if (id !== generation) return;
      suggestions = (informal()||paused())?result.suggestions.filter(x=>x.kind==='action'):result.suggestions; aiSource = noteText;
      renderSuggestions();
      if (suggestions.length) {
        choose('review');
        note('Read each suggestion and its source quote. Choose Add to draft only when the wording is right.');
      } else {
        message.textContent = 'No supported suggestions were found. Use Prepare draft minutes or enter the agreed items yourself.';
      }
    } catch (error) {
      if (id !== generation) return;
      if (error.status === 401 || error.status === 403) { clearSession(); return; }
      message.textContent = error.status === 429 ? 'Today’s AI allowance has been used. Prepare draft minutes still works here.' : 'AI review could not finish. Choose Prepare draft minutes to continue here.';
    } finally { if (id === generation) { pending = false; desk.inert = false; } }
  }
  function reviewSuggestion(index, keep) {
    if (practice || approved() || !suggestions[index]) return;
    if (aiSource !== notes.value.trim()) {
      suggestions = []; renderSuggestions(); note('The source notes changed. Ask for a new review before using suggestions.'); return;
    }
    const item = suggestions[index];
    if (keep) {
      if(item.kind==='decision' && (paused()||informal())){note('This meeting can record follow-ups here.');return;}
      const record = formRecord();
      if (item.kind === 'decision') {
        if (!record.decisions.some(d => d.toLowerCase()===item.text.toLowerCase())) {
          if (record.decisions.length >= 50) { note('The draft already has 50 decisions.'); return; }
          record.decisions.push(item.text);
        }
      } else if (!record.actions.some(a => a.text.toLowerCase()===item.text.toLowerCase() && a.owner===item.owner && a.dueDate===item.dueDate)) {
        if (record.actions.length >= 50) { note('The draft already has 50 jobs.'); return; }
        record.actions.push({id:crypto.randomUUID(),text:item.text,owner:item.owner,dueDate:item.dueDate,done:false});
      }
      meeting = record; render(); markDirty();
    }
    suggestions.splice(index, 1); renderSuggestions();
    note(keep ? 'Added to the editable draft. Check the record before approving it.' : 'Suggestion dismissed.');
  }
  async function exportCalendar() {
    if (!live || practice) return;
    const id = generation, message = byId('desk-calendar-status');
    try {
      const response = await fetch('/api/meetings/calendar.ics', {cache:'no-store'});
      if (id !== generation) return;
      if (response.status === 401 || response.status === 403) { clearSession(); return; }
      if (!response.ok || !response.headers.get('content-type')?.includes('text/calendar')) throw Error();
      const file = await response.text();
      if (id !== generation) return;
      download('sandy-private-meetings.ics',file,'text/calendar;charset=utf-8');
      message.textContent = 'Find the file in Downloads, then complete steps 2 and 3.';
    } catch { if (id === generation) message.textContent = 'The private calendar could not download. Please try again.'; }
  }
  async function releaseMinutes() {
    if (practice || !live || !approved() || meeting.releasedAt || pending) return;
    const text = byId('desk-release-text').value.trim(), message = byId('desk-release-status');
    if (!text || text.length > 8000) {
      message.textContent = 'Write the approved wording for members, up to 8,000 characters.';
      byId('desk-release-text').focus(); return;
    }
    const id = generation;
    pending = true; desk.inert = true;
    try {
      const result = await api('/api/meetings/'+encodeURIComponent(meeting.id)+'/release',{method:'POST',body:JSON.stringify({text,version:meeting.version})});
      if (id !== generation) return;
      meeting.releasedAt = result.releasedAt; meeting.releasedText = text;
      live = structuredClone(meeting); releaseDrafts.delete(meeting.id); render();
      note('The reviewed copy is now available in the paid member area.');
    } catch (error) {
      if (id !== generation) return;
      if (error.status === 401 || error.status === 403) { clearSession(); return; }
      message.textContent = error.status === 409 ? 'The saved record changed. Load the latest meeting and review the member copy.' : error.message;
      if (error.status === 409) byId('desk-reload').hidden = false;
    } finally { if (id === generation) { pending = false; desk.inert = false; } }
  }
  const createForm = byId('desk-create-form');
  createForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (readOnly || practice || pending || !canSwitch()) return;
    const body = Object.fromEntries(new FormData(createForm));
    const key = JSON.stringify(body);
    if (createAttempt?.key !== key) createAttempt = {key, id:crypto.randomUUID()};
    const id = generation;
    const message = byId('desk-create-message');
    pending = true; desk.inert = true;
    try {
      const result = await api('/api/meetings',{method:'POST',body:JSON.stringify({...body,id:createAttempt.id})});
      if (id !== generation) return;
      const entry = result.meeting;
      register = [...register.filter(item => item.id !== entry.id),entry].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
      createAttempt = null; createForm.reset(); message.textContent = ''; byId('desk-create').open = false;
      await openMeeting(entry.id);window.dispatchEvent(new Event('plfc:meeting-register-changed'));
    } catch (error) {
      if (id !== generation) return;
      if (error.status === 401 || error.status === 403) { clearSession(); return; }
      message.textContent = error.message || 'Could not confirm the meeting. Use the same details to retry.';
    } finally { if (id === generation) { pending = false; desk.inert = false; } }
  });
  byId('desk-picker').addEventListener('change', event => {
    const target = event.target;
    if (!live || practice || pending || !canSwitch()) {
      if (live) target.value = live.id;
      return;
    }
    openMeeting(target.value);
  });
  byId('record-download').addEventListener('click', event => {
    const link = event.target.closest('a[download]');
    if (link) link.dataset.saved = 'true';
  });
  desk.addEventListener('input', event => {
    if (event.target.id === 'desk-release-text' && live && !practice && !meeting.releasedAt) releaseDrafts.set(meeting.id,event.target.value);
    if (event.target.matches('#meeting-notes,#desk-decisions,[data-field]')) markDirty();
  });
  desk.addEventListener('change', async event => {
    const checkbox = event.target.closest('[data-done]');
    if (!checkbox || !approved()) return;
    const record = formRecord();
    const job = record.actions.find(a => a.id === checkbox.dataset.done);
    if (!job) return;
    job.done = checkbox.checked;
    if (!await persist(record)) renderFollow();
  });
  desk.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || !live || pending) return;
    if (button.hasAttribute('data-keep-suggestion')) { reviewSuggestion(Number(button.dataset.keepSuggestion),true); return; }
    if (button.hasAttribute('data-skip-suggestion')) { reviewSuggestion(Number(button.dataset.skipSuggestion),false); return; }
    if (button.dataset.meetingStep || button.dataset.meetingGo) { choose(button.dataset.meetingStep || button.dataset.meetingGo); return; }
    if (button.hasAttribute('data-drop-job')) { button.closest('[data-job]').remove(); markDirty(); return; }
    if (button.dataset.calendarJob && approved()) { calendarHelp(meeting.actions.find(a=>a.id===button.dataset.calendarJob)); return; }
    switch (button.id) {
      case 'desk-ask-ai': await askAi(); break;
      case 'desk-export-calendar': await exportCalendar(); break;
      case 'desk-release-submit': await releaseMinutes(); break;
      case 'prepare-minutes': prepare(); break;
      case 'save-meeting': case 'desk-save-review': await persist(formRecord()); break;
      case 'desk-approve': await persist(formRecord(),true); break;
      case 'desk-add-action': {
        if (byId('desk-edit-actions').children.length >= 50) { note('The meeting can hold up to 50 jobs.'); break; }
        byId('desk-edit-actions').insertAdjacentHTML('beforeend',jobCard({id:crypto.randomUUID(),text:'',owner:'',dueDate:''}));
        byId('desk-edit-actions').lastElementChild.querySelector('input').focus();
        markDirty(); break;
      }
      case 'meeting-practice':
        if (dirty || formal.changed()) { note('Save your meeting notes and agenda changes before opening a practice example.'); choose(dirty?'capture':'agenda'); break; }
        if (!canSwitch()) break;
        enter({...EMPTY(),title:'Practice committee meeting',location:'Example meeting',date:'2026-11-22',time:'10:00',notes:SAMPLE},true); choose('capture'); break;
      case 'desk-exit-practice': enter(live,false); break;
      case 'desk-reload':
        if(formal.changed()&&!window.confirm('Discard the unsaved agenda edits and reload this meeting?'))break;
        await openMeeting(live.id); break;
      case 'export-meeting':
        download((practice?'practice-':'')+'sandy-minutes-'+meeting.date+'.txt',minutesText()); break;
    }
  });
  clearSession();
  return {setSession, clearSession};
}

