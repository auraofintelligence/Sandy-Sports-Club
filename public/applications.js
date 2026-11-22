const names = {adult:'Adult',cadet:'Cadet',junior:'Junior',social:'Social',casual:'Casual',lifetime:'Lifetime'};
const groups = {pending:'New applications',followup:'Needs a conversation',approved:'Approved applications',invited:'Invitation issued',active:'Joined',declined:'Declined'};
const youth = category => category === 'cadet' || category === 'junior';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const options = labels => Object.entries(labels).map(([value,label]) => '<option value="'+value+'">'+label+'</option>').join('');
const date = value => new Date(value*1000).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const row = (label,value) => value ? '<div><dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd></div>' : '';
const button = (label,action,primary=false) => '<button type="button" class="button small'+(primary?'':' outline')+'" data-action="'+action+'">'+label+'</button>';
const checkbox = (name,text,required=false) => '<label class="apply-check"><input type="checkbox" name="'+name+'" '+(required?'required':'')+'><span>'+text+'</span></label>';

async function api(path,data,signal) {
  const response = await fetch(path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,
    headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined});
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error==='string'?body.error:(body.message || 'The club could not complete that step. Please try again.'));
  return body;
}

const reviewMounts = new WeakMap();
export function clearApplicationReview(container) {
  reviewMounts.get(container)?.abort();
  reviewMounts.delete(container);
  container?.replaceChildren();
}

export function setupApplicationReview(container,session) {
  if (!container) return;
  clearApplicationReview(container);
  if (session?.role!=='committee') return;
  const controller=new AbortController(), signal=controller.signal;
  reviewMounts.set(container,controller);
  container.innerHTML='<details class="apply-inbox"><summary>Membership applications</summary><p>Review new applications and check guardian permission here. After approval the treasurer can verify payment and prepare a private invitation.</p>'+
    '<label>Show applications<select data-filter>'+options(groups)+'</select></label><p data-feedback role="status" aria-live="polite"></p>'+
    '<div class="apply-cases"></div><div data-more></div><section class="apply-record" aria-label="Application review" tabindex="-1"></section></details>';
  const filter=container.querySelector('[data-filter]'), list=container.querySelector('.apply-cases');
  const panel=container.querySelector('.apply-record'), feedback=container.querySelector('[data-feedback]'), more=container.querySelector('[data-more]');
  let cursor=null, active=null, queueVersion=0, recordVersion=0, loaded=false;
  const warn=error=>{if(!signal.aborted) feedback.textContent=error.message;};
  const reload = async (append=false)=>{
    const version=++queueVersion;
    if (!append) {cursor=null;list.replaceChildren();panel.replaceChildren();active=null;recordVersion++;}
    more.replaceChildren();feedback.textContent='Loading applications…';
    try {
      const path='/api/applications?status='+filter.value+(append?'&before='+cursor:'');
      const result=await api(path,null,signal);
      if (signal.aborted || version!==queueVersion) return;
      const items=result.applications.map(item=>'<button class="apply-case" type="button" data-record="'+escape(item.id)+'"><strong>'+escape(item.fullName)+'</strong><span>'+escape(names[item.category])+' · '+date(item.submittedAt)+'</span></button>').join('');
      list.insertAdjacentHTML('beforeend',items);cursor=result.next;
      if(cursor) more.innerHTML=button('Show more','more');
      feedback.textContent=list.children.length?'Choose a name to see the application.':'There are no applications in this group.';
    } catch(error){warn(error);}
  };
  const openRecord = async id=>{
    const version=++recordVersion;active=null;panel.replaceChildren();
    try {
      const {application:a}=await api('/api/applications/'+encodeURIComponent(id),null,signal);
      if (signal.aborted || version!==recordVersion) return;
      active=a;
      const labels=row('Membership',names[a.category])+row('Received',date(a.submittedAt))+row('Stage',groups[a.status])+
        row('Adult guardian',a.guardianName)+row(a.guardianName?'Guardian email':'Email',a.email)+row(a.guardianName?'Guardian phone':'Phone',a.mobile)+
        row('Pack',a.packMethod==='post'?'Post to '+a.address:'Collect from the club')+
        (youth(a.category)?row('Guardian permission to join',a.guardianAuthorised?'Given on the application':'Missing')+
          row('Online access','Checked separately in Member age and permissions')+
          (a.guardianReviewed?row('Committee check','Guardian verified for membership'):''):'');
      let action='';
      if (a.status==='pending' || a.status==='followup') action='<form data-review class="apply-form"><h4>Committee review</h4>'+
        (a.returningStatus?'<p>This is a welcome-back application. Review admission and any guardian authority here. The fee waiver is handled separately.</p>':'')+
        (youth(a.category)?checkbox('guardianChecked','I have checked the identity and authority of the parent or legal guardian.')+
          '<p>After membership activation, use <a href="#committee/safety">Member age and permissions</a> to check online access with the family.</p>':'')+
        '<label>Review outcome<select name="decision" required><option value="">Choose an outcome</option><option value="approved">'+(a.returningStatus?'Approve the membership application':'Approve for the treasurer’s payment check')+'</option><option value="followup">Needs a conversation</option><option value="declined">Decline this application</option></select></label>'+
        '<button class="button small">Save review</button></form>';
      const expired = a.status==='invited' && a.inviteExpires*1000<=Date.now();
      if (a.status==='approved' || expired) action=session.canManageStock?'<form data-payment class="apply-form"><h4>Verify payment and prepare invitation</h4>'+
        '<p>Match payment against the club’s records first. Agree a username with the applicant or their guardian. The private set-up link will appear here for you to pass to them personally.</p>'+
        '<label>Agreed username<input name="login" minlength="3" maxlength="80" required autocapitalize="none" spellcheck="false" value="'+escape(a.login)+'"></label>'+
        '<label>Paid through<input type="date" name="paidThrough" required></label>'+checkbox('verified','I checked this membership payment and the date it covers against the club’s records.',true)+
        '<button class="button small">Create member invitation</button></form>':'<p>The treasurer can now verify payment and prepare the invitation.</p>';
      if (a.status==='invited' && !expired) action='<p>An invitation has been issued for '+escape(a.login)+'. It expires on '+date(a.inviteExpires)+' unless the member uses it first.</p>';
      if (session.demo && (a.status==='approved' || expired)) action='<p>Practice application approved. In the club’s private workspace, the treasurer checks the payment and issues the member’s invitation.</p>';
      if(a.returningStatus&&(a.status==='approved'||a.status==='invited')){
        const message=a.returningStatus==='proposed'?'The Treasurer is reviewing the proposed fee waiver.':a.returningStatus==='activation'?'The member has accepted and can finish choosing a password via their original welcome-back invitation.':'The Treasurer has approved the complimentary year. The member can open their welcome-back invitation to accept and set up their password.';
        action='<p>'+message+'</p><a class="text-link" href="#committee/returning">Welcome-back memberships</a>';
      }
      if(session.demo||session.readOnly)action='<p>Preview only. Application reviews, payment checks and invitations are unavailable in this view.</p>';
      panel.innerHTML='<h3>'+escape(a.fullName)+'</h3><dl class="apply-facts">'+labels+'</dl>'+action+'<p data-result role="status" aria-live="polite"></p>';
      feedback.textContent='';panel.focus();
    } catch(error){warn(error);}
  };
  container.querySelector('details').addEventListener('toggle',event=>{
    if(event.target.open && !loaded) {loaded=true;reload();}
  },{signal});
  filter.addEventListener('change',()=>reload(),{signal});
  container.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if (target?.dataset.record) openRecord(target.dataset.record);
    if (target?.dataset.action==='more') reload(true);
    if (target?.dataset.action==='copy') {
      const input=panel.querySelector('[data-link]');
      input.focus();input.select();
      navigator.clipboard?.writeText(input.value).then(()=>{panel.querySelector('[data-result]').textContent='Link copied.';}).catch(()=>{panel.querySelector('[data-result]').textContent='The link is selected. Use Copy on your device.';});
    }
  },{signal});
  container.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target, record=active, version=recordVersion;
    if (!record || !(form.matches('[data-review]')||form.matches('[data-payment]'))) return;
    const status=panel.querySelector('[data-result]'), submit=form.querySelector('button');
    submit.disabled=true;status.textContent='Saving…';
    try {
      const fields=form.elements;
      if(form.matches('[data-review]')) {
        await api('/api/applications/'+record.id+'/review',{decision:fields.decision.value,guardianChecked:!!fields.guardianChecked?.checked,socialChecked:!!fields.socialChecked?.checked},signal);
        if(signal.aborted||version!==recordVersion) return;
        await reload();if(!signal.aborted) feedback.textContent='Review saved. Choose the relevant group above to see the next step.';
      } else {
        const result=await api('/api/accounts/invite',{applicationId:record.id,role:'member',login:fields.login.value.trim(),paidThrough:fields.paidThrough.value,verified:fields.verified.checked},signal);
        if(signal.aborted||version!==recordVersion) return;
        const url=new URL('/clubhouse.html',location.origin);url.hash='activate='+result.token;
        form.innerHTML='<h4>Pass on the private invitation</h4><p>Give the applicant or guardian the username and this single-use link. They have 24 hours to open it and choose a password.</p>'+
          '<p><strong>Username</strong> '+escape(result.login)+'</p><label>Private set-up link<input data-link readonly></label>'+button('Copy private link','copy');
        form.querySelector('[data-link]').value=url.href;status.textContent='Payment verification and invitation saved.';
        list.querySelector('[data-record="'+record.id+'"]')?.remove();
      }
    } catch(error){if(!signal.aborted && version===recordVersion){status.textContent=error.message;submit.disabled=false;}}
  },{signal});
}

let entryDialog;
export function setupApplicationEntry({returningApplication}={}) {
  if (entryDialog) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'apply-dialog'; dialog.setAttribute('aria-labelledby','apply-title');
  document.body.append(dialog); entryDialog=dialog;
  let stage=0, state, sending=false, opener;
  const initial = () => ({requestId:crypto.randomUUID(),category:'adult',packMethod:'collect'});
  const draw = () => {
    const guardian = youth(state.category);
    const stageNames = ['Choose your membership','Your contact and pack','Check your application','Application received'];
    const identityLabel = guardian ? 'Young member’s full name' : 'Your full name';
    const contactLabel = guardian ? 'Adult guardian' : 'Your';
    const field = (name,label,type='text',required=false,max=100) => '<label>'+label+'<input type="'+type+'" name="'+name+'" value="'+escape(state[name])+'" maxlength="'+max+'" '+(required?'required':'')+'></label>';
    let contents;
    const fee=returningApplication?'<p>Your first 12 months under this welcome-back offer are complimentary.</p>':'<div data-membership-fee aria-live="polite">Checking the membership fee…</div>';
    if (stage===0) contents = (returningApplication?'<p>The Treasurer has approved your welcome-back offer. The committee needs your current membership details to review your admission.</p>':'<p>Start here to ask to join Sandy Sports Club. A committee member reviews your application and confirms any fee set by the Treasurer. The Treasurer checks payment before you receive a link to set up your account.</p>')+
      '<label><span id="apply-category-label">Membership category</span><select aria-labelledby="apply-category-label" name="category">'+options(names)+'</select></label>'+fee+'<p class="secondary">Under 18? A parent or legal guardian must apply for a junior or cadet. Online sharing is reviewed separately.</p>';
    if (stage===1) contents = field('fullName',identityLabel,'text',true)+
      (guardian ? field('guardianName','Parent or legal guardian’s full name','text',true) : '')+
      '<p>Give the club at least one way to get in touch.'+(guardian?' Use the adult’s contact details.':'')+'</p>'+
      field('email',contactLabel+' email address','email',false,150)+field('mobile',contactLabel+' phone number','tel',false,25)+
      '<label>How would you like your membership pack?<select name="packMethod"><option value="collect">Collect from the club</option><option value="post">Post it to me</option></select></label>'+
      '<label data-postal>Postal address including postcode<textarea name="address" maxlength="350" rows="2">'+escape(state.address)+'</textarea></label>'+
      checkbox('adultDeclaration',guardian?'I am 18 or older and I am this young person’s parent or legal guardian.':'I am 18 or older and I am applying for myself.',true)+
      (guardian ? checkbox('guardianAuthorised','I authorise this young person’s membership application and agree that the club can contact me to check it.',true)+
        '<p>Under-16s use a private club space. An officer will check their age group and guardian permission separately before opening their private tools.</p>' : '');
    if (stage===2) contents = '<dl class="apply-facts">'+row('Membership',names[state.category])+row(identityLabel,state.fullName)+row('Parent or guardian',guardian?state.guardianName:'')+
      row('Email',state.email)+row('Phone',state.mobile)+row('Pack',state.packMethod==='post'?state.address:'Collect from the club')+
      row('Online access',guardian?'Checked separately in Member age and permissions':'')+'</dl>'+fee+
      '<p>Pressing send saves a real application in the club’s private records. The committee can use these details to review your request, contact you and arrange your pack. No payment is taken here.</p>'+
      checkbox('consent','I have checked the details and give the club permission to use them for this application.',true);
    if (stage===3) contents = returningApplication?'<p>The committee has your details. Keep the private invitation the Secretary gave you. After the committee approves your application, open that same invitation to accept your complimentary year and set your password.</p>':'<p>The committee has your application. A club volunteer will review it and can contact you using the details you provided. Once your payment is verified, the club can give you a private link to choose your password.</p>';
    const actions = stage===3 ? button('Done','close',true) : (stage?button('Back','back'):'')+
      '<button type="submit" class="button small">'+(['Continue','Review my details','Send my application'][stage])+'</button>';
    dialog.innerHTML='<div class="apply-top"><span class="eyebrow">'+(stage<3?'Membership · Step '+(stage+1)+' of 3':'Sandy Sports Club')+'</span>'+
      button('Close','close')+'</div><h2 id="apply-title" tabindex="-1">'+stageNames[stage]+'</h2><form class="apply-form">'+contents+
      '<p role="status" aria-live="polite"></p><div class="button-row">'+actions+'</div></form>';
    const form = dialog.querySelector('form');
    for (const el of form.querySelectorAll('select, input[type=checkbox]')) {
      if (el.type==='checkbox') el.checked = Boolean(state[el.name]);
      else el.value = state[el.name];
    }
    const toggleAddress = () => {
      const wrap=form.querySelector('[data-postal]');
      if (!wrap) return;
      wrap.hidden=form.elements.packMethod.value!=='post';
      form.elements.address.required=!wrap.hidden;
    };
    toggleAddress(); form.elements.packMethod?.addEventListener('change',toggleAddress);
    const price=form.querySelector('[data-membership-fee]');
    if(price){
      const showFee=()=>{
        price.dataset.category=form.elements.category?.value||state.category;
        window.dispatchEvent(new CustomEvent('plfc:membership-fee',{detail:{target:price}}));
      };
      form.elements.category?.addEventListener('change',showFee);showFee();
    }
    if (dialog.open) dialog.querySelector('h2').focus();
  };
  const remember = () => {
    for (const el of dialog.querySelectorAll('input,select,textarea')) state[el.name]=el.type==='checkbox'?el.checked:el.value.trim();
  };
  dialog.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;
    if (sending) return;
    if (action==='close') dialog.close();
    if (action==='back') {remember();stage--;draw();}
  });
  dialog.addEventListener('cancel',event=>{if (sending) event.preventDefault();});
  dialog.addEventListener('close',()=>{state=undefined;dialog.replaceChildren();opener?.focus();});
  dialog.addEventListener('submit',async event=>{
    event.preventDefault(); if (sending) return;
    remember(); const status=dialog.querySelector('[role=status]');
    if (stage===1 && !(state.email||state.mobile)) {status.textContent='Please add an email address or a phone number.';dialog.querySelector('[name=email]').focus();return;}
    if (stage<2) {stage++;draw();return;}
    if (stage!==2) return;
    sending=true; for (const el of dialog.querySelectorAll('button')) el.disabled=true;
    status.textContent='Sending your application…';
    try { if(returningApplication)await returningApplication(state);else await api('/api/applications/apply',state);stage=3;draw(); }
    catch(error) {status.textContent=error.message;for(const el of dialog.querySelectorAll('button')) el.disabled=false;}
    finally {sending=false;}
  });
  window.addEventListener('plfc:apply',()=>{
    if (dialog.open) return;
    opener=document.activeElement;state=initial(); stage=0;draw();dialog.showModal();dialog.querySelector('h2').focus();
  });
}
