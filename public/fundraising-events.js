import {eventTypes} from './event-templates.js';
import {setupEventMemberNotice} from './event-member-notice.js';

const endpoint='/api/committee/events';
const formatDay=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const currency=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'});
const day=value=>value?formatDay.format(new Date(value.length===10?value+'T12:00:00+10:00':value)):'Date to agree';
const officeNames={president:'President',vicepresident:'Vice President',secretary:'Secretary',assistantsecretary:'Assistant Secretary',treasurer:'Treasurer'};
const named=who=>officeNames[who]||who;
const money=value=>value==null?'Awaiting figures':currency.format(value/100);
const fundraisers=new Set(['bbq','raffle','fundraiser']);

export function setupFundraisingEvents({api,esc}){
  const mount=document.getElementById('fundraising-events');
  if(!mount)return;
  let session,desk,selection='',screen='list',controller,requestKey,createId,newType='local',dirty=false,printSheet,previousTitle='';
  const active=()=>session?.authenticated&&session.role==='committee'&&location.hash==='#committee/events';
  const readOnly=()=>Boolean(session?.readOnly || session?.showcase || session?.demo);
  const el=selector=>mount.querySelector(selector);
  const current=()=>desk?.events.find(event=>event.id===selection);
  const template=type=>Object.hasOwn(eventTypes,type)?eventTypes[type]:null;

  function clear(){
    controller?.abort();controller=null;requestKey=null;
    desk=null;selection='';screen='list';createId=null;dirty=false;clearPrint();mount.inert=false;mount.replaceChildren();
  }
  function say(text,error=false){
    const node=el('[data-event-status]');if(node){node.setAttribute('role',error?'alert':'status');node.textContent=text;}
  }
  function focusHeading(){el('[data-event-heading]')?.focus();}
  function section(title,rows,empty){
    return '<section class="event-group"><h2>'+title+'</h2>'+(rows.length?'<ul class="event-list">'+rows.join('')+'</ul>':'<p>'+empty+'</p>')+'</section>';
  }
  function summaryRow(event){
    const unfinished=event.jobs.filter(job=>!job.doneAt),available=unfinished.filter(job=>!job.ownerKind).length;
    return '<li><div><button type="button" class="event-open" data-event-open="'+esc(event.id)+'">'+esc(event.title)+'</button><p>'+
      esc([template(event.type)?.label,day(event.date),event.location].filter(Boolean).join(' · '))+'</p></div><span>'+
      (event.status==='closed'?'Closed':!unfinished.length?'All jobs done':available===0?'Every open job has a volunteer':available+' '+(available===1?'job needs':'jobs need')+' a volunteer')+'</span></li>';
  }
  function list(){
    const plans=desk.events,open=plans.filter(event=>event.status!=='closed'),closed=plans.filter(event=>event.status==='closed');
    return '<header class="event-heading"><div><h1 data-event-heading tabindex="-1">Events and fundraising</h1><p>Plan a local meet or fundraiser together. Each officer can take a job or record a helper who has agreed.</p></div>'+
      '<div class="event-tools"><button class="button" type="button" data-event-new>Start an event</button>'+
      (!open.length?'<button class="button outline small" type="button" data-event-start-type="bbq">Plan a BBQ</button><button class="button outline small" type="button" data-event-start-type="raffle">Plan a raffle</button>':'')+'</div></header>'+
      section('Open event plans',open.map(summaryRow),'Start an event to choose a checklist and see which jobs need a volunteer.')+
      (closed.length?'<details class="event-box"><summary>Closed event plans ('+closed.length+')</summary><ul class="event-list">'+closed.map(summaryRow).join('')+'</ul></details>':'');
  }
  function resources(type){
    const links=template(type)?.links||[];
    return '<details class="event-box event-help"><summary>Check the requirements</summary>'+
      (links.length?'<p>Open the official guidance for this activity before confirming arrangements.</p><ul>'+
      links.map(link=>'<li><a href="'+esc(link.url)+'" target="_blank" rel="noopener noreferrer">'+esc(link.label)+'</a></li>').join('')+'</ul>':'')+
      '<p>If the club wants outside help coordinating volunteers, the committee can separately consider <a href="#committee/handoffs">ready SET Co-op authorisation</a>.</p></details>';
  }
  function preview(type){
    const preset=template(type);if(!preset)return '';
    return '<details class="event-box"><summary>See the starter jobs ('+preset.tasks.length+')</summary><ul>'+preset.tasks.map(job=>'<li>'+esc(job.title)+'</li>').join('')+'</ul></details>'+resources(type);
  }
  function fields(event){
    return '<label>Event name<input name="title" required maxlength="140" value="'+esc(event.title||'')+'" placeholder="For example, a mixed beach volleyball day"></label>'+
      '<label>What do we want to achieve?<textarea name="goal" rows="2" maxlength="500" placeholder="For example, raise money for shared court equipment">'+esc(event.goal||'')+'</textarea></label>'+
      '<div class="event-pair"><label>Date, if known<input type="date" name="date" value="'+esc(event.date||'')+'"></label>'+
      '<label>Meeting place, if known<input name="location" maxlength="240" value="'+esc(event.location||'')+'" placeholder="Where people should meet"></label></div>'+
      '<label>Committee notes (optional)<textarea name="notes" rows="3" maxlength="4000">'+esc(event.notes||'')+'</textarea></label>';
  }
  function editor(event){
    const creating=!event,type=event?.type||newType;
    return '<button class="text-link" data-event-back type="button">'+(creating?'Back to event plans':'Back to this event')+'</button>'+
      '<h1 data-event-heading tabindex="-1">'+(creating?'Start an event':'Edit event details')+'</h1>'+
      (creating?'<p>Choose the kind of event. Its jobs will start unclaimed, including the organiser’s job.</p>':'')+
      '<form class="event-form" '+(creating?'data-event-create':'data-event-edit-form')+'>'+
      (creating?'<label>Kind of event<select name="type">'+Object.entries(eventTypes).map(([key,info])=>'<option value="'+esc(key)+'"'+(key===type?' selected':'')+'>'+esc(info.label)+'</option>').join('')+'</select></label>':'')+
      fields(event||{})+(creating?'<div data-event-template>'+preview(type)+'</div>':'')+
      '<button class="button" type="submit">'+(creating?'Create committee plan':'Save event details')+'</button></form>';
  }
  function jobRow(job,open){
    const done=Boolean(job.doneAt),owner=job.ownerName?esc(named(job.ownerName)):'';
    let buttons='';
    if(open&&!done&&!job.ownerKind){
      buttons='<div class="event-job-actions"><button class="button outline small" data-event-action="claim" type="button">I’ll do this</button>'+
        '<details><summary>A helper offered</summary><form data-event-helper class="event-form"><label>Helper’s name<input name="helperName" required autocomplete="off"></label>'+
        '<label class="event-check"><input type="checkbox" name="agreed" required>They agreed to do this job.</label>'+
        '<button class="button outline small" type="submit">Record helper</button></form></details></div>';
    }else if(open&&job.canManage){
      buttons=done?'<button type="button" class="text-link" data-event-action="reopen">Reopen job</button>':
        '<div class="event-job-actions"><button type="button" class="button outline small" data-event-action="done">Mark done</button><button type="button" class="text-link" data-event-action="release">Hand back job</button></div>';
    }
    return '<li data-event-job="'+esc(job.key)+'"><h3>'+esc(job.title)+'</h3><p class="event-owner">'+
      (done?'Done · '+(owner||esc(named(job.doneBy))):owner?(job.ownerKind==='helper'?'Confirmed helper · ':'Taken by ')+owner:'Needs a volunteer')+'</p>'+
      (job.detail?'<details class="event-job-guide"><summary>What to do</summary><p>'+esc(job.detail)+'</p></details>':'')+buttons+'</li>';
  }
  function finances(event){
    const recorded=event.takingsCents!=null;
    return '<details class="event-box" data-event-money><summary>Money'+(recorded?' · net '+esc(money(event.netCents)):'')+'</summary>'+
      (recorded?'<dl class="event-amounts">'+[['Takings',event.takingsCents],['Costs',event.expensesCents],['Net raised',event.netCents]].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(money(value))+'</dd></div>').join('')+'</dl>':
      '<p>The Treasurer can record what came in and what the event cost. The club works out the difference.</p>')+
      (event.moneyRecordedAt?'<p class="event-meta">Updated '+esc(day(event.moneyRecordedAt))+(event.moneyRecordedBy?' by '+esc(named(event.moneyRecordedBy)):'')+'.</p>':'')+
      (desk.canRecordMoney?'<form class="event-form" data-event-money-form><div class="event-pair">'+[['takings','Total takings',event.takingsCents],['expenses','Total costs',event.expensesCents]].map(([name,label,value])=>'<label>'+label+' (AUD)<input type="text" inputmode="decimal" name="'+name+'" required value="'+(value==null?'':(value/100).toFixed(2))+'" placeholder="0.00"></label>').join('')+
       '</div><button class="button outline small" type="submit">'+(recorded?'Update figures':'Save figures')+'</button></form>':'')+'</details>';
  }
  function detail(event){
    const open=event.status!=='closed',unfinished=event.jobs.filter(j=>!j.doneAt),done=event.jobs.filter(j=>j.doneAt);
    const sorted=[...unfinished.filter(j=>!j.ownerKind),...unfinished.filter(j=>j.ownerKind)];
    const kind=template(event.type)?.label||'Event';
    return '<button class="text-link" data-event-back type="button">Back to event plans</button>'+
      '<header class="event-heading"><div><h1 data-event-heading tabindex="-1">'+esc(event.title)+'</h1><p>'+esc([kind,day(event.date),event.location].filter(Boolean).join(' · '))+'</p>'+
      (event.goal?'<p><strong>Aim</strong> · '+esc(event.goal)+'</p>':'')+'</div>'+
      '<div class="event-tools"><button class="button outline small" type="button" data-event-print>Print event jobs</button>'+
      (open?'<button class="text-link" type="button" data-event-edit>Edit event details</button>':'')+'</div></header>'+
      (event.notes?'<details class="event-box"><summary>Committee notes</summary><p class="event-notes">'+esc(event.notes)+'</p></details>':'')+
      (!open?'<p class="event-closed">Closed '+esc(day(event.closedAt))+(event.closeNote?' · '+esc(event.closeNote):'')+'</p>':'')+
      '<details class="event-box" data-event-member-notice><summary>Member calendar notice</summary><div data-notice-content></div><p data-notice-status role="status"></p></details>'+
      '<section class="event-group"><h2>'+(open?'Open jobs':'Unfinished jobs')+'</h2>'+(sorted.length?'<ul class="event-jobs">'+sorted.map(j=>jobRow(j,open)).join('')+'</ul>':'<p>All jobs are complete.</p>')+'</section>'+
      (open?'<details class="event-box" data-event-extra><summary>Add a job or shift</summary><form class="event-form" data-event-add-job>'+
        '<label>Job or shift<input name="title" maxlength="140" required placeholder="For example, BBQ shift 10 am to 11 am"></label>'+
        '<label>Instructions (optional)<textarea name="detail" rows="2" maxlength="1000"></textarea></label>'+
        '<button type="submit" class="button outline small">Add unclaimed job</button></form></details>':'')+
      (done.length?'<details class="event-box" data-event-finished><summary>Completed jobs ('+done.length+')</summary><ul class="event-jobs">'+done.map(j=>jobRow(j,open)).join('')+'</ul></details>':'')+
      (fundraisers.has(event.type)?finances(event)+resources(event.type):resources(event.type)+finances(event))+
      (open?'<details class="event-box"><summary>Close this event plan</summary><form data-event-close class="event-form"><p>Closing keeps the jobs and figures for the next committee. If the event is cancelled, withdraw its member calendar notice.</p>'+
        '<label>Handover note (optional)<textarea name="closeNote" rows="2" maxlength="1000"></textarea></label><button type="submit" class="button outline small">Close event plan</button></form></details>':
        '<button type="button" class="button outline small" data-event-action="reopenEvent">Reopen event plan</button>');
  }
  function clearPrint(){
    if(printSheet&&document.title===printSheet.dataset.title)document.title=previousTitle;
    printSheet?.remove();printSheet=null;document.body.classList.remove('printing-event-jobs');
  }
  function prepareCrewSheet(event){
    clearPrint();
    const sheet=document.createElement('article');sheet.id='event-jobs-print';
    const artwork=edge=>'<img class="crew-letterhead" alt="" src="/assets/sandy-original-logo.png">';
    sheet.innerHTML=artwork('top')+'<h1>'+esc(event.title)+'</h1><p><strong>Event jobs</strong> · '+esc([day(event.date),event.location].filter(Boolean).join(' · '))+'</p>'+
      '<table><thead><tr><th scope="col">Job</th><th scope="col">Who is doing it?</th><th scope="col">Done</th></tr></thead><tbody>'+
      event.jobs.map(job=>'<tr><td>'+esc(job.title)+'</td><td>'+esc(job.ownerName?(job.ownerKind==='helper'?'Helper · ':'')+named(job.ownerName):'Needs a volunteer')+'</td><td>'+
        (job.doneAt?'Done':'<span class="crew-tick" aria-label="Tick when done"></span>')+'</td></tr>').join('')+'</tbody></table>'+
      '<h2>Notes to take back to the committee</h2><div class="crew-line"></div><div class="crew-line"></div>'+artwork('foot');
    previousTitle=document.title;document.title=sheet.dataset.title='Sandy Sports event jobs - '+event.title;
    printSheet=sheet;document.body.append(sheet);document.body.classList.add('printing-event-jobs');
    return sheet;
  }
  async function printJobs(event){
    const sheet=prepareCrewSheet(event);
    await Promise.allSettled(Array.from(sheet.querySelectorAll('img'),img=>img.decode()));
    if(printSheet!==sheet||!active())return;
    try{window.print();}catch{clearPrint();say('The print window could not open. Try Print event jobs again.',true);}
  }
  function render(){
    const event=current();
    if(!desk||!active())return;
    const body=screen==='new'?editor(null):screen==='edit'&&event?editor(event):screen==='detail'&&event?detail(event):list();
    mount.innerHTML=body+'<p role="status" tabindex="-1" data-event-status></p>';
    if(screen==='detail'&&event)setupEventMemberNotice(el('[data-event-member-notice]'),event.id,{api,esc});
  }
  async function load(){
    if(!active()){clear();return;}
    controller?.abort();const entry=new AbortController();controller=entry;
    mount.innerHTML='<p role="status">Opening event plans…</p>';
    try{
      const data=await api(endpoint,{cache:'no-store',signal:entry.signal});
      if(controller!==entry||!active())return;
      desk=data;render();
    }catch(error){if(controller===entry&&active())mount.innerHTML='<p role="alert">'+esc(error.message)+'</p><button class="text-link" type="button" data-event-retry>Try again</button>';}
    finally{if(controller===entry)controller=null;}
  }
  async function save(payload,success){
    if(controller||!active()||readOnly())return;
    const key=JSON.stringify(payload);
    if(requestKey?.key!==key)requestKey={key,id:crypto.randomUUID()};
    const entry=new AbortController();controller=entry;mount.inert=true;
    try{
      const data=await api(endpoint,{method:'POST',body:JSON.stringify({...payload,mutationId:requestKey.id}),signal:entry.signal});
      if(controller!==entry||!active())return;
      desk=data;selection=payload.id;screen='detail';requestKey=null;createId=null;dirty=false;
      render();say(success);
      const row=payload.key&&Array.from(mount.querySelectorAll('[data-event-job]')).find(r=>r.dataset.eventJob===payload.key);
      if(row&&!row.closest('details:not([open])')){row.tabIndex=-1;row.focus();}else focusHeading();
      if(payload.action==='money')el('[data-event-money]').open=true;
    }catch(error){
      if(controller!==entry||!active())return;
      say(error.message,true);
      const notice=el('[data-event-status]');
      if(error.status===409)notice.insertAdjacentHTML('beforeend',' <button type="button" class="text-link" data-event-retry>Load saved plan</button>');
      notice.scrollIntoView({block:'nearest'});
    }finally{if(controller===entry){controller=null;mount.inert=false;}}
  }
  mount.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||!active()||controller)return;
    if(button.hasAttribute('data-event-retry')){if(dirty&&!window.confirm('Load the saved plan and leave your unsaved edits?'))return;dirty=false;load();return;}
    if(!readOnly()&&(button.hasAttribute('data-event-new')||button.hasAttribute('data-event-start-type'))){
      newType=button.dataset.eventStartType||'local';selection='';screen='new';createId=crypto.randomUUID();render();focusHeading();return;
    }
    if(button.hasAttribute('data-event-open')){selection=button.dataset.eventOpen;screen='detail';render();focusHeading();return;}
    if(button.hasAttribute('data-event-back')){if(dirty&&!window.confirm('Leave these unsaved event details?'))return;dirty=false;screen=screen==='edit'?'detail':'list';createId=null;requestKey=null;render();focusHeading();return;}
    if(button.hasAttribute('data-event-edit')&&!readOnly()){screen='edit';render();focusHeading();return;}
    if(button.hasAttribute('data-event-print')&&current()){printJobs(current());return;}
    const event=current(),action=button.dataset.eventAction;if(!action||!event)return;
    if(action==='reopenEvent'){save({id:event.id,action,version:event.version},'Event plan reopened.');return;}
    const job=event.jobs.find(j=>j.key===button.closest('[data-event-job]')?.dataset.eventJob);
    if(job)save({id:event.id,key:job.key,action,version:job.version},{claim:'You have taken this job.',release:'Job returned to the open list.',done:'Job marked done.',reopen:'Job reopened.'}[action]);
  });
  mount.addEventListener('change',e=>{
    if(e.target.matches('[data-event-create] [name=type]'))el('[data-event-template]').innerHTML=preview(e.target.value);
  });
  mount.addEventListener('submit',e=>{
    e.preventDefault();if(controller||!active()||readOnly())return;
    const form=e.target,data=Object.fromEntries(new FormData(form)),event=current();
    if(form.matches('[data-event-create]')){save({...data,id:createId,action:'create'},'Plan created. Officers can now take jobs.');return;}
    if(!event)return;
    const base={id:event.id,version:event.version};
    if(form.matches('[data-event-edit-form]')){save({...base,...data,action:'edit'},'Event details saved.');return;}
    if(form.matches('[data-event-add-job]')){save({...base,...data,action:'addJob'},'Job added. A volunteer can now take it.');return;}
    if(form.matches('[data-event-close]')){save({...base,action:'close',closeNote:data.closeNote},'Event plan closed.');return;}
    if(form.matches('[data-event-helper]')){
      const job=event.jobs.find(j=>j.key===form.closest('[data-event-job]').dataset.eventJob);
      if(job)save({id:event.id,key:job.key,version:job.version,action:'helper',helperName:data.helperName,agreed:form.elements.agreed.checked},'Confirmed helper recorded.');
    }else if(form.matches('[data-event-money-form]')){
      const cents=value=>{
        const parts=/^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
        if(!parts)return null;
        const amount=Number(parts[1]+(parts[2]||'').padEnd(2,'0'));
        return Number.isSafeInteger(amount)?amount:null;
      };
      const takingsCents=cents(data.takings),expensesCents=cents(data.expenses);
      if(takingsCents===null||expensesCents===null){
        const input=form.elements[takingsCents===null?'takings':'expenses'];input.setCustomValidity('Enter a dollar amount such as 24.50, or 0.');input.reportValidity();return;
      }
      save({...base,action:'money',takingsCents,expensesCents},'Event figures saved.');
    }
  });
  mount.addEventListener('input',e=>{
    if(e.target.closest('[data-event-create],[data-event-edit-form]'))dirty=true;
    if(e.target.matches('[data-event-money-form] input'))e.target.setCustomValidity('');
  });
  window.addEventListener('afterprint',clearPrint);
  window.addEventListener('beforeprint',()=>{
    if(active()&&screen==='detail'&&current()&&!printSheet)prepareCrewSheet(current());
  });
  window.addEventListener('plfc:open-event-sheet',e=>{
    const id=e.detail?.id;if(!active()||typeof id!=='string')return;
    selection=id;screen='detail';dirty=false;
    if(desk&&current()){render();focusHeading();}else if(!controller)load();
  });
  window.addEventListener('plfc:navigated',()=>{if(!active())clear();else if(!desk&&!controller)load();});
  window.addEventListener('plfc:session-changed',e=>{clear();session=e.detail;mount.toggleAttribute('data-read-only',readOnly());if(active())load();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',e=>{if(e.persisted&&active())load();});
}
