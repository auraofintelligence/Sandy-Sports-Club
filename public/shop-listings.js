export const shopTypes = {merchandise:'Merchandise',ticket:'Tickets',donation:'Donations',service:'Services'};
const choices = {
  merchandise:'Merchandise, clothing or other goods', ticket:'Ticket to a club event',
  donation:'A donation to the club', service:'A session, lesson or other club service'
};
const initialModes = {merchandise:'stock',ticket:'places',donation:'donation',service:'enquiry'};
const endpoint='/api/stock/shop/listings';
const currency=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'});
export function listingMoney(text) {
  const match=/^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if(!match)throw Error('Enter a dollar amount such as 25 or 25.50.');
  return Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
}
export function listingDate(value) {
  return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(value+'T12:00:00+10:00'));
}

export function setupShopListings({api,esc}) {
  const host=document.getElementById('shop-listing-office');
  if(!host)return;
  let session,controller,photosController,data,record,view='list',busy=false,variants=[],newId,retry;
  const active=()=>location.hash==='#stock' && session?.authenticated && session.canManageStock;
  const readOnly=()=>Boolean(session?.readOnly||session?.showcase||session?.demo);
  const get=selector=>host.querySelector(selector);
  const action=(key,label,primary=false)=>'<button type="button" class="button '+(primary?'':'outline small')+'" data-listing-action="'+key+'">'+label+'</button>';
  const choice=(value,label,current)=>'<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(label)+'</option>';
  const status=(text,error=false)=>{const s=get('[data-listing-status]');if(s){s.setAttribute('role',error?'alert':'status');s.textContent=text;}};
  const focus=()=>get('[data-listing-title]')?.focus();
  const shell=body=>{photosController?.abort();photosController=null;host.innerHTML='<section class="panel stock-panel listing-office">'+body+'<p data-listing-status role="status" aria-live="polite"></p></section>';};
  const title=(level,text)=>'<h'+level+' tabindex="-1" data-listing-title>'+esc(text)+'</h'+level+'>';
  function clear(){
    photosController?.abort();photosController=null;controller?.abort();controller=null;data=null;record=null;busy=false;retry=null;variants=[];host.replaceChildren();
  }
  async function load(keepId=null){
    clear();
    if(!active())return;
    const signal=(controller=new AbortController()).signal;
    shell('<p role="status">Opening shop listings…</p>');
    try{
      data=await api(endpoint,{signal,cache:'no-store'});
      if(signal.aborted)return;
      record=data.listings.find(r=>r.id===keepId);
      if(record)detail();else list();
    }catch(error){if(!signal.aborted){shell(action('reload','Reload shop listings'));status(error.message,true);}}
  }
  function list(){
    view='list';record=null;
    const rows=data.listings.map(r=>'<li><button type="button" class="text-link" data-open-listing="'+esc(r.id)+'">'+esc(r.name)+'</button><span>'+shopTypes[r.kind]+' · '+(r.published?'Public':'Draft')+'</span></li>').join('');
    shell(title(2,'Shop listings')+'<p>'+ (readOnly()?'View only. The Treasurer will set prices and stock before these sample items can be ordered.':'Set up merchandise, bookings or services. Check each draft before it appears in the public shop.')+'</p>'+
      '<div class="listing-actions">'+(readOnly()?'':action('new','Add a shop listing',true))+'<button type="button" class="button outline small" data-print-merch-stocktake>Print a stocktake sheet</button></div>'+(rows?'<details class="listing-list"><summary>Shop listings ('+data.listings.length+')</summary><ul>'+rows+'</ul></details>':''));
  }
  function detail(){
    view='detail';
    const r=record,hasOptions=r.mode==='stock'||r.mode==='places';
    const inventory=hasOptions?r.variants.map(v=>'<li><div><strong>'+esc(v.label)+'</strong><span>'+(!v.active?'Hidden from new requests':v.onHand==null?'Count to be confirmed':v.onHand+' '+(r.mode==='places'?'places':'on hand')+' · '+v.reserved+' held')+'</span></div>'+
      (r.mode==='stock'&&!readOnly()?'<button class="text-link" type="button" data-variant-action="'+(v.active?'retireVariant':'restoreVariant')+'" value="'+esc(v.id)+'">'+(v.active?'Hide':'Offer again')+'<span class="sr-only"> '+esc(v.label)+'</span></button>':'')+'</li>').join(''):'';
    shell(action('list','All shop listings')+title(2,r.name)+'<p class="listing-meta">'+shopTypes[r.kind]+' · '+(r.published?'Visible in the public shop':'Draft · Treasurer only')+'</p>'+
      (r.description?'<p>'+esc(r.description)+'</p>':'')+(r.eventDate?'<p>'+listingDate(r.eventDate)+' · Queensland time</p>':'')+
      '<p><strong>'+(r.variableAmount?'Visitor chooses a donation amount':r.priceCents!=null?currency.format(r.priceCents/100)+' AUD':'Price to be set by the Treasurer')+'</strong></p>'+
      (readOnly()?'':'<div class="listing-actions">'+action('edit','Edit listing')+action('photos','Listing photos')+action('price','Change price or payment link')+action(r.published?'unpublish':'publish',r.published?'Hide from shop':'Publish to shop',!r.published)+'</div>')+
      (hasOptions?'<section><h3>'+(r.mode==='places'?'Places':'Styles, colours and sizes')+'</h3>'+
        (inventory?'<ul class="listing-variants">'+inventory+'</ul>':'<p>Historical stock is listed in the stock book. Add a combination to offer it by style, colour or size.</p>')+
        (readOnly()?'':'<div class="listing-actions">'+(r.mode==='stock'?action('variants','Add combinations'):'')+action('stock',r.mode==='places'?'Update available places':'Open stock counts')+'</div>')+'</section>':''));
  }
  function editor(isNew){
    view=isNew?'new':'edit'; variants=[];retry=null;newId=crypto.randomUUID();
    const r=isNew?null:record;
    shell(action(isNew?'list':'detail',isNew?'All shop listings':'Back to listing')+title(2,isNew?'Add a shop listing':'Edit shop listing')+
      '<form class="listing-form" data-listing-form>'+
      (isNew?'<label>What are you offering?<select name="kind">'+Object.entries(choices).map(([key,label])=>choice(key,label,'merchandise')).join('')+'</select></label>':'')+
      '<label>Public name<input name="name" maxlength="120" required value="'+esc(r?.name||'')+'"></label>'+
      '<label>What should visitors know?<textarea name="description" maxlength="600" rows="3" required>'+esc(r?.description||'')+'</textarea></label>'+
      '<div data-type-fields></div>'+
      (isNew?'<label data-opening-price>Price in Australian dollars (optional)<input name="price" inputmode="decimal" placeholder="e.g. 25.00"></label>':'')+
      '<p class="listing-help">'+(isNew?'Save a draft first. You can review it, set up payment and publish when ready.':r.published?'Saved changes will appear in the public shop.':'Your changes will stay in the draft.')+'</p><button class="button" type="submit">'+(isNew?'Save draft listing':'Save listing changes')+'</button></form>');
    typeFields(r?.kind||'merchandise',isNew);
  }
  function typeFields(kind,isNew){
    const target=get('[data-type-fields]');
    const r=isNew?null:record;
    const hints={merchandise:'Describe the item and how people can collect it.',ticket:'Include the venue, start time and what one ticket covers.',donation:'Explain what donations will support.',service:'Name the organiser, what is included, where it runs and how booking will be confirmed.'};
    const form=get('[data-listing-form]');
    form.elements.description.placeholder=hints[kind];
    const dated=['ticket','service'].includes(kind);
    target.innerHTML=(dated?'<label>Event or service date (if set)<input type="date" name="eventDate" value="'+esc(r?.eventDate||'')+'"></label>':'')+
      (kind==='donation'?'<label>Donation amount<select name="donationType">'+choice('variable','Visitor chooses the amount',r?.variableAmount!==false?'variable':'fixed')+choice('fixed','Fixed amount',r?.variableAmount===false?'fixed':'variable')+'</select></label>':'')+
      (kind==='service'&&isNew?'<label>How should bookings work?<select name="serviceMode"><option value="enquiry">Ask about a session or private booking</option><option value="places">Request places on a scheduled service</option></select></label>':'')+
      (isNew&&dated?'<label data-capacity>How many places can the club offer?<input type="number" name="places" min="1" max="999999" step="1"><small>Confirmed bookings hold their places. The Treasurer can record payment or release a cancelled booking.</small></label>':'')+
      (isNew&&kind==='merchandise'?variantEditor():'');
    if(isNew&&kind==='merchandise')paintVariants();
    conditional();
  }
  function conditional(){
    const form=get('[data-listing-form]');if(!form)return;
    const f=form.elements,kind=f.kind?.value||record?.kind;
    if(f.places){const cap=kind==='ticket'||f.serviceMode?.value==='places';f.places.disabled=!cap;f.places.required=cap;f.places.closest('label').hidden=!cap;}
    if(f.price){const variable=f.donationType?.value==='variable';f.price.disabled=variable;f.price.closest('label').hidden=variable;}
  }
  function variantEditor(){
    return '<fieldset class="listing-combos"><legend>Stock options</legend><p>For clothing, enter a style, then the colours and sizes in that style. For one item with no options, leave the fields empty and choose Add these options to enter its count.</p>'+
      '<label>Style or option name<input name="style" maxlength="35" placeholder="e.g. Long sleeve"></label>'+
      '<label>Colours, separated by commas<input name="colours" maxlength="240" placeholder="e.g. Blue, White"></label>'+
      '<label>Sizes, separated by commas<input name="sizes" maxlength="240" placeholder="e.g. S, M, L"></label>'+
      action('build','Add these options')+'<div data-variant-list></div><details class="listing-cost"><summary>Opening cost, if known</summary><p>Use this when the counted options cost the same per item. For different costs, record them individually in the stock book.</p><label>Cost of one item (AUD)<input inputmode="decimal" name="openingCost" placeholder="e.g. 8.50"></label><label>Supplier or invoice reference (optional)<input name="costSource" maxlength="100"></label></details></fieldset>';
  }
  function costed(options,f){
    const amount=f.openingCost.value.trim(),source=f.costSource.value.trim();
    if(!amount&&!source)return options;
    if(!amount)throw Error('Enter the unit cost for this supplier reference, or leave both fields blank.');
    if(!options.some(v=>v.units!==null))throw Error('Enter a count for at least one option before recording its opening cost.');
    const unitCostCents=listingMoney(amount);
    return options.map(v=>v.units===null?v:{...v,unitCostCents,costSource:source});
  }
  function paintVariants(){
    const area=get('[data-variant-list]');if(!area)return;
    area.innerHTML=variants.length?'<p>Enter the count for each option if you have counted it. A blank count means it still needs checking.</p><ul class="listing-variants">'+variants.map((v,i)=>'<li><label>'+esc(v.label)+'<input data-vcount="'+i+'" aria-label="'+esc(v.label)+' count" type="number" min="0" max="999999" step="1" inputmode="numeric" placeholder="Not counted" value="'+esc(v.units??'')+'"></label><button type="button" class="text-link" data-vremove="'+i+'">Remove<span class="sr-only"> '+esc(v.label)+'</span></button></li>').join('')+'</ul>':'';
  }
  function buildVariants(f){
    const split=s=>s.trim()?s.split(',').map(i=>i.trim()).filter(Boolean):[''];
    const style=f.style.value.trim(), colours=split(f.colours.value), sizes=split(f.sizes.value);
    const rows=colours.flatMap(colour=>sizes.map(size=>({style,colour,size,label:[style,colour,size].filter(Boolean).join(' / ')||'Standard'})));
    if(rows.some(v=>v.colour.length>35||v.size.length>35||v.label.length>100))throw Error('Use up to 35 characters for a style, colour or size and up to 100 for a full option.');
    const existing = new Set([...variants,...(view==='variants'?record.variants:[])].map(v=>v.label.toLowerCase()));
    const fresh=rows.filter(v=>{const label=v.label.toLowerCase();if(existing.has(label))return false;existing.add(label);return true;});
    if(!fresh.length)throw Error('Those options are already listed. A hidden option can be offered again.');
    if(variants.length+fresh.length>24)throw Error('Add up to 24 combinations in one save. You can add more afterwards.');
    variants.push(...fresh.map(v=>({...v,units:null})));f.style.value='';f.colours.value='';f.sizes.value='';paintVariants();
    status(fresh.length===1?'One option added to this form.':fresh.length+' options added to this form.');
  }
  async function save(payload,text){
    if(busy||!controller||readOnly())return;busy=true;
    const signal=controller.signal,key=JSON.stringify(payload);
    if(retry?.key!==key)retry={key,id:crypto.randomUUID()};
    const controls=[...host.querySelectorAll('button:not(:disabled)')];controls.forEach(el=>el.disabled=true);status('Saving…');
    try{
      data=await api(endpoint,{method:'POST',signal,body:JSON.stringify({...payload,mutationId:retry.id})});
      if(signal.aborted)return;
      record=data.listings.find(r=>r.id===payload.id);retry=null;detail();focus();status(text);
      window.dispatchEvent(new Event('plfc:shop-listings-changed'));
      window.dispatchEvent(new Event('plfc:stock-updated'));
    }catch(error){
      if(signal.aborted)return;
      status(error.message,true);
      if(error.status===409 && !get('[data-listing-action=reload]'))get('[data-listing-status]')?.insertAdjacentHTML('afterend',action('reload','Reload current listing'));
    }finally{if(!signal.aborted){busy=false;controls.forEach(el=>el.disabled=false);}}
  }
  host.addEventListener('input',e=>{
    if(e.target.hasAttribute('data-vcount'))variants[Number(e.target.dataset.vcount)].units=e.target.value===''?null:Number(e.target.value);
  });
  host.addEventListener('change',e=>{
    if(e.target.name==='kind'){typeFields(e.target.value,true);status('');}
    else if(e.target.name==='donationType'||e.target.name==='serviceMode')conditional();
  });
  host.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||busy)return;
    if(readOnly() && !b.dataset.openListing && !['reload','list','detail'].includes(b.dataset.listingAction))return;
    try{
      if(b.dataset.openListing){record=data.listings.find(r=>r.id===b.dataset.openListing);detail();}
      else if(b.hasAttribute('data-vremove')){variants.splice(Number(b.dataset.vremove),1);paintVariants();return;}
      else if(b.dataset.variantAction){return save({action:b.dataset.variantAction,id:record.id,version:record.version,variantId:b.value},b.dataset.variantAction==='retireVariant'?'Option hidden from new requests.':'Option is available to offer again.');}
      else{
        const what=b.dataset.listingAction;
        if(what==='reload')return load(record?.id);
        if(what==='list')list();else if(what==='detail')detail();
        else if(what==='new'||what==='edit')editor(what==='new');
        else if(what==='build')return buildVariants(b.closest('form').elements);
        else if(what==='publish'||what==='unpublish')return save({action:what,id:record.id,version:record.version},what==='publish'?'Listing published in the club shop.':'Listing hidden from the club shop.');
        else if(what==='variants'){
          view='variants';variants=[];shell(action('detail','Back to listing')+title(2,'Add stock options')+'<p>'+esc(record.name)+'</p><form data-listing-form class="listing-form">'+variantEditor()+'<button type="submit" class="button">Save stock options</button></form>');paintVariants();
        }else if(what==='photos'){
          view='photos';shell(action('detail','Back to listing')+title(2,'Listing photos')+'<p>'+esc(record.name)+'</p><div data-listing-photos></div>');
          const area=get('[data-listing-photos]'),signal=(photosController=new AbortController()).signal,productId=record.id;
          import('./shop-photos.js').then(({mountShopPhotos})=>{if(!signal.aborted)mountShopPhotos(area,{api,esc,productId,signal});}).catch(()=>{if(!signal.aborted)status('The photo editor could not open. Go back to the listing and try again.',true);});
        }else if(what==='price'){window.dispatchEvent(new CustomEvent('plfc:edit-shop-price',{detail:{id:record.id}}));return;}
        else if(what==='stock'){
          const form=document.querySelector('[data-ledger-form]');if(!form){status('The stock book is still loading. Try again shortly.');return;}
          const f=form.elements;f.kind.value='count';f.kind.dispatchEvent(new Event('input',{bubbles:true}));
          const variant=record.variants.find(v=>v.active);if(variant && [...f.itemId.options].some(o=>o.value===variant.id))f.itemId.value=variant.id;
          f.itemId.dispatchEvent(new Event('input',{bubbles:true}));f.itemId.focus();return;
        }else return;
      }
      focus();
    }catch(error){status(error.message,true);}
  });
  host.addEventListener('submit',e=>{
    if(!e.target.matches('[data-listing-form]'))return;e.preventDefault();if(busy||readOnly())return;
    try{
      const f=e.target.elements, creating=view==='new';
      if(view==='variants'){
        if(f.style.value.trim()||f.colours.value.trim()||f.sizes.value.trim())buildVariants(f);
        if(!variants.length)throw Error('Add at least one stock option before saving.');
        return save({action:'addVariants',id:record.id,version:record.version,variants:costed(variants,f)},'Stock options saved.');
      }
      const kind=f.kind?.value||record.kind,mode=kind==='service'?(f.serviceMode?.value||record.mode):initialModes[kind], variableAmount=f.donationType?.value==='variable';
      const common={name:f.name.value.trim(),description:f.description.value.trim(),variableAmount,...(f.eventDate?{eventDate:f.eventDate.value||null}:{})};
      if(!creating)return save({action:'edit',id:record.id,version:record.version,...common},'Listing updated.');
      const priceCents=!f.price.disabled&&f.price.value.trim()?listingMoney(f.price.value):null;
      if(priceCents!==null && (priceCents<=0||priceCents>1000000))throw Error('Enter a price from $0.01 to $10,000 or leave it unpriced until the Treasurer decides.');
      if(mode==='stock'&&(f.style.value.trim()||f.colours.value.trim()||f.sizes.value.trim()))buildVariants(f);
      const options=mode==='stock'?costed(variants.length?variants:[{label:'Standard',units:null}],f):mode==='places'?[{label:'Places',units:Number(f.places.value)}]:[];
      return save({action:'create',id:newId,kind,mode,...common,priceCents,variants:options},'Draft saved. Check the details and publish when ready.');
    }catch(error){status(error.message,true);}
  });
  window.addEventListener('plfc:prices-changed',()=>{if(active()&&view==='detail')load(record?.id);});
  window.addEventListener('plfc:navigated',()=>{if(!active())clear();else if(!controller)load();});
  window.addEventListener('plfc:session-changed',({detail})=>{clear();session=detail;if(active())load();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',event=>{if(event.persisted&&active())load();});
}
