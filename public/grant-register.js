import {recommendedWishesForGrant, wishIdeasForGrant} from './grant-wish-matches.js?v=20261121-practical-wishes';

const endpoint='/api/committee/grants', route='#committee/grants';
const past=new Set(['closed','declined','parked']);
const dates=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const format=day=>day ? dates.format(new Date(day+'T12:00:00+10:00')) : '';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dueFor=row=>['delivery','reporting'].includes(row.stage)?row.reportDue:['checking','preparing'].includes(row.stage)?row.deadline:'';
const currency=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:0,maximumFractionDigits:2});
const equipmentUrl=params=>'/clubhouse.html?'+new URLSearchParams(params)+'#committee/equipment';
const wishProgress=wish=>wish.status==='fulfilled'?'Wish fulfilled':wish.goalCents
  ? wish.goalCents<=wish.totalCents?'Fundraising target reached':currency.format((wish.goalCents-wish.totalCents)/100)+' still needed'
  :'Goods or help wanted';

export function setupGrantRegister({api}) {
  const room=document.getElementById('committee-grant-register');
  if(!room)return;
  let session=null,active=false,request=null,data=null,editing=null,filter='active';
  let view='register',finderLife=null,pendingLead=null,returnTo=null,focusWish=null;
  const readOnly=()=>Boolean(session?.demo || session?.readOnly || session?.previewOnly || session?.showcase);
  const el=name=>room.querySelector('[data-gr-'+name+']');
  const status=text=>{el('status').textContent=text;};
  function clear(){
    request?.abort();finderLife?.abort();finderLife=null;pendingLead=null;returnTo=null;view='register';
    request=null;data=null;editing=null;active=false;filter='active';focusWish=null;room.replaceChildren();
  }
  function shell(){
    room.innerHTML='<header><h1>Club grants</h1></header>'+
      '<div class="gr-switch" role="group" aria-label="Club grants"><button type="button" data-gr-view="register" aria-pressed="true" aria-controls="gr-register-view">Grant register</button>'+
      '<button type="button" data-gr-view="finder" aria-pressed="false" aria-controls="gr-finder-view">Find funding</button></div>'+
      '<p role="status" data-gr-status></p>'+
      '<div id="gr-register-view" data-gr-register><p>See who is following up each grant, when the application closes and when a report is due.</p>'+
      (readOnly()?'<p>The webmaster preview is view-only. Office holders can save funding leads after their accounts are activated.</p>':'')+
      '<div class="gr-tools"><button class="button small" type="button" data-gr-add disabled'+(readOnly()?' hidden':'')+'>Add a grant opportunity</button>'+
      '<label><span id="gr-show-label">Show grants</span><select data-gr-filter aria-labelledby="gr-show-label"><option value="active">In progress</option><option value="past">Finished or set aside</option></select></label></div>'+
      '<div data-gr-editor></div><button type="button" class="text-link" data-gr-retry hidden>Try again</button>'+
      '<div class="gr-list" data-gr-list aria-label="Grant opportunities"></div></div>'+
      '<div id="gr-finder-view" data-gr-finder hidden></div>';
  }
  function newWishIdeas(grant){
    const names=new Set((data?.wishes||[]).map(w=>w.name.trim().toLocaleLowerCase('en-AU')));
    return wishIdeasForGrant(grant).filter(idea=>!names.has(idea.name.trim().toLocaleLowerCase('en-AU')));
  }
  async function showView(next){
    view=next;
    el('register').hidden=next!=='register';el('finder').hidden=next!=='finder';
    room.querySelectorAll('[data-gr-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.grView===next)));
    if(next!=='finder' || finderLife)return;
    const host=el('finder'),scope=new AbortController();
    finderLife=scope;host.textContent='Loading the funding finder…';
    try{
      const {mountGrantFinder}=await import('./grant-finder.js?v=20261121-practical-wishes');
      if(scope.signal.aborted)return;
      host.replaceChildren();
      mountGrantFinder(host,{
        signal:scope.signal,focusWish,readOnly:readOnly(),isTracked:grant=>Boolean(trackedRound(grant)),
        getWishIdeas:grant=>newWishIdeas(trackedRound(grant)||grant),
        getWishSuggestions(grant){
          const saved=trackedRound(grant),links=new Set(saved?.wishIds||[]);
          return recommendedWishesForGrant(saved||grant,(data?.wishes||[]).filter(w=>!links.has(w.id)));
        },
        onTrack(grant,trigger,idea){
          if(!active || readOnly() || view!=='finder' || editing)return;
          const saved=trackedRound(grant);
          if(idea && saved && !request){
            location.assign(equipmentUrl({fromGrant:saved.id,idea:idea.name}));return;
          }
          returnTo={name:grant.name,trigger,idea};pendingLead=grant;showView('register');
          if(data && !request){pendingLead=null;editOpportunity(grant);}
          else if(!request)exchange();
        }
      });
    }catch{
      if(scope.signal.aborted)return;
      scope.abort();finderLife=null;
      host.innerHTML='<p>The funding finder could not load.</p><button type="button" class="text-link" data-gr-finder-retry>Try the finder again</button>';
    }
  }
  function backToResult(message){
    const origin=returnTo;
    returnTo=null;showView('finder');status(message);
    const card=[...el('finder').querySelectorAll('.gr-opportunity')].find(item=>item.querySelector('h3')?.textContent===origin.name);
    const focus=origin.trigger?.isConnected?origin.trigger:card?.querySelector('summary');
    (focus || room.querySelector('[data-gr-view="finder"]')).focus();
  }
  function wishSection(grant){
    const links=new Set(grant.wishIds||[]);
    const linked=(data.wishes||[]).filter(w=>links.has(w.id));
    const suggested=recommendedWishesForGrant(grant,(data.wishes||[]).filter(w=>!links.has(w.id)));
    const ideas=newWishIdeas(grant);
    const summary=linked.length?'Equipment wishes ('+linked.length+' linked)':suggested.length?'Equipment wishes ('+suggested.length+' to consider)':'Equipment wishes';
    const existing=linked.length?'<ul class="gr-wish-links">'+linked.map(w=>
      '<li><a href="'+esc(equipmentUrl({wish:w.id}))+'">'+esc(w.name)+'</a><span>'+esc(wishProgress(w))+'</span></li>'
    ).join('')+'</ul>':'';
    const matches=suggested.slice(0,3).map(({wish,reason})=>'<li><strong>'+esc(wish.name)+'</strong><span>'+esc(reason)+'</span></li>').join('');
    const suggestions=matches?'<p><strong>Wishes to consider</strong></p><ul class="gr-wish-links">'+matches+'</ul>':'';
    const drafts=readOnly()?'':ideas.map(idea=>'<li><a href="'+esc(equipmentUrl({fromGrant:grant.id,idea:idea.name}))+'">Draft a wish for '+esc(idea.name)+'</a></li>').join('');
    return '<details class="gr-wish-section"><summary>'+summary+'</summary>'+existing+suggestions+
      (!readOnly() && (data.wishes||[]).length?'<button type="button" class="text-link" data-gr-link="'+esc(grant.id)+'">'+(linked.length?'Change linked wishes':'Link an existing wish')+'</button>':'')+
      (drafts?'<p><strong>Ideas from this grant</strong></p><ul class="gr-wish-links">'+drafts+'</ul>':'')+
      (readOnly()?'':'<a class="text-link" href="'+esc(equipmentUrl({fromGrant:grant.id}))+'">Write a new equipment wish</a>')+'</details>';
  }
  function wishFields(row,source,preselectWish){
    const wishes=data.wishes||[];
    if(!wishes.length)return '';
    const checked=new Set(row.wishIds||[]);
    if(preselectWish)checked.add(preselectWish.id);
    const suggestions=recommendedWishesForGrant(source,wishes);
    const reasons=new Map(suggestions.map(({wish,reason})=>[wish.id,reason]));
    const handy=wishes.filter(w=>checked.has(w.id) || reasons.has(w.id));
    const others=wishes.filter(w=>!checked.has(w.id) && !reasons.has(w.id));
    const choice=w=>'<label class="gr-wish-option"><input type="checkbox" name="linkedWish" value="'+esc(w.id)+'"'+(checked.has(w.id)?' checked':'')+'><span>'+esc(w.name)+'<small>'+esc(reasons.get(w.id)||wishProgress(w))+'</small></span></label>';
    return '<fieldset class="gr-wish-picker" tabindex="-1"><legend>Club wishes this grant could support</legend>'+
      '<p>Tick any wishes you want to link. Check the funder’s rules before applying.</p>'+
      handy.map(choice).join('')+
      (others.length?'<details'+(!handy.length?' open':'')+'><summary>'+(handy.length?'Other equipment wishes':'Choose equipment wishes')+' ('+others.length+')</summary>'+others.map(choice).join('')+'</details>':'')+
      '</fieldset>';
  }
  function list(){
    const records=data.grants.filter(row=>past.has(row.stage)===(filter==='past')).sort((a,b)=>
      (dueFor(a)||'9999').localeCompare(dueFor(b)||'9999') || a.title.localeCompare(b.title));
    el('list').innerHTML=records.map(row=>{
      const due=dueFor(row), late=due && due<data.today,report=['reporting','delivery'].includes(row.stage);
      return '<article class="gr-record"><div><h2>'+esc(row.title)+'</h2><p>'+esc(data.stages[row.stage])+' · '+esc(data.offices[row.office])+'</p></div>'+
        (row.funder?'<p><strong>Funder</strong> '+esc(row.funder)+'</p>':'')+
        (due?'<p class="gr-timing'+(late?' gr-late':'')+'"><strong>'+(report?'Report due':'Application closes')+'</strong> '+format(due)+(late?' · Date passed':'')+'</p>':'')+
        (row.nextStep?'<p class="gr-next"><strong>Next step</strong> '+esc(row.nextStep)+'</p>':'')+
        '<div class="gr-row">'+(readOnly()?'':'<button type="button" class="text-link" data-gr-edit="'+esc(row.id)+'">Update grant</button>')+
        (row.sourceUrl?'<a class="text-link" href="'+esc(row.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Funder’s guidelines</a>':'')+'</div>'+wishSection(row)+'</article>';
    }).join('') || '<p>'+(filter==='past'?'No finished or set-aside opportunities.':readOnly()?'No grants have been saved in the committee register. Use Find funding to review dated leads.':'No grant opportunities yet. Add one to start checking its requirements.')+'</p>';
  }
  function form(row={id:crypto.randomUUID(),version:0,office:'unassigned',stage:'checking'},source=row,preselectWish=null){
    if(readOnly())return;
    editing={id:row.id,version:row.version};
    const options=(items,choice)=>Object.entries(items).map(([key,label])=>'<option value="'+esc(key)+'"'+(key===choice?' selected':'')+'>'+esc(label)+'</option>').join('');
    el('editor').innerHTML='<form class="gr-form" data-gr-form><h2>'+(row.version?'Update grant':'Add a grant opportunity')+'</h2>'+
      '<label>Grant or project name<input name="title" maxlength="140" required></label>'+
      '<label>Funder (optional)<input name="funder" maxlength="140"></label>'+
      '<label>Funder’s guidelines (optional)<input name="sourceUrl" type="url" maxlength="700" placeholder="https://"></label>'+
      '<div class="gr-fields"><label>Responsible office<select name="office">'+options(data.offices,row.office)+'</select></label>'+
      '<label>Application stage<select name="stage">'+options(data.stages,row.stage)+'</select></label>'+
      '<label>Application closing date (if known)<input name="deadline" type="date"></label>'+
      '<label>Final report due (if known)<input name="reportDue" type="date"></label></div>'+
      '<label>Next step (optional)<textarea name="nextStep" rows="2" maxlength="600" placeholder="e.g. Ask the funder to confirm the applicant requirements"></textarea></label>'+
      wishFields(row,source,preselectWish)+
      '<div class="gr-row"><button class="button small" type="submit">'+(returnTo?.idea?'Save grant and draft wish':'Save grant')+'</button><button class="text-link" type="button" data-gr-cancel>'+(returnTo?'Cancel and return to results':'Cancel')+'</button></div></form>';
    const inputs=el('form').elements;
    for(const key of ['title','funder','sourceUrl','deadline','reportDue','nextStep'])inputs[key].value=row[key]||'';
    el('add').disabled=true;el('list').hidden=true;el('filter').disabled=true;
    room.querySelector('[data-gr-view="finder"]').disabled=true;
    el('retry').hidden=true;status('');inputs.title.focus();
  }
  function closeForm(){
    editing=null;el('editor').replaceChildren();el('list').hidden=false;el('add').disabled=false;el('filter').disabled=false;
    room.querySelector('[data-gr-view="finder"]').disabled=false;
    el('retry').hidden=true;
  }
  async function openFromFinder() {
    const url=new URL(location.href),name=url.searchParams.get('grant');
    const grantId=url.searchParams.get('grantId'),wishId=url.searchParams.get('wishId');
    if(!(name||grantId||wishId) || !active || editing || !data)return;
    if(readOnly()){showView('finder');return;}
    const currentSession=session;
    let selected;
    try {
      if(name){
        const {opportunities}=await import('./grant-opportunities.mjs');
        selected=opportunities.find(grant=>grant.name===name);
      }
    } catch {
      if(active && !editing)status('The funding finder could not load. You can still add a grant here.');
      return;
    }
    if(!active || session!==currentSession || !data || editing || location.href!==url.href)return;
    for(const key of ['grant','grantId','wishId'])url.searchParams.delete(key);
    history.replaceState(history.state,'',url);
    if(wishId){
      focusWish=(data.wishes||[]).find(w=>w.id===wishId);
      if(!focusWish){status('This equipment wish is no longer in the register.');return;}
    }
    if(grantId){
      const row=data.grants.find(g=>g.id===grantId);
      if(!row){status('This saved grant is no longer in the register.');return;}
      showView('register');form(row,row,focusWish);return;
    }
    if(!name){showView('finder');return;}
    if(!selected){status('This funding lead is no longer listed. Check the funding finder for its current round.');return;}
    showView('register');editOpportunity(selected);
  }
  function trackedRound(selected){
    return data?.grants.find(grant=>grant.title===selected.name && grant.sourceUrl===selected.url &&
      grant.deadline===(selected.closing||'') && !past.has(grant.stage));
  }
  function editOpportunity(selected){
    if(readOnly())return;
    const existing=trackedRound(selected);
    if(existing){form(existing,selected,focusWish);status('This round is already in the register. Here is its current record.');return;}
    form({id:crypto.randomUUID(),version:0,office:'unassigned',stage:'checking',title:selected.name,
      funder:selected.funder,sourceUrl:selected.url,deadline:selected.closing, nextStep:''},selected,focusWish);
    status(returnTo?.idea?'Save this funding round first. You can then edit the new equipment wish for '+returnTo.idea.name+'.':'Grant details are filled in. Choose who will check eligibility, then save the grant.');
  }
  async function exchange(body=null){
    if(!active || request || (body && readOnly()))return;
    const refreshEdit=!body && editing?editing.id:null;
    const controller=new AbortController();request=controller;
    const controls=Array.from(el('register').querySelectorAll('button:not([disabled]),select:not([disabled]),input,textarea'));
    for(const control of controls)control.disabled=true;
    status(body?'Saving grant…':'Checking the grant register…');el('retry').hidden=true;
    let loaded=false;
    try{
      const result=await api(endpoint,{cache:'no-store',signal:controller.signal,...(body?{method:'POST',body:JSON.stringify(body)}:{})});
      if(controller.signal.aborted || request!==controller)return;
      data=result;loaded=true;
      el('finder').dispatchEvent(new Event('plfc:grant-register-updated'));
      if(body){filter=past.has(body.stage)?'past':'active';el('filter').value=filter;}
      closeForm();list();status(body?'Grant saved in the committee register.':'');
      if(body){
        if(returnTo?.idea){location.assign(equipmentUrl({fromGrant:body.id,idea:returnTo.idea.name}));return;}
        if(returnTo)backToResult(body.title+' saved in the committee grant register.');
        else el('add').focus();
      }
    }catch(error){
      if(controller.signal.aborted || request!==controller)return;
      if(error.status===401 || error.status===403){clear();return;}
      status(error.message || 'Could not load the grant register.');
      if(!body || error.status===409){el('retry').textContent=body?'Load latest register':'Try again';el('retry').hidden=false;}
    }finally{
      if(request===controller){request=null;for(const control of controls)if(control.isConnected)control.disabled=false;}
    }
    if(loaded && !body){
      if(pendingLead){const selected=pendingLead;pendingLead=null;showView('register');editOpportunity(selected);}
      else if(refreshEdit && returnTo){
        const latest=data.grants.find(row=>row.id===refreshEdit);
        if(latest){form(latest);status('The latest record is ready to edit.');}
        else backToResult('This grant is no longer in the register.');
      }
      else await openFromFinder();
    }
  }
  function navigate(){
    const allowed=session?.authenticated && session.role==='committee' && location.hash===route;
    if(!allowed){if(active)clear();return;}if(active)return;
    active=true;shell();exchange();
  }
  room.addEventListener('submit',event=>{
    if(!event.target.matches('[data-gr-form]'))return;
    event.preventDefault();
    if(editing && !request && !readOnly()){
      const fields=new FormData(event.target),body={...Object.fromEntries(fields),...editing};
      delete body.linkedWish;
      if(Array.isArray(data.wishes))body.wishIds=fields.getAll('linkedWish');
      exchange(body);
    }
  });
  room.addEventListener('change',event=>{if(event.target===el('filter') && data){filter=event.target.value;list();}});
  room.addEventListener('change',event=>{
    const editor=event.target.closest('[data-gr-form]');
    const picker=editor?.querySelector('.gr-wish-picker');
    if(!picker || !['title','funder','sourceUrl','stage','deadline'].includes(event.target.name))return;
    const fields=new FormData(editor);
    const grant={...Object.fromEntries(fields),wishIds:fields.getAll('linkedWish')};
    picker.outerHTML=wishFields(grant,grant);
  });
  room.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.grView){
      if(!editing && view!==button.dataset.grView){pendingLead=null;returnTo=null;status('');showView(button.dataset.grView);}
      return;
    }
    if(button.hasAttribute('data-gr-finder-retry')){showView('finder');return;}
    if(request)return;
    if(readOnly() && (button===el('add') || button.hasAttribute('data-gr-cancel') || button.dataset.grEdit || button.dataset.grLink))return;
    if(button===el('retry'))exchange();
    if(button===el('add') && data)form();
    if(button.hasAttribute('data-gr-cancel')){
      closeForm();list();status('');
      if(returnTo)backToResult('');else el('add').focus();
    }
    if(button.dataset.grEdit && data){const row=data.grants.find(item=>item.id===button.dataset.grEdit);if(row)form(row);}
    if(button.dataset.grLink && data){
      const row=data.grants.find(item=>item.id===button.dataset.grLink);
      if(row){form(row);room.querySelector('.gr-wish-picker')?.focus();}
    }
  });
  window.addEventListener('plfc:session-changed',event=>{
    const next=event.detail;if(session?.identity?.id!==next?.identity?.id || session?.role!==next?.role || session?.demo!==next?.demo || session?.readOnly!==next?.readOnly || session?.showcase!==next?.showcase || !next?.authenticated)clear();
    session=next;navigate();
  });
  window.addEventListener('plfc:navigated',navigate);
}
