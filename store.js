// Sandy Sports demo store: catalogue, cart, checkout with discount codes and order requests. No payment is taken.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=c=>c===0?'Free':'$'+(c/100).toFixed(c%100?2:0);
const statusLabel={requested:'Requested',confirmed:'Confirmed',ready:'Ready to collect',collected:'Collected',cancelled:'Cancelled'};
const tint={Apparel:'#0a7481',Headwear:'#1b6f9e','Club gear':'#e8742c','Film Club':'#3a2d6b',Community:'#2e7d4f','Event tickets':'#b8432f',Donations:'#c69214'};
const NOTES=[5,10,20,50,100];
const CART_KEY='sandy-store-cart';
let shop=null,cart=[],quote=null;
// The cart is kept for this browser tab only, so it survives signing in. Orders themselves live on the server.
try{cart=JSON.parse(sessionStorage.getItem(CART_KEY)||'[]')}catch{cart=[]}
const keep=()=>{try{sessionStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{}};
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Store error ('+r.status+').');return p;
}
const member=()=>shop?.me?.member;
const priceFor=(p,v)=>v?.price!=null?v.price:(member()&&p.memberPrice!=null?p.memberPrice:p.price);
function priceText(p){
 if(p.kind==='donation')return 'Any amount';
 if(p.kind==='ticket'){const prices=p.variants.map(v=>v.price??p.price),lo=Math.min(...prices),hi=Math.max(...prices);return lo===hi?money(lo):money(lo)+' to '+money(hi)}
 return member()&&p.memberPrice!=null&&p.memberPrice<p.price?'<s>'+money(p.price)+'</s> '+money(p.memberPrice)+' members':money(p.price)+(p.memberPrice!=null&&p.memberPrice<p.price?' <small>('+money(p.memberPrice)+' members)</small>':'');
}
const avail={in:'',low:' (low stock)',out:' (sold out)'};
function card(p){
 const options=p.variants.map(v=>'<option value="'+safe(v.label)+'"'+(v.availability==='out'?' disabled':'')+'>'+safe(v.label)+(v.price!=null&&p.kind==='ticket'?' · '+money(v.price):'')+(v.left!=null?' · '+v.left+' left':avail[v.availability])+'</option>').join('');
 const art=p.photoUrl?'<img src="'+safe(p.photoUrl)+'" alt="" loading="lazy">':'<span class="store-tile" style="background:'+(tint[p.category]||'#102d40')+'">'+safe(p.name.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join(''))+'</span>';
 const when=p.kind==='ticket'?'<p class="store-when">'+safe([p.eventDate,p.eventTime,p.venue].filter(Boolean).join(' · '))+'</p>':'';
 const controls=p.kind==='donation'
  ?'<div class="store-amounts">'+NOTES.map(a=>'<button type="button" data-amount="'+a+'">$'+a+'</button>').join('')+'<label>Other $<input type="number" min="1" max="10000" step="1" data-custom-amount></label></div>'
  :(p.variants.length>1||p.variants[0].label!=='One size'?'<label>'+(p.kind==='ticket'?'Ticket':'Size')+'<select data-variant>'+options+'</select></label>':'<input type="hidden" data-variant value="'+safe(p.variants[0].label)+'">')+
   '<label>Qty<input type="number" data-qty min="1" max="20" value="1"></label><button type="button" class="button" data-add'+(p.variants.every(v=>v.availability==='out')?' disabled':'')+'>'+(p.kind==='ticket'?'Add tickets':'Add')+'</button>';
 return '<article class="store-card" data-id="'+safe(p.id)+'">'+art+'<div class="store-body"><span class="tag">'+safe(p.category)+(p.demo?' · DEMO':'')+'</span><h3>'+safe(p.name)+'</h3>'+when+'<p>'+safe(p.description)+'</p><p class="store-price">'+priceText(p)+'</p><div class="store-controls">'+controls+'</div></div></article>';
}
function drawGrid(){
 const cat=$('store-category').value,q=$('store-q').value.trim().toLowerCase();
 const list=shop.products.filter(p=>(!cat||p.category===cat)&&(!q||(p.name+' '+p.description).toLowerCase().includes(q)));
 $('store-grid').innerHTML=list.map(card).join('')||'<p>No products match.</p>';
}
function view(name){for(const v of ['cart','checkout','done'])$('view-'+v).hidden=v!==name}
function drawCart(){
 cart=cart.filter(l=>shop.products.some(p=>p.id===l.productId));keep();
 if(!cart.length){$('cart-lines').innerHTML='<p>Nothing added yet.</p>';$('cart-totals').innerHTML='';$('cart-checkout').disabled=true;return}
 let total=0;
 $('cart-lines').innerHTML=cart.map((l,i)=>{const p=shop.products.find(x=>x.id===l.productId),v=p.variants.find(x=>x.label===l.variant);
  const line=l.kind==='donation'?l.amount*100:priceFor(p,v)*l.qty;total+=line;
  return '<div class="cart-line"><span>'+(l.kind==='donation'?'':l.qty+' × ')+safe(p.name)+(l.variant&&l.variant!=='One size'&&l.kind!=='donation'?' <small>('+safe(l.variant)+')</small>':'')+'</span><span>'+money(line)+' <button type="button" class="link-button" data-remove="'+i+'" aria-label="Remove">✕</button></span></div>'}).join('');
 $('cart-totals').innerHTML='<div class="cart-line cart-total"><span>Estimate</span><span>'+money(total)+'</span></div><p class="club-note">Discounts and codes are worked out at checkout.</p>';
 $('cart-checkout').disabled=false;
}
function add(p,variant,qty,amount){
 if(p.kind==='donation')cart.push({productId:p.id,kind:p.kind,variant:p.variants[0].label,amount});
 else{const existing=cart.find(l=>l.productId===p.id&&l.variant===variant);if(existing)existing.qty=Math.min(20,existing.qty+qty);else cart.push({productId:p.id,kind:p.kind,variant,qty})}
 keep();view('cart');drawCart();$('cart-status').textContent='Added '+p.name+'.';
}
const items=()=>cart.map(l=>l.kind==='donation'?{productId:l.productId,variant:l.variant,amount:l.amount}:{productId:l.productId,variant:l.variant,qty:l.qty});
async function refreshQuote(){
 const code=$('checkout-code').value.trim();
 try{
  quote=await api('/api/store/quote','POST',{items:items(),code});
  $('checkout-lines').innerHTML=quote.lines.map(l=>'<div class="cart-line"><span>'+(l.kind==='donation'?'Donation: ':l.qty+' × ')+safe(l.name)+(l.kind==='donation'?'':' <small>('+safe(l.variant)+')</small>')+'</span><span>'+money(l.line)+'</span></div>').join('');
  $('checkout-totals').innerHTML=(quote.discount?'<div class="cart-line"><span>'+safe(quote.label)+'</span><span>−'+money(quote.discount)+'</span></div>':'')+
   '<div class="cart-line cart-total"><span>Total (demo, not charged)</span><span>'+money(quote.total)+'</span></div>';
  $('checkout-code-msg').textContent=quote.codeMessage||'';
  $('checkout-status').textContent='';
 }catch(error){$('checkout-status').textContent=error.message}
}
async function openCheckout(){
 view('checkout');
 const signedIn=shop.me?.signedIn;$('checkout-signin').hidden=signedIn;$('checkout-body').hidden=!signedIn;
 if(!signedIn)return;
 $('checkout-collection').innerHTML='<option value="">Choose…</option>'+shop.collectionPoints.map(c=>'<option>'+safe(c)+'</option>').join('');
 await refreshQuote();
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
$('cart-lines').addEventListener('click',e=>{if(e.target.dataset.remove!=null){cart.splice(Number(e.target.dataset.remove),1);keep();drawCart()}});
$('cart-checkout').addEventListener('click',openCheckout);
$('checkout-back').addEventListener('click',()=>{view('cart');drawCart()});
$('checkout-apply').addEventListener('click',refreshQuote);
$('checkout-code').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();refreshQuote()}});
$('store-category').addEventListener('change',drawGrid);$('store-q').addEventListener('input',drawGrid);
$('view-checkout').addEventListener('submit',async e=>{
 e.preventDefault();$('checkout-place').disabled=true;$('checkout-status').textContent='Placing your order request…';
 try{
  const code=quote?.code||'';
  const {order}=await api('/api/store/orders','POST',{items:items(),code,collection:$('checkout-collection').value,phone:$('checkout-phone').value,note:$('checkout-note').value,acknowledge:$('checkout-ack').checked});
  cart=[];keep();drawCart();e.target.reset();
  $('view-done').innerHTML='<h2>Order #'+order.number+' requested</h2><p><strong>No payment has been taken.</strong> Sandy Sports has no bank account yet.</p>'+
   '<p>The Treasurer will confirm stock and let you know when it is ready to collect from <strong>'+safe(order.collection)+'</strong>.</p>'+
   '<div>'+order.lines.map(l=>'<div class="cart-line"><span>'+(l.kind==='donation'?'Donation: ':l.qty+' × ')+safe(l.name)+'</span><span>'+money(l.line)+'</span></div>').join('')+
   (order.discount?'<div class="cart-line"><span>'+safe(order.discountLabel)+'</span><span>−'+money(order.discount)+'</span></div>':'')+'<div class="cart-line cart-total"><span>Total</span><span>'+money(order.total)+'</span></div></div>'+
   '<p><button type="button" class="button" id="done-continue">Continue shopping</button></p>';
  view('done');$('done-continue').addEventListener('click',()=>view('cart'));loadOrders();
 }catch(error){$('checkout-status').textContent=error.message}
 finally{$('checkout-place').disabled=false}
});
async function loadOrders(){
 if(!shop.me?.signedIn)return;
 try{const {orders}=await api('/api/store/orders');
  $('my-orders').innerHTML=orders.length?'<h3>Your orders</h3>'+orders.map(o=>'<p><strong>#'+o.number+'</strong> · '+safe(statusLabel[o.status])+' · '+money(o.total)+(o.collection?' · '+safe(o.collection):'')+'<br><small>'+safe(o.lines.map(l=>(l.kind==='donation'?'':l.qty+' × ')+l.name).join(', '))+'</small></p>').join(''):'';
 }catch{}
}
(async()=>{
 try{
  shop=await api('/api/store');
  $('store-notice').textContent=shop.notice.replace(/^Working demo store\.\s*/,'');
  $('store-category').insertAdjacentHTML('beforeend',[...new Set(shop.products.map(p=>p.category))].map(c=>'<option>'+safe(c)+'</option>').join(''));
  if(location.hash==='#donate')$('store-category').value='Donations';else if(location.hash==='#tickets')$('store-category').value='Event tickets';
  $('store-state').innerHTML=shop.me.signedIn?(shop.me.member?'Member prices applied.'+(shop.me.birthdayMonth?' Happy birthday month: '+shop.birthdayPercent+'% off merch and tickets at checkout.':''):'Signed in.')
   :'Browse freely. To check out, <a href="/member-join.html">join free</a> or <a href="/club-login.html?next=/store.html%23checkout">sign in</a>.';
  drawGrid();drawCart();loadOrders();
  if(location.hash==='#checkout'&&cart.length)openCheckout();
 }catch(error){$('store-state').textContent=error.message;$('store-state').className='club-status bad'}
})();
