const offerTypes = {
  gift: 'Give a prize or item', clubSale: 'Give products for the club shop', loan: 'Lend gear to return', share: 'Share space or equipment',
  service: 'Offer time or a skill', funding: 'Contribute funds', other: 'Something else'
};
const participation = {
  observer: 'Come along as an observer', volunteer: 'Help on the day', workshop: 'Lead a tutorial or workshop', stand: 'Ask for a stand',
  speaker: 'Ask to say a few words', none: 'No role on the day', other: 'Another idea'
};
export const sponsorTypeLabels = offerTypes;
export const participationLabels = participation;
export const liquorInfo = 'https://www.business.qld.gov.au/industries/hospitality-tourism-sport/liquor-gaming/liquor/licensing/licences-permits/community-liquor-permits';
const raffleAgeRule = 'https://www.legislation.qld.gov.au/view/html/inforce/current/act-1999-026#sec.110';
const exampleGroups = [
  {id:'sports-coaching',title:'Sport and skills sessions',icon:'🏐',preview:'Offer a coaching session, class place or shared activity',items:[
    {id:'coaching-session',title:'A coached sand sport session',detail:'Offer a confirmed tutor or coach for a group session once the club has a venue and date.',offerTypes:['service'],participation:['workshop'],offer:'I can lead a coached sand sport session. I will confirm the format, coach credentials, ages, group size, access needs, equipment and wet-weather plan.',eventName:'Proposed Sandy Sports skills day',requestedReturn:'Please agree bookings and an on-site club contact before announcing the session.'},
    {id:'class-voucher',title:'A place in a local class',detail:'Offer a voucher for a participant to attend your class, subject to its own terms.',offer:'One place in a local class. I will confirm the age range, expiry, included materials, booking process and any excluded dates.',eventName:'Proposed community prize draw',requestedReturn:'Please give the recipient my booking details and terms.'}
  ]},
  {title:'Gear, shade and practical support',icon:'⛱️',preview:'Lend equipment or offer an agreed prize',items:[
    {id:'shade-loan',title:'Portable shade for an event',detail:'Lend shade and agree collection, installation and return.',offerTypes:['loan'],offer:'Portable shade for an agreed event. I will confirm the equipment list, condition, transport, installation, insurance and return arrangements.',eventName:'Proposed island sport day',requestedReturn:'Please acknowledge the loan as agreed and return the items in the recorded condition.'},
    {id:'sport-prize',title:'Sport gear or merchandise prize',detail:'Offer an item for a future club prize draw or fundraiser.',offer:'A sport item or merchandise prize. I will confirm the item, quantities, sizing, value, collection and any terms before a draw is advertised.',eventName:'Proposed club fundraiser',requestedReturn:'Please agree any public acknowledgement and check with me before using product photos.'},
    {id:'accessible-space',title:'Accessible meeting or activity space',detail:'Share a suitable room or court for a confirmed community activity.',offerTypes:['share'],offer:'Use of a space for an agreed club activity, subject to availability. We will confirm accessibility, capacity, insurance, booking and safety requirements.',eventName:'Proposed club gathering',requestedReturn:'Please confirm the event plan and a responsible club contact in advance.'}
  ]},
  {title:'Culture, film and island makers',icon:'🎬',preview:'Offer local creative work or a film club resource',items:[
    {id:'maker-item',title:'A locally made prize',detail:'Offer an artwork or handmade item and choose how to be credited.',offer:'One locally made item for a proposed fundraiser. I will confirm description, collection and any conditions.',eventName:'Proposed Sandy Sports fundraiser',requestedReturn:'Please agree the maker credit and ask before publishing an image of the item.'},
    {id:'film-support',title:'Film night help or equipment',detail:'Offer technical time or equipment for a proposed community screening.',offerTypes:['service','loan'],participation:['volunteer'],offer:'I can discuss technical help or equipment for a film club event. I will confirm exactly what is available, the operator, power, insurance and return terms.',eventName:'Proposed film club screening',requestedReturn:'Please agree the programme and logistics separately before announcing my involvement.'}
  ]}
];
const examples = new Map(exampleGroups.flatMap(group=>group.items.map(item=>[item.id,item])));
const exampleFields = ['offerTypes','participation','offer','eventName','requestedReturn','participationNote','adultAreaRequested','alcoholSupplyProposed'];
const signature = draft => JSON.stringify(exampleFields.map(k=>Array.isArray(draft[k])?[...draft[k]].sort():draft[k]));
const consentText = 'I agree that the Sandy Sports Club committee may store this offer and use my contact details to discuss it with me.';
const blank = () => ({
  requestId:crypto.randomUUID(),organisation:'',contactName:'',email:'',phone:'',offerTypes:[],offer:'',
  requestedReturn:'',eventName:'',participation:[],participationNote:'',adultAreaRequested:false,alcoholSupplyProposed:false,consent:false
});

export function publicSponsorRoom(host, {api,esc}, signal) {
  let draft = null, step = 0, sending = false, baseline = '', pendingExample = null, currentExample = null;
  host.innerHTML = '<header class="sponsor-hero"><div><h1>Sponsor a club day</h1><p>Offer a coaching session, a prize, practical gear or a cultural contribution. Tell the club what you can offer and what you would like in return.</p><button class="button" type="button" data-start-offer>Make an offer</button></div><img src="/assets/hero-community-builder.webp" alt="Illustrative Sandy Sports community planning scene"></header>' +
    '<section class="sponsor-examples" aria-labelledby="sponsor-ideas-heading"><h2 id="sponsor-ideas-heading">Sponsorship ideas</h2><p>Choose Make an offer to write your own, or open a group below for examples you can edit.</p><div class="sponsor-example-groups">' +
    exampleGroups.map(group=>'<details class="sponsor-example-group" name="sandy-sponsor-idea-group"'+(group.id?' data-sponsor-group="'+group.id+'"':'')+'><summary><span class="sponsor-idea-icon" aria-hidden="true">'+group.icon+'</span><span><strong>'+esc(group.title)+'</strong><small>'+esc(group.preview)+'</small></span></summary><div class="sponsor-example-cards">'+
      group.items.map(x=>'<article><h3>'+esc(x.title)+'</h3><p>'+esc(x.detail)+'</p>'+(x.alcoholSupplyProposed?'<a href="'+raffleAgeRule+'" target="_blank" rel="noopener">Queensland raffle age rule</a>':'')+
      '<button class="text-link" type="button" data-example="'+x.id+'">Use this example<span class="sponsor-sr">, '+esc(x.title)+'</span></button></article>').join('')+
    '</div></details>').join('')+'</div></section><div data-offer-form></div>';
  const area=host.querySelector('[data-offer-form]');
  if(new URLSearchParams(location.search).get('sponsor')==='sports-coaching'){
    const group=host.querySelector('[data-sponsor-group="sports-coaching"]');
    group.open=true;
    requestAnimationFrame(()=>{
      if(signal.aborted || document.querySelector('dialog[open]'))return;
      const summary=group.querySelector('summary');
      summary.focus({preventScroll:true});
      summary.scrollIntoView({block:'center'});
    });
  }
  const choice = (name,key,label,checked) => '<label class="sponsor-check"><input type="checkbox" name="'+name+'" value="'+key+'"'+(checked?' checked':'')+'><span>'+label+'</span></label>';
  const choices = (name,items) => '<div class="sponsor-choices">'+Object.entries(items).map(([key,label])=>choice(name,key,label,draft[name].includes(key))).join('')+'</div>';
  const input = (key,label,limit,type='text',required=false) => '<label>'+label+'<input name="'+key+'" type="'+type+'" maxlength="'+limit+'" value="'+esc(draft[key])+'"'+(required?' required':'')+'></label>';
  const long = (key,label,limit,required=false) => '<label>'+label+'<textarea name="'+key+'" maxlength="'+limit+'" rows="3"'+(required?' required':'')+'>'+esc(draft[key])+'</textarea></label>';
  function first() {
    return '<fieldset><legend>How would you like to help?</legend><small>Choose one or more.</small>'+choices('offerTypes',offerTypes)+'</fieldset>'+
      long('offer','What can you offer?',1500,true)+input('eventName','Which event or club activity? (optional)',140);
  }
  function second() {
    return long('requestedReturn','What would you like in return? (optional)',900)+
      '<small>A thank-you, a mention in the newsletter, or a time to collect loaned gear are all things you can ask for.</small>'+
      '<fieldset><legend>Would you like a role on the day?</legend>'+choices('participation',participation)+'</fieldset>'+
      long('participationNote','Details for the organiser (optional)',600)+
      '<details class="sponsor-beverage"'+(draft.adultAreaRequested||draft.alcoholSupplyProposed?' open':'')+'><summary>Adult-area stands or alcohol supply</summary>'+
      '<p>A brewery or other business can offer equipment on its own. Tick the requests you would like the committee to consider.</p>'+
      choice('adultAreaRequested','yes','I would like to discuss a stand in an adult area.',draft.adultAreaRequested)+
      choice('alcoholSupplyProposed','yes','I propose supplying alcohol as a prize or serving it at an event.',draft.alcoholSupplyProposed)+
      '<div data-supply-info'+(draft.alcoholSupplyProposed?'':' hidden')+'><p>If liquor is a raffle prize, under-18s cannot enter or buy tickets for that entire draw. <a target="_blank" rel="noopener" href="'+raffleAgeRule+'">Queensland raffle age rule</a></p>'+
      '<p>The organiser and venue will check the licence, any exemption or permit, and arrangements for adults. <a target="_blank" rel="noopener" href="'+liquorInfo+'">Queensland community liquor permits</a></p></div></details>';
  }
  function third() {
    const selected=draft.participation.map(k=>participation[k]).join(', ');
    return '<details class="sponsor-recap"><summary>Review your offer</summary><dl><dt>What you can offer</dt><dd>'+esc(draft.offer)+'</dd>'+
      (draft.eventName?'<dt>Event or activity</dt><dd>'+esc(draft.eventName)+'</dd>':'')+
      (draft.requestedReturn?'<dt>What you requested in return</dt><dd>'+esc(draft.requestedReturn)+'</dd>':'')+
      (selected?'<dt>On the day</dt><dd>'+esc(selected)+'</dd>':'')+
      (draft.participationNote?'<dt>For the organiser</dt><dd>'+esc(draft.participationNote)+'</dd>':'')+
      (draft.adultAreaRequested?'<dt>Stand</dt><dd>Adult area requested</dd>':'')+
      (draft.alcoholSupplyProposed?'<dt>Alcohol</dt><dd>Supply or service proposed</dd>':'')+'</dl></details>'+
      input('contactName','Your name',100,'text',true)+input('organisation','Business or group (optional)',120)+
      '<fieldset><legend>How can the committee reach you?</legend><p>Give your email, phone number or both. Use details you have permission to share.</p>'+
      input('email','Email',150,'email')+input('phone','Phone',25,'tel')+'</fieldset>'+
      '<p>Only the committee can read your contact details. A committee member will need to discuss the arrangements with you before agreeing to anything.</p>'+
      choice('consent','yes',consentText,draft.consent);
  }
  function render() {
    const titles=['Your offer','What would you like back?','Committee follow-up'];
    area.innerHTML='<form class="sponsor-form"><p class="sponsor-step">Step '+(step+1)+' of 3</p><h2 tabindex="-1">'+titles[step]+'</h2>'+
      [first,second,third][step]()+'<p class="sponsor-status" role="status" data-offer-status></p><div class="sponsor-actions">'+
      '<button class="button" type="submit">'+(step===2?'Send offer to committee':'Continue')+'</button>'+
      (step?'<button class="text-link" type="button" data-step-back>Back</button>':'')+
      '<button class="text-link" type="button" data-cancel-offer>Close form</button></div></form>';
    area.querySelector('h2').focus();
  }
  function readFields(form) {
    const values=new FormData(form);
    for(const key of ['offer','eventName','requestedReturn','participationNote','contactName','organisation','email','phone']){
      if(form.elements.namedItem(key))draft[key]=String(values.get(key)||'').trim();
    }
    if(step===0)draft.offerTypes=values.getAll('offerTypes');
    if(step===1){
      draft.participation=values.getAll('participation');
      draft.adultAreaRequested=values.has('adultAreaRequested');draft.alcoholSupplyProposed=values.has('alcoholSupplyProposed');
    }
    if(step===2)draft.consent=values.has('consent');
  }
  function start(preset,replace=false) {
    area.hidden=false;
    if(draft && !preset){area.querySelector('h2')?.focus();return;}
    const form=area.querySelector('form');
    if(draft&&form)readFields(form);
    if(preset&&draft&&!replace&&signature(draft)!==baseline){
      pendingExample=preset;
      area.querySelector('[data-replace-choice]')?.remove();
      area.insertAdjacentHTML('afterbegin','<div class="sponsor-replace" data-replace-choice><h3 tabindex="-1">Use “'+esc(preset.title)+'” instead?</h3><p>This will replace your offer details. Your contact details stay in the form.</p><button type="button" class="button outline small" data-confirm-example>Replace offer details</button> <button type="button" class="text-link" data-keep-example>Keep my offer</button></div>');
      area.querySelector('[data-replace-choice] h3').focus();return;
    }
    const previous=draft;draft=blank();
    if(previous)for(const key of ['requestId','organisation','contactName','email','phone'])draft[key]=previous[key];
    currentExample=preset||null;pendingExample=null;
    if(preset){
      draft.offerTypes=['gift'];draft.participation=['none'];
      for(const k of exampleFields)if(k in preset)draft[k]=structuredClone(preset[k]);
    }
    baseline=signature(draft);
    host.querySelectorAll('.sponsor-example-group[open]').forEach(group=>group.open=false);
    step=0;render();
  }
  host.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||sending)return;
    if(b.hasAttribute('data-start-offer'))start();
    if(b.hasAttribute('data-example'))start(examples.get(b.dataset.example));
    if(b.hasAttribute('data-confirm-example')&&pendingExample)start(pendingExample,true);
    if(b.hasAttribute('data-keep-example')){pendingExample=null;area.querySelector('[data-replace-choice]')?.remove();area.querySelector('form h2')?.focus();}
    if(b.hasAttribute('data-step-back')){readFields(b.form);step--;render();}
    if(b.hasAttribute('data-cancel-offer')){
      readFields(b.form);area.hidden=true;const resume=host.querySelector('[data-start-offer]');
      resume.textContent='Continue my offer';resume.focus();
    }
  },{signal});
  host.addEventListener('change',event=>{
    const el=event.target,form=el.form;if(!form||!draft)return;
    if(el.name==='alcoholSupplyProposed')form.querySelector('[data-supply-info]').hidden=!el.checked;
    if(el.name==='adultAreaRequested'&&el.checked){
      form.querySelector('[name=participation][value=stand]').checked=true;
      form.querySelector('[name=participation][value=none]').checked=false;
    }
    if(el.name==='participation'&&((el.value==='none'&&el.checked)||(el.value==='stand'&&!el.checked))){
      form.elements.adultAreaRequested.checked=false;
      if(currentExample?.participationNote===form.elements.participationNote.value&&
          (el.value==='none'||currentExample?.participation?.includes('stand')))form.elements.participationNote.value='';
    }
    if(el.name==='participation'&&el.checked){
      if(el.value==='none')form.querySelectorAll('[name=participation]:not([value=none])').forEach(box=>box.checked=false);
      else form.querySelector('[name=participation][value=none]').checked=false;
    }
  },{signal});
  host.addEventListener('submit',async event=>{
    const form=event.target;if(!form.classList.contains('sponsor-form'))return;
    event.preventDefault();if(sending)return;
    readFields(form);
    const status=form.querySelector('[data-offer-status]');
    const warn=(msg,selector)=>{status.textContent=msg;form.querySelector(selector)?.focus();};
    if(!step&&!draft.offerTypes.length){warn('Choose at least one way you can help.','[name=offerTypes]');return;}
    if(!step&&!draft.offer){warn('Describe what you can offer.','[name=offer]');return;}
    if(step<2){step++;render();return;}
    if(!draft.contactName){warn('Enter your name so the committee knows who to contact.','[name=contactName]');return;}
    if(!draft.email&&!draft.phone){warn('Enter an email address or a phone number.','[name=email]');return;}
    if(!draft.consent){warn('Please confirm the club may store this offer and contact you about it.','[name=consent]');return;}
    sending=true;form.inert=true;status.textContent='Sending the offer…';
    try{
      await api('/api/sponsor-offers',{method:'POST',body:JSON.stringify(draft),signal});
      if(signal.aborted)return;
      draft=null;host.querySelector('[data-start-offer]').textContent='Make another offer';
      area.innerHTML='<section class="sponsor-received"><h2 tabindex="-1">Offer received</h2><p>Your offer is in the committee’s private sponsorship desk. Any prize, loan, stand or speaking time still needs agreement with the club.</p></section>';
      area.querySelector('h2').focus();
    }catch(error){if(!signal.aborted)status.textContent=error.message;}
    finally{if(!signal.aborted){sending=false;form.inert=false;}}
  },{signal});
}
