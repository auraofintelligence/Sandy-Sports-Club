const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
const stamp=iso=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))+' AEST';
const price=input=>/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(input)?Math.round(Number(input)*100):null;
const labels={new:'New',contacted:'Contacted',confirmed:'Pickup confirmed',collected:'Collected and paid',closed:'Closed'};
const actionLabels={contacted:'Record contact',confirmed:'Confirm pickup and hold stock',collected:'Record payment and collection',closed:'Close this request'};
const places=row=>row.offeringMode==='places';
const statusLabel=row=>places(row)&&row.status==='confirmed'?'Booking confirmed':places(row)&&row.status==='collected'?'Booking paid':labels[row.status];
const orderAction=(row,action)=>places(row)&&action==='confirmed'?(row.status==='confirmed'?'Revise booking details':'Confirm booking and hold places'):places(row)&&action==='collected'?'Record booking payment':action==='confirmed'&&row.status==='confirmed'?'Revise the agreed pickup':actionLabels[action];

export function setupTreasurerOrders({api,esc}) {
  const root=document.getElementById('treasurer-orders');
  if(!root)return;
  let allowed=false,readOnly=false,generation=0,sequence=0,items=[],rows=[],before=null,selected='',pending=null,busy=false,dirty=false;
  const active=()=>allowed&&location.hash==='#stock';
  const current=()=>rows.find(row=>row.reference===selected);
  const status=message=>{const line=root.querySelector('[data-order-status]');if(line)line.textContent=message;};
  function clear() {
    generation++;sequence++;items=[];rows=[];before=null;selected='';pending=null;busy=false;dirty=false;
    root.replaceChildren();root.hidden=true;
  }
  function skeleton() {
    root.hidden=false;
    root.innerHTML='<section class="panel stock-panel"><h2>Customer requests</h2><p>Open a pickup, booking or enquiry to see the contact details and next step.</p>'+
      (readOnly?'<p class="secondary">View only. Request changes are unavailable here.</p>':'')+
      '<div data-order-list></div><div data-order-detail></div><div class="button-row"><button type="button" class="text-link" data-refresh-orders>Refresh requests</button><button type="button" class="text-link" data-earlier-orders hidden>Show earlier requests</button></div><p data-order-status role="status"></p></section>';
  }
  function list() {
    root.querySelector('[data-earlier-orders]').hidden=!before;
    const target=root.querySelector('[data-order-list]');
    target.innerHTML=rows.length?'<label class="stack-form">Choose a customer request<select data-pick-order><option value="">Select a request</option>'+rows.map(row=>
      '<option value="'+esc(row.reference)+'">'+esc(row.reference)+' · '+esc(row.productName)+' · '+esc(statusLabel(row))+' · '+esc(row.name)+'</option>').join('')+'</select></label>':'<p>No customer requests have arrived yet.</p>';
    if(rows.length)target.querySelector('select').value=selected;
    detail();
  }
  function detail() {
    const target=root.querySelector('[data-order-detail]'),row=current();
    pending=null;dirty=false;
    if(!row){target.replaceChildren();return;}
    const closed=['closed','collected'].includes(row.status),pickup=row.kind==='pickup';
    const title=(pickup?(places(row)?'Booking request':'Pickup'):'Enquiry')+' · '+(pickup?row.quantity+' × ':'')+row.productName+(row.variantLabel||row.size?' · '+(row.variantLabel||row.size):'');
    const email=row.email?'<a href="mailto:'+esc(row.email)+'">'+esc(row.email)+'</a>':'';
    const phone=row.mobile?'<a href="tel:'+esc(row.mobile.replace(/[^+\d]/g,''))+'">'+esc(row.mobile)+'</a>':'';
    const options=row.status==='confirmed'?['collected','confirmed','closed']:pickup?['contacted','confirmed','closed']:['contacted','closed'];
    target.innerHTML=`<article class="stock-record"><p>${esc(statusLabel(row))} · ${esc(row.reference)}</p><h3>${esc(title)}</h3>
      <p>${esc(row.name)} · ${[email,phone].filter(Boolean).join(' · ')}</p>
      <p>Received ${esc(stamp(row.createdAt))}${row.listedUnitCents==null?'':' · Listed price '+esc(money(row.listedUnitCents))+' each'}</p>
      ${row.message?'<p>Customer message: '+esc(row.message)+'</p>':''}
      ${row.requestedAmountCents?'<p>Proposed donation '+esc(money(row.requestedAmountCents))+'. No payment recorded by this enquiry.</p>':''}
      ${row.quoteCents!=null?'<p>Agreed total: '+esc(money(row.quoteCents))+'</p>':''}
      ${row.pickupAt?'<p>'+(places(row)?'Booking':'Collection')+' · '+esc(stamp(row.pickupAt+':00+10:00'))+' · '+esc(row.pickupDetails)+'</p>':''}
      ${row.status==='collected'?'<p>Received '+esc(money(row.amountCents))+' by '+(row.paymentMethod==='cash'?'cash':'Square')+'. The sale is in the stock book.</p>':''}
      ${row.staffNote?'<p>Private staff note: '+esc(row.staffNote)+'</p>':''}
      </article>${closed||readOnly?'':'<form class="stack-form" data-order-form><label>What would you like to record?<select name="action">'+options.map(n=>'<option value="'+n+'">'+orderAction(row,n)+'</option>').join('')+'</select></label><div data-order-fields></div><p data-edit-error role="status"></p><button class="button outline" type="submit">Review before saving</button></form><div data-order-review></div>'}`;
    if(!closed&&!readOnly)fields();
  }
  function fields(){
    const row=current(),form=root.querySelector('[data-order-form]'),target=form.querySelector('[data-order-fields]'),action=form.elements.action.value;
    const stock=items.filter(item=>item.productId===row.productId&&(!row.variantId||item.id===row.variantId));
    const note='<label>Private note for the club (optional)<textarea name="staffNote" rows="2" maxlength="1000">'+esc(row.staffNote||'')+'</textarea></label>';
    let content='';
    if(action==='confirmed'){
      const choices=stock.map(item=>{
        const heldHere=row.status==='confirmed'&&row.itemId===item.id?row.quantity:0;
        const available=item.availableUnits===null?null:item.availableUnits+heldHere;
        return '<option value="'+esc(item.id)+'"'+(available===null||available<row.quantity?' disabled':'')+'>'+esc(item.label)+' · '+(available===null?'Shelf count needed':available+' available for this request')+'</option>';
      });
      const quote=row.quoteCents??(row.listedUnitCents==null?null:row.listedUnitCents*row.quantity);
      content=`<p>Agree the total, time and place with the customer first. Saving holds ${row.quantity} ${places(row)?'places for this booking':'units for this pickup'}.</p>
        <label>${places(row)?'Places to reserve':'Stock to hold'}<select name="itemId" required><option value="">Choose an option</option>${choices.join('')}</select></label>
        <label>Total for all ${row.quantity} ${places(row)?'places':'units'} (AUD)<input name="quote" type="text" inputmode="decimal" required placeholder="e.g. 30.00" value="${quote===null?'':(quote/100).toFixed(2)}"></label>
        ${places(row)&&row.eventDate?'<label>Scheduled date<input type="date" readonly value="'+esc(row.eventDate)+'"></label><label>Agreed start time in Brisbane<input name="bookingTime" type="time" required value="'+esc(row.pickupAt?.slice(11,16)||'')+'"></label>':'<label>'+(places(row)?'Booking':'Pickup')+' date and time in Brisbane<input name="pickupAt" type="datetime-local" required value="'+esc(row.pickupAt||'')+'"></label>'}
        <label>Meeting place and instructions<textarea name="pickupDetails" rows="2" maxlength="500" required>${esc(row.pickupDetails||'')}</textarea></label>${note}
        <label class="checkbox-label"><input type="checkbox" required>I agreed these details with the customer.</label>`;
    }else if(action==='collected'){
      const held=stock.find(i=>i.id===row.itemId);
      content=`<p>${places(row)?'Check that the payment has cleared and give the guest the agreed details for '+row.quantity+' places. Saving records the paid booking.':'Hand over '+row.quantity+' × '+esc(held?.label||row.productName)+'. Check the payment has cleared. Saving records one sale and updates the stock count.'}</p>
        <label>Payment received by<select name="paymentMethod" required><option value="">Choose how they paid</option><option value="cash">Cash</option><option value="square">Square</option></select></label>
        <label>Total actually received (AUD)<input name="amount" type="text" inputmode="decimal" placeholder="Agreed ${esc(money(row.quoteCents))}" required></label>${note}
        <label class="checkbox-label"><input type="checkbox" required>I received the agreed payment and ${places(row)?'gave the guest their booking details':'handed over the items'}.</label>`;
    }else if(action==='closed'){
      content='<p>Close this request once it is resolved.'+(row.status==='confirmed'?' Closing releases the '+(places(row)?'places':'stock')+' held for this customer.':'')+'</p>'+note;
    }else content='<p>Use the customer’s contact details above to reply first. This saves your private note in the club inbox.</p>'+note;
    target.innerHTML=content;
    if(action==='confirmed'&&(row.itemId||row.variantId)){
      const option=[...form.elements.itemId.options].find(o=>o.value===(row.itemId||row.variantId));
      if(option&&!option.disabled)form.elements.itemId.value=option.value;
    }
    root.querySelector('[data-order-review]').replaceChildren();pending=null;
  }
  async function load(append=false,select=selected,success=''){
    if(!active())return;
    const id=generation,seq=++sequence;
    try{
      const data=await api('/api/stock/shop'+(append&&before?'?before='+before:''));
      if(!active()||id!==generation||seq!==sequence)return;
      items=data.items;before=data.nextBefore;
      rows=append?rows.concat(data.requests.filter(row=>!rows.some(old=>old.reference===row.reference))):data.requests;
      selected=rows.some(row=>row.reference===select)?select:'';list();status(success);
    }catch(error){
      if(id!==generation||seq!==sequence)return;
      if(error.status===401||error.status===403){clear();return;}
      status(error.message||'The private inbox could not load. Refresh to try again.');
    }
  }
  function enter(){clear();if(active()){skeleton();status('Opening the private shop inbox…');load();}}
  function review(form){
    const row=current(),f=form.elements,action=f.action.value,b={version:row.version,action,staffNote:f.staffNote.value.trim()},error=form.querySelector('[data-edit-error]');
    let summary='';
    if(action==='confirmed'){
      const item=items.find(i=>i.id===f.itemId.value),quote=price(f.quote.value.trim());
      if(!item||quote===null||quote>100000000){error.textContent='Choose a counted stock item and enter a dollar total with up to two decimal places.';return;}
      Object.assign(b,{itemId:item.id,stockRevision:item.revision,quoteCents:quote,pickupAt:f.bookingTime?row.eventDate+'T'+f.bookingTime.value:f.pickupAt.value,pickupDetails:f.pickupDetails.value.trim()});
      summary='Hold '+row.quantity+' × '+item.label+' for '+money(quote)+' total. '+(places(row)?'Booking':'Pickup')+' '+stamp(b.pickupAt+':00+10:00')+' at '+b.pickupDetails+'.';
    }else if(action==='collected'){
      const item=items.find(i=>i.id===row.itemId),amount=price(f.amount.value.trim());
      if(!item||amount!==row.quoteCents){error.textContent='The amount received must match the agreed total. Revise the arrangement first if it changed.';return;}
      Object.assign(b,{itemId:item.id,stockRevision:item.revision,amountCents:amount,paymentMethod:f.paymentMethod.value,received:true});
      summary='Record one sale of '+row.quantity+' × '+item.label+' and '+money(amount)+' received by '+(b.paymentMethod==='cash'?'cash':'Square')+'.';
    }else summary=action==='closed'&&row.status==='confirmed'?'Close this '+(places(row)?'booking':'pickup')+' and release '+row.quantity+' held '+(places(row)?'places':'units')+'.':actionLabels[action]+' for '+row.reference+'.';
    pending={reference:row.reference,body:b};error.textContent='';
    const panel=root.querySelector('[data-order-review]');
    panel.innerHTML='<div class="stock-review"><strong>Check before saving</strong><p>'+esc(summary)+'</p><button type="button" class="button" data-save-order>Save this change</button> <button type="button" class="text-link" data-edit-order>Edit details</button></div>';
    form.inert=true;panel.querySelector('button').focus();
  }
  async function persist(){
    if(!pending||busy)return;
    const attempt=pending,id=generation;busy=true;root.querySelector('[data-save-order]').disabled=true;
    try{
      const result=await api('/api/stock/requests/'+encodeURIComponent(attempt.reference),{method:'POST',body:JSON.stringify(attempt.body)});
      if(!active()||id!==generation)return;
      const prev=current();rows=rows.map(r=>r.reference===attempt.reference?result.request:r);detail();
      if(['confirmed','collected'].includes(attempt.body.action)||(attempt.body.action==='closed'&&prev?.status==='confirmed'))
        window.dispatchEvent(new CustomEvent('plfc:stock-updated'));
      // Fetch fresh counts and preserve an older page's selected request.
      let fresh;
      try{fresh=await api('/api/stock/shop');}
      catch(error){
        if(id!==generation)return;
        if(error.status===401||error.status===403){clear();return;}
        list();status('Your change was saved. Refresh the inbox to check the latest available units.');return;
      }
      if(!active()||id!==generation)return;
      items=fresh.items;rows=rows.map(r=>fresh.requests.find(n=>n.reference===r.reference)||r);list();
      status('Saved. '+attempt.reference+' is '+labels[result.request.status].toLowerCase()+'.');
    }catch(error){
      if(id!==generation)return;
      if(error.status===401||error.status===403){clear();return;}
      if(error.status===409){await load(false,attempt.reference,error.message+' The latest stock and requests are shown.');return;}
      const edit=root.querySelector('[data-order-form]'),panel=root.querySelector('[data-order-review]');
      if(error.status&&error.status<500){pending=null;if(edit)edit.inert=false;panel?.replaceChildren();}
      status(error.message||'The club could not confirm this change. Retry with the same Save button.');
    }finally{if(id===generation){busy=false;const btn=root.querySelector('[data-save-order]');if(btn)btn.disabled=false;}}
  }
  root.addEventListener('change',e=>{
    if(busy||!active())return;
    if(e.target.matches('[data-pick-order]')){
      if(dirty&&!window.confirm('Leave these unsaved details and open another request?')){e.target.value=selected;return;}
      selected=e.target.value;detail();status('');
    }
    if(!readOnly&&e.target.name==='action'){fields();dirty=true;}
  });
  root.addEventListener('input',e=>{if(e.target.closest('[data-order-form]'))dirty=true;});
  root.addEventListener('submit',e=>{if(e.target.matches('[data-order-form]')){e.preventDefault();if(active()&&!readOnly&&!busy)review(e.target);}});
  root.addEventListener('click',e=>{
    if(!active()||busy)return;
    const button=e.target.closest('button');if(!button)return;
    if(readOnly && (button.hasAttribute('data-save-order')||button.hasAttribute('data-edit-order')))return;
    if(button.hasAttribute('data-save-order')){persist();return;}
    if(button.hasAttribute('data-edit-order')){pending=null;root.querySelector('[data-order-review]').replaceChildren();const form=root.querySelector('[data-order-form]');form.inert=false;form.elements.action.focus();return;}
    if(button.hasAttribute('data-refresh-orders')||button.hasAttribute('data-earlier-orders')){
      if(dirty&&!window.confirm('Discard these unsaved edits and refresh the inbox?'))return;
      load(button.hasAttribute('data-earlier-orders'),selected);
    }
  });
  window.addEventListener('plfc:navigated',enter);
  window.addEventListener('plfc:session-changed',e=>{allowed=e.detail?.canManageStock===true;readOnly=Boolean(e.detail?.readOnly||e.detail?.showcase||e.detail?.demo);enter();});
  window.addEventListener('plfc:stock-ledger-changed',()=>{if(!active())return;if(dirty||pending||busy)status('The stock book changed. Refresh this inbox before confirming a pickup.');else load();});
  window.addEventListener('pagehide',clear);
}
