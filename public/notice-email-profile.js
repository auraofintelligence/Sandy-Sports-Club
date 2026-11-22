const endpoint = '/api/account/notice-email';
const routes = {profile:'#members/profile',members:'#members/notices',committee:'#committee/notices'};

function routeFor(mount) {
  const hint=mount.dataset.noticeEmailChoices;
  if (routes[hint]) return routes[hint];
  if (mount.closest('[data-member-pane="profile"]')) return routes.profile;
  if (mount.closest('[data-member-pane="notices"]')) return routes.members;
  if (mount.closest('[data-committee-feature="notices"]')) return routes.committee;
  return '';
}

function summary(data) {
  if (!data.important && !data.weekly) return 'Off';
  if (!data.senderReady) return 'Waiting for club email setup';
  if (!data.verified) return 'Confirm email address';
  if (data.important && data.weekly) return 'Important notices and weekly summary';
  return data.important ? 'Important notices only' : 'Weekly summary only';
}

function renderShell(mount) {
  mount.innerHTML='<details class="ne-panel"><summary>My email alerts <span data-ne-summary>Checking…</span></summary>'+
    '<div class="ne-body"><form data-ne-save hidden><fieldset><legend>Which notices would you like by email?</legend>'+
    '<label class="ne-check"><input type="checkbox" name="important"> Important notices as they are posted</label>'+
    '<label class="ne-check"><input type="checkbox" name="weekly"> One weekly summary</label>'+
    '</fieldset><label class="ne-field"><span data-ne-address-label>Email address</span><input name="email" type="email" autocomplete="email" maxlength="254"></label>'+
    '<p class="ne-help" data-ne-guardian hidden></p><p class="ne-help" data-ne-delivery></p><p class="ne-help"><a href="/webmaster-help.html?from=email">Ask the Webmaster about email alerts</a></p>'+
    '<button class="button small" type="submit">Save my choices</button></form>'+
    '<form data-ne-confirm hidden><label class="ne-field">Six-digit email code<input name="code" type="text" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"></label>'+
    '<p class="ne-help">Copy the six digits from the club email. Check your spam folder if it hasn’t arrived.</p><div class="ne-actions">'+
    '<button class="button small" type="submit">Confirm email address</button><button type="button" class="text-link" data-ne-resend>Send a fresh code</button></div></form>'+
    '<details class="ne-setup" hidden><summary>Webmaster email setup</summary><p>Club email delivery is awaiting a verified Sandy Sports sender and its own credentials.</p></details>'+
    '<p data-ne-status role="status"></p><button type="button" class="text-link" data-ne-retry hidden>Try again</button></div></details>';
}

export function setupNoticeEmailProfile({api}) {
  const mounts=Array.from(document.querySelectorAll('[data-notice-email-choices]'));
  let active=null, current=null, data=null, request=null;
  const signed=()=>current?.authenticated && !current?.readOnly && !current?.showcase && !current?.demo && ['member','committee'].includes(current.role);
  const readOnly=()=>Boolean(current?.readOnly || current?.showcase || current?.demo);
  const feedback=text=>{active.querySelector('[data-ne-status]').textContent=text;};

  function clear() {
    request?.abort();request=null;active=null;data=null;
    for(const mount of mounts) {mount.replaceChildren();mount.hidden=true;}
  }
  function addressNeeded() {
    const form=active.querySelector('[data-ne-save]'), {email,important,weekly}=form.elements;
    email.required=Boolean(!data.guardian && (important.checked || weekly.checked));
  }
  function showConfirmation() {
    const {email,important,weekly}=active.querySelector('[data-ne-save]').elements;
    const unchanged=email.value.trim()===(data.email||'') && important.checked===Boolean(data.important) && weekly.checked===Boolean(data.weekly);
    active.querySelector('[data-ne-confirm]').hidden=!(unchanged && (important.checked || weekly.checked) && data.senderReady && !data.verified && data.pendingCode);
  }
  function paint(next) {
    data=next;
    const form=active.querySelector('[data-ne-save]'), confirmation=active.querySelector('[data-ne-confirm]');
    const {email,important,weekly}=form.elements;
    form.hidden=false;form.reset();confirmation.reset();
    form.querySelector('[type=submit]').hidden=readOnly();
    if(readOnly()) confirmation.hidden=true;
    email.value=next.email||'';important.checked=Boolean(next.important);weekly.checked=Boolean(next.weekly);
    email.readOnly=Boolean(next.guardian);addressNeeded();
    active.querySelector('[data-ne-address-label]').textContent=next.guardian?'Parent or guardian’s registered email':'Email address';
    const guide=active.querySelector('[data-ne-guardian]');
    guide.hidden=!next.guardian;
    guide.textContent=next.guardian?'Ask the secretary to update the guardian’s address if it is missing or out of date.':'';
    const chosen=next.important || next.weekly;
    const advice=!next.senderReady?'You can save your choices now. Email delivery will be available once the club connects its sender.':
      !chosen?'Tick either option or both. Leave both clear to keep your notices in the clubhouse.':
      next.verified?'The club has confirmed this address. Clear both options and save to turn off emails.':
      next.pendingCode?'Enter the code below to confirm this address.':'Save your choices to get a confirmation code by email.';
    active.querySelector('[data-ne-delivery]').textContent=advice;
    if(!readOnly()) showConfirmation();
    active.querySelector('.ne-setup').hidden=!next.webmaster;
    active.querySelector('[data-ne-summary]').textContent=summary(next);
    active.querySelector('[data-ne-retry]').hidden=true;
  }
  async function exchange(body) {
    if (!active || !signed() || request || (body && readOnly())) return;
    const controller=new AbortController();request=controller;
    const mount=active;
    const controls=Array.from(mount.querySelectorAll('input, button'));
    for(const control of controls)control.disabled=true;
    feedback(body?'Saving…':'Checking your email choices…');
    try {
      const next=await api(endpoint,{cache:'no-store',signal:controller.signal,...(body?{method:'POST',body:JSON.stringify(body)}:{})});
      if (controller.signal.aborted || request!==controller)return;
      paint(next);
      feedback(body ? body.action==='confirm'?'Email address confirmed.':'Your email choices are saved.' : '');
      if(body && !mount.querySelector('[data-ne-confirm]').hidden) {
        const code=mount.querySelector('[name=code]');code.disabled=false;code.focus();
      }
    } catch(error) {
      if (controller.signal.aborted || request!==controller)return;
      if (error.status===401 || (error.status===403 && !body)) clear();
      else {
        feedback(error.message || 'Could not check your email choices. Please try again.');
        if (!data) {
          mount.querySelector('[data-ne-summary]').textContent='Could not load choices';
          mount.querySelector('[data-ne-retry]').hidden=false;
        }
      }
    } finally {
      if(request===controller) {request=null;for(const control of controls)control.disabled=false;}
    }
  }
  function navigate() {
    const next=signed() ? mounts.find(mount=>routeFor(mount)===location.hash && (location.hash!==routes.committee || current.role==='committee')) : null;
    if (active===next)return;
    clear();
    if(!next)return;
    active=next;active.hidden=false;renderShell(active);exchange();
  }
  for(const mount of mounts) {
    mount.hidden=true;
    mount.addEventListener('change',event=>{
      if (active===mount && data && event.target.type==='checkbox') addressNeeded();
    });
    mount.addEventListener('input',event=>{
      if(active===mount && data && event.target.closest('[data-ne-save]'))showConfirmation();
    });
    mount.addEventListener('click',event=>{
      if(active!==mount)return;
      if(event.target.closest('[data-ne-retry]'))exchange();
      if(event.target.closest('[data-ne-resend]') && data)exchange({action:'save',email:data.email,important:data.important,weekly:data.weekly});
    });
    mount.addEventListener('submit',event=>{
      event.preventDefault();
      if(active!==mount || !data)return;
      const form=event.target;
      if(form.matches('[data-ne-confirm]'))exchange({action:'confirm',code:form.elements.code.value.trim()});
      if(form.matches('[data-ne-save]')) {
        const {email,important,weekly}=form.elements;
        exchange({action:'save',email:data.guardian ? data.email : email.value.trim(),important:important.checked,weekly:weekly.checked});
      }
    });
  }
  window.addEventListener('plfc:navigated',navigate);
  window.addEventListener('plfc:session-changed',event=>{
    const next=event.detail;
    if (current?.identity?.id!==next?.identity?.id || current?.role!==next?.role || !next?.authenticated)clear();
    current=next;navigate();
  });
}
