// Events and run sheets desk (PLFC pattern): plan an event, build its run sheet of shifts,
// put it on the members' and public calendars when it is confirmed, then debrief.
// Uses the events records (/api/suite/events), the run-sheet API and announcements for publishing.
import {isReadOnlyView} from './club-view-client.js';
const ACTIVITIES=['Mixed beach volleyball','Sand cricket','Flag football','Beach rugby','Beach football','Sand games','Wellbeing session','Film screening','Market and festival','Multi-sport','Other'];
const TOWNS=['Dunwich / Goompi','Amity Point / Pulan','Point Lookout / Mulumba','Multi-town / TBD'];
const OFFICES={webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee officer'};
const STEPS=[['plan','1 Plan'],['run','2 Run sheet'],['publish','3 Publish'],['debrief','4 Debrief']];
const AUD={all:'All members',film:'Film Club members'};
const longDate=d=>d?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00')):'No date yet';
const todayBris=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const ampm=t=>{if(!t)return '';let [h,m]=t.split(':').map(Number);const p=h>=12?'pm':'am';h=h%12||12;return h+(m?':'+String(m).padStart(2,'0'):'')+p};
const timeText=f=>f.startTime?ampm(f.startTime)+(f.endTime?' to '+ampm(f.endTime):''):'';

export function setupEventsDesk({api,esc:e,status,showDesk}){
 const root=document.getElementById('committee-events-desk');
 if(!root)return {open(){},close(){}};
 let events=[],current=null,sheet=null,listings=[],step='plan',busy=false,epoch=0,requestId=null;
 const ro=()=>isReadOnlyView(),cancelled=()=>current?.status==='archived';
 const dis=()=>ro()||cancelled()?' disabled':'';
 const say=(msg,bad=false)=>{const n=root.querySelector('[data-ev-message]');if(n){n.textContent=msg;n.classList.toggle('bad',bad)}if(bad)status?.(msg,true)};
 const sel=(name,opts,val)=>'<select name="'+name+'"'+dis()+'><option value="">Choose…</option>'+opts.map(o=>'<option'+(o===val?' selected':'')+'>'+e(o)+'</option>').join('')+'</select>';
 const mine=()=>listings.filter(a=>a.sourceId===current?.id);

 function listView(){
  const t=todayBris(),up=events.filter(x=>x.status!=='archived'&&(!x.fields.eventDate||x.fields.eventDate>=t)).sort((a,b)=>(a.fields.eventDate||'9').localeCompare(b.fields.eventDate||'9')),past=events.filter(x=>!up.includes(x));
  const row=x=>{const pub=listings.some(a=>a.sourceId===x.id);return '<li><button type="button" data-ev-open="'+e(x.id)+'" aria-current="'+(current?.id===x.id)+'"><strong>'+e(x.title)+'</strong><span>'+e(longDate(x.fields.eventDate))+(x.fields.town?' · '+e(x.fields.town.split(' / ')[0]):'')+'</span><span class="ops-badges">'+
   (x.status==='archived'?'<span class="ops-pill ops-muted">Cancelled</span>':pub?'<span class="ops-pill ops-green">On the calendar</span>':'<span class="ops-pill ops-amber">Not published</span>')+'</span></button></li>'};
  return '<details class="ops-compose"'+(events.length?'':' open')+'><summary>Plan an event</summary><form data-ev-new><fieldset'+(ro()?' disabled':'')+'>'+
   '<label>Event name<input name="title" required maxlength="160" placeholder="e.g. Holiday come-and-try beach volleyball"></label>'+
   '<div class="ops-form-grid"><label>Type<select name="activity">'+ACTIVITIES.map(a=>'<option>'+a+'</option>').join('')+'</select></label><label>Where on the island<select name="town">'+TOWNS.map(a=>'<option>'+a+'</option>').join('')+'</select></label>'+
   '<label>Date (if known)<input type="date" name="eventDate"></label><label>Venue<input name="site" maxlength="300" placeholder="e.g. Cylinder Beach"></label>'+
   '<label>Start<input type="time" name="startTime"></label><label>Finish<input type="time" name="endTime"></label></div>'+
   '<button type="submit">Create the event</button></fieldset></form></details>'+
   (up.length?'<h4>Coming up</h4><ul class="mt-list">'+up.map(row).join('')+'</ul>':'')+(past.length?'<h4>Past and cancelled</h4><ul class="mt-list">'+past.map(row).join('')+'</ul>':'')+
   (!events.length?'<p class="ops-empty">No events yet. Plan the first one above.</p>':'');
 }
 function planStep(){
  const f=current.fields;
  return '<form data-ev-plan><fieldset'+dis()+'><div class="ops-form-grid">'+
   '<label>Event name<input name="title" value="'+e(current.title)+'" maxlength="160" required></label><label>Type'+sel('activity',ACTIVITIES,f.activity)+'</label>'+
   '<label>Date<input type="date" name="eventDate" value="'+e(f.eventDate)+'"></label><label>Where on the island'+sel('town',TOWNS,f.town)+'</label>'+
   '<label>Start<input type="time" name="startTime" value="'+e(f.startTime)+'"></label><label>Finish<input type="time" name="endTime" value="'+e(f.endTime)+'"></label></div>'+
   '<label>Venue and booking reference<input name="site" value="'+e(f.site)+'" maxlength="300"></label>'+
   '<label>Running order<textarea name="programme" rows="4" placeholder="e.g. 4:00 set up courts · 4:30 welcome · 4:45 games · 6:00 pack down">'+e(f.programme)+'</textarea></label>'+
   '<label>Equipment and keys (one per line)<textarea name="equipment" rows="3">'+e(f.equipment)+'</textarea></label>'+
   '<label>Heat, weather, safety and emergency plan<textarea name="risk" rows="3" placeholder="Shade, water, first aid kit and who holds it, nearest AED, wet-weather call by…">'+e(f.risk)+'</textarea></label>'+
   '<label class="ops-check"><input type="checkbox" name="insuranceReviewed"'+(f.insuranceReviewed?' checked':'')+'> Insurance requirements checked</label>'+
   '<label class="ops-check"><input type="checkbox" name="culturalPermissionReviewed"'+(f.culturalPermissionReviewed?' checked':'')+'> Cultural and site permissions checked</label>'+
   '<button type="submit">Save the plan</button></fieldset></form>'+
   (cancelled()?'':'<details class="ops-compose mt-change"><summary>Cancel this event</summary><p class="mt-help">It stays on record as cancelled. Take any calendar listing down first.</p><button type="button" class="ev-danger" data-ev-cancel'+(ro()?' disabled':'')+'>Cancel the event</button></details>');
 }
 function runStep(){
  if(!sheet)return '<p>Loading the run sheet…</p>';
  const t=sheet.totals,editable=sheet.canManage&&!ro()&&!cancelled();
  return '<p class="mt-help">Break the day into jobs and shifts. Officers can put their hand up; you can send each helper the shift as a to-do.</p>'+
   '<div class="md-stats">'+['jobs','capacity','filled'].map(k=>'<div class="md-stat"><strong>'+t[k]+'</strong><span>'+({jobs:'jobs',capacity:'helpers needed',filled:'spots filled'}[k])+'</span></div>').join('')+'</div>'+
   (sheet.outOfDate.length&&editable?'<p class="ops-boundary">Some shifts still have the old date. <button type="button" data-ev-sync>Update them</button></p>':'')+
   (sheet.jobs.length?'<ul class="ev-jobs">'+sheet.jobs.map(j=>'<li data-job="'+e(j.id)+'"><div class="ev-job-time">'+e(j.start?ampm(j.start)+(j.finish?' to '+ampm(j.finish):''):'Any time')+'</div><div class="ev-job-what"><strong>'+e(j.title)+'</strong>'+
    '<span>'+(j.claims.length?e(j.claims.map(c=>c.label).join(', ')):'Nobody yet')+' · '+j.filled+' of '+j.capacity+(j.office?' · lead: '+e(OFFICES[j.office]||j.office):'')+'</span>'+(j.notes?'<span>'+e(j.notes)+'</span>':'')+'</div>'+
    '<div class="ev-job-actions">'+(j.completed?'<span class="ops-pill ops-muted">Done</span>':j.open>0?'<span class="ops-pill ops-amber">'+j.open+' needed</span>':'<span class="ops-pill ops-green">Full</span>')+
    (!j.completed&&!j.mine&&j.open>0&&!cancelled()?'<button type="button" data-ev-claim'+(ro()?' disabled':'')+'>I’ll do it</button>':'')+(j.mine&&!j.completed?'<button type="button" data-ev-unclaim'+(ro()?' disabled':'')+'>Drop out</button>':'')+
    (!j.completed&&(editable||j.mine)?'<button type="button" data-ev-done'+(ro()?' disabled':'')+'>Mark done</button>':'')+
    (editable&&j.claims.some(c=>!c.task.exists)?'<button type="button" data-ev-handoff>Send to helpers’ to-do lists</button>':'')+'</div></li>').join('')+'</ul>':'<p class="ops-empty">No jobs yet.</p>')+
   (editable?'<details class="ops-compose"><summary>Add a job or shift</summary><form data-ev-job><div class="ops-form-grid"><label>Job<input name="title" required maxlength="160" placeholder="e.g. Set up courts"></label><label>Helpers needed<input type="number" name="capacity" min="1" max="50" value="2"></label>'+
    '<label>Start<input type="time" name="start"></label><label>Finish<input type="time" name="finish"></label><label>Lead office (optional)<select name="office"><option value="">None</option>'+Object.entries(OFFICES).map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label></div>'+
    '<label>Notes (optional)<input name="notes" maxlength="500" placeholder="e.g. Bring the marquee from the shed"></label><button type="submit">Add to the run sheet</button></form></details>':'')+
   '<div class="ops-actions"><button type="button" data-ev-print>Print the run sheet</button><button type="button" data-ev-todos>Officer to-do lists</button></div>';
 }
 function publishStep(){
  const f=current.fields,live=mine();
  if(!f.eventDate)return '<p class="ops-boundary">Add a date in step 1 before putting the event on a calendar.</p>';
  const stale=live.filter(a=>a.eventDate!==f.eventDate||(a.eventTime||'')!==timeText(f));
  return '<p class="mt-help">When the event is confirmed, put it on the calendar. Members see it in My Clubhouse and can RSVP. Tick the public box to show it on What’s on for everyone too.</p>'+
   (live.length?'<h4>On the calendar now</h4><ul class="md-notices">'+live.map(a=>'<li data-md-id="'+e(a.id)+'"><div><strong>'+e(a.title)+'</strong><span>'+e([AUD[a.audience]||a.audience,longDate(a.eventDate)+(a.eventTime?' '+a.eventTime:''),a.publicCalendar?'Public What’s on':'Members only'].join(' · '))+'</span>'+
    (a.counts?'<span class="md-rsvp">'+a.counts.going+' going'+(a.counts.children?' (+'+a.counts.children+' kids)':'')+' · '+a.counts.maybe+' maybe</span>':'')+'</div><div class="md-row-actions"><button type="button" data-ev-takedown'+(ro()?' disabled':'')+'>Take down</button></div></li>').join('')+'</ul>'+
    (stale.length?'<p class="ops-boundary">The date or time has changed since it was published. Take the old listing down and publish again.</p>':''):'')+
   (cancelled()?'':'<details class="ops-compose"'+(live.length?'':' open')+'><summary>'+(live.length?'Publish again':'Put it on the calendar')+'</summary><form data-ev-publish><fieldset'+(ro()?' disabled':'')+'>'+
    '<p class="ev-preview"><strong>'+e(current.title)+'</strong><br>'+e(longDate(f.eventDate))+(timeText(f)?' · '+e(timeText(f)):'')+(f.site?' · '+e(f.site):'')+'</p>'+
    '<label>Message for members<textarea name="body" rows="3" maxlength="4000" placeholder="What to bring, who it is for, how to get there"></textarea></label>'+
    '<div class="ops-form-grid"><label>Who is it for?<select name="audience"><option value="all">All members</option><option value="film">Film Club members</option></select></label></div>'+
    '<label class="ops-check"><input type="checkbox" name="rsvp" checked> Ask members to RSVP</label>'+
    '<label class="ops-check"><input type="checkbox" name="publicCalendar"> Also show on the public What’s on calendar</label>'+
    '<button type="submit">Publish</button></fieldset></form></details>'+
    '<p class="mt-help">Selling tickets? Add a ticket product with this date in the <a href="/store-admin.html">Store</a> and it shows on What’s on with a Tickets button.</p>');
 }
 function debriefStep(){
  return '<p class="mt-help">Tick, flick and debrief: what worked, what to change, receipts handed in and anything still outstanding.</p>'+
   '<form data-ev-debrief><fieldset'+(ro()?' disabled':'')+'><label>Debrief notes<textarea name="debrief" rows="8">'+e(current.fields.debrief)+'</textarea></label><button type="submit">Save the debrief</button></fieldset></form>'+
   (current.status!=='completed'&&!cancelled()?'<div class="ops-actions"><button type="button" class="mt-primary" data-ev-complete'+(ro()?' disabled':'')+'>Mark the event as finished</button></div>':current.status==='completed'?'<p class="mt-result">This event is marked as finished.</p>':'');
 }
 function detailView(){
  if(!current)return '<p class="ops-empty">'+(events.length?'Choose an event.':'Your events will show here.')+'</p>';
  const f=current.fields;
  return '<header class="mt-head"><div><h4 tabindex="-1">'+e(current.title)+'</h4><p>'+e([f.activity,longDate(f.eventDate),timeText(f),f.site||f.town].filter(Boolean).join(' · '))+'</p></div>'+
   (cancelled()?'<span class="ops-pill ops-muted">Cancelled</span>':current.status==='completed'?'<span class="ops-pill ops-muted">Finished</span>':mine().length?'<span class="ops-pill ops-green">On the calendar</span>':'<span class="ops-pill ops-amber">Not published</span>')+'</header>'+
   '<nav class="mt-steps" aria-label="Event steps">'+STEPS.map(([k,l])=>'<button type="button" data-ev-step="'+k+'" aria-pressed="'+(step===k)+'">'+l+'</button>').join('')+'</nav>'+
   '<div class="mt-step">'+({plan:planStep,run:runStep,publish:publishStep,debrief:debriefStep}[step])()+'</div>';
 }
 function render(){
  root.innerHTML='<header class="ops-header"><div><h3 id="ev-desk-title" tabindex="-1">Events and run sheets</h3><p>Plan an event, roster the helpers, put it on the calendar when it is confirmed, then debrief.</p></div><button type="button" data-ev-refresh>Check now</button></header>'+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+'<p data-ev-message role="status"></p>'+
   '<div class="mt-layout"><aside class="mt-aside">'+listView()+'</aside><section class="mt-detail">'+detailView()+'</section></div>';
 }
 async function refresh(id=current?.id){
  const my=++epoch;
  try{
   const [ev,ann]=await Promise.all([api('/api/suite/events'),api('/api/committee/announcements').catch(()=>({announcements:[]}))]);
   if(my!==epoch)return;
   events=ev.records||[];listings=ann.announcements||[];
   const t=todayBris();current=events.find(x=>x.id===id)||events.filter(x=>x.status!=='archived'&&x.fields.eventDate>=t).sort((a,b)=>a.fields.eventDate.localeCompare(b.fields.eventDate))[0]||events[0]||null;
   sheet=null;render();
   if(current&&step==='run')await loadSheet();
  }catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load events: '+e(err.message)+'</p>';status?.(err.message,true)}}
 }
 async function loadSheet(){if(!current)return;try{sheet=await api('/api/committee/events/'+current.id+'/run-sheet');render()}catch(err){say(err.message,true)}}
 async function guarded(fn,after){if(busy||ro())return;busy=true;for(const b of root.querySelectorAll('button'))b.disabled=true;try{const msg=await fn();await refresh();if(step==='run'&&!sheet)await loadSheet();if(msg)say(msg)}catch(err){await refresh();say(err.message,true)}finally{busy=false}}
 const save=(changes,{status:st}={})=>api('/api/suite/events/'+current.id,{method:'PATCH',data:{version:current.version,title:changes.title??current.title,status:st||current.status,fields:{...current.fields,...changes.fields}}});
 const run=data=>api('/api/committee/events/'+current.id+'/run-sheet',{method:'POST',data});
 root.addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.target,v=Object.fromEntries(new FormData(form));if(ro())return;
  if(form.matches('[data-ev-new]'))return guarded(async()=>{
   const r=await api('/api/suite/events',{method:'POST',data:{title:v.title.trim(),status:'draft',fields:{activity:v.activity,town:v.town,eventDate:v.eventDate,site:v.site.trim(),startTime:v.startTime,endTime:v.endTime}}});
   current={id:r.id};step='plan';return 'Event created. Fill in the plan, then build the run sheet.';
  });
  if(form.matches('[data-ev-plan]'))return guarded(async()=>{
   const fields={activity:v.activity,eventDate:v.eventDate,town:v.town,startTime:v.startTime,endTime:v.endTime,site:v.site.trim(),programme:v.programme,equipment:v.equipment,risk:v.risk,insuranceReviewed:form.elements.insuranceReviewed.checked,culturalPermissionReviewed:form.elements.culturalPermissionReviewed.checked};
   const moved=fields.eventDate!==current.fields.eventDate;
   await save({title:v.title.trim(),fields},{status:current.status==='draft'&&fields.eventDate?'scheduled':current.status});
   if(moved){try{await api('/api/committee/events/'+current.id+'/run-sheet',{method:'POST',data:{action:'sync'}})}catch{}}
   return 'Plan saved.'+(moved&&mine().length?' The date changed: update the calendar listing in step 3.':'');
  });
  if(form.matches('[data-ev-debrief]'))return guarded(async()=>{await save({fields:{debrief:v.debrief}});return 'Debrief saved.'});
  if(form.matches('[data-ev-job]'))return guarded(async()=>{
   requestId??=crypto.randomUUID();const r=await run({action:'add',requestId,job:{title:v.title.trim(),capacity:Number(v.capacity||1),start:v.start,finish:v.finish,office:v.office,notes:v.notes.trim()}});requestId=null;sheet=null;return r.created===false?'That job is already on the run sheet.':'Job added.';
  });
  if(form.matches('[data-ev-publish]'))return guarded(async()=>{
   const f=current.fields;
   await api('/api/committee/announcements',{method:'POST',data:{action:'create',title:current.title,body:v.body.trim(),audience:v.audience,eventDate:f.eventDate,eventTime:timeText(f),location:f.site||f.town||'',rsvp:form.elements.rsvp.checked,publicCalendar:form.elements.publicCalendar.checked,sourceId:current.id}});
   return 'On the calendar'+(form.elements.publicCalendar.checked?', including the public What’s on page.':' for members.');
  });
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-ev-refresh')){await refresh();say('Up to date.');return}
  if(b.dataset.evOpen){step='plan';await refresh(b.dataset.evOpen);root.querySelector('.mt-head h4')?.focus();if(matchMedia('(max-width:820px)').matches)root.querySelector('.mt-detail')?.scrollIntoView({block:'start'});return}
  if(b.dataset.evStep){step=b.dataset.evStep;render();if(step==='run')await loadSheet();return}
  if(b.hasAttribute('data-ev-todos')){await showDesk('todos');return}
  if(b.hasAttribute('data-ev-print')){
   try{const r=await fetch('/api/committee/events/'+current.id+'/run-sheet?format=text',{credentials:'same-origin',cache:'no-store'});const text=await r.text();const w=window.open('','_blank');if(!w){say('Allow pop-ups to print.',true);return}
    w.document.write('<!doctype html><title>Run sheet</title><pre style="font:12pt/1.5 Arial,sans-serif;white-space:pre-wrap;margin:15mm">'+e(text)+'</pre>');w.document.close();w.focus();w.print()}catch(err){say(err.message,true)}return}
  if(b.hasAttribute('data-ev-cancel')){if(!confirm('Cancel “'+current.title+'”? It stays on record as cancelled.'))return;return guarded(async()=>{for(const a of mine())await api('/api/committee/announcements',{method:'POST',data:{action:'archive',id:a.id}});await save({},{status:'archived'});return 'Event cancelled'+(mine().length?' and taken off the calendar.':'.')})}
  if(b.hasAttribute('data-ev-complete'))return guarded(async()=>{await save({},{status:'completed'});return 'Marked as finished.'});
  if(b.hasAttribute('data-ev-sync'))return guarded(async()=>{const r=await run({action:'sync'});sheet=null;return r.updated+' shift'+(r.updated===1?'':'s')+' updated.'});
  if(b.hasAttribute('data-ev-takedown')){if(!confirm('Take this listing off the calendar?'))return;const id=b.closest('[data-md-id]').dataset.mdId;return guarded(async()=>{await api('/api/committee/announcements',{method:'POST',data:{action:'archive',id}});return 'Taken off the calendar.'})}
  const li=b.closest('[data-job]');if(!li||!sheet)return;const job=sheet.jobs.find(j=>j.id===li.dataset.job);
  if(b.hasAttribute('data-ev-claim')){if(!confirm('Put your name on “'+job.title+'”? Your office label shows on the run sheet.'))return;return guarded(async()=>{await run({action:'claim',jobId:job.id,consent:true});sheet=null;return 'You’re on it.'})}
  if(b.hasAttribute('data-ev-unclaim'))return guarded(async()=>{await run({action:'unclaim',jobId:job.id});sheet=null;return 'You’ve dropped out of that shift.'});
  if(b.hasAttribute('data-ev-done'))return guarded(async()=>{await run({action:'complete',jobId:job.id,version:job.version});sheet=null;return 'Job marked done.'});
  if(b.hasAttribute('data-ev-handoff'))return guarded(async()=>{const r=await run({action:'handoff',jobId:job.id});sheet=null;return r.created?'Sent to '+(r.created===1?'the helper’s':r.created+' helpers’')+' to-do list'+(r.created===1?'':'s')+'.':'Already on their to-do lists.'});
 });
 return {
  async open(){root.hidden=false;root.textContent='Loading events…';await refresh();root.querySelector('#ev-desk-title')?.focus({preventScroll:true})},
  close(){epoch++;root.hidden=true}
 };
}
