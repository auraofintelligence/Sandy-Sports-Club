// Committee sponsorship desk (PLFC pattern): pipeline, follow-up, private contact, benefits, sponsor link, listing and stockist approvals.
import {preparePhoto} from './picture.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=c=>c==null?'':'$'+(c/100).toFixed(2);
const officeLabel={president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',webmaster:'Webmaster'};
let data=null,selected=null;
async function api(method='GET',body){
 const r=await fetch('/api/committee/sponsors',{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Error '+r.status);return p;
}
const needs=s=>s.status==='new'||s.overdue||Object.keys(s.pending).length||s.products.some(p=>p.status==='pending');
function drawList(){
 const f=$('sd-filter').value,rows=data.sponsors.filter(s=>f==='all'||(f==='open'?needs(s)||['reviewing','agreed'].includes(s.status):s.status===f));
 $('sd-list').innerHTML=rows.map(s=>'<button type="button" data-id="'+safe(s.id)+'" aria-current="'+(s.id===selected)+'"><strong>'+safe(s.organisation)+'</strong><small>'+safe(s.statusLabel)+(s.tierLabel?' · '+safe(s.tierLabel):'')+
  (s.overdue?' · <span style="color:#c62828">follow-up overdue</span>':'')+(Object.keys(s.pending).length||s.products.some(p=>p.status==='pending')?' · approval waiting':'')+'</small></button>').join('')||'<p>Nothing here.</p>';
 $('sd-state').textContent=data.counts.new+' new · '+data.counts.overdue+' follow-ups overdue · '+data.counts.approvals+' waiting for approval'+(data.canManage?'':' · view only');
}
const opts=(o,cur)=>Object.entries(o).map(([k,v])=>'<option value="'+safe(k)+'"'+(k===cur?' selected':'')+'>'+safe(v)+'</option>').join('');
function drawDetail(){
 const s=data.sponsors.find(x=>x.id===selected);if(!s){$('sd-detail').innerHTML='<p>Choose a sponsor.</p>';return}
 const ro=data.canManage?'':' disabled',p=s.pending;
 $('sd-detail').innerHTML='<h2>'+safe(s.organisation)+'</h2><p class="club-note">'+safe(s.source==='offer'?'Offered through the website':'Added by the committee')+' · '+safe(s.createdAt.slice(0,10))+'</p>'+
 '<section><h3>Offer and requests</h3><p>'+safe(s.offer||'No details yet.')+'</p><p>'+safe(s.offerTypes.map(k=>data.offerTypes[k]).join(' · '))+'</p>'+(s.participation.length?'<p>Taking part: '+safe(s.participation.map(k=>data.participation[k]).join(' · '))+'</p>':'')+'</section>'+
 '<form id="sd-edit"><section><h3>Private contact</h3><div class="club-form-grid"><label>Business<input name="organisation" value="'+safe(s.organisation)+'"'+ro+'></label><label>Contact<input name="contactName" value="'+safe(s.contactName)+'"'+ro+'></label>'+
  '<label>Email<input name="email" value="'+safe(s.email)+'"'+ro+'></label><label>Phone<input name="phone" value="'+safe(s.phone)+'"'+ro+'></label><label>Website<input name="website" value="'+safe(s.website)+'"'+ro+'></label></div></section>'+
 '<section><h3>Committee follow-up</h3><div class="club-form-grid"><label>Stage<select name="status"'+ro+'>'+opts(data.statuses,s.status)+'</select></label><label>Level<select name="tier"'+ro+'><option value="">Not set</option>'+opts(data.tiers,s.tier)+'</select></label>'+
  '<label>Who follows up<select name="owner"'+ro+'><option value="">Unassigned</option>'+opts(Object.fromEntries(data.offices.map(o=>[o,officeLabel[o]])),s.owner)+'</select></label><label>Follow up by<input type="date" name="followUpOn" value="'+safe(s.followUpOn)+'"'+ro+'></label>'+
  '<label>Value of support $<input name="value" inputmode="decimal" value="'+safe(s.value!=null?(s.value/100).toFixed(2):'')+'"'+ro+'></label></div>'+
  '<label>Notes<textarea name="notes" rows="3"'+ro+'>'+safe(s.notes)+'</textarea></label></section>'+
 '<section><h3>Benefits promised</h3><p class="club-note">Choosing a level fills these in. Tick them off as they are delivered; the sponsor sees this list.</p><div id="sd-benefits">'+
  s.benefits.map((b,i)=>'<div class="benefit-row"><input type="checkbox" data-benefit="'+i+'"'+(b.done?' checked':'')+ro+'><input data-benefit-label="'+i+'" value="'+safe(b.label)+'"'+ro+'></div>').join('')+'</div>'+
  (data.canManage?'<p><button type="button" id="sd-add-benefit">Add a benefit</button></p>':'')+'</section>'+
  (data.canManage?'<p><button type="submit" class="button coral">Save</button> <span id="sd-save" role="status"></span></p>':'')+'</form>'+
 '<section><h3>Private sponsor link</h3><p>'+(s.portal.issued?'A link is active (made '+safe(s.portal.issuedAt.slice(0,10))+').':'No link yet.')+' Sponsors use it to see their benefits, update their listing and offer stockist products.</p>'+
  (data.canManage?'<p><button type="button" id="sd-link">'+(s.portal.issued?'Make a new link':'Make a link')+'</button> '+(s.portal.issued?'<button type="button" id="sd-revoke">Turn link off</button>':'')+'</p><div id="sd-link-out"></div>':'')+'</section>'+
 '<section><h3>Sponsor wall listing</h3><p>'+(s.listing.live?'<strong>Showing on the public sponsor page.</strong>':'Not showing.')+'</p>'+
  (Object.keys(p).length?'<div class="club-panel"><strong>Update from the sponsor</strong><p>'+safe(p.name)+' · '+safe(p.url)+'</p><p>'+safe(p.blurb)+'</p>'+(p.logo?'<img src="'+safe(p.logo)+'" alt="" style="width:80px;border-radius:8px">':'')+
   (data.canManage?'<p><button type="button" id="sd-approve">Approve</button> <button type="button" id="sd-reject">Decline</button></p>':'')+'</div>':'')+
  '<form id="sd-listing"><div class="club-form-grid"><label>Name shown<input name="name" value="'+safe(s.listing.name||s.organisation)+'"'+ro+'></label><label>Website<input name="url" value="'+safe(s.listing.url||s.website)+'"'+ro+'></label></div>'+
  '<label>Line about them<textarea name="blurb" rows="2"'+ro+'>'+safe(s.listing.blurb)+'</textarea></label>'+(s.listing.logoUrl?'<img src="'+safe(s.listing.logoUrl)+'" alt="" style="width:80px;border-radius:8px">':'')+
  (data.canManage?'<label>Logo<input type="file" name="logo" accept="image/jpeg,image/png,image/webp"></label><label class="club-consent"><input type="checkbox" name="live"'+(s.listing.live?' checked':'')+(s.status==='active'?'':' disabled')+'> Show on the sponsor page'+(s.status==='active'?'':' (set the stage to Active partner first)')+'</label><button type="submit">Save listing</button> <span id="sd-listing-status" role="status"></span>':'')+'</form></section>'+
 '<section><h3>Stockist products</h3>'+(s.products.length?s.products.map(x=>'<div class="benefit-row" data-product="'+safe(x.id)+'">'+(x.photoUrl?'<img src="'+safe(x.photoUrl)+'" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px">':'')+
  '<span><strong>'+safe(x.name)+'</strong> '+money(x.price)+' · '+safe(x.status)+(x.url?' · <a href="'+safe(x.url)+'" target="_blank" rel="noopener">link</a>':'')+'</span>'+
  (data.canManage?(x.status!=='approved'?' <button type="button" data-product-status="approved">Approve</button>':'')+(x.status!=='hidden'?' <button type="button" data-product-status="hidden">Hide</button>':''):'')+'</div>').join(''):'<p>None yet. Partner stockists add these from their private link.</p>')+'</section>';
 wire(s);
}
function wire(s){
 const reload=async(keep=true)=>{data=await api();if(!keep)selected=null;drawList();drawDetail()};
 $('sd-add-benefit')?.addEventListener('click',()=>{$('sd-benefits').insertAdjacentHTML('beforeend','<div class="benefit-row"><input type="checkbox" data-benefit="n"><input data-benefit-label="n" placeholder="New benefit"></div>')});
 $('sd-edit')?.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,benefits=[...f.querySelectorAll('[data-benefit-label]')].map(i=>({label:i.value,done:i.previousElementSibling.checked}));
  try{await api('POST',{action:'update',id:s.id,version:s.version,organisation:f.elements.organisation.value,contactName:f.elements.contactName.value,email:f.elements.email.value,phone:f.elements.phone.value,website:f.elements.website.value,
   status:f.elements.status.value,tier:f.elements.tier.value,owner:f.elements.owner.value,followUpOn:f.elements.followUpOn.value,value:f.elements.value.value,notes:f.elements.notes.value,benefits:f.elements.tier.value!==s.tier&&!s.benefits.length?[]:benefits});
   await reload();$('sd-save').textContent='Saved.'}catch(error){$('sd-save').textContent=error.message}
 });
 $('sd-link')?.addEventListener('click',async()=>{if(s.portal.issued&&!confirm('Make a new link? The old one stops working.'))return;
  try{const r=await api('POST',{action:'portal-link',id:s.id});const full=location.origin+r.link;await reload();
   $('sd-link-out').innerHTML='<p class="sponsor-link-box">'+safe(full)+'</p><p><button type="button" id="sd-copy">Copy link</button> <a href="mailto:'+safe(s.email)+'?subject='+encodeURIComponent('Your Sandy Sports partner page')+'&body='+encodeURIComponent('Hi '+(s.contactName||'')+',\n\nHere is your private Sandy Sports partner page. Please keep it to yourself:\n'+full+'\n\nThanks for supporting the club.')+'">Email it</a></p><p class="club-note">'+safe(r.notice)+'</p>';
   $('sd-copy').addEventListener('click',()=>navigator.clipboard.writeText(full).then(()=>{$('sd-copy').textContent='Copied'}))}catch(error){alert(error.message)}});
 $('sd-revoke')?.addEventListener('click',async()=>{if(!confirm('Turn this sponsor link off?'))return;try{await api('POST',{action:'revoke-link',id:s.id});await reload()}catch(error){alert(error.message)}});
 $('sd-approve')?.addEventListener('click',async()=>{try{await api('POST',{action:'approve-listing',id:s.id});await reload()}catch(error){alert(error.message)}});
 $('sd-reject')?.addEventListener('click',async()=>{try{await api('POST',{action:'reject-listing',id:s.id});await reload()}catch(error){alert(error.message)}});
 $('sd-listing')?.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;$('sd-listing-status').textContent='Saving…';
  try{const logo=f.elements.logo?.files[0]?await preparePhoto(f.elements.logo.files[0]):undefined;
   await api('POST',{action:'listing',id:s.id,name:f.elements.name.value,url:f.elements.url.value,blurb:f.elements.blurb.value,live:!!f.elements.live?.checked,...(logo?{logo}:{})});await reload();$('sd-listing-status').textContent='Saved.'}
  catch(error){$('sd-listing-status').textContent=error.message}
 });
 $('sd-detail').querySelectorAll('[data-product-status]').forEach(b=>b.addEventListener('click',async()=>{try{await api('POST',{action:'product',id:s.id,productId:b.closest('[data-product]').dataset.product,status:b.dataset.productStatus});await reload()}catch(error){alert(error.message)}}));
}
$('sd-filter').addEventListener('change',drawList);
$('sd-list').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;selected=b.dataset.id;drawList();drawDetail()});
$('sd-new').addEventListener('click',()=>{$('sd-create').hidden=false});
$('sd-create-cancel').addEventListener('click',()=>{$('sd-create').hidden=true});
$('sd-create').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;
 try{const r=await api('POST',{action:'create',organisation:f.elements.organisation.value,contactName:f.elements.contactName.value,email:f.elements.email.value,phone:f.elements.phone.value,website:f.elements.website.value,offer:f.elements.offer.value});
  f.reset();f.hidden=true;data=await api();selected=r.id;drawList();drawDetail()}catch(error){$('sd-create-status').textContent=error.message}
});
(async()=>{
 try{const s=await fetch('/api/session',{cache:'no-store'}).then(r=>r.json());
  if(!s.authenticated||['member','webmaster_demo'].includes(s.identity?.role)||s.readOnly){$('sd-state').textContent='For committee accounts. Sign in first.';$('sd-state').className='club-status bad';return}
  data=await api();document.querySelectorAll('[data-manage]').forEach(el=>{if(!data.canManage)el.hidden=true});$('sd-create').hidden=true;
  $('sd-panel').hidden=false;drawList();
 }catch(error){$('sd-state').textContent=error.message;$('sd-state').className='club-status bad'}
})();
