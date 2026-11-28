// Money and kit: Club assets and loans, and the Grant register. Same desk pattern as the others.
// Assets use the equipment loan API (issue, return, maintenance, history). Grants move through a
// simple pipeline from idea to won, with the closing date as a dated job and a calendar reminder.
import {isReadOnlyView} from './club-view-client.js';
import {SUITE_BY_KEY} from './studio/sandy-suite-spec.js';
const longDate=d=>d?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00')):'';
const todayBris=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const days=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
const aud=n=>n==null||n===''?'':'$'+Number(n).toLocaleString('en-AU');
const OFFICES={webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee member'};
const STAGES=[['proposal','Idea'],['draft','Preparing'],['review','Ready to submit'],['scheduled','Submitted'],['completed','Won'],['rejected','Not successful'],['archived','Archived']];
const stageLabel=s=>(STAGES.find(x=>x[0]===s)||[,s])[1];

export const MONEY_DESKS=['equipment','grants'];
export function setupMoneyDesks({api,esc:e,status,showDesk}){
 const root=document.getElementById('committee-money-desk');
 if(!root)return {open(){},close(){}};
 let key='',spec=null,records=[],loans=[],current=null,filter='all',busy=false,epoch=0;
 const ro=()=>isReadOnlyView();
 const say=(msg,bad=false)=>{const n=root.querySelector('[data-mo-message]');if(n){n.textContent=msg;n.classList.toggle('bad',bad)}if(bad)status?.(msg,true)};
 const fieldOf=k=>spec.fields.find(f=>f.key===k);
 const LABELS_ALL={equipment:{assetType:'Type',tag:'Tag or number',location:'Where it is kept',quantity:'How many',condition:'Condition',maintenance:'Maintenance and condition notes'},
  grants:{funder:'Funder',scheme:'Grant program',officialUrl:'Guidelines or apply link',closingDate:'Closing date',amount:'Asking for (AUD)',eligibility:'Are we eligible?',applicant:'Who applies (if a partner is needed)',case:'What it pays for and why',officer:'Lead',attachments:'Documents, quotes and letters needed (one per line)',submission:'Submission and acquittal notes'}};
 function input(k,val,lock){
  const f=fieldOf(k),d=lock?' disabled':'',v=val??'',lab=e((LABELS_ALL[key]||{})[k]||f.label);
  if(f.type==='checkbox')return '<label class="ops-check"><input type="checkbox" name="'+k+'"'+(v?' checked':'')+d+'> '+lab+'</label>';
  if(f.type==='select')return '<label>'+lab+'<select name="'+k+'"'+d+'><option value="">Choose…</option>'+f.options.map(o=>'<option'+(o===v?' selected':'')+'>'+e(o)+'</option>').join('')+'</select></label>';
  if(f.type==='textarea'||f.type==='lines')return '<label>'+lab+'<textarea name="'+k+'" rows="3"'+d+'>'+e(v)+'</textarea></label>';
  const t={date:'date',number:'number',url:'url'}[f.type]||'text';
  return '<label>'+lab+'<input type="'+t+'" name="'+k+'" value="'+e(v)+'"'+(t==='number'?' min="0"':' maxlength="300"')+d+'></label>';
 }
 const values=(form,keys)=>{const o={};for(const k of keys){const f=fieldOf(k),el=form.elements[k];if(!el)continue;o[k]=f.type==='checkbox'?el.checked:f.type==='number'?(el.value===''?'':Number(el.value)):el.value.trim()}return o};
 const grid=(keys,vals,lock)=>'<div class="ops-form-grid">'+keys.map(k=>input(k,vals[k],lock)).join('')+'</div>';

 // ---------- Club assets and loans ----------
 const loanOf=id=>loans.find(l=>l.id===id);
 function assetsList(){
  const shown=records.filter(r=>{const l=loanOf(r.id);return filter==='loan'?l?.onLoan:filter==='overdue'?l?.onLoan?.overdue:filter==='repair'?['Inspect','Repair'].includes(r.fields.condition):r.status!=='archived'});
  const onLoan=loans.filter(l=>l.onLoan).length,overdue=loans.filter(l=>l.onLoan?.overdue).length,repair=records.filter(r=>['Inspect','Repair'].includes(r.fields.condition)).length;
  return '<div class="md-stats">'+[[records.length,'items'],[onLoan,'on loan'],[overdue,'overdue',overdue?'warn':''],[repair,'to inspect or repair',repair?'warn':'']].map(([n,l,t])=>'<div class="md-stat '+(t||'')+'"><strong>'+n+'</strong><span>'+l+'</span></div>').join('')+'</div>'+
   '<details class="ops-compose"'+(records.length?'':' open')+'><summary>Add an item</summary><form data-mo-new><fieldset'+(ro()?' disabled':'')+'><label>What is it?<input name="__title" required maxlength="160" placeholder="e.g. Volleyball net set (Mikasa)"></label>'+grid(['assetType','tag','location','quantity','condition'],{condition:'New',quantity:1},false)+'<button type="submit">Add to the register</button></fieldset></form></details>'+
   '<label class="mo-filter">Show<select data-mo-filter><option value="all">Everything</option><option value="loan">On loan</option><option value="overdue">Overdue</option><option value="repair">To inspect or repair</option></select></label>'+
   (shown.length?'<ul class="mt-list">'+shown.map(r=>{const l=loanOf(r.id);return '<li><button type="button" data-mo-open="'+e(r.id)+'" aria-current="'+(current?.id===r.id)+'"><strong>'+e(r.title)+'</strong><span>'+e([r.fields.assetType,r.fields.quantity>1&&'×'+r.fields.quantity,r.fields.location].filter(Boolean).join(' · '))+'</span><span class="ops-badges">'+
    (l?.onLoan?'<span class="ops-pill '+(l.onLoan.overdue?'ops-red':'ops-amber')+'">'+(l.onLoan.overdue?'Overdue':'On loan')+': '+e(l.onLoan.holder)+'</span>':'<span class="ops-pill ops-green">In store</span>')+(['Inspect','Repair','Retired'].includes(r.fields.condition)?'<span class="ops-pill ops-muted">'+e(r.fields.condition)+'</span>':'')+'</span></button></li>'}).join('')+'</ul>':'<p class="ops-empty">'+(records.length?'Nothing matches.':'No gear on the register yet. Add each item as it arrives.')+'</p>');
 }
 function assetDetail(){
  if(!current)return '<p class="ops-empty">Choose an item.</p>';
  const l=loanOf(current.id),f=current.fields,cond=spec.fields.find(x=>x.key==='condition').options,lock=ro()||current.status==='archived';
  const condSel=(n,v)=>'<select name="'+n+'">'+cond.map(o=>'<option'+(o===v?' selected':'')+'>'+e(o)+'</option>').join('')+'</select>';
  return '<header class="mt-head"><div><h4 tabindex="-1">'+e(current.title)+'</h4><p>'+e([f.assetType,f.tag&&'Tag '+f.tag,f.location,f.condition].filter(Boolean).join(' · '))+'</p></div></header>'+
   '<section class="pd-publish"><h5>'+(l?.onLoan?'On loan to '+e(l.onLoan.holder):'Lend it out')+'</h5>'+
   (l?.onLoan?'<p>Out since '+e(longDate(l.onLoan.out))+(l.onLoan.due?', due back '+e(longDate(l.onLoan.due)):'')+(l.onLoan.overdue?' <strong class="mo-late">('+l.onLoan.daysOverdue+' days overdue)</strong>':'')+'.</p>'+
    '<form data-mo-return><fieldset'+(lock?' disabled':'')+'><div class="ops-form-grid"><label>Condition on return'+condSel('condition',f.condition)+'</label><label>Note (optional)<input name="note" maxlength="300" placeholder="e.g. One pole bent"></label></div><button type="submit">Record the return</button></fieldset></form>':
    (['Retired','Repair'].includes(f.condition)?'<p class="mt-help">Not available while it is marked '+e(f.condition)+'.</p>':
    '<form data-mo-lend><fieldset'+(lock?' disabled':'')+'><div class="ops-form-grid"><label>Who has it?<input name="holder" required maxlength="120" placeholder="Name or team"></label><label>Due back<input type="date" name="dueDate" min="'+todayBris()+'"></label><label>Condition going out'+condSel('condition',f.condition)+'</label></div><button type="submit">Lend it out</button></fieldset></form>'))+'</section>'+
   '<details class="ops-compose"><summary>Log maintenance or an inspection</summary><form data-mo-maint><fieldset'+(lock?' disabled':'')+'><div class="ops-form-grid"><label>Condition now'+condSel('condition',f.condition)+'</label></div><label>What was done or found<textarea name="note" rows="2" required></textarea></label><button type="submit">Save to the log</button></fieldset></form></details>'+
   '<details class="ops-compose"><summary>Edit details</summary><form data-mo-edit><fieldset'+(lock?' disabled':'')+'><label>Name<input name="__title" value="'+e(current.title)+'" maxlength="160" required></label>'+grid(['assetType','tag','location','quantity'],f,false)+'<button type="submit">Save</button></fieldset></form></details>'+
   '<h5>History</h5>'+(l?.history?.length?'<ul class="md-plain">'+[...l.history].reverse().slice(0,20).map(h=>'<li>'+e(longDate(String(h.at).slice(0,10)))+': '+e({issued:'Lent to '+h.holder+(h.due?' until '+longDate(h.due):''),returned:'Returned by '+h.holder+(h.late?' (late)':'')+(h.note?'. '+h.note:''),maintenance:'Maintenance: '+h.note}[h.event]||h.event)+(h.condition?' · '+e(h.condition):'')+' · '+e(h.by)+'</li>').join('')+'</ul>':'<p class="ops-empty">No loans or maintenance yet.</p>')+
   (current.status==='archived'?'':'<div class="ops-actions"><button type="button" class="pd-cancel" data-mo-retire'+(ro()||l?.onLoan?' disabled':'')+'>Remove from the register</button></div>');
 }
 // ---------- Grant register ----------
 function grantsList(){
  const t=todayBris(),open=records.filter(r=>!['completed','rejected','archived'].includes(r.status)),won=records.filter(r=>r.status==='completed'),sum=list=>list.reduce((n,r)=>n+(Number(r.fields.amount)||0),0);
  const soon=open.filter(r=>r.fields.closingDate&&r.fields.closingDate>=t&&days(t,r.fields.closingDate)<=21).length;
  const shown=records.filter(r=>filter==='all'?r.status!=='archived':filter==='open'?open.includes(r):r.status===filter).sort((a,b)=>(a.fields.closingDate||'9').localeCompare(b.fields.closingDate||'9'));
  return '<div class="md-stats">'+[[open.length,'being worked on'],[soon,'close within 3 weeks',soon?'warn':''],[aud(sum(open))||'$0','asked for'],[aud(sum(won))||'$0','won','good']].map(([n,l,tn])=>'<div class="md-stat '+(tn||'')+'"><strong>'+n+'</strong><span>'+l+'</span></div>').join('')+'</div>'+
   '<details class="ops-compose"'+(records.length?'':' open')+'><summary>Add a grant</summary><form data-mo-new><fieldset'+(ro()?' disabled':'')+'><label>Grant name<input name="__title" required maxlength="160" placeholder="e.g. Get Playing Places and Spaces"></label>'+grid(['funder','closingDate','amount','officialUrl'],{},false)+'<button type="submit">Add to the register</button></fieldset></form></details>'+
   '<p class="mt-help">Browse open grants on the public <a href="/grants.html">Grants and funding</a> page; officers can add one straight to this register.</p>'+
   '<label class="mo-filter">Show<select data-mo-filter><option value="all">Everything</option><option value="open">Being worked on</option>'+STAGES.slice(0,6).map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label>'+
   (shown.length?'<ul class="mt-list">'+shown.map(r=>{const c=r.fields.closingDate,left=c?days(t,c):null,live=!['completed','rejected','archived','scheduled'].includes(r.status);
    return '<li><button type="button" data-mo-open="'+e(r.id)+'" aria-current="'+(current?.id===r.id)+'"><strong>'+e(r.title)+'</strong><span>'+e([r.fields.funder,aud(r.fields.amount)].filter(Boolean).join(' · '))+'</span><span class="ops-badges"><span class="ops-pill ops-muted">'+e(stageLabel(r.status))+'</span>'+
     (c&&live?'<span class="ops-pill '+(left<0?'ops-muted':left<=7?'ops-red':left<=21?'ops-amber':'ops-green')+'">'+(left<0?'Closed '+e(longDate(c)):left===0?'Closes today':'Closes in '+left+' days')+'</span>':'')+'</span></button></li>'}).join('')+'</ul>':'<p class="ops-empty">'+(records.length?'Nothing matches.':'No grants on the register yet.')+'</p>');
 }
 function grantDetail(){
  if(!current)return '<p class="ops-empty">Choose a grant.</p>';
  const f=current.fields,docs=String(f.attachments||'').split('\n').map(x=>x.trim()).filter(Boolean),t=todayBris(),left=f.closingDate?days(t,f.closingDate):null;
  return '<header class="mt-head"><div><h4 tabindex="-1">'+e(current.title)+'</h4><p>'+e([f.funder,aud(f.amount),f.closingDate&&'closes '+longDate(f.closingDate)].filter(Boolean).join(' · '))+'</p></div><span class="ops-pill ops-muted">'+e(stageLabel(current.status))+'</span></header>'+
   (f.officialUrl?'<p><a href="'+e(f.officialUrl)+'" target="_blank" rel="noopener noreferrer">Open the official guidelines</a></p>':'')+
   '<nav class="mt-steps" aria-label="Grant stage">'+STAGES.slice(0,6).map(([k,l])=>'<button type="button" data-mo-stage="'+k+'" aria-pressed="'+(current.status===k)+'"'+(ro()?' disabled':'')+'>'+l+'</button>').join('')+'</nav>'+
   (docs.length?'<section class="pd-publish"><h5>Documents needed</h5><ul class="md-plain">'+docs.map(d=>'<li>'+e(d)+'</li>').join('')+'</ul></section>':'')+
   (f.closingDate&&left>=0&&!['completed','rejected','archived','scheduled'].includes(current.status)?'<section class="pd-publish"><h5>Don’t miss the deadline</h5><form data-mo-job class="mo-inline"><label>Give the deadline to<select name="office">'+Object.entries(OFFICES).map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label><button type="submit"'+(ro()?' disabled':'')+'>Put it on their to-do list</button><button type="button" data-mo-ics>Add to my calendar</button></form></section>':'')+
   '<form data-mo-edit><fieldset'+(ro()?' disabled':'')+'><label>Grant name<input name="__title" value="'+e(current.title)+'" maxlength="160" required></label>'+grid(['funder','scheme','closingDate','amount','eligibility','officer','applicant','officialUrl'],f,false)+
   input('case',f.case)+input('attachments',f.attachments)+input('submission',f.submission)+'<button type="submit">Save</button></fieldset></form>';
 }
 function render(){
  const g=key==='grants';
  root.innerHTML='<header class="ops-header"><div><h3 id="mo-desk-title" tabindex="-1">'+(g?'Grant register':'Club assets and loans')+'</h3><p>'+(g?'Track grants from first idea to money in the bank: deadlines, what each one pays for, documents needed and who is leading it.':'Every piece of club gear: where it is, its condition, who has it on loan and when it is due back.')+'</p></div><button type="button" data-mo-refresh>Check now</button></header>'+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+'<p data-mo-message role="status"></p>'+
   '<div class="mt-layout"><aside class="mt-aside">'+(g?grantsList():assetsList())+'</aside><section class="mt-detail">'+(g?grantDetail():assetDetail())+'</section></div>';
  const fs=root.querySelector('[data-mo-filter]');if(fs)fs.value=filter;
 }
 async function refresh(id=current?.id){
  const my=++epoch;
  try{
   const [r,l]=await Promise.all([api('/api/suite/'+key),key==='equipment'?api('/api/committee/equipment/loans'):Promise.resolve({items:[]})]);
   if(my!==epoch)return;records=r.records||[];loans=l.items||[];
   current=records.find(x=>x.id===id)||records.find(x=>x.status!=='archived')||null;render();
  }catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load this desk: '+e(err.message)+'</p>';status?.(err.message,true)}}
 }
 async function guarded(fn){if(busy||ro())return;busy=true;for(const b of root.querySelectorAll('button'))b.disabled=true;try{const msg=await fn();await refresh();if(msg)say(msg)}catch(err){await refresh();say(err.message,true)}finally{busy=false}}
 const save=(changes,st)=>api('/api/suite/'+key+'/'+current.id,{method:'PATCH',data:{version:current.version,title:changes.title??current.title,status:st||current.status,fields:{...current.fields,...changes.fields}}});
 const loan=data=>api('/api/committee/equipment/'+current.id+'/loan',{method:'POST',data:{...data,version:current.version}});
 root.addEventListener('change',ev=>{if(ev.target.matches('[data-mo-filter]')){filter=ev.target.value;render()}});
 root.addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.target,v=Object.fromEntries(new FormData(form));if(ro())return;
  if(form.matches('[data-mo-new]'))return guarded(async()=>{
   const keys=key==='grants'?['funder','closingDate','amount','officialUrl']:['assetType','tag','location','quantity','condition'];
   const r=await api('/api/suite/'+key,{method:'POST',data:{title:v.__title.trim(),status:key==='grants'?'proposal':'draft',fields:values(form,keys)}});current={id:r.id};
   return key==='grants'?'Grant added. Fill in what it pays for and the documents needed.':'Added to the register.';
  });
  if(form.matches('[data-mo-edit]'))return guarded(async()=>{const keys=key==='grants'?spec.fields.map(f=>f.key):['assetType','tag','location','quantity'];await save({title:v.__title.trim(),fields:values(form,keys)});return 'Saved.'});
  if(form.matches('[data-mo-lend]'))return guarded(async()=>{await loan({action:'issue',holder:v.holder.trim(),dueDate:v.dueDate,condition:v.condition});return 'Lent to '+v.holder.trim()+'.'});
  if(form.matches('[data-mo-return]'))return guarded(async()=>{await loan({action:'return',condition:v.condition,note:v.note});return 'Return recorded.'});
  if(form.matches('[data-mo-maint]'))return guarded(async()=>{await loan({action:'maintenance',condition:v.condition,note:v.note});return 'Saved to the maintenance log.'});
  if(form.matches('[data-mo-job]'))return guarded(async()=>{
   const f=current.fields,due=new Date(Date.parse(f.closingDate+'T00:00:00Z')-7*864e5).toISOString().slice(0,10);
   await api('/api/committee/todos',{method:'POST',data:{action:'add',id:crypto.randomUUID(),title:'Submit grant: '+current.title,details:[f.funder,f.officialUrl,'Closes '+longDate(f.closingDate)].filter(Boolean).join(' · '),office:v.office,dueDate:due<todayBris()?f.closingDate:due}});
   return 'On the '+OFFICES[v.office]+'’s to-do list, due a week before it closes.';
  });
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-mo-refresh')){await refresh();say('Up to date.');return}
  if(b.dataset.moOpen){await refresh(b.dataset.moOpen);root.querySelector('.mt-head h4')?.focus();if(matchMedia('(max-width:820px)').matches)root.querySelector('.mt-detail')?.scrollIntoView({block:'start'});return}
  if(b.dataset.moStage)return guarded(async()=>{await save({},b.dataset.moStage);return 'Moved to '+stageLabel(b.dataset.moStage)+'.'});
  if(b.hasAttribute('data-mo-retire')){if(!confirm('Remove “'+current.title+'” from the register? Its history is kept.'))return;return guarded(async()=>{await save({},'archived');return 'Removed from the register.'})}
  if(b.hasAttribute('data-mo-ics')){
   const f=current.fields,d=f.closingDate.replaceAll('-',''),next=new Date(Date.parse(f.closingDate+'T00:00:00Z')+864e5).toISOString().slice(0,10).replaceAll('-',''),x=s=>String(s||'').replace(/[\\;,]/g,m=>'\\'+m);
   const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//Grants//EN','BEGIN:VEVENT','UID:grant-'+current.id+'@sandy-sports-club','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z','DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+next,'SUMMARY:'+x('Grant closes: '+current.title),'DESCRIPTION:'+x([f.funder,f.officialUrl].filter(Boolean).join(' ')),'BEGIN:VALARM','TRIGGER:-P7D','ACTION:DISPLAY','DESCRIPTION:'+x('Grant closes in a week: '+current.title),'END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='Grant deadline.ics';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);say('Calendar file saved, with a reminder a week before.');return;
  }
 });
 return {
  async open(k){key=k;spec=SUITE_BY_KEY[k];filter='all';current=null;root.hidden=false;root.textContent='Loading…';await refresh();root.querySelector('#mo-desk-title')?.focus({preventScroll:true})},
  close(){epoch++;root.hidden=true}
 };
}
