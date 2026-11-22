import {regularDuties} from './officer-duties.js?v=20261121-fundraising';

const endpoint='/api/committee/todos';
const dayFormat=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',year:'numeric'});
const fullDate=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',weekday:'long',day:'numeric',month:'long',year:'numeric'});
const date=(day,format=dayFormat)=>day ? format.format(new Date(day+'T12:00:00+10:00')) : 'No due date';
export function todoTiming(task,today) {
  const dateLabel=task.dueDate?date(task.dueDate):'';
  if(task.source==='event')return {light:'neutral',label:dateLabel?'Event day':'Event date to agree',dateLabel};
  if(!dateLabel)return {light:'neutral',label:'No due date',dateLabel};
  const days=(Date.parse(task.dueDate+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000;
  if(days<0)return {light:'red',label:'Overdue',dateLabel};
  if(days<=7)return {light:'amber',label:days===0?'Due today':'Due soon',dateLabel};
  return {light:'green',label:'On track',dateLabel};
}
const taskKey=t=>JSON.stringify([t.source,t.meetingId||'',t.id]);
const routes=new Set(['#committee/meetings','#committee/news','#committee','#stock','#committee/automations','#committee/agm','#committee/access']);
const letterhead={
  top:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2085 430"><rect width="2085" height="430" fill="#143454"/><rect y="400" width="2085" height="30" fill="#dbaa50"/><text x="94" y="220" fill="white" font-family="Arial,sans-serif" font-size="110" font-weight="700">SANDY SPORTS CLUB</text><text x="100" y="310" fill="#e9f3f8" font-family="Arial,sans-serif" font-size="48">Minjerribah / North Stradbroke Island</text></svg>',
  foot:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2085 140"><rect width="2085" height="9" fill="#dbaa50"/><text x="90" y="90" fill="#143454" font-family="Arial,sans-serif" font-size="47" font-weight="700">Sandy Sports Club</text><text x="1100" y="90" fill="#143454" font-family="Arial,sans-serif" font-size="39">Committee work list</text></svg>'
};
function art(which){
  const img=tag('img');img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(letterhead[which]);img.width=2085;img.height=which==='top'?430:140;
  img.className='officer-letter-'+which;img.alt=which==='top'?'Sandy Sports Club':'Sandy Sports Club committee work list';
  return img;
}

function tag(name,content,cls) {
  const el=document.createElement(name);
  if(content!=null)el.textContent=content;
  if(cls)el.className=cls;
  return el;
}

function printPage(office,tasks,today) {
  const article=tag('article',null,'officer-paper-page'),head=tag('header',null,'officer-letterhead');
  head.append(art('top'),tag('h1','Officer work list'));article.append(head);
  const meta=tag('dl',null,'officer-paper-meta');
  for(const [label,value] of [['Office holder',office.label],['Date issued',date(today,fullDate)]]){
    const pair=tag('div');pair.append(tag('dt',label),tag('dd',value));meta.append(pair);
  }
  article.append(meta,tag('p','Tick completed jobs and write any update below the item. Return this sheet to the Secretary or Assistant Secretary.'));
  if(tasks.length){
    const table=tag('table'),thead=tag('thead'),tr=tag('tr'),tbody=tag('tbody');
    for(const column of ['No.','Action and notes','Timing','Done']){
      const th=tag('th',column);th.scope='col';
      if(column==='Action and notes')th.append(tag('small',office.label,'officer-paper-running-office'));
      tr.append(th);
    }
    thead.append(tr);
    tasks.forEach((task,i)=>{
      const row=tag('tr'),item=tag('td'),done=tag('td');
      item.append(tag('strong',task.title));
      if(task.details)item.append(tag('p',task.details,'officer-paper-detail'));
      if(task.sourceLabel)item.append(tag('p',task.sourceLabel,'officer-paper-source'));
      item.append(tag('div',null,'officer-write-line'));
      if(task.canComplete){const tick=tag('span',null,'officer-paper-tick');tick.setAttribute('aria-label','Tick when done');done.append(tick);}
      else done.append(tag('small','Use the club desk'));
      const timing=todoTiming(task,today),when=tag('td');
      when.append(tag('strong',timing.label,'todo-light todo-light-'+timing.light));
      if(timing.dateLabel)when.append(tag('span',timing.dateLabel,'officer-paper-date'));
      row.append(tag('td',String(i+1)),item,when,done);tbody.append(row);
    });
    table.append(thead,tbody);article.append(table);
  }else article.append(tag('p','No outstanding jobs are recorded for this office.','officer-paper-empty'));
  const notes=tag('section',null,'officer-paper-notes');
  notes.append(tag('h2','Notes to return'),tag('div',null,'officer-write-line'),tag('div',null,'officer-write-line'));
  const footer=tag('footer',null,'officer-paper-footer');footer.append(art('foot'));
  article.append(notes,footer);
  return article;
}

export function setupOfficerTodos({api,esc}) {
  const mount=document.getElementById('officer-todos');
  if(!mount)return;
  let session=null,desk=null,officeKey='',generation=0,busy=false,request=null;
  let printSheet=null,oldTitle='',printTitle='',addAttempt=null,artReady=null;
  let allocationKey='',paperChecked=new Set();
  const active=()=>session?.authenticated && session.role==='committee' && location.hash==='#committee/todos';
  const readOnly=()=>Boolean(session?.demo || session?.readOnly || session?.previewOnly || session?.showcase);
  const canAssign=()=>Boolean(desk?.canAssign && !readOnly());
  const canBrowseAll=()=>Boolean(desk?.canAssign || readOnly());
  const selected=()=>desk.offices.find(o=>o.key===officeKey);
  const forOffice=key=>desk.tasks.filter(t=>t.office===key);
  const currentTasks=()=>forOffice(officeKey);
  function cleanPrint(){
    if(printSheet&&document.title===printTitle)document.title=oldTitle;
    printSheet?.remove();printSheet=null;
    document.body.classList.remove('printing-officer-work');
  }
  function clear(){
    ++generation;request?.abort();request=null;cleanPrint();mount.replaceChildren();
    desk=null;busy=false;officeKey='';allocationKey='';paperChecked.clear();addAttempt=null;
    document.body.classList.remove('on-officer-work');
  }
  function useResponse(data){
    desk=data;
    if(!artReady)artReady=Promise.all([art('top'),art('foot')].map(img=>img.decode())).catch(()=>{artReady=null;});
    if(!desk.offices.some(o=>o.key===officeKey))officeKey=desk.offices.find(o=>o.key===desk.viewerOffice)?.key??desk.offices[0]?.key??'';
  }
  function status(msg,error=false){
    const p=mount.querySelector('[data-todo-status]');if(p){p.setAttribute('role',error?'alert':'status');p.textContent=msg;}
  }
  function officeOptions(choices,value){return choices.map(o=>'<option value="'+esc(o.key)+'" '+(o.key===value?'selected':'')+'>'+esc(o.label)+'</option>').join('');}
  function index(task){return desk.tasks.indexOf(task);}
  function timingLine(t){
    const timing=todoTiming(t,desk.today);
    return '<span class="todo-light todo-light-'+timing.light+'">'+esc(timing.label)+'</span>'+
      (timing.dateLabel?' · '+esc(timing.dateLabel):'')+(t.sourceLabel?' · '+esc(t.sourceLabel):'');
  }
  function sourceLink(t){
    const href=t.source==='agm'?'#committee/agm-jobs':t.href;
    if(t.noticeId)return '<a class="text-link" data-source-job href="#committee/notices">Open committee notice</a>';
    if(t.source==='event')return '<a class="text-link" data-source-job href="#committee/events">Open event plan</a>';
    if(t.source==='agm')return '<a class="text-link" href="'+href+'">Open AGM jobs</a>';
    return routes.has(href)?'<a class="text-link" data-source-job href="'+esc(href)+'">'+(t.source==='meeting'?'Open meeting record':'Open newsletter desk')+'</a>':'';
  }
  function jobRow(t){
    const own=officeKey===desk.viewerOffice && !readOnly();
    return '<li data-job-id="'+esc(t.id)+'" data-job-index="'+index(t)+'"><div><strong>'+esc(t.title)+'</strong>'+
      '<p class="todo-due">'+timingLine(t)+'</p>'+
      (t.details?'<p class="todo-task-detail">'+esc(t.details)+'</p>':'')+'</div><div class="todo-job-actions">'+
      (own && t.canComplete?'<button class="button outline small" data-todo-action="done" type="button">Mark done</button>':'')+
      sourceLink(t)+'</div></li>';
  }
  function addSection(office){
    if(readOnly() || !office || (!desk.canAssign && office.key!==desk.viewerOffice))return '';
    return '<details class="todo-section" data-add-section><summary>Add a job</summary><form class="stack-form" data-todo-add>'+
      '<label>Job for '+esc(office.label)+'<input name="title" required maxlength="240" placeholder="For example, confirm the meeting room with the hotel"></label>'+
      '<label>Due date, if known<input type="date" name="dueDate"></label>'+
      '<label>Details, if needed<textarea name="details" rows="2" maxlength="1000" placeholder="Where to start or who to speak to"></textarea></label>'+
      '<button type="submit" class="button small">Add to this list</button><p data-add-status role="status"></p></form></details>';
  }
  function dutySection(office,tasks){
    const duties=regularDuties(office?.key);
    if(!duties.length)return '';
    return '<details class="todo-section" data-regular-duties'+(tasks.length?'':' open')+'><summary>Regular duties</summary>'+
      '<p>'+(readOnly()?'These are the standard responsibilities for this office.':'Choose a duty to start with wording you can edit, or open Add a job to write your own.')+'</p>'+
      '<ul class="todo-duty-list">'+duties.map(([title],i)=>{
        const exists=tasks.some(t=>t.title===title);
        return readOnly()?'<li><strong>'+esc(title)+'</strong>'+(exists?' <small>On this list</small>':'')+'</li>':
          '<li><button type="button" data-duty="'+i+'">'+esc(title)+(exists?' <small>On this list</small>':'')+'</button></li>';
      }).join('')+'</ul></details>';
  }
  function chooseDuty(i){
    if(readOnly())return;
    const duty=regularDuties(officeKey)[i];
    if(!duty)return;
    const [title,tip]=duty;
    const existing=currentTasks().find(t=>t.title===title);
    if(existing){
      const row=mount.querySelector('[data-job-index="'+index(existing)+'"]');
      if(row){row.tabIndex=-1;row.focus();}
      status('This duty is already on the list.');return;
    }
    const section=mount.querySelector('[data-add-section]'),form=section.querySelector('form');
    if((form.elements.title.value || form.elements.details.value || form.elements.dueDate.value) &&
      !window.confirm('Replace the unsaved job details with this regular duty?'))return;
    section.open=true;form.elements.title.value=title;form.elements.details.value=tip;form.elements.dueDate.value='';
    form.querySelector('[data-add-status]').textContent='Change anything you need, then choose Add to this list.';
    form.elements.title.focus();
  }
  function allocateSection(){
    if(!canAssign())return '';
    const unassigned=desk.tasks.filter(t=>!t.office && ['agm','meeting'].includes(t.source));
    if(!unassigned.length)return '';
    return '<details class="todo-section" data-todo-unassigned><summary>Jobs to allocate · '+unassigned.length+'</summary>'+
      '<form class="stack-form" data-todo-allocate><label>Choose a job<select name="job">'+unassigned.map(t=>'<option value="'+index(t)+'" '+(taskKey(t)===allocationKey?'selected':'')+'>'+esc(t.title+' · '+t.sourceLabel+(t.ownerText?' · '+t.ownerText:''))+'</option>').join('')+'</select></label>'+
      '<label>Give this job to<select name="office">'+officeOptions(desk.offices,officeKey)+'</select></label><button class="button small" type="submit">Assign job</button></form></details>';
  }
  function paperSection(office,tasks){
    if(!canAssign() || !office)return '';
    const eligible=tasks.filter(t=>t.canComplete);
    return '<details class="todo-section" data-paper-section><summary>Record a returned paper list</summary>'+
      (eligible.length?'<form class="stack-form" data-todo-paper><fieldset><legend>Which jobs did '+esc(office.label)+' tick?</legend>'+
        eligible.map(t=>'<label class="todo-paper-choice" data-job-id="'+esc(t.id)+'"><input type="checkbox" name="completed" value="'+index(t)+'" '+(paperChecked.has(taskKey(t))?'checked':'')+'><span>'+esc(t.title)+'<small>'+timingLine(t)+'</small></span></label>').join('')+'</fieldset>'+
        '<p>Leave unfinished jobs unticked. Use Add a job for a handwritten follow-up. The club record keeps the name of the person entering these ticks.</p><button class="button small" type="submit">Record ticked jobs</button><p role="status" data-paper-status></p></form>':
        '<p>There are no open jobs to tick off for this office.</p>')+'</details>';
  }
  function recentSection(office){
    const done=desk.completions.filter(c=>c.office===office?.key);
    if(!done.length)return '';
    return '<details class="todo-section" data-todo-history><summary>Completed jobs</summary><ul class="todo-history">'+done.map(c=>{
      const stamp=c.recordedAt?dayFormat.format(new Date(c.recordedAt)):'';
      const recorder=desk.offices.find(o=>o.key===c.recordedBy)?.label||c.recordedBy;
      return '<li><strong>'+esc(c.title)+'</strong><p>'+esc([stamp,c.paper?'Returned on paper':'Recorded online',recorder?'Recorded by '+recorder:''].filter(Boolean).join(' · '))+'</p></li>';
    }).join('')+'</ul></details>';
  }
  function paint(options={}){
    if(!active()||!desk)return;
    const office=selected(),tasks=office?currentTasks():[];
    const empty=readOnly()?'The office can use the regular duties below when its account is activated.':
      regularDuties(office?.key).length?'Choose a regular duty below or add your own job.':'Choose Add a job to start it.';
    const jobs='<section class="todo-work"><h2>Open jobs</h2>'+(tasks.length?'<ol class="todo-jobs" data-todo-list>'+tasks.map(jobRow).join('')+'</ol>':'<p data-todo-list>This list is empty. '+empty+'</p>')+'</section>'+dutySection(office,tasks)+addSection(office)+allocateSection()+
      '<p><a class="text-link" href="#committee/events">Find a job at a club event or fundraiser</a></p>'+
      (readOnly()?'':(['secretary','assistantsecretary'].includes(desk.viewerOffice)?'<p><a class="text-link" href="#committee/applications">Review new member applications</a></p>':
       desk.viewerOffice==='treasurer'?'<p><a class="text-link" href="#stock">Review membership fees and shop prices</a></p>':''));
    mount.innerHTML='<h1 class="page-title">Officer to-do lists</h1>'+
      (readOnly()?'<p>Webmaster preview. These office lists are view-only and no office invitations have been sent.</p>':'')+
      (canBrowseAll()?'<label class="todo-selector">Whose list?<select data-officer-select aria-describedby="todo-list-guide">'+officeOptions(desk.offices,officeKey)+'</select></label><p id="todo-list-guide">'+(readOnly()?'Choose an office to inspect its work list and regular duties.':'Choose the officer who will do the job. You can add a job to their list or print it to hand to them.')+'</p>':
      '<p class="todo-owner">'+esc(office?.label||'Officer')+'</p><p>These are your jobs. You can keep track here or print a copy to take with you.</p>')+
      (tasks.length?'':jobs)+
      '<div class="todo-print-bar"><button type="button" class="button" data-todo-print>Print list / save PDF</button>'+
      (canBrowseAll()?'<button type="button" class="text-link" data-todo-print-all>Print all lists</button>':'')+'</div>'+
      '<details class="todo-print-help"><summary>How to use a paper list or save a PDF</summary><p>Choose Print list. In the print window, choose your printer and select Print. To keep a file, choose Save as PDF as the destination and select Save.</p><p>'+
      (readOnly()?'In preview mode, printing does not mark jobs complete.':canAssign()?'When an officer returns their sheet, choose their name under Whose list and open Record a returned paper list. Enter the jobs they ticked.':'Tick jobs as you finish them. Return the sheet to the Secretary or Assistant Secretary to update your list.')+'</p></details>'+
      (tasks.length?jobs:'')+'<p role="status" data-todo-status></p>'+paperSection(office,tasks)+recentSection(office);
    if(options.open)mount.querySelector(options.open)?.setAttribute('open','');
    status(options.message||'');
  }
  async function load(force=false){
    if(!active()){clear();return;}
    if(desk&&!force)return;
    const ticket=++generation;request?.abort();request=new AbortController();busy=true;mount.inert=false;
    mount.innerHTML='<h1 class="page-title">Officer to-do lists</h1><p role="status">Opening the work list…</p>';
    try{
      const answer=await api(endpoint,{cache:'no-store',signal:request.signal});
      if(ticket!==generation||!active())return;useResponse(answer);document.body.classList.add('on-officer-work');paint();
    }catch(error){
      if(ticket!==generation||!active())return;
      desk=null;mount.innerHTML='<p role="alert">'+esc(error.message)+'</p><button type="button" class="button outline" data-todo-retry>Try again</button>';
    }finally{if(ticket===generation)busy=false;}
  }
  const post=body=>api(endpoint,{method:'POST',body:JSON.stringify(body),cache:'no-store'});
  function completePayload(t,paper){return {action:'complete',source:t.source,id:t.id,meetingId:t.meetingId,version:t.version,planVersion:t.planVersion,paper};}
  async function save(body,message,options={}){
    if(readOnly())return;
    const completingNotice=body.action==='complete'&&desk.tasks.some(t=>t.noticeId && t.source===body.source && t.id===body.id);
    const ticket=generation;busy=true;mount.inert=true;status('Saving…');
    try{
      const answer=await post(body);
      if(completingNotice)window.dispatchEvent(new Event('plfc:committee-notices-changed'));
      if(ticket!==generation||!active())return;
      useResponse(answer);addAttempt=null;allocationKey='';paint({message,...options});
      window.dispatchEvent(new Event('plfc:meeting-register-changed'));
    }catch(error){
      if(ticket!==generation||!active())return;
      status(error.message,true);
      if(error.status===409)statusWithReload(error.message);
    }finally{if(ticket===generation){busy=false;mount.inert=false;}}
  }
  function statusWithReload(msg){
    status(msg,true);
    const button=tag('button','Refresh this list','text-link');button.type='button';button.dataset.todoRetry='';
    mount.querySelector('[data-todo-status]').append(' ',button);
  }
  async function returned(form){
    if(readOnly())return;
    const checked=Array.from(form.querySelectorAll('input:checked'),el=>desk.tasks[Number(el.value)]).filter(t=>t?.office===officeKey&&t.canComplete);
    if(!checked.length){form.querySelector('[data-paper-status]').textContent='Tick the jobs marked complete on the returned sheet.';return;}
    const ticket=generation;paperChecked=new Set(checked.map(taskKey));let count=0;busy=true;mount.inert=true;
    form.querySelector('[data-paper-status]').textContent='Recording the ticked jobs…';
    try{
      for(const t of checked){
        const current=desk.tasks.find(job=>taskKey(job)===taskKey(t));
        if(!current || current.office!==officeKey || !current.canComplete || current.title!==t.title || current.dueDate!==t.dueDate || current.details!==t.details){
          throw Error('The job list changed. Check the remaining jobs against the returned sheet.');
        }
        const answer=await post(completePayload(current,true));
        if(current.noticeId)window.dispatchEvent(new Event('plfc:committee-notices-changed'));
        if(ticket!==generation||!active())return;
        useResponse(answer);count++;paperChecked.delete(taskKey(t));
      }
      paint({message:count+' '+(count===1?'job recorded':'jobs recorded')+' from the returned sheet.'});
    }catch(error){
      if(ticket!==generation||!active())return;
      paint({open:'[data-paper-section]'});
      statusWithReload((count?count+' already recorded. ':'')+error.message);
    }finally{if(ticket===generation){mount.inert=false;busy=false;if(count)window.dispatchEvent(new Event('plfc:meeting-register-changed'));}}
  }
  function preparePrint(all=false) {
    if(!active()||!desk||!selected()||busy|| (all&&!canBrowseAll()))return false;
    cleanPrint();
    printSheet=tag('div');printSheet.id='officer-todos-print';
    const people=all?desk.offices:[selected()];
    for(const office of people)printSheet.append(printPage(office,forOffice(office.key),desk.today));
    oldTitle=document.title;printTitle='Sandy Sports Club work list - '+(all?'Committee':selected().label)+' - '+desk.today;document.title=printTitle;
    document.body.append(printSheet);document.body.classList.add('printing-officer-work');return true;
  }
  mount.addEventListener('click',async e=>{
    const link=e.target.closest('[data-source-job]');
    if(link && e.button===0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && active() && desk){
      const task=desk.tasks[Number(link.closest('[data-job-index]').dataset.jobIndex)];
      if(task?.noticeId)window.addEventListener('plfc:navigated',event=>{
        if(event.detail.hash==='#committee/notices')window.dispatchEvent(new CustomEvent('plfc:open-committee-notice',{detail:{id:task.noticeId}}));
      },{once:true});
      if(task?.source==='event')window.addEventListener('plfc:navigated',event=>{
        if(event.detail.hash==='#committee/events')window.dispatchEvent(new CustomEvent('plfc:open-event-sheet',{detail:{id:task.meetingId}}));
      },{once:true});
      if(task?.source==='meeting')window.addEventListener('plfc:navigated',event=>{
        if(event.detail.hash==='#committee/meetings')window.dispatchEvent(new CustomEvent('plfc:officer-meeting-job',{detail:{meetingId:task.meetingId,id:task.id}}));
      },{once:true});
    }
    const b=e.target.closest('button');if(!b||!active())return;
    if(b.hasAttribute('data-todo-retry')){load(true);return;}
    if(busy||!desk)return;
    if(b.hasAttribute('data-duty')){chooseDuty(Number(b.dataset.duty));return;}
    if(b.hasAttribute('data-todo-print')||b.hasAttribute('data-todo-print-all')){
      if(preparePrint(b.hasAttribute('data-todo-print-all'))){
        const chosenSheet=printSheet;
        try{
          await Promise.all([...chosenSheet.querySelectorAll('img')].map(img=>img.decode()));
          if(active()&&printSheet===chosenSheet)window.print();
        }catch{if(printSheet===chosenSheet){cleanPrint();status('The work sheet could not open for printing. Check the club connection and choose Print again.',true);}}
      }
      return;
    }
    if(b.dataset.todoAction==='done' && !readOnly()){
      const t=desk.tasks[Number(b.closest('[data-job-index]').dataset.jobIndex)];
      if(t?.office===desk.viewerOffice && t.canComplete)save(completePayload(t,false),'Job marked done.');
    }
  });
  mount.addEventListener('change',e=>{
    if(!desk||busy)return;
    if(e.target.matches('[data-officer-select]') && canBrowseAll()){
      const target=desk.offices.find(o=>o.key===e.target.value);
      if(target){cleanPrint();officeKey=target.key;paperChecked.clear();addAttempt=null;allocationKey='';paint();mount.querySelector('[data-officer-select]').focus();}
    }
  });
  mount.addEventListener('submit',e=>{
    e.preventDefault();const f=e.target;
    if(busy||!active()||!desk||readOnly())return;
    if(f.matches('[data-todo-paper]')){if(desk.canAssign)returned(f);return;}
    if(f.matches('[data-todo-add]')){
      const title=f.elements.title.value.trim(), details=f.elements.details.value.trim(), dueDate=f.elements.dueDate.value;
      if(!title){f.querySelector('[data-add-status]').textContent='Give the job a name.';f.elements.title.focus();return;}
      const signature=JSON.stringify([officeKey,title,details,dueDate]);
      if(addAttempt?.signature!==signature)addAttempt={signature,id:crypto.randomUUID()};
      save({action:'add',id:addAttempt.id,office:officeKey,title,details,dueDate},'Job added to '+selected().label+'’s list.');return;
    }
    if(f.matches('[data-todo-allocate]')&&desk.canAssign){
      const t=desk.tasks[Number(f.elements.job.value)],office=desk.offices.find(o=>o.key===f.elements.office.value);
      if(!t||t.office||!office)return;
      allocationKey=taskKey(t);
      save({action:'assign',source:t.source,id:t.id,meetingId:t.meetingId,version:t.version,planVersion:t.planVersion,office:office.key},'Job assigned to '+office.label+'.');
    }
  });
  window.addEventListener('beforeprint',()=>{if(!printSheet)preparePrint();});
  window.addEventListener('afterprint',cleanPrint);
  window.addEventListener('plfc:committee-notices-date',event=>{
    const today=event.detail?.today;
    if(!active()||!desk||!today||today<=desk.today)return;
    desk.today=today;
    for(const row of mount.querySelectorAll('[data-job-index]')){
      row.querySelector('.todo-due').innerHTML=timingLine(desk.tasks[Number(row.dataset.jobIndex)]);
    }
    for(const input of mount.querySelectorAll('[data-todo-paper] input[name="completed"]')){
      input.closest('label').querySelector('small').innerHTML=timingLine(desk.tasks[Number(input.value)]);
    }
  });
  window.addEventListener('plfc:navigated',()=>{if(active())load();else clear();});
  window.addEventListener('plfc:session-changed',e=>{clear();session=e.detail;if(active())load();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',e=>{if(e.persisted&&active())load(true);});
}
