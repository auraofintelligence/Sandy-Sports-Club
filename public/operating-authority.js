const kinds={volunteer:'Volunteering',employment:'Paid work',event:'Event delivery'};

export function setupOperatingAuthority({api,esc}) {
  const panel=document.getElementById('operating-authority');
  const out=panel.querySelector('[data-authorities]'),status=panel.querySelector('[role=status]');
  let enabled=false,readOnly=false,revision=0,decisions=[];
  function card(task,today) {
    const past=task.reviewDay && task.reviewDay<today;
    const state=task.closedAt?'Closed':past?'Review date passed':task.acceptedAt?'Partner acceptance recorded':task.work?'Waiting for written partner acceptance':'Enquiry authorised';
    const head='<article class="authority-card" data-task="'+esc(task.id)+'"><h4>'+esc(kinds[task.kind])+' · '+esc(task.eventTitle||task.requester)+'</h4><p><strong>'+esc(state)+'</strong></p><p>'+esc(task.scope)+'</p>';
    if(!task.work){
      if(!decisions.length)return head+'<p>Record a decision in approved meeting minutes before delegating a task.</p></article>';
      return head+'<details><summary>Record the committee’s delegation</summary><form class="stack-form" data-action="record">'+
        '<label>Which approved decision covers this work?<select name="decision" required><option value="">Choose a decision</option>'+decisions.map((d,i)=>'<option value="'+i+'">'+esc(d.date)+' · '+esc(d.motion)+'</option>').join('')+'</select></label>'+
        '<label>What will the partner do?<textarea name="work" maxlength="400" required placeholder="For example, roster welcome-desk volunteers for this event"></textarea></label>'+
        '<label>What will Sandy Sports still do?<textarea name="retained" maxlength="400" required placeholder="For example, supervise the event and confirm its safety plan"></textarea></label>'+
        '<label>Who is responsible at Sandy Sports?<input name="lead" maxlength="100" required></label><label>When must this delegation be reviewed?<input type="date" name="review" min="'+esc(today)+'" required></label>'+
        '<button class="button small">Record club authority</button></form></details></article>';
    }
    const details='<dl><dt>With ready SET Co-op</dt><dd>'+esc(task.work)+'</dd><dt>With Sandy Sports</dt><dd>'+esc(task.retained)+'</dd><dt>Club contact and review date</dt><dd>'+esc(task.clubLead)+' · '+esc(task.reviewDay)+'</dd><dt>Committee decision</dt><dd>'+esc(task.motion)+'</dd>'+
      (task.acceptedAt?'<dt>Partner contact and acceptance reference</dt><dd>'+esc(task.partnerLead)+' · '+esc(task.acceptanceRef)+'</dd>':'')+'</dl>';
    const acceptance=!task.acceptedAt&&!task.closedAt&&!past?'<details><summary>Record the partner’s written acceptance</summary><form class="stack-form" data-action="accept"><label>Contact or role accepting for the partner<input name="partnerLead" maxlength="100" required></label><label>Agreement or correspondence reference<input name="reference" maxlength="200" required></label><label><input type="checkbox" name="confirm" required> I checked that the partner accepted this exact task in writing.</label><button class="button small">Confirm acceptance</button></form></details>':'';
    return head+details+acceptance+(!task.closedAt?'<button type="button" class="text-link" data-close>End this delegation</button>':'')+'</article>';
  }
  async function refresh() {
    if(!enabled || !panel.open)return;
    const rev=++revision;
    try{
      const [register,choices]=await Promise.all([api('/api/committee/operating-authority'),api('/api/handoffs')]);
      if(rev!==revision || !enabled)return;
      decisions=choices.motions.flatMap(m=>m.decisions.map(motion=>({id:m.meetingId,date:m.date,motion})));
      out.innerHTML=register.tasks.map(task=>card(task,register.today)).join('')||'<p>There are no authorised enquiries yet. Start in the <a href="#committee/handoffs">ready SET Co-op requests desk</a>. An enquiry is the first step. A handover also needs an approved committee decision and written acceptance from the partner.</p>';
      if(readOnly)out.querySelectorAll('form,[data-close]').forEach(control=>control.hidden=true);
      status.textContent='';
    }catch(e){if(rev===revision)status.textContent=e.message;}
  }
  async function save(button,body) {
    if(readOnly)return;
    button.disabled=true;status.textContent='Saving the committee record…';
    try{await api('/api/committee/operating-authority',{method:'POST',body:JSON.stringify(body)});await refresh();status.textContent='Committee record saved.';}
    catch(e){status.textContent=e.message;}finally{button.disabled=false;}
  }
  panel.addEventListener('toggle',()=>{if(panel.open)refresh();});
  panel.addEventListener('submit',event=>{
    event.preventDefault();if(!enabled||readOnly)return;
    const form=event.target,b=Object.fromEntries(new FormData(form));
    if(form.dataset.action==='record'){const choice=decisions[Number(b.decision)];if(!choice)return;delete b.decision;b.meetingId=choice.id;b.motion=choice.motion;}
    if(form.elements.confirm)b.confirm=form.elements.confirm.checked;
    save(form.querySelector('button'),{...b,id:form.closest('[data-task]').dataset.task,action:form.dataset.action});
  });
  panel.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');if(!enabled || readOnly || !close)return;
    if(confirm('End the recorded delegation for this task? Tell your partner contact so they can update their own records.'))save(close,{action:'close',id:close.closest('[data-task]').dataset.task,confirm:true});
  });
  window.addEventListener('plfc:session-changed',e=>{revision++;enabled=e.detail?.role==='committee'&&e.detail.storageReady;readOnly=Boolean(e.detail?.readOnly||e.detail?.showcase||e.detail?.demo);out.replaceChildren();status.textContent='';if(enabled)refresh();});
}
