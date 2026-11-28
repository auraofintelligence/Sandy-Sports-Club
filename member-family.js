// My family: guardian-managed child profiles inside My Membership.
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sports=['Mixed beach volleyball','Beach cricket','Flag football','Beach soccer','Beach rugby','AirBadminton','Beach tennis','Beach handball','Fitness and movement','Film club','Multi-sport'];
const bands={'under16':'Under 16','16-17':'16 to 17'};
const form=$('family-form'),list=$('family-list'),status=$('family-status');
let children=[];
async function api(method='GET',data){
 const response=await fetch('/api/member/family',{method,credentials:'same-origin',cache:'no-store',...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error(payload.error||'Family service error ('+response.status+').'),{status:response.status});
 return payload;
}
function render(){
 list.innerHTML=children.length?children.map(c=>'<article class="member-item" data-child="'+safe(c.id)+'"><strong>'+safe(c.preferredName||c.fullName)+'</strong>'+
  '<span>'+safe(c.fullName)+' · '+safe(bands[c.ageBand]||c.ageBand)+(c.interests.length?' · '+safe(c.interests.join(', ')):'')+'</span>'+
  '<label class="club-consent"><input type="checkbox" data-photo '+(c.photoPermission?'checked':'')+'> Photos and video allowed</label>'+
  '<button type="button" data-remove>Remove</button></article>').join(''):'<p>No children added yet.</p>';
}
async function load(){
 try{({children}=await api());render();form.hidden=false}
 catch(error){list.innerHTML='<p>'+safe(error.status===401||error.status===403?'Family profiles are for adult member accounts.':error.message)+'</p>';form.hidden=true}
}
$('family-sport-options').innerHTML=sports.map(v=>'<label><input name="interest" type="checkbox" value="'+safe(v)+'"> '+safe(v)+'</label>').join('');
form.addEventListener('submit',async event=>{
 event.preventDefault();const d=new FormData(form);status.textContent='Saving…';
 try{
  ({children}=await api('POST',{action:'add',fullName:d.get('fullName'),preferredName:d.get('preferredName'),ageBand:d.get('ageBand'),relationship:d.get('relationship'),
   interests:d.getAll('interest'),photoPermission:form.elements.photoPermission.checked,guardianDeclaration:form.elements.guardianDeclaration.checked}));
  form.reset();render();status.textContent='Added.';
 }catch(error){status.textContent=error.message}
});
list.addEventListener('change',async event=>{
 if(!event.target.matches('[data-photo]'))return;
 const c=children.find(x=>x.id===event.target.closest('[data-child]').dataset.child);
 try{({children}=await api('POST',{action:'update',id:c.id,version:c.version,photoPermission:event.target.checked}));render()}catch(error){status.textContent=error.message;load()}
});
list.addEventListener('click',async event=>{
 if(!event.target.matches('[data-remove]'))return;
 const c=children.find(x=>x.id===event.target.closest('[data-child]').dataset.child);
 if(!confirm('Remove '+(c.preferredName||c.fullName)+' from the club?'))return;
 try{({children}=await api('POST',{action:'remove',id:c.id,version:c.version}));render()}catch(error){status.textContent=error.message;load()}
});
fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(s?.authenticated&&s.identity?.role==='member'&&!s.readOnly)load();else form.hidden=true}).catch(()=>{});
