const committeePath = '/api/committee/equipment-wishes';
const memberPath = '/api/member/equipment-wishes';
const number = new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'});
const date = new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const qldDay = new Intl.DateTimeFormat('en-CA',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Australia/Brisbane'});
const money = cents => number.format(cents / 100).replace(/\.00$/,'');
const day = iso => date.format(new Date(iso+'T12:00:00+10:00'));
const closed = wish => wish.status === 'fulfilled';
const button = (action,label,primary=false) => '<button type="button" class="button '+(primary?'':'outline small')+'" data-wish-action="'+action+'">'+label+'</button>';
const memberHome = '<a class="text-link" href="#members">Member home</a>';
const exampleWish = {id:'example-wish',name:'Portable net and posts',goalCents:0,totalCents:0,history:[]};

function purposeWithSource(purpose, esc) {
  const suffix=/(?:^|\s)(https:\/\/[^\s<>"'\\]+)\s*$/u.exec(purpose);
  if (!suffix) return esc(purpose);
  let url;
  try { url=new URL(suffix[1]); } catch { return esc(purpose); }
  if (url.protocol!=='https:' || url.username || url.password) return esc(purpose);
  const description=purpose.slice(0,suffix.index).trimEnd();
  const source='<a class="text-link" rel="noreferrer" href="'+esc(url.href)+'">Read the source at '+esc(url.host)+'</a>';
  return (description?esc(description)+'<br>':'')+source;
}

function overview(wish, esc) {
  const {goalCents:goal,totalCents:total} = wish;
  if (!goal) return '';
  const remainder = Math.max(0, goal-total);
  return '<div class="wish-totals"><div><span>Raised</span><strong>'+money(total)+'</strong></div><div><span>Target</span><strong>'+money(goal)+'</strong></div><div><span>Remaining</span><strong>'+money(remainder)+'</strong></div></div>'+
    '<progress class="wish-progress" aria-label="'+esc(wish.name)+' fundraising progress" value="'+Math.min(goal,total)+'" max="'+goal+'" aria-valuetext="'+money(total)+' raised towards '+money(goal)+'"></progress>'+
    (total>goal?'<p class="wish-surplus">'+money(total-goal)+' above target.</p>':'');
}

function history(wish, esc) {
  const points = wish.history;
  if (!points.length) return wish.goalCents?'<p class="wish-no-history">The Treasurer has yet to record a receipt.</p>':'';
  const high = points.reduce((highest,p)=>Math.max(highest,p.totalCents),1);
  const firstDate = Date.parse(points[0].day), span = Date.parse(points.at(-1).day)-firstDate;
  const positions = points.map(p=>[span?8+224*(Date.parse(p.day)-firstDate)/span:120,68-60*p.totalCents/high].map(n=>Number(n.toFixed(3))));
  const trace = positions.map(([x,y],i)=>i?'H'+x+'V'+y:'M'+x+' '+y).join(' ');
  const [x,y] = positions.at(-1);
  const options = points.map((p,i)=>'<option value="'+i+'"'+(i===points.length-1?' selected':'')+'>'+day(p.day)+'</option>').join('');
  return '<details class="wish-history" data-wish-chart="'+esc(wish.id)+'"><summary>Explore fundraising history</summary><div class="wish-history-inner">'+
    '<svg data-wish-plot="'+positions.map(pair=>pair.join(',')).join(' ')+'" aria-hidden="true" focusable="false" viewBox="0 0 240 76" preserveAspectRatio="none"><path class="wish-baseline" d="M8 68H232"/><path class="wish-trace" d="'+trace+'"/><circle data-wish-point cx="'+x+'" cy="'+y+'" r="4"/></svg>'+
    '<div class="wish-chart-dates"><span>'+day(points[0].day)+'</span>'+(points.length>1?'<span>'+day(points.at(-1).day)+'</span>':'')+'</div>'+
    '<div class="wish-chart-key"><span>Running total</span><strong data-wish-total aria-live="polite">'+money(points.at(-1).totalCents)+'</strong></div>'+
    '<label>Choose a recorded day<select data-wish-day>'+options+'</select></label></div></details>';
}

function exploreCharts(host,wishes,signal) {
  function choose(chart,index) {
    const points = wishes().find(w=>w.id===chart.dataset.wishChart)?.history;
    const point = points?.[index];
    if (!point) return;
    const coords = chart.querySelector('[data-wish-plot]').dataset.wishPlot.split(' ')[index].split(',');
    const dot = chart.querySelector('[data-wish-point]');
    dot.setAttribute('cx',coords[0]); dot.setAttribute('cy',coords[1]);
    chart.querySelector('[data-wish-day]').value=String(index);
    chart.querySelector('[data-wish-total]').textContent=money(point.totalCents);
  }
  host.addEventListener('change',event=>{
    if (!event.target.matches('[data-wish-day]')) return;
    choose(event.target.closest('[data-wish-chart]'),Number(event.target.value));
  },{signal});
  host.addEventListener('click',event=>{
    const plot=event.target.closest('[data-wish-plot]');
    if(!plot)return;
    const rect=plot.getBoundingClientRect(), x=240*(event.clientX-rect.left)/rect.width;
    const distances=plot.dataset.wishPlot.split(' ').map(pair=>Math.abs(Number(pair.split(',')[0])-x));
    const closest=distances.reduce((best,distance,i)=>distance<distances[best]?i:best,0);
    choose(plot.closest('[data-wish-chart]'),closest);
  },{signal});
}

function tag(wish) {
  return '<span class="wish-tag">'+(closed(wish)?'Wish fulfilled':wish.goalCents?'Fundraising':'Goods or help wanted')+'</span>';
}

export function setupEquipmentWishes({api,esc}) {
  const host = document.getElementById('member-equipment-wishes');
  if (!host) return;
  let session,controller;
  function clear() {
    controller?.abort(); controller = undefined; host.replaceChildren();
  }
  async function read() {
    clear();
    const signal = (controller=new AbortController()).signal;
    host.innerHTML = '<p role="status">Opening the equipment wish list…</p>';
    try {
      const {wishes} = await api(memberPath,{cache:'no-store',signal});
      if (signal.aborted) return;
      const cards = wishes.map(w=>'<article class="wish-card">'+tag(w)+'<h3>'+esc(w.name)+'</h3><p class="wish-purpose">'+purposeWithSource(w.purpose,esc)+'</p>'+overview(w,esc)+history(w,esc)+'</article>').join('');
      host.innerHTML = '<section class="wish-room">'+memberHome+'<header class="wish-hero"><h2>Equipment wish list</h2><span>If you can lend gear, share a skill or contribute to a wish, speak with the committee.</span></header>'+
        (cards?'<div class="wish-grid">'+cards+'</div>'+(wishes.some(w=>w.goalCents)?'<p class="wish-footnote">Fundraising totals come from receipts and corrections recorded by the Treasurer.</p>':''):'<div class="wish-empty"><h3>No wishes published yet</h3><p>When the committee shares a wish, you’ll see what the club needs and how members can help.</p>'+
          '<details class="wish-example"><summary>See an example</summary><article class="wish-card"><span class="wish-tag">Illustration only</span><h3>Portable net and posts</h3><p>An example equipment wish for a flexible sand court. The committee has not set a target or recorded contributions.</p>'+
          overview(exampleWish,esc)+history(exampleWish,esc)+'</article></details></div>')+'</section>';
      exploreCharts(host,()=>wishes.length?wishes:[exampleWish],signal);
    } catch(error) {
      if (signal.aborted) return;
      host.innerHTML = memberHome+'<p role="alert">'+esc(error.message)+'</p>'+button('retry','Try again');
      host.querySelector('button').addEventListener('click',read,{signal});
    }
  }
  function navigate() {
    if (location.hash!=='#members/equipment-wishes' || !session?.authenticated || !session.storageReady) { if(controller) clear(); return; }
    if (!controller) read();
  }
  window.addEventListener('plfc:navigated',navigate);
  window.addEventListener('plfc:session-changed',({detail})=>{clear();session=detail;navigate();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',event=>{if(event.persisted)navigate();});
}

function parseMoney(value) {
  const groups = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!groups) throw Error('Enter the amount in dollars, for example 25 or 25.50.');
  return Number(groups[1])*100+Number((groups[2]||'').padEnd(2,'0'));
}
const amountField = (name,label,value='') => '<label>'+label+'<input type="text" name="'+name+'" value="'+value+'" inputmode="decimal" maxlength="13" required></label>';

export function openCommitteeWishes(host,{api,esc,rememberWishes,readOnly=false},signal,target={}) {
  let data, selected=target.wishId, view = 'list', busy = false, createId, retry;
  let searchText='';
  let sourceId=selected?null:target.grantId, sourceGrant, funding, register, grantError='';
  const grantPath='/api/committee/grants';
  const chosen = ()=>data?.wishes.find(w=>w.id===selected);
  const back = '<button type="button" class="text-link" data-equipment="list">Back to equipment register</button>';
  function shell(html) {
    host.innerHTML = '<section class="wish-room">'+html+'<p class="wish-message" data-wish-status role="status" aria-live="polite"></p></section>';
    if(readOnly) {
      for(const control of host.querySelectorAll('[data-wish-action]'))
        if(!['list','detail','retry','retry-funding','refresh'].includes(control.dataset.wishAction))control.hidden=true;
      host.querySelector('[data-wish-form]')?.remove();
    }
  }
  function heading() {host.querySelector('[data-wish-heading]')?.focus();}
  function message(text,error=false) {
    const node=host.querySelector('[data-wish-status]');
    if(node){node.setAttribute('role',error?'alert':'status');node.textContent=text;}
  }
  async function readFunding() {
    try {
      [funding,register]=await Promise.all([import('./wish-funding.js?v=20261121-practical-wishes'),api(grantPath,{signal,cache:'no-store'})]);
      grantError='';
    } catch(error) {
      register=null;grantError=error.message||'Grant details could not be loaded.';
    }
  }
  function fundingStatus() {
    return '<h2>Grants for this wish</h2><p role="alert">Grant details could not be loaded.</p>'+button('retry-funding','Try grants again');
  }
  function list() {
    view = 'list'; selected = null; sourceId=null;sourceGrant=null;
    rememberWishes?.({});
    const rows = data.wishes.map(w=>{
      const count=register?.grants.filter(grant=>grant.wishIds.includes(w.id)).length;
      return '<li><div><button type="button" class="text-link" data-wish-id="'+esc(w.id)+'">'+esc(w.name)+'</button><p>'+(closed(w)?'Fulfilled':w.goalCents?money(w.totalCents)+' raised of '+money(w.goalCents):'Goods or help wanted')+
        (count?' · '+count+' linked grant'+(count===1?'':'s'):'')+'</p></div><span class="wish-tag">'+(w.published?'Members can see this':'Committee only')+'</span></li>';
    }).join('');
    shell(back+'<h1 tabindex="-1" data-wish-heading>Equipment wish list</h1><p>Ask for equipment, a loan or help with a project. Publish a wish when it is ready for members.</p>'+
      button('create','Add a wish',true)+(rows?
        '<div class="wish-search" role="search" aria-label="Equipment wishes"><label>Find a wish<input type="search" maxlength="160" placeholder="Try portable net, first aid or lighting" data-wish-search aria-controls="committee-wish-results"></label>'+
        '<button type="button" class="text-link" data-wish-clear>Clear search</button></div><p class="wish-search-status" role="status" data-wish-count></p>'+
        '<ul class="wish-list" id="committee-wish-results">'+rows+'</ul>':'<p class="wish-empty">The committee has not added an equipment wish yet.</p>'));
    if(!rows)return;
    const input=host.querySelector('[data-wish-search]'),clear=host.querySelector('[data-wish-clear]');
    const status=host.querySelector('[data-wish-count]'),items=Array.from(host.querySelectorAll('.wish-list > li'));
    const normalise=text=>text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const index=data.wishes.map(w=>normalise(w.name+' '+w.purpose.replace(/https?:\/\/\S+/gi,'')));
    function filter() {
      searchText=input.value;
      const words=normalise(searchText).split(/\s+/).filter(Boolean);
      let matches=0;
      for(const [i,item] of items.entries()){
        item.hidden=!words.every(word=>index[i].includes(word));
        if(!item.hidden)matches++;
      }
      clear.hidden=!searchText;
      status.textContent=words.length && !matches?'No wishes match. Try another word or clear the search.':
        words.length?matches+' of '+items.length+' wishes shown.':items.length+(items.length===1?' wish':' wishes');
    }
    input.value=searchText;
    input.addEventListener('input',filter);
    clear.addEventListener('click',()=>{input.value='';filter();input.focus();});
    filter();
  }
  function detail() {
    const w = chosen();
    if(!w) return list();
    view = 'detail';
    rememberWishes?.({wishId:w.id});
    const ledger = w.ledger.map(row=>'<li><div><strong>'+esc(row.kind==='receipt'?'Money received':'Correction')+' · '+money(row.amountCents)+'</strong><span>'+day(row.onDate)+' · '+esc(row.actor)+'</span></div><p>'+esc(row.note)+'</p></li>').join('');
    shell(button('list','All equipment wishes')+'<h1 tabindex="-1" data-wish-heading>'+esc(w.name)+'</h1><p class="wish-purpose">'+purposeWithSource(w.purpose,esc)+'</p>'+
      '<div class="wish-tags">'+tag(w)+'<span class="wish-tag">'+(w.published?'Visible to members':'Committee only')+'</span></div>'+overview(w,esc)+history(w,esc)+
      '<div class="wish-tools">'+button('edit','Edit wish')+button(w.published?'unpublish':'publish',w.published?'Hide from members':'Publish to members')+
      button(closed(w)?'reopen':'fulfil',closed(w)?'Reopen wish':'Mark as fulfilled')+'</div>'+
      '<section class="wish-funding" data-wish-funding tabindex="-1" aria-label="Grants for this wish">'+(register?funding.fundingPanel(w,register,esc):fundingStatus())+'</section>'+
      (w.goalCents||ledger?'<section class="wish-ledger"><h2>Treasurer’s record</h2>'+
        (data.canRecordMoney && w.goalCents?'<div class="wish-tools">'+button('receipt','Record money received',true)+button('adjustment','Record a correction')+'</div>':'')+
        (ledger?'<details><summary>View entries ('+w.ledger.length+')</summary><ol>'+ledger+'</ol></details>':'<p>No entries recorded.</p>')+'</section>':''));
  }
  function editor(isNew) {
    view = isNew?'create':'edit';
    const w = isNew?null:chosen();
    const ideas=sourceGrant?funding.draftIdeas(sourceGrant,register.today):[];
    const prefill=ideas.find(idea=>idea.name===target.idea);
    if(isNew)createId=crypto.randomUUID();
    shell(button(isNew?'list':'detail',isNew?'All equipment wishes':'Back to wish')+'<h1 tabindex="-1" data-wish-heading>'+(isNew?'Add an equipment wish':'Edit equipment wish')+'</h1>'+
      (sourceGrant?'<div class="wish-grant-origin"><p>Grant to link when you save</p><strong data-wish-source-title>'+esc(sourceGrant.title)+'</strong></div>':'')+
      '<form class="wish-form" data-wish-form>'+
      (sourceGrant&&ideas.length?'<label>Start with an idea<select data-wish-idea><option value="">Describe our own wish</option>'+
        ideas.map(idea=>'<option value="'+esc(idea.name)+'"'+(idea===prefill?' selected':'')+'>'+esc(idea.name)+'</option>').join('')+'</select></label>':'')+
      '<label>Name for this wish<input name="name" required maxlength="100" value="'+esc(w?.name||prefill?.name||'')+'"></label>'+
      '<label>How would this help the club?<textarea name="purpose" rows="3" required maxlength="360">'+esc(w?.purpose||prefill?.purpose||'')+'</textarea></label>'+
      '<label>What does the club need?<select name="type"><option value="cash">Funds for this wish</option><option value="item"'+(sourceGrant||(w&&!w.goalCents)?' selected':'')+'>Goods, a loan or practical help</option></select></label>'+
      '<div data-wish-goal '+(w && !w.goalCents?'hidden':'')+'>'+amountField('amount','Fundraising target (AUD)',w?.goalCents?(w.goalCents/100).toFixed(2):'')+'</div>'+
      '<p>'+(isNew?'A new wish stays with the committee until you publish it.':w.published?'Members will see your saved changes.':'This wish is visible only to the committee.')+'</p>'+
      '<button class="button" type="submit">'+(sourceGrant?'Save draft and link to grant':isNew?'Save draft':'Save changes')+'</button></form>');
    toggleGoal();
  }
  function toggleGoal() {
    const f=host.querySelector('[data-wish-form]');
    if(!f?.elements.type) return;
    const inKind = f.elements.type.value==='item';
    f.querySelector('[data-wish-goal]').hidden=inKind;
    f.elements.amount.disabled=inKind;
  }
  function entry(kind) {
    view = kind;
    const w = chosen(), correcting = kind==='adjustment';
    const today=qldDay.format(new Date());
    shell(button('detail','Back to wish')+'<h1 tabindex="-1" data-wish-heading>'+(correcting?'Record a correction':'Record money received')+'</h1><p><strong>'+esc(w.name)+'</strong> · '+money(w.totalCents)+' raised</p>'+
      '<form class="wish-form" data-wish-form>'+
      (correcting?'<label>How should the total change?<select name="direction"><option value="subtract">Reduce the total</option><option value="add">Increase the total</option></select></label>':'<p>Record funds already received by the club.</p>')+
      amountField('amount','Amount (AUD)')+'<label>Date '+(correcting?'of correction':'received')+'<input type="date" name="onDate" max="'+today+'" value="'+today+'" required></label>'+
      '<label>'+(correcting?'Reason for correction':'Receipt reference or description')+'<textarea name="note" maxlength="500" required rows="3"></textarea></label>'+
      '<p>Only committee officers can read the note. Members can see the fundraising total and daily history.</p>'+
      '<button class="button" type="submit">'+(correcting?'Save correction':'Save receipt')+'</button></form>');
  }
  async function get(focus=true) {
    if(busy)return;
    busy=true;
    shell(back+'<p role="status">Opening equipment wishes…</p>');
    try{
      [data]=await Promise.all([api(committeePath,{signal,cache:'no-store'}),readFunding()]);
      if(signal.aborted)return;
      if(sourceId){
        sourceGrant=register?.grants.find(grant=>grant.id===sourceId);
        if(sourceGrant)editor(true);
        else if(grantError){
          shell(back+'<h1 tabindex="-1" data-wish-heading>Add an equipment wish</h1><p>The linked grant could not be loaded.</p>'+button('retry','Try again'));
        } else {list();message('This grant could not be found in the register.',true);}
      } else if(selected){
        if(chosen())detail();else {list();message('This equipment wish could not be found.',true);}
      } else list();
      if(focus)heading();
    }catch(error){
      if(!signal.aborted){shell(back+button('retry','Try again'));message(error.message,true);}
    }finally{busy=false;}
  }
  async function save(payload,notice) {
    if(busy || readOnly)return;
    busy=true;
    const key=JSON.stringify(payload);
    if(retry?.key!==key)retry={key,id:crypto.randomUUID()};
    const controls=Array.from(host.querySelectorAll('button:not([disabled])'));
    controls.forEach(b=>b.disabled=true);
    message('Saving…');
    try{
      data=await api(committeePath,{method:'POST',signal,body:JSON.stringify({...payload,mutationId:retry.id})});
      if(signal.aborted)return;
      if(sourceGrant){await readFunding();if(signal.aborted)return;sourceId=null;sourceGrant=null;}
      retry=null;selected=payload.id;detail();heading();message(notice);
    }catch(error){
      if(signal.aborted)return;
      message(error.message,true);
      if(error.status===409&&!host.querySelector('[data-wish-action="refresh"]')){
        host.querySelector('[data-wish-status]')?.insertAdjacentHTML('afterend',button('refresh',sourceGrant?'Review updated grant':'Load current wish'));
      }
    }finally{busy=false;controls.forEach(b=>b.disabled=false);}
  }
  async function refreshFunding() {
    if(busy)return;
    busy=true;
    try {
      message('Loading grants…');await readFunding();
      if(signal.aborted)return;
      if(sourceGrant){
        const latest=register?.grants.find(grant=>grant.id===sourceId);
        if(!latest){message('The source grant could not be loaded. Your draft is still here.',true);return;}
        sourceGrant=latest;host.querySelector('[data-wish-source-title]').textContent=latest.title;
        host.querySelector('[data-wish-action="refresh"]')?.remove();
        message('The grant is now at “'+register.stages[latest.stage]+'”. Review your wish and save when ready.');
      } else {detail();message(grantError?'Grant details are still unavailable.':'Grants updated.',!!grantError);}
    } finally {busy=false;}
  }
  async function updateLink(grantId,attach) {
    const grant=register?.grants.find(item=>item.id===grantId),w=chosen();
    if(!grant||!w||busy)return;
    busy=true;
    const panel=host.querySelector('[data-wish-funding]');
    panel.inert=true;message(attach?'Linking grant…':'Removing link…');
    try {
      register=await api(grantPath,{method:'POST',signal,body:JSON.stringify({action:attach?'linkWish':'unlinkWish',id:grant.id,version:grant.version,wishId:w.id})});
      if(signal.aborted)return;
      panel.innerHTML=funding.fundingPanel(w,register,esc);
      panel.inert=false;panel.focus();message(attach?'Grant linked to this wish.':'Grant link removed.');
    } catch(error) {
      if(signal.aborted)return;
      if(error.status===409){
        await readFunding();if(signal.aborted)return;
        panel.innerHTML=register?funding.fundingPanel(w,register,esc):fundingStatus();
      }
      message(error.message,true);
    } finally {busy=false;panel.inert=false;}
  }
  const changes={publish:'Published to members.',unpublish:'Hidden from members.',fulfil:'Wish marked as fulfilled.',reopen:'Wish reopened.'};
  exploreCharts(host,()=>data?.wishes||[],signal);
  host.addEventListener('click',event=>{
    const b=event.target.closest('[data-wish-action],[data-wish-id],[data-wish-unlink]');
    if(!b||busy)return;
    if(b.dataset.wishUnlink)return updateLink(b.dataset.wishUnlink,false);
    if(b.dataset.wishId){selected=b.dataset.wishId;detail();heading();return;}
    const action=b.dataset.wishAction;
    if(action==='retry-funding'||(action==='refresh'&&sourceGrant))return refreshFunding();
    if(action==='retry'||action==='refresh')return get();
    if(action==='list')list();
    else if(action==='detail')detail();
    else if(action==='create'||action==='edit')editor(action==='create');
    else if(action==='receipt'||action==='adjustment')entry(action);
    else if(Object.hasOwn(changes,action)){
      const w=chosen();
      if(w)return save({action,id:w.id,version:w.version},changes[action]);
    }
    heading();
  },{signal});
  host.addEventListener('change',event=>{
    if(event.target.matches('[name="type"]'))toggleGoal();
    if(sourceGrant&&event.target.matches('[data-wish-idea]')){
      const idea=funding.draftIdeas(sourceGrant,register?.today).find(candidate=>candidate.name===event.target.value);
      const fields=event.target.form.elements;
      fields.name.value=idea?.name||'';fields.purpose.value=idea?.purpose||'';
      fields.name.focus();
    }
  },{signal});
  host.addEventListener('submit',event=>{
    if(event.target.matches('[data-wish-link-form]')){
      event.preventDefault();return updateLink(event.target.elements.grantId.value,true);
    }
    if(!event.target.matches('[data-wish-form]'))return;
    event.preventDefault();
    if(busy)return;
    const f=event.target.elements, w=chosen();
    try{
      if(view==='create'||view==='edit'){
        const goalCents=f.type.value==='item'?0:parseMoney(f.amount.value);
        if(f.type.value==='cash' && goalCents<=0)throw Error('Enter a fundraising target greater than zero, or choose goods, a loan or practical help.');
        if(!f.name.value.trim()||!f.purpose.value.trim())throw Error('Give the wish a name and explain how it would help.');
        return save({action:view,id:view==='create'?createId:w.id,...(view==='edit'?{version:w.version}:{}),
          ...(sourceGrant?{sourceGrantId:sourceGrant.id,sourceGrantVersion:sourceGrant.version}:{}),
          name:f.name.value.trim(),purpose:f.purpose.value.trim(),goalCents},sourceGrant?'Draft saved and linked to the grant.':view==='create'?'Draft saved.':'Wish updated.');
      }
      const amount=parseMoney(f.amount.value);
      if(!amount)throw Error('Enter an amount greater than zero.');
      if(!f.note.value.trim())throw Error('Add a reference or reason for this entry.');
      return save({action:'money',id:w.id,version:w.version,kind:view,amountCents:f.direction?.value==='subtract'?-amount:amount,note:f.note.value.trim(),onDate:f.onDate.value},view==='receipt'?'Receipt recorded.':'Correction recorded.');
    }catch(error){ message(error.message,true); }
  },{signal});
  get();
}
