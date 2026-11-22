const memberApi = '/api/member/meals';
const guestApi = '/api/meal-guest';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {pending:'Awaiting reply',going:'Going',declined:'Declined'};
const chores = ['Cook at the BBQ', 'Bring a side dish', 'Bring ice', 'Set the table', 'Clean up', 'Bring the music'];
const mealIdeas = [
  ['Beach picnic', 'Beach picnic with salads and fruit', 'Set out a few share plates, salads, fruit and plenty of water after the game.'],
  ['Barbecue lunch', 'Barbecue lunch and potato salad', 'Prepare the barbecue and bring a chilled potato salad and vegetarian option.'],
  ['Island shared table', 'Island shared table', 'Invite each guest to bring a clearly labelled dish and serve it together after club activities.'],
];
const dates = new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const times = new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Brisbane'});
const venue = meal => meal.venueType === 'bbq' ? 'Public barbecue' : 'At home';
const btn = (name, label, style = 'outline') => `<button class="button ${style} small" type="button" data-action="${name}">${label}</button>`;
const submit = label => `<button class="button small" type="submit">${label}</button>`;
const send = (api,path,payload,signal) => api(path,{method:'POST',body:JSON.stringify(payload),signal});

function timeOf(meal) {
  const date = new Date(meal.date + 'T' + meal.time + ':00+10:00');
  return Number.isFinite(+date) ? dates.format(date) + ' at ' + times.format(date) + ' (Queensland)' : '';
}
function dateMinimum() {
  return new Date(Date.now() + 10 * 3600000).toISOString().slice(0,10);
}
function limitField(value) {
  return `<label>Guest places (optional)<input type="number" name="guestLimit" inputmode="numeric" min="1" step="1" value="${esc(value)}">
    <small>Leave blank for no limit. Count each guest, including children. Leave yourself out as host.</small></label>`;
}
function readLimit(form) {
  const value=form.elements.guestLimit.value;
  return value==='' ? null : Number(value);
}
function mealInfo(meal) {
  return `<dl class="meal-info"><div><dt>When</dt><dd>${esc(timeOf(meal))}</dd></div><div><dt>Where</dt><dd>${esc(venue(meal))} · ${esc(meal.area)}</dd></div>
    ${meal.location && meal.status !== 'cancelled' ? `<div class="meal-address"><dt>Meet here</dt><dd>${esc(meal.location)}</dd></div>` : ''}
    ${meal.guestLimit!=null && meal.status!=='cancelled' ? `<div><dt>Guest places</dt><dd>${meal.placesLeft===0?'Full':esc(meal.placesLeft)+' left'} · ${esc(meal.guestLimit)} in total</dd></div>` : ''}
    <div><dt>On the menu</dt><dd>${esc(meal.menu)}</dd></div>
    ${meal.recipe ? `<div><dt>Recipe suggestion</dt><dd>${esc(meal.recipe)}</dd></div>` : ''}
    ${meal.byo ? `<div><dt>Bring along</dt><dd>${esc(meal.byo)}</dd></div>` : ''}</dl>`;
}
function contributions(meal) {
  if (meal.status === 'cancelled') return '';
  const canClaim = meal.own || meal.invitation?.response === 'going';
  const jobs = meal.jobs || [], shared = (meal.shared || []).filter(s => s.sideDish || s.contribution);
  if (!jobs.length && !shared.length) return '';
  return `<section class="meal-help"><h4>Who’s bringing what?</h4>${shared.length ? `<ul>${shared.map(row => `<li>${[row.sideDish,row.contribution].filter(Boolean).map(esc).join(' · ')}</li>`).join('')}</ul>` : ''}
    ${jobs.length ? `<ul class="meal-jobs">${jobs.map(job => `<li><span>${esc(job.label)} <small>${job.mine?'Your job':job.taken && meal.own && job.claimedBy?'Covered by '+esc(job.claimedBy):job.taken?'Covered':'Help wanted'}</small></span>${canClaim && (job.mine || !job.taken) ? `<button type="button" class="text-link" data-action="job" data-index="${Number(job.index)}" data-claim="${!job.mine}">${job.mine?'Give this up':'I can help'}</button>` : ''}</li>`).join('')}</ul>` : ''}</section>`;
}
function rsvpForm(meal,guest=false) {
  const invite = meal.invitation || {}, going = invite.response === 'going';
  const openJoin = !guest && !meal.invitation;
  const available = meal.guestLimit==null ? 8 : Math.min(8,meal.placesLeft+(going?invite.partySize:0));
  if(openJoin && available===0)return '<p>This meal is full. Check back if someone changes their plans.</p>';
  const decline = invite.response==='declined' || available===0;
  return `<details class="meal-edit" ${going || invite.response === 'declined' ? '' : 'open'}><summary>${openJoin?'Join this meal':going?'Change my reply or what I’m bringing':invite.response === 'declined'?'Change my reply':'Reply to the host'}</summary>
    <form data-form="rsvp" class="meal-form">${openJoin ? '<input type="hidden" name="response" value="going">' : `<label>Will you be there?<select name="response"><option value="going" ${available===0?'disabled':''}>${available===0?'Fully booked':'Yes, count me in'}</option><option value="declined" ${decline?'selected':''}>I can’t make it</option></select></label>`}
    <div class="meal-form" data-going ${decline?'hidden':''}>
    <label>How many are coming, including you?<select name="partySize">${Array.from({length:available},(_,i)=>i+1).map(n=>`<option value="${n}" ${(invite.partySize || 1)===n?'selected':''}>${n}${n===1?' (just me)':''}</option>`).join('')}</select></label>
    <details class="meal-edit" ${invite.sideDish || invite.contribution?'open':''}><summary>Bring a side dish or something to share</summary>
      <label>Side dish (optional)<input name="sideDish" value="${esc(invite.sideDish)}" maxlength="100" placeholder="e.g. Potato salad for six"></label>
      <label>Anything else to share? (optional)<input name="contribution" value="${esc(invite.contribution)}" maxlength="100" placeholder="e.g. A playlist and a little speaker"></label>
      <small>Other people going can see these offers.</small></details>
    <label>Dietary needs for the host (optional)<input name="dietary" value="${esc(invite.dietary)}" maxlength="200" placeholder="e.g. One vegetarian"></label></div>
    ${guest ? '<label class="meal-check"><input required type="checkbox" name="ageConfirmed"> I am 16 or older and am replying for my party. Children under 16 attend with a parent or guardian.</label>' : ''}
    ${submit(available===0?'Tell the host I can’t make it':openJoin?'Count me in':invite.response && invite.response!=='pending'?'Save my reply':'Send my reply')}</form></details>`;
}
function invitePanel(meal) {
  const rows = meal.invites || [];
  return `<div class="meal-invite-tools"><h4>Invite someone</h4>
    <details class="meal-edit"><summary>Choose a club member</summary>
      <form class="meal-search" data-form="search"><label>Find a member<input name="name" type="search" placeholder="Enter at least two letters" maxlength="60"></label>${submit('Find member')}</form>
      <div data-people aria-live="polite"></div></details>
    <details class="meal-edit"><summary>Invite a friend outside the club</summary>
      <p>Make one private link per person. You can send it to them yourself. They can reply without a club login.</p>
      <form data-form="inviteGuest" class="meal-search"><label>Guest’s name<input name="name" maxlength="60" required></label>${submit('Make guest link')}</form></details>
    <div data-new-link></div>
    ${rows.length ? `<details class="meal-edit"><summary>Guest list and replies (${rows.filter(i=>!i.revoked).length})</summary><ul class="meal-invites">${rows.map(inv => `<li data-invite="${esc(inv.id)}" data-name="${esc(inv.name)}"><div><strong>${esc(inv.name)}</strong><small>${inv.revoked?'Invitation withdrawn':esc(labels[inv.response] || inv.response)}${!inv.revoked && inv.response==='going'?' · '+esc(inv.partySize)+' attending':''}</small>${!inv.revoked && inv.response==='going' ? `${inv.sideDish?`<p>Side dish · ${esc(inv.sideDish)}</p>`:''}${inv.contribution?`<p>Bringing · ${esc(inv.contribution)}</p>`:''}${inv.dietary?`<p>Dietary needs for the host · ${esc(inv.dietary)}</p>`:''}` : ''}</div>
      ${!inv.revoked ? `<div class="meal-row-actions">${inv.kind==='guest' && inv.response==='pending'?btn('reissue','Get guest link'):''}<details><summary>Withdraw invitation</summary><p>They will lose access to the meeting details.</p>${btn('revoke','Confirm withdrawal')}</details></div>` : ''}</li>`).join('')}</ul></details>` : '<p>Your guest list will appear here as you invite people.</p>'}
    </div>`;
}
function menuEditor(meal) {
  return `<details class="meal-edit" data-menu-editor><summary>Edit menu and BYO</summary><form data-form="updateMenu" class="meal-form">
    <label>What’s on the menu?<textarea name="menu" required maxlength="500" rows="2">${esc(meal.menu)}</textarea></label>
    <label>Recipe suggestion (optional)<input name="recipe" maxlength="250" value="${esc(meal.recipe)}"></label>
    <label>What should everyone bring? (optional)<input name="byo" maxlength="250" value="${esc(meal.byo)}"></label>
    <small>People will see your changes the next time they open the meal.</small>${submit('Save menu and BYO')}</form></details>`;
}
function card(meal,opened=false) {
  let reply = meal.status==='cancelled' ? 'Cancelled' : meal.own ? (meal.visibility==='members'?'Open to members':'Invitation only') : labels[meal.invitation?.response] || 'Open invitation';
  return `<details class="meal-card" data-meal="${esc(meal.id)}" ${opened?'open':''}><summary><span><strong>${esc(meal.title)}</strong><small>${esc(timeOf(meal))}</small></span><span class="meal-state">${esc(reply)}</span></summary>
    <div class="meal-card-body"><p>Hosted by <strong>${esc(meal.hostName)}</strong></p>${mealInfo(meal)}
    ${meal.status==='cancelled'?'<p>This meal has been cancelled.</p>':`${!meal.own && !meal.location ? '<p class="meal-note">Reply that you’re going to see the exact meeting place.</p>' : ''}
    ${contributions(meal)}${meal.own ? `${menuEditor(meal)}<details class="meal-edit"><summary>Change guest places</summary><form data-form="updatePlaces" class="meal-form">${limitField(meal.guestLimit)}${submit('Save guest places')}</form></details>${invitePanel(meal)}<details class="meal-cancel"><summary>Cancel this meal</summary><p>This closes the meal and stops new replies.</p>${btn('cancel','Confirm cancellation')}</details>` : rsvpForm(meal)}`}
    </div></details>`;
}
function hostForm(buttonLabel='Create meal') {
  return `<form data-form="create" class="meal-form meal-create"><h3>Host a shared meal</h3>
  <label>Give your meal a name<input name="title" maxlength="80" required placeholder="e.g. Sunday beach barbecue"></label>
    <label>Your name for the invitation<input name="hostName" maxlength="60" required autocomplete="name"></label>
    <div class="meal-pair"><label>Day<input required type="date" name="date" min="${dateMinimum()}"></label><label>Time in Queensland<input required type="time" name="time"></label></div>
    <div class="meal-pair"><label>Where will you host?<select name="venueType"><option value="home">At home</option><option value="bbq">At a public barbecue</option></select></label>
    <label>Who can come?<select name="visibility"><option value="invited">Only people I invite</option><option value="members">Open invitation to club members</option></select></label></div>
    <label>Suburb or town<input name="area" required maxlength="80" autocomplete="off"><small>This is the only location shown before someone accepts.</small></label>
    <label><span data-location-label>House number and street</span><input name="location" required maxlength="200" autocomplete="off"><small>Only guests who say they’re coming will see these details.</small></label>
    ${limitField(null)}
  <label>What's on the menu?<textarea name="menu" required maxlength="500" rows="2" aria-describedby="meal-menu-hint" placeholder="e.g. Barbecue lunch and salads"></textarea></label>
    <div class="meal-ideas"><small id="meal-menu-hint">Write your own menu or use an idea below. Each idea fills the empty menu and recipe boxes for you to edit.</small><div>${mealIdeas.map(([name],i)=>`<button class="button outline small" type="button" data-action="idea" data-idea="${i}">${name}</button>`).join('')}</div><small role="status" data-idea-status></small></div>
    <details class="meal-edit"><summary>Recipes, BYO and jobs (optional)</summary>
  <label>Recipe suggestion<input name="recipe" maxlength="250" placeholder="e.g. Your favourite shared salad"></label>
      <label>What should everyone bring?<input name="byo" maxlength="250" placeholder="e.g. A plate, chair and a water bottle"></label>
      <fieldset><legend>Jobs people can put their hand up for</legend>${chores.map(job=>`<label class="meal-check"><input type="checkbox" name="jobs" value="${job}"> ${job}</label>`).join('')}</fieldset>
      <small>Guests can also offer their own side dish, dessert, playlist or speaker with their reply.</small></details>
    <div class="meal-actions">${submit(buttonLabel)}${btn('close-create','Back')}</div></form>`;
}

function rsvpValues(form) {
  const data = new FormData(form), going = data.get('response') === 'going';
  return {response:going?'going':'declined', partySize:going?Number(data.get('partySize')):1,
    dietary:going?String(data.get('dietary')||'').trim():'',sideDish:going?String(data.get('sideDish')||'').trim():'',
    contribution:going?String(data.get('contribution')||'').trim():''};
}
function onFormChange(event) {
  if (event.target.name === 'response') event.target.form.querySelector('[data-going]').hidden = event.target.value !== 'going';
  if (event.target.name === 'venueType') event.target.form.querySelector('[data-location-label]').textContent = event.target.value === 'bbq' ? 'Public venue name, address or meeting directions' : 'House number and street';
}

function applyMenuIdea(button) {
  const form=button.form, [,menu,recipe]=mealIdeas[Number(button.dataset.idea)];
  const filled=[];
  if(!form.elements.menu.value.trim()){form.elements.menu.value=menu;filled.push('menu');}
  if(!form.elements.recipe.value.trim()){form.elements.recipe.value=recipe;filled.push('recipe suggestion');form.elements.recipe.closest('details').open=true;}
  form.querySelector('[data-idea-status]').textContent=filled.length?'Added the '+filled.join(' and ')+'. You can edit either box.':'Both boxes already have text. Clear a box first if you’d like to use this idea.';
}

function showWebmasterMeals(host, meals) {
  host.innerHTML=`<div class="meals"><header class="meal-heading"><div><h2>Shared meals</h2><p>Meet after a game or gather around a public barbecue.</p></div></header>
    <section class="meal-section"><h3>Open invitations</h3>${meals.length?meals.map(m=>`<details class="meal-card"><summary><span><strong>${esc(m.title)}</strong><small>${esc(timeOf(m))} · ${esc(m.area)}</small></span></summary><div class="meal-card-body">${mealInfo(m)}${m.jobs.length?'<p><strong>Shared jobs</strong> · '+m.jobs.map(j=>esc(j.label)).join(', ')+'</p>':''}</div></details>`).join(''):'<p>No member has posted an open invitation yet.</p>'}</section>
  <section class="meal-review" data-meal-review><h3>See how members share a meal</h3><p>Try the host and guest screens with a fictional beach picnic. Edits stay on this screen.</p>
      <div class="meal-actions"><button class="button small" type="button" aria-pressed="false" data-show="host">Plan the meal as host</button><button class="button outline small" type="button" aria-pressed="false" data-show="guest">Reply as a guest</button></div>
      <div data-review-body></div><p role="status" data-review-status></p></section></div>`;
  const review=host.querySelector('[data-meal-review]'), body=review.querySelector('[data-review-body]'), feedback=review.querySelector('[role=status]');
  let meal={id:'example',title:'Beach picnic after the game',hostName:'Example host',date:new Date(Date.now()+7*86400000+10*3600000).toISOString().slice(0,10),time:'12:00',venueType:'bbq',visibility:'members',area:'Example town',location:'Example picnic shelter beside the barbecue',guestLimit:6,menu:mealIdeas[0][1],recipe:mealIdeas[0][2],byo:'A plate, water bottle and folding chair',jobs:['Bring a side dish','Bring the music'].map((label,index)=>({label,index})),status:'upcoming',shared:[],invitation:null};
  let externalGuest=false;
  function display(mode,message='') {
    for(const button of review.querySelectorAll('[data-show]'))button.setAttribute('aria-pressed',String(button.dataset.show===mode));
    body.replaceChildren();
    feedback.textContent=message;
    if(mode==='host'){
      body.innerHTML=hostForm('Preview this invitation');
      const form=body.querySelector('form');
      for(const name of ['title','hostName','date','time','venueType','visibility','area','location','menu','recipe','byo'])form.elements[name].value=meal[name];
      form.elements.guestLimit.value=meal.guestLimit??'';
      for(const box of form.querySelectorAll('[name=jobs]'))box.checked=meal.jobs.some(j=>j.label===box.value);
      onFormChange({target:form.elements.venueType});
      if(meal.invitation)body.insertAdjacentHTML('beforeend',`<p><strong>Example guest’s reply</strong> · ${esc(labels[meal.invitation.response])}${meal.invitation.response==='going'?' · '+esc(meal.invitation.partySize)+' attending':''}</p>${meal.shared.map(s=>'<p>'+[s.sideDish,s.contribution,s.dietary].filter(Boolean).map(esc).join(' · ')+'</p>').join('')}`);
      form.querySelector('h3').setAttribute('tabindex','-1');form.querySelector('h3').focus();
    } else if(mode==='guest'){
      const going=meal.invitation?.response==='going';
      const guest={...meal,own:false,location:going?meal.location:'',placesLeft:meal.guestLimit===null?null:meal.guestLimit-(going?meal.invitation.partySize:0),invitation:meal.invitation || (externalGuest||meal.visibility==='invited'?{response:'pending'}:null)};
      body.innerHTML=`<div class="meal-card meal-card-body"><h4 tabindex="-1">${esc(meal.title)}</h4><label class="meal-form">See the invitation as<select data-review-recipient><option value="member">A club member</option><option value="friend" ${externalGuest?'selected':''}>A friend with a private guest link</option></select></label>
        <p>${externalGuest?'Private guest invitation':meal.visibility==='invited'?'Personal member invitation':'Open invitation to club members'} · Hosted by ${esc(meal.hostName)}</p>${mealInfo(guest)}
        ${going?'':'<p class="meal-note">Guests see the exact meeting point after they accept.</p>'}${contributions(guest)}${rsvpForm(guest,externalGuest)}</div>`;
      body.querySelector('h4').focus();
    }
  }
  review.addEventListener('change',e=>{
    if(e.target.matches('[data-review-recipient]')){
      externalGuest=e.target.value==='friend';meal.invitation=null;meal.shared=[];
      meal.jobs.forEach(j=>{j.taken=false;j.mine=false;});display('guest');review.querySelector('[data-review-recipient]').focus();
    }
  });
  review.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.show)display(b.dataset.show);
    if(b.dataset.action==='idea')applyMenuIdea(b);
    if(b.dataset.action==='close-create'){display('');review.querySelector('[data-show=host]').focus();}
    if(b.dataset.action==='job'){
      const job=meal.jobs.find(j=>j.index===Number(b.dataset.index));if(!job)return;
      job.taken=job.mine=b.dataset.claim==='true';display('guest',job.taken?'Job added to the example reply.':'Job available again.');
    }
  });
  review.addEventListener('submit',e=>{
    const form=e.target;e.preventDefault();
    if(form.dataset.form==='create'){
      const values=new FormData(form);
      const jobs=values.getAll('jobs').map((label,index)=>({...meal.jobs.find(j=>j.label===label),label,index}));
      const guestLimit=readLimit(form);
      if(guestLimit!==null && meal.invitation?.response==='going' && meal.invitation.partySize>guestLimit){
        feedback.textContent='Keep a place for everyone who has already accepted.';form.elements.guestLimit.focus();return;
      }
      meal={...meal,...Object.fromEntries(values),jobs,guestLimit};
      display('guest','Invitation updated. This is what a guest sees.');
    } else if(form.dataset.form==='rsvp'){
      meal.invitation=rsvpValues(form);
      meal.shared=meal.invitation.response==='going'?[meal.invitation]:[];
      if(meal.invitation.response!=='going')meal.jobs.forEach(j=>{j.mine=false;j.taken=false;});
      display('guest','Example reply saved. Open the host screen to see the result.');
    }
  });
}

export function setupSharedMeals({api}) {
  const host = document.getElementById('member-meals');
  if (!host) return;
  let session, access, controller, meals = [], opened = '', createId = '', busy = false, pageHidden = false;
  const active = () => !pageHidden && location.hash === '#members/meals' && session?.authenticated && session.storageReady;
  function reset() {
    controller?.abort(); controller=null; meals=[]; opened=''; createId=''; busy=false; host.replaceChildren();
  }
  function status(message) { const el=host.querySelector('[data-status]'); if (el) el.textContent=message; }
  function render(message='') {
    const section = (key,title,items,empty) => `<section class="meal-section"><h3 data-meal-section="${key}">${title}</h3>${items.length ? items.map(m=>card(m,m.id===opened)).join('') : '<p>'+empty+'</p>'}</section>`;
    host.innerHTML = `<div class="meals"><header class="meal-heading"><div><h2>Shared meals</h2><p>Set a table for friends or join a barbecue with other members.</p></div>${createId||session?.readOnly||session?.showcase||session?.demo?'':btn('create','Host a meal','')}</header>
      <p data-status role="status"></p>${createId ? hostForm() : `${section('invitations','Your invitations',meals.filter(m=>!m.own && m.invitation),'You have no personal invitations yet.')}
      ${section('open','Open invitations',meals.filter(m=>!m.own && !m.invitation && m.status!=='cancelled'),'There are no open meals at the moment.')}
      ${section('hosting','Meals you’re hosting',meals.filter(m=>m.own),'Your next meal will appear here when you create it.')}
      <a class="text-link" data-meal-recipes href="#members/recipes">Look through the member recipe book</a>`}</div>`; status(message);
  }
  function gate() {
    host.innerHTML=session?.role==='committee' ? '<div class="meals"><h2>Shared meals</h2><p>Use your personal member account to host a meal or see invitations sent to you. Shared meals follow the age and sharing settings on that account.</p></div>' : '<div class="meals"><h2>Shared meals</h2><p>Open My access and safety to check your age group and sharing permission for member invitations.</p><a class="button outline" href="#members/safety">My access and safety</a></div>';
  }
  async function load(signal,message='') {
    const result=await api(memberApi,{signal}); if(signal.aborted) return;
    meals=result.meals || [];
    if(result.mode==='webmaster'){showWebmasterMeals(host,meals);return;}
    render(message);
  }
  async function navigate() {
    if (!active()) {reset();return;}
    if (access===false && session.role!=='committee') {reset();gate();return;}
    if (controller) return;
    controller=new AbortController(); const signal=controller.signal;
    host.innerHTML='<div class="meals"><h2>Shared meals</h2><p role="status">Opening your invitations…</p></div>';
    try {await load(signal);} catch(error) {
      if(signal.aborted)return;
      if(error.status===403){reset();gate();return;}
      host.innerHTML='<div class="meals"><h2>Shared meals</h2><p data-status role="status"></p>'+btn('retry','Try again')+'</div>';status(error.message);
    }
  }
  function showLink(cardEl,token,name) {
    const el=cardEl.querySelector('[data-new-link]');
    el.innerHTML='<div class="meal-private-link"><label>Private invitation for <strong></strong><input type="text" readonly spellcheck="false" autocomplete="off" aria-label="Private guest invitation link"></label>'+btn('copy','Copy private link')+'<small>Send this to your guest yourself. One person can claim it. Once they reply, they can reopen it on the same browser.</small><small data-copy-status role="status"></small></div>';
    el.querySelector('strong').textContent=name; el.querySelector('input').value = location.origin+'/meal-invite.html#'+encodeURIComponent(token);
    el.querySelector('button').focus();
  }
  async function interact(event) {
    // A preview can replace its form before this event reaches the live meal handler.
    if(event.composedPath().some(node=>node.hasAttribute?.('data-meal-review')))return;
    const form=event.type==='submit' ? event.target : null, button=form?(event.submitter || form.querySelector('[type=submit]')):event.target.closest('button[data-action]');
    if(form)event.preventDefault();
    if(!button || !controller)return;
    const action=form?.dataset.form || button.dataset.action, cardEl=button.closest('[data-meal]');
    if((session?.readOnly||session?.showcase||session?.demo) && !['copy','retry'].includes(action)){status('This is a view-only club workspace.');return;}
    const meal=meals.find(m=>m.id===cardEl?.dataset.meal), row=button.closest('[data-invite]');
    if(action==='copy') {
      const box=button.closest('.meal-private-link'), input=box.querySelector('input');
      try {await navigator.clipboard.writeText(input.value);box.querySelector('[data-copy-status]').textContent='Link copied. Paste it into your message to your guest.';}
      catch {input.focus(); input.select();box.querySelector('[data-copy-status]').textContent='Select Copy on the highlighted link, then paste it into your message.';}return;
    }
    if(busy)return;
    if(action==='retry'){reset();navigate();return;}
    if(action==='create' && !form){createId=crypto.randomUUID();render();host.querySelector('[name=title]').focus();return;}
    if(action==='close-create'){createId='';render();host.querySelector('[data-action=create]')?.focus();return;}
    if(action==='idea'){
      applyMenuIdea(button);
      return;
    }
    if(cardEl)opened=cardEl.dataset.meal;
    const signal=controller.signal, formData=form ? new FormData(form) : null;
    busy=true; button.disabled=true; let local;
    const say = message => {if(!local){local=document.createElement('p');local.setAttribute('role','status');local.dataset.localStatus=''; const place=form || button.parentElement;place.querySelector('[data-local-status]')?.remove();place.append(local);}local.textContent=message;};
    try{
      if(action==='search') {
        const term=String(formData.get('name')||'').trim();
        if(term.length===1){say('Enter at least two letters, or leave the box empty to see your friends.');return;}
        const result=await api(memberApi+'?q='+encodeURIComponent(term),{signal});if(signal.aborted)return;
        const list=form.parentElement.querySelector('[data-people]');
        list.innerHTML=result.people?.length ? '<ul class="meal-people">'+result.people.map(p=>`<li><span>${esc(p.displayName)}</span><button class="button outline small" type="button" data-action="inviteMember" data-peer="${esc(p.id)}">Invite</button></li>`).join('')+'</ul>' : '<p>No matching members. Try another name or make a private guest link.</p>';return;
      }
      if(action==='inviteGuest'||action==='reissue'){
        const name=row?.dataset.name || String(formData.get('name')).trim();
        const id=row?.dataset.invite || (form.dataset.name===name && form.dataset.inviteId ? form.dataset.inviteId : crypto.randomUUID());
        if(form){form.dataset.name=name;form.dataset.inviteId=id;}
        const result=await send(api,memberApi,{action:'inviteGuest',mealId:meal.id,name,id},signal);
        if(signal.aborted)return;
        showLink(cardEl,result.token,name);
        try {await load(signal);if(!signal.aborted){const next=host.querySelector('[data-meal="'+CSS.escape(meal.id)+'"]');if(next)showLink(next,result.token,name);}}
        catch {if(!signal.aborted)status('The link is ready. Reopen Shared meals to refresh the guest list.');}return;
      }
      let payload, message;
      if(action==='create'){
        payload=Object.fromEntries(formData);Object.assign(payload,{action,id:createId,jobs:formData.getAll('jobs'),guestLimit:readLimit(form)});message='Meal created. Choose a club member or make a guest link below.';
      } else if(action==='updatePlaces'){
        payload={action,mealId:meal.id,guestLimit:readLimit(form)};message='Guest places updated.';
      } else if(action==='updateMenu'){
        payload={action,mealId:meal.id,menu:formData.get('menu'),recipe:formData.get('recipe'),byo:formData.get('byo')};
        message='Menu and BYO updated. Your guests will see the changes when they open the meal.';
      } else if(action==='inviteMember'){payload={action,id:button.dataset.requestId ||= crypto.randomUUID(),mealId:meal.id,peerId:button.dataset.peer};message='Invitation added to their Shared meals.';}
      else if(action==='rsvp'){
        const values=rsvpValues(form);
        if(!meal.invitation && values.response==='declined'){say('You can leave this open invitation without joining.');return;}
        payload=meal.invitation ? {action,inviteId:meal.invitation.id,...values} : {action:'join',id:form.dataset.requestId ||= crypto.randomUUID(),mealId:meal.id,...values};
        message=values.response==='going'?'You’re on the guest list. The exact meeting place is below.':'Your reply has been saved.';
      } else if(action==='job'){payload={action,mealId:meal.id,jobIndex:Number(button.dataset.index),claim:button.dataset.claim==='true'};message=payload.claim?'That job is yours.':'The job is open again.';}
      else if(action==='revoke'){payload={action,mealId:meal.id,inviteId:row.dataset.invite};message='Invitation withdrawn.';}
      else if(action==='cancel'){payload={action,mealId:meal.id};message='Meal cancelled.';}
      else return;
      await send(api,memberApi,payload,signal); if(signal.aborted)return;
      if(action==='create'){opened=createId;createId='';}
      await load(signal,message);
      if(!signal.aborted && opened)host.querySelector('[data-meal="'+CSS.escape(opened)+'"] > summary')?.focus();
    }catch(error){if(!signal.aborted)say(error.message);}
    finally{if(!signal.aborted){busy=false;button.disabled=false;}}
  }
  host.addEventListener('change',onFormChange);host.addEventListener('submit',interact);host.addEventListener('click',interact);
  window.addEventListener('plfc:navigated',navigate);
  window.addEventListener('plfc:session-changed',({detail})=>{reset();session=detail;access=undefined;navigate();});
  window.addEventListener('plfc:safeguards',({detail})=>{access=detail?.socialAccess;navigate();});
  window.addEventListener('pagehide',()=>{pageHidden=true;reset();},{capture:true});
  window.addEventListener('pageshow',e=>{pageHidden=false;if(e.persisted)navigate();});
}

export function setupGuestMeal(host = document.getElementById('guest-meal')) {
  if (!host) return;
  let controller, meal, token, busy;
  const api = async (path, options) => {
    const response = await fetch(path,{...options,cache:'no-store',credentials:'same-origin',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(typeof data.error==='string'?data.error:data.error?.message || 'The clubhouse could not open this invitation. Try again.');
      error.status=response.status;throw error;
    }
    return data;
  };
  const notification = message => {const n=host.querySelector('[data-guest-status]');if(n)n.textContent=message;};
  function render(message='') {
    host.innerHTML=`<div class="meal-guest-title"><h2>${esc(meal.title)}</h2><p>Hosted by <strong>${esc(meal.hostName)}</strong></p></div>
      <div data-guest-status role="status"></div>${mealInfo(meal)}${meal.status==='cancelled'?'<p>The host has cancelled this meal.</p>':`
      ${meal.invitation?.response==='going'?'<p class="meal-note">You’re on the guest list. Open this link in the same browser to change your reply.</p>':meal.invitation?.response==='declined'?'<p class="meal-note">You have told the host you can’t make it.</p>':'<p class="meal-note">Reply that you’re going to see the exact meeting place. This invitation can be claimed once.</p>'}
      ${contributions(meal)}${rsvpForm(meal,true)}`}`;
    notification(message);
  }
  function unavailable(message,retry) {
    meal=null;
    host.innerHTML='<h2>Invitation unavailable</h2><p data-guest-status role="status"></p>'+(retry ? btn('retry','Try again') : '<p>Ask your host for a new link if you still want to attend.</p>');
    notification(message);
  }
  async function open() {
    controller?.abort();controller=new AbortController();busy=false; const signal=controller.signal;
    try{token=decodeURIComponent(location.hash.slice(1));}catch{token='';}
    if(!token || token.length>400){unavailable('Open the complete private link your host gave you.',false);return;}
    host.innerHTML='<p data-guest-status role="status">Opening your private meal invitation…</p>';
    try{
      const result=await send(api,guestApi,{action:'view',token},signal);if(signal.aborted)return;
      meal=result.meal;render();
    }catch(error){if(!signal.aborted)unavailable(error.message,!(error.status>=400 && error.status<500 && error.status!==429));}
  }
  async function respond(e) {
    const form=e.type==='submit'?e.target:null, button=form?(e.submitter || form.querySelector('[type=submit]')):e.target.closest('button[data-action]');
    if(form)e.preventDefault();
    if(!button)return;
    if(button.dataset.action==='retry'){open();return;}
    if(!meal || busy)return;
    const signal=controller.signal;
    const payload=form ? {action:'rsvp',token,...rsvpValues(form),ageConfirmed:form.elements.ageConfirmed.checked}
      : {action:'job',token,jobIndex:Number(button.dataset.index),claim:button.dataset.claim==='true'};
    busy=true;button.disabled=true;
    try {
      const result=await send(api,guestApi,payload,signal);if(signal.aborted)return;
      meal=result.meal;render(form ? 'Your reply has been saved.' : payload.claim?'That job is yours.':'The job is open again.');
      const status=host.querySelector('[data-guest-status]');status.tabIndex=-1;status.focus();
    } catch(error) {
      if(signal.aborted)return;
      if([403,404,410].includes(error.status)){unavailable(error.message,false);return;}
      const status=host.querySelector('[data-guest-status]');notification(error.message);status.tabIndex=-1;status.focus();
    } finally {if(!signal.aborted){busy=false;button.disabled=false;}}
  }
  host.addEventListener('change',onFormChange);host.addEventListener('submit',respond);host.addEventListener('click',respond);
  window.addEventListener('hashchange',open);
  window.addEventListener('pagehide',()=>{controller?.abort();host.replaceChildren();meal=null;token='';});
  window.addEventListener('pageshow',e=>{if(e.persisted)open();});open();
}

if (typeof document !== 'undefined' && document.getElementById('guest-meal')) setupGuestMeal();
