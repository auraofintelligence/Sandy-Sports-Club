// Private sponsor page. The key travels in the URL fragment (never sent to servers or logs) and then in a request header.
import {preparePhoto} from './picture.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const key=new URLSearchParams(location.hash.slice(1)).get('key')||'';
const money=c=>c==null?'':'$'+(c/100).toFixed(2);
const labels={pending:'Waiting for approval',approved:'Live in the club store',hidden:'Hidden'};
async function api(method='GET',body){
 const r=await fetch('/api/sponsor-portal',{method,cache:'no-store',headers:{'X-Sponsor-Key':key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Error '+r.status);return p;
}
async function load(){
 const d=await api();
 $('sp-title').textContent=d.organisation;
 $('sp-summary').textContent=[d.tier||'Partnership level to be agreed',d.status].join(' · ');
 $('sp-benefits').innerHTML=d.benefits.length?d.benefits.map(b=>'<p>'+(b.done?'✅ ':'⬜ ')+safe(b.label)+'</p>').join(''):'<p>The committee will list these once the partnership is agreed.</p>';
 $('sp-listing-now').innerHTML=d.listing.live?'Live: <strong>'+safe(d.listing.name)+'</strong>'+(d.listing.url?' · '+safe(d.listing.url):''):'Not on the sponsor wall yet.'+(Object.keys(d.pending).length?' Your update is waiting for approval.':'');
 const f=$('sp-listing');f.elements.name.value=d.pending.name??d.listing.name??'';f.elements.url.value=d.pending.url??d.listing.url??d.contact.website??'';f.elements.blurb.value=d.pending.blurb??d.listing.blurb??'';
 $('sp-products').innerHTML=d.products.filter(p=>p.status!=='hidden').map(p=>'<article class="stockist-card">'+(p.photoUrl?'<img src="'+safe(p.photoUrl)+'" alt="">':'')+'<strong>'+safe(p.name)+'</strong><span>'+money(p.price)+'</span><small>'+safe(labels[p.status])+'</small><button type="button" data-remove="'+safe(p.id)+'">Remove</button></article>').join('')||'<p>No products yet.</p>';
}
$('sp-listing').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;$('sp-listing-status').textContent='Sending…';
 try{const logo=f.elements.logo.files[0]?await preparePhoto(f.elements.logo.files[0]):undefined;
  const r=await api('POST',{action:'listing',name:f.elements.name.value,url:f.elements.url.value,blurb:f.elements.blurb.value,...(logo?{logo}:{})});$('sp-listing-status').textContent=r.notice;f.elements.logo.value='';load()}
 catch(error){$('sp-listing-status').textContent=error.message}
});
$('sp-product').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;$('sp-product-status').textContent='Sending…';
 try{const photo=f.elements.photo.files[0]?await preparePhoto(f.elements.photo.files[0]):undefined;
  const r=await api('POST',{action:'product',name:f.elements.name.value,price:f.elements.price.value,url:f.elements.url.value,description:f.elements.description.value,...(photo?{photo}:{})});
  $('sp-product-status').textContent=r.notice;f.reset();load()}
 catch(error){$('sp-product-status').textContent=error.message}
});
$('sp-products').addEventListener('click',async e=>{if(e.target.dataset.remove){try{await api('POST',{action:'remove-product',id:e.target.dataset.remove});load()}catch(error){alert(error.message)}}});
(async()=>{
 if(!/^[a-f0-9]{64}$/.test(key)){$('sp-state').textContent='This page needs the private link the club sent you.';$('sp-state').className='club-status bad';return}
 try{await load();$('sp-panel').hidden=false;$('sp-state').textContent='Welcome. Changes you send are checked by the committee before they go public.'}
 catch(error){$('sp-state').textContent=error.message;$('sp-state').className='club-status bad'}
})();
