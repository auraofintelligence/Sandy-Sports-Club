// Comms and records: Newsletter, Documents, Officer handover, Message delivery, Ready SETCO requests.
// Same desk pattern. Nothing here sends email by itself: Message delivery builds the consented
// recipient list and the text, the officer sends from their own email, then marks it sent.
import {isReadOnlyView} from './club-view-client.js';
import {SUITE_BY_KEY} from './studio/sandy-suite-spec.js';
import {OFFICES} from './studio/sandy-access.js';
const longDate=d=>d?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00')):'';
const monthName=m=>m?new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(m+'-15T12:00:00+10:00')):'';
const todayBris=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const plusMonths=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCMonth(x.getUTCMonth()+n);return x.toISOString().slice(0,10)};
const lines=s=>String(s||'').split('\n').map(x=>x.trim()).filter(Boolean);
const STD_DOCS=['Draft constitution','Privacy policy','Child safe policy and code of conduct','Risk register','Insurance certificate of currency','Venue hire agreements','Grievance procedure'];
const RECIPIENTS={all:'All members who agreed to be contacted',film:'Film Club members who agreed to be contacted',unverified:'Members without a blue tick (contact agreed)',interest:'People who registered interest but have not joined'};

const CONFIG={
 news:{title:'Newsletter',help:'Put together a newsletter issue, preview it, then share it as a notice or send it by email through Message delivery.',noun:'issue',newLabel:'Start an issue',
  create:['editionMonth','headline'],labels:{editionMonth:'Month',headline:'Headline',audience:'Who it is for',lead:'Opening note',articles:'Stories (one per line: Title | text)',eventRoundup:'What’s on',acknowledgements:'Thank-yous (sponsors, helpers)',editor:'Editor',reviewNotes:'Notes for the reviewer',mediaRightsChecked:'Photo and media permissions checked',contactConsentChecked:'Only sending to people who agreed'},
  name:f=>f.headline||('Newsletter '+monthName(f.editionMonth)),line:f=>monthName(f.editionMonth),date:f=>f.editionMonth?f.editionMonth+'-01':'',
  stages:[['draft','Writing'],['review','Ready to check'],['completed','Sent']]},
 documents:{title:'Documents',help:'One list of the club’s important documents: where each lives, who looks after it, who can see it, and when it is next reviewed.',noun:'document',newLabel:'Add a document',
  create:['documentType','visibility','sourceUrl','custodian'],labels:{documentType:'What kind',visibility:'Who can see it',custodian:'Looked after by',sourceUrl:'Link to where it is kept (https)',versionLabel:'Version or date',reviewDate:'Next review',summary:'Summary and how long to keep it'},
  line:f=>[f.documentType,f.visibility].filter(Boolean).join(' · '),date:f=>f.reviewDate||''},
 handover:{title:'Officer handover',help:'When someone hands over an office, list the regular duties, open jobs, documents and logins to pass on, and record that the new person has taken them on.',noun:'handover',newLabel:'Start a handover',
  create:['office','from','to','transferDate'],labels:{office:'Office',from:'Handing over',to:'Taking over',transferDate:'Handover date',duties:'Regular duties (one per line)',openTasks:'Open jobs (one per line)',resources:'Documents, logins and keys to pass on (one per line)',handoverNotes:'Notes',recipientAcknowledged:'The new office holder has taken on these responsibilities'},
  line:f=>[f.from,f.to].filter(Boolean).join(' → '),date:f=>f.transferDate||''},
 'email-queue':{title:'Message delivery',help:'Messages waiting to go out. The site does not send email: it builds the list of people who agreed to be contacted and the text, you send it from your own email, then mark it sent.',noun:'message',newLabel:'Write a message',
  create:['subject','recipientGroup','sendAfter'],labels:{subject:'Subject',recipientGroup:'Who it goes to',body:'Message',responsible:'Sent by',sendAfter:'Send on or after',consentVerified:'Only going to people who agreed to be contacted',deliveryLog:'Delivery notes'},
  line:f=>RECIPIENTS[f.recipientGroup]||f.recipientGroup,date:f=>f.sendAfter||'',stages:[['draft','Draft'],['review','Ready to send'],['completed','Sent']]},
 'ready-setco':{title:'Ready SETCO requests',help:'Requests for help from the Ready SET Co-op: what is needed, the budget, conditions, and the written agreement. Nothing is agreed until both sides accept in writing.',noun:'request',newLabel:'Write a request',
  create:['request','service','sandyOwner','estimatedCost'],labels:{request:'What we need',service:'Kind of help',sandyOwner:'Our contact',partnerContact:'Ready SETCO contact',scope:'Exactly what is included and what is not',estimatedCost:'Budget (AUD, separate from C-Hours)',conditions:'Permits, safety and other conditions (one per line)',consentChecked:'Privacy and data-sharing limits agreed',writtenAcceptance:'Written agreement (reference and status)'},
  name:f=>f.request,line:f=>[f.service,f.estimatedCost?'$'+Number(f.estimatedCost).toLocaleString('en-AU'):''].filter(Boolean).join(' · '),date:()=>'',
  stages:[['proposal','Idea'],['draft','Drafted'],['review','Sent to Ready SETCO'],['scheduled','Agreed in writing'],['completed','Done'],['rejected','Declined']]}
};
export const RECORD_DESKS=Object.keys(CONFIG);

export function setupRecordsDesks({api,esc:e,status,showDesk}){
 const root=document.getElementById('committee-records-desk');
 if(!root)return {open(){},close(){}};
 let key='',cfg=null,spec=null,records=[],current=null,extra={},busy=false,epoch=0;
 const ro=()=>isReadOnlyView(),off=()=>current?.status==='archived';
 const say=(msg,bad=false)=>{const n=root.querySelector('[data-rd-message]');if(n){n.textContent=msg;n.classList.toggle('bad',bad)}if(bad)status?.(msg,true)};
 const fieldOf=k=>spec.fields.find(f=>f.key===k);
 function input(k,val,lock){
  const f=fieldOf(k),d=lock?' disabled':'',v=val??'',lab=e(cfg.labels[k]||f.label);
  if(k==='office')return '<label>'+lab+'<select name="office"'+d+'><option value="">Choose…</option>'+Object.values(OFFICES).map(o=>'<option'+(o===v?' selected':'')+'>'+e(o)+'</option>').join('')+'</select></label>';
  if(k==='recipientGroup')return '<label>'+lab+'<select name="recipientGroup"'+d+'>'+Object.entries(RECIPIENTS).map(([kk,l])=>'<option value="'+kk+'"'+(kk===v?' selected':'')+'>'+e(l)+'</option>').join('')+'</select></label>';
  if(f.type==='checkbox')return '<label class="ops-check"><input type="checkbox" name="'+k+'"'+(v?' checked':'')+d+'> '+lab+'</label>';
  if(f.type==='select')return '<label>'+lab+'<select name="'+k+'"'+d+'><option value="">Choose…</option>'+f.options.map(o=>'<option'+(o===v?' selected':'')+'>'+e(o)+'</option>').join('')+'</select></label>';
  if(f.type==='textarea'||f.type==='lines')return '<label>'+lab+'<textarea name="'+k+'" rows="'+(k==='body'||k==='lead'||k==='articles'?6:3)+'"'+d+'>'+e(v)+'</textarea></label>';
  const t={date:'date',number:'number',url:'url',month:'month'}[f.type]||'text';
  return '<label>'+lab+'<input type="'+t+'" name="'+k+'" value="'+e(v)+'"'+(t==='number'?' min="0"':' maxlength="300"')+d+'></label>';
 }
 const short=k=>{const t=fieldOf(k).type;return !['textarea','lines','checkbox'].includes(t)};
 const formFields=(keys,vals,lock)=>{const s=keys.filter(short),l=keys.filter(k=>!short(k)&&fieldOf(k).type!=='checkbox'),c=keys.filter(k=>fieldOf(k).type==='checkbox');
  return (s.length?'<div class="ops-form-grid">'+s.map(k=>input(k,vals[k],lock)).join('')+'</div>':'')+l.map(k=>input(k,vals[k],lock)).join('')+c.map(k=>input(k,vals[k],lock)).join('')};
 const values=(form,keys)=>{const o={};for(const k of keys){const f=fieldOf(k),el=form.elements[k];if(!el)continue;o[k]=f.type==='checkbox'?el.checked:f.type==='number'?(el.value===''?'':Number(el.value)):el.value.trim()}return o};
 const stageLabel=s=>(cfg.stages||[]).find(x=>x[0]===s)?.[1]||'';
 function badge(r){
  const t=todayBris();
  if(r.status==='archived')return '<span class="ops-pill ops-muted">Archived</span>';
  if(key==='documents'){const d=r.fields.reviewDate;return d?(d<t?'<span class="ops-pill ops-red">Review overdue</span>':d<=plusMonths(t,1)?'<span class="ops-pill ops-amber">Review soon</span>':'<span class="ops-pill ops-green">Current</span>'):'<span class="ops-pill ops-muted">No review date</span>'}
  if(key==='handover')return r.fields.recipientAcknowledged?'<span class="ops-pill ops-green">Taken on</span>':'<span class="ops-pill ops-amber">In progress</span>';
  const st=stageLabel(r.status);return st?'<span class="ops-pill '+(r.status==='completed'||r.status==='scheduled'?'ops-green':r.status==='rejected'?'ops-muted':'ops-amber')+'">'+e(st)+'</span>':'';
 }
 function listView(){
  const groups=key==='documents'?[...new Set(records.filter(r=>r.status!=='archived').map(r=>r.fields.visibility||'Not set'))].sort():null;
  const row=r=>'<li><button type="button" data-rd-open="'+e(r.id)+'" aria-current="'+(current?.id===r.id)+'"><strong>'+e(r.title)+'</strong><span>'+e([cfg.line(r.fields),key==='news'?'':longDate(cfg.date(r.fields))].filter(Boolean).join(' · '))+'</span><span class="ops-badges">'+badge(r)+'</span></button></li>';
  const live=records.filter(r=>r.status!=='archived').sort((a,b)=>(cfg.date(b.fields)||'').localeCompare(cfg.date(a.fields)||'')),gone=records.filter(r=>r.status==='archived');
  const missing=key==='documents'?STD_DOCS.filter(d=>!records.some(r=>r.title.toLowerCase()===d.toLowerCase())):[];
  return '<details class="ops-compose"'+(records.length?'':' open')+'><summary>'+e(cfg.newLabel)+'</summary><form data-rd-new><fieldset'+(ro()?' disabled':'')+'>'+(cfg.name?'':'<label>Name<input name="__title" required maxlength="160" placeholder="'+(key==='handover'?'e.g. Secretary handover':'e.g. Child safe policy')+'"></label>')+formFields(cfg.create,{},false)+'<button type="submit">Create</button></fieldset></form></details>'+
   (missing.length?'<div class="rd-suggest"><p>Most clubs keep these. Add one to the list:</p>'+missing.map(d=>'<button type="button" data-rd-std="'+e(d)+'"'+(ro()?' disabled':'')+'>+ '+e(d)+'</button>').join('')+'</div>':'')+
   (groups?groups.map(g=>'<h4>'+e(g)+'</h4><ul class="mt-list">'+live.filter(r=>(r.fields.visibility||'Not set')===g).map(row).join('')+'</ul>').join(''):live.length?'<ul class="mt-list">'+live.map(row).join('')+'</ul>':'')+
   (!live.length&&!groups?.length?'<p class="ops-empty">Nothing yet.</p>':'')+(gone.length?'<details class="ops-compose"><summary>Archived ('+gone.length+')</summary><ul class="mt-list">'+gone.map(row).join('')+'</ul></details>':'');
 }
 // ---- per-desk panels ----
 function newsPreview(f){
  const stories=lines(f.articles).map(l=>{const [h,...b]=l.split('|');return '<h4>'+e(h.trim())+'</h4>'+(b.length?'<p>'+e(b.join('|').trim())+'</p>':'')}).join('');
  return '<article class="rd-news"><p class="rd-news-kicker">SANDY SPORTS · '+e(monthName(f.editionMonth).toUpperCase())+'</p><h3>'+e(f.headline||'Newsletter')+'</h3>'+(f.lead?'<p>'+e(f.lead).replace(/\n/g,'<br>')+'</p>':'')+stories+
   (f.eventRoundup?'<h4>What’s on</h4><p>'+e(f.eventRoundup).replace(/\n/g,'<br>')+'</p>':'')+(f.acknowledgements?'<h4>Thank you</h4><p>'+e(f.acknowledgements).replace(/\n/g,'<br>')+'</p>':'')+'</article>';
 }
 const newsText=(f)=>[f.headline,monthName(f.editionMonth),'',f.lead,'',...lines(f.articles).flatMap(l=>{const [h,...b]=l.split('|');return [h.trim(),b.join('|').trim(),'']}),f.eventRoundup?'What’s on\n'+f.eventRoundup+'\n':'',f.acknowledgements?'Thank you\n'+f.acknowledgements:''].filter(x=>x!==undefined).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 function panel(){
  const f=current.fields;
  if(key==='news'){
   const ok=f.mediaRightsChecked&&f.contactConsentChecked;
   return '<section class="pd-publish"><h5>Preview</h5>'+newsPreview(f)+'<div class="ops-actions"><button type="button" data-rd-roundup'+(ro()?' disabled':'')+'>Fill “What’s on” from the calendar</button><button type="button" data-rd-thanks'+(ro()?' disabled':'')+'>Add sponsor thank-yous</button><button type="button" data-rd-print>Print or save as PDF</button></div>'+
    (ok?'<div class="ops-actions"><button type="button" class="rd-go" data-rd-notice'+(ro()?' disabled':'')+'>Share with members as a notice</button><button type="button" class="rd-go" data-rd-queue'+(ro()?' disabled':'')+'>Send by email (Message delivery)</button></div>':'<p class="mt-help">Tick both checks below before it goes to members.</p>')+'</section>';
  }
  if(key==='documents'){
   return '<section class="pd-publish">'+(f.sourceUrl?'<p><a href="'+e(f.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Open the document</a></p>':'<p class="mt-help">Add a link to where the document is kept (Google Drive, OneDrive and so on). The site stores the link, not the file.</p>')+
    '<div class="ops-actions"><button type="button" data-rd-reviewed'+(ro()||off()?' disabled':'')+'>Reviewed today: next review in 12 months</button></div></section>';
  }
  if(key==='handover'){
   const tasks=extra.tasks||[];
   return '<section class="pd-publish"><h5>Checklist</h5><ul class="rd-check">'+[['Regular duties listed',lines(f.duties).length],['Open jobs listed',lines(f.openTasks).length],['Documents, logins and keys listed',lines(f.resources).length],['New office holder has taken it on',f.recipientAcknowledged]].map(([l,ok])=>'<li class="'+(ok?'ok':'')+'">'+(ok?'✓':'○')+' '+e(l)+'</li>').join('')+'</ul>'+
    '<div class="ops-actions"><button type="button" data-rd-fill'+(ro()||off()?' disabled':'')+'>Fill duties and open jobs for this office</button><button type="button" data-rd-print>Print the handover pack</button><a class="md-btn ghost" href="#accounts">Manage club access</a></div>'+
    '<p class="mt-help">Under rule 4A the outgoing person’s access ends when they leave office. Close or hand over their account in Manage club access.</p>'+(tasks.length?'':'')+'</section>';
  }
  if(key==='email-queue'){
   const people=extra.recipients||[];
   return '<section class="pd-publish"><h5>Send it</h5><p>'+e(RECIPIENTS[f.recipientGroup]||'Choose who it goes to')+': <strong>'+people.length+'</strong> '+(people.length===1?'person':'people')+'.</p>'+
    (f.consentVerified?'<div class="ops-actions"><button type="button" data-rd-copy="bcc"'+(people.length?'':' disabled')+'>Copy email addresses (for BCC)</button><button type="button" data-rd-copy="body">Copy the message</button>'+(people.length&&people.length<=40?'<a class="md-btn ghost" href="'+e('mailto:?bcc='+encodeURIComponent(people.join(','))+'&subject='+encodeURIComponent(f.subject||current.title)+'&body='+encodeURIComponent((f.body||'').slice(0,1500)))+'">Open in my email</a>':'')+'</div>'+
     '<p class="mt-help">Always put the addresses in BCC so members cannot see each other’s emails.</p>'+(current.status!=='completed'?'<button type="button" class="rd-go" data-rd-sent'+(ro()?' disabled':'')+'>I’ve sent it: mark as sent</button>':'<p class="mt-result">Sent. See the delivery notes below.</p>'):'<p class="mt-help">Tick “Only going to people who agreed to be contacted” below to unlock sending.</p>')+'</section>';
  }
  if(key==='ready-setco'){
   return '<section class="pd-publish"><h5>Send the request</h5><p class="mt-help">Copy it into an email to Ready SETCO. Move it to “Agreed in writing” only once both sides have accepted in writing.</p><div class="ops-actions"><button type="button" data-rd-copy="request">Copy the request</button></div></section>';
  }
  return '';
 }
 function detailView(){
  if(!current)return '<p class="ops-empty">'+(records.length?'Choose one from the list.':'Your '+cfg.noun+'s will show here.')+'</p>';
  const f=current.fields;
  return '<header class="mt-head"><div><h4 tabindex="-1">'+e(current.title)+'</h4><p>'+e([cfg.line(f),key==='news'?'':longDate(cfg.date(f))].filter(Boolean).join(' · '))+'</p></div>'+badge(current)+'</header>'+
   (cfg.stages&&!off()?'<nav class="mt-steps" aria-label="Stage">'+cfg.stages.map(([k,l])=>'<button type="button" data-rd-stage="'+k+'" aria-pressed="'+(current.status===k)+'"'+(ro()?' disabled':'')+'>'+l+'</button>').join('')+'</nav>':'')+
   panel()+'<form data-rd-edit><fieldset'+(ro()||off()?' disabled':'')+'><label>Name<input name="__title" value="'+e(current.title)+'" maxlength="160" required></label>'+formFields(spec.fields.map(x=>x.key),f,false)+'<button type="submit">Save</button></fieldset></form>'+
   '<div class="ops-actions">'+(off()?'<button type="button" data-rd-restore'+(ro()?' disabled':'')+'>Restore</button>':'<button type="button" class="pd-cancel" data-rd-archive'+(ro()?' disabled':'')+'>Archive</button>')+'</div>';
 }
 function render(){
  root.innerHTML='<header class="ops-header"><div><h3 id="rd-desk-title" tabindex="-1">'+e(cfg.title)+'</h3><p>'+e(cfg.help)+'</p></div><button type="button" data-rd-refresh>Check now</button></header>'+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+'<p data-rd-message role="status"></p><div class="mt-layout"><aside class="mt-aside">'+listView()+'</aside><section class="mt-detail">'+detailView()+'</section></div>';
 }
 async function recipientsFor(group){
  if(group==='interest'){const [i,m]=await Promise.all([api('/api/interest').catch(()=>({interests:[]})),api('/api/committee/member-profiles').catch(()=>({members:[]}))]);const joined=new Set((m.members||[]).map(x=>(x.email||'').toLowerCase()));return [...new Set((i.interests||[]).filter(x=>x.email&&!joined.has(x.email.toLowerCase())&&x.contactConsent!==false).map(x=>x.email))]}
  const m=(await api('/api/committee/member-profiles').catch(()=>({members:[]}))).members||[];
  return [...new Set(m.filter(x=>x.email&&x.contactConsent&&(group==='film'?x.profile?.filmMember:group==='unverified'?!x.idCheck:true)).map(x=>x.email))];
 }
 async function refresh(id=current?.id){
  const my=++epoch;
  try{
   const r=await api('/api/suite/'+key);if(my!==epoch)return;
   records=r.records||[];current=records.find(x=>x.id===id)||records.find(x=>x.status!=='archived')||null;extra={};
   if(current&&key==='email-queue')extra.recipients=await recipientsFor(current.fields.recipientGroup||'all');
   if(my===epoch)render();
  }catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load this desk: '+e(err.message)+'</p>';status?.(err.message,true)}}
 }
 async function guarded(fn){if(busy||ro())return;busy=true;for(const b of root.querySelectorAll('button'))b.disabled=true;try{const msg=await fn();await refresh();if(msg)say(msg)}catch(err){await refresh();say(err.message,true)}finally{busy=false}}
 const save=(changes,st)=>api('/api/suite/'+key+'/'+current.id,{method:'PATCH',data:{version:current.version,title:changes.title??current.title,status:st||current.status,fields:{...current.fields,...changes.fields}}});
 const create=(title,fields,st='draft')=>api('/api/suite/'+key,{method:'POST',data:{title,status:st,fields}});
 async function copy(text,label){try{await navigator.clipboard.writeText(text);say(label+' copied.')}catch{prompt('Copy this:',text)}}
 function printHtml(title,html){const w=window.open('','_blank');if(!w){say('Allow pop-ups to print.',true);return}w.document.write('<!doctype html><title>'+e(title)+'</title><style>body{font:12pt/1.5 Arial,sans-serif;margin:18mm;color:#102d40}h3{font-size:20pt;margin:.2em 0}h4{margin:1.1em 0 .2em}.rd-news-kicker{color:#c14e32;font-weight:800;letter-spacing:.08em;font-size:9pt}ul{padding-left:1.2em}</style>'+html);w.document.close();w.focus();w.print()}
 root.addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.target,v=Object.fromEntries(new FormData(form));if(ro())return;
  if(form.matches('[data-rd-new]'))return guarded(async()=>{
   const fields=values(form,cfg.create);
   const title=(cfg.name?cfg.name(fields):v.__title||'').trim()||cfg.noun;
   const r=await create(title.charAt(0).toUpperCase()+title.slice(1),fields,key==='ready-setco'?'proposal':'draft');current={id:r.id};return 'Created. Fill in the rest and save.';
  });
  if(form.matches('[data-rd-edit]'))return guarded(async()=>{await save({title:v.__title.trim(),fields:values(form,spec.fields.map(x=>x.key))});return 'Saved.'});
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-rd-refresh')){await refresh();say('Up to date.');return}
  if(b.dataset.rdOpen){await refresh(b.dataset.rdOpen);root.querySelector('.mt-head h4')?.focus();if(matchMedia('(max-width:820px)').matches)root.querySelector('.mt-detail')?.scrollIntoView({block:'start'});return}
  if(b.dataset.rdStage)return guarded(async()=>{await save({},b.dataset.rdStage);return 'Moved to '+stageLabel(b.dataset.rdStage)+'.'});
  if(b.hasAttribute('data-rd-archive')){if(!confirm('Archive “'+current.title+'”? It stays on record.'))return;return guarded(async()=>{await save({},'archived');return 'Archived.'})}
  if(b.hasAttribute('data-rd-restore'))return guarded(async()=>{await save({},'draft');return 'Restored.'});
  if(b.dataset.rdStd)return guarded(async()=>{const r=await create(b.dataset.rdStd,{documentType:'Policy or record',visibility:'Committee only',reviewDate:plusMonths(todayBris(),12)});current={id:r.id};return 'Added. Paste the link to where it is kept.'});
  if(b.hasAttribute('data-rd-reviewed'))return guarded(async()=>{await save({fields:{reviewDate:plusMonths(todayBris(),12),versionLabel:current.fields.versionLabel||('Reviewed '+longDate(todayBris()))}});return 'Marked reviewed. Next review in 12 months.'});
  if(b.hasAttribute('data-rd-print')){
   if(key==='news')printHtml(current.title,newsPreview(current.fields));
   else{const f=current.fields,list=(t,s)=>lines(s).length?'<h4>'+t+'</h4><ul>'+lines(s).map(x=>'<li>☐ '+e(x)+'</li>').join('')+'</ul>':'';printHtml(current.title,'<h3>Handover: '+e(f.office||current.title)+'</h3><p>'+e([f.from&&'From '+f.from,f.to&&'to '+f.to,f.transferDate&&'on '+longDate(f.transferDate)].filter(Boolean).join(' '))+'</p>'+list('Regular duties',f.duties)+list('Open jobs',f.openTasks)+list('Documents, logins and keys',f.resources)+(f.handoverNotes?'<h4>Notes</h4><p>'+e(f.handoverNotes)+'</p>':'')+'<p style="margin-top:2em">Signed (outgoing) ____________________ &nbsp; Signed (incoming) ____________________</p>')}
   return;
  }
  if(b.hasAttribute('data-rd-roundup'))return guarded(async()=>{
   const m=current.fields.editionMonth||todayBris().slice(0,7),ev=(await api('/api/calendar')).events||[],ann=(await api('/api/committee/announcements').catch(()=>({announcements:[]}))).announcements||[];
   const items=[...ev.map(x=>({d:x.date,t:x.title,w:[x.time,x.location].filter(Boolean).join(', ')})),...ann.filter(a=>a.eventDate).map(a=>({d:a.eventDate,t:a.title,w:[a.eventTime,a.location].filter(Boolean).join(', ')}))].filter(x=>x.d>=m+'-01'&&x.d<=plusMonths(m+'-01',2));
   const seen=new Set(),text=items.sort((a,c)=>a.d.localeCompare(c.d)).filter(x=>!seen.has(x.d+x.t)&&seen.add(x.d+x.t)).map(x=>longDate(x.d)+': '+x.t+(x.w?' ('+x.w+')':'')).join('\n');
   if(!text)return 'Nothing on the calendar for that month yet.';
   await save({fields:{eventRoundup:text}});return 'What’s on filled from the calendar.';
  });
  if(b.hasAttribute('data-rd-thanks'))return guarded(async()=>{const s=(await api('/api/sponsors')).sponsors||[];if(!s.length)return 'No sponsors on the public wall yet.';await save({fields:{acknowledgements:'Thanks to our supporters: '+s.map(x=>x.name).join(', ')+'.'}});return 'Sponsor thank-yous added.'});
  if(b.hasAttribute('data-rd-notice'))return guarded(async()=>{await api('/api/committee/announcements',{method:'POST',data:{action:'create',title:current.title,body:newsText(current.fields).slice(0,3990),audience:'all',sourceId:current.id}});return 'Shared with members as a notice.'});
  if(b.hasAttribute('data-rd-queue'))return guarded(async()=>{const r=await api('/api/suite/email-queue',{method:'POST',data:{title:current.title,status:'review',fields:{subject:current.title,recipientGroup:'all',body:newsText(current.fields).slice(0,8900),sendAfter:todayBris(),consentVerified:true}}});await save({},'review');return 'Added to Message delivery, ready to send.'});
  if(b.hasAttribute('data-rd-fill'))return guarded(async()=>{
   const office=Object.entries(OFFICES).find(([,l])=>l===current.fields.office)?.[0];if(!office)return 'Choose the office first, then save.';
   const t=await api('/api/committee/todos').catch(()=>({tasks:[],offices:[]})),duties=(t.offices||[]).find(o=>o.key===office)?.duties||[],open=(t.tasks||[]).filter(x=>x.office===office&&!x.done&&!x.archived).map(x=>x.title+(x.dueDate?' (due '+longDate(x.dueDate)+')':''));
   await save({fields:{duties:current.fields.duties||duties.join('\n'),openTasks:open.join('\n')}});return 'Filled '+duties.length+' duties and '+open.length+' open jobs.';
  });
  if(b.hasAttribute('data-rd-sent'))return guarded(async()=>{const n=(extra.recipients||[]).length;await save({fields:{deliveryLog:((current.fields.deliveryLog||'')+'\n'+longDate(todayBris())+': sent by email to '+n+' '+(n===1?'person':'people')+'.').trim()}},'completed');return 'Marked as sent.'});
  if(b.dataset.rdCopy==='bcc')return copy((extra.recipients||[]).join(', '),'Email addresses');
  if(b.dataset.rdCopy==='body')return copy((current.fields.subject||current.title)+'\n\n'+(current.fields.body||''),'Message');
  if(b.dataset.rdCopy==='request'){const f=current.fields;return copy(['Request to Ready SET Co-op from Sandy Sports Club (proposed)','','What we need: '+(f.request||current.title),'Kind of help: '+(f.service||''),'Scope: '+(f.scope||''),f.estimatedCost?'Budget: $'+Number(f.estimatedCost).toLocaleString('en-AU')+' (separate from C-Hours)':'',lines(f.conditions).length?'Conditions:\n- '+lines(f.conditions).join('\n- '):'','Our contact: '+(f.sandyOwner||''),'','Nothing is agreed until both sides accept in writing.'].filter(x=>x!=='').join('\n'),'Request')}
 });
 return {
  async open(k){key=k;cfg=CONFIG[k];spec=SUITE_BY_KEY[k];current=null;root.hidden=false;root.textContent='Loading…';await refresh();root.querySelector('#rd-desk-title')?.focus({preventScroll:true})},
  close(){epoch++;root.hidden=true}
 };
}
