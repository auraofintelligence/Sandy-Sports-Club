// Distinct operational workspaces. The noticeboard and officer lists share one
// server-owned linked task, not copies or local browser storage.
import {isReadOnlyView} from './club-view-client.js';
const labels={webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee officer'};
const states={current:'Current',undated:'No due date',stale:'Review overdue',reviewSoon:'Review soon',dueSoon:'Due soon',dueToday:'Due today',overdue:'Overdue',done:'Completed',archived:'Archived'};
const date=s=>s?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(s.length===10?s+'T12:00:00+10:00':s)):'Not dated';
const timing=s=>['overdue','stale'].includes(s)?'red':['dueSoon','dueToday','reviewSoon'].includes(s)?'amber':['done','archived','undated'].includes(s)?'muted':'green';
export function setupCommitteeOperations({api,esc,status,getIdentity,showDesk}){
 const root=document.getElementById('committee-ops'),summary=document.getElementById('committee-ops-summary');
 let current='',view=null,archive=false,filter='',listMode='active',epoch=0,request=null,busy=false;
 const e=esc,ro=()=>isReadOnlyView(),block=()=>ro()?' disabled title="Synthetic view only"':'',office=k=>labels[k]||'Unallocated';
 const officeOptions=(items,selected='')=>items.map(({key,label})=>'<option value="'+e(key)+'"'+(key===selected?' selected':'')+'>'+e(label)+'</option>').join('');
 const badge=s=>'<span class="ops-pill ops-'+timing(s)+'">'+e(states[s]||s)+'</span>';
 const endpoint=()=>'/api/committee/'+current;
 function counts(v){return '<div class="ops-counts"><span><strong>'+v.counts.unread+'</strong> new to you</span><span><strong>'+v.counts.red+'</strong> overdue</span><span><strong>'+v.counts.amber+'</strong> to review / due soon</span></div>'}
 async function loadSummary(){
  const my=++epoch;summary.hidden=false;summary.textContent='Checking your noticeboard…';
  try{
   const v=await api('/api/committee/notices?summary=1');if(my!==epoch)return;
   summary.innerHTML='<div><h3>Committee notices</h3>'+counts(v)+'</div><button type="button" data-ops-open="notices">Open noticeboard</button><button type="button" data-ops-open="todos">Officer work lists</button>';
  }catch(err){if(my===epoch)summary.textContent='Notice summary unavailable: '+err.message}
 }
 summary.addEventListener('click',ev=>{const b=ev.target.closest('[data-ops-open]');if(b)void showDesk(b.dataset.opsOpen)});
 function say(msg,error=false){const n=root.querySelector('[data-ops-message]');if(n){n.textContent=msg;n.classList.toggle('bad',error)}}
 function legacy(v){return v.legacy?.length?'<details class="ops-legacy"><summary>Older shared working records ('+v.legacy.length+')</summary><p>These original register notes remain intact. Open the advanced register for their existing editing and history.</p>'+v.legacy.map(x=>'<article><strong>'+e(x.title)+'</strong><p>'+e(x.details)+'</p><small>'+e(x.status)+' · '+date(x.updatedAt)+'</small></article>').join('')+'<a href="#records">Open advanced register</a></details>':''}
 function title(text,description){return '<header class="ops-header"><div><h3 id="ops-desk-title" tabindex="-1">'+text+'</h3><p>'+description+'</p></div><button type="button" data-ops-refresh>Check now</button></header>'}
 function noticeCard(n){
  const target=n.recipients.length===Object.keys(labels).length?'the whole committee':n.recipients.map(office).join(', ');
  return '<article class="ops-notice" data-ops-id="'+e(n.id)+'"><div class="ops-card-head"><h4>'+e(n.title)+'</h4><div class="ops-badges">'+(n.important?'<span class="ops-pill ops-important">Important</span>':'')+(n.unread?'<span class="ops-pill ops-new">New to you</span>':'')+badge(n.status)+'</div></div>'+
   '<p class="ops-meta">Posted by '+e(n.author)+' · '+date(n.createdAt)+' · For '+e(target)+(n.legacy?' · Earlier draft':'')+'</p>'+
   (n.details?'<p class="ops-text">'+e(n.details)+'</p>':'')+'<div class="ops-notice-timing">'+(n.noticeType==='action'?'<strong>'+e(office(n.office))+'</strong> · Due '+date(n.dueDate):'Review by '+date(n.reviewDate))+'</div>'+
   '<div class="ops-actions">'+(n.unread?'<button type="button" data-notice-action="seen"'+block()+'>Mark as read</button>':'')+
   (n.taskId&&!n.archived?'<button type="button" data-ops-open="todos">Officer to-do lists</button>':'')+
   (n.canReview?'<button type="button" data-notice-action="review"'+block()+'>Confirm current for 30 days</button>':'')+
   (n.canArchive?'<button type="button" data-notice-action="archive"'+block()+'>Archive notice</button>':'')+
   '<button type="button" data-ops-history>History</button></div><div data-ops-history-panel hidden></div></article>';
 }
 const attention=n=>['overdue','stale','dueToday','dueSoon','reviewSoon'].includes(n.status);
 const shown=v=>v.notices.filter(n=>listMode==='new'?n.unread:listMode==='attention'?attention(n):true);
 const emptyText={active:'No notices yet. Choose Post a notice to share the first update.',new:'You’re up to date.',attention:'Nothing needs attention today.',archive:'No notices have been archived.'};
 function board(v){
  const choices=v.canAssign?v.offices:v.offices.filter(o=>o.key===v.viewerOffice),rows=shown(v);
  return title('Committee notices','Post an update for the committee or give an officer a job with a due date.')+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+counts(v)+
   (!archive?'<details class="ops-compose"><summary>Post a notice</summary><form id="ops-notice-form"><fieldset'+(ro()?' disabled':'')+'>'+
    '<label>What are you posting?<select name="kind"><option value="info">An update for officers</option><option value="action">A job for an officer</option></select></label>'+
    '<label>Title<input name="title" required maxlength="180" placeholder="e.g. Confirm the Amity court booking"></label>'+
    '<label>Details (optional)<textarea name="details" rows="3" maxlength="9000"></textarea></label>'+
    '<div class="ops-form-grid"><label>Who should see it?<select name="scope"><option value="all">The whole committee</option><option value="leadership">Executive and secretaries</option>'+officeOptions(v.offices)+'</select></label>'+
    '<label class="ops-check"><input type="checkbox" name="important"> Mark as important</label></div>'+
    '<div data-info-fields><label>Review date (optional)<input type="date" name="reviewDate"></label><small>Leave blank to check this update again in 30 days.</small></div>'+
    '<div data-action-fields hidden class="ops-form-grid"><label>Who will do it?<select name="office">'+officeOptions(choices,v.viewerOffice)+'</select></label><label>Due date<input type="date" name="dueDate"></label><small>The job also goes on that officer’s to-do list.</small></div>'+
    '<button type="submit">Post notice</button></fieldset></form></details>':'')+
   '<div class="ops-toolbar"><label>Show<select data-ops-filter><option value="active">On the board</option><option value="new">New to me</option><option value="attention">Needs attention</option><option value="archive">Archived</option></select></label><button type="button" data-ops-open="todos">Officer to-do lists</button></div>'+
   '<p data-ops-message role="status"></p>'+
   '<div class="ops-notice-grid">'+(rows.length?rows.map(noticeCard).join(''):'<p class="ops-empty">'+emptyText[archive?'archive':listMode]+'</p>')+'</div>'+
   '<details class="ops-key"><summary>What do the colours mean?</summary><p>Green is current. Amber means a job is due within 7 days or an update needs checking. Red means overdue. Grey means done or archived. “New to you” stays until you mark it as read. The board checks for changes every minute while it’s open.</p></details>'+legacy(v);
 }
 function taskCard(t,v){
  return '<article class="ops-task" data-ops-id="'+e(t.id)+'"><div class="ops-card-head"><h4>'+e(t.title)+'</h4>'+badge(t.status)+'</div>'+
   '<div class="ops-meta">'+e(office(t.office))+' · '+date(t.dueDate)+' · '+e({notice:'Committee notice',meeting:'Meeting follow-up',monthly:'Monthly standard duty',manual:'Officer task'}[t.source])+(t.legacy?' · Existing draft':'')+'</div>'+
   (t.details?'<p class="ops-text">'+e(t.details)+'</p>':'')+
   (t.completion?'<p class="ops-completion">Completed '+date(t.completion.at)+' · recorded by '+e(t.completion.by)+(t.completion.paper?' from returned paper sheet':' online')+'</p>':'')+
   '<div class="ops-actions">'+(t.source==='notice'?'<button type="button" data-ops-open="notices">Open originating noticeboard</button>':'')+(t.source==='meeting'?'<button type="button" data-ops-open="meetings">Open meeting register</button>':'')+(t.source==='monthly'?'<button type="button" data-ops-open="social">Open Social Studio</button>':'')+
   (t.canTake?'<button type="button" data-task-action="take"'+block()+'>Take this task</button>':'')+(t.canComplete?'<button type="button" data-task-action="complete"'+block()+'>Mark complete</button>':'')+
   (t.canPaper?'<button type="button" data-task-action="paper"'+block()+'>Record returned paper tick</button>':'')+
   (t.version>0?'<button type="button" data-ops-history>Officer history</button>':'')+'</div>'+
   (t.canAssign?'<form class="ops-assign" data-ops-assign><label>Allocate / change office<select name="office"'+block()+'><option value="">Unallocated</option>'+officeOptions(v.offices,t.office)+'</select></label><button type="submit"'+block()+'>Allocate</button></form>':'')+
   '<div data-ops-history-panel hidden></div></article>';
 }
 function worklist(v){
  const active=v.tasks.filter(t=>!t.done&&!t.archived),finished=v.tasks.filter(t=>t.done||t.archived),groupKeys=[...new Set(active.map(t=>t.office||''))];
  const own=v.offices.find(o=>o.key===v.viewerOffice);
  return title('Officer to-do lists','Work by office, due date and source. Take unallocated jobs, record completion, print an A4 work list and return paper ticks to the secretariat.')+
   (ro()?'<p class="ops-boundary">Read-only synthetic showcase. Allocation and completion are disabled; printing is available.</p>':'')+
   '<div class="ops-counts"><span><strong>'+active.length+'</strong> outstanding</span><span><strong>'+active.filter(t=>t.status==='overdue').length+'</strong> overdue</span><span><strong>'+finished.length+'</strong> completed / filed</span></div>'+
   '<div class="ops-toolbar"><label>Office<select id="ops-office-filter"><option value="all">All available lists</option><option value="unallocated">Unallocated</option>'+officeOptions(v.offices)+'</select></label><button type="button" data-ops-print>Print work list (A4)</button><button type="button" data-ops-open="notices">Committee noticeboard</button></div>'+
   '<p data-ops-message role="status"></p>'+
   '<details class="ops-compose"><summary>Add an officer task</summary><form id="ops-task-form"><fieldset'+(ro()?' disabled':'')+'><label>Action<input name="title" required maxlength="180"></label><label>Details / practical next steps<textarea name="details" rows="3" maxlength="9000"></textarea></label><div class="ops-form-grid"><label>Responsible office<select name="office">'+(v.canAssign?'<option value="">Unallocated</option>':'')+officeOptions(v.offices,v.viewerOffice)+'</select></label><label>Due date<input type="date" name="dueDate"></label></div><button type="submit">Add to officer work list</button></fieldset></form></details>'+
   '<details class="ops-duty-guide"><summary>Regular office duties</summary>'+v.offices.map(o=>'<section><h4>'+e(o.label)+'</h4><ul>'+o.duties.map(d=>'<li>'+e(d)+'</li>').join('')+'</ul></section>').join('')+'<p>These are proposed Sandy responsibilities, not appointments or adopted rules.</p></details>'+
   '<div class="ops-task-groups">'+(groupKeys.length?groupKeys.map(k=>'<section class="ops-office-group"><header><h4>'+e(office(k))+'</h4><span>'+active.filter(t=>(t.office||'')===k).length+' outstanding</span></header>'+active.filter(t=>(t.office||'')===k).map(t=>taskCard(t,v)).join('')+'</section>').join(''):'<p class="ops-empty">No outstanding tasks in this list.</p>')+'</div>'+
   '<details class="ops-completed"><summary>Completed and filed work ('+finished.length+')</summary>'+finished.map(t=>taskCard(t,v)).join('')+'</details>'+legacy(v);
 }
 function render(){
  const box=root.querySelector('.ops-compose[open] form'),draft=box?{...Object.fromEntries(new FormData(box)),important:box.elements.important?.checked}:null;
  root.innerHTML=current==='notices'?board(view):worklist(view);
  if(current==='todos')root.querySelector('#ops-office-filter').value=filter||'all';
  if(current==='notices')root.querySelector('[data-ops-filter]').value=archive?'archive':listMode;
  const f=draft&&root.querySelector('.ops-compose form');
  if(f){f.closest('details').open=true;for(const[k,val]of Object.entries(draft)){const el=f.elements[k];if(!el)continue;if(el.type==='checkbox')el.checked=Boolean(val);else el.value=val}f.elements.kind?.dispatchEvent(new Event('change',{bubbles:true}))}
 }
 async function reload(){
  const generation=++epoch,route=current;if(!route)return;
  root.hidden=false;root.textContent='Loading shared '+(route==='notices'?'noticeboard':'officer work lists')+'…';
  const suffix=route==='notices'?(archive?'?archive=1':''):(filter&&filter!=='all'?'?office='+encodeURIComponent(filter):'');
  try{const v=await api('/api/committee/'+route+suffix);if(epoch!==generation||route!==current)return;view=v;render()}catch(err){if(epoch===generation){root.textContent='Unable to load working area: '+err.message;status(err.message,true)}}
 }
 async function mutate(data){
  if(ro()||busy||!current)return;
  busy=true;const route=current,generation=epoch;const form=root.querySelector('form:focus-within'),btn=form?.querySelector('[type=submit]');if(btn)btn.disabled=true;
  try{
   const v=await api('/api/committee/'+route,{method:'POST',data});
   if(route!==current||generation!==epoch)return;
   request=null;
   if(route==='notices'&&archive||route==='todos'&&filter&&filter!=='all')await reload();else{view=v;render()}
   if(data.action==='post'){const d=root.querySelector('.ops-compose');if(d){d.open=false;d.querySelector('form').reset()}}
   say({post:data.kind==='action'?'Posted, and added to the officer’s to-do list.':'Posted to the committee.',seen:'Marked as read.',review:'Confirmed as current for another 30 days.',archive:'Moved to the archive.',add:'Added to the to-do list.',take:'You’ve taken this job.',complete:'Marked complete.',assign:'Job allocated.'}[data.action]||'Saved.');
  }catch(err){if(route===current&&generation===epoch)say('Not saved: '+err.message,true)}
  finally{busy=false;if(btn&&btn.isConnected)btn.disabled=ro()}
 }
 function printList(){
  const groups=[...new Set(view.tasks.filter(t=>!t.done&&!t.archived).map(t=>t.office||''))];
  const area=document.createElement('div');area.id='ops-paper-worklist';
  area.innerHTML=groups.map(k=>'<article><header><img src="/assets/sandy-original-logo.png" alt="Sandy Sports Club"><div><h1>Officer work list</h1><p>'+e(office(k))+' · '+date(view.today)+'</p></div></header><p>Tick completed jobs and write practical notes. Return to the Secretary or Assistant Secretary. Proposed responsibilities only.</p><table><thead><tr><th>Action and source</th><th>Due</th><th>Done</th></tr></thead><tbody>'+view.tasks.filter(t=>!t.done&&!t.archived&&(t.office||'')===k).map(t=>'<tr><td><strong>'+e(t.title)+'</strong><p>'+e(t.details)+'</p><small>'+e(t.source)+'</small><div class="ops-paper-line"></div></td><td>'+date(t.dueDate)+'<br>'+e(states[t.status]||t.status)+'</td><td>□</td></tr>').join('')+'</tbody></table><p>Returned by: ____________________  Date: ____________________</p><p>Additional notes: _____________________________________________</p></article>').join('')||'<article><h1>Sandy Sports Club officer work list</h1><p>No outstanding tasks.</p></article>';
  document.body.append(area);document.body.classList.add('ops-printing');try{window.print()}finally{area.remove();document.body.classList.remove('ops-printing')}
 }
 root.addEventListener('change',ev=>{
  const el=ev.target;
  if(el.id==='ops-office-filter'){filter=el.value;request=null;void reload()}
  if(el.matches('[data-ops-filter]')){const was=archive;archive=el.value==='archive';listMode=archive?'active':el.value;if(was!==archive)void reload();else render()}
  if(el.name==='kind'&&el.form?.id==='ops-notice-form'){const action=el.value==='action';el.form.querySelector('[data-info-fields]').hidden=action;el.form.querySelector('[data-action-fields]').hidden=!action;el.form.elements.dueDate.required=action}
 });
 root.addEventListener('submit',ev=>{
  ev.preventDefault();if(ro())return;
  const form=ev.target,raw=Object.fromEntries(new FormData(form));
  if(form.id==='ops-notice-form'||form.id==='ops-task-form'){
   let data=form.id==='ops-notice-form'?{action:'post',kind:raw.kind,title:raw.title,details:raw.details,scope:raw.scope,important:form.elements.important.checked,office:raw.office,dueDate:raw.dueDate,reviewDate:raw.kind==='info'?raw.reviewDate:''}:{action:'add',title:raw.title,details:raw.details,office:raw.office,dueDate:raw.dueDate};
   const key=JSON.stringify(data);if(!request||request.key!==key)request={key,id:crypto.randomUUID()};void mutate({...data,id:request.id});return;
  }
  if(form.matches('[data-ops-assign]')){const t=view.tasks.find(t=>t.id===form.closest('[data-ops-id]').dataset.opsId);if(t)void mutate({action:'assign',id:t.id,version:t.version,office:raw.office})}
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-ops-refresh')){await reload();return}
  if(b.dataset.opsOpen){await showDesk(b.dataset.opsOpen);return}
  if(b.hasAttribute('data-ops-print')){printList();return}
  const card=b.closest('[data-ops-id]');if(!card)return;
  const row=(current==='notices'?view.notices:view.tasks).find(x=>x.id===card.dataset.opsId);if(!row)return;
  if(b.hasAttribute('data-ops-history')){
   const panel=card.querySelector('[data-ops-history-panel]');if(!panel.hidden){panel.hidden=true;return}
   panel.hidden=false;panel.textContent='Loading revisions…';
   try{const data=await api('/api/suite/'+current+'/'+row.id+'/history');panel.innerHTML=(data.history||[]).map(x=>'<p><strong>Version '+x.version+'</strong> · '+e(x.office||x.role)+' · '+date(x.at)+' · '+e(x.operation)+'</p>').join('')||'<p>No recorded revisions.</p>'}catch(err){panel.textContent=err.message}return;
  }
  if(ro())return;
  if(b.dataset.noticeAction){const action=b.dataset.noticeAction;if(action==='archive'&&!window.confirm('Archive this notice? Its history will be retained.'))return;await mutate({action,id:row.id,version:row.version});return}
  if(b.dataset.taskAction){const action=b.dataset.taskAction;if(action==='paper'&&!window.confirm('Record this task as completed from the responsible office’s returned paper sheet?'))return;await mutate({action:action==='paper'?'complete':action,id:row.id,version:row.version,...(action==='take'?{}:{paper:action==='paper'})})}
 });
 async function quiet(){
  const route=current,generation=epoch,typing=root.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select');if(!route||busy||document.hidden||typing)return;
  const suffix=route==='notices'?(archive?'?archive=1':''):(filter&&filter!=='all'?'?office='+encodeURIComponent(filter):'');
  try{const v=await api('/api/committee/'+route+suffix);if(route===current&&generation===epoch&&!busy){view=v;render()}}catch{}
 }
 setInterval(()=>void quiet(),60000);window.addEventListener('focus',()=>void quiet());
 return {summary:loadSummary,close(){epoch++;current='';root.hidden=true;summary.hidden=true},async open(key){current=key;archive=false;filter='';listMode='active';request=null;summary.hidden=true;await reload();root.querySelector('#ops-desk-title')?.focus({preventScroll:true})}};
}
