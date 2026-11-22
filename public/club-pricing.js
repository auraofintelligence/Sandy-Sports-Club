import {setupShopListings} from './shop-listings.js';

const dollar = new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'});
const groups = {merchandise:'Shop listings',membership:'Membership',event:'Event fees'};
const money = cents => cents == null ? 'No published price' : cents === 0 ? 'Free' : dollar.format(cents/100);
const amount = cents => cents == null ? '' : (cents/100).toFixed(2);
const displayPrice = row => row?.kind && !row.active ? null : row?.priceCents ?? null;

function readAmount(input, merch) {
  const value=input.value.trim();
  if (!value) return null;
  const parts=/^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value);
  const cents=parts ? Number(parts[1])*100 + Number((parts[2]||'').padEnd(2,'0')) : NaN;
  if (!Number.isSafeInteger(cents) || (merch && (cents===0 || cents>1000000))) {
    input.setCustomValidity(merch?'Enter a price from $0.01 to $10,000, or clear the field.':'Enter Australian dollars with up to two decimal places.');
    input.reportValidity();
    throw Error('Check the highlighted price.');
  }
  return cents;
}

export function setupClubPricing({api,esc}) {
  setupShopListings({api,esc});
  const mount=document.getElementById('club-prices');
  if (!mount) return;
  let authorised=false,generation=0,active='merchandise',pending=false,loading=false;
  let rows=[],events=[],newRows=new Map(),mutations=new Map(),offerInfo=new Map(),priceTarget='';

  function rowMarkup(row,group) {
    const merch=group==='merchandise', fresh=newRows.has(row.id);
    const id=esc(row.productId||row.id), name=esc(row.name||row.title);
    let extra='';
    if(merch) {
      const entry=offerInfo.get(row.productId);
      const hosted=!entry?.offeringMode||['stock','donation'].includes(entry.offeringMode);
      const sizes=row.productId==='shirt'&&!entry?.hasVariants?'<label>Shirt sizes offered<input name="sizes" value="'+esc(row.sizes.join(', '))+'" placeholder="e.g. S, M, L, XL"></label>':'';
      extra=hosted?'<details class="price-extra"><summary>Online payment'+(sizes?' and shirt sizes':'')+'</summary>'+sizes+
        '<label>Square payment link<input name="checkout" type="url" value="'+esc(row.checkoutUrl||'')+'" placeholder="Paste the club’s Square link"></label>'+
        '<label class="price-check"><input type="checkbox" name="checkedLink">'+(entry?.variableAmount?'I checked that this Square donation page lets donors enter the amount.':'I checked that Square shows this item, its price and any options.')+'</label>'+
        '<small>When the price or sizes change, checkout pauses until you check the link again.</small></details>':
        '<small class="listing-price-rule">'+(entry.variableAmount?'Visitors choose their donation amount in an enquiry.':'The club confirms availability and payment with each visitor.')+'</small>';
      if(entry?.variableAmount)return '<div class="price-row" data-price-row="'+id+'"><div class="price-name"><strong>'+name+'</strong><small>Visitor chooses the amount</small></div>'+extra+'</div>';
    }
    if(fresh) {
      extra='<label>Public name<input name="title" maxlength="130" required placeholder="'+(group==='event'?'e.g. Interclub invitational entry':'e.g. Family membership')+'"></label>'+
        (group==='event'?'<label>Calendar event<select name="eventId"><option value="">List on What’s on as a separate entry fee</option>'+events.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.title)+'</option>').join('')+'</select></label>':
        '<label>Applies to<select name="category">'+rows.filter(r=>r.id==='membership-'+r.category).map(r=>'<option value="'+esc(r.category)+'">'+esc(r.title)+'</option>').join('')+'</select></label>')+
        '<button type="button" class="text-link" data-remove>Remove this new fee</button>';
    }
    const val=displayPrice(row);
    return '<div class="price-row" data-price-row="'+id+'"><div class="price-name"><strong>'+name+'</strong><small>'+money(val)+'</small></div>'+
      '<label class="price-amount">Price (AUD)<input name="amount" aria-label="'+name+' price in Australian dollars" inputmode="decimal" value="'+amount(val)+'" placeholder="Set price" '+(fresh?'required':'')+'></label>'+extra+'</div>';
  }

  function section(group) {
    const merch=group==='merchandise';
    const data=rows.filter(r=>r.kind===group || (merch&&r.productId)).concat([...newRows.values()].filter(r=>r.kind===group));
    return '<form data-price-group="'+group+'" '+(group!==active?'hidden':'')+'><fieldset><legend class="sr-only">'+groups[group]+' prices</legend>'+
      (data.length?data.map(r=>rowMarkup(r,group)).join(''):'<p>No event entry fees have been set.</p>')+
      (!merch?'<button type="button" class="text-link" data-add>Add '+(group==='event'?'an event entry fee':'a membership option')+'</button>':'')+
      '<p class="price-hint">'+(merch?'An empty price lets visitors ask the club for a quote.':'Enter 0 for free entry or membership. Clear a published amount to withdraw the fee.')+'</p>'+
      '<button class="button small" type="submit">Review '+groups[group].toLowerCase()+' changes</button></fieldset><div data-review></div><p role="status" class="price-status"></p></form>';
  }

  function draw() {
    mount.innerHTML='<section class="panel stock-panel pricing-panel"><h2>Club prices</h2><p>Choose an offering, change its price and publish. Each published price change goes to the other officers’ committee inboxes.</p>'+
      '<div class="price-categories" role="group" aria-label="Choose prices">'+Object.entries(groups).map(([key,label])=>'<button type="button" class="button outline small" data-group="'+key+'" aria-pressed="'+(key===active)+'">'+label+'</button>').join('')+'</div>'+
      Object.keys(groups).map(section).join('')+
      '<details class="price-setup"><summary>How club payments work</summary><p>Customers can ask the club a question or request a pickup. The treasurer agrees the total, collection time and payment method with them. Cash and Square payments can be recorded at collection.</p><p>To take a card payment online, create an item payment link in the club’s Square account. Check the amount and available sizes, then paste the link into the matching product above. The customer pays on Square. Check the receipt in Square and record the sale in the stock book.</p><a href="https://squareup.com/help/au/en/article/6692-get-started-with-square-checkout-links" target="_blank" rel="noopener">Square’s guide to payment links</a></details></section>';
  }

  async function openDesk() {
    const current=++generation;
    rows=[];events=[];newRows.clear();mutations.clear();pending=false;loading=false;mount.replaceChildren();
    if(!authorised || location.hash!=='#stock') return;
    loading=true;mount.innerHTML='<p role="status">Opening club prices…</p>';
    try {
      const [shop,fees]=await Promise.all([api('/api/stock/shop/offers'),api('/api/treasurer/fees')]);
      if(current!==generation) return;
      offerInfo=new Map(shop.offers.map(o=>[o.productId,o]));rows=[...shop.offers,...fees.fees];events=fees.events;draw();
      if(priceTarget)jumpToPrice();
    } catch(error) {
      if(current===generation) mount.innerHTML='<p role="alert">'+esc(error.message)+'</p><button type="button" class="button outline" data-reload>Reload club prices</button>';
    } finally {if(current===generation)loading=false;}
  }

  function changes(form) {
    const group=form.dataset.priceGroup, merch=group==='merchandise', edits=[];
    for(const node of form.querySelectorAll('[data-price-row]')) {
      const id=node.dataset.priceRow, row=rows.find(r=>(r.productId||r.id)===id)||newRows.get(id);
      const price=merch&&offerInfo.get(id)?.variableAmount?null:readAmount(node.querySelector('[name=amount]'),merch);
      const previous=displayPrice(row);
      let body;
      if(merch) {
        const sizesField=node.querySelector('[name=sizes]');
        const sizes=sizesField?sizesField.value.split(',').map(s=>s.trim()).filter(Boolean):row.sizes;
        const urlField=node.querySelector('[name=checkout]'),link=urlField?.value.trim()||null;
        const checked=node.querySelector('[name=checkedLink]')?.checked===true;
        const termsChanged=price!==previous || JSON.stringify(row.sizes)!==JSON.stringify(sizes);
        if(!termsChanged && row.checkoutUrl===link) continue;
        if(link && row.checkoutUrl!==link && !checked) {
          node.querySelector('details').open=true;
          node.querySelector('[name=checkedLink]').focus();
          throw Error('Check the product in Square and tick the confirmation box for '+row.name+'.');
        }
        const checkoutUrl=link===row.checkoutUrl && termsChanged && !checked ? null : link;
        body={productId:id,priceCents:price,sizes,checkoutUrl,confirmed:true,checkoutReconfirmed:checked,version:row.version};
      } else {
        const fresh=newRows.has(id);
        if(!fresh && previous===price) continue;
        const title=fresh?node.querySelector('[name=title]').value.trim():row.title;
        const category=node.querySelector('[name=category]')?.value||row.category;
        const eventId=node.querySelector('[name=eventId]')?.value||row.eventId;
        body={id,kind:group,title,category,eventId,priceCents:price,active:price!==null,version:row.version};
        const key=JSON.stringify(body);
        if(!mutations.has(key)) mutations.set(key,crypto.randomUUID());
        body.mutation=mutations.get(key);
      }
      const label=body.title||row.name;
      const details=[];
      if(price!==previous) details.push(money(previous)+' → '+money(price));
      if(merch && body.checkoutUrl!==row.checkoutUrl) details.push(body.checkoutUrl?'Open Square checkout':'Pause Square checkout');
      if(merch && JSON.stringify(body.sizes)!==JSON.stringify(row.sizes)) details.push('Sizes: '+(body.sizes.join(', ')||'ask the club'));
      edits.push({body,label,details});
    }
    return edits;
  }
  function cancelReview(form) {
    form.querySelector('[data-review]').replaceChildren();
    form.querySelector('fieldset').disabled=false;
    form.classList.remove('price-reviewing');
  }

  mount.addEventListener('submit',event=>{
    const form=event.target.closest('[data-price-group]');
    if(!form)return;
    event.preventDefault();
    if(pending || loading) return;
    const status=form.querySelector('[role=status]');
    try {
      const edits=changes(form);
      if(!edits.length){status.textContent='The published prices already match these amounts.';return;}
      status.textContent='';form.querySelector('fieldset').disabled=true;form.classList.add('price-reviewing');
      const review=form.querySelector('[data-review]');
      review.innerHTML='<div class="stock-review"><h3>Publish these changes?</h3><ul>'+edits.map(e=>'<li><strong>'+esc(e.label)+'</strong><br>'+esc(e.details.join(' · '))+'</li>').join('')+'</ul><p>New prices appear on the club site immediately. Other officers get a private alert for each price that changes.</p><div class="button-row"><button type="button" class="button small" data-publish>Publish changes</button><button class="button outline small" type="button" data-back>Keep editing</button></div></div>';
      review.querySelector('button').focus();
    }catch(error){status.textContent=error.message;}
  });

  async function publish(form) {
    const revision=generation,group=form.dataset.priceGroup,merch=group==='merchandise';
    const status=form.querySelector('[role=status]');
    try {
      const edits=changes(form),payload=edits.map(e=>e.body);
      if(!payload.length){cancelReview(form);return;}
      pending=true;
      form.querySelectorAll('[data-review] button').forEach(b=>b.disabled=true);
      status.textContent='Publishing…';
      const result=await api(merch?'/api/stock/shop':'/api/treasurer/fees',{method:merch?'PUT':'POST',body:JSON.stringify(merch?{offers:payload,confirmed:true}:{fees:payload})});
      if(revision!==generation)return;
      const saved=merch?result.offers:payload.map(f=>({...f,version:result.fees.find(r=>r.id===f.id).version}));
      for(const r of saved){
        const id=r.productId||r.id;
        const index=rows.findIndex(old=>(old.id||old.productId)===id);
        if(index<0)rows.push(r);else rows[index]=r;
        newRows.delete(id);
      }
      form.outerHTML=section(group);
      const feedback=mount.querySelector('[data-price-group="'+group+'"] [role=status]');
      feedback.textContent='Published. '+edits.map(e=>e.label).join(', ')+'.';
      feedback.tabIndex=-1;feedback.focus({preventScroll:true});
      window.dispatchEvent(new Event('plfc:prices-changed'));
    } catch(error) {
      if(revision!==generation)return;
      status.textContent=error.message;
      if(error.status===409)status.insertAdjacentHTML('beforeend',' <button class="text-link" type="button" data-reload>Reload current prices</button>');
      form.querySelectorAll('[data-review] button').forEach(b=>b.disabled=false);
    } finally {if(revision===generation)pending=false;}
  }

  mount.addEventListener('input',event=>{
    if(event.target.setCustomValidity)event.target.setCustomValidity('');
  });
  mount.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button||pending)return;
    if(button.hasAttribute('data-reload')){openDesk();return;}
    if(button.dataset.group) {
      active=button.dataset.group;
      mount.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      mount.querySelectorAll('[data-price-group]').forEach(f=>f.hidden=f.dataset.priceGroup!==active);
      return;
    }
    const form=button.closest('form');
    if(!form)return;
    if(button.hasAttribute('data-back')){cancelReview(form);form.querySelector('[type=submit]').focus();return;}
    if(button.hasAttribute('data-publish')){publish(form);return;}
    if(button.hasAttribute('data-add')){
      const group=form.dataset.priceGroup, row={id:crypto.randomUUID(),kind:group,version:0,active:false,title:group==='event'?'New event entry fee':'New membership option'};
      newRows.set(row.id,row);
      button.insertAdjacentHTML('beforebegin',rowMarkup(row,group));
      button.previousElementSibling.querySelector('[name=title]').focus();return;
    }
    if(button.hasAttribute('data-remove')){
      const row=button.closest('[data-price-row]');
      newRows.delete(row.dataset.priceRow);row.remove();form.querySelector('[data-add]').focus();
    }
  });
  window.addEventListener('plfc:session-changed',event=>{
    authorised=Boolean(event.detail?.authenticated&&event.detail.canManageStock&&!event.detail.demo&&!event.detail.readOnly);openDesk();
  });
  window.addEventListener('plfc:navigated',openDesk);
  function jumpToPrice(){
    const row=[...mount.querySelectorAll('[data-price-row],[data-variable-price]')].find(n=>(n.dataset.priceRow||n.dataset.variablePrice)===priceTarget);
    if(!row)return;
    mount.querySelector('[data-group=merchandise]').click();
    const focus=row.querySelector('[name=amount],summary')||row;
    if(focus===row)row.tabIndex=-1;
    focus.focus();priceTarget='';
  }
  window.addEventListener('plfc:edit-shop-price',({detail})=>{priceTarget=detail.id;if(loading)return;if(![...offerInfo.keys()].includes(priceTarget))openDesk();else jumpToPrice();});
  window.addEventListener('plfc:shop-listings-changed',()=>{if(authorised&&location.hash==='#stock')openDesk();});
}

