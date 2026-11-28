// My profile, required picture, Members directory and Film Club crew roster inside My Membership.
import {picturePicker,pictureSrc,verifiedBadge} from './picture.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const levels={new:'New to it',social:'Social',competitive:'Competitive',coach:'Coach'};
const form=$('profile-form');let profile=null,options=null,members=[],gender='',photoUrl=null,details=null;
async function api(path,method='GET',data){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Member service error ('+response.status+').');
 return payload;
}
const boxes=(id,name,list)=>{$(id).innerHTML=list.map(v=>'<label><input type="checkbox" name="'+name+'" value="'+safe(v)+'"> '+safe(v)+'</label>').join('')};
function fill(){
 form.elements.bio.value=profile.bio;form.elements.skillLevel.value=profile.skillLevel;
 for(const [name,key] of [['sport','sports'],['availability','availability'],['crew','crewSkills'],['helping','helping']])
  for(const box of form.querySelectorAll('input[name="'+name+'"]'))box.checked=profile[key].includes(box.value);
 for(const key of ['filmMember','directoryVisible','showTown','shareContact'])form.elements[key].checked=profile[key];
}
async function savePicture(choice,statusEl){
 statusEl.textContent='Saving…';
 try{
  const r=await api('/api/member/picture','POST',choice);profile=r.profile;photoUrl=r.photoUrl;
  statusEl.textContent='Saved.';showPicture();
  if(document.body.classList.contains('needs-picture')){document.body.classList.remove('needs-picture');$('picture-step').hidden=true;loadDirectory();loadRoster()}
 }catch(error){statusEl.textContent=error.message}
}
function showPicture(){$('profile-picture').src=pictureSrc(profile.picture,photoUrl&&photoUrl+'?v='+profile.version);
 $('profile-verified').innerHTML=profile.verified?verifiedBadge(true)+' ID verified in person':'No blue tick yet. Show your photo ID to a committee member at a club session to get verified.'}
function card(m){
 const tags=[...m.sports,m.skillLevel?levels[m.skillLevel]:'',m.filmMember?'Film Club':''].filter(Boolean);
 const action={none:'<button type="button" data-act="request">Connect</button>',requested:'<span>Request sent</span> <button type="button" data-act="remove">Cancel</button>',
  incoming:'<button type="button" data-act="accept">Accept</button> <button type="button" data-act="decline">Decline</button>',connected:'<span>Connected</span> <button type="button" data-act="remove">Remove</button>'}[m.connection]||'';
 return '<article class="member-item with-pic" data-member="'+safe(m.accountId)+'"><img class="member-pic" alt="" src="'+safe(pictureSrc(m.picture,m.photoUrl))+'" loading="lazy"><strong>'+safe(m.name)+verifiedBadge(m.verified)+(m.town?' · '+safe(m.town):'')+'</strong>'+
  (m.bio?'<span>'+safe(m.bio)+'</span>':'')+(tags.length?'<span>'+safe(tags.join(' · '))+'</span>':'')+
  (m.crewSkills.length?'<span>Crew: '+safe(m.crewSkills.join(', '))+'</span>':'')+(m.helping.length?'<span>Can help with: '+safe(m.helping.join(', '))+'</span>':'')+
  (m.contact?'<span>'+safe([m.contact.email,m.contact.mobile].filter(Boolean).join(' · '))+'</span>':'')+
  '<span>'+action+' <button type="button" data-act="block" class="link-button">Block</button></span></article>';
}
async function loadDirectory(){
 const params=new URLSearchParams();const q=$('directory-q').value.trim(),sport=$('directory-sport').value;
 if(q)params.set('q',q);if(sport)params.set('sport',sport);if($('directory-film').checked)params.set('film','1');
 try{
  const data=await api('/api/member/directory?'+params);members=data.members;
  $('directory-status').textContent=(data.visible?'':'You are not listed yet. Turn on the directory in My profile to connect with people. ')+(data.incoming?data.incoming+' connection request(s) waiting.':'');
  $('directory-list').innerHTML=members.length?members.map(card).join(''):'<p>No members match yet. Invite your friends to join free.</p>';
 }catch(error){$('directory-status').textContent=error.message}
}
async function loadRoster(){
 try{const data=await api('/api/member/directory?film=1');
  $('film-roster').innerHTML=data.members.length?data.members.map(m=>'<article class="member-item"><strong>'+safe(m.name)+'</strong><span>'+safe(m.crewSkills.join(', ')||'Crew skills not listed yet')+'</span></article>').join(''):'<p>No Film Club members listed yet. Be the first.</p>';
 }catch(error){$('film-roster').textContent=error.message}
}
async function load(){
 try{
  ({profile,options,gender,photoUrl,details}=await api('/api/member/profile'));
  const df=$('details-form');for(const k of ['fullName','preferredName','email','mobile','town','audienceRegion'])df.elements[k].value=details[k]||'';df.elements.contactConsent.checked=details.contactConsent;
  const who={dob:profile.dob,gender};
  showPicture();
  picturePicker($('profile-picture-picker'),{who,current:profile.picture,name:'profile-avatar',onChange:c=>savePicture(c,$('profile-picture-status'))});
  if(!profile.picture){
   document.body.classList.add('needs-picture');$('picture-step').hidden=false;
   picturePicker($('picture-step-picker'),{who,name:'step-avatar',onChange:c=>savePicture(c,$('picture-step-status'))});
   $('picture-step').scrollIntoView({block:'start'});
  }
  boxes('profile-sports','sport',options.sports);boxes('profile-availability','availability',options.availability);boxes('profile-crew','crew',options.crew);boxes('profile-helping','helping',options.helping);
  $('directory-sport').insertAdjacentHTML('beforeend',options.sports.map(s=>'<option>'+safe(s)+'</option>').join(''));
  fill();if(profile.picture){loadDirectory();loadRoster()}
 }catch(error){form.hidden=true;$('profile-status').textContent=error.message;form.insertAdjacentHTML('beforebegin','<p>'+safe(error.message)+'</p>')}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();const d=new FormData(form);$('profile-status').textContent='Saving…';
 try{
  ({profile}=await api('/api/member/profile','POST',{version:profile.version,bio:d.get('bio'),skillLevel:d.get('skillLevel'),sports:d.getAll('sport'),availability:d.getAll('availability'),
   crewSkills:d.getAll('crew'),helping:d.getAll('helping'),filmMember:form.elements.filmMember.checked,directoryVisible:form.elements.directoryVisible.checked,
   showTown:form.elements.showTown.checked,shareContact:form.elements.shareContact.checked}));
  fill();$('profile-status').textContent='Saved.';loadDirectory();loadRoster();
 }catch(error){$('profile-status').textContent=error.message}
});
$('details-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;$('details-status').textContent='Saving…';
 try{await api('/api/member/details','POST',{preferredName:f.elements.preferredName.value,mobile:f.elements.mobile.value,town:f.elements.town.value,audienceRegion:f.elements.audienceRegion.value,contactConsent:f.elements.contactConsent.checked});$('details-status').textContent='Saved.'}
 catch(error){$('details-status').textContent=error.message}
});
$('directory-list').addEventListener('click',async event=>{
 const act=event.target.dataset?.act;if(!act)return;
 const accountId=event.target.closest('[data-member]').dataset.member;
 if(act==='block'&&!confirm('Block this member? They will not see you and cannot contact you through the club.'))return;
 try{await api('/api/member/connections','POST',{action:act,accountId});loadDirectory();}catch(error){$('directory-status').textContent=error.message}
});
let timer;$('directory-q').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadDirectory,300)});
$('directory-sport').addEventListener('change',loadDirectory);$('directory-film').addEventListener('change',loadDirectory);
document.querySelectorAll('[data-goto]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.querySelector('[data-member-tab="'+a.dataset.goto+'"]')?.click()}));
fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(s?.authenticated&&s.identity?.role==='member'&&!s.readOnly)load()}).catch(()=>{});
