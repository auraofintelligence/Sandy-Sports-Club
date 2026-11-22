const channels={email:'Email with agenda · 7 days before',chat:'Club chat · 1 hour before'};
const when=seconds=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(seconds*1000))+' AEST';

export function setupMeetingReminders({api,esc,clearSession,unsaved,meetingKind}) {
  const root=document.getElementById('desk-reminders');
  let meeting=null, view=null, revision=0, nextChange=null;
  function reset() {
    clearTimeout(nextChange);
    revision++;meeting=null;view=null;root.replaceChildren();root.hidden=true;
  }
  function render(expand=false) {
    root.hidden=false;
    if(!view) {
      root.innerHTML='<p role="status">The reminder schedule could not load.</p><button class="text-link" type="button" data-refresh-reminders>Try the reminder schedule again</button>';
      return;
    }
    const active=view.reminders.filter(item=>channels[item.channel] && (item.state==='scheduled'||item.state==='ready'));
    const past=view.reminders.filter(item=>item.state==='reviewed'||(channels[item.channel] && item.state==='elapsed'));
    const available=active.filter(item=>item.state==='ready').length;
    const cards=active.map(item=>`<article class="desk-reminder"><strong>${esc(channels[item.channel])}</strong>
      ${item.state==='ready' ? `<p>Draft ready for review until ${esc(when(item.expiresAt))}.</p>
      <details><summary>Read the draft</summary><p class="reminder-text">${esc(item.text)}</p></details>
      <button class="button outline small" type="button" data-review-reminder="${esc(item.channel)}">Mark as reviewed</button>`
      : `<p>Draft available to review from ${esc(when(item.dueAt))}.</p>`}
      </article>`).join('');
    const history=past.length ? `<details class="desk-original"><summary>Reminder history · ${past.length}</summary>${past.map(item=>`
      <article class="desk-reminder"><strong>${esc(item.channel==='sms'?'SMS reminder':channels[item.channel])}</strong>
        <p>${item.state==='reviewed' ? (item.exampleReview?'Example reviewed by ':'Reviewed by ')+esc(item.reviewedBy||'a committee officer')+(item.reviewedAt?' on '+esc(when(item.reviewedAt)):'')+'.'
        :'Review window ended '+esc(when(item.expiresAt))+'. No review was recorded.'}</p>
        ${item.text?'<details><summary>Read the reviewed message</summary><p class="reminder-text">'+esc(item.text)+'</p></details>':''}
      </article>`).join('')}</details>` : '';
    const sampleTimings=(view.examples||[]).filter(item=>channels[item.channel]);
    const examples=sampleTimings.length ? `<details class="desk-original"><summary>Example reminder timing</summary>
      <p>The hotel catch-up was added after the usual email date. This example has no action due.</p>
      <ul>${sampleTimings.map(item=>'<li>'+esc(channels[item.channel])+'</li>').join('')}</ul></details>` : '';
    const notice=['general','agm','special'].includes(meetingKind())?'<p>For a general meeting, the club rules require at least 14 days’ notice to members. Issue the formal notice with the business to be considered before these reminder dates.</p>':'';
    root.innerHTML=`<details class="desk-original"${expand?' open':''}><summary>Meeting reminders${available?' · '+available+' ready to review':''}</summary>
      ${active.length?'<p>When a draft is ready, read it here. To alert people, an officer must share the message separately.</p>':
      '<p>'+(view.started?'The meeting has started. Its reminder windows have finished.':'No more reminders are scheduled for this meeting.')+'</p>'}
      ${notice}${cards}${history}${examples}<button type="button" data-refresh-reminders class="text-link">Refresh reminders</button><p role="status" data-reminder-status></p></details>`;
    clearTimeout(nextChange);
    const times=active.map(item=>item.state==='ready'?item.expiresAt:item.dueAt).filter(value=>value>view.preparedAt);
    if(times.length)nextChange=setTimeout(refreshCurrent,Math.min(2147000000,(Math.min(...times)-view.preparedAt)*1000+250));
  }
  function refreshCurrent(){if(meeting && !document.hidden)load(Boolean(root.querySelector('details[open]')));}
  document.addEventListener('visibilitychange',refreshCurrent);
  async function load(expand=false) {
    const current=++revision;
    try {
      const result=await api('/api/meetings/reminders?id='+encodeURIComponent(meeting));
      if(current!==revision)return;
      if(!Array.isArray(result?.reminders))throw Error('Unavailable');
      view=result;render(expand);
    } catch(error) {
      if(current===revision) {
        if(error.status===401||error.status===403){clearSession();return;}
        if(view)root.querySelector('[data-reminder-status]').textContent='The reminder list could not refresh. Try again.';
        else render();
      }
    }
  }
  root.addEventListener('click',async e=>{
    const control=e.target.closest('button');if(!control||!meeting)return;
    if(control.hasAttribute('data-refresh-reminders')) {
      if(unsaved()&&view){root.querySelector('[data-reminder-status]').textContent='Save your agenda edits before refreshing reminders.';return;}
      await load(true);return;
    }
    const channel=control.dataset.reviewReminder;
    if(!channel)return;
    const status=root.querySelector('[data-reminder-status]');
    if(unsaved()){status.textContent='Save your agenda edits before reviewing a reminder.';return;}
    const current=++revision;control.disabled=true;
    try {
      const result=await api('/api/meetings/reminders',{method:'POST',body:JSON.stringify({id:meeting,channel,version:view.version,preparedAt:view.preparedAt})});
      if(current===revision){view=result;render(true);}
    }catch(error){if(current===revision){if(error.status===401||error.status===403)clearSession();else status.textContent=error.message;}}
    finally{control.disabled=false;}
  });
  return {reset,open(id){reset();meeting=id;return load();},refresh(id){if(meeting===id)return load(Boolean(root.querySelector('details[open]')));}};
}
