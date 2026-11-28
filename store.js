// Sandy Sports demo store: catalogue, cart and member order requests. No payment is taken.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=c=>c===0?'Free':'$'+(c/100).toFixed(c%100?2:0);
const statusLabel={requested:'Requested',confirmed:'Confirmed',ready:'Ready to collect',collected:'Collected',cancelled:'Cancelled'};
const tint={Apparel:'#0a7481',Headwear:'#1b6f9e','Beach gear':'#e8742c','Film Club':'#3a2d6b',Community:'#2e7d4f','Event tickets':'#b8432f',Donations:'#c69214'};
let shop=null,cart=[];
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Store error ('+r.status+').');return p;
}
const member=()=>shop?.me?.member;
function priceFor(p,v){if(v?.price!=null)return v.price;return member()&&p.memberPrice!=null?p.memberPrice:p.price}
function priceText(p){
 if(p.kind==='donation')return 'Any amount';
 if(p.kind==='ticket'){const prices=p.variants.map(v=>v.price??p.price);const lo=Math.min(...prices),hi=Math.max(...prices);return lo===hi?money(lo):money(lo)+' to '+money(hi)}
 return member()&&p.memberPrice!=null&&p.memberPrice<p.price?'<s>'+money(p.price)+'</s> '+money(p.memberPrice)+' members':money(p.price)+(p.memberPrice!=null&&p.memberPrice<p.price?' <small>('+money(p.memberPrice)+' members)</small>':'');
}
const avail={in:'',low:' (low stock)',out:' (sold out)'};
function card(p){
 const options=p.variants.map(v=>'<option value="'+safe(v.label)+'"'+(v.availability==='out'?' disabled':'')+'>'+safe(v.label)+(v.price!=null&&p.kind==='ticket'?' · '+money(v.price):'')+(v.left!=null?' · '+v.left+' left':avail[v.availability])+'</option>').join('');
 const art=p.photoUrl?'<img src="'+safe(p.photoUrl)+'" alt="" loading="lazy">':'<span class="store-tile" style="background:'+(tint[p.category]||'#102d40')+'">'+safe(p.name.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join(''))+'</span>';
 const when=p.kind==='ticket'?'<p class="store-when">'+safe([p.eventDate,p.eventTime,p.venue].filter(Boolean).join(' · '))+'</p>':'';
 const controls=p.kind==='donation'
  ?'<div class="store-amounts">'+[10,25,50,100].map(a=>'<button type="button" data-amount="'+a+'">$'+a+'</button>').join('')+'<label>Other $<input type="number" min="1" max="10000" step="1" data-custom-amount></label></div>'
  :(p.variants.length>1||p.variants[0].label!=='One size'?'<label>'+(p.kind==='ticket'?'Ticket':'Size')+'<select data-variant>'+options+'</select></label>':'<input type="hidden" data-variant value="'+safe(p.variants[0].label)+'">')+
   '<label>Qty<input type="number" data-qty min="1" max="20" value="1"></label><button type="button" class="button" data-add'+(p.variants.every(v=>v.availability==='out')?' disabled':'')+'>'+(p.kind==='ticket'?'Add tickets':'Add')+'</button>';
 return '<article class="store-card" data-id="'+safe(p.id)+'">'+art+'<div class="store-body"><span class="tag">'+safe(p.category)+(p.demo?' · DEMO':'')+'</span><h3>'+safe(p.name)+'</h3>'+when+'<p>'+safe(p.description)+'</p><p class="store-price">'+priceText(p)+'</p><div class="store-controls">'+controls+'</div></div></article>';
}
function drawGrid(){
 const cat=$('store-category').value,q=$('store-q').value.trim().toLowerCase();
 const list=shop.products.filter(p=>(!cat||p.category===cat)&&(!q||(p.name+' '+p.description).toLowerCase().includes(q)));
 $('store-grid').innerHTML=list.map(card).join('')||'<p>No products match.</p>';
}
function drawCart(){
 if(!cart.length){$('cart-lines').innerHTML='<p>Nothing added yet.</p>';$('cart-totals').innerHTML='';$('cart-send').disabled=true;return}
 let goods=0,donation=0;
 $('cart-lines').innerHTML=cart.map((l,i)=>{const line=l.kind==='donation'?l.amount*100:l.unit*l.qty;if(l.kind==='donation')donation+=line;else goods+=line;
  return '<div class="cart-line"><span>'+(l.kind==='donation'?'':l.qty+' × ')+safe(l.name)+(l.variant&&l.variant!=='One size'?' <small>('+safe(l.variant)+')</small>':'')+'</span><span>'+money(line)+' <button type="button" class="link-button" data-remove="'+i+'" aria-label="Remove">✕</button></span></div>'}).join('');
 const discount=shop.me?.birthdayMonth?Math.round(goods*shop.birthdayPercent/100):0;
 $('cart-totals').innerHTML=(discount?'<div class="cart-line"><span>Birthday month '+shop.birthdayPercent+'% off 🎂</span><span>−'+money(discount)+'</span></div>':'')+
  '<div class="cart-line cart-total"><span>Total (demo, not charged)</span><span>'+money(goods-discount+donation)+'</span></div>';
 $('cart-send').disabled=!shop.me?.signedIn;
}
function add(p,variant,qty,amount){
 if(p.kind==='donation'){cart.push({productId:p.id,name:p.name,kind:p.kind,variant:p.variants[0].label,amount});}
 else{const v=p.variants.find(x=>x.label===variant);const existing=cart.find(l=>l.productId===p.id&&l.variant===variant);
  if(existing)existing.qty=Math.min(20,existing.qty+qty);else cart.push({productId:p.id,name:p.name,kind:p.kind,variant,qty,unit:priceFor(p,v)});}
 drawCart();$('cart-status').textContent='Added '+p.name+'.';
}
$('store-grid').addEventListener('click',e=>{
 const el=e.target.closest('[data-id]');if(!el)return;const p=shop.products.find(x=>x.id===el.dataset.id);
 if(e.target.dataset.amount){add(p,null,1,Number(e.target.dataset.amount));return}
 if(e.target.matches('[data-add]')){const qty=Math.max(1,Math.min(20,Number(el.querySelector('[data-qty]').value)||1));add(p,el.querySelector('[data-variant]').value,qty)}
});
$('store-grid').addEventListener('change',e=>{
 if(!e.target.matches('[data-custom-amount]'))return;const a=Math.round(Number(e.target.value));
 if(a>=1&&a<=10000){add(shop.products.find(x=>x.id===e.target.closest('[data-id]').dataset.id),null,1,a);e.target.value=''}
});
$('cart-lines').addEventListener('click',e=>{if(e.target.dataset.remove!=null){cart.splice(Number(e.target.dataset.remove),1);drawCart()}});
$('store-category').addEventListener('change',drawGrid);$('store-q').addEventListener('input',drawGrid);
$('cart-send').addEventListener('click',async()=>{
 $('cart-send').disabled=true;$('cart-status').textContent='Sending…';
 try{
  const {order}=await api('/api/store/orders','POST',{items:cart.map(l=>l.kind==='donation'?{productId:l.productId,variant:l.variant,amount:l.amount}:{productId:l.productId,variant:l.variant,qty:l.qty}),note:$('cart-note').value});
  cart=[];$('cart-note').value='';drawCart();
  $('cart-status').textContent='Order #'+order.number+' sent. No payment has been taken. The Treasurer will be in touch.';loadOrders();
 }catch(error){$('cart-status').textContent=error.message;drawCart()}
});
async function loadOrders(){
 if(!shop.me?.signedIn)return;
 try{const {orders}=await api('/api/store/orders');
  $('my-orders').innerHTML=orders.length?'<h3>Your orders</h3>'+orders.map(o=>'<p><strong>#'+o.number+'</strong> · '+safe(statusLabel[o.status])+' · '+money(o.total)+'<br><small>'+safe(o.lines.map(l=>(l.kind==='donation'?'':l.qty+' × ')+l.name).join(', '))+'</small></p>').join(''):'';
 }catch{}
}
(async()=>{
 try{
  shop=await api('/api/store');
  $('store-notice').textContent=shop.notice.replace(/^Working demo store\.\s*/,'');
  $('store-category').insertAdjacentHTML('beforeend',[...new Set(shop.products.map(p=>p.category))].map(c=>'<option>'+safe(c)+'</option>').join(''));
  if(location.hash==='#donate')$('store-category').value='Donations';else if(location.hash==='#tickets')$('store-category').value='Event tickets';
  $('store-state').innerHTML=shop.me.signedIn?(shop.me.member?'Member prices applied.'+(shop.me.birthdayMonth?' Happy birthday month: '+shop.birthdayPercent+'% off merch and tickets.':''):'Signed in.')
   :'Browse freely. To order, <a href="/member-join.html">join free</a> or <a href="/club-login.html">sign in</a>.';
  drawGrid();drawCart();loadOrders();
 }catch(error){$('store-state').textContent=error.message;$('store-state').className='club-status bad'}
})();
