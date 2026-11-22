import {preparePhoto} from './member-photo.js';
import {mountCatchMap} from './catch-map.js';
import {pinStyles,styleForPin} from './catch-pin-styles.mjs';
import {profilePage,connectPanel,searchPeople,composer,incomingList,ownList,privateOverview,avatarUrl,updateAvatarMotion,consentControls} from './member-network-views.js';

const endpoint='/api/member/network';
const routes=new Map([['#members/profile','member-profile'],['#members/friends','member-friends']]);
const liveReceived=(items,now=Date.now())=>items.filter(i=>!i.expiresAt||Date.parse(i.expiresAt)>now);

export function setupMemberNetwork({api,esc}){
  const panes=[...routes.values()].map(id=>document.getElementById(id)).filter(Boolean);
  if(panes.length!==routes.size)return;
  let session,route='',mount=null,desk=null,catches=[],people=[],revision=0,reader,writer,searcher;
  let journalPins=[],journalCursor=null,journalReader=null;
  let viewMap,editMap,point=null,pointStyle,focusPin='',watchedPin='',retry=null,clock=null,timer=null,channel=null,photoPreview=null;
  let pages={mine:1,inbox:1},permissions=null;
  const nextKey=list=>list==='mine'?'nextMine':'nextInbox';
  const current=()=>session?.authenticated&&['member','committee'].includes(session.role)&&routes.has(location.hash)?location.hash:'';
  const $=selector=>mount?.querySelector(selector);
  const canReadMapPins=()=>desk?.eligibleToShare||desk?.officerJournal;
  function status(text,error=false){
    const area=$('[data-network-status]');
    if(area){area.setAttribute('role',error?'alert':'status');area.textContent=text;if(error)area.scrollIntoView({block:'nearest'});}
  }
  function freeMaps(){viewMap?.destroy();editMap?.destroy();viewMap=null;editMap=null;point=null;pointStyle=undefined;}
  function reset(){
    revision++;reader?.abort();writer?.abort();searcher?.abort();reader=writer=searcher=null;
    journalReader?.abort();journalReader=null;journalPins=[];journalCursor=null;
    clearTimeout(clock);clearInterval(timer);clock=timer=null;freeMaps();
    desk=null;people=[];catches=[];retry=null;mount=null;route='';pages={mine:1,inbox:1};
    photoPreview=null;
    for(const pane of panes)pane.replaceChildren();
  }
  function heading(title,body){return '<header class="net-heading"><h1>'+title+'</h1><p>'+body+'</p></header>';}
  function pins(){
    if(!canReadMapPins())return [];
    return [...journalPins,...[...desk.mine,...liveReceived(desk.inbox)].filter(i=>i.pin).map(i=>({
      id:i.id,label:i.pin.label||i.title,lat:i.pin.latitude,lon:i.pin.longitude,style:i.pin.style,version:i.version,kind:i.sender?'shared':'spot',caption:i.sender?'From '+i.sender.displayName:'My saved spot',photoUrl:i.photoUrl
    }))];
  }
  function updatePins(){
    const node=$('[data-pin-list]');if(!node)return;
    const list=pins();
    viewMap?.setPins(list);
    const changeSymbol=p=>p.kind!=='spot'?'':'<details><summary>Change symbol</summary><form data-edit-pin-style="'+esc(p.id)+'" data-version="'+p.version+'"><label>Pin symbol<select name="style">'+Object.entries(pinStyles).map(([style,label])=>'<option value="'+style+'"'+(styleForPin(p.style,p.kind)===style?' selected':'')+'>'+label+'</option>').join('')+'</select></label><button type="submit" class="button small">Save symbol</button></form></details>';
    node.innerHTML=list.length?'<ul class="net-pin-list">'+list.map(p=>'<li><div><strong>'+esc(p.label)+'</strong><small>'+esc(p.caption)+' · '+pinStyles[styleForPin(p.style,p.kind)]+'</small>'+(p.photoUrl?'<details><summary>Catch photo</summary><img class="net-photo" src="'+esc(p.photoUrl)+'" alt="'+esc(p.label)+'" loading="lazy"></details>':'')+changeSymbol(p)+'</div><button type="button" class="text-link" data-map-focus="'+esc(p.id)+'" aria-label="Find '+esc(p.label)+' on the map">Find on map</button></li>').join('')+'</ul>':'<p>Your saved spots and catches with a journal pin will appear here.</p>';
    const older=$('[data-earlier-journal-pins]');if(older)older.hidden=!journalCursor;
    if(focusPin&&list.some(p=>p.id===focusPin)){viewMap?.focusPin?.(focusPin);focusPin='';}
  }
  async function readJournalPins(earlier=false){
    if(route!=='#members/catch-map'||!canReadMapPins()||earlier&&!journalCursor)return;
    journalReader?.abort();const op=new AbortController();journalReader=op;
    const query=new URLSearchParams({pins:'1'});if(earlier)query.set('cursor',journalCursor);
    try{
      const data=await api('/api/member/journal?'+query,{cache:'no-store',signal:op.signal});
      if(op.signal.aborted||!canReadMapPins())return;
      const entries=data.catches.filter(c=>c.pin).map(c=>({id:'journal-'+c.id,label:c.species+(c.location?' · '+c.location:''),
        lat:c.pin.latitude,lon:c.pin.longitude,style:c.pin.style,kind:'journal',caption:'Private catch journal · '+c.date,photoUrl:c.photoUrl}));
      const all=new Map((earlier?journalPins:[]).map(p=>[p.id,p]));
      for(const pin of entries)all.set(pin.id,pin);
      journalPins=[...all.values()];journalCursor=data.nextCursor||null;updatePins();
    }catch(error){
      if(op.signal.aborted)return;
      if([401,403].includes(error.status)){journalPins=[];journalCursor=null;updatePins();}
      status('Could not load your journal pins. Choose Refresh pins to try again.',true);
    }finally{if(journalReader===op)journalReader=null;}
  }
  function scheduleExpiry(){
    clearTimeout(clock);
    if(!desk)return;
    const now=Date.now();
    const expiry=[...desk.inbox.map(i=>i.expiresAt),...desk.mine.flatMap(i=>i.recipients.filter(r=>r.active).map(r=>r.expiresAt))].filter(Boolean).map(Date.parse).filter(t=>t>now).sort((a,b)=>a-b)[0];
    if(expiry)clock=setTimeout(()=>{if(desk){updateLists(true,true);updatePins();scheduleExpiry();refresh();}},Math.min(2147483000,expiry-now+20));
  }
  function updateLists(incoming,owned){
    if(incoming&&$('[data-inbox]'))$('[data-inbox]').innerHTML=incomingList(desk,esc);
    if(owned&&$('[data-owned-list]')){
      const expanded=new Set(Array.from(mount.querySelectorAll('[data-owned] [data-access][open]'),el=>el.closest('[data-owned]').dataset.owned));
      $('[data-owned-list]').innerHTML=ownList(desk,esc);
      for(const card of mount.querySelectorAll('[data-owned]'))if(expanded.has(card.dataset.owned))card.querySelector('[data-access]').open=true;
    }
  }
  function populateMap(){
    const node=$('[data-saved-map]');if(!node)return;
    viewMap=mountCatchMap(node,{pins:pins()});updatePins();
  }
  function enterComposer(details){
    if(!details.open||details.querySelector('[data-item-create]'))return;
    const map=route==='#members/catch-map',box=details.querySelector('[data-compose-body]');
    box.innerHTML=composer(desk,catches,esc,map);
    const form=box.querySelector('form');form.dataset.itemId=crypto.randomUUID();
    if(map)editMap=mountCatchMap(box.querySelector('[data-new-pin]'),{pins:[],value:null,pinKind:'spot',onPick:value=>pickPoint(form,value,false),onStyle:style=>{pointStyle=style;}});
  }
  function pickPoint(form,location,move=true){
    delete form.dataset.gpsRequest;form.querySelector('[data-use-gps]').disabled=false;
    point=location;
    if(move)editMap?.setValue(location);
    form.elements.latitude.value=location?.lat??'';form.elements.longitude.value=location?.lon??'';
    form.querySelector('[data-clear-pin]').hidden=!location;
    form.querySelector('[data-pin-status]').textContent=location?'Pin selected at '+location.lat.toFixed(5)+', '+location.lon.toFixed(5)+'.':'Pin cleared.';
  }
  function useDevice(form,button){
    const output=form.querySelector('[data-pin-status]');
    if(!navigator.geolocation){output.textContent='This device cannot provide a location. Tap the map or enter coordinates.';return;}
    const ticket=crypto.randomUUID();form.dataset.gpsRequest=ticket;button.disabled=true;output.textContent='Waiting for your device location…';
    navigator.geolocation.getCurrentPosition(position=>{
      if(!form.isConnected||route!=='#members/catch-map'||form.dataset.gpsRequest!==ticket)return;
      button.disabled=false;pickPoint(form,{lat:Number(position.coords.latitude.toFixed(5)),lon:Number(position.coords.longitude.toFixed(5))});
    },()=>{
      if(!form.isConnected||form.dataset.gpsRequest!==ticket)return;
      button.disabled=false;output.textContent='Your device did not provide a location. Tap the map or enter coordinates.';
    },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  }
  function draftPanel(label){
    return '<details class="net-box net-compose" data-compose><summary>'+label+'</summary><div data-compose-body></div></details>';
  }
  function draw(){
    if(!mount||!desk)return;
    freeMaps();
    photoPreview=null;
    let content;
    if(route==='#members/profile')content=profilePage(desk,esc);
    else if(route==='#members/friends'&&!desk.profile.id){
      content=heading('Friends and sharing','Choose a display name and a picture your club friends will recognise.')+
        '<a class="button" href="#members/profile">Set up my profile</a>';
    }else if(route==='#members/friends'){
      content=heading('Friends and sharing',desk.eligibleToShare?'Share a note or photo with people you choose. Club-wide posts belong in the <a href="#members/conversation">club conversation</a>.':'Save a note or photo in your own private collection.')+
        '<section class="net-group"><h2>Club friends</h2><div data-connections>'+connectPanel(desk,esc)+'</div></section>'+
        draftPanel('Save or share a note or photo')+privateOverview(desk,esc);
    }else{
      content=heading('My catch map',canReadMapPins()?'Keep your own fishing spots here. A catch you pin in your journal appears on this map automatically.':'Explore the coastline around Minjerribah.')+
        '<div data-saved-map></div>'+
        (canReadMapPins()?(desk.officerJournal?'':draftPanel('Add a fishing spot'))+
        '<p><a class="text-link" href="#members/journal">Record a catch with a photo or pin</a></p><section class="net-group"><div class="net-subhead"><h2>My map pins</h2><button type="button" class="text-link" data-network-refresh>Refresh pins</button></div><div data-pin-list></div><div class="net-actions"><button class="text-link" type="button" data-earlier-journal-pins hidden>Show earlier journal pins</button>'+
        ['mine','inbox'].map(l=>'<button class="text-link" type="button" data-network-earlier="'+l+'"'+(desk[nextKey(l)]?'':' hidden')+'>Check earlier '+(l==='mine'?'saved items':'shares')+' for pins</button>').join('')+'</div></section>':
        '<p>Saving precise locations opens after an officer confirms you are 16 or over and you accept the clubhouse terms. <a href="#members/safety">See my access and safety</a>.</p><p><a href="#members/journal">Open my catch journal</a></p>')+
        (desk.canShare?'<p><a class="text-link" href="#members/friends">Manage friends and sharing access</a></p>':'');
    }
    mount.innerHTML=content+'<p role="status" data-network-status></p>';
    if(route==='#members/catch-map')populateMap();
  }
  function useDesk(next,full=false){
    const old=desk;desk=next;
    if(full||!old||old.profile.id!==next.profile.id||old.canShare!==next.canShare||old.eligibleToShare!==next.eligibleToShare)draw();
    else{
      const connectionsChanged=JSON.stringify(old.connections)!==JSON.stringify(next.connections);
      if(connectionsChanged&&$('[data-connections]')){
        $('[data-connections]').innerHTML=connectPanel(next,esc);people=[];
      }
      if(connectionsChanged)updateDraftFriends(next);
      const changedInbox=JSON.stringify(old.inbox)!==JSON.stringify(next.inbox);
      const changedMine=JSON.stringify(old.mine)!==JSON.stringify(next.mine);
      updateLists(changedInbox,changedMine||connectionsChanged);
      if(changedInbox||changedMine)updatePins();
    }
    for(const b of mount.querySelectorAll('[data-network-earlier]'))b.hidden=!desk[nextKey(b.dataset.networkEarlier)];
    scheduleExpiry();
  }
  function updateDraftFriends(next){
    const form=$('[data-item-create]');if(!form)return;
    const controls=form.querySelector('[data-select-friends]'),existing=form.querySelector('[name=audience][value=friends]'),
      friends=next.connections.filter(c=>c.state==='friend').map(c=>c.peer),chosen=new Set(selected(form)),duration=form.elements.duration?.value||'week';
    const privateChoice=form.querySelector('[name=audience][value=private]');
    if(!friends.length){
      existing?.closest('label').remove();privateChoice.checked=true;controls.hidden=true;form.querySelector('[data-save-item]').textContent='Save privately';
    }else if(!existing){
      privateChoice.closest('fieldset').insertAdjacentHTML('beforeend','<label class="net-check"><input type="radio" name="audience" value="friends">Friends I choose</label>');
    }
    controls.innerHTML=consentControls(friends,esc)+(route==='#members/catch-map'?'<p><strong>This will share the exact map location with the friends you select.</strong></p>':'');
    if(form.elements.duration)form.elements.duration.value=duration;
    for(const box of controls.querySelectorAll('[name=recipients]'))box.checked=chosen.has(box.value);
  }
  async function withEarlier(next,signal){
    await Promise.all(['mine','inbox'].map(async list=>{
      for(let page=1;page<pages[list]&&next[nextKey(list)];page++){
        const params=new URLSearchParams({list,before:next[nextKey(list)]});
        const more=await api(endpoint+'?'+params,{cache:'no-store',signal});
        next[list].push(...more.items);next[nextKey(list)]=more.nextCursor;
      }
    }));
    if(route==='#members/catch-map'&&watchedPin&&!next.mine.some(i=>i.id===watchedPin)&&!next.inbox.some(i=>i.id===watchedPin)){
      try{
        const {item}=await api(endpoint+'?item='+encodeURIComponent(watchedPin),{cache:'no-store',signal});
        if(item?.pin)next[item.sender?'inbox':'mine'].push(item);
      }catch(error){if(error.status!==404)throw error;watchedPin='';focusPin='';}
    }
    return next;
  }
  async function earlier(list,button){
    if(!desk?.[nextKey(list)]||writer||reader)return;
    const op=new AbortController();reader=op;button.disabled=true;
    try{
      const params=new URLSearchParams({list,before:desk[nextKey(list)]});
      const more=await api(endpoint+'?'+params,{cache:'no-store',signal:op.signal});
      if(reader!==op||!current())return;
      pages[list]++;
      const items=new Map([...desk[list],...more.items].map(item=>[item.id,item]));
      useDesk({...desk,[list]:[...items.values()],[nextKey(list)]:more.nextCursor});
      status(more.items.length+' earlier '+(more.items.length===1?'item':'items')+' loaded.');
    }catch(error){if(reader===op)status(error.message,true);}
    finally{if(reader===op)reader=null;if(button.isConnected)button.disabled=false;}
  }
  function hideReceived(){
    if(!desk)return;
    desk={...desk,inbox:[]};updateLists(true,false);updatePins();scheduleExpiry();
  }
  async function refresh({initial=false,manual=false}={}){
    if(!current()||!mount||writer)return;
    if(route==='#members/catch-map'&&(session.role==='committee'||permissions?.canUseJournal===false)){
      if(!desk){
        desk={officerJournal:session.role==='committee',mine:[],inbox:[],canShare:false,eligibleToShare:false};
        draw();
      }
      if(desk.officerJournal)readJournalPins();
      return;
    }
    reader?.abort();const op=new AbortController();reader=op;
    if(initial)mount.innerHTML='<p role="status">Opening your member area…</p>';
    try{
      const [next,journal]=await Promise.all([api(endpoint,{cache:'no-store',signal:op.signal}).then(data=>withEarlier(data,op.signal)),null]);
      if(reader!==op||!current())return;
      if(journal)catches=journal.catches||[];
      useDesk(next,initial);
      if(route==='#members/catch-map'&&(initial||manual))readJournalPins();
      if(manual)status(route==='#members/catch-map'?'Map refreshed.':'Sharing access checked.');
    }catch(error){
      if(reader!==op||!current())return;
      if(initial||error.status===401||error.status===403){
        freeMaps();desk=null;people=[];catches=[];
        mount.innerHTML='<p role="alert">'+esc(error.message)+'</p><a class="text-link" href="#members/safety">Check my access and safety</a> · <button class="text-link" type="button" data-network-retry>Try again</button>';
      }else{hideReceived();status(error.message,true);}
    }finally{if(reader===op)reader=null;}
  }
  function navigate(){
    const next=current();if(next===route)return;
    reset();if(next!=='#members/catch-map'){focusPin='';watchedPin='';}if(!next)return;
    route=next;mount=document.getElementById(routes.get(next));
    if(next!=='#members/catch-map'&&permissions && !permissions.canUseJournal){
      mount.innerHTML='<p>Your private tools open after the club checks your age group and any guardian permission.</p><a class="text-link" href="#members/safety">Check my access and safety</a>';
      return;
    }
    refresh({initial:true});
    timer=setInterval(()=>{if(!document.hidden&&route!=='#members/profile'&&!writer&&!reader)refresh();},12000);
  }
  async function mutate(data,message,{full=false,after}={}){
    if(!mount||!current()||writer||session?.readOnly||session?.showcase||session?.demo)return;
    const pane=mount;reader?.abort();reader=null;searcher?.abort();searcher=null;
    const key=JSON.stringify(data);
    if(retry?.key!==key)retry={key,id:crypto.randomUUID()};
    const op=new AbortController();writer=op;pane.inert=true;
    try{
      let next=await api(endpoint,{method:'POST',body:JSON.stringify({...data,mutationId:retry.id}),signal:op.signal});
      if(writer!==op||!current())return;
      try{next=await withEarlier(next,op.signal);}catch{pages={mine:1,inbox:1};}
      if(writer!==op||!current())return;
      retry=null;useDesk(next,full);after?.();status(message);channel?.postMessage('updated');
    }catch(error){
      if(writer!==op||!current())return;
      status(error.message,true);
      if(error.status===409){
        writer=null;refresh({manual:false});
      }else if(error.status===401||error.status===403){
        writer=null;refresh();
      }
    }finally{if(writer===op)writer=null;pane.inert=false;}
  }
  const selected=form=>Array.from(form.querySelectorAll('[name=recipients]:checked'),input=>input.value);
  async function performSearch(form){
    const query=form.elements.query.value.trim();if(query.length<2)return;
    searcher?.abort();const op=new AbortController();searcher=op;
    try{
      const data=await api(endpoint+'?q='+encodeURIComponent(query),{cache:'no-store',signal:op.signal});
      if(searcher!==op||!current()||!$('[data-search-results]'))return;
      people=data.people||[];$('[data-search-results]').innerHTML=searchPeople(people,desk,esc);
    }catch(error){if(searcher===op)status(error.message,true);}
  }
  async function submit(form){
    if(!desk||writer)return;
    if(form.matches('[data-member-search]')){performSearch(form);return;}
    const captured=revision,button=form.querySelector('button[type=submit],button:not([type])');
    if(button?.disabled)return;
    if(button)button.disabled=true;
    try{
      if(form.matches('[data-profile-form]')){
        const fields=form.elements,picture=fields.picture.value;
        const data={action:'profile',version:desk.profile.version,displayName:fields.displayName.value.trim(),avatarId:fields.avatarId.value,listed:Boolean(fields.listed?.checked)};
        if(picture==='upload'){
          if(!fields.photo.files[0])throw Error('Choose a photo to upload, or use the club picture.');
          data.photo=await (photoPreview?.file===fields.photo.files[0]?photoPreview.pending:preparePhoto(fields.photo.files[0]));
        }else if(picture==='avatar')data.photo=null;
        if(captured===revision)await mutate(data,'Profile saved.',{full:true});
      }else if(form.matches('[data-item-create]')){
        const fields=form.elements,sharing=fields.audience.value==='friends',recipients=sharing?selected(form):[];
        if(sharing&&!recipients.length)throw Error('Choose at least one friend or select Only me.');
        if(route==='#members/catch-map'&&!point)throw Error('Choose a spot on the map before saving.');
        const data={action:'create',id:form.dataset.itemId,title:fields.title.value.trim(),message:fields.message.value.trim(),recipients,duration:fields.duration?.value||'week'};
        if(fields.catchId.value)data.catchId=fields.catchId.value;
        if(point&&route==='#members/catch-map')data.pin={latitude:point.lat,longitude:point.lon,label:fields.pinLabel.value.trim(),...(pointStyle?{style:pointStyle}:{})};
        if(fields.photo.files[0])data.photo=await preparePhoto(fields.photo.files[0]);
        if(captured===revision)await mutate(data,sharing?'Shared with the friends you selected.':'Saved privately.',{full:true});
      }else if(form.matches('[data-edit-pin-style]')){
        await mutate({action:'pinStyle',id:form.dataset.editPinStyle,version:Number(form.dataset.version),style:form.elements.style.value},'Pin symbol saved.');
      }else if(form.matches('[data-grant],[data-renew]')){
        const item=desk.mine.find(i=>i.id===form.closest('[data-owned]').dataset.owned),recipients=form.hasAttribute('data-renew')?[form.dataset.renew]:selected(form);
        if(!recipients.length)throw Error('Choose at least one friend to share with.');
        if(item)await mutate({action:'grant',id:item.id,version:item.version,recipients,duration:form.elements.duration.value},'Sharing access updated.');
      }
    }catch(error){if(captured===revision)status(error.message,true);}
    finally{if(button?.isConnected)button.disabled=false;}
  }
  for(const pane of panes){
    pane.addEventListener('toggle',e=>{if(e.target.matches('[data-compose]')&&desk)enterComposer(e.target);},true);
    pane.addEventListener('submit',e=>{e.preventDefault();submit(e.target);});
    pane.addEventListener('input',e=>{
      if(point&&['latitude','longitude'].includes(e.target.name)){
        point=null;editMap?.setValue(null);
        e.target.form.querySelector('[data-pin-status]').textContent='Choose Use these coordinates to place the new pin.';
      }
    });
    pane.addEventListener('change',e=>{
      const field=e.target,form=field.form;if(!form)return;
      if(field.name==='avatarId')form.elements.picture.value='avatar';
      if(field.name==='avatarId'||field.name==='picture'||field.name==='photo'&&form.matches('[data-profile-form]')){
        form.querySelector('[data-upload-label]').hidden=form.elements.picture.value!=='upload';
        const image=form.querySelector('.net-current-face img'),choice=form.elements.picture.value;
        photoPreview=null;
        delete image.dataset.angler;
        if(choice==='upload'&&form.elements.photo.files[0]){
          const file=form.elements.photo.files[0],pending=preparePhoto(file);photoPreview={file,pending};
          pending.then(source=>{if(photoPreview?.pending===pending&&image.isConnected)image.src=source;})
            .catch(error=>{if(photoPreview?.pending===pending)status(error.message,true);});
        }else if(choice==='keep'&&desk.profile.photoUrl)image.src=desk.profile.photoUrl;
        else{image.dataset.angler=form.elements.avatarId.value;image.src=avatarUrl(image.dataset.angler);}
      }
      if(field.name==='audience'){
        const sharing=field.value==='friends';form.querySelector('[data-select-friends]').hidden=!sharing;
        form.querySelector('[data-save-item]').textContent=sharing?'Share with selected friends':'Save privately';
      }
    });
    pane.addEventListener('click',e=>{
      const b=e.target.closest('button,a');if(!b||!current())return;
      if(b.hasAttribute('data-network-retry')){refresh({initial:true});return;}
      if(b.hasAttribute('data-network-refresh')){refresh({manual:true});return;}
      if(b.hasAttribute('data-network-earlier')){earlier(b.dataset.networkEarlier,b);return;}
      if(b.hasAttribute('data-earlier-journal-pins')){readJournalPins(true);return;}
      if(!desk||writer)return;
      if(b.hasAttribute('data-use-gps')){useDevice(b.form,b);return;}
      if(b.hasAttribute('data-clear-pin')){pickPoint(b.form,null);return;}
      if(b.hasAttribute('data-use-coordinates')){
        const {latitude,longitude}=b.form.elements,lat=latitude.valueAsNumber,lon=longitude.valueAsNumber;
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){
          b.form.querySelector('[data-pin-status]').textContent='Enter both coordinates. Latitude is between −90 and 90, and longitude between −180 and 180.';return;
        }
        pickPoint(b.form,{lat,lon});return;
      }
      if(b.hasAttribute('data-avatar-motion')){updateAvatarMotion(pane,true);return;}
      if(b.hasAttribute('data-find-pin')){focusPin=b.dataset.findPin;watchedPin=focusPin;return;}
      if(b.hasAttribute('data-map-focus')){viewMap?.focusPin?.(b.dataset.mapFocus);return;}
      if(b.dataset.peerAction){
        const action=b.dataset.peerAction,id=b.dataset.peer,connection=desk.connections.find(c=>c.peer.id===id),person=connection?.peer||people.find(p=>p.id===id);
        if(!person)return;
        if(['remove','block'].includes(action)&&connection?.state==='friend'&&!window.confirm((action==='block'?'Block ':'Remove ')+person.displayName+' and end your private sharing with each other?'))return;
        mutate({action,peerId:id,version:connection?.version??person.version??0},{accept:'Friend request accepted.',request:'Friend request sent.',remove:'Connection updated.',block:'Member blocked.',unblock:'Member unblocked.'}[action]);return;
      }
      if(b.hasAttribute('data-stop-person')||b.hasAttribute('data-stop-all')){
        const item=desk.mine.find(i=>i.id===b.closest('[data-owned]').dataset.owned);if(!item)return;
        const peerId=b.dataset.stopPerson;
        if(!peerId&&!window.confirm('Stop every friend’s access to this item?'))return;
        mutate({action:'revoke',id:item.id,version:item.version,...(peerId?{peerId}:{})},'Access stopped.');
      }
    });
  }
  if('BroadcastChannel' in window){channel=new BroadcastChannel('plfc-member-sharing-refresh');channel.onmessage=()=>{if(current()&&!document.hidden)refresh();};}
  window.addEventListener('plfc:navigated',navigate);
  window.addEventListener('plfc:journal-changed',()=>readJournalPins());
  window.addEventListener('plfc:session-changed',e=>{reset();focusPin='';watchedPin='';permissions=null;session=e.detail;navigate();});
  window.addEventListener('plfc:safeguards',e=>{
    const next={socialAccess:e.detail?.socialAccess===true,canUseJournal:e.detail?.canUseJournal===true};
    if(permissions?.socialAccess===next.socialAccess && permissions?.canUseJournal===next.canUseJournal)return;
    permissions=next;
    if(!current())return;
    reset();focusPin='';watchedPin='';navigate();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current()){hideReceived();refresh();}});
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{if(mount)updateAvatarMotion(mount);});
  window.addEventListener('pagehide',()=>{reset();focusPin='';watchedPin='';});
  window.addEventListener('pageshow',e=>{if(e.persisted)navigate();});
}
