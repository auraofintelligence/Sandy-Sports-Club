const currency=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'});
const when=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'});
const price=cents=>cents===0?'Free':currency.format(cents/100);
const amount=cents=>Number.isSafeInteger(cents)&&cents>=0;

export function setupPriceNotices({api,esc}) {
  const events=document.getElementById('event-entry-fees'),desk=document.getElementById('committee-price-alerts');
  let fees=null,feeRequest=null,feesAt=0,priceVersion=0;
  let page=location.hash.slice(1),session=null,deskVersion=0,owner=null,rows=[],before=null,unread=0,reading=false,markedThrough=0;

  async function publicFees() {
    if(fees && Date.now()-feesAt<60000)return fees;
    if(feeRequest)return feeRequest;
    const version=priceVersion;
    const job=api('/api/fees',{cache:'no-store'}).then(result=>{
      const records=result.fees.filter(f=>amount(f.priceCents));
      if(version===priceVersion){fees=records;feesAt=Date.now();}
      return records;
    }).finally(()=>{if(feeRequest===job)feeRequest=null;});
    feeRequest=job;return job;
  }
  function feeList(list) {
    return '<dl class="club-price-list">'+list.map(f=>'<div><dt>'+esc(f.title)+'</dt><dd>'+esc(price(f.priceCents))+'</dd></div>').join('')+'</dl>';
  }
  async function membership(target) {
    const category=target?.dataset.category,version=priceVersion;
    if(!category)return;
    const current=()=>target.isConnected && target.dataset.category===category && version===priceVersion;
    try {
      const list=(await publicFees()).filter(f=>f.kind==='membership' && f.category===category);
      if(!current())return;
      target.innerHTML=list.length?'<strong>Published membership fees</strong>'+feeList(list):'<p>The club has not published a fee for this membership yet. The committee will confirm it with you.</p>';
    }catch{
      if(current())target.innerHTML='<p>The current fee could not load. <button type="button" class="text-link" data-fee-retry>Check again</button></p>';
    }
  }
  async function eventFees() {
    if(!events || page!=='events')return;
    const version=priceVersion;
    let list;
    try{list=(await publicFees()).filter(f=>f.kind==='event');}
    catch{
      if(version===priceVersion && page==='events'){
        document.querySelectorAll('[data-card-fees]').forEach(block=>block.remove());
        events.hidden=false;events.innerHTML='<p>The latest event fees could not load. <button class="text-link" type="button" data-fee-retry>Check again</button></p>';
      }
      return;
    }
    if(version!==priceVersion || page!=='events')return;
    const cards=new Map(Array.from(document.querySelectorAll('[data-fee-event-id]'),card=>[card.dataset.feeEventId,card]));
    document.querySelectorAll('[data-card-fees]').forEach(block=>block.remove());
    const extra=[];
    for(const fee of list){
      const card=cards.get(fee.eventId);
      if(!card){extra.push(fee);continue;}
      let block=card.querySelector('[data-card-fees]');
      if(!block){
        block=document.createElement('div');block.dataset.cardFees='';block.className='club-card-fees';
        block.innerHTML='<h3>Entry fees</h3><dl class="club-price-list"></dl>';
        (card.querySelector('h2')?.parentElement||card).append(block);
      }
      block.querySelector('dl').insertAdjacentHTML('beforeend','<div><dt>'+esc(fee.title)+'</dt><dd>'+esc(price(fee.priceCents))+'</dd></div>');
    }
    events.hidden=!extra.length;
    events.innerHTML=extra.length?'<section class="panel club-card-fees"><h2>Event entry fees</h2>'+feeList(extra)+'</section>':'';
  }

  const canRead=()=>desk && page==='committee' && session?.authenticated && session.role==='committee';
  const readOnly=()=>Boolean(session?.readOnly||session?.showcase||session?.demo);
  function clearDesk(){
    ++deskVersion;owner=null;rows=[];before=null;unread=0;markedThrough=0;reading=false;
    if(desk){desk.replaceChildren();desk.hidden=true;}
  }
  function drawAlerts() {
    const shell=desk.querySelector('details');
    shell.querySelector('summary').textContent='Price changes'+(unread?' · '+unread+' unread':'');
    const area=shell.querySelector('[data-prices]');
    const kinds={membership:'Membership fee',event:'Event fee',merchandise:'Merchandise price'};
    area.innerHTML=rows.length?'<ul class="club-price-changes">'+rows.map(r=>{
      const change=r.newCents===null?'Price withdrawn. Previous price '+price(r.oldCents):
        r.oldCents===null?'New price '+price(r.newCents):price(r.oldCents)+' to '+price(r.newCents);
      return '<li><strong>'+esc(r.title)+'</strong><span>'+esc(kinds[r.kind]||'Price')+' · '+esc(change)+'</span><small>'+
        esc(when.format(new Date(r.changedAt)))+' AEST · '+esc(r.actor)+(r.readAt?'':' · Unread')+'</small></li>';
    }).join('')+'</ul>':'<p>There are no price changes to show.</p>';
    const latest=rows[0]?.seq || 0;
    shell.querySelector('[data-read-changes]').hidden=readOnly()||!unread||!latest;
    shell.querySelector('[data-earlier-changes]').hidden=!before;
    for(const button of shell.querySelectorAll('button'))button.disabled=reading;
  }
  async function loadAlerts(older=false,background=false) {
    if(!canRead()||reading||(older&&!before))return;
    const version=++deskVersion,status=desk.querySelector('[data-price-status]');
    reading=true;if(!background)status.textContent='Checking price changes…';
    try{
      const data=await api('/api/committee/price-alerts'+(older?'?before='+encodeURIComponent(before):''),{cache:'no-store'});
      if(version!==deskVersion||!canRead())return;
      const oldestInHead=data.alerts.at(-1)?.seq;
      const overlap=background && rows.some(row=>data.alerts.some(fresh=>fresh.seq===row.seq));
      if(older){rows=rows.concat(data.alerts);before=data.next;}
      else if(overlap){rows=data.alerts.concat(rows.filter(row=>row.seq<oldestInHead));}
      else {rows=data.alerts;before=data.next;}
      unread=data.unread;reading=false;
      drawAlerts();status.textContent='';
    }catch(error){if(version===deskVersion)status.textContent=error.message;}
    finally{if(version===deskVersion){reading=false;for(const b of desk.querySelectorAll('button'))b.disabled=false;}}
  }
  async function markRead() {
    const through=rows[0]?.seq,version=deskVersion;
    if(!canRead()||readOnly()||reading||!through||through<=markedThrough)return;
    const status=desk.querySelector('[data-price-status]');
    reading=true;drawAlerts();status.textContent='Saving your read status…';
    try{
      await api('/api/committee/price-alerts',{method:'POST',body:JSON.stringify({through})});
      if(version!==deskVersion||!canRead())return;
      markedThrough=through;reading=false;await loadAlerts();
    }catch(error){if(version===deskVersion){reading=false;drawAlerts();status.textContent=error.message;}}
  }
  function enterDesk() {
    if(!canRead()){clearDesk();return;}
    const current=session.identity?.id;
    if(owner!==current||!desk.firstElementChild){
      clearDesk();owner=current;desk.hidden=false;
      desk.innerHTML='<details class="panel club-price-inbox"><summary>Price changes</summary><p>See changes to merchandise prices, membership fees and event fees.</p><div data-prices></div>'+
        '<div class="button-row"><button type="button" class="text-link" data-earlier-changes hidden>Show earlier changes</button>'+
        '<button type="button" class="text-link" data-read-changes hidden>Mark these and all earlier changes as read</button>'+
        '<button type="button" class="text-link" data-check-changes>Check for changes</button>'+
        '</div><p role="status" data-price-status></p></details>';
    }
    loadAlerts();
  }
  desk?.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    if(b.hasAttribute('data-read-changes'))markRead();
    else if(b.hasAttribute('data-earlier-changes'))loadAlerts(true);
    else if(b.hasAttribute('data-check-changes'))loadAlerts();
  });
  document.addEventListener('click',e=>{
    const retry=e.target.closest('[data-fee-retry]');if(!retry)return;
    const target=retry.closest('[data-membership-fee]');
    if(target)membership(target);else eventFees();
  });
  window.addEventListener('plfc:membership-fee',e=>membership(e.detail.target));
  window.addEventListener('plfc:calendar-drawn',eventFees);
  window.addEventListener('plfc:session-changed',e=>{session=e.detail;enterDesk();});
  window.addEventListener('plfc:navigated',e=>{page=e.detail.page;eventFees();enterDesk();});
  window.addEventListener('plfc:prices-changed',()=>{
    priceVersion++;feeRequest=null;fees=null;eventFees();
    document.querySelectorAll('[data-membership-fee]').forEach(membership);
    if(canRead())loadAlerts();
  });
  function checkVisible(){
    if(document.hidden)return;
    if(canRead())loadAlerts(false,true);
    if(page==='events')eventFees();
    document.querySelectorAll('dialog[open] [data-membership-fee]').forEach(membership);
  }
  window.addEventListener('focus',checkVisible);
  document.addEventListener('visibilitychange',checkVisible);
  setInterval(checkVisible,60000);
  eventFees();
}
