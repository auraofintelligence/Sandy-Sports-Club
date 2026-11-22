const officerPath='/api/committee/returning-members';
const memberPath='/api/member/returning-members';
const byId=id=>document.getElementById(id);
const labels={proposed:'With the Treasurer',approved:'Ready for the member',activation:'Password setup pending',granted:'Membership granted',cancelled:'Cancelled'};
const targets={account:'Clubhouse account',application:'Approved membership application',paper:'Paper membership record'};
const format=new Intl.DateTimeFormat('en-AU',{dateStyle:'long',timeZone:'Australia/Brisbane'});
export const clubDate=value=>value&&Number.isFinite(Date.parse(value))?format.format(new Date(value)):'';
const fallback='<p class="secondary">Speak to the Secretary or Assistant Secretary if you need help.</p>';
const check=(name,message)=>'<label class="return-check"><input type="checkbox" name="'+name+'" required><span>'+message+'</span></label>';
const post=(api,path,data)=>api(path,{method:'POST',body:JSON.stringify(data)});
const deskTitle='<h1 class="page-title">Welcome-back memberships</h1>';
const optIn=()=>check('confirm','Yes, I would like to accept my complimentary 12-month membership.');
const termText='Current members keep the time they have already paid for. The extra year follows their current membership. For a lapsed membership, the year starts when it becomes active again.';

export function setupReturningMembers({api,esc}){
  let session=null,host=null,controller=null,desk=null,matches=[],selected=null,query='',offerFilter='',requestedId='';
  let searchVersion=0,changedVersion=0;
  function clear(){
    controller?.abort();changedVersion++;searchVersion++;host?.replaceChildren();
    host=null;desk=null;matches=[];selected=null;query='';offerFilter='';requestedId='';
  }
  function status(message){const p=host?.querySelector('[data-return-status]');if(p)p.textContent=message;}
  function proposal(target){
    return '<form class="return-form" data-return-propose><h3>'+ (target.targetType==='paper'?'Use a paper membership record':'Check the previous membership')+'</h3>'+
      (target.targetType==='paper'?'<label>Name in the membership register<input name="label" maxlength="100" required autocomplete="off"></label>':'<p><strong>'+esc(target.label)+'</strong><br>'+esc(targets[target.targetType])+'</p>')+
      '<label>Membership number or register reference<input name="reference" maxlength="100" required aria-describedby="return-ref-help"></label><small id="return-ref-help">Use the same reference each time for this member, for example the year and row in the original register. Keep contact details out of this field.</small>'+
      check('checked','I matched this person to their previous membership in the club register.')+
      '<div class="button-row"><button class="button" type="submit">Send to the Treasurer</button><button class="button outline small" type="button" data-return-back>Back to search</button></div></form>';
  }
  function finding(){
    return '<section class="panel"><h2>Find a returning member</h2><p>Start with their clubhouse username or the name on an approved membership application.</p>'+
      '<form class="return-find" data-return-find><label>Username or name<input type="search" name="query" minlength="2" maxlength="80" autocomplete="off" required value="'+esc(query)+'"></label><button type="submit" class="button">Find member</button></form>'+
      '<div data-return-matches></div><button type="button" class="text-link" data-return-paper>Use a paper membership record</button><div data-return-proposal></div></section>';
  }
  function showMatches(){
    const found=host?.querySelector('[data-return-matches]');if(!found)return;
    found.innerHTML=matches.length?'<p>Choose the matching record.</p><ul class="return-choices">'+matches.map((t,i)=>'<li><button class="button outline" type="button" data-return-choose="'+i+'"><strong>'+esc(t.label)+'</strong><small>'+esc(targets[t.targetType])+(t.paidThrough?' · Member through '+esc(clubDate(t.paidThrough)):'')+'</small></button></li>').join('')+'</ul>':query?'<p>No matching online record. Check the spelling, or use the paper membership record below.</p>':'';
  }
  function pick(target){
    selected=target;requestedId=crypto.randomUUID();const root=host.querySelector('[data-return-proposal]');
    root.innerHTML=proposal(target);root.querySelector('input').focus();
  }
  function card(o){
    const key=' data-return-id="'+esc(o.id)+'"';
    const approve=desk.canApprove&&o.status==='proposed'?'<form data-return-approve class="return-form"><p>The club will cover one full membership year. Record the waiver here once you have checked this offer.</p>'+check('confirm','I approve this complimentary 12-month membership as Treasurer.')+'<button class="button">Approve fee waiver</button></form>':'';
    const link=desk.canIssue&&['approved','activation'].includes(o.status)?'<button type="button" class="button" data-return-link>Get private invitation</button>':'';
    const cancel=desk.canIssue&&['proposed','approved'].includes(o.status)?'<details class="return-cancel"><summary>Cancel this offer</summary><form data-return-cancel>'+check('confirm','I want to cancel this offer and close its invitation.')+'<button type="submit" class="button outline small">Confirm cancellation</button></form></details>':'';
    const waiting=o.targetType==='paper'&&['pending','followup','declined'].includes(o.applicationStatus);
    const next=waiting?'<p>'+(o.applicationStatus==='declined'?'The membership application was declined. Speak to the applicant about the outcome.':'The member has returned their details. Open the admission record to check them.')+' <a href="#committee/applications">Membership applications</a></p>':o.status==='approved'&&desk.canIssue?'<p>Pass the invitation directly to the member or their guardian. They decide whether to accept.</p>':'';
    return '<li class="return-offer"'+key+'><h3>'+esc(o.label)+'</h3><p><strong>'+esc(waiting&&o.status==='approved'?'Admission review':labels[o.status]||o.status)+'</strong> · '+esc(targets[o.targetType])+'</p>'+next+
      (o.status==='activation'?'<p>The member has accepted. They can finish setting up their own password using the private invitation.</p>':'')+
      (o.status==='granted'&&o.paidThrough?'<p>Member through '+esc(clubDate(o.paidThrough))+'.</p>':'')+
      approve+link+'<div data-return-handover></div>'+cancel+'</li>';
  }
  function offerList(){
    const current=desk.offers.filter(o=>!['granted','cancelled'].includes(o.status));
    const history=desk.offers.filter(o=>['granted','cancelled'].includes(o.status));
    const offers=list=>'<ul class="return-offers">'+list.map(card).join('')+'</ul>';
    return '<div class="return-head"><h2>'+(desk.canApprove?'Offers for the Treasurer':'Offers in progress')+'</h2><button class="text-link" type="button" data-return-refresh>Refresh list</button></div>'+
      (offerFilter||desk.nextOffers||desk.offers.length>5?'<form class="return-find" data-return-filter><label>Find an existing offer<input type="search" name="query" maxlength="80" value="'+esc(offerFilter)+'"></label><button class="button outline">Find offers</button>'+(offerFilter?'<button type="button" class="text-link" data-clear-return-filter>Show all</button>':'')+'</form>':'')+
      (current.length?offers(current):'<p>'+ (offerFilter?'No matching offers in progress.':desk.canApprove?'There are no welcome-back offers awaiting action.':'There are no offers in progress.')+'</p>')+
      (history.length?'<details data-return-history'+(offerFilter?' open':'')+'><summary>Completed and cancelled offers ('+history.length+')</summary>'+offers(history)+'</details>':'')+
      (desk.nextOffers?'<button class="button outline small" type="button" data-return-more>Show more offers</button>':'');
  }
  function showDesk(message=''){
    const report=host.querySelector('[data-waiver-report]');const panel=document.createElement('div');
    panel.innerHTML=deskTitle+'<p class="page-intro">Offer a previous member one year with the club, free of charge.</p>'+
      (desk.canIssue?finding():'')+'<section class="panel" data-return-list>'+offerList()+'</section>'+
      '<details class="return-help"><summary>How the year is granted</summary><ol><li>The Secretary or Assistant Secretary matches the former member to the club register.</li><li>The Treasurer approves the fee waiver.</li><li>The member accepts privately. An applicant completes the usual admission and password setup.</li></ol><p>'+termText+'</p></details>'+
      '<p role="status" data-return-status></p>';
    host.replaceChildren(...panel.childNodes);if(report)host.append(report);
    showMatches();if(selected)pick(selected);status(message);
  }
  function handover(card,token){
    const url=new URL('/returning-membership.html',location.origin);url.hash=token;
    const panel=card.querySelector('[data-return-handover]');
    panel.innerHTML='<div class="return-handover"><h4>Pass this link to the member</h4><p>Check who you are speaking with. Copy the link and give it to the member or guardian in a private message or in person. One invitation belongs to one membership.</p><label>Private invitation<input readonly data-return-url></label><button type="button" class="button outline small" data-return-copy>Copy private link</button><button class="text-link" type="button" data-return-hide>Hide link</button><p role="status"></p></div>';
    panel.querySelector('input').value=url.href;panel.querySelector('[data-return-copy]').focus();
  }
  async function refreshDesk(message,signal,append=false){
    const version=++changedVersion;const params=new URLSearchParams();
    if(offerFilter)params.set('q',offerFilter);if(append&&desk?.nextOffers)params.set('before',desk.nextOffers);
    const next=await api(officerPath+(params.size?'?'+params:''),{signal});
    if(signal.aborted||version!==changedVersion)return;
    if(append){const ids=new Set(desk.offers.map(o=>o.id));next.offers=[...desk.offers,...next.offers.filter(o=>!ids.has(o.id))];}
    if(session?.readOnly||session?.showcase||session?.demo){next.canApprove=false;next.canIssue=false;}
    desk=next;
    const list=host.querySelector('[data-return-list]');
    if(list){const opened=Boolean(list.querySelector('[data-return-history][open]'));list.innerHTML=offerList();if(opened)list.querySelector('[data-return-history]')?.setAttribute('open','');status(message);}
    else showDesk(message);
  }
  function bindDesk(signal){
    host.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b||b.closest('[data-waiver-report]'))return;const card=b.closest('[data-return-id]');
      try{
        if(b.matches('[data-return-choose]'))pick(matches[Number(b.dataset.returnChoose)]);
        if(b.matches('[data-return-paper]'))pick({targetType:'paper'});
        if(b.matches('[data-return-back]')){selected=null;host.querySelector('[data-return-proposal]').replaceChildren();host.querySelector('[data-return-find] input').focus();}
        if(b.matches('[data-return-refresh]'))await refreshDesk('List refreshed.',signal);
        if(b.matches('[data-return-more]')){b.disabled=true;await refreshDesk('More offers loaded.',signal,true);}
        if(b.matches('[data-clear-return-filter]')){offerFilter='';await refreshDesk('Showing all offers.',signal);}
        if(b.matches('[data-return-link]')){b.disabled=true;const offer=desk.offers.find(o=>o.id===card.dataset.returnId);
          const result=await post(api,officerPath,{action:'link',id:offer.id,version:offer.version});
          if(!signal.aborted&&card.isConnected)handover(card,result.token);}
        if(b.matches('[data-return-hide]')){card.querySelector('[data-return-handover]').replaceChildren();card.querySelector('[data-return-link]').focus();}
        if(b.matches('[data-return-copy]')){const input=card.querySelector('[data-return-url]'),note=card.querySelector('.return-handover [role=status]');
          try{await navigator.clipboard.writeText(input.value);note.textContent='Link copied. Paste it into a private message for this member.';}
          catch{input.focus();input.select();note.textContent='The link is selected. Use Copy on your device.';}}
      }catch(err){if(!signal.aborted)status(err.message);}finally{if(b.isConnected)b.disabled=false;}
    },{signal});
    host.addEventListener('submit',async e=>{
      const f=e.target;if(!f.matches('[data-return-find],[data-return-filter],[data-return-propose],[data-return-approve],[data-return-cancel]'))return;
      e.preventDefault();const b=e.submitter||f.querySelector('button'),fields=f.elements;if(!b)return;
      b.disabled=true;
      try{
        if(f.matches('[data-return-find]')){
          const rev=++searchVersion;query=fields.query.value.trim();selected=null;matches=[];host.querySelector('[data-return-proposal]').replaceChildren();host.querySelector('[data-return-matches]').replaceChildren();
          status('Looking up club records…');const result=await api(officerPath+'?q='+encodeURIComponent(query),{signal});
          if(!signal.aborted&&rev===searchVersion){matches=result.matches;showMatches();status(matches.length+' matching '+(matches.length===1?'record.':'records.'));}return;
        }
        if(f.matches('[data-return-filter]')){offerFilter=fields.query.value.trim();await refreshDesk('Offer list updated.',signal);return;}
        let body,message;
        if(f.matches('[data-return-propose]')&&selected){
          body={action:'propose',id:requestedId,targetType:selected.targetType,registerRef:fields.reference.value.trim(),registerChecked:fields.checked.checked};
          if(selected.targetType==='paper')body.label=fields.label.value.trim();else body.targetId=selected.targetId;
          message='Offer sent to the Treasurer for approval.';
        }else{const offer=desk.offers.find(o=>o.id===f.closest('[data-return-id]')?.dataset.returnId);if(!offer||!fields.confirm?.checked)return;
          const approval=f.matches('[data-return-approve]');if(!approval&&!f.matches('[data-return-cancel]'))return;
          body={action:approval?'approve':'cancel',id:offer.id,version:offer.version};message=approval?'Fee waiver approved. The Secretary can now pass the invitation to the member.':'Offer cancelled.';}
        await post(api,officerPath,body);if(signal.aborted)return;
        if(f.matches('[data-return-propose]')){selected=null;query='';matches=[];host.querySelector('[data-return-proposal]').replaceChildren();host.querySelector('[data-return-find]').reset();showMatches();}
        await refreshDesk(message,signal);
        if(!signal.aborted&&body.action==='approve'){
          const report=host.querySelector('[data-waiver-report]');
          if(report?.querySelector('.report-sheet'))report.querySelector('form')?.requestSubmit();
        }
      }catch(err){if(!signal.aborted)status(err.message);}finally{if(b.isConnected)b.disabled=false;}
    },{signal});
  }
  async function members(signal){
    const data=await api(memberPath,{signal});if(signal.aborted)return;
    const pending=data.offers.filter(o=>o.status==='approved');const granted=data.offers.find(o=>o.status==='granted');
    if(!pending.length&&!granted){host.replaceChildren();return;}
    host.innerHTML='<section class="panel"><h2>Your welcome-back membership</h2>'+
      (pending.length?'<p>The club has offered you 12 months of membership free of charge. '+termText+'</p>'+pending.map(o=>'<form class="return-form" data-return-accept="'+esc(o.id)+'">'+optIn()+'<button class="button">Accept my welcome-back offer</button></form>').join(''):'<p>The club has granted your complimentary year. You are a member through <strong>'+esc(clubDate(granted.paidThrough))+'</strong>.</p>')+
      '<p role="status" data-return-status></p></section>';
    host.onsubmit=async e=>{
      e.preventDefault();const f=e.target,o=pending.find(v=>v.id===f.dataset.returnAccept);if(!o||!f.elements.confirm.checked)return;
      const b=f.querySelector('button');b.disabled=true;
      try{const result=await post(api,memberPath,{action:'accept',id:o.id,version:o.version,confirm:true});if(signal.aborted)return;
        host.innerHTML='<section class="panel"><h2>Welcome back!</h2><p>Your club membership runs through <strong>'+esc(clubDate(result.offer.paidThrough))+'</strong>.</p><button class="button" type="button" data-return-home>Open member home</button></section>';
        host.querySelector('button').onclick=()=>{location.hash='members';location.reload();};
      }catch(err){if(!signal.aborted)status(err.message);}finally{if(b.isConnected)b.disabled=false;}
    };
    signal.addEventListener('abort',()=>{if(host)host.onsubmit=null;},{once:true});
  }
  async function open(){
    clear();if(!session?.authenticated||!session.storageReady)return;
    const hash=location.hash;const officer=hash==='#committee/returning'||hash==='#stock/returning';
    if(officer){if(session.role!=='committee')return;host=byId(hash.startsWith('#stock')?'stock-returning':'committee-returning');}
    else if(session.accountRole==='member'&&hash.startsWith('#members')&&(session.role==='signed_in'||hash==='#members/membership'))host=byId(session.role==='signed_in'?'lapsed-returning':'member-returning');
    if(!host)return;controller=new AbortController();const {signal}=controller;
    if(officer)host.innerHTML=deskTitle+'<p role="status">Opening the membership register…</p>';
    try{if(officer){bindDesk(signal);await refreshDesk('',signal);}else await members(signal);}
    catch(err){if(!signal.aborted&&host)host.innerHTML=(officer?deskTitle:'')+'<p role="status">'+esc(err.message)+'</p>'+fallback;}
    if(!signal.aborted&&hash==='#stock/returning'&&session?.canManageStock&&host){
      const report=document.createElement('section');report.dataset.waiverReport='';host.append(report);
      try{const {setupWaiverReport}=await import('./returning-waiver-report.js');if(!signal.aborted)setupWaiverReport({host:report,api,esc,signal});}
      catch{if(!signal.aborted)report.textContent='The fee waiver report could not load. Reopen the Treasurer’s desk to try again.';}
    }
  }
  window.addEventListener('plfc:session-changed',e=>{session=e.detail;open();});window.addEventListener('plfc:navigated',open);
  window.addEventListener('pagehide',clear);window.addEventListener('pageshow',e=>{if(e.persisted)open();});
}
