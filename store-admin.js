// Treasurer store admin: orders, products (with photos), CSV batch upload and export, reports.
import {preparePhoto} from './picture.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=c=>c==null?'':'$'+(c/100).toFixed(2),dollars=c=>c==null?'':(c/100).toFixed(2);
const ORDER=[['requested','Requested'],['confirmed','Confirmed'],['ready','Ready to collect'],['collected','Collected'],['cancelled','Cancelled']];
let canManage=false,products=[],editing=null;
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Store error ('+r.status+').');return p;
}
function tab(name){
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===name?'page':'false'));
 document.querySelectorAll('[data-pane]').forEach(s=>s.hidden=s.dataset.pane!==name);
 ({orders:loadOrders,products:loadProducts,report:loadReport}[name]||(()=>{}))();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
// ---------- Orders ----------
async function loadOrders(){
 const f=$('sa-order-filter').value,{orders,counts}=await api('/api/committee/store/orders'+(f?'?status='+f:''));
 $('sa-state').textContent=counts.requested+' new request(s) · '+counts.open+' open';
 $('sa-orders').innerHTML=orders.length?orders.map(o=>'<article class="member-item" data-order="'+safe(o.id)+'"><strong>#'+o.number+' · '+safe(o.name)+' <small>('+safe(o.username||'')+')</small> · '+money(o.total)+'</strong>'+
  '<span>'+safe(o.createdAt.slice(0,10))+' · '+safe(o.email)+'</span>'+
  '<span>'+o.lines.map(l=>safe((l.kind==='donation'?'Donation: ':l.qty+' × ')+l.name+(l.variant?' ('+l.variant+')':'')+' '+money(l.line))).join('<br>')+'</span>'+
  (o.discount?'<span>'+safe(o.discountLabel)+': −'+money(o.discount)+'</span>':'')+(o.note?'<span>Note: '+safe(o.note)+'</span>':'')+
  '<span>'+(canManage&&!['collected','cancelled'].includes(o.status)?'<select data-status>'+ORDER.map(([v,l])=>'<option value="'+v+'"'+(v===o.status?' selected':'')+'>'+l+'</option>').join('')+'</select> <button type="button" data-save-order>Update</button> <small data-msg></small>':'<strong>'+safe(ORDER.find(x=>x[0]===o.status)[1])+'</strong>')+'</span></article>').join(''):'<p>No orders here.</p>';
}
$('sa-order-filter').addEventListener('change',loadOrders);
$('sa-orders').addEventListener('click',async e=>{
 if(!e.target.matches('[data-save-order]'))return;const el=e.target.closest('[data-order]'),msg=el.querySelector('[data-msg]');
 try{await api('/api/committee/store/orders','POST',{id:el.dataset.order,status:el.querySelector('[data-status]').value});msg.textContent='Updated.';setTimeout(loadOrders,600)}catch(error){msg.textContent=error.message}
});
// ---------- Products ----------
const vText=vs=>vs.map(v=>v.label+(v.price!=null?'@'+dollars(v.price):'')+':'+(v.stock==null?'':v.stock)).join('|');
async function loadProducts(){
 ({products}=await api('/api/committee/store/products'));
 $('sa-categories').innerHTML=[...new Set(products.map(p=>p.category))].map(c=>'<option value="'+safe(c)+'">').join('');
 $('sa-products').innerHTML='<thead><tr><th></th><th>SKU</th><th>Product</th><th>Type</th><th>Status</th><th>Price</th><th>Member</th><th>Cost</th><th>Sizes / stock</th><th></th></tr></thead><tbody>'+
  products.map(p=>'<tr data-product="'+safe(p.id)+'"><td>'+(p.photoUrl?'<img src="'+safe(p.photoUrl)+'" alt="">':'')+'</td><td>'+safe(p.sku)+'</td><td>'+safe(p.name)+(p.demo?' <small>DEMO</small>':'')+(p.eventDate?'<br><small>'+safe(p.eventDate)+'</small>':'')+'</td><td>'+safe(p.kind)+'</td><td>'+safe(p.status)+'</td>'+
   '<td>'+money(p.price)+'</td><td>'+money(p.memberPrice)+'</td><td>'+money(p.cost)+'</td><td>'+safe(p.variants.map(v=>v.label+': '+(v.stock==null?'∞':v.stock)).join(', '))+'</td>'+
   '<td>'+(canManage?'<button type="button" data-edit>Edit</button>':'')+'</td></tr>').join('')+'</tbody>';
}
function openForm(p){
 editing=p;const f=$('sa-form');f.hidden=false;f.reset();$('sa-form-status').textContent='';$('sa-form-title').textContent=p?'Edit '+p.name:'New product';
 if(p){const set={sku:p.sku,name:p.name,kind:p.kind,category:p.category,status:p.status,price:dollars(p.price),member_price:dollars(p.memberPrice),cost:dollars(p.cost),sort:p.sort,event_date:p.eventDate||'',event_time:p.eventTime,venue:p.venue,variants:vText(p.variants),description:p.description};
  for(const [k,v] of Object.entries(set))f.elements[k].value=v??'';}
 $('sa-photo-row').hidden=!p;f.scrollIntoView({block:'start'});
}
$('sa-new').addEventListener('click',()=>openForm(null));
$('sa-cancel').addEventListener('click',()=>{$('sa-form').hidden=true});
$('sa-products').addEventListener('click',e=>{if(e.target.matches('[data-edit]'))openForm(products.find(p=>p.id===e.target.closest('[data-product]').dataset.product))});
$('sa-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target,product=Object.fromEntries(new FormData(f));$('sa-form-status').textContent='Saving…';
 try{const r=await api('/api/committee/store/products','POST',editing?{id:editing.id,version:editing.version,product}:{product});
  await loadProducts();editing=products.find(p=>p.id===r.id);$('sa-photo-row').hidden=false;$('sa-form-status').textContent='Saved.';}
 catch(error){$('sa-form-status').textContent=error.message}
});
$('sa-photo').addEventListener('change',async e=>{
 try{$('sa-form-status').textContent='Preparing photo…';const photo=await preparePhoto(e.target.files[0]);
  await api('/api/committee/store/products','POST',{action:'photo',id:editing.id,photo});await loadProducts();editing=products.find(p=>p.id===editing.id);$('sa-form-status').textContent='Photo saved.';}
 catch(error){$('sa-form-status').textContent=error.message}e.target.value='';
});
$('sa-photo-remove').addEventListener('click',async()=>{try{await api('/api/committee/store/products','POST',{action:'photo',id:editing.id,photo:null});await loadProducts();$('sa-form-status').textContent='Photo removed.'}catch(error){$('sa-form-status').textContent=error.message}});
// ---------- Import and export ----------
document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',async()=>{
 const r=await fetch('/api/committee/store/export?type='+b.dataset.export,{credentials:'same-origin',cache:'no-store'});
 if(!r.ok){alert('Export failed ('+r.status+').');return}
 const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(await r.blob()),download:'sandy-store-'+b.dataset.export+'-'+new Date().toISOString().slice(0,10)+'.csv'});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}));
$('sa-csv-file').addEventListener('change',async e=>{const file=e.target.files[0];if(file){$('sa-csv').value=await file.text();$('sa-apply').disabled=true;$('sa-import-result').innerHTML=''}});
$('sa-csv').addEventListener('input',()=>{$('sa-apply').disabled=true});
async function runImport(apply){
 const out=$('sa-import-result');out.textContent=apply?'Importing…':'Checking…';
 try{const r=await api('/api/committee/store/import','POST',{csv:$('sa-csv').value,apply});
  if(apply){out.innerHTML='<p><strong>Done.</strong> '+r.creates+' added, '+r.updates+' updated.</p>';$('sa-apply').disabled=true;return}
  out.innerHTML='<p><strong>Preview:</strong> '+r.creates+' to add, '+r.updates+' to update, '+r.errors.length+' with errors.</p>'+
   (r.errors.length?'<table class="store-table"><thead><tr><th>Row</th><th>SKU</th><th>Problem</th></tr></thead><tbody>'+r.errors.map(x=>'<tr><td>'+x.row+'</td><td>'+safe(x.sku)+'</td><td>'+safe(x.message)+'</td></tr>').join('')+'</tbody></table>':'')+
   '<table class="store-table"><thead><tr><th>Row</th><th>SKU</th><th>Product</th><th>Action</th></tr></thead><tbody>'+r.rows.map(x=>'<tr><td>'+x.row+'</td><td>'+safe(x.sku)+'</td><td>'+safe(x.name)+'</td><td>'+(x.action==='create'?'Add':'Update')+'</td></tr>').join('')+'</tbody></table>';
  $('sa-apply').disabled=!!r.errors.length||!(r.creates+r.updates);
 }catch(error){out.textContent=error.message}
}
$('sa-preview').addEventListener('click',()=>runImport(false));
$('sa-apply').addEventListener('click',()=>runImport(true));
// ---------- Reports ----------
async function loadReport(){
 const r=await api('/api/committee/store/report'),cards=[['Orders',r.orders.total],['New requests',r.orders.byStatus.requested],['Demo sales',money(r.sales.value)],['Margin',money(r.sales.margin)],['Donations pledged',money(r.donations.total)],['Stock on hand',r.stock.units+' items'],['Stock value (retail)',money(r.stock.retail)],['Low stock lines',r.lowStock.length]];
 const tbl=(head,rows)=>'<table class="store-table"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(x=>'<tr>'+x.map(c=>'<td>'+safe(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+head.length+'">None yet.</td></tr>')+'</tbody></table>';
 $('sa-report').innerHTML='<p class="club-note">'+safe(r.notice)+' Figures are demo requests, not money received.</p><div class="store-report">'+cards.map(([a,b])=>'<div class="club-summary-card"><strong>'+safe(b)+'</strong><span>'+a+'</span></div>').join('')+'</div>'+
  '<h3>Top sellers</h3>'+tbl(['SKU','Product','Units','Value'],r.top.map(x=>[x.sku,x.name,x.units,money(x.value)]))+
  '<h3>Event tickets</h3>'+tbl(['Event','Date','By ticket type','Total'],r.tickets.map(x=>[x.event,x.date,Object.entries(x.byType).map(([k,v])=>k+': '+v).join(', '),x.total]))+
  '<h3>Donations by fund</h3>'+tbl(['Fund','Pledged'],r.donations.byFund.map(x=>[x.fund,money(x.value)]))+
  '<h3>Low stock</h3>'+tbl(['SKU','Product','Size','Left'],r.lowStock.map(x=>[x.sku,x.name,x.variant,x.stock]))+
  '<h3>Orders by status</h3>'+tbl(['Status','Orders'],ORDER.map(([v,l])=>[l,r.orders.byStatus[v]]))+
  '<p class="club-note">Products: '+r.products.active+' live, '+r.products.draft+' draft, '+r.products.archived+' archived. Stock cost value: '+money(r.stock.cost)+'.</p>';
}
(async()=>{
 try{const s=await api('/api/session');
  if(!s.authenticated||!['webmaster','president','vice_president','secretary','assistant_secretary','treasurer'].includes(s.identity?.role)||s.readOnly){$('sa-state').textContent='For the Treasurer, Webmaster and membership officers. Sign in first.';$('sa-state').className='club-status bad';return}
  canManage=['webmaster','treasurer'].includes(s.identity.role);
  document.querySelectorAll('[data-manage]').forEach(el=>el.hidden=!canManage);
  $('sa-panel').hidden=false;await loadOrders();
  if(!canManage)$('sa-state').textContent+=' · View only: the Treasurer or Webmaster manages the store.';
 }catch(error){$('sa-state').textContent=error.message;$('sa-state').className='club-status bad'}
})();
