const memberPath='/api/member/safeguards',officerPath='/api/committee/safeguards';
const names={unconfirmed:'Awaiting the club’s check',under16:'Under 16','16+':'16 and over'};
const terms='<a href="/clubhouse-terms.html" target="_blank" rel="noopener">Read the clubhouse terms and etiquette</a>';
const exportPanel='<section class="panel"><h3>Keep a copy of my contributions</h3><p>Save your club posts, shared items and photos in one download. You can do this before or after withdrawing your sharing agreement.</p><a href="/my-club-download.html" class="button outline">Download my contributions and photos</a></section>';
const dates=value=>value?new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'Australia/Brisbane'}).format(new Date(value)):'';
export function setupSafeguards({api,esc}){
  const member=document.getElementById('member-safeguards'),officer=document.getElementById('committee-safeguards');
  let session=null,me=null,selected=null,request=0,search=0,account='',busy=false;
  const updates='BroadcastChannel' in window ? new BroadcastChannel('sandy-member-permission-updates') : null;
  const signed=()=>session?.authenticated&&session.storageReady;
  const isOfficer=()=>signed()&&session.role==='committee';
  const atDesk=()=>isOfficer()&&location.hash==='#committee/safety';
  const publish=detail=>window.dispatchEvent(new CustomEvent('plfc:safeguards',{detail}));
  function memberPage(){
    if(!signed()){member.replaceChildren();return;}
    if(isOfficer()){member.innerHTML='<h2>My access and safety</h2><p>You are viewing the clubhouse as an officer. Individual member permissions are in <a href="#committee/safety">Member age and permissions</a>.</p>'+terms;return;}
    if(!me){member.innerHTML='<h2>My access and safety</h2><p role="status">Checking your member settings…</p>';return;}
    const verified=me.ageBand==='16+',young=me.ageBand==='under16';
    const detail=verified?'You decide whether to use the club conversation, share with friends or take part in eligible activities.':
      young?'Your calendar, newsletters, minutes and club updates are here. '+(me.guardianPermission?'Guardian permission for private profile features has been checked.':'Ask a parent or carer to speak with an officer if you would like a private profile.'):
      'You can see club dates, minutes, newsletters and results now. Ask the Secretary or another officer to confirm your age group in person or using the contact details already held by the club.';
    const action=verified?'<section class="panel"><h3>Optional social sharing</h3><p>'+ (me.accepted?'You have accepted this edition of the terms.':'Read the terms, then tick the box if you want to take part.')+'</p>'+
      (me.accepted?'<p>Withdrawing closes your social access and existing friend shares. You can still read club information.</p><button type="button" class="button outline" data-withdraw>Withdraw my agreement</button>':
      '<form data-accept class="stack-form"><label class="apply-check"><input type="checkbox" required><span>I have read the clubhouse terms and agree to follow the etiquette and sharing rules.</span></label><button class="button">Accept and enable sharing</button></form>')+'</section>':
      me.accepted?'<section class="panel"><h3>My previous agreement</h3><p>Your current age setting keeps social sharing closed. You can also withdraw your earlier agreement.</p><button class="button outline" type="button" data-withdraw>Withdraw my agreement</button></section>':'';
    member.innerHTML='<h2>My access and safety</h2><div class="panel"><p class="eyebrow">MY AGE GROUP</p><h3>'+esc(names[me.ageBand]||names.unconfirmed)+'</h3><p>'+detail+'</p><p><a href="#members/calendar">Events calendar</a> · <a href="#members/news">Newsletters</a> · <a href="#members/leaderboard">Club results</a></p></div>'+
      '<section class="panel"><h3>Clubhouse terms and etiquette</h3><p>Ask before posting a photo. Keep photos and locations within the audience you promised. Tell a trusted officer if anything feels wrong.</p>'+terms+'</section>'+exportPanel+action+'<p role="status" data-result></p>';
  }
  async function refresh(){
    const token=++request;
    if(!signed()||isOfficer()){me=null;publish({socialAccess:Boolean(isOfficer()),canUseJournal:Boolean(isOfficer())});memberPage();return;}
    try{
      const next=await api(memberPath);
      if(token!==request)return;
      const changed=!me||JSON.stringify(next)!==JSON.stringify(me);
      me=next;if(changed){publish(me);memberPage();}
    }catch(error){if(token!==request)return;me=null;publish({socialAccess:false,canUseJournal:false});member.innerHTML='<h2>My access and safety</h2><p role="alert">'+esc(error.message)+'</p><button class="button outline" type="button" data-retry>Try again</button>';}
  }
  async function agreement(action){
    if(!me||busy||session?.readOnly||session?.showcase||session?.demo)return;
    busy=true;const identity=account;const buttons=member.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{await api(memberPath,{method:'POST',body:JSON.stringify({action,version:me.version,termsVersion:me.termsVersion})});updates?.postMessage('refresh');if(identity!==account)return;await refresh();const status=member.querySelector('[data-result]');if(status)status.textContent=action==='accept'?'Your sharing access is open.':'Your agreement has been withdrawn.';}
    catch(error){if(identity===account){await refresh();const status=member.querySelector('[data-result]');if(status)status.textContent=error.message;}}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);}
  }
  member.addEventListener('click',e=>{
    if(e.target.closest('[data-retry]'))refresh();
    if(e.target.closest('[data-withdraw]')&&confirm('Withdraw your agreement and close your friend shares?'))agreement('withdraw');
  });
  member.addEventListener('submit',e=>{if(e.target.matches('[data-accept]')){e.preventDefault();agreement('accept');}});
  function desk(){
    selected=null;search++;officer.replaceChildren();if(!atDesk())return;
    officer.innerHTML='<h1>Member age and permissions</h1><p>Check one member at a time. Confirm their age group in person or using the contact details the club already holds. Keep identity documents and birth dates out of this form.</p>'+
      '<form data-find class="panel stack-form"><label>Club username<input name="query" required minlength="2" maxlength="80" autocomplete="off"></label><button class="button">Find member</button></form><p role="status" data-message></p><div data-matches></div><div data-edit></div>';
  }
  let matches=[];
  function showRecord(m){
    selected=m;const area=officer.querySelector('[data-edit]');
    area.innerHTML='<form class="panel stack-form" data-verify><h2>'+esc(m.login)+'</h2><p>Age group recorded as '+esc(names[m.ageBand]||names.unconfirmed)+'.'+(m.verifiedAt?' Last reviewed '+esc(dates(m.verifiedAt))+'.':'')+'</p>'+
      '<label>Age group<select name="band">'+Object.entries(names).map(([key,label])=>'<option value="'+key+'"'+(key===m.ageBand?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
      '<label class="apply-check" data-proof><input type="checkbox" name="checked"><span>I have independently checked this age group using club records or a conversation with the member or guardian.</span></label>'+
      '<fieldset data-guardian><legend>Private profile features</legend><label class="apply-check"><input name="permission" type="checkbox"'+(m.guardianPermission?' checked':'')+'><span>The parent or legal guardian permits this under-16 member to use these private tools.</span></label><label class="apply-check" data-proof-guardian><input name="guardianChecked" type="checkbox"><span>I confirmed the guardian’s authority and this specific permission directly with them.</span></label></fieldset>'+
      '<p>Leaving permission unticked removes it. Under-16s can still read club information. Changing an account to under 16 or awaiting a check closes its social access.</p><button class="button"'+(session?.readOnly||session?.showcase||session?.demo?' disabled':'')+'>Save this decision</button></form>';
    syncFields();
  }
  function syncFields(){
    const f=officer.querySelector('[data-verify]');if(!f)return;const age=f.elements.band.value;
    const young=age==='under16',check=age!=='unconfirmed'&&age!==selected?.ageBand,guardian=young&&f.elements.permission.checked&&!selected?.guardianPermission;
    f.querySelector('[data-guardian]').hidden=!young;f.querySelector('[data-proof]').hidden=!check;f.elements.checked.required=check;
    f.querySelector('[data-proof-guardian]').hidden=!guardian;f.elements.guardianChecked.required=guardian;
  }
  officer.addEventListener('change',syncFields);
  officer.addEventListener('click',e=>{const b=e.target.closest('[data-member-index]');if(b&&atDesk())showRecord(matches[Number(b.dataset.memberIndex)]);});
  officer.addEventListener('submit',async e=>{
    const f=e.target;if(!atDesk())return;e.preventDefault();const message=officer.querySelector('[data-message]'),button=f.querySelector('button');button.disabled=true;
    const token=++search;
    try{
      if(f.matches('[data-find]')){
        selected=null;matches=[];officer.querySelector('[data-edit]').replaceChildren();officer.querySelector('[data-matches]').replaceChildren();message.textContent='Looking up members…';
        const result=await api(officerPath+'?q='+encodeURIComponent(f.elements.query.value.trim()));
        if(token!==search||!atDesk())return;matches=result.members;message.textContent=matches.length?'Choose the member you have checked.':'No member matched. Check the username with them.';
        officer.querySelector('[data-matches]').innerHTML=matches.map((m,i)=>'<button type="button" class="button outline small" data-member-index="'+i+'">'+esc(m.login)+'</button>').join(' ');
      }else if(f.matches('[data-verify]')&&selected){
        if(session?.readOnly||session?.showcase||session?.demo){message.textContent='This office view is read only.';return;}
        const band=f.elements.band.value;const guardian=band==='under16'&&f.elements.permission.checked;
        const saved=await api(officerPath,{method:'POST',body:JSON.stringify({action:'verify',accountId:selected.accountId,version:selected.version,ageBand:band,guardianPermission:guardian,ageCheckedOffline:band!=='unconfirmed'&&f.elements.checked.checked,guardianCheckedOffline:guardian&&f.elements.guardianChecked.checked})});
        updates?.postMessage('refresh');if(token!==search||!atDesk())return;matches=matches.map(m=>m.accountId===saved.member.accountId?saved.member:m);showRecord(saved.member);message.textContent='Decision recorded for '+saved.member.login+'.';
      }
    }catch(error){if(token===search&&atDesk())message.textContent=error.message;}
    finally{button.disabled=false;}
  });
  window.addEventListener('plfc:session-changed',e=>{
    request++;search++;session=e.detail;account=session?.identity?.id||'';me=null;matches=[];
    publish({socialAccess:false,canEnterHonours:false,canUseJournal:false});
    memberPage();desk();refresh();
  });
  window.addEventListener('plfc:navigated',()=>{desk();if(location.hash==='#members/safety'&&signed())refresh();});
  if(updates)updates.onmessage=()=>{
    if(!signed()||isOfficer())return;
    me=null;publish({socialAccess:false,canEnterHonours:false,canUseJournal:false});memberPage();refresh();
  };
  window.addEventListener('pagehide',()=>{
    request++;search++;me=null;selected=null;matches=[];member.replaceChildren();officer.replaceChildren();
    publish({socialAccess:false,canEnterHonours:false,canUseJournal:false});
  });
  window.addEventListener('pageshow',e=>{if(e.persisted){desk();refresh();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&signed())refresh();});
  setInterval(()=>{if(!document.hidden&&signed()&&!isOfficer()&&location.hash.startsWith('#members'))refresh();},60000);
}
