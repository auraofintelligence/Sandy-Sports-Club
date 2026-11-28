// Public sponsors page: sponsor wall and the "Offer support" form.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const form=$('offer-form');let token='',widget=null,useTurnstile=false;
(async()=>{
 const d=await fetch('/api/sponsors',{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
 if(!d){$('sponsor-wall').innerHTML='<p>Could not load partners right now.</p>';return}
 $('sponsor-wall').innerHTML=d.sponsors.length?d.sponsors.map(s=>'<article class="sponsor-card">'+(s.logoUrl?'<img src="'+safe(s.logoUrl)+'" alt="'+safe(s.name)+' logo">':'<span class="sponsor-initial">'+safe(s.name.slice(0,1))+'</span>')+
  '<div><span class="tag">'+safe(s.tier)+'</span><h3>'+(s.url?'<a href="'+safe(s.url)+'" target="_blank" rel="noopener">'+safe(s.name)+'</a>':safe(s.name))+'</h3><p>'+safe(s.blurb)+'</p></div></article>').join('')
  :'<p>Our first partners will appear here. Could it be you?</p>';
 $('offer-types').innerHTML=Object.entries(d.offerTypes).map(([k,v])=>'<label><input type="checkbox" name="offerTypes" value="'+k+'"> '+safe(v)+'</label>').join('');
 $('offer-participation').innerHTML=Object.entries(d.participation).map(([k,v])=>'<label><input type="checkbox" name="participation" value="'+k+'"> '+safe(v)+'</label>').join('');
 if(d.turnstileSiteKey&&window.turnstile?.render){useTurnstile=true;$('offer-send').disabled=true;
  widget=window.turnstile.render('#offer-challenge',{sitekey:d.turnstileSiteKey,callback:t=>{token=t;$('offer-send').disabled=false},'expired-callback':()=>{token='';$('offer-send').disabled=true}})}
})();
form.addEventListener('submit',async e=>{
 e.preventDefault();const d=new FormData(form);$('offer-status').textContent='Sending…';$('offer-send').disabled=true;
 try{
  const r=await fetch('/api/sponsors/offer',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({organisation:d.get('organisation'),contactName:d.get('contactName'),email:d.get('email'),phone:d.get('phone'),website:d.get('website'),
   offerTypes:d.getAll('offerTypes'),participation:d.getAll('participation'),offer:d.get('offer'),consent:form.elements.consent.checked,website_hp:d.get('website_hp')||'',turnstileToken:token})});
  const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Could not send.');
  form.reset();$('offer-status').textContent='Thank you. A committee member will be in touch.';
 }catch(error){$('offer-status').textContent=error.message}
 finally{if(useTurnstile&&widget!==null){token='';window.turnstile.reset(widget)}$('offer-send').disabled=useTurnstile}
});
