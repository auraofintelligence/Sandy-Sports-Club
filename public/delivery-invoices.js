export function setupDeliveryInvoices(mount, {request, escape, date, dollars, onSaved}) {
  mount.innerHTML = `<details class="panel stock-panel"><summary>Delivery invoices</summary>
    <p>If the invoice arrived after the stock, add its cost here. Have the invoice and the delivery date handy.</p>
    <label>Show deliveries<select data-filter><option value="missing">Waiting for an invoice cost</option><option value="all">All deliveries</option></select></label>
    <div data-list></div><p role="status"></p></details>`;
  const details = mount.querySelector('details'), list = mount.querySelector('[data-list]');
  const filter = mount.querySelector('[data-filter]'), status = mount.querySelector('[role=status]');
  let deliveries = [], next = null, generation = 0, loaded = false;
  function draw() {
    if (!deliveries.length) {
      list.textContent = filter.value === 'missing' ? 'Every recorded delivery has a cost, or there are no deliveries yet.' : 'No deliveries have been recorded yet.';
      return;
    }
    list.innerHTML = `<form class="stack-form"><fieldset>
      <label>Choose a delivery<select name="delivery">${deliveries.map(d => '<option value="'+escape(d.id)+'">'+escape(date(d.occurredAt)+' · '+d.label+' · '+d.units+' units')+'</option>').join('')}</select></label>
      <label>Supplier cost for this item (AUD)<input name="cost" type="text" inputmode="decimal" required><small>Use the total for this item on the invoice. Enter 0 for donated stock.</small></label>
      <label>Supplier or invoice reference (optional)<input name="reference" maxlength="180"></label>
      <button class="button" type="submit">Save invoice cost</button></fieldset></form>
      ${next ? '<button type="button" class="text-link" data-earlier>Show earlier deliveries</button>' : ''}`;
    const form = list.querySelector('form'), f = form.elements;
    const selected = () => deliveries.find(d => d.id === f.delivery.value);
    function fill() {
      const d = selected();
      f.cost.value = d.costCents == null ? '' : (d.costCents / 100).toFixed(2);
      f.reference.value = d.costSource || '';
    }
    f.delivery.onchange = fill;
    fill();
    form.onsubmit = async event => {
      event.preventDefault();
      const d = selected(), raw = f.cost.value.trim(), costCents = Math.round(Number(raw) * 100);
      if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || costCents > 100000000) {
        status.textContent = 'Enter the total in dollars and cents, such as 45.50.'; f.cost.focus(); return;
      }
      const payload = {id:d.id, version:d.version, costCents, costSource:f.reference.value.trim()};
      const ticket = ++generation;
      form.querySelector('fieldset').disabled = filter.disabled = true;
      const earlier=list.querySelector('[data-earlier]');
      if(earlier) earlier.disabled=true;
      status.textContent = 'Saving invoice cost…';
      try {
        const saved = await request('/api/stock/delivery-costs', payload);
        if (ticket !== generation || !mount.isConnected) return;
        onSaved(saved); await load(false, 'Saved '+dollars(saved.costCents)+' against this delivery. The stock quantity stays the same.');
      } catch (error) {
        if (ticket !== generation || !mount.isConnected) return;
        if (error.status === 409) await load(false, error.message);
        else { status.textContent = error.message; form.querySelector('fieldset').disabled = false; if(earlier)earlier.disabled=false; }
      } finally { if (mount.isConnected) filter.disabled = false; }
    };
    list.querySelector('[data-earlier]')?.addEventListener('click', () => load(true));
  }
  async function load(append = false, message = '') {
    const ticket = ++generation;
    status.textContent = 'Opening deliveries…';
    list.replaceChildren(); filter.disabled = false;
    try {
      const data = await request('/api/stock/delivery-costs?filter='+filter.value+(append ? '&before='+next : ''));
      if (ticket !== generation || !mount.isConnected) return;
      deliveries = append ? [...deliveries, ...data.deliveries] : data.deliveries;
      next = data.next; loaded = true; draw(); status.textContent = message;
    } catch (error) {
      if (ticket !== generation || !mount.isConnected) return;
      status.textContent = error.message;
      const retry = document.createElement('button');
      retry.className = 'text-link'; retry.type = 'button'; retry.textContent = 'Try again'; retry.onclick = () => load(append, message); list.append(retry);
    }
  }
  filter.onchange = () => load();
  details.ontoggle = () => { if (details.open && !loaded) load(); };
}
