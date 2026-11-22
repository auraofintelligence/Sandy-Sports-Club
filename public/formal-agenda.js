import {holidayWindow} from './school-holidays.js';

const types = {informal:'Informal catch-up',committee:'Management committee meeting',general:'General meeting',agm:'Annual general meeting',special:'Special general meeting'};
const results = {pending:'Awaiting decision',carried:'Carried',lost:'Lost',deferred:'Deferred',withdrawn:'Withdrawn'};
const quorumLabels={unchecked:'Not checked',present:'Quorum present',absent:'No quorum at opening',lost:'Quorum lost during the meeting'};
const emptyItem = title => ({title,notes:'',motions:[]});
const emptyMotion = () => ({text:'',movedBy:'',secondedBy:'',outcome:'pending',vote:''});
const fields = [
  ['chair','Chair'],['minuteTaker','Minute taker'],['openedAt','Time opened'],['attendance','Present'],
  ['apologies','Apologies'],['quorum','Quorum check'],['conflicts','Declared interests and how they were handled'],
  ['nextMeeting','Next meeting'],['closedAt','Time closed']
];
const pathFor = id => '/api/meetings/'+encodeURIComponent(id)+'/agenda';
const key = value => value.trim().toLowerCase();

function agendaWithOrder(old, headings) {
  const spare = [...old], ordered = [];
  for (const title of headings) {
    const index = spare.findIndex(item => key(item.title)===key(title));
    ordered.push(index===-1 ? emptyItem(title) : spare.splice(index,1)[0]);
  }
  const close = ordered.findIndex(item => /next meeting|close|closure/i.test(item.title));
  ordered.splice(close===-1?ordered.length:close,0,...spare);
  return ordered;
}

export function formatFormalMinutes(agenda) {
  if (!agenda) return '';
  const lines = [types[agenda.kind] || 'Meeting'];
  if(agenda.kind!=='informal' && agenda.quorumStatus && agenda.quorumStatus!=='unchecked')lines.push('Quorum · '+quorumLabels[agenda.quorumStatus]);
  if(agenda.adjournment)lines.push('Adjournment or lapse · '+agenda.adjournment);
  for (const [field,label] of fields) if (agenda[field]) lines.push((agenda.kind==='informal' && field==='chair'?'Host':agenda.kind==='informal' && field==='minuteTaker'?'Notes taken by':label)+' · '+agenda[field]);
  agenda.items.forEach((item,index) => {
    lines.push('',(index+1)+'. '+item.title);
    if (item.notes) lines.push(item.notes);
    item.motions.forEach((motion,i) => {
      lines.push('Motion '+(index+1)+'.'+(i+1)+' · '+motion.text);
      if (motion.movedBy) lines.push('Moved by '+motion.movedBy);
      if (motion.secondedBy) lines.push('Seconded by '+motion.secondedBy);
      lines.push('Outcome · '+results[motion.outcome]);
      if (motion.vote) lines.push('Voting record · '+motion.vote);
    });
  });
  return lines.join('\n');
}

function chairCue(title,kind) {
  const t = key(title);
  if (t.includes('school holiday')) return 'Discuss pressure on jetties, parking, the hotel and wildlife during school holidays. Pick a quieter date or place if a local meet would add to the pressure.';
  if (kind==='informal') {
    if(t.includes('hotel'))return 'Invite the hotel team to explain what works for them and what they would like the club to consider.';
    if(t.includes('meet'))return 'Start with local members and families. Ask what would make small local meets or friendly invitationals work well.';
    if(t.includes('follow-up')||t.includes('next contact'))return 'Read back suggestions, name a contact for each follow-up and agree what to take to the committee.';
    return 'Invite each person’s view. Note suggestions and any follow-up someone volunteers to take on.';
  }
  if (/apolog|attend|quorum/.test(t)) return 'Record who is present, who has apologised and whether enough eligible people are present to conduct business.';
  if (/interest|conflict/.test(t)) return 'Invite declarations for the business ahead. Record the interest, how it was managed and any changes in attendance.';
  if (/previous.*minutes|confirm.*minutes|minutes of/.test(t)) return 'Invite corrections before asking the meeting to confirm the previous minutes as an accurate record.';
  if (/arising|outstanding|follow.up/.test(t)) return 'Work through the previous action list. Record what is complete and who will take the remaining work.';
  if (/correspondence/.test(t)) return 'Present incoming and outgoing correspondence. Put any decision or reply the meeting needs to agree on into the record.';
  if (/remuneration/.test(t)) return 'Disclose the required remuneration and benefits, including a nil disclosure where applicable. Minute the disclosure.';
  if (/appoint.*audit/.test(t)) return 'Check whether an auditor, accountant or verifier is required. Record the agreed appointment where applicable.';
  if (/treasur|accounts/.test(t)) return 'Invite the Treasurer to present the accounts. Record any payments approved or ratified, and any follow-up questions.';
  if (/report|financial|audit/.test(t)) return 'Invite the report, take questions and record what the meeting receives or resolves.';
  if (/elect/.test(t)) return 'Check eligible nominations for each office, follow the applicable election procedure and record the declared result for each position.';
  if (/notice|special resolution/.test(t)) return 'Use the business and exact resolution wording given in the meeting notice. Check the applicable voting requirements.';
  if (/close|closure|next meeting/.test(t)) return 'Read back the decisions and jobs. Record the next arrangements and the time the chair closes the meeting.';
  if (/read back/.test(t)) return 'Read each resolution and its declared outcome aloud. Confirm who has agreed to each job and its due date.';
  if (/open|welcome|chair/.test(t)) return 'The chair calls the meeting to order and states its purpose. Record the actual opening time.';
  return 'Introduce the item, invite speakers through the chair and record the outcome. If a motion is put, record its wording and the chair’s declared result.';
}

export function setupFormalAgenda({api,esc,clearSession,onSaved,onChange}) {
  const root = document.getElementById('formal-agenda'), summary = document.getElementById('desk-formal-summary');
  let meeting=null, data=null, working=null, locked=false, dirty=false, saving=false, editing=false, conflict=false, generation=0;
  let openIndex=null, rollOpen=false, rulesOpen=false;
  const changed = () => dirty || saving;
  const savedAgenda = () => data && (data.version>0 || data.legacy) ? data.agenda : null;
  const message = (value,alert=false) => {
    const el=root.querySelector('[data-agenda-status]');
    if(el){el.setAttribute('role',alert?'alert':'status');el.textContent=value;}
  };
  function mark() {
    if (locked || !working) return;
    if (!dirty) {dirty=true; onChange?.();}
    updateControls(); message('Changes ready to save.');
  }
  function updateControls() {
    const save=root.querySelector('[data-agenda-save]'), print=root.querySelector('[data-print-formal-agenda]');
    if(save)save.disabled=saving||conflict||!dirty;
    if(print){print.disabled=saving||!working?.items.length;print.textContent=dirty?'Print draft agenda / save PDF':'Print agenda / save PDF';}
  }
  function renderSummary() {
    const saved=savedAgenda();
    summary.hidden=!saved;
    summary.innerHTML=saved?'<summary>'+ (saved.kind==='informal'?'Read the saved catch-up record':'Read the saved formal meeting record')+'</summary><p class="formal-minute-copy">'+esc(formatFormalMinutes(saved))+'</p>':'';
  }
  function reset() {
    generation++;meeting=null;data=null;working=null;locked=false;dirty=false;saving=false;editing=false;conflict=false;
    openIndex=null;rollOpen=rulesOpen=false;root.inert=false;root.replaceChildren();renderSummary();
  }
  function input(name,label,value,attributes='',area=false,scope='data-agenda-field') {
    return '<label>'+label+(area?'<textarea '+scope+'="'+name+'" '+attributes+' rows="2">'+esc(value)+'</textarea>':'<input '+scope+'="'+name+'" '+attributes+' value="'+esc(value)+'">')+'</label>';
  }
  function quorumPanel() {
    const a=working, status=a.quorumStatus||'unchecked';
    if(a.kind==='informal')return '';
    const instruction=a.kind==='committee'
      ? 'Count the elected committee members present. A quorum is more than half the number elected at the close of the last general meeting.'
      : 'Count one more than the number of committee members at the close of the last general meeting. If every club member is on the committee, count the total membership minus one (rule 36).';
    const stalled=status==='absent'||status==='lost';
    let next='';
    if(status==='absent')next=a.kind==='committee'
      ? 'Wait 30 minutes from the scheduled start. A meeting called at committee members’ request lapses. Otherwise those present choose a day, time and place at least one day later. An adjourned committee meeting lapses if it still lacks a quorum 30 minutes after its start.'
      : 'Allow 30 minutes from the scheduled start. A meeting called at members’ request lapses. Otherwise adjourn for at least seven days. The committee sets the day, time and place. Give fresh notice if the adjournment is for 30 days or more.';
    if(status==='lost')next='Pause votes and new decisions. Record when quorum was lost, any departures and whether quorum returned or the meeting adjourned.';
    return '<section class="agenda-quorum"><label>Quorum status<select data-agenda-field="quorumStatus" '+(locked?'disabled':'')+'>'+Object.entries(quorumLabels).map(([v,label])=>'<option value="'+v+'" '+(status===v?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
      '<p>'+instruction+'</p>'+(stalled?'<div class="quorum-next"><strong>'+(status==='absent'?'Record the attempt and next steps':'Business paused')+'</strong><p>'+next+'</p>'+
      input('adjournment','What happened and what happens next?',a.adjournment||'','maxlength="1000" placeholder="Time checked, who was present, decision to adjourn or lapse, and who arranges the next notice" '+(locked?'disabled':''),true)+'</div>':a.adjournment?input('adjournment','Earlier adjournment or loss of quorum',a.adjournment,'maxlength="1000" '+(locked?'disabled':''),true):'')+'</section>';
  }
  function roll() {
    const a=working, casual=a.kind==='informal';
    return '<details class="formal-roll" data-roll '+(rollOpen?'open':'')+'><summary>Attendance and meeting details</summary><div class="formal-fields">'+
      '<div class="field-pair">'+input('chair',casual?'Who is hosting?':'Who is chairing?',a.chair,'maxlength="140"')+input('minuteTaker',casual?'Who is taking notes?':'Who is taking minutes?',a.minuteTaker,'maxlength="140"')+'</div>'+
      '<div class="field-pair">'+input('attendance','Present, including any guests',a.attendance,'maxlength="2000"',true)+input('apologies','Apologies received',a.apologies,'maxlength="2000"',true)+'</div>'+
      (casual?'':input('quorum','Quorum check and any changes during the meeting',a.quorum,'maxlength="500" placeholder="e.g. eligible members present, number required and time checked"',true)+
      input('conflicts','Declared interests and how they were handled',a.conflicts,'maxlength="2000"',true))+
      '<div class="field-pair">'+input('openedAt','Time opened (Brisbane)',a.openedAt,'type="time"')+input('closedAt','Time closed (Brisbane)',a.closedAt,'type="time"')+'</div>'+
      input('nextMeeting',casual?'Next catch-up or point of contact':'Next meeting arrangements',a.nextMeeting,'maxlength="500"')+'</div></details>';
  }
  function motionEditor(m,index) {
    const s='data-motion-field',q=working.quorumStatus||'unchecked', frozen=q==='lost'&&['carried','lost'].includes(m.outcome);
    return '<fieldset class="agenda-motion" data-motion="'+index+'" '+(frozen?'disabled':'')+'><legend>Motion '+(index+1)+'</legend>'+
      input('text','Exact wording put to the meeting',m.text,'maxlength="2000" placeholder="That the club …"',true,s)+
      '<div class="field-pair">'+input('movedBy','Moved by',m.movedBy,'maxlength="140"',false,s)+input('secondedBy','Seconded by, if applicable',m.secondedBy,'maxlength="140"',false,s)+'</div>'+
      '<label>Outcome declared by the chair<select data-motion-field="outcome">'+Object.entries(results).map(([k,v])=>'<option value="'+k+'" '+(m.outcome===k?'selected':'')+' '+(q!=='present'&&['carried','lost'].includes(k)&&k!==m.outcome?'disabled':'')+'>'+v+'</option>').join('')+'</select></label>'+
      input('vote','Voting record, including any count or abstentions',m.vote,'maxlength="500"',true,s)+
      (locked?'':'<button type="button" class="text-link" data-remove-motion>Remove motion</button>')+'</fieldset>';
  }
  function itemCard(item,i) {
    const title=esc(item.title||'Untitled item'),casual=working.kind==='informal';
    const holiday=/school holiday/i.test(item.title)?holidayWindow(meeting.date):null;
    return '<li data-agenda-item="'+i+'"><details '+(openIndex===i?'open':'')+' data-item-detail><summary><span class="formal-number" aria-hidden="true">'+(i+1)+'</span><span>'+title+'</span></summary>'+
      '<div class="agenda-item-body"><p class="chair-cue">'+esc(chairCue(item.title,working.kind))+'</p>'+(holiday?'<p class="agenda-holiday">'+esc(holiday.label)+' · <a class="text-link" href="'+esc(holiday.source)+'" target="_blank" rel="noopener">Queensland school dates</a></p>':'')+
      input('notes',casual?'Discussion, actions or recommendations':'Discussion and outcome',item.notes,'maxlength="3500"',true,'data-item-field')+
      item.motions.map(motionEditor).join('')+
      '<div class="desk-tools">'+(locked||casual||['absent','lost'].includes(working.quorumStatus)?'':'<button type="button" class="button outline small" data-add-motion>Add a motion</button>')+
      (i+1<working.items.length?'<button type="button" class="text-link" data-next-item>Next agenda item</button>':'')+'</div></div></details></li>';
  }
  function orderEditor() {
    return '<section class="formal-order-editor"><h4>Edit the order of business</h4>'+
      '<label>Type of meeting<select data-meeting-kind '+(data.fixedKind?'disabled':'')+'>'+Object.entries(types).map(([k,v])=>'<option value="'+k+'" '+(working.kind===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
      '<button type="button" class="text-link" data-apply-order>Use the suggested order for this meeting type</button><p class="secondary">Any extra items and notes you have entered stay on the agenda.</p>'+
      '<ol class="formal-edit-rows">'+working.items.map((item,i)=>'<li data-agenda-item="'+i+'"><label>Item '+(i+1)+'<input data-item-field="title" value="'+esc(item.title)+'" maxlength="'+Math.max(200,item.title.length)+'"></label><div class="agenda-edit-tools">'+
        '<button type="button" class="text-link" data-shift="-1" aria-label="Move item '+(i+1)+' up" '+(i===0?'disabled':'')+'>Move up</button>'+
        '<button type="button" class="text-link" data-shift="1" aria-label="Move item '+(i+1)+' down" '+(i===working.items.length-1?'disabled':'')+'>Move down</button>'+
        '<button type="button" class="text-link" data-remove-item aria-label="Remove item '+(i+1)+'">Remove</button></div></li>').join('')+'</ol>'+
      '<button type="button" class="button outline small" data-add-item>Add agenda item</button>'+
      '<details class="agenda-topics"><summary>Ideas for local club business</summary><p>Choose an item if the chair intends to take it at this meeting.</p>'+
      ['Next local fishing meet','Club merchandise and stock','Volunteers for the next club event','Proposed sponsorship arrangements'].map(title=>'<button type="button" class="text-link" data-add-topic="'+esc(title)+'">'+esc(title)+'</button>').join('')+'</details></section>';
  }
  function draw(status='') {
    const a=working;
    if(!a)return;
    root.innerHTML='<div class="formal-heading"><div><p class="formal-kind">'+esc(types[a.kind])+'</p><h3 tabindex="-1">'+(a.kind==='informal'?'Catch-up agenda':'Order of business')+'</h3></div>'+
      '<button class="button outline small" data-print-formal-agenda type="button">Print agenda / save PDF</button></div>'+
      (data.legacy&&!locked?'<p class="agenda-legacy">This meeting has a previously saved agenda. Choose Edit order of business to keep its topics and add the suggested order.</p>':'')+
      (locked&&!a.items.length?'<p>No agenda was recorded for this finalised meeting.</p>':
      '<p class="formal-intro">'+(locked?'Open an item to read the saved record.':a.kind==='informal'?'Use this catch-up to hear ideas and agree follow-ups. Take proposals that need a club decision to a separately called committee meeting.':'Open each item as the chair reaches it. Record who attended, any motions put and the result the chair declares.')+'</p>'+
      quorumPanel()+guidance(a.kind,rulesOpen)+
      '<fieldset class="formal-body" '+(locked?'disabled':'')+'>'+roll()+'</fieldset>'+
      (locked?'':'<button type="button" data-edit-order class="text-link">'+(editing?'Return to chair’s running order':'Edit order of business')+'</button>')+
      (editing?orderEditor():'<ol class="formal-running-order">'+a.items.map(itemCard).join('')+'</ol>'))+
      '<div class="formal-save">'+(locked?'': '<button type="button" data-agenda-save class="button">Save agenda and meeting record</button>')+
      '<p role="status" data-agenda-status></p></div>'+(conflict?'<button type="button" class="text-link" data-reload-agenda>Discard my edits and open the saved agenda</button>':'');
    if(locked)root.querySelectorAll('[data-item-field],[data-motion-field]').forEach(el=>el.disabled=true);
    updateControls();message(status);
  }
  async function load(record) {
    reset();meeting=record;
    const ticket=generation;
    root.innerHTML='<p role="status">Opening the meeting agenda…</p>';
    try {
      const answer=await api(pathFor(record.id),{cache:'no-store'});
      if(ticket!==generation)return;
      data=answer;working=structuredClone(answer.agenda);locked=answer.locked||record.status==='approved';draw();renderSummary();onChange?.();
    } catch(e) {
      if(ticket!==generation)return;
      if(e.status===401||e.status===403){clearSession();return;}
      root.innerHTML='<p role="alert">'+esc(e.message)+'</p><button class="text-link" type="button" data-reload-agenda>Try opening the agenda again</button>';
    }
  }
  async function save() {
    if(!dirty||locked||saving||conflict)return;
    if(!working.items.length){editing=true;draw('Add at least one item before saving the agenda.');root.querySelector('[data-add-item]').focus();return;}
    const invalid=working.items.findIndex(item=>!item.title.trim()||item.motions.some(m=>!m.text.trim()));
    if(invalid!==-1){
      editing=!working.items[invalid].title.trim();openIndex=invalid;draw(editing?'Give the new agenda item a title before saving.':'Enter the wording of the motion, or remove the empty motion.');
      root.querySelector('[data-agenda-item="'+invalid+'"] '+(editing?'[data-item-field="title"]':'[data-motion-field="text"]'))?.focus();return;
    }
    const ticket=generation;saving=true;root.inert=true;message('Saving the agenda and meeting record…');updateControls();
    try {
      const answer=await api(pathFor(meeting.id),{method:'PUT',body:JSON.stringify({version:data.version,agenda:working})});
      if(ticket!==generation)return;
      data=answer;working=structuredClone(answer.agenda);locked=answer.locked;dirty=conflict=false;
      draw('Saved to this meeting.');renderSummary();onSaved?.(meeting.id);
    } catch(e) {
      if(ticket!==generation)return;
      if(e.status===401||e.status===403){clearSession();return;}
      if(e.status===409)conflict=true;
      draw(e.message);
    } finally {
      if(ticket===generation){saving=false;root.inert=false;updateControls();}
    }
  }
  root.addEventListener('input',e=>{
    if(!working||locked||saving)return;
    const el=e.target, row=el.closest('[data-agenda-item]'), motion=el.closest('[data-motion]');
    if(el.dataset.agendaField==='quorumStatus')return;
    if(el.dataset.agendaField)working[el.dataset.agendaField]=el.value;
    else if(el.dataset.itemField)working.items[Number(row.dataset.agendaItem)][el.dataset.itemField]=el.value;
    else if(el.dataset.motionField)working.items[Number(row.dataset.agendaItem)].motions[Number(motion.dataset.motion)][el.dataset.motionField]=el.value;
    else return;
    mark();
  });
  root.addEventListener('change',e=>{
    if(!working||locked)return;
    if(e.target.dataset.agendaField==='quorumStatus'){
      const q=e.target.value,old=working.quorumStatus||'unchecked';
      const votes=a=>a.items.flatMap(it=>it.motions.filter(m=>m.outcome==='carried'||m.outcome==='lost'));
      if((q==='absent'||q==='unchecked')&&votes(working).length){e.target.value=old;message('This record includes votes. Choose Quorum lost if enough people were present for those votes and left later.',true);return;}
      if(q==='lost' && JSON.stringify(votes(working))!==JSON.stringify(votes(data.agenda))){e.target.value=old;message('Save the business conducted with a quorum first. Then record when quorum was lost.',true);return;}
      working.quorumStatus=q;mark();draw('Changes ready to save.');root.querySelector('[data-agenda-field="quorumStatus"]').focus();return;
    }
    if(!e.target.matches('[data-meeting-kind]'))return;
    const old=working.kind,kind=e.target.value, prior=data.templates[old]||[];
    const pristine=working.items.length===prior.length && working.items.every((it,i)=>it.title===prior[i]&&!it.notes&&!it.motions.length);
    if(kind==='informal' && (working.quorum||working.conflicts||working.adjournment||['present','absent','lost'].includes(working.quorumStatus)||working.items.some(item=>item.motions.length))){e.target.value=old;message('This meeting already has formal proceedings. Schedule a separate informal catch-up.',true);return;}
    working.kind=kind;
    if(pristine)working.items=data.templates[kind].map(emptyItem);
    mark();draw(pristine?'The suggested order is ready. Save when you have finished.':'Meeting type changed. Your existing items were kept.');root.querySelector('[data-meeting-kind]').focus();
  });
  root.addEventListener('toggle',e=>{
    const el=e.target;
    if(el.matches('[data-roll]'))rollOpen=el.open;
    if(el.matches('[data-chair-guide]'))rulesOpen=el.open;
    if(el.matches('[data-item-detail]')&&el.open){
      openIndex=Number(el.parentElement.dataset.agendaItem);
      root.querySelectorAll('[data-item-detail][open]').forEach(other=>{if(other!==el)other.open=false;});
    }
  },true);
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||saving)return;
    if(b.hasAttribute('data-reload-agenda')){
      if(!dirty||window.confirm('Discard these unsaved agenda changes and open the saved version?'))load(meeting);return;
    }
    if(!working)return;
    const i=Number(b.closest('[data-agenda-item]')?.dataset.agendaItem);
    if(b.hasAttribute('data-next-item')){
      const next=root.querySelector('[data-agenda-item="'+(i+1)+'"] details');if(next){next.open=true;next.querySelector('summary').focus();}return;
    }
    if(b.hasAttribute('data-print-formal-agenda')){
      window.dispatchEvent(new CustomEvent('plfc:print-agenda',{detail:{title:meeting.title,date:meeting.date,time:meeting.time,location:meeting.location,meetingType:working.kind,draft:dirty,items:working.items.map(({title})=>({title:title.trim()||'Untitled agenda item'}))}}));return;
    }
    if(locked)return;
    if(b.hasAttribute('data-agenda-save')){save();return;}
    if(b.hasAttribute('data-edit-order')){editing=!editing;draw(dirty?'Changes ready to save.':'');root.querySelector('[data-edit-order]').focus();return;}
    let focus;
    if(b.hasAttribute('data-add-item')||b.hasAttribute('data-add-topic')){
      const index=b.hasAttribute('data-add-topic')?working.items.findIndex(item=>/next meeting|close|closure/i.test(item.title)):-1;
      const pos=index<0?working.items.length:index;
      working.items.splice(pos,0,emptyItem(b.dataset.addTopic||''));
      focus='[data-agenda-item="'+pos+'"] input';
    } else if(b.hasAttribute('data-apply-order')){
      working.items=agendaWithOrder(working.items,data.templates[working.kind]);focus='[data-apply-order]';
    } else if(b.hasAttribute('data-shift')){
      const target=i+Number(b.dataset.shift);
      if(target<0||target>=working.items.length)return;
      const item=working.items.splice(i,1)[0];working.items.splice(target,0,item);focus='[data-agenda-item="'+target+'"] input';
    } else if(b.hasAttribute('data-remove-item')){
      if(!window.confirm('Remove this agenda item and any notes or motions recorded under it?'))return;
      working.items.splice(i,1);openIndex=null;focus='[data-add-item]';
    } else if(b.hasAttribute('data-add-motion')){
      working.items[i].motions.push(emptyMotion());openIndex=i;focus='[data-agenda-item="'+i+'"] [data-motion="'+(working.items[i].motions.length-1)+'"] [data-motion-field="text"]';
    } else if(b.hasAttribute('data-remove-motion')){
      const n=Number(b.closest('[data-motion]').dataset.motion);
      if(working.items[i].motions[n].text&&!window.confirm('Remove this motion from the agenda item?'))return;
      working.items[i].motions.splice(n,1);openIndex=i;focus='[data-agenda-item="'+i+'"] [data-add-motion]';
    } else return;
    mark();draw('Changes ready to save.');root.querySelector(focus)?.focus();
  });
  return {reset,open:load,changed,savedAgenda,kind:()=>data?.agenda.kind,
    substantive:()=>{const a=savedAgenda();return Boolean(a&&(a.openedAt||a.closedAt||a.attendance||a.adjournment||a.items.some(item=>item.notes||item.motions.some(m=>m.text&&m.outcome!=='pending'))));},
    carried:()=>savedAgenda()?.items.flatMap(i=>i.motions.filter(m=>m.outcome==='carried').map(m=>m.text))||[],
    quorumStatus:()=>data?.agenda.quorumStatus,version:()=>data?.version,
    setApproved(value){if(value&&!locked&&working){locked=true;draw();}},
    summary:()=>savedAgenda()?formatFormalMinutes(savedAgenda()):''};
}

function guidance(kind,open) {
  const entry={
    committee:[
      'Before business', 'Check notice was given in the manner the committee decided. The President chairs. If there is no President, or the President is absent ten minutes after the appointed time, the committee members present choose a chair from among themselves.',
      'Check the quorum', 'More than half the committee members elected at the close of the last general meeting must be present. Count eligible real-time participants and identify guests separately. Check again if someone leaves.',
      'Put a motion', 'State the exact proposal, invite discussion through the chair, then put the question. Record the votes and the declared outcome. A majority of committee members present decides the question. An equal vote fails. Guests do not vote.',
      'Record interests and minutes', 'Record a material personal interest and how it was handled, including withdrawal from discussion or voting. Check any permission to participate against the applicable rules. The chair of this or the next committee meeting signs the minutes. See club rules 23 to 26.'
    ],
    general:[
      'Before the meeting', 'Check that each member received at least 14 days’ notice and that the notice described the business. Check the quorum under rule 36 and voting eligibility against the registered rules.',
      'From the chair', 'Use the notified business. Declare each result and record it. The rules prohibit proxy voting. Rules 5 and 38 contain different voting provisions. Confirm the applicable voting procedure before declaring a result. See club rules 35 to 40.'
    ],
    agm:[
      'Prepare the annual business', 'Give members at least 14 days’ notice with the business to be considered. Check attendance and quorum. Have the previous AGM minutes, financial statements and applicable audit or verification report available.',
      'Follow the annual order', 'Present the reports, disclose remuneration and benefits including a nil disclosure, and record adoption, elections and any required appointment. Confirm the applicable voting rules before declaring results. See the annual and general meeting rules in the constitution.'
    ],
    special:[
      'Use the meeting notice', 'Check the notice, quorum and the precise business for which the meeting was called. Read out the resolution as notified. Confirm the threshold and eligible voters for that resolution before taking the vote.',
      'Record the outcome', 'Record the wording, declared result and next action for each notified item. Put additional proposals forward for a separately convened meeting.'
    ],
    informal:['Guide the conversation','Welcome the group, invite each person to speak, note the suggestions and agree who will follow up. Refer proposals needing club authority to a formal meeting.']
  }[kind]||[];
  const body=entry.filter((v,i)=>i%2===0).map((heading,i)=>'<p><strong>'+heading+'</strong><br>'+entry[2*i+1]+'</p>').join('');
  return '<details class="formal-guidance" data-chair-guide '+(open?'open':'')+'><summary>'+(kind==='informal'?'Host’s guide to this catch-up':'Chair’s guide for this meeting')+'</summary><div>'+body+(kind==='informal'?'':'<a class="text-link" href="/constitution.pdf" target="_blank" rel="noopener">Read the club constitution</a> · <a class="text-link" href="https://www.qld.gov.au/community/fair-trading/associations-charities-and-non-for-profits/incorporated-associations/running-an-incorporated-association/meetings-for-associations/meeting-procedures" target="_blank" rel="noopener">Queensland meeting procedures</a>')+'</div></details>';
}
