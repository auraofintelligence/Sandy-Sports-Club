const endpoint = '/api/committee/notices';
const boardRoute = '#committee/notices';
const noticeDate = new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Brisbane', day:'numeric', month:'short', year:'numeric'});
const statusLabels = {
  current:'Current', dueSoon:'Due soon', dueToday:'Due today', overdue:'Overdue',
  reviewSoon:'Review soon', stale:'Needs review', done:'Done', archived:'Archived',
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function dateLabel(value) {
  if (!value) return '';
  const instant = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value+'T12:00:00+10:00') : new Date(value);
  return Number.isNaN(instant.valueOf()) ? '' : noticeDate.format(instant);
}
function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function noticeCard(row) {
  const light = ['red','amber','green','grey'].includes(row.light) ? row.light : 'grey';
  const meta = [row.author && 'Posted by '+row.author, dateLabel(row.createdAt)].filter(Boolean).join(' · ');
  const timing = row.kind === 'action'
    ? '<p class="cn-timing"><strong>'+escape(row.officeLabel)+'</strong> · Due '+escape(dateLabel(row.dueDate))+'</p>'
    : '<p class="cn-timing">Review date · '+escape(dateLabel(row.reviewDate))+'</p>';
  return '<div class="cn-card-top"><h3 tabindex="-1">'+escape(row.title)+'</h3><div class="cn-badges">'+
    (row.important ? '<span class="cn-important">Important</span>' : '')+
    (row.unread && !row.archivedAt ? '<span class="cn-new">New to you</span>' : '')+
    '<span class="cn-light cn-'+light+'">'+escape(statusLabels[row.status] || 'Current')+'</span></div></div>'+
    '<p class="cn-meta">'+escape(meta)+'</p>'+
    (row.details ? '<p class="cn-details">'+escape(row.details)+'</p>' : '')+timing+
    '<div class="cn-actions">'+
    (row.unread && !row.archivedAt ? '<button class="button outline small" type="button" data-notice-action="seen">Mark as read</button>' : '')+
    (row.kind === 'action' && row.taskId && !row.doneAt && !row.archivedAt ? '<a class="text-link" href="#committee/todos">Officer to-do lists</a>' : '')+
    (row.canReview ? '<button class="text-link" type="button" data-notice-action="review">Confirm current for 30 days</button>' : '')+
    (row.canArchive ? '<button class="text-link" type="button" data-notice-action="archive">Archive notice</button>' : '')+
    '</div>';
}

export function setupCommitteeNotices({api}) {
  const home = document.getElementById('committee-notice-summary');
  const board = document.getElementById('committee-notices');
  const nav = document.querySelector('#main-nav a[data-page="committee"]');
  if (!home || !board) return;
  let session, currentPage = '', data = null, getRequest = null, saveRequest = null, draftId = null;
  let listMode = 'active', pendingId = '', officeChoices = '';
  const officer = () => Boolean(session?.authenticated && session.role === 'committee');
  const readOnly = () => Boolean(session?.readOnly || session?.showcase || session?.demo);
  const message = text => { const el=board.querySelector('[data-notice-message]'); if(el) setText(el,text); };

  function buildHome() {
    if (home.firstElementChild) return;
    home.innerHTML = '<div class="cn-home"><div><h2>Committee notices</h2><p data-notice-counts role="status">Checking notices…</p></div>'+
      '<a href="#committee/notices" class="button outline small">Open noticeboard</a></div>';
  }
  function updateCounts({counts,today}) {
    buildHome();
    const parts = [Number(counts.unread) ? counts.unread+' new to you' : 'No new notices'];
    if (counts.red) parts.push(counts.red+' overdue');
    if (counts.amber) parts.push(counts.amber+' to check');
    const summary = parts.join(' · ');
    setText(home.querySelector('[data-notice-counts]'), summary);
    const deskCounts = board.querySelector('[data-notice-counts]');
    if (deskCounts) setText(deskCounts, summary);
    if (nav) {
      let badge=nav.querySelector('.cn-nav-new');
      if (counts.unread>0) {
        if (!badge) {badge=document.createElement('span');badge.className='cn-nav-new';nav.append(badge);}
        setText(badge, counts.unread+' new');
      } else badge?.remove();
    }
    window.dispatchEvent(new CustomEvent('plfc:committee-notices-date',{detail:{today}}));
  }
  function buildBoard() {
    if (board.firstElementChild) return;
    board.innerHTML = '<header class="cn-header"><h1 tabindex="-1">Committee notices</h1><p>Post an update for the committee or give an officer a job with a due date.</p></header>'+
      '<details class="cn-compose"><summary>Post a notice</summary><form class="cn-form" data-notice-form>'+
      '<label>What are you posting?<select name="kind"><option value="info">An update for officers</option><option value="action">A job for an officer</option></select></label>'+
      '<label>Title<input name="title" required maxlength="120" placeholder="e.g. Confirm the BBQ booking"></label>'+
      '<label>Details (optional)<textarea name="details" maxlength="1000" rows="3"></textarea></label>'+
      '<label class="cn-priority"><input name="important" type="checkbox"><span>Mark as important</span></label>'+
      '<small class="cn-priority-help">Use this for an update that should reach officers before the weekly email.</small>'+
      '<div data-notice-info><label>Review date (optional)<input name="reviewDate" type="date"></label><small>Leave blank to check this update again in 30 days.</small></div>'+
      '<div data-notice-job hidden><label>Who will do it?<select name="office" disabled></select></label>'+
      '<label>Due date<input name="dueDate" type="date" disabled></label><small>This job also appears on the officer’s printable to-do list.</small></div>'+
      '<button class="button small" type="submit" disabled>Post notice</button></form></details>'+
      '<p><a class="text-link" href="#committee/member-notice">Post a notice for members</a></p><div class="cn-toolbar"><label>Show notices<select data-notice-filter><option value="active">On the board</option><option value="new">New to me</option>'+
      '<option value="attention">Need attention</option><option value="archive">Archived</option></select></label>'+
      '<button type="button" class="text-link" data-notice-refresh>Check now</button></div>'+
      '<p data-notice-counts class="cn-meta"></p><p data-notice-message role="status">Checking notices…</p>'+
      '<ul data-notice-list class="cn-list" aria-label="Committee notices"></ul><p data-notice-empty hidden></p>'+
      '<details class="cn-key"><summary>What do the colours mean?</summary><p>Green means current. Amber means a job is due within seven days or an update needs checking. Red means a job is overdue. Grey means done or archived.</p>'+
      '<p>“New to you” stays on a notice until you mark it as read. The board checks for changes every minute while you have it open.</p></details>';
    if(readOnly())board.querySelector('.cn-compose').hidden=true;
  }
  function showKind() {
    const form = board.querySelector('[data-notice-form]');
    const action = form.elements.kind.value === 'action';
    board.querySelector('[data-notice-info]').hidden = action;
    board.querySelector('[data-notice-job]').hidden = !action;
    form.elements.reviewDate.disabled = action;
    for (const field of [form.elements.office,form.elements.dueDate]) {
      field.disabled = !action;
      field.required = action;
    }
    setText(form.querySelector('[type=submit]'), action ? 'Post and add to to-do list' : 'Post notice');
  }
  function setOptions(choices) {
    const form=board.querySelector('[data-notice-form]');
    const options = JSON.stringify(choices);
    if (options === officeChoices) return;
    officeChoices = options;
    const office=form.elements.office, previous=office.value;
    office.replaceChildren(...(choices.length===1 ? [] : [new Option('Choose an office','')]),
      ...choices.map(({key,label})=>new Option(label,key)));
    if (choices.some(item=>item.key===previous)) office.value=previous;
  }
  function drawList() {
    const list=board.querySelector('[data-notice-list]'), empty=board.querySelector('[data-notice-empty]');
    const rows=data.notices.filter(row => listMode==='new' ? row.unread : listMode==='attention' ? ['red','amber'].includes(row.light) : true);
    const positions = new Map(Array.from(list.children, element=>[element.dataset.id,element]));
    let next = list.firstElementChild;
    for (const row of rows) {
      const card = positions.get(row.id) || document.createElement('li');
      positions.delete(row.id);
      card.dataset.id=row.id;
      const html=noticeCard(row);
      if (html!==card._content) {
        const focused = document.activeElement, restore = card.contains(focused);
        const action = focused?.dataset.noticeAction;
        card.innerHTML=html; card._content=html;
        if(readOnly())card.querySelectorAll('[data-notice-action]').forEach(control=>control.remove());
        if (restore) {
          const replacement = action ? Array.from(card.querySelectorAll('[data-notice-action]')).find(button=>button.dataset.noticeAction===action)
            : focused.matches('a') ? card.querySelector('a') : null;
          (replacement || card.querySelector('h3')).focus({preventScroll:true});
        }
      }
      if (next!==card) list.insertBefore(card,next);
      next=card.nextElementSibling;
    }
    for (const element of positions.values()) {
      if (element.contains(document.activeElement)) board.querySelector('[data-notice-filter]').focus({preventScroll:true});
      element.remove();
    }
    empty.hidden = rows.length>0;
    setText(empty, {active:'No notices yet. Choose Post a notice to share the first update.',new:'You’re up to date.',attention:'No notices need attention today.',archive:'No notices have been archived.'}[listMode]);
  }
  function showData(result) {
    data=result;
    updateCounts(result);
    setOptions(result.offices);
    board.querySelector('[data-notice-form] [type=submit]').disabled=Boolean(saveRequest)||readOnly();
    drawList();
    if (pendingId) focusNotice();
  }
  function focusNotice() {
    const card=Array.from(board.querySelector('[data-notice-list]').children).find(el=>el.dataset.id===pendingId);
    if (card) {
      pendingId=''; const heading=card.querySelector('h3'); heading.focus({preventScroll:true}); heading.scrollIntoView({block:'center'}); return;
    }
    if(listMode==='archive') {
      pendingId='';message('This notice is no longer available.');return;
    }
    listMode='archive';board.querySelector('[data-notice-filter]').value='archive';read();
  }
  function reset() {
    getRequest?.abort(); saveRequest?.abort();
    getRequest=null; saveRequest=null; data=null; draftId=null; officeChoices=''; pendingId=''; listMode='active';
    home.replaceChildren(); board.replaceChildren(); nav?.querySelector('.cn-nav-new')?.remove();
  }
  function denied() {
    reset(); session=null; currentPage='';
    if(location.hash===boardRoute) board.innerHTML='<p role="status">Sign in again to open committee notices.</p>';
  }
  async function read(quiet = false) {
    if (!officer() || !currentPage || saveRequest || (quiet && getRequest)) return;
    getRequest?.abort();
    const request = new AbortController();
    getRequest=request;
    const isBoard=currentPage==='board', view=listMode;
    try {
      const result=await api(endpoint+(isBoard ? (view==='archive'?'?archive=1':'') : '?summary=1'),{cache:'no-store',signal:request.signal});
      if(request.signal.aborted || getRequest!==request) return;
      if(isBoard) {
        const changed=Boolean(data && result.counts.unread>data.counts.unread);
        if (!quiet || changed) message(changed?'There are new committee notices.':'');
        showData(result);
      } else updateCounts(result);
    } catch(error) {
      if (request.signal.aborted || getRequest!==request) return;
      if ([401,403].includes(error.status)) {denied();return;}
      if (isBoard) message('Could not check notices. Choose Check now to try again.');
      else setText(home.querySelector('[data-notice-counts]'),'Could not check for new notices. Open the noticeboard to try again.');
    } finally { if(getRequest===request) getRequest=null; }
  }
  function navigate() {
    const hash=location.hash;
    const next=officer() ? (hash===boardRoute?'board':/^(#committee|#stock)(\/|$)/.test(hash)?'summary':'') : '';
    if(next!==currentPage) {reset();currentPage=next;}
    if(!next)return;
    buildHome();if(next==='board')buildBoard();
    read();
  }
  async function save(body, success) {
    if (!officer() || readOnly() || currentPage!=='board' || saveRequest || !data) return;
    getRequest?.abort();getRequest=null;
    const request = new AbortController();saveRequest=request;
    let refreshOnFinish=false;
    const form=board.querySelector('[data-notice-form]');
    const controls=[...form.elements,...board.querySelectorAll('[data-notice-action], [data-notice-filter]')];
    const enabled=controls.filter(control=>!control.disabled);
    for(const control of enabled)control.disabled=true;
    message('Saving…');
    try {
      const result=await api(endpoint,{method:'POST',body:JSON.stringify(body),signal:request.signal});
      if(request.signal.aborted)return;
      if(body.action==='post') {
        form.reset(); draftId=null;showKind(); board.querySelector('.cn-compose').open=false;
        listMode='active';board.querySelector('[data-notice-filter]').value=listMode;
        board.querySelector('.cn-compose summary').focus();
      }
      if(listMode==='archive') {
        updateCounts(result);
      } else showData(result);
      message(success);
      if(body.action==='post')window.dispatchEvent(new CustomEvent('plfc:committee-notices-changed'));
    } catch(error) {
      if (request.signal.aborted) return;
      if (error.status===401) {denied();return;}
      refreshOnFinish=error.status===409 || error.status===404 || error.status===403;
      message(error.message || 'Could not save. Please try again.');
    } finally {
      if(saveRequest===request) {
        saveRequest=null;
        for(const control of enabled)control.disabled=false;
        showKind();
        if(listMode==='archive' || refreshOnFinish)read(true);
      }
    }
  }
  board.addEventListener('change',event=>{
    if(event.target.name==='kind')showKind();
    if(event.target.matches('[data-notice-filter]')) {
      const before=listMode; listMode=event.target.value;pendingId='';
      if((before==='archive')!==(listMode==='archive') || !data) {
        data=null;board.querySelector('[data-notice-list]').replaceChildren();board.querySelector('[data-notice-empty]').hidden=true;
        board.querySelector('[data-notice-form] [type=submit]').disabled=true;
        message('Checking notices…');read();
      } else drawList();
    }
  });
  board.addEventListener('input', event=>{if(event.target.closest('[data-notice-form]'))draftId=null;});
  board.addEventListener('submit',event=>{
    if(!event.target.matches('[data-notice-form]'))return;
    event.preventDefault();
    const form=event.target,values=new FormData(form), kind=values.get('kind');
    if(!form.elements.title.value.trim()) {form.elements.title.focus();message('Give your notice a title.');return;}
    draftId ??= crypto.randomUUID();
    save({action:'post',id:draftId,kind,title:values.get('title').trim(),details:values.get('details').trim(),important:values.has('important'),
      dueDate:values.get('dueDate')||'',office:values.get('office')||'',reviewDate:values.get('reviewDate')||''},
      kind==='action' ? 'Posted to the committee and added to the officer’s to-do list.' : 'Posted to the committee.');
  });
  board.addEventListener('click',event=>{
    if(event.target.closest('[data-notice-refresh]')) {message('Checking notices…');read();return;}
    const button=event.target.closest('[data-notice-action]'); if (!button || !data)return;
    const row=data.notices.find(item=>item.id===button.closest('li').dataset.id);if(!row)return;
    const action=button.dataset.noticeAction;
    if(action==='archive' && !window.confirm('Move “'+row.title+'” from the noticeboard to the archive?'))return;
    save({action,id:row.id,version:row.version},{seen:'Marked as read for you.',review:'Confirmed as current for another 30 days.',archive:'Notice moved to the archive.'}[action]);
  });
  window.addEventListener('plfc:open-committee-notice',event=>{
    if(!officer() || location.hash!==boardRoute || !event.detail?.id)return;
    const wasArchive=listMode==='archive';pendingId=event.detail.id;listMode='active';
    const filter=board.querySelector('[data-notice-filter]'); if(!filter)return;
    filter.value='active';
    if(!data || wasArchive)read();else {drawList();focusNotice();}
  });
  window.addEventListener('plfc:session-changed',event=>{
    const next=event.detail;
    if(session?.identity?.id!==next?.identity?.id || session?.role!==next?.role || session?.readOnly!==next?.readOnly || session?.showcase!==next?.showcase || !next?.authenticated) {reset();currentPage='';}
    session=next;navigate();
  });
  window.addEventListener('plfc:navigated',navigate);
  const refreshVisible=()=>{if(!document.hidden)read(true);};
  window.addEventListener('focus',refreshVisible);
  window.addEventListener('plfc:committee-notices-changed',refreshVisible);
  document.addEventListener('visibilitychange',refreshVisible);
  window.addEventListener('pageshow',event=>{if(event.persisted)navigate();});
  setInterval(refreshVisible,60000);
}
