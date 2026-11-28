// Committee review of wishes sent from the asset wish list.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const statuses=[['new','New'],['reviewing','Reviewing'],['planned','Planned'],['declined','Not this time'],['done','Done']];
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||'Service error ('+r.status+').');return p;
}
async function load(){
 const f=$('cr-filter').value,{requests,counts}=await api('/api/committee/requests'+(f?'?status='+f:''));
 $('cr-state').textContent=counts.new+' new · '+counts.open+' open';
 $('cr-list').innerHTML=requests.length?requests.map(r=>'<article class="member-item" data-id="'+safe(r.id)+'"><strong>'+safe(r.title)+'</strong>'+
  '<span>'+safe(r.category+' · '+r.priority+' · from '+r.from.name+' ('+r.from.username+') · '+r.createdAt.slice(0,10))+'</span><span>'+safe(r.purpose)+'</span>'+(r.nextStep?'<span>Next: '+safe(r.nextStep)+'</span>':'')+
  '<span class="club-form-grid"><label>Status<select data-status>'+statuses.map(([v,l])=>'<option value="'+v+'"'+(v===r.status?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
  '<label>Note to the member<input data-note maxlength="1000" value="'+safe(r.note)+'"></label></span><span><button type="button" data-save>Save</button> <small data-saved></small></span></article>').join(''):'<p>Nothing here.</p>';
}
$('cr-filter').addEventListener('change',()=>load().catch(e=>$('cr-state').textContent=e.message));
$('cr-list').addEventListener('click',async e=>{
 if(!e.target.matches('[data-save]'))return;const item=e.target.closest('[data-id]'),done=item.querySelector('[data-saved]');
 try{await api('/api/committee/requests','POST',{id:item.dataset.id,status:item.querySelector('[data-status]').value,note:item.querySelector('[data-note]').value});done.textContent='Saved.'}catch(error){done.textContent=error.message}
});
(async()=>{
 try{const s=await api('/api/session');
  if(!s.authenticated||['member','webmaster_demo'].includes(s.identity?.role)||s.readOnly){$('cr-state').textContent='For committee accounts. Sign in first.';$('cr-state').className='club-status bad';return}
  $('cr-panel').hidden=false;await load();
 }catch(error){$('cr-state').textContent=error.message;$('cr-state').className='club-status bad'}
})();
