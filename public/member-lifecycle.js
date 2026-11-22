const types={adult:'Adult',cadet:'Cadet',junior:'Junior',social:'Social',casual:'Casual',lifetime:'Lifetime',unconfirmed:'Awaiting confirmation'};
const pack={prepare:'To prepare',ready:'Prepared',posted:'Posted',collected:'Collected'};

const kinds={general:'General club update',meeting:'Meeting invitation',competition:'Competition or workshop',working_bee:'Working bee'};
const paths={members:'/api/member/lifecycle',committee:'/api/committee/lifecycle'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
const date=value=>value?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(value.slice(0,10)+'T00:00:00Z')):'Awaiting confirmation';
const offer=g=>g.kind==='percent'?g.value+'% off':money(g.value)+' off';
const check=(name,label,on=false,extra='')=>'<label class="life-check"><input type="checkbox" name="'+name+'" '+(on?'checked ':'')+extra+'>'+esc(label)+'</label>';
const opts=(labels,selected='')=>Object.entries(labels).map(([value,label])=>'<option value="'+esc(value)+'" '+(value===selected?'selected':'')+'>'+esc(label)+'</option>').join('');
const field=(name,label,input)=>'<label>'+esc(label)+'<input name="'+name+'" '+input+'></label>';
const select=(name,label,options)=>'<label>'+esc(label)+'<select name="'+name+'" required>'+options+'</select></label>';
const button=label=>'<button class="button small" type="submit">'+esc(label)+'</button>';
const details=(title,body,opened=false)=>'<details '+(opened?'open':'')+'><summary>'+esc(title)+'</summary>'+body+'</details>';
const form=(action,content,label)=>'<form data-life-action="'+action+'">'+content+button(label)+'<p role="status"></p></form>';
const fact=(label,value)=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>';
function dateOptions(count,selected,month=false){
  return Array.from({length:count},(_,i)=>{
    const value=String(i+1).padStart(2,'0');
    const label=month?new Intl.DateTimeFormat('en-AU',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2000,i,1))):String(i+1);
    return '<option value="'+value+'" '+(value===selected?'selected':'')+'>'+label+'</option>';
  }).join('');
}
function noticesMarkup(rows) {
  if(!rows.length)return '<p>You’re all caught up.</p>';
  const message=n=>['calendar_event','minutes_release'].includes(n.kind)?n.body.replace(/\b\d{4}-\d{2}-\d{2}\b/g,day=>date(day)):n.body;
  return '<div class="life-notices">'+rows.map(n=>'<article class="life-notice"><time datetime="'+esc(n.day)+'">'+date(n.day)+'</time><h4>'+(n.important?'<span class="cn-important">Important</span> ':'')+esc(n.title)+'</h4><p>'+esc(message(n))+'</p>'+
    (n.kind==='calendar_event'?'<p><a href="#members/calendar">Open the member calendar</a></p>':'')+
    (n.kind==='minutes_release'?'<p><a href="#members/minutes">Read the member minutes</a></p>':'')+
    (n.kind==='newsletter'?'<p><a href="#members/news">Open the newsletter archive</a></p>':'')+
    (n.kind==='working_bee'?'<p><a href="#members/help-out">Offer to help with this activity</a></p>':'')+
    (n.readAt?'<small>Read</small>':'<button type="button" class="text-link" data-life-read="'+esc(n.id)+'">Mark as read</button>')+'</article>').join('')+'</div>';
}
function memberMarkup(data,lapsed) {
  const p=data.profile;
  if(!p)return '<p>Private membership messages appear here for individual member accounts.</p>';
  const parts=p.birthday?.split('-')||['',''];
  const guardian=['junior','cadet'].includes(p.type),readOnly=guardian?' readonly':'';
  const birthday=check('birthdayEnabled','Send me a private birthday greeting and any approved club offer.',!!p.birthday)+
    '<div data-birthday-fields class="life-pair" '+(p.birthday?'':'hidden')+'>'+select('month','Birthday month','<option value="">Choose month</option>'+dateOptions(12,parts[0],true))+
    select('day','Birthday day','<option value="">Choose day</option>'+dateOptions(31,parts[1]))+'</div><small>Only your day and month are stored. Your birthday stays private.</small>';
  const prefs=form('preferences','<fieldset><legend>What would you like to hear about?</legend>'+
    check('generalNotices','General club updates',p.generalNotices)+check('newsletters','Monthly club newsletter',p.newsletters??['adult','cadet'].includes(p.type))+check('meetings','Meeting invitations and minutes',p.meetings)+
    check('competitions','Sports, competitions and workshops',p.competitions)+check('workingBees','Fundraisers and working bees',p.workingBees)+'</fieldset>'+
    '<fieldset><legend>Your birthday</legend>'+birthday+'</fieldset>'+
    '<fieldset><legend>Where should notices go?</legend><p>Club notices appear in this inbox. Tick email below to add a copy to the committee’s email queue. You can choose important email alerts and the weekly roundup in your profile.</p>'+
    (guardian?'<p>Email uses the guardian address on your application. Ask the committee to correct those details.</p>':'')+
    check('emailEnabled','Also prepare email for me',p.emailEnabled)+field('email',guardian?'Guardian email':'Contact email','type="email" maxlength="200" autocomplete="email" value="'+esc(p.email)+'"'+readOnly)+
    field('mobile',guardian?'Guardian contact phone':'Contact phone (optional)','type="tel" maxlength="20" autocomplete="tel" value="'+esc(p.mobile)+'"'+readOnly)+'</fieldset>','Save my choices');
  const gifts=data.gifts.map(g=>'<div class="life-card"><h4>'+esc(offer(g))+'</h4><p>'+esc(g.terms)+'</p><p>Valid through '+date(g.validUntil)+'.</p>'+
    (g.redeemedAt?'<strong>Already used</strong>':'<p>Show the treasurer this code when buying an eligible item.</p><strong>'+esc(g.code)+'</strong>')+'</div>').join('');
  return '<h3>'+(lapsed?'Your renewal inbox':'Your club inbox')+'</h3>'+(lapsed?'<p>The Treasurer can confirm a renewal or approve a welcome-back fee waiver. If the club has offered you a free year, you can review it here.</p>':
    '<dl class="life-facts">'+fact('Member number',p.number??'Register being checked')+fact('Membership',types[p.type])+fact('Member pack',pack[p.packStage])+'</dl>')+
    details('My messages ('+data.unread+' unread)',noticesMarkup(data.notices),true)+
    (!lapsed?details('My birthday offers',gifts||'<p>No current offer. If you opt in, any committee-approved birthday discount will appear here on your birthday.</p>'):'')+
    details('Choose my notices and birthday preferences',prefs);
}
function publicationForm(data){
  return form('publish',select('kind','What are you sending?',opts(kinds))+select('audience','Who is this for?',opts({all:'All eligible members',...types}))+
    field('title','Subject','maxlength="120" required')+'<label>Message<textarea name="message" rows="4" maxlength="1800" required></textarea></label>'+
    check('important','Mark as important for members who choose important emails.')+
    check('approved','I checked the wording and audience. Publish to member inboxes.',false,'required'),'Publish to member inboxes')+
    (data.bulletins.length?'<h4>Recent notices</h4><ul>'+data.bulletins.map(b=>'<li>'+date(b.day)+' · '+esc(b.title)+' · '+esc(b.audience==='all'?'All eligible members':types[b.audience])+'</li>').join('')+'</ul>':'');
}

function committeeMarkup(data,session){
  const s=data.settings, members=Object.fromEntries(data.members.map(m=>[m.id,m.login+' · '+types[m.type]+(m.number?' · #'+m.number:'')]));
  const memberSelect=()=>select('accountId','Choose a member','<option value="">Choose a member</option>'+opts(members));
  const pending=data.members.filter(m=>['prepare','ready'].includes(m.packStage));
  const packCard=m=>{
    const action=(next,label)=>'<button type="button" class="button outline small" data-life-pack="'+esc(m.id)+'" data-next="'+next+'">'+label+'</button>';
    const how=m.packMethod==='collect'?'Collection requested.':m.packMethod==='post'?'Post to the address on the application.':'Confirm postage or collection with the member.';
    const actions=m.packStage==='prepare'?action('ready','I have prepared this pack'):
      (m.packMethod!=='collect'?action('posted','I have posted this pack'):'')+(m.packMethod!=='post'?action('collected','The member collected this pack'):'');
    return '<div class="life-card"><strong>'+esc(m.login)+'</strong><p>'+esc(pack[m.packStage])+'. '+how+'</p><div class="button-row">'+actions+'</div></div>';
  };
  const enableNumbers=s.numberStart?'<p>Number allocation is active. The checked register is '+esc(s.numberReference)+'. Vacant numbers return to the register after cancellation or three months after expiry.</p>':
    '<p>Numbers are on hold until the Webmaster agrees the starting number and records a checked register reference. No Sandy members have been enrolled yet.</p>'+
    (session.administrator?form('existing-number',memberSelect()+field('number','Existing membership number','type="number" min="1" max="99999999" required'),'Link checked number')+
    form('enable-numbers',field('start','First unused number','type="number" min="1" max="99900000" required')+field('reference','Register or minute checked','maxlength="180" required')+
    check('checked','I reconciled the existing club register and checked the first unused number.',false,'required'),'Start allocating numbers'):'');
  const offerStatus=s.offerKind?'<p>Current birthday offer <strong>'+esc(offer({kind:s.offerKind,value:s.offerValue}))+'</strong>. '+esc(s.offerTerms)+' Valid for '+s.offerDays+' day(s). Approval '+esc(s.offerReference)+'.</p>':'<p>Birthday discounts are awaiting committee approval. Members who opt in can already receive a private greeting.</p>';
  const configure=session.administrator?form('offer',select('kind','Approved discount type',opts({percent:'Percentage off',fixed:'Australian dollars off'}))+
    field('amount','Approved amount','type="number" min="0.01" step="0.01" required')+field('days','Usable for this many days','type="number" min="1" max="365" required')+
    field('terms','Eligible items, conditions and redemption instructions','maxlength="500" required')+field('reference','Committee minute or resolution approving this offer','maxlength="180" required')+
    check('approved','The committee approved these terms and the birthday consent wording.',false,'required'),'Activate approved offer')+
    (s.offerKind?form('pause-offer',check('checked','Pause new birthday offers. Already issued codes keep their terms.',false,'required'),'Pause new offers'):''):'';
  const redeem=session.canManageStock?details('Check a birthday code',form('lookup-gift',field('code','Member’s offer code','maxlength="16" pattern="[A-Fa-f0-9]{16}" autocapitalize="characters" required')+
    field('amount','Eligible purchase total in Australian dollars','type="number" min="0.01" max="1000000" step="0.01" required'),'Check code and price')+'<div data-gift-review></div>'):'';
  const planned=data.newsletter?.publishedBy?'A newsletter has been published this month.':'This month’s newsletter is ready for the committee to prepare.';
  const delivery=data.queue.filter(q=>q.channel==='email').map(q=>'Email ('+q.pending+')').join('')||'No email waiting.';
  return '<h3>Membership desk</h3><p>Prepare member packs, approve notices and check what the clubhouse has done automatically.</p>'+
    details('Prepare and hand over member packs ('+pending.length+')',pending.length?'<div class="life-stack">'+pending.map(packCard).join('')+'</div>':'<p>All member packs are up to date.</p>')+
    details('Membership types and numbers',form('member-type',memberSelect()+select('type','Verified membership type',opts(types)),'Save membership type')+enableNumbers)+
    '<p>'+planned+' <a href="#committee/news">Open the newsletter desk</a></p>'+ 
    details('Send a club notice',publicationForm(data))+
    details('Birthday offer approvals',offerStatus+configure)+redeem+
    details('Email waiting for delivery','<p>'+esc(delivery)+'</p><p>These messages await delivery. Save the private list, then open the CSV in Excel to review the intended contacts. Exporting leaves the messages in the queue.</p>'+
    '<button type="button" class="button outline small" data-life-export>Save private delivery list</button>')+
    details('How membership reminders work','<p>Joining creates a private welcome and a pack task. Members who opt in get a private birthday greeting on the day. The Secretary and Assistant Secretary share one monthly birthday check at the <a href="#committee/news">newsletter desk</a>.</p><p>Renewal reminders start 30 and 7 days before expiry, then continue for up to three months after expiry. Renewing closes the previous reminder cycle.</p>'+
    '<p>These reminders and greetings use the current member register and preferences. The committee can review the delivery queue above.</p>');
}

function downloadQueue(rows){
  const columns=['login','day','channel','destination','title','body'];
  const safe=value=>{
    let cell=String(value??'');
    if(/^[\t\r\n]|^\s*[=+@-]/.test(cell))cell="'"+cell;
    return '"'+cell.replaceAll('"','""')+'"';
  };
  const csv=[columns.join(','),...rows.map(row=>columns.map(key=>safe(row[key])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='Sandy-Sports-Club-private-delivery-queue.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}

let started=false;
export function setupMemberLifecycle(){
  if(started)return;started=true;
  let page=location.hash.slice(1),session,version=0,host=null,data=null,path=null;
  const alert=document.getElementById('member-notice-alert');
  const inInbox=()=>location.hash==='#members/notices';
  let badgeRequest=0,shownCount;
  function showCount(count){
    if(count===shownCount)return;
    shownCount=count;
    alert.hidden=!(count>0);
    alert.firstElementChild.textContent=count>0?'Read '+count+' new club '+(count===1?'notice':'notices'):'';
  }
  async function refreshBadge(){
    if(document.hidden || page!=='members' || session?.role!=='member')return;
    const ticket=version, sequence=++badgeRequest;
    try{
      const response=await fetch(paths.members+'?summary=1',{cache:'no-store'});
      if(ticket!==version || sequence!==badgeRequest)return;
      if(!response.ok){if([401,403].includes(response.status))showCount(0);return;}
      const result=await response.json();
      if(ticket!==version || sequence!==badgeRequest)return;
      if(inInbox() && host && data && result.unread!==data.unread){await enter();return;}
      showCount(result.unread);
    }catch{/* Keep the last count until the next connection. */}
  }
  async function request(body){
    const response=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    let result;
    try{result=await response.json();}catch{throw Error('The clubhouse connection is unavailable. Please try again.');}
    if(!response.ok)throw Error(result.error?.message||result.error||'Please refresh the page and try again.');
    return result;
  }
  function birthdayFields(f){
    const visible=f.elements.birthdayEnabled.checked;
    f.querySelector('[data-birthday-fields]').hidden=!visible;
    f.elements.day.disabled=!visible;f.elements.month.disabled=!visible;
  }
  function paint(message=''){
    const open=Array.from(host.querySelectorAll('details[open]')).map(d=>d.querySelector('summary')?.textContent);
    const previewOnly=session.demo||session.readOnly;
    host.innerHTML='<div class="member-life"><p data-life-status role="status"></p>'+(previewOnly?'<p>Preview only. Membership changes, notices and birthday offers cannot be issued here.</p>':'')+(page==='committee'?(location.hash==='#committee/member-notice'?publicationForm(data):committeeMarkup(data,session)):inInbox()?noticesMarkup(data.notices):memberMarkup(data,session.role==='signed_in'))+'</div>';
    if(page==='members' && session.role==='member'){badgeRequest++;showCount(data.unread);}
    host.querySelector('[data-life-status]').textContent=message;
    for(const d of host.querySelectorAll('details'))if(open.includes(d.querySelector('summary').textContent))d.open=true;
    const preferences=host.querySelector('[data-life-action="preferences"]');if(preferences)birthdayFields(preferences);
    if(previewOnly)host.querySelectorAll('form input,form select,form textarea,form button,[data-life-pack],[data-life-read],[data-life-export]').forEach(control=>{control.disabled=true;});
  }
  async function enter(){
    const ticket=++version;
    if(host){host.replaceChildren();host.onclick=null;host.onchange=null;host.onsubmit=null;}
    host=null;data=null;path=null;
    if(!session?.authenticated || !Object.hasOwn(paths,page) || ['#committee/notices','#committee/news','#committee/handover','#committee/todos','#members/news'].includes(location.hash))return;
    if(page==='committee' && session.role!=='committee')return;
    const target=page==='committee'?(location.hash==='#committee/member-notice'?'member-publication-form':'committee-automations'):session.role==='signed_in'?'member-renewal-inbox':inInbox()?'member-notice-inbox':'member-benefits';
    host=document.getElementById(target);if(!host)return;
    path=paths[page];
    host.innerHTML='<p role="status">Opening your membership desk…</p>';
    try{
      const result=await request();
      if(ticket!==version)return;data=result;paint();
      host.onclick=click;host.onsubmit=submit;host.onchange=e=>{if(e.target.name==='birthdayEnabled')birthdayFields(e.target.form);};
    }catch(error){if(ticket===version){host.replaceChildren();const note=document.createElement('p');note.textContent=error.message;host.append(note);const retry=document.createElement('button');retry.type='button';retry.className='text-link';retry.textContent='Try opening again';retry.onclick=enter;host.append(retry);}}
  }
  async function save(body,control,done,success,failure){
    const ticket=version;control.disabled=true;
    const report=failure||host.querySelector('[data-life-status]');
    try{
      const result=await request(body);if(ticket!==version)return;
      if(done)done(result);else{data=result;paint(success);}
    }catch(error){if(ticket===version){report.textContent=error.message;report.scrollIntoView({block:'nearest'});}}
    finally{if(control.isConnected)control.disabled=false;}
  }
  function click(e){
    if(session?.demo||session?.readOnly)return;
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-life-read'))save({action:'read',id:b.dataset.lifeRead},b,null,'Message marked as read.');
    if(b.hasAttribute('data-life-pack'))save({action:'pack',accountId:b.dataset.lifePack,stage:b.dataset.next},b,null,'Pack updated. The member has a new message.');
    if(b.hasAttribute('data-life-export'))save({action:'queue'},b,result=>{
      if(result.rows.length)downloadQueue(result.rows);
      host.querySelector('[data-life-status]').textContent=result.rows.length?'Private list downloaded. Open it in Excel to review the contacts.':'There are no messages in the delivery queue.';
    });
  }
  function submit(e){
    const f=e.target.closest('form[data-life-action]');if(!f)return;e.preventDefault();
    if(session?.demo||session?.readOnly)return;
    const action=f.dataset.lifeAction,fields=f.elements,val=name=>fields.namedItem(name).value,checked=name=>fields.namedItem(name).checked;
    const payload={action},info=f.querySelector('[role=status]'),control=f.querySelector('[type=submit]');
    let success='Changes saved.',done;
    if(action==='preferences'){
      Object.assign(payload,{revision:data.profile.revision,birthdayEnabled:checked('birthdayEnabled'),birthday:val('month')+'-'+val('day'),email:val('email'),mobile:val('mobile')});
      for(const key of ['emailEnabled','generalNotices','newsletters','meetings','competitions','workingBees'])payload[key]=checked(key);
      success='Your private notice choices are saved.';
    }else if(action==='member-type')Object.assign(payload,{accountId:val('accountId'),type:val('type')});
    else if(action==='existing-number')Object.assign(payload,{accountId:val('accountId'),number:Number(val('number'))});
    else if(action==='enable-numbers')Object.assign(payload,{checked:checked('checked'),start:Number(val('start')),reference:val('reference')});
    else if(action==='offer')Object.assign(payload,{kind:val('kind'),value:val('kind')==='percent'?Number(val('amount')):Math.round(Number(val('amount'))*100),terms:val('terms'),days:Number(val('days')),reference:val('reference'),approved:checked('approved')});
    else if(action==='publish'){
      f.dataset.requestId ||= crypto.randomUUID();
      Object.assign(payload,{id:f.dataset.requestId,kind:val('kind'),audience:val('audience'),title:val('title'),message:val('message'),important:checked('important'),approved:checked('approved')});
      success='Notice published to eligible member inboxes.';
    }else if(action==='lookup-gift'){
      Object.assign(payload,{code:val('code').trim().toUpperCase(),cents:Math.round(Number(val('amount'))*100)});
      const review=host.querySelector('[data-gift-review]');review.replaceChildren();
      done=result=>{
        const g=result.gift;
        review.innerHTML='<div class="life-card"><h4>Review this purchase</h4><p>'+esc(offer(g))+' · '+esc(g.terms)+'</p><p>Purchase '+money(g.purchaseCents)+'. Discount '+money(g.discountCents)+'. The member pays <strong>'+money(g.purchaseCents-g.discountCents)+'</strong>.</p>'+
          form('redeem',check('checked','The purchase meets these terms and I collected the discounted amount.',false,'required'),'Record code as used')+'</div>';
        const redeem=review.querySelector('form');redeem.dataset.code=payload.code;redeem.dataset.cents=String(payload.cents);
      };
    }else if(action==='redeem'){
      Object.assign(payload,{code:f.dataset.code,cents:Number(f.dataset.cents),checked:checked('checked')});
      done=result=>{host.querySelector('[data-gift-review]').textContent='Code recorded as used. Discount '+money(result.gift.discountCents)+'.';};
    }
    info.textContent='';
    save(payload,control,done,success,info);
  }
  setInterval(refreshBadge,60000);
  document.addEventListener('visibilitychange',refreshBadge);
  window.addEventListener('focus',refreshBadge);
  window.addEventListener('plfc:session-changed',e=>{session=e.detail;showCount(0);enter();});
  window.addEventListener('plfc:navigated',e=>{page=e.detail.page;enter();if(page==='members' && location.hash==='#members/news')refreshBadge();});
}
