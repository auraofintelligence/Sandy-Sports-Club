const path='/api/meetings/agm-jobs';
const archive='/constitution.pdf';
const returns='https://www.qld.gov.au/community/fair-trading/associations-charities-and-non-for-profits/incorporated-associations/financial-responsibilities-for-incorporated-associations/lodging-your-association-annual-return';
const dateFormat=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const date=day=>dateFormat.format(new Date(day+'T12:00:00+10:00'));

export function setupAgmJobs({api,esc,navigate}) {
  const mount=document.getElementById('agm-jobs');
  let session=null,state=null,version=0,busy=false;
  const readOnly=()=>Boolean(session?.readOnly || session?.showcase || session?.demo);
  function paint(open=false,message='') {
    const plans=state.plans;
    mount.innerHTML='<details class="panel agm-jobs"'+(open?' open':'')+'><summary>AGM jobs'+(plans.length?' · '+plans.reduce((n,p)=>n+p.jobs.filter(j=>!j.doneAt).length,0)+' open':'')+'</summary>'+
      '<p>Choose an AGM date once. The club works out the preparation dates and keeps one shared list for all officers.</p>'+
      (plans.length?plans.map(planCard).join(''):'<p>There is no upcoming AGM in the meeting diary.</p>')+
      '<button type="button" class="button outline small" data-start-agm>Prepare an AGM</button>'+
      '<details class="agm-help"><summary>Picking up the AGM paperwork</summary><p>Find the latest signed AGM record and the Treasurer’s year-end accounts. If an earlier meeting lacked quorum, check whether it lapsed or was adjourned and what notice was given. If a reporting year or filing is outstanding, check the position with Queensland Fair Trading.</p><p>Preparation dates use the club’s archive rules. Confirm the registered copy before giving notice. Allow time for delivery.</p><div class="button-row"><a class="text-link" href="'+archive+'" target="_blank" rel="noopener">Club constitution</a><a class="text-link" href="'+returns+'" target="_blank" rel="noopener">Fair Trading annual returns and contact details</a></div></details>'+
      '<p role="status"></p></details>';
    mount.querySelector('[role=status]').textContent=message;
    if(readOnly())mount.querySelectorAll('[data-start-agm],[data-agm-basis],[data-job-action]').forEach(control=>control.hidden=true);
  }
  function planCard(plan) {
    const jobCard=j=>{
      const owner=j.doneAt?'Done by '+j.doneBy:j.owner?'Taken by '+j.owner:'Needs a volunteer';
      const own=j.ownerId===session.identity?.id || j.ownerId==='office:'+session.identity?.name;
      const act=(key,label)=>'<button class="text-link" type="button" data-job="'+esc(j.key)+'" data-job-action="'+key+'">'+label+'</button>';
      const when=j.due<state.today&&!j.doneAt?'Due date passed · ':j.due===state.today?'Today · ':'';
      return '<li><div><strong>'+esc(j.title)+'</strong><small>'+when+esc(date(j.due))+' · '+esc(owner)+'</small></div><details><summary>What to do</summary><p>'+esc(j.help)+'</p></details><div class="button-row">'+
        (j.ownerId && !own?'':j.doneAt?act('reopen','Reopen job'):(j.ownerId?act('release','Hand back'):act('claim','I’ll take this'))+act('done','Mark done'))+'</div></li>';
    };
    return '<article data-agm-id="'+esc(plan.id)+'"><h3>'+esc(plan.title)+'</h3><p>'+esc(date(plan.date))+'</p>'+
      (plan.past||plan.recordStatus==='approved'?'':'<label>Notice arrangements<select data-agm-basis><option value="fresh"'+(plan.basis==='fresh'?' selected':'')+'>Calling an AGM with fresh notice</option><option value="adjourned"'+(plan.basis==='adjourned'?' selected':'')+'>Continuing an adjourned AGM</option></select></label>')+
      '<ol>'+plan.jobs.map(jobCard).join('')+'</ol>'+
      (plan.jobs.some(j=>!j.doneAt)?'<details class="agm-help"><summary>Remind me in my own calendar</summary><p>Save the file, then open it in Apple Calendar or Outlook and choose your private calendar. In Google Calendar on a computer, open Settings, then Import &amp; export, and choose the file and your private calendar. Check the job dates and alerts after importing. This is a copy of the open jobs at the time you save it.</p><a class="button outline small" href="'+path+'?calendar='+encodeURIComponent(plan.id)+'" download="Sandy-AGM-reminders.ics">Save AGM reminders</a></details>':'')+'</article>';
  }
  const active=()=>session?.role==='committee'&&['#committee','#committee/meetings','#committee/agm-jobs'].includes(location.hash);
  async function load(open=location.hash==='#committee/agm-jobs') {
    const ticket=++version;
    busy=false;state=null;mount.replaceChildren();mount.hidden=!active();
    if(mount.hidden)return;
    try{
      const data=await api(path,{cache:'no-store'});
      if(ticket!==version)return;
      state=data;paint(open);
    }catch(error){
      if(ticket!==version)return;
      mount.innerHTML='<p role="status"></p><button type="button" class="text-link" data-refresh-agm>Try AGM jobs again</button>';
      mount.querySelector('p').textContent=error.message;
    }
  }
  async function save(card,payload) {
    if(busy||!active()||readOnly())return;
    const ticket=version;
    busy=true;mount.inert=true;
    try{
      const data=await api(path,{method:'POST',body:JSON.stringify({id:card.dataset.agmId,...payload})});
      if(ticket!==version)return;
      state=data;paint(true,'Saved to the committee’s shared list.');
    }catch(error){
      if(ticket!==version)return;
      if(error.status===409){
        await load(true);
        const status=mount.querySelector('[role=status]');if(status)status.textContent=error.message;
      }else paint(true,error.message);
    }finally{mount.inert=false;if(ticket===version)busy=false;}
  }
  mount.addEventListener('change',e=>{
    const select=e.target.closest('[data-agm-basis]');if(!select||readOnly())return;
    const card=select.closest('[data-agm-id]'),plan=state.plans.find(p=>p.id===card.dataset.agmId);
    save(card,{action:'basis',basis:select.value,version:plan.planVersion});
  });
  mount.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-refresh-agm')){load(true);return;}
    if(button.hasAttribute('data-start-agm')&&!readOnly()){
      const form=document.getElementById('desk-create-form');
      if(form.elements.kind.value!=='agm' && (form.elements.title.value||form.elements.date.value||form.elements.location.value)){
        mount.querySelector('[role=status]').textContent='A different meeting is being entered. Finish or clear that form before preparing an AGM.';return;
      }
      await navigate('#committee/meetings');
      document.getElementById('desk-create').open=true;
      form.elements.kind.value='agm';
      if(!form.elements.title.value)form.elements.title.value='Sandy Sports Club annual general meeting';
      form.elements.date.focus();
      form.scrollIntoView({block:'center'});
      return;
    }
    if(!button.dataset.jobAction||!state)return;
    const card=button.closest('[data-agm-id]'),plan=state.plans.find(p=>p.id===card.dataset.agmId);
    const job=plan.jobs.find(j=>j.key===button.dataset.job);
    save(card,{key:job.key,action:button.dataset.jobAction,version:job.version,planVersion:plan.planVersion});
  });
  window.addEventListener('plfc:navigated',()=>load());
  window.addEventListener('plfc:session-changed',e=>{session=e.detail;mount.toggleAttribute('data-read-only',readOnly());load();});
  window.addEventListener('plfc:meeting-register-changed',()=>load(true));
  window.addEventListener('pageshow',e=>{if(e.persisted)load();});
}
