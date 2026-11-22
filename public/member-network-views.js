export const durations=[['day','1 day'],['week','7 days'],['month','30 days'],['until-revoked','Until I stop sharing']];
const humanTime=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
const stamp=value=>value?humanTime.format(new Date(value))+' AEST':'Until you stop sharing';
const avatars=['angler-01'];
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let pauseChoice=null;
try{const saved=localStorage.getItem('sandy-avatar-motion');if(saved==='paused'||saved==='playing')pauseChoice=saved==='paused';}catch{}
const paused=()=>pauseChoice??reduced.matches;
export const avatarUrl=()=>'/assets/sandy-original-logo.png';
export function updateAvatarMotion(root,toggle=false){
  if(toggle){
    pauseChoice=!paused();
    try{localStorage.setItem('sandy-avatar-motion',pauseChoice?'paused':'playing');}catch{}
  }
  for(const img of root.querySelectorAll('img[data-angler]'))img.src=avatarUrl(img.dataset.angler);
  const button=root.querySelector('[data-avatar-motion]');if(button)button.textContent=paused()?'Play avatar animations':'Pause avatar animations';
}
const validPhoto=path=>typeof path==='string'&&/^\/api\/member\/network\/(?:profiles|items)\/[a-f\d-]{36}\/photo$/i.test(path);
const safeFaces=(people=[])=>people.filter(p=>p.state==='friend').map(p=>p.peer);

export function avatar(person,esc,small=false){
  const src=validPhoto(person?.photoUrl)?person.photoUrl:avatarUrl(person?.avatarId);
  return '<img class="angler-face'+(small?' small':'')+'" '+(validPhoto(person?.photoUrl)?'':'data-angler="'+esc(person?.avatarId||avatars[0])+'" ')+'src="'+esc(src)+'" width="'+(small?44:72)+'" height="'+(small?44:72)+'" alt="">';
}
function friendOptions(friends,esc){
  return friends.map(p=>'<label class="net-check">'+
    '<input type="checkbox" name="recipients" value="'+esc(p.id)+'">'+avatar(p,esc,true)+'<span>'+esc(p.displayName)+'</span></label>').join('');
}
function howLong(){
  return '<label>How long can they open it?<select name="duration">'+durations.map(([key,label])=>'<option value="'+key+'"'+(key==='week'?' selected':'')+'>'+label+'</option>').join('')+'</select></label>';
}
export function consentControls(friends,esc){
  return friends.length?'<fieldset class="net-set"><legend>Choose friends</legend>'+friendOptions(friends,esc)+'</fieldset>'+howLong()+
    '<p class="net-help">You can stop access early. A friend may keep a copy they have already saved.</p>':'<p>Add a friend before sharing. You can still save this privately.</p>';
}
export function profilePage(desk,esc){
  const p=desk.profile||{},currentAvatar=avatars.includes(p.avatarId)?p.avatarId:avatars[0];
  return '<header class="net-heading"><h1>My profile</h1><p>Choose the name and picture your club friends will recognise.</p></header>'+
    '<form class="net-form" data-profile-form><div class="net-current-face">'+avatar(p,esc)+'<div><strong>'+esc(p.displayName||'Your member profile')+'</strong>'+
    '<p>'+(p.listed?'Other eligible members can find your display name.':'Hidden from member search.')+'</p></div></div>'+
    '<label>Display name<input name="displayName" required minlength="2" maxlength="48" autocomplete="off" value="'+esc(p.displayName)+'" placeholder="The name your friends know"></label>'+
    '<fieldset class="net-set"><legend>Profile picture</legend>'+
    (validPhoto(p.photoUrl)?'<label class="net-check"><input type="radio" name="picture" value="keep" checked>Keep my current photo</label>':'')+
    '<label class="net-check"><input type="radio" name="picture" value="avatar"'+(validPhoto(p.photoUrl)?'':' checked')+'>Use the Sandy club mark</label>'+
    '<input type="hidden" name="avatarId" value="'+currentAvatar+'">'+
    '<label class="net-check"><input type="radio" name="picture" value="upload">Upload my own photo</label>'+
    '<label data-upload-label hidden>Choose a photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP, up to 12 MB.</small></label></fieldset>'+
    (desk.eligibleToShare?'<label class="net-check"><input name="listed" type="checkbox"'+(p.listed?' checked':'')+'>Let eligible members find me by my display name</label>'+
    '<p class="net-help">Search shows your display name and club picture. Accepted friends can see your chosen profile photo.</p>':
    '<p>Your profile is private. <a href="#members/safety">Check your age group and optional sharing choices.</a></p>')+
    '<button type="submit" class="button">Save my profile</button></form>'+
    '<p><a class="text-link" href="#members/friends">Friends and sharing</a></p>';
}
export function connectPanel(desk,esc){
  if(!desk.canShare)return '<p>Your items stay private. Friends and sharing are available to members in the verified 16+ group who accept the social terms. <a href="#members/safety">Check my access and safety</a>.</p>';
  const list=(state,title,action)=>{const rows=desk.connections.filter(c=>c.state===state);return rows.length?'<section class="net-group"><h3>'+title+'</h3><ul class="net-people">'+rows.map(c=>'<li>'+
    avatar(c.peer,esc,true)+'<span>'+esc(c.peer.displayName)+'</span><div class="net-actions">'+action(c.peer)+'</div></li>').join('')+'</ul></section>':'';};
  const act=(who,action,label)=>'<button type="button" class="text-link" data-peer-action="'+action+'" data-peer="'+esc(who.id)+'">'+label+'</button>';
  return '<form class="net-search" data-member-search><label>Find a member by display name<input name="query" type="search" minlength="2" maxlength="48" required placeholder="At least two letters" autocomplete="off"></label><button class="button outline small">Find members</button></form>'+
    '<div data-search-results aria-live="polite"></div>'+
    list('incoming','Friend requests',p=>act(p,'accept','Accept')+act(p,'remove','Decline')+act(p,'block','Block'))+
    list('outgoing','Requests you sent',p=>act(p,'remove','Cancel request'))+
    list('friend','My club friends',p=>act(p,'remove','Remove friend')+act(p,'block','Block'))+
    (!safeFaces(desk.connections).length?'<p>Accepted friends will appear here. Only members who opted into search can be found by name.</p>':'')+
    list('blocked','Blocked members',p=>act(p,'unblock','Unblock'));
}
export function searchPeople(people,desk,esc){
  if(!people.length)return '<p>No matching display names. Check the spelling or ask your friend to switch on member search.</p>';
  return '<ul class="net-people">'+people.map(person=>{
    const state=desk.connections.find(c=>c.peer.id===person.id)?.state;
    return '<li>'+avatar(person,esc,true)+'<span>'+esc(person.displayName)+'</span>'+
      (state?'<small>'+({friend:'Already friends',incoming:'Request received',outgoing:'Request sent',blocked:'Blocked'}[state]||'')+'</small>':
      '<button class="button outline small" type="button" data-peer-action="request" data-peer="'+esc(person.id)+'">Send friend request</button>')+'</li>';
  }).join('')+'</ul>';
}
export function composer(desk,catches,esc,withMap){
  const options=catches.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.species+' · '+c.date+(c.lengthCm?' · '+c.lengthCm+' cm':''))+'</option>').join('');
  return '<form class="net-form" data-item-create><label>Give this a name<input name="title" required maxlength="120" placeholder="'+(withMap?'For example, a meeting spot':'For example, Sunday’s whiting')+'"></label>'+
    '<label>Notes (optional)<textarea name="message" maxlength="2000" rows="3"></textarea></label>'+
    '<input type="hidden" name="catchId" value="">'+
    
    '<label>Photo (optional)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP, up to 12 MB.</small></label>'+
    (withMap?'<fieldset class="net-set"><legend>Choose the exact spot</legend><div data-new-pin></div>'+
      '<div class="net-actions"><button type="button" class="button outline small" data-use-gps>Use my device location</button><button type="button" class="text-link" data-clear-pin hidden>Clear pin</button></div>'+
      '<p class="net-help">Your device asks permission when you choose its location. You can also tap the map or enter coordinates.</p>'+
      '<details class="net-box"><summary>Enter coordinates</summary><div class="net-coordinates"><label>Latitude<input type="number" name="latitude" min="-90" max="90" step="any" inputmode="decimal"></label>'+
      '<label>Longitude<input type="number" name="longitude" min="-180" max="180" step="any" inputmode="decimal"></label></div><button type="button" class="text-link" data-use-coordinates>Use these coordinates</button></details>'+
      '<p role="status" data-pin-status></p><label>Spot name (optional)<input name="pinLabel" maxlength="100" placeholder="A name you will recognise"></label></fieldset>':
      '')+
    '<fieldset class="net-set"><legend>Who can open this?</legend><label class="net-check"><input type="radio" name="audience" value="private" checked>Only me</label>'+
    (desk.canShare&&safeFaces(desk.connections).length?'<label class="net-check"><input type="radio" name="audience" value="friends">Friends I choose</label>':'')+'</fieldset>'+
    '<section data-select-friends hidden>'+consentControls(safeFaces(desk.connections),esc)+
    (withMap?'<p><strong>This will share the exact map location with the friends you select.</strong></p>':'')+'</section>'+
    '<button type="submit" class="button" data-save-item>Save privately</button></form>';
}
function itemBody(item,esc){
  return (item.message?'<p class="net-note">'+esc(item.message)+'</p>':'')+
    (item.catch?'<p>'+esc([item.catch.species,item.catch.lengthCm?item.catch.lengthCm+' cm':'',item.catch.date].filter(Boolean).join(' · '))+'</p>':'')+
    (validPhoto(item.photoUrl)?'<img class="net-photo" src="'+esc(item.photoUrl)+'" loading="lazy" alt="Photo attached to '+esc(item.title)+'">':'')+
    (item.pin?'<p class="net-help">A private location is saved with this item.</p>':'');
}
export function incomingList(desk,esc,now=Date.now()){
  const list=desk.inbox.filter(i=>!i.expiresAt||Date.parse(i.expiresAt)>now);
  return list.length?list.map(i=>'<article class="net-item" data-received="'+esc(i.id)+'"><h3>'+esc(i.title)+'</h3><p class="net-meta">From '+esc(i.sender?.displayName||'A friend')+
    ' · '+esc(i.expiresAt?'Access ends '+stamp(i.expiresAt):'Access lasts until the sender stops sharing')+'</p>'+itemBody(i,esc)+'</article>').join(''):
    '<p>Your friends’ shared catches and photos will appear here while you have access.</p>';
}
export function ownList(desk,esc,now=Date.now()){
  if(!desk.mine.length)return '<p>Your saved notes and photos will appear here.</p>';
  return desk.mine.map(item=>{
    const active=(item.recipients||[]).filter(r=>r.active&&(!r.expiresAt||Date.parse(r.expiresAt)>now));
    const available=safeFaces(desk.connections).filter(p=>!active.some(recipient=>recipient.id===p.id));
    return '<article class="net-item" data-owned="'+esc(item.id)+'"><h3>'+esc(item.title)+'</h3><p class="net-meta">'+(active.length?'Shared with '+active.length+(active.length===1?' friend':' friends'):'Only you can open this')+'</p>'+
      itemBody(item,esc)+'<details class="net-box" data-access><summary>Who can open this?</summary>'+
      (active.length?'<ul class="net-access">'+active.map(r=>'<li><div><strong>'+esc(r.displayName)+'</strong><small>'+esc(r.expiresAt?'Access ends '+stamp(r.expiresAt):'Until you stop sharing')+'</small></div>'+
        '<div class="net-actions"><button class="text-link" type="button" data-stop-person="'+esc(r.id)+'">Stop access</button>'+
        '<details><summary>Change time</summary><form class="net-form" data-renew="'+esc(r.id)+'">'+howLong()+'<button class="button outline small">Update access time</button></form></details></div></li>').join('')+'</ul>'+
      (active.length>1?'<button class="text-link" type="button" data-stop-all>Stop sharing with everyone</button>':''):'<p>No friends have access.</p>')+
      (desk.canShare&&available.length?'<details class="net-box"><summary>Share with friends</summary><form class="net-form" data-grant>'+consentControls(available,esc)+
      (item.pin?'<label class="net-check"><input type="checkbox" name="confirmPin" required>Share this exact location with the friends I choose.</label>':'')+
      '<button class="button outline small">Share with selected friends</button></form></details>':'')+'</details></article>';
  }).join('');
}
export function privateOverview(desk,esc){
  return '<section class="net-group"><div class="net-subhead"><h2>Shared with me</h2><button class="text-link" type="button" data-network-refresh>Refresh access</button></div><div data-inbox>'+incomingList(desk,esc)+'</div><button type="button" class="text-link" data-network-earlier="inbox"'+(desk.nextInbox?'':' hidden')+'>Show earlier shares</button></section>'+
    '<section class="net-group"><h2>My saved notes and photos</h2><div data-owned-list>'+ownList(desk,esc)+'</div><button type="button" class="text-link" data-network-earlier="mine"'+(desk.nextMine?'':' hidden')+'>Show earlier items</button></section>';
}
