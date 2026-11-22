const FORM = 'https://ready-setco.auraofintelligence.workers.dev/join.html';
const FLAGS = {requested:'Awaiting committee review',authorised:'Enquiry authorised',declined:'Declined',withdrawn:'Withdrawn'};
const KINDS = {
  volunteer:{title:'Voluntary help',question:'Would you like the committee to consider your personal opt-in for this voluntary activity?',next:'Describe the activity as voluntary and choose the relevant interest.',href:FORM},
  employment:{title:'Paid work enquiry',question:'Would you like the committee to consider your personal enquiry about paid work?',next:'Choose work or training. The prospective employer separately assesses the role, pay, conditions and suitability. This enquiry is not a job offer.',href:FORM+'?interest=employment'},
  event:{title:'Event coordination',question:'Does the recorded committee decision authorise an enquiry about this part of this event?',next:'Choose community organisation or club. Confirm that you are authorised to enquire for Sandy Sports, then describe the approved event scope.',href:FORM+'?interest=events'},
};
const operator = 'Luke Hayes, trading as Strange But True, operates the initial ready SET Co-op enquiry register.';
const stamp = value => new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const day = value => new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(value+'T12:00:00Z'));

export function setupHandoffs({api,esc}) {
  const member = document.getElementById('member-handoffs');
  const committee = document.getElementById('committee-handoffs');
  let session = null, data = null, generation = 0, requestSeq = 0;
  const attempts = new WeakMap();
  const roots = [member,committee].filter(Boolean);
  const allowed = () => session?.storageReady && ['member','committee'].includes(session.role);
  const readOnly = () => Boolean(session?.readOnly || session?.showcase || session?.demo);
  function clearSession() {
    generation++; session = null; data = null;
    roots.forEach(node => { node.replaceChildren(); node.hidden = true; });
  }
  function row(item, reviewer) {
    const kind = KINDS[item.kind], canEnd = !readOnly() && (reviewer || item.mine) && ['requested','authorised'].includes(item.status);
    const event = item.eventTitle ? `<p>Event: ${esc(item.eventTitle)} · ${esc(day(item.eventDate))}</p>` : '';
    const intake = item.status==='authorised' && item.mine && !readOnly() ? `<div class="handoff-next"><strong>Your next step</strong><p>${esc(kind.next)} You choose what to type and whether to send the partner's form.</p><a href="${kind.href}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open the ready SET Co-op enquiry form</a></div>` : '';
    const review = reviewer && item.status==='requested' && !readOnly() ? `<details><summary>Review this enquiry</summary><p>${esc(kind.question)} Check the scope above and the requester's own consent. Authorisation allows an enquiry only.</p>
      <button class="button small" type="button" data-handoff-action="authorise">Authorise this enquiry</button> <button class="button outline small" type="button" data-handoff-action="decline">Decline this enquiry</button></details>` : '';
    const withdraw = canEnd ? `<details><summary>Withdraw this request or authority</summary><p>Sandy Sports will close this request.${item.kind==='event'?' Related volunteer and paid-work referrals for this event will also close.':''} If anyone separately submitted the partner’s form, they can contact its operator to withdraw there.</p><button type="button" class="button outline small" data-handoff-action="withdraw">Confirm withdrawal</button></details>` : '';
    return `<article class="handoff-record" data-handoff-id="${esc(item.id)}" data-handoff-version="${item.version}"><div class="handoff-title"><strong>${esc(kind.title)}</strong><span>${esc(FLAGS[item.status])}</span></div><p>${esc(item.scope)}</p>${event}
      ${item.kind==='event'?'<p>Approved decision: '+esc(item.motion)+'</p>':''}
      <small>Requested by ${esc(item.owner)} · ${esc(stamp(item.consentAt))} AEST${item.reviewedAt?' · Reviewed by '+esc(item.reviewedBy)+' on '+esc(stamp(item.reviewedAt))+' AEST':''}${item.revokedAt?' · Withdrawn by '+esc(item.revokedBy)+' on '+esc(stamp(item.revokedAt))+' AEST':''}</small>
      ${intake}${review}${withdraw}<p role="status" data-row-status></p></article>`;
  }
  function memberForm() {
    return `<form class="handoff-form stack-form" data-handoff-form="personal"><label>What would you like to discuss?<select name="kind"><option value="volunteer">Voluntary help</option><option value="employment">Paid work</option></select></label>
      <label>Is this for a particular event?<select name="eventId"><option value="">General enquiry</option>${data.events.map(ev=>'<option value="'+esc(ev.id)+'">'+esc(ev.title)+' · '+esc(day(ev.date))+'</option>').join('')}</select></label>
      <label>What help are you offering or seeking?<textarea name="scope" rows="2" maxlength="350" required placeholder="e.g. Help welcome families at the next photo meet"></textarea></label>
      <p class="secondary">Keep this to your own role and availability. Leave contact, identity and payroll details out.</p>
      <div class="handoff-preview" aria-live="polite"></div>
      <label class="checkbox-label"><input name="consent" type="checkbox" required><span data-question></span></label><button type="submit" class="button small">Ask the committee to review</button><p data-form-status role="status"></p></form>`;
  }
  function eventForm() {
    const choices = data.motions.flatMap(block=>block.decisions.map(motion=>({block,motion})));
    if (!choices.length) return '<p>Record an event decision in approved meeting minutes first. Return here and choose Refresh requests to use that decision.</p>';
    return `<form class="handoff-form stack-form" data-handoff-form="event"><input name="kind" type="hidden" value="event"><label>Which approved decision authorises this request?<select name="authority" required><option value="">Choose a decision from a meeting</option>${choices.map(({block,motion},i)=>'<option value="'+i+'" data-meeting="'+esc(block.meetingId)+'" data-motion="'+esc(motion)+'">'+esc(block.title)+' · '+esc(day(block.date))+' · '+esc(motion)+'</option>').join('')}</select></label>
      <div class="field-pair"><label>Approved event title<input name="eventTitle" maxlength="140" required></label><label>Event date<input type="date" name="eventDate" required></label></div>
      <label>Which part of this event?<textarea name="scope" rows="2" maxlength="350" required placeholder="e.g. Coordinate the welcome desk at the community sand sport day"></textarea></label>
      <div class="handoff-preview" aria-live="polite"></div>
      <label class="checkbox-label"><input name="consent" type="checkbox" required><span data-question></span></label><button type="submit" class="button small">Record request for review</button><p data-form-status role="status"></p></form>`;
  }
  function preview(form) {
    const event = form.dataset.handoffForm==='event', kind = KINDS[form.elements.kind.value];
    const eventName = event ? [form.elements.eventTitle.value.trim(), form.elements.eventDate.value && day(form.elements.eventDate.value)].filter(Boolean).join(' · ') : form.elements.eventId.selectedOptions[0]?.textContent;
    form.querySelector('[data-question]').textContent = kind.question;
    const choice = event ? form.elements.authority.selectedOptions[0]?.dataset.motion : '';
    form.querySelector('.handoff-preview').innerHTML = `<strong>What Sandy Sports will record</strong><p>${esc(session.identity?.name || 'Your club account')} · ${esc(kind.title)} · ${esc(eventName||'Event title to confirm')}</p>
     <p>${esc(form.elements.scope.value.trim() || 'Your description will appear here.')}</p>${choice?'<p>Approved decision recorded as “'+esc(choice)+'”</p>':''}
     ${form.elements.kind.value==='employment'?'<p>A prospective employer must assess the job, pay and conditions separately. You decide whether to apply.</p>':''}
     <p>The committee sees this request and its date. You can withdraw it here. The partner receives information only if you later complete their separate form.</p>`;
  }
  function paint() {
    if (!allowed() || !data) return;
    if (member) {
      member.hidden=false;
      member.innerHTML=`<details class="panel handoff-panel"><summary>Volunteering or paid work with ready SET Co-op</summary>
        <p>Ask Sandy Sports to review your own interest. ${operator} The committee still needs to agree any transfer of responsibility.</p>
        ${readOnly()?'':memberForm()}<h3>Your requests</h3>${data.mine.length ? data.mine.map(item=>row(item,false)).join('') : '<p>No requests yet.</p>'}
        <button type="button" class="text-link" data-handoff-refresh>Refresh requests</button><p data-load-status role="status"></p></details>`;
    }
    if (committee && session.role==='committee') {
      committee.hidden=false;
      committee.innerHTML=`<details class="panel handoff-panel"><summary>ready SET Co-op requests and event authority</summary>
        <div class="button-row"><a class="button outline small" href="https://ready-setco.auraofintelligence.workers.dev/index.html" target="_blank" rel="noopener noreferrer">Visit the ready SET Co-op website</a>
          <a class="button outline small" href="https://auraofintelligence.github.io/minjerribah-screen-media-network/network/" target="_blank" rel="noopener noreferrer">Open the Minjerribah Screen Media Network</a></div>
        <p>Explore the media network when planning event coverage, photos or video. The committee signs off separately before club material is shared. Both links open in a new tab.</p>
        <p>Review individual opt-ins and the exact part of an event the committee has authorised. ${operator} An operating agreement and any future transfer to the cooperative need separate sign-off.</p>
        ${readOnly()?'':'<details><summary>Propose event coordination</summary>'+eventForm()+'</details>'}
        <h3>Committee review register</h3>${data.queue.length ? data.queue.map(item=>row(item,true)).join('') : '<p>No requests for review yet.</p>'}
        <button type="button" class="text-link" data-handoff-refresh>Refresh requests</button><p data-load-status role="status"></p></details>`;
    }
    roots.forEach(root=>root.querySelectorAll('[data-handoff-form]').forEach(preview));
  }
  async function refresh(keepOpen=false) {
    if (!allowed()) return;
    const id=generation, seq=++requestSeq;
    const opened=roots.map(root=>keepOpen && root.querySelector('details')?.open);
    try {
      const listing=await api('/api/handoffs');
      if (id!==generation || seq!==requestSeq) return;
      data=listing;paint();
      roots.forEach((root,i)=>{if(opened[i] && root.querySelector('details'))root.querySelector('details').open=true;});
    } catch (e) {
      if (id!==generation || seq!==requestSeq) return;
      if(e.status===401||e.status===403){clearSession();return;}
      for(const root of roots) {
        if(root===committee && session.role!=='committee')continue;
        root.hidden=false;
        if(!root.querySelector('[data-load-status]')) root.innerHTML='<div class="panel handoff-panel"><p data-load-status role="status"></p><button type="button" class="text-link" data-handoff-refresh>Try ready SET Co-op requests again</button></div>';
        root.querySelector('[data-load-status]').textContent='The private request register could not load.';
      }
    }
  }
  async function submit(form) {
    if(readOnly())return;
    const id=generation, body=Object.fromEntries(new FormData(form)), event=body.kind==='event';
    if(event){
      const choice=form.elements.authority.selectedOptions[0];body.meetingId=choice.dataset.meeting;body.motion=choice.dataset.motion;
      delete body.authority;
    }
    body.consent=form.elements.consent.checked;body.consentVersion=data.consentVersion;
    const previous=attempts.get(form),key=JSON.stringify(body);
    body.id=previous?.key===key ? previous.id : crypto.randomUUID();
    attempts.set(form,{key,id:body.id});
    const button=form.querySelector('[type=submit]'),status=form.querySelector('[data-form-status]');
    button.disabled=true;
    try {await api('/api/handoffs',{method:'POST',body:JSON.stringify(body)});if(id===generation)await refresh(true);}
    catch(e){if(id===generation){if(e.status===401||e.status===403)clearSession();else status.textContent=e.message;}}
    finally{button.disabled=false;}
  }
  for(const root of roots) {
    root.addEventListener('input',e=>{
      const form=e.target.closest('[data-handoff-form]');if(!form || !allowed())return;
      if(e.target!==form.elements.consent)form.elements.consent.checked=false;
      preview(form);
    });
    root.addEventListener('submit',e=>{const form=e.target.closest('[data-handoff-form]');if(form){e.preventDefault();if(allowed()&&!readOnly())submit(form);}});
    root.addEventListener('click',async e=>{
      const button=e.target.closest('button');if(!button || !allowed())return;
      if(button.hasAttribute('data-handoff-refresh')){await refresh(true);return;}
      const action=button.dataset.handoffAction;if(!action||readOnly())return;
      const item=button.closest('[data-handoff-id]'),id=generation;item.inert=true;
      try {
        await api('/api/handoffs/'+encodeURIComponent(item.dataset.handoffId),{method:'POST',body:JSON.stringify({action,version:Number(item.dataset.handoffVersion),confirm:true})});
        if(id===generation)await refresh(true);
      }catch(error){if(id===generation){if(error.status===401||error.status===403)clearSession();else item.querySelector('[data-row-status]').textContent=error.message;}}
      finally{item.inert=false;}
    });
  }
  return {clearSession,setSession(next){clearSession();session=next;if(allowed())return refresh();}};
}

