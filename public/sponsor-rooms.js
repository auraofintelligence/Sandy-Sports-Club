import {publicSponsorRoom,sponsorTypeLabels,participationLabels,liquorInfo} from './sponsor-offer-form.js?v=20261121-club-funding';

const endpoint='/api/committee/sponsors';
const statuses={new:'New',reviewing:'In conversation',agreed:'Agreed',declined:'Declined'};
const offices={president:'President',vicepresident:'Vice President',secretary:'Secretary',assistantsecretary:'Assistant Secretary',treasurer:'Treasurer'};
const equipmentStatuses={available:'Available',out:'On loan',returned:'Returned to lender'};
const when=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',year:'numeric'});
function localDate(value) {
  if(!value)return '';
  const date=new Date(/^\d{4}-\d\d-\d\d$/.test(value)?value+'T12:00:00+10:00':value);
  return Number.isFinite(+date)?when.format(date):'';
}

function committeeSponsorRoom(host,{api,esc,canManageStock,readOnly},signal) {
  let filter='all', rows=[], cursor='', ticket=0, selected=null, leadTemplates=[];
  const options=(values,current)=>Object.entries(values).map(([key,label])=>'<option value="'+esc(key)+'"'+(key===current?' selected':'')+'>'+esc(label)+'</option>').join('');
  const read=(path)=>api(endpoint+path,{signal});
  const write=(payload)=>readOnly?Promise.reject(Error('This demonstration is view only.')):
    api(endpoint,{method:'POST',body:JSON.stringify(payload),signal});
  const back='<button type="button" class="text-link" data-offer-list>Back to sponsorship desk</button>';
  const title=r=>r.organisation||r.contactName||'Community supporter';
  const note=(message,area=host)=>{const node=area.querySelector('[data-desk-status]');if(node)node.textContent=message;};
  const ownerSelect=(current,required=false)=>'<label>Who will follow up?<select name="owner"'+(required?' required':'')+'>'+options({'':required?'Choose an officer':'Unassigned',...offices},current)+'</select></label>';
  const dateField=current=>'<label>Follow up on (optional)<input type="date" name="followUpOn" value="'+esc(current||'')+'"></label>';
  const dataPair=(key,value)=>value?'<dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd>':'';
  const leadChecks=(field,legend,labels)=>'<fieldset><legend>'+esc(legend)+'</legend><div class="sponsor-choices">'+Object.entries(labels).map(([key,label])=>'<label class="sponsor-check"><input type="checkbox" name="'+field+'" value="'+esc(key)+'"><span>'+esc(label)+'</span></label>').join('')+'</div></fieldset>';
  const alcoholChecks='Check the venue’s licence, any exemption or permit, and arrangements for adults. If a raffle includes an alcohol prize, only adults can enter or buy tickets for that draw. <a href="'+liquorInfo+'" target="_blank" rel="noopener">Queensland liquor permits</a> · <a href="https://www.legislation.qld.gov.au/view/html/inforce/current/act-1999-026#sec.110" target="_blank" rel="noopener">Queensland raffle rule</a>';
  const chips=(req)=>[
    req.adultAreaRequested?'Adult area requested':'',req.alcoholSupplyProposed?'Alcohol supply proposed':''
  ].filter(Boolean).map(t=>'<span class="sponsor-flag">'+t+'</span>').join(' ');
  function empty() {
    rows=[];cursor='';selected=null;
  }
  function frame() {
    host.innerHTML='<header class="sponsor-desk-header"><div><h1>Sponsorship desk</h1><p>Review offers and record the next conversation with a local supporter.</p></div>'+
      '<button class="button outline" type="button" data-new-lead disabled>Record a lead</button></header>'+
      '<label class="sponsor-filter">Show offers<select name="statusFilter">'+options({all:'All offers and leads',...statuses},filter)+'</select></label>'+
      '<p role="status" class="sponsor-status" data-desk-status></p><div class="sponsor-inbox" data-inbox></div><button type="button" class="button outline small" data-load-offers hidden>Show earlier offers</button>';
  }
  function cards() {
    const list=host.querySelector('[data-inbox]');if(!list)return;
    list.innerHTML=rows.length?rows.map(r=>'<button type="button" class="sponsor-summary" data-open-sponsor="'+esc(r.id)+'"><span><strong>'+esc(title(r))+'</strong>'+
      (r.offerSummary?'<span>'+esc(r.offerSummary)+'</span>':'')+'<small>'+
      esc([r.source==='lead'?'Committee lead':'Supporter offer',r.eventName,localDate(r.createdAt)].filter(Boolean).join(' · '))+'</small></span><span>'+
      '<b>'+esc(statuses[r.status]||r.status)+'</b><small>'+esc([offices[r.owner]||'Unassigned',r.followUpOn?'Due '+localDate(r.followUpOn):''].filter(Boolean).join(' · '))+'</small></span>'+
      (chips(r)?'<span class="sponsor-flags">'+chips(r)+'</span>':'')+'</button>').join(''):
      '<p class="sponsor-empty">'+(filter==='all'?'Incoming offers and committee leads will appear here.':'There are no offers with this status.')+'</p>';
    const more=host.querySelector('[data-load-offers]');more.hidden=!cursor;more.disabled=false;
  }
  async function inbox(append=false,success='') {
    const task=++ticket;
    if(!append){empty();frame();} else if(!cursor)return;
    const more=host.querySelector('[data-load-offers]');more.disabled=true;
    note('Opening offers…');
    try {
      const q=new URLSearchParams({status:filter});if(append)q.set('cursor',cursor);
      const page=await read('?'+q);
      if(signal.aborted||task!==ticket)return;
      const known=new Set(rows.map(r=>r.id));rows.push(...page.offers.filter(r=>!known.has(r.id)));
      leadTemplates=page.introductionTemplates||[];cursor=page.nextCursor;cards();host.querySelector('[data-new-lead]').disabled=false;note(success);
    }catch(error){
      if(signal.aborted||task!==ticket)return;
      if(error.status===401||error.status===403){empty();host.innerHTML='<p role="status">Sign in to the committee room to view sponsorship details.</p>';return;}
      note(error.message);more.disabled=false;
      if(!append)host.querySelector('[data-inbox]').innerHTML='<button class="text-link" type="button" data-offer-list>Try again</button>';
    }
  }
  function loanPanel(offer) {
    if(!offer.loanEligible&&!offer.assetId&&!offer.assets?.length)return '';
    const assets=offer.assets||[],listed=assets.length||offer.assetId;
    return '<section class="sponsor-facts sponsor-loan"><h2>Loaned equipment</h2><p>Record each item so it can be checked out and returned separately.</p>'+
      (assets.length?'<ul>'+assets.map(a=>'<li><button type="button" class="text-link" data-sponsor-asset="'+esc(a.id)+'">'+esc(a.name)+'</button> · '+
        esc(equipmentStatuses[a.status]||a.status)+(a.status==='returned'&&a.onDate?' · '+esc(localDate(a.onDate)):a.lenderDue?' · Return by '+esc(localDate(a.lenderDue)):'')+'</li>').join('')+'</ul>':
        offer.assetId?'<button class="text-link" type="button" data-sponsor-asset="'+esc(offer.assetId)+'">Open equipment record</button>':'')+
      (offer.loanEligible?'<button type="button" class="button outline small" data-sponsor-loan="'+(listed?'another':'first')+'">'+(listed?'Add another item from this offer':'Record loaned equipment')+'</button>':'')+'</section>';
  }
  function review(offer,success='') {
    selected=offer;
    const returns=(offer.participation||[]).map(k=>participationLabels[k]||k).join(', '),
      how=(offer.offerTypes||[]).map(k=>sponsorTypeLabels[k]||k).join(', '),
      who=[offer.contactName,offer.phone,offer.email].filter(Boolean).join('\n');
    host.innerHTML=back+'<header class="sponsor-desk-header"><div><p class="sponsor-step">'+(offer.source==='lead'?'Committee lead':'Supporter offer')+'</p><h1 tabindex="-1">'+esc(title(offer))+'</h1></div><strong>'+esc(statuses[offer.status]||offer.status)+'</strong></header>'+
      '<div class="sponsor-review-layout"><section class="sponsor-facts"><h2>Offer and requests</h2><dl>'+
      dataPair('Kind of support',how)+dataPair('What is offered',offer.offer)+dataPair('Event or activity',offer.eventName)+
      dataPair('Requested in return',offer.requestedReturn)+dataPair('Role requested on the day',returns)+
      dataPair('For the organiser',offer.participationNote)+'</dl>'+
      (chips(offer)?'<p class="sponsor-flags">'+chips(offer)+'</p>':'')+
      (offer.alcoholSupplyProposed?'<p>'+alcoholChecks+'</p>':'')+
      '<h3>Private contact</h3><dl>'+dataPair('Introduction route',offer.contactRoute)+dataPair('Contact details',who)+'</dl>'+
      (offer.consentAt?'<details><summary>Consent record</summary><p>'+esc(offer.consentText)+'<br>'+esc(localDate(offer.consentAt))+'</p></details>':'<p>This lead was recorded by an officer. Check with the supporter directly before making an agreement.</p>')+'</section>'+
      '<form class="sponsor-form" data-review-offer><h2>Committee follow-up</h2><label>Status<select name="status">'+options(statuses,offer.status)+'</select></label>'+
      ownerSelect(offer.owner)+dateField(offer.followUpOn)+'<label>Committee note<textarea name="reviewNote" rows="4" maxlength="1200">'+esc(offer.reviewNote||'')+'</textarea></label>'+
      '<small>Record the next action, agreed terms, or reason for declining. Other officers can read this note.</small><div data-agreement></div>'+
      '<button class="button" type="submit">Save follow-up</button><p role="status" data-desk-status></p></form></div>'+
      loanPanel(offer)+(canManageStock&&offer.status==='agreed'&&offer.agreedShopProducts?'<p><a class="text-link" href="#stock">Record donated products in the Treasurer’s stock book</a></p>':'')+
      (offer.status==='agreed'&&offer.participation?.includes('workshop')?'<p><a class="text-link" href="#committee/events">Open Events and fundraising</a>. Choose <strong>Start an event</strong>, then <strong>Tutorial or hands-on workshop</strong>.</p>':'')+
      '<details class="sponsor-history"><summary>Decision history</summary><ol>'+(offer.history||[]).map(h=>'<li><strong>'+esc(statuses[h.status]||h.status)+'</strong> · '+
        esc(localDate(h.at))+(h.actor?' · '+esc(offices[h.actor]||h.actor):'')+
        (h.reviewNote?'<p>'+esc(h.reviewNote)+'</p>':'')+
        ((h.owner||h.followUpOn)?'<small>'+esc([offices[h.owner],h.followUpOn?'Follow up '+localDate(h.followUpOn):''].filter(Boolean).join(' · '))+'</small>':'')+'</li>').join('')+'</ol></details>';
    const form=host.querySelector('[data-review-offer]');
    function agreement() {
      const agree=form.elements.status.value==='agreed';
      const closing=agree||form.elements.status.value==='declined';
      form.elements.reviewNote.required=closing;
      form.querySelector('[data-agreement]').innerHTML=agree?
        '<label class="sponsor-check"><input name="supporterConfirmed" type="checkbox" required'+(offer.status==='agreed'?' checked':'')+'><span>The supporter and the club have agreed to the terms recorded above.</span></label>'+
        '<label class="sponsor-check"><input name="agreedLoan" type="checkbox"'+((offer.status==='agreed'?offer.loanEligible:offer.offerTypes?.includes('loan'))?' checked':'')+'><span>The agreement includes equipment on loan.</span></label>'+
        '<label class="sponsor-check"><input name="agreedShopProducts" type="checkbox"'+((offer.status==='agreed'?offer.agreedShopProducts:offer.offerTypes?.includes('clubSale'))?' checked':'')+'><span>The supporter is giving products for the club shop to sell.</span></label>':'';
    }
    form.elements.status.onchange=agreement;agreement();
    form.onsubmit=async e=>{
      e.preventDefault();if(form.inert)return;
      if(form.elements.reviewNote.required&&!form.elements.reviewNote.value.trim()){note('Write a short note about the decision.',form);form.elements.reviewNote.focus();return;}
      form.inert=true;note('Saving the follow-up…',form);
      const v=new FormData(form),payload={action:'review',id:offer.id,version:offer.version,status:v.get('status'),owner:v.get('owner'),followUpOn:v.get('followUpOn'),reviewNote:v.get('reviewNote').trim(),supporterConfirmed:v.has('supporterConfirmed'),agreedLoan:v.has('agreedLoan'),agreedShopProducts:v.has('agreedShopProducts')};
      const task=++ticket;
      try {
        const result=await write(payload);
        if(signal.aborted||task!==ticket)return;
        review(result.offer,'Follow-up saved.');
      }catch(error){
        if(signal.aborted||task!==ticket)return;
        if(error.status===401||error.status===403){empty();host.innerHTML='<p role="status">Sign in to the committee room again to continue.</p>';return;}
        note(error.message,form);form.inert=false;
        if(error.status===409){const btn=document.createElement('button');btn.className='text-link';btn.type='button';btn.textContent='Open current offer';btn.dataset.openSponsor=offer.id;form.append(btn);}
      }
    };
    host.querySelector('h1').focus();note(success,form);
  }
  async function openOffer(id) {
    const task=++ticket;selected=null;
    host.innerHTML=back+'<p role="status" data-desk-status>Opening private offer…</p>';
    try {
      const {offer}=await read('?id='+encodeURIComponent(id));
      if(!signal.aborted&&task===ticket)review(offer);
    }catch(error){if(!signal.aborted&&task===ticket)note(error.message);}
  }
  function lead() {
    ticket++;selected=null;
    const requestId=crypto.randomUUID();
    host.innerHTML=back+'<h1 tabindex="-1">Record a sponsorship lead</h1><p>Save a possible introduction and give one officer the next step. This keeps the lead private while the club checks the supporter’s interest.</p>'+
      '<form class="sponsor-form" data-lead-form>'+(leadTemplates.length?'<details class="sponsor-starters"><summary>Choose a possible introduction</summary><p>These are ideas to check. Choose one to fill in the working details, then edit them before saving.</p>'+
      leadTemplates.map((s,i)=>'<button type="button" class="text-link" data-lead-starter="'+i+'">'+esc(s.label||s.organisation)+'</button>').join('')+'</details>':'')+
      '<label>Potential supporter<input name="organisation" required maxlength="120"></label><label>How could the club reach them?<textarea name="contactRoute" required rows="3" maxlength="500"></textarea></label>'+
      ownerSelect('',true)+dateField('')+'<label>Private committee note (optional)<textarea name="reviewNote" rows="3" maxlength="1200"></textarea></label>'+
      '<details><summary>Add offer or contact details</summary><div class="sponsor-lead-extra"><label>Possible offer<textarea name="offer" maxlength="1500" rows="3"></textarea></label>'+
      leadChecks('offerTypes','Kind of support',sponsorTypeLabels)+
      '<label>Event or activity<input name="eventName" maxlength="140"></label><label>Contact name<input name="contactName" maxlength="100"></label><label>Phone<input name="phone" type="tel" maxlength="25"></label>'+
      '<label>Email<input name="email" type="email" maxlength="150"></label><label>Requested in return<textarea name="requestedReturn" maxlength="900" rows="2"></textarea></label>'+
      leadChecks('participation','Role on the day',participationLabels)+
      '<label class="sponsor-check"><input type="checkbox" name="adultAreaRequested"><span>Adult-area stand requested</span></label>'+
      '<label class="sponsor-check"><input type="checkbox" name="alcoholSupplyProposed"><span>Supply or service of alcohol proposed</span></label>'+
      '<p data-lead-alcohol-info hidden>'+alcoholChecks+'</p></div></details>'+
      '<button type="submit" class="button">Save private lead</button><p role="status" data-desk-status></p></form>';
    host.querySelector('h1').focus();
    const form=host.querySelector('[data-lead-form]');
    form.addEventListener('change',event=>{
      const box=event.target;
      if(box.name!=='participation'||!box.checked)return;
      for(const other of form.querySelectorAll('input[name="participation"]')){
        if(other!==box&&(box.value==='none'||other.value==='none'))other.checked=false;
      }
    });
    form.elements.alcoholSupplyProposed.onchange=()=>{form.querySelector('[data-lead-alcohol-info]').hidden=!form.elements.alcoholSupplyProposed.checked;};
    form.onsubmit=async event=>{
      event.preventDefault();if(form.inert)return;
      const fields=new FormData(form),body=Object.fromEntries(fields);
      body.offerTypes=fields.getAll('offerTypes');body.participation=fields.getAll('participation');
      body.adultAreaRequested=form.elements.adultAreaRequested.checked;body.alcoholSupplyProposed=form.elements.alcoholSupplyProposed.checked;
      if(!body.organisation.trim()||!body.contactRoute.trim()){note('Enter the supporter and an introduction route.');return;}
      form.inert=true;const task=++ticket;
      try {
        const result=await write({...body,action:'lead',requestId});
        if(!signal.aborted&&task===ticket)review(result.offer,'Lead saved for follow-up.');
      }catch(error){if(signal.aborted||task!==ticket)return;form.inert=false;note(error.message);}
    };
  }
  host.addEventListener('change',e=>{if(e.target.name==='statusFilter'){filter=e.target.value;inbox();}},{signal});
  host.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-offer-list'))inbox();
    if(b.hasAttribute('data-load-offers'))inbox(true);
    if(b.hasAttribute('data-open-sponsor'))openOffer(b.dataset.openSponsor);
    if(b.hasAttribute('data-new-lead'))lead();
    if(b.hasAttribute('data-lead-starter')){
      const p=leadTemplates[Number(b.dataset.leadStarter)],f=b.form;if(!p)return;
      f.elements.organisation.value=p.organisation;f.elements.contactRoute.value=p.contactRoute;f.elements.owner.value=p.owner||'';
      f.elements.reviewNote.value=p.reviewNote||'';
      b.closest('details').open=false;f.elements.organisation.focus();
    }
    if((b.hasAttribute('data-sponsor-loan')||b.hasAttribute('data-sponsor-asset'))&&selected){
      const offer=selected;
      try{
        const {stageSponsorEquipment}=await import('./club-equipment.js?v=20261121-practical-wishes');
        if(signal.aborted||selected!==offer)return;
        const another=b.dataset.sponsorLoan==='another';
        stageSponsorEquipment({sourceOfferId:offer.id,assetId:b.dataset.sponsorAsset||null,newItem:another,name:another?'':(offer.offer||'').slice(0,120),lender:offer.organisation||offer.contactName,lenderContact:[offer.contactName,offer.phone,offer.email].filter(Boolean).join(' · '),notes:offer.reviewNote||''});
      }catch(error){if(!signal.aborted)note('The equipment register is unavailable. Open it from the committee room.');}
    }
  },{signal});
  inbox();
}

export function setupSponsorRooms({api,esc}) {
  const publicHost=document.getElementById('sponsor-room'),desk=document.getElementById('sponsor-desk');
  if(!publicHost||!desk)return;
  let session,mode='',controller=null;
  function clear(){
    controller?.abort();controller=null;mode='';publicHost.replaceChildren();desk.replaceChildren();
  }
  function route(){
    const next=location.hash==='#sponsors'?'public':(location.hash==='#committee/sponsors'&&session?.authenticated&&session.storageReady&&session.role==='committee'?'committee':'');
    const readOnly=Boolean(session?.readOnly || session?.showcase || session?.demo);
    publicHost.toggleAttribute('data-read-only',readOnly);desk.toggleAttribute('data-read-only',readOnly);
    if(next===mode)return;
    clear();mode=next;if(!next)return;controller=new AbortController();
    if(next==='public')publicSponsorRoom(publicHost,{api,esc},controller.signal);
    else committeeSponsorRoom(desk,{api,esc,canManageStock:!!session.canManageStock && !readOnly,readOnly},controller.signal);
  }
  window.addEventListener('plfc:navigated',route);
  window.addEventListener('plfc:session-changed',e=>{
    if(mode==='committee')clear();
    session=e.detail;route();
  });
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',ev=>{if(ev.persisted)route();});
  route();
}
