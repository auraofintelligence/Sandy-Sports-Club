import {setupDeliveryInvoices} from './delivery-invoices.js';

const currency = new Intl.NumberFormat('en-AU', {style: 'currency', currency: 'AUD'});
const dateFormat = new Intl.DateTimeFormat('en-AU', {timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', year: 'numeric'});
const dollars = cents => currency.format(cents / 100);
const date = value => dateFormat.format(new Date(value));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const itemLabel = item => item.productName && !item.label.toLowerCase().includes(item.productName.toLowerCase()) ? item.productName+' · '+item.label : item.label;
const labels = {sale: 'Sale', count: 'Shelf count', delivery: 'Delivery', purchase: 'Purchase', order: 'Order', review: 'Print review'};

async function request(path, action) {
  const options = {cache: 'no-store'};
  if (action) Object.assign(options, {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(action)});
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Please try again.'), {status: response.status});
  return result;
}

function sourceRow(row) {
  return `<article class="stock-record">
    <p class="stock-record-date">${escape(labels[row.kind] || row.kind)} · ${date(row.reportedOn)}</p>
    <h4>${escape(row.productName || 'Club merchandise')}</h4>
    <p>${escape(row.description)}</p>
    ${row.units != null || row.amountCents != null ? `<p><strong>${[row.units != null ? row.units + ' units' : '', row.amountCents != null ? dollars(row.amountCents) : ''].filter(Boolean).join(' · ')}</strong></p>` : ''}
    <small>${escape(row.source)}</small>
  </article>`;
}

function historyRow(row) {
  return `<div class="shop-line"><div><strong>${escape(row.label)} · ${escape(labels[row.kind])}</strong>
    <span>${row.units} units${row.amountCents != null ? ' · ' + dollars(row.amountCents) + ' received' : ''}</span>
    ${row.kind==='delivery'?'<small data-cost-for="'+escape(row.id)+'">'+(row.costCents==null?'Supplier cost pending':'Supplier cost '+dollars(row.costCents))+'</small>':''}
    ${row.unitCostCents==null?'':'<small>Unit cost '+dollars(row.unitCostCents)+'</small>'}</div>
    <div><time>${date(row.occurredAt)}</time><span>${row.afterUnits == null ? 'Shelf count pending' : row.afterUnits + ' on hand'}</span></div></div>`;
}

function showBook(container, data, readOnly) {
  const sales = data.evidence.filter(record => record.kind === 'sale');
  const other = data.evidence.filter(record => record.kind !== 'sale');
  container.innerHTML = `<p class="page-intro">${readOnly?'View-only stock book. Changes are unavailable in this view.':'Record a sale, receive a delivery or update stock and booking capacity in the shared stock book.'}</p>
    <details class="panel stock-panel"><summary>Sales in the club records</summary>
      <div class="stock-archive">${sales.length ? sales.map(sourceRow).join('') : '<p>No sales have been recorded yet.</p>'}</div>
      <details class="stock-source-list"><summary>Purchases, orders and deliveries (${other.length})</summary>
        ${other.map(record => `<div>${sourceRow(record)}</div>`).join('')}
      </details></details>
    <section class="panel stock-panel"><h2>Stock on hand</h2>
      <p>Start each item with a physical shelf count. You can still record a sale or delivery while its opening count is pending.</p>
      <div class="stock-table-wrap"><table><thead><tr><th>Item</th><th>On hand</th></tr></thead><tbody>
      ${data.items.map(item => `<tr><th scope="row">${escape(itemLabel(item))}</th><td>${item.onHand == null ? 'Needs a count' : item.onHand+(item.offeringMode==='places'?' places':'')}</td></tr>`).join('')}</tbody></table></div>
    </section>
    ${readOnly?'':`<section class="panel stock-panel"><h2>Record a stock change</h2>
      <form class="stack-form" data-ledger-form><fieldset>
        <label>What happened?<select name="kind"><option value="sale">We sold an item</option><option value="delivery">A delivery arrived</option><option value="count">I counted the shelf</option></select></label>
        <label>Which item?<select name="itemId">${data.items.map(item => `<option value="${escape(item.id)}">${escape(itemLabel(item))}</option>`).join('')}</select></label>
        <label><span data-units-label>How many were sold?</span><input name="units" type="number" min="1" max="999999" step="1" required></label>
        <label data-sale-value>Total actually received (AUD)<input name="amount" type="text" inputmode="decimal" placeholder="e.g. 10.00" required></label>
        <label data-delivery-value hidden>What did this delivery cost? (AUD)<input name="costAmount" type="text" inputmode="decimal" disabled><small>Enter the invoice total for this item. Enter 0 for donated stock, or leave it blank if the invoice is still to come.</small></label>
        <label data-count-value hidden>Cost of one item (AUD, if known)<input name="unitCost" type="text" inputmode="decimal" disabled><small>Use the supplier’s unit cost when counting existing stock. This helps value what is still on the shelf.</small></label>
        <label data-cost-reference hidden>Supplier or invoice reference (optional)<input name="costSource" maxlength="180" disabled></label>
        <button class="button" type="submit">Review the change</button>
      </fieldset><div data-ledger-review></div><p role="status" data-ledger-status></p></form>
    </section>
    `}<div data-delivery-invoices></div>
    <section class="panel stock-panel"><h2>New stock book entries</h2>
      <p>Merchandise · ${data.sales.saleCount} sales, ${data.sales.units} units sold, ${dollars(data.sales.totalCents)} received.</p>
      ${data.bookingSales?.saleCount?'<p>Tickets and services · '+data.bookingSales.units+' places sold, '+dollars(data.bookingSales.totalCents)+' received.</p>':''}
      ${data.movements.length ? data.movements.map(historyRow).join('') : '<p>The first verified stock change will appear here.</p>'}
      ${data.movements.length === 100 ? '<small>Showing the latest 100 changes.</small>' : ''}
    </section>`;
  if(!readOnly)setupDeliveryInvoices(container.querySelector('[data-delivery-invoices]'),{request,escape,date,dollars,onSaved(saved){
    const line=container.querySelector('[data-cost-for="'+CSS.escape(saved.id)+'"]');
    if(line)line.textContent='Supplier cost '+dollars(saved.costCents);
  }});
}

export function setupClubStock(desk) {
  const book = desk.querySelector('[data-club-stock]');
  let readOnly=false;
  let generation = 0, state = null, pending = null, saving = false, treasurer = false;
  async function enter() {
    const current = ++generation;
    state = null;
    pending = null;
    saving = false;
    book.replaceChildren();
    if (location.hash !== '#stock' || !treasurer) return;
    book.textContent = 'Opening the stock book…';
    try {
      const data = await request('/api/stock');
      if (current !== generation) return;
      state = data; showBook(book, data, readOnly);
    } catch (error) {
      if (current === generation) {
        book.textContent = error.message;
        if (!error.status || error.status >= 500) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'text-link';
          button.textContent = 'Try again';
          button.onclick = enter;
          book.append(' ', button);
        }
      }
    }
  }
  book.addEventListener('input', event => {
    const form = event.target.closest('[data-ledger-form]');
    if (!form || saving) return;
    const kind = form.elements.kind.value;
    const places=state?.items.find(i=>i.id===form.elements.itemId.value)?.offeringMode==='places';
    form.querySelector('[data-units-label]').textContent = places?{sale:'How many places did you sell?',delivery:'How many extra places can you offer?',count:'How many places remain, including held bookings?'}[kind]:{sale:'How many were sold?', delivery:'How many arrived?', count:'How many are on the shelf?'}[kind];
    form.elements.units.min = kind === 'count' ? '0' : '1';
    form.querySelector('[data-sale-value]').hidden = kind !== 'sale';
    form.elements.amount.disabled = kind !== 'sale';
    form.querySelector('[data-delivery-value]').hidden=form.elements.costAmount.disabled=places||kind!=='delivery';
    form.querySelector('[data-count-value]').hidden=form.elements.unitCost.disabled=places||kind!=='count';
    form.querySelector('[data-cost-reference]').hidden=form.elements.costSource.disabled=places||kind==='sale';
    form.querySelector('[data-ledger-review]').replaceChildren();
    form.querySelector('[data-ledger-status]').textContent = '';
    pending = null;
  });
  book.addEventListener('submit', event => {
    if(!event.target.matches('[data-ledger-form]'))return;
    event.preventDefault();
    if (saving || !state || readOnly) return;
    const form = event.target, fields = form.elements;
    const item = state.items.find(row => row.id === fields.itemId.value);
    if (!item) return;
    const kind = fields.kind.value, units = Number(fields.units.value);
    const amountText = fields.amount.value.trim();
    const amountCents = kind === 'sale' ? Math.round(Number(amountText) * 100) : null;
    const status = form.querySelector('[data-ledger-status]');
    if (kind === 'sale' && (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || amountCents > 100000000)) {
      status.textContent = 'Enter the total received in dollars and cents, such as 10.00.'; return;
    }
    if (kind === 'sale' && item.onHand != null && units > item.onHand) {
      status.textContent = 'There are fewer units on the shelf. Check the sale quantity or record a new shelf count.'; return;
    }
    const costInput=item.offeringMode==='places'?null:kind==='delivery'?fields.costAmount:kind==='count'?fields.unitCost:null;
    const costText=costInput?.value.trim()||'';
    const costReference=costInput?fields.costSource.value.trim():'';
    if(costText && (!/^\d+(?:\.\d{1,2})?$/.test(costText)||Math.round(Number(costText)*100)>100000000)){
      status.textContent='Enter a cost in dollars and cents, or leave it blank.';costInput.focus();return;
    }
    if(costReference && !costText){status.textContent='Add the amount for this invoice reference, or leave both fields blank.';costInput.focus();return;}
    pending = {id: crypto.randomUUID(), itemId: item.id, kind, units, revision: item.revision, amountCents};
    if(costText){
      pending[kind==='delivery'?'costCents':'unitCostCents']=Math.round(Number(costText)*100);
      pending.costSource=costReference;
    }
    status.textContent = '';
    const after = kind === 'count' ? units : item.onHand == null ? null : item.onHand + (kind === 'sale' ? -units : units);
    form.querySelector('[data-ledger-review]').innerHTML = `<div class="stock-review"><strong>${escape(labels[kind])} · ${escape(itemLabel(item))}</strong>
      <p>${units} ${item.offeringMode==='places'?'places':'units'}${amountCents != null ? ' · ' + dollars(amountCents) + ' received' : ''}. ${item.offeringMode==='places'?'Remaining capacity will be '+after+' places.':after == null ? 'The shelf count will stay pending.' : 'The shelf count will be ' + after + '.'}</p>
      ${pending.costCents!=null?'<p>Supplier cost for this delivery '+dollars(pending.costCents)+'</p>':''}
      ${pending.unitCostCents!=null?'<p>Cost per item '+dollars(pending.unitCostCents)+'</p>':''}
      <button class="button" type="button" data-ledger-save>Save to the club stock book</button></div>`;
    form.querySelector('[data-ledger-save]').focus();
  });
  book.addEventListener('click', async event => {
    const button = event.target.closest('[data-ledger-save]');
    if (!button || !pending || saving || readOnly) return;
    const current = generation, form = button.form, status = form.querySelector('[data-ledger-status]');
    saving = true; button.disabled = true; form.querySelector('fieldset').disabled = true;
    status.textContent = 'Saving the change…';
    try {
      const updated = await request('/api/stock', pending);
      if (current !== generation) return;
      pending = null; state = updated; showBook(book, updated, readOnly);
      book.querySelector('[data-ledger-status]').textContent = 'Saved. The stock count and history are up to date.';
      window.dispatchEvent(new Event('plfc:stock-ledger-changed'));
    } catch (error) {
      if (current !== generation) return;
      if ([401,403,409].includes(error.status)) {
        await enter();
        const refreshedStatus = book.querySelector('[data-ledger-status]');
        if (refreshedStatus) refreshedStatus.textContent = error.message;
      } else if (error.status && error.status < 500) {
        pending = null;
        form.querySelector('fieldset').disabled = false;
        form.querySelector('[data-ledger-review]').replaceChildren();
        status.textContent = error.message;
      } else {
        status.textContent = 'The club could not confirm this save. Use the same Save button to retry this entry.';
        button.disabled = false;
      }
    } finally {
      if (current === generation) saving = false;
    }
  });
  window.addEventListener('plfc:navigated', enter);
  window.addEventListener('plfc:stock-updated',()=>{
    if(location.hash!=='#stock')return;
    const form=book.querySelector('[data-ledger-form]');
    if(form && (saving||pending||form.elements.units.value||form.elements.amount.value)){
      form.querySelector('[data-ledger-status]').textContent='Stock changed while this form was open. Your entries are still here. Check the reviewed balance before saving.';
    }else enter();
  });
  window.addEventListener('plfc:session-changed', event => {
    treasurer = event.detail?.canManageStock === true;
    readOnly=Boolean(event.detail?.readOnly||event.detail?.showcase||event.detail?.demo);
    // Only the stock book depends on identity. Browsing the range never needs a session.
    if (location.hash === '#stock') enter();
    else { book.replaceChildren(); state = null; pending = null; }
  });
  window.addEventListener('pageshow', enter);
  enter();
}
