// My profile, required picture, Members directory and Film Club crew roster inside My Membership.
import {picturePicker,pictureSrc,verifiedBadge} from './picture.js';
import {choiceGroup,summary} from './choices.js';
const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const levels={new:'New to it',social:'Social',competitive:'Competitive',coach:'Coach'};
const form=$('profile-form');let profile=null,options=null,members=[],gender='',photoUrl=null,details=null;
async function api(path,method='GET',data){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Member service error ('+response.status+').');
 return payload;
}
let groups={};
function presetsFor(o){return {
 sports:[{label:'Not sure yet',values:[]},{label:'All of them',values:o.sports},{label:'Beach volleyball',values:['Mixed beach volleyball']},{label:'Fitness and movement',values:['Fitness and movement']}],
 availability:[{label:'Not sure yet',values:[]},{label:'Anytime',values:o.availability},{label:'Weekday evenings',values:['Weekday evening']},{label:'Weekends',values:['Weekend morning','Weekend afternoon']},{label:'Weekday daytime',values:['Weekday morning','Weekday afternoon']},{label:'School holidays',values:['School holidays']},{label:'Occasional events',values:['Occasional events']}],
 crewSkills:[{label:'Not for me',values:[]},{label:'Happy to learn anything',values:o.crew},{label:'Camera and photos',values:['Camera','Photography']},{label:'Sound and music',values:['Sound','Music']},{label:'Acting',values:['Acting']}],
 helping:[{label:'Not right now',values:[]},{label:'Anything that is needed',values:o.helping},{label:'Setting up and packing down',values:['Setting up courts']},{label:'Coaching and running sessions',values:['Running a session','Coaching']},{label:'Events and markets',values:['Events and markets']}]}}
function fill(){
 form.elements.bio.value=profile.bio;form.elements.skillLevel.value=profile.skillLevel;
 const presets=presetsFor(options);
 for(const [id,key,list] of [['profile-sports','sports',options.sports],['profile-availability','availability',options.availability],['profile-crew','crewSkills',options.crew],['profile-helping','helping',options.helping]])
  groups[key]=choiceGroup($(id),{name:key,options:list,presets:presets[key],selected:profile[key]});
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
 const tags=[...summary(m.sports),m.skillLevel?levels[m.skillLevel]:'',m.filmMember?'Film Club':''].filter(Boolean);
 const action={none:'<button type="button" data-act="request">Connect</button>',requested:'<span>Request sent</span> <button type="button" data-act="remove">Cancel</button>',
  incoming:'<button type="button" data-act="accept">Accept</button> <button type="button" data-act="decline">Decline</button>',connected:'<span>Connected</span> <button type="button" data-act="remove">Remove</button>'}[m.connection]||'';
 return '<article class="member-item with-pic" data-member="'+safe(m.accountId)+'"><img class="member-pic" alt="" src="'+safe(pictureSrc(m.picture,m.photoUrl))+'" loading="lazy"><strong>'+safe(m.name)+verifiedBadge(m.verified)+(m.town?' · '+safe(m.town):'')+'</strong>'+
  (m.bio?'<span>'+safe(m.bio)+'</span>':'')+(tags.length?'<span>'+safe(tags.join(' · '))+'</span>':'')+
  (m.availability?.length?'<span>Free: '+safe(summary(m.availability).join(', '))+'</span>':'')+(m.crewSkills.length?'<span>Crew: '+safe(summary(m.crewSkills).join(', '))+'</span>':'')+(m.helping.length?'<span>Can help with: '+safe(summary(m.helping).join(', '))+'</span>':'')+
  (m.contact?'<span>'+safe([m.contact.email,m.contact.mobile].filter(Boolean).join(' · '))+'</span>':'')+
  (m.connection==='preview'?'':'<span>'+action+' <button type="button" data-act="block" class="link-button">Block</button></span>')+'</article>';
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
  $('directory-sport').insertAdjacentHTML('beforeend',options.sports.map(s=>'<option>'+safe(s)+'</option>').join(''));
  fill();if(profile.picture){loadDirectory();loadRoster()}
 }catch(error){form.hidden=true;$('profile-status').textContent=error.message;form.insertAdjacentHTML('beforebegin','<p>'+safe(error.message)+'</p>')}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();const d=new FormData(form);$('profile-status').textContent='Saving…';
 try{
  ({profile}=await api('/api/member/profile','POST',{version:profile.version,bio:d.get('bio'),skillLevel:d.get('skillLevel'),sports:groups.sports.value(),availability:groups.availability.value(),
   crewSkills:groups.crewSkills.value(),helping:groups.helping.value(),filmMember:form.elements.filmMember.checked,directoryVisible:form.elements.directoryVisible.checked,
   showTown:form.elements.showTown.checked,shareContact:form.elements.shareContact.checked}));
  fill();$('profile-status').textContent='Saved.';loadDirectory();loadRoster();
 }catch(error){$('profile-status').textContent=error.message}
});
$('profile-preview-button').addEventListener('click',()=>{
 const box=$('profile-preview');if(!box.hidden){box.hidden=true;return}
 const f=new FormData(form),me={accountId:'me',verified:profile.verified,picture:profile.picture?{type:'avatar',avatarId:profile.picture.avatarId||''}:null,photoUrl:null,
  name:details.preferredName||details.fullName,town:form.elements.showTown.checked?details.town:'',bio:f.get('bio')||'',sports:groups.sports.value(),skillLevel:f.get('skillLevel'),
  availability:groups.availability.value(),filmMember:form.elements.filmMember.checked,crewSkills:groups.crewSkills.value(),helping:groups.helping.value(),connection:'preview'};
 box.innerHTML=(form.elements.directoryVisible.checked?'<p>This is what other members see in the directory:</p>':'<p><strong>You are hidden from the directory</strong>, so nobody sees this yet. Turn on "Show me in the member directory" to be found.</p>')+card(me)+
  '<p class="club-note">'+(profile.picture?.type==='photo'?'Members you connect with see your photo instead of an avatar':'Members you connect with see the same card')+(form.elements.shareContact.checked?', plus your email and mobile.':'. Your contact details stay private.')+'</p>';
 box.hidden=false;
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
