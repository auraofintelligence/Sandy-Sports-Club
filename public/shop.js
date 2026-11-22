import {setupClubStock} from './club-stock.js?v=20261121-newsroom';
import {listingDate,listingMoney,shopTypes} from './shop-listings.js';

const artwork = {
  shirt: '<div class="merch-demo-art" role="img" aria-label="Illustrative club shirt design to be confirmed">Club shirt preview</div>',
  cooler: '<div class="merch-demo-art" role="img" aria-label="Illustrative club cooler design to be confirmed">Club cooler preview</div>',
  sticker: '<div class="merch-demo-art" role="img" aria-label="Illustrative club sticker design to be confirmed">Club sticker preview</div>',
};
const descriptions = {
  shirt: 'Demo merchandise. Design, stock and price await the Treasurer.',
  cooler: 'Demo merchandise. Design, stock and price await the Treasurer.',
  sticker: 'Demo merchandise. Design, stock and price await the Treasurer.',
};
const currency = new Intl.NumberFormat('en-AU', {style:'currency',currency:'AUD'});
const escape = value => String(value??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function request(path, payload) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const options={cache:'no-store',signal:controller.signal};
  if (payload) Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let response,result;
  try {response=await fetch(path,options); result=await response.json();}
  catch {throw Error('The club connection was interrupted. Please try again.');}
  finally {clearTimeout(timer);}
  if (!response.ok) throw Error(result.error?.message || result.error || 'The club could not complete this request. Please try again.');
  return result;
}

function checkoutLink(offer) {
  if (!offer.checkoutUrl || !(offer.variableAmount&&offer.kind==='donation'||Number.isSafeInteger(offer.priceCents)&&offer.priceCents>0)) return '';
  try {
    const url=new URL(offer.checkoutUrl);
    if (url.protocol==='https:' && !url.username && !url.password && !url.port
        && ['square.link','checkout.square.site'].includes(url.hostname)) return url.href;
  } catch { /* A missing or invalid link leaves the two contact options available. */ }
  return '';
}

const gift=item=>item.kind==='donation';
const booking=item=>item.mode==='places';
const todayInQueensland=()=>new Date(Date.now()+36000000).toISOString().slice(0,10);
const modes={stock:'Club merchandise',places:'Places by request',enquiry:'Service by enquiry',donation:'Club fundraising'};
const actionName=item=>booking(item)?'Request places':gift(item)?'Ask about donating':item.kind==='service'?'Ask about booking':'Request pickup';
function productImage(item,variantId) {
  const photo=item.variants.find(v=>v.id===variantId)?.photo||item.photo;
  if(photo?.url && typeof photo.url==='string' && photo.url.startsWith('/') && !photo.url.startsWith('//'))return '<img src="'+escape(photo.url)+'" alt="'+escape(photo.alt||item.name)+'" loading="lazy">';
  return artwork[item.id]||'';
}
function stockChoices(item) {
  if(item.mode==='stock' && item.variants.length){
    if(item.variants.length===1)return '<p class="merch-sizes"><strong>Option</strong> · '+escape(item.variants[0].label)+'</p>';
    return '<label class="shop-choice">Style, colour or size<select data-card-variant><option value="">Choose an option</option>'+item.variants.map(v=>'<option value="'+escape(v.id)+'">'+escape(v.label)+(v.available===false?' · none available':v.available==null?' · availability to confirm':'')+'</option>').join('')+'</select></label>';
  }
  if(item.sizes.length===1)return '<p class="merch-sizes"><strong>Size</strong> · '+escape(item.sizes[0])+'</p>';
  return item.sizes.length?'<p class="merch-sizes">Sizes listed · '+item.sizes.map(escape).join(', ')+'</p>':'';
}
function productCard(item) {
  const id=escape(item.id),name=escape(item.name),canCheckout=['stock','donation'].includes(item.mode);
  const online=canCheckout && (item.id!=='shirt'||item.sizes.length||item.variants.length)?checkoutLink(item):'';
  const confirmed=Number.isSafeInteger(item.priceCents)&&item.priceCents>0;
  const price=item.variableAmount?'Choose your donation amount':confirmed?currency.format(item.priceCents/100)+' AUD'+(booking(item)?' per place':''):item.kind==='merchandise'?'Price to be set by the Treasurer':item.offerLoaded?'Price by enquiry':'Price to be confirmed';
  const past=booking(item)&&item.eventDate&&item.eventDate<todayInQueensland();
  const none=(item.hasVariants||item.variants.length>0)&&item.variants.every(v=>v.available===false);
  const noPlaces=booking(item)&&none;
  const visual=productImage(item,item.mode==='stock' && item.variants.length===1?item.variants[0].id:'');
  return '<article class="merch-item" data-shop-card="'+id+'"><div class="merch-image"'+(!visual?' hidden':'')+'>'+visual+'</div><div class="merch-copy"><small>'+escape(modes[item.mode]||'Club shop')+'</small><h2>'+name+'</h2><p>'+escape(item.description||descriptions[item.id]||'')+'</p>'+
    (item.eventDate?'<p class="shop-date"><time datetime="'+escape(item.eventDate)+'">'+listingDate(item.eventDate)+'</time> · Queensland time</p>':'')+
    '<p class="merch-price">'+price+'</p>'+
    stockChoices(item)+
    '<div class="merch-actions">'+(online&&!none?'<a class="button" data-shop-checkout href="'+escape(online)+'">'+(gift(item)?'Donate with Square':'Buy online with Square')+'</a>':'')+
    (item.mode==='stock'||booking(item)?'<button type="button" class="button'+(online?' outline':'')+'" data-product="'+id+'" data-request-kind="pickup"'+(none||past?' disabled':'')+'>'+actionName(item)+'</button>':'')+
    '<button type="button" class="'+(item.mode==='enquiry'||gift(item)?'button outline':'text-link')+'" data-product="'+id+'" data-request-kind="enquiry">'+(gift(item)||item.mode==='enquiry'?actionName(item):'Ask about this '+(booking(item)?'booking':'item'))+'</button></div>'+
    '<small data-offer-note>'+(past?'This date has passed. Ask the club about a future date.':noPlaces?'All counted places are held or used. Ask the club about availability.':none?'The listed options are currently unavailable. Ask the club about future stock.':booking(item)?'The club will confirm the date, price and available places.':gift(item)?'A donation enquiry lets the Treasurer follow up with you.':item.mode==='enquiry'?'The club will check the operator’s availability and reply.':online?'Payment opens on the club’s Square checkout.':'The club will confirm availability and collection with you.')+'</small></div></article>';
}

function shopRequestDialog(shop) {
  const dialog=document.createElement('dialog');
  dialog.className='merch-dialog';dialog.setAttribute('aria-labelledby','merch-request-title');
  dialog.innerHTML='<div class="merch-dialog-head"><h2 id="merch-request-title" tabindex="-1"></h2><button class="text-link" type="button" data-close>Close</button></div>'+
    '<div data-receipt hidden></div><form><p data-instructions></p><fieldset><label>Your name<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label>'+
    '<fieldset><legend>How can the club reach you?</legend><p>Give an email address, a mobile number, or both.</p>'+
    '<label>Email address<input type="email" name="email" autocomplete="email" maxlength="150"></label>'+
    '<label>Mobile number<input type="tel" name="mobile" autocomplete="tel" maxlength="25"></label></fieldset>'+
    '<label data-quantity>How many?<input type="number" name="quantity" min="1" max="99" step="1" value="1" required></label><p data-estimate hidden></p>'+
    '<label data-size><span id="merch-size-label">Size</span><select name="size" aria-labelledby="merch-size-label"></select></label>'+
    '<p data-fixed-choice hidden></p>'+
    '<label data-variant hidden>Style, colour or size<select name="variantId"></select></label><label data-gift hidden>Donation amount you have in mind (AUD, optional)<input name="requestedAmount" inputmode="decimal"></label>'+
    '<label><span data-message-label></span><textarea name="message" rows="3" maxlength="1000"></textarea></label>'+
    '<label class="merch-consent"><input name="consent" type="checkbox" required>I agree that Sandy Sports Club can use these details to contact me about this request.</label>'+
    '<button class="button" type="submit"></button></fieldset><p data-status role="status"></p></form>';
  shop.append(dialog);
  const form=dialog.querySelector('form'),fields=form.elements,title=dialog.querySelector('h2');
  const receipt=dialog.querySelector('[data-receipt]'),status=form.querySelector('[data-status]'),send=form.querySelector('[type=submit]');
  let intent=null,sending=false,listedPrice=null,listing=null;
  const estimate=form.querySelector('[data-estimate]');
  function priceEstimate() {
    const qty=fields.quantity.valueAsNumber;
    estimate.hidden=intent?.kind!=='pickup' || !listedPrice || !Number.isSafeInteger(qty) || qty<1 || qty>99;
    estimate.textContent=estimate.hidden?'':'Listed price '+currency.format(listedPrice/100)+' each. Total at this price '+currency.format(qty*listedPrice/100)+' AUD.';
  }
  const close=()=>dialog.close();
  dialog.querySelector('[data-close]').onclick=close;
  dialog.addEventListener('cancel',event=>{if(sending)event.preventDefault();});
  dialog.addEventListener('close',()=>{
    if(!sending){form.reset();intent=null;status.textContent='';receipt.replaceChildren();}
  });
  function configure(item,kind,chosenVariant='') {
    const pickup=kind==='pickup';
    listing=item;
    if(sending){if(!dialog.open)dialog.showModal();return;}
    if (!intent || intent.productId!==item.id || intent.kind!==kind) {
      form.reset();intent={productId:item.id,kind,requestId:crypto.randomUUID()};
      fields.email.setCustomValidity('');fields.mobile.setCustomValidity('');
    }
    const size=fields.size.value;
    fields.size.innerHTML='<option value="">'+(pickup?'Choose size':'Any size')+'</option>'+item.sizes.map(s=>'<option value="'+escape(s)+'">'+escape(s)+'</option>').join('');
    if(pickup && item.sizes.length===1)fields.size.value=item.sizes[0];
    else if(item.sizes.includes(size))fields.size.value=size;
    receipt.hidden=true;receipt.replaceChildren();form.hidden=false;status.textContent='';
    title.textContent=(pickup && booking(item)?'Request places · ':pickup?'Request pickup · ':'Ask about · ')+item.name;
    form.querySelector('[data-instructions]').textContent=booking(item)&&pickup?'Tell the club how many places you need. Your booking is confirmed only when the club contacts you and agrees the arrangements.':
      gift(item)?'Tell the Treasurer how you would like to help. This form sends an enquiry. Any donation is arranged separately.':
      item.kind==='service'?'Include preferred dates, the number of people and any questions. The club will check with the operator and reply before confirming a booking.':
      pickup?'The club will check the price and stock, then contact you to agree on collection and payment at handover.':'Send your question to the club. The Treasurer can reply using the contact details you provide.';
    listedPrice=item.priceCents;priceEstimate();
    form.querySelector('[data-quantity]').hidden=!pickup;fields.quantity.disabled=!pickup;
    form.querySelector('[data-quantity]').firstChild.textContent=booking(item)?'How many places?':'How many?';
    const useSizes=!item.variants.length && item.sizes.length>0;
    const fixedSize=pickup && useSizes && item.sizes.length===1;
    form.querySelector('[data-size]').hidden=!useSizes || fixedSize;
    fields.size.disabled=!useSizes;
    fields.size.required=pickup && useSizes;
    const chooseVariant=item.mode==='stock' && item.variants.length>0;
    const fixedVariant=pickup && chooseVariant && item.variants.length===1;
    form.querySelector('[data-variant]').hidden=!chooseVariant || fixedVariant;
    fields.variantId.disabled=!chooseVariant;
    fields.variantId.required=pickup && chooseVariant;
    fields.variantId.innerHTML='<option value="">'+(pickup?'Choose an option':'Any option')+'</option>'+item.variants.map(v=>'<option value="'+escape(v.id)+'"'+(pickup&&v.available===false?' disabled':'')+'>'+escape(v.label)+(v.available===false?' · none available':'')+'</option>').join('');
    if(fixedVariant)fields.variantId.value=item.variants[0].id;
    else if(chosenVariant && [...fields.variantId.options].some(o=>o.value===chosenVariant&&!o.disabled))fields.variantId.value=chosenVariant;
    const fixed=form.querySelector('[data-fixed-choice]');
    fixed.hidden=!fixedVariant && !fixedSize;
    fixed.textContent=fixedVariant?'Option · '+item.variants[0].label:fixedSize?'Size · '+item.sizes[0]:'';
    const chooseAmount=gift(item)&&item.variableAmount;form.querySelector('[data-gift]').hidden=!chooseAmount;fields.requestedAmount.disabled=!chooseAmount;fields.requestedAmount.setCustomValidity('');
    form.querySelector('[data-message-label]').textContent=pickup||gift(item)?'Anything else the club should know? (optional)':item.kind==='service'?'Your dates or question':'Your question';
    fields.message.required=!pickup&&!gift(item);
    fields.message.placeholder=pickup && item.id==='shirt' && !useSizes && !chooseVariant?'Include the shirt size you would like.':'';
    send.textContent=pickup?(booking(item)?'Send booking request':'Send pickup request'):'Send enquiry';
    if(!dialog.open)dialog.showModal();
    title.focus();
  }
  form.addEventListener('input',()=>{fields.email.setCustomValidity('');fields.mobile.setCustomValidity('');fields.requestedAmount.setCustomValidity('');});
  fields.quantity.addEventListener('input',priceEstimate);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(sending||!intent)return;
    const email=fields.email.value.trim(),mobile=fields.mobile.value.trim();
    if(!email&&!mobile){fields.email.setCustomValidity('Enter an email address or mobile number so the club can reply.');fields.email.reportValidity();return;}
    if(mobile && (mobile.replace(/\D/g,'').length<7 || !/^\+?[0-9 ()-]+$/.test(mobile))){fields.mobile.setCustomValidity('Enter a mobile number with at least seven digits.');fields.mobile.reportValidity();return;}
    const pickup=intent.kind==='pickup';
    const variant=booking(listing)&&pickup?listing.variants[0]?.id:fields.variantId.disabled?'':fields.variantId.value;
    let requestedAmountCents;
    if(!fields.requestedAmount.disabled&&fields.requestedAmount.value.trim()){
      try{requestedAmountCents=listingMoney(fields.requestedAmount.value);if(requestedAmountCents<=0)throw Error('Enter a donation amount greater than zero.');}
      catch(error){fields.requestedAmount.setCustomValidity(error.message);fields.requestedAmount.reportValidity();return;}
    }
    const payload={...intent,name:fields.name.value.trim(),email,mobile,quantity:pickup?Number(fields.quantity.value):1,...(variant?{variantId:variant}:{}),
      ...(requestedAmountCents?{requestedAmountCents}:{}),size:fields.size.disabled?'':fields.size.value,message:fields.message.value.trim()||(gift(listing)?'I would like to discuss a donation.':''),consent:fields.consent.checked};
    const inputs=form.querySelector('fieldset'),closeButton=dialog.querySelector('[data-close]');
    sending=true;inputs.disabled=true;closeButton.disabled=true;status.textContent='Sending your request…';
    try {
      const saved=await request('/api/shop/requests',payload);
      if(!saved.reference)throw Error('The club did not return a reference. Please try again with the same details.');
      title.textContent=pickup?(booking(listing)?'Booking request received':'Pickup request received'):'Enquiry received';
      receipt.innerHTML='<p>Your reference is <strong>'+escape(saved.reference)+'</strong>.</p><p>'+
        (booking(listing)&&pickup?'The club will check availability and contact you about the arrangements. Please wait for confirmation before making plans.':pickup?'The club will contact you to confirm availability, price and collection before you make any payment.':gift(listing)?'The Treasurer has your enquiry and will contact you about your offer.':'The club has your question and contact details.')+
        '</p><button class="button" type="button">Back to the shop</button>';
      receipt.querySelector('button').onclick=close;
      form.reset();form.hidden=true;receipt.hidden=false;intent=null;title.focus();
    } catch(error) {
      status.textContent=error.message||'Could not reach the club. Your details are still here. Please try again.';
    } finally {
      sending=false;inputs.disabled=false;closeButton.disabled=false;
      if(!dialog.open){form.reset();intent=null;receipt.replaceChildren();}
    }
  });
  return {open:configure,close:()=>{if(dialog.open)close();}};
}

export function setupShop() {
  const shop = document.querySelector('[data-view="shop"]');
  const desk = document.querySelector('[data-view="stock"]');
  shop.innerHTML = `<h1 class="page-title">Club shop</h1>
    <div data-merch-range aria-live="polite"><p>Opening the club catalogue…</p></div>
    <p>Browse club merchandise and current offers. The Treasurer confirms prices and availability.</p>`;
  desk.innerHTML = `<div data-stock-overview><a class="text-link" href="#committee">Back to committee</a>
    <p class="eyebrow">Treasurer’s desk</p><h1 class="page-title">Shop, stock and prices</h1>
    <nav class="member-tabs desk-shortcuts" aria-label="Treasurer tools"><button type="button" data-desk-target="club-prices">Club prices</button><button type="button" data-desk-target="treasurer-orders">Customer requests</button><button type="button" data-desk-target="club-ledger" data-delivery-shortcut>Receive stock</button><button type="button" data-desk-target="club-ledger">Stock book</button><a href="#stock/reports">Stock and sales reports</a><a data-returning-finance hidden href="#stock/returning">Membership fee waivers</a><a href="#committee/todos">My to-do list</a><a href="#committee/news">Newsletter desk</a><a href="#committee/handover">Officer handover</a></nav>
    <div id="shop-listing-office"></div><div id="club-prices"></div>
    <div id="treasurer-orders"></div>
    <div id="club-ledger" data-club-stock aria-live="polite"><p>Checking access to the club stock book…</p></div></div>
    <div data-returning-view hidden><a class="text-link" href="#stock">Back to treasurer’s desk</a><div id="stock-returning"></div></div>
    <div data-reports-view hidden><a class="text-link" href="#stock">Back to treasurer’s desk</a><div id="monthly-reports"></div></div>`;
  desk.querySelector('nav').addEventListener('click',event=>{
    const target=document.getElementById(event.target.closest('button')?.dataset.deskTarget);
    if(!target)return;
    if(event.target.closest('[data-delivery-shortcut]')){
      const form=target.querySelector('[data-ledger-form]');
      if(form){form.elements.kind.value='delivery';form.elements.kind.dispatchEvent(new Event('input',{bubbles:true}));form.elements.itemId.focus();form.scrollIntoView({block:'center'});return;}
    }
    const heading=target.querySelector('h2,summary')||target;
    heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});
  });
  const listingsShortcut=document.createElement('button');listingsShortcut.type='button';listingsShortcut.dataset.deskTarget='shop-listing-office';listingsShortcut.textContent='Shop listings';desk.querySelector('nav').prepend(listingsShortcut);
  const range=shop.querySelector('[data-merch-range]'),dialog=shopRequestDialog(shop);
  let requestVersion=0,loading=null,items=[],category='all',previewOnly=false;
  function paint(){
    const groups=Object.keys(shopTypes).filter(kind=>items.some(item=>item.kind===kind));
    if(!groups.includes(category))category='all';
    const visible=items.filter(item=>category==='all'||item.kind===category);
    const hasDemo=visible.some(item=>['shirt','cooler','sticker'].includes(item.id)&&!(Number.isSafeInteger(item.priceCents)&&item.priceCents>0));
    range.innerHTML=(previewOnly?'<p>Preview only. Shop requests and checkout are unavailable in this view.</p>':'')+(hasDemo?'<p>These demo merchandise listings have no confirmed design, stock or price yet.</p>':'')+(groups.length>1?'<div role="group" class="shop-categories" aria-label="Shop categories">'+[['all','All offerings'],...groups.map(k=>[k,shopTypes[k]])].map(([k,label])=>'<button type="button" data-shop-category="'+k+'" aria-pressed="'+(category===k)+'">'+label+'</button>').join('')+'</div>':'')+
      (visible.length?'<div class="merch-range">'+visible.map(productCard).join('')+'</div>':'<p>The club has no public listings at the moment.</p>');
    for(const item of visible){
      if(!['shirt','cooler','sticker'].includes(item.id)||Number.isSafeInteger(item.priceCents)&&item.priceCents>0)continue;
      const card=[...range.querySelectorAll('[data-shop-card]')].find(node=>node.dataset.shopCard===item.id);
      card?.querySelector('.merch-actions')?.remove();
      if(card)card.querySelector('[data-offer-note]').textContent='Demo listing. The Treasurer will confirm the design, stock and price before requests open.';
    }
    if(previewOnly)range.querySelectorAll('[data-shop-checkout],[data-product]').forEach(control=>{control.hidden=true;});
  }
  async function load() {
    if (location.hash!=='#shop' || loading) return;
    const version=++requestVersion;
    const job=Promise.allSettled([request('/api/shop/catalogue'),request('/api/shop/offers')]);
    loading=job;
    try {
      const [catalogue,offers]=await job;
      if(version!==requestVersion)return;
      if(catalogue.status!=='fulfilled')throw catalogue.reason;
      const listings=new Map((offers.status==='fulfilled'?offers.value.offers:[]).map(o=>[o.productId,o]));
      items=catalogue.value.products.map(p=>{
        const offer=listings.get(p.id)||{};
        const demo=['shirt','cooler','sticker'].includes(p.id)&&!(Number.isSafeInteger(offer.priceCents)&&offer.priceCents>0);
        return {...p,id:p.id,name:p.name,description:demo?descriptions[p.id]:p.description,kind:p.kind||'merchandise',mode:p.mode||'stock',variants:Array.isArray(p.variants)?p.variants:[],offerLoaded:listings.has(p.id),priceCents:offer.priceCents,checkoutUrl:offer.checkoutUrl,sizes:Array.isArray(offer.sizes)?offer.sizes:[]};
      });
      paint();
      if(offers.status==='rejected')range.insertAdjacentHTML('beforeend','<p>Current prices and online payment options could not load. <button class="text-link" type="button" data-retry>Check again</button></p>');
    } catch(error) {
      items=[];range.innerHTML='<p>'+escape(error.message)+'</p><button class="text-link" type="button" data-retry>Try again</button>';
    } finally {if(loading===job)loading=null;}
  }
  range.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.hasAttribute('data-retry')){load();return;}
    if(button.dataset.shopCategory){category=button.dataset.shopCategory;paint();range.querySelector('[data-shop-category="'+category+'"]')?.focus({preventScroll:true});return;}
    if(previewOnly)return;
    const item=items.find(p=>p.id===button.dataset.product);
    if(item && ['enquiry','pickup'].includes(button.dataset.requestKind))dialog.open(item,button.dataset.requestKind,button.closest('[data-shop-card]').querySelector('[data-card-variant]')?.value);
  });
  range.addEventListener('change',event=>{
    if(!event.target.matches('[data-card-variant]'))return;
    const card=event.target.closest('[data-shop-card]'),item=items.find(i=>i.id===card.dataset.shopCard);
    const selected=item.variants.find(v=>v.id===event.target.value);
    const image=card.querySelector('.merch-image'),visual=productImage(item,selected?.id);image.innerHTML=visual;image.hidden=!visual;
    const unavailable=selected?selected.available===false:item.variants.every(v=>v.available===false);
    const pickup=card.querySelector('[data-request-kind=pickup]');if(pickup)pickup.disabled=unavailable;
    const online=card.querySelector('[data-shop-checkout]');if(online)online.hidden=unavailable;
    if(selected)card.querySelector('[data-offer-note]').textContent=selected.available===false?'This option is currently unavailable. You can still ask the club about it.':online?'At Square checkout, choose '+selected.label+'. You can also ask the club for pickup.':selected.available==null?'The club will check this option’s stock and confirm collection.':'Request a pickup and the club will confirm the arrangements.';
    else card.querySelector('[data-offer-note]').textContent='The club will confirm availability and collection with you.';
  });
  window.addEventListener('plfc:navigated',event=>{
    const reporting=event.detail.hash==='#stock/reports';
    const returning=event.detail.hash==='#stock/returning';
    desk.querySelector('[data-stock-overview]').hidden=reporting||returning;
    desk.querySelector('[data-returning-view]').hidden=!returning;
    desk.querySelector('[data-reports-view]').hidden=!reporting;
    if(event.detail.page==='shop')load();
    else{requestVersion++;loading=null;dialog.close();}
  });
  window.addEventListener('pageshow',load);
  window.addEventListener('plfc:session-changed',event=>{previewOnly=Boolean(event.detail?.demo||event.detail?.readOnly);if(items.length)paint();if(previewOnly)dialog.close();});
  window.addEventListener('plfc:prices-changed',load);
  window.addEventListener('plfc:shop-listings-changed',load);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  load();
  setupClubStock(desk);
}
