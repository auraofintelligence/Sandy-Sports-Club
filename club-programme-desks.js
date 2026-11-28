// Sport, events and film desks: Sports and coaching, Facilities and screens, Film club,
// Results and prizes. Same PLFC pattern as the other desks: list on the left, the record on the
// right, live member data where it helps, and a calendar step that never publishes by itself.
import {isReadOnlyView} from './club-view-client.js';
import {SUITE_BY_KEY} from './studio/sandy-suite-spec.js';
const longDate=d=>d?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00')):'No date yet';
const todayBris=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const plusDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const ampm=t=>{if(!t)return '';let [h,m]=t.split(':').map(Number);const p=h>=12?'pm':'am';h=h%12||12;return h+(m?':'+String(m).padStart(2,'0'):'')+p};
const lines=s=>String(s||'').split('\n').map(x=>x.trim()).filter(Boolean);

// Per desk: wording, which fields appear when creating, the date field, the list line and labels.
const CONFIG={
 'sport-programme':{title:'Sports and coaching',help:'Plan sessions and coaching, see which sports members want and when they are free, and put sessions on the calendar.',
  noun:'session',newLabel:'Plan a session',dateKey:'date',titleFrom:f=>f.sport,create:['sport','date','startTime','location','coach','capacity'],
  labels:{sport:'Sport',date:'Date',startTime:'Start',location:'Where',coach:'Coach or leader',capacity:'Places',needs:'Equipment, skill level and access needs',safeguards:'Safeguarding plan checked (children, first aid, Blue Card where needed)',weatherPlan:'Heat, lightning and wet-weather plan'},
  line:f=>[f.startTime&&ampm(f.startTime),f.location,f.coach&&'with '+f.coach].filter(Boolean).join(' · '),
  checks:[['safeguards','Safeguarding checked']],publish:'all',repeat:true},
 venues:{title:'Facilities and screens',help:'Keep track of courts, halls, shade and screens you need, who to ask, and which bookings are actually confirmed.',
  noun:'booking',newLabel:'Add a venue booking',dateKey:'date',titleFrom:f=>f.site,create:['site','town','date','startTime','endTime'],
  labels:{town:'Where on the island',site:'Venue or site',date:'Date',startTime:'From',endTime:'Until',assets:'Courts, screen, shade, toilets, power, transport (one per line)',contact:'Venue contact or booking reference',permissions:'Permits and conditions (council, power, safety, tenure)',confirmed:'Booking confirmed by the venue'},
  line:f=>[f.startTime&&ampm(f.startTime)+(f.endTime?' to '+ampm(f.endTime):''),f.town&&f.town.split(' / ')[0]].filter(Boolean).join(' · '),
  checks:[['confirmed','Confirmed']]},
 film:{title:'Film club',help:'Plan screenings, shoots and workshops, see who in Film Club has which crew skills, and check rights before anything is shown.',
  noun:'film night',newLabel:'Plan a screening or shoot',dateKey:'date',titleFrom:f=>f.filmTitle||f.type,create:['type','filmTitle','date','location'],
  labels:{type:'What is it?',filmTitle:'Film or project title',date:'Date',location:'Venue or screen',programme:'Running order',crew:'Crew: name | role | time (one per line)',equipment:'Screen, projector, camera and sound (one per line)',rights:'Screening licence, music, cultural permissions and appearance releases',rightsReviewed:'Rights and permissions checked'},
  line:f=>[f.type,f.location].filter(Boolean).join(' · '),checks:[['rightsReviewed','Rights checked']],publish:'film'},
 leaderboard:{title:'Results and prizes',help:'Record results for a competition, see the table, and share it with members once results are checked and players have agreed to be named.',
  noun:'competition',newLabel:'Add a competition',dateKey:'eventDate',titleFrom:f=>f.format,create:['format','eventDate'],
  labels:{format:'Competition',eventDate:'Date',results:'Results: team or player | points (one per line)',rules:'Scoring and who can enter',prizes:'Prizes and who donated them (one per line)',resultsVerified:'Results checked by the organiser',consentForNames:'Players agreed to be named'},
  line:f=>{const n=lines(f.results).length;return n?n+' on the table':'No results yet'},checks:[['resultsVerified','Checked'],['consentForNames','Names OK']]}
};
export const PROGRAMME_DESKS=Object.keys(CONFIG);

export function setupProgrammeDesks({api,esc:e,status,showDesk}){
 const root=document.getElementById('committee-programme-desk');
 if(!root)return {open(){},close(){}};
 let key='',cfg=null,spec=null,records=[],current=null,listings=[],members=[],busy=false,epoch=0;
 const ro=()=>isReadOnlyView(),off=()=>current?.status==='archived';
 const say=(msg,bad=false)=>{const n=root.querySelector('[data-pd-message]');if(n){n.textContent=msg;n.classList.toggle('bad',bad)}if(bad)status?.(msg,true)};
 const fieldOf=k=>spec.fields.find(f=>f.key===k);
 const label=k=>cfg.labels[k]||fieldOf(k)?.label||k;
 function input(k,val,lock){
  const f=fieldOf(k),d=lock?' disabled':'',v=val??'';
  if(f.type==='checkbox')return '<label class="ops-check"><input type="checkbox" name="'+k+'"'+(v?' checked':'')+d+'> '+e(label(k))+'</label>';
  const wrap=h=>'<label>'+e(label(k))+h+'</label>';
  if(f.type==='select')return wrap('<select name="'+k+'"'+d+'><option value="">Choose…</option>'+f.options.map(o=>'<option'+(o===v?' selected':'')+'>'+e(o)+'</option>').join('')+'</select>');
  if(f.type==='textarea'||f.type==='lines')return wrap('<textarea name="'+k+'" rows="'+(f.type==='lines'?3:3)+'"'+d+'>'+e(v)+'</textarea>');
  const type={date:'date',time:'time',number:'number',url:'url'}[f.type]||'text';
  return wrap('<input type="'+type+'" name="'+k+'" value="'+e(v)+'"'+(type==='number'?' min="0" max="100000"':' maxlength="300"')+d+'>');
 }
 const short=k=>['date','eventDate','startTime','endTime','capacity','town','sport','type','coach','location','site','filmTitle','format','contact'].includes(k);
 function formFields(keys,values,lock){
  const s=keys.filter(k=>short(k)&&fieldOf(k).type!=='checkbox'),l=keys.filter(k=>!short(k)&&fieldOf(k).type!=='checkbox'),c=keys.filter(k=>fieldOf(k).type==='checkbox');
  return (s.length?'<div class="ops-form-grid">'+s.map(k=>input(k,values[k],lock)).join('')+'</div>':'')+l.map(k=>input(k,values[k],lock)).join('')+c.map(k=>input(k,values[k],lock)).join('');
 }
 const dateOf=r=>r.fields[cfg.dateKey]||'';
 const mine=()=>listings.filter(a=>a.sourceId===current?.id);
 function listView(){
  const t=todayBris(),up=records.filter(r=>r.status!=='archived'&&(!dateOf(r)||dateOf(r)>=t)).sort((a,b)=>(dateOf(a)||'9').localeCompare(dateOf(b)||'9')),past=records.filter(r=>!up.includes(r)).sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));
  const row=r=>'<li><button type="button" data-pd-open="'+e(r.id)+'" aria-current="'+(current?.id===r.id)+'"><strong>'+e(r.title)+'</strong><span>'+e(longDate(dateOf(r)))+'</span><span>'+e(cfg.line(r.fields))+'</span><span class="ops-badges">'+
   (r.status==='archived'?'<span class="ops-pill ops-muted">Cancelled</span>':'')+cfg.checks.map(([k,l])=>r.fields[k]?'<span class="ops-pill ops-green">'+l+'</span>':'').join('')+(listings.some(a=>a.sourceId===r.id)?'<span class="ops-pill ops-green">On the calendar</span>':'')+'</span></button></li>';
  return '<details class="ops-compose"'+(records.length?'':' open')+'><summary>'+e(cfg.newLabel)+'</summary><form data-pd-new><fieldset'+(ro()?' disabled':'')+'>'+formFields(cfg.create,{},false)+'<button type="submit">Create</button></fieldset></form></details>'+
   (up.length?'<h4>Coming up</h4><ul class="mt-list">'+up.map(row).join('')+'</ul>':'')+(past.length?'<h4>Earlier</h4><ul class="mt-list">'+past.map(row).join('')+'</ul>':'')+(!records.length?'<p class="ops-empty">Nothing yet.</p>':'');
 }
 // Live member data that helps each desk.
 function insight(){
  if(key==='sport-programme'){
   if(!members.length)return '';
   const count=(get)=>{const m=new Map();for(const x of members)for(const v of get(x)||[])m.set(v,(m.get(v)||0)+1);return [...m].sort((a,b)=>b[1]-a[1])};
   const sports=count(x=>x.profile?.sports),times=count(x=>x.profile?.availability);
   return '<details class="ops-compose pd-insight" open><summary>What members want ('+members.length+' members)</summary><div class="pd-bars"><div><h5>Sports</h5>'+(sports.length?sports.slice(0,8).map(([s,n])=>'<p><span>'+e(s)+'</span><b style="--w:'+Math.round(100*n/members.length)+'%"></b><em>'+n+'</em></p>').join(''):'<p>No sports picked yet.</p>')+'</div>'+
    '<div><h5>When they are free</h5>'+(times.length?times.slice(0,8).map(([s,n])=>'<p><span>'+e(s)+'</span><b style="--w:'+Math.round(100*n/members.length)+'%"></b><em>'+n+'</em></p>').join(''):'<p>No times picked yet.</p>')+'</div></div></details>';
  }
  if(key==='film'){
   const film=members.filter(x=>x.profile?.filmMember);if(!members.length)return '';
   const skills=new Map();for(const x of film)for(const s of x.profile?.crewSkills||[])skills.set(s,[...(skills.get(s)||[]),x.preferredName||x.name||x.username]);
   return '<details class="ops-compose pd-insight" open><summary>Film Club crew ('+film.length+' members)</summary>'+(skills.size?'<ul class="md-plain">'+[...skills].sort((a,b)=>b[1].length-a[1].length).map(([s,names])=>'<li><strong>'+e(s)+':</strong> '+e(names.join(', '))+'</li>').join('')+'</ul>':'<p>No crew skills listed yet. Members add them on their profile.</p>')+'</details>';
  }
  return '';
 }
 function extras(){
  const f=current.fields;
  if(key==='leaderboard'){
   const rows=lines(f.results).map(l=>{const [who,pts]=l.split('|').map(x=>x.trim());return {who,pts:Number(pts)}}).filter(r=>r.who);
   const sorted=[...rows].sort((a,b)=>(isNaN(b.pts)?-1e9:b.pts)-(isNaN(a.pts)?-1e9:a.pts));
   return '<h5>Table</h5>'+(sorted.length?'<div class="table-scroll"><table class="club-table"><thead><tr><th>#</th><th>Team or player</th><th>Points</th></tr></thead><tbody>'+sorted.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+e(r.who)+'</td><td>'+(isNaN(r.pts)?'':r.pts)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="ops-empty">Add results as “Team | points”, one per line.</p>');
  }
  if(key==='venues'){
   const clash=records.filter(r=>r.id!==current.id&&r.status!=='archived'&&r.fields.date&&r.fields.date===f.date&&r.fields.site&&r.fields.site.toLowerCase()===String(f.site||'').toLowerCase());
   return clash.length?'<p class="ops-boundary">Heads up: '+clash.map(r=>'“'+e(r.title)+'”').join(', ')+' is booked at the same place on the same day.</p>':'';
  }
  return '';
 }
 function publishBox(){
  if(!cfg.publish&&key!=='leaderboard')return '';
  const f=current.fields,live=mine();
  if(key==='leaderboard'){
   const ok=f.resultsVerified&&f.consentForNames;
   return '<section class="pd-publish"><h5>Share with members</h5>'+(ok?'<p class="mt-help">Posts the table to members as a notice. Nothing is public.</p><button type="button" data-pd-results'+(ro()?' disabled':'')+'>Share the results with members</button>':'<p class="mt-help">Tick “Results checked” and “Players agreed to be named” first.</p>')+'</section>';
  }
  if(!dateOf(current))return '<section class="pd-publish"><h5>Calendar</h5><p class="mt-help">Add a date before putting this on the calendar.</p></section>';
  const blocked=key==='film'&&!f.rightsReviewed;
  return '<section class="pd-publish"><h5>Calendar</h5>'+(live.length?'<ul class="md-notices">'+live.map(a=>'<li data-md-id="'+e(a.id)+'"><div><strong>'+e(a.title)+'</strong><span>'+e(longDate(a.eventDate)+(a.eventTime?' '+a.eventTime:'')+(a.publicCalendar?' · Public What’s on':' · Members'))+'</span>'+(a.counts?'<span class="md-rsvp">'+a.counts.going+' going · '+a.counts.maybe+' maybe</span>':'')+'</div><div class="md-row-actions"><button type="button" data-pd-takedown'+(ro()?' disabled':'')+'>Take down</button></div></li>').join('')+'</ul>':'')+
   (off()?'':blocked?'<p class="ops-boundary">Tick “Rights and permissions checked” before putting a screening on the calendar.</p>':
   '<form data-pd-publish class="pd-pubform"><label class="ops-check"><input type="checkbox" name="rsvp" checked> Ask for RSVPs</label>'+(cfg.publish==='all'?'<label class="ops-check"><input type="checkbox" name="publicCalendar"> Also on the public What’s on calendar</label>':'<p class="mt-help">Goes to Film Club members.</p>')+'<button type="submit"'+(ro()?' disabled':'')+'>'+(live.length?'Publish again':'Put it on the calendar')+'</button></form>')+'</section>';
 }
 function detailView(){
  if(!current)return '<p class="ops-empty">'+(records.length?'Choose one from the list.':'Your '+cfg.noun+'s will show here.')+'</p>';
  return '<header class="mt-head"><div><h4 tabindex="-1">'+e(current.title)+'</h4><p>'+e([longDate(dateOf(current)),cfg.line(current.fields)].filter(Boolean).join(' · '))+'</p></div>'+(off()?'<span class="ops-pill ops-muted">Cancelled</span>':'')+'</header>'+
   extras()+'<form data-pd-edit><fieldset'+(ro()||off()?' disabled':'')+'><label>Name<input name="__title" value="'+e(current.title)+'" maxlength="160" required></label>'+formFields(spec.fields.map(f=>f.key),current.fields,false)+'<button type="submit">Save</button></fieldset></form>'+
   publishBox()+
   '<div class="ops-actions">'+(cfg.repeat&&!off()?'<button type="button" data-pd-repeat'+(ro()?' disabled':'')+'>Copy to next week</button>':'')+(off()?'':'<button type="button" class="pd-cancel" data-pd-cancel'+(ro()?' disabled':'')+'>Cancel this '+e(cfg.noun)+'</button>')+'</div>';
 }
 function render(){
  root.innerHTML='<header class="ops-header"><div><h3 id="pd-desk-title" tabindex="-1">'+e(cfg.title)+'</h3><p>'+e(cfg.help)+'</p></div><button type="button" data-pd-refresh>Check now</button></header>'+
   (ro()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':'')+'<p data-pd-message role="status"></p>'+insight()+
   '<div class="mt-layout"><aside class="mt-aside">'+listView()+'</aside><section class="mt-detail">'+detailView()+'</section></div>';
 }
 async function refresh(id=current?.id){
  const my=++epoch;
  try{
   const needMembers=key==='sport-programme'||key==='film';
   const [r,a,m]=await Promise.all([api('/api/suite/'+key),api('/api/committee/announcements').catch(()=>({announcements:[]})),needMembers?api('/api/committee/member-profiles').catch(()=>({members:[]})):Promise.resolve({members:[]})]);
   if(my!==epoch)return;
   records=r.records||[];listings=a.announcements||[];members=m.members||[];
   const t=todayBris();current=records.find(x=>x.id===id)||records.filter(x=>x.status!=='archived'&&dateOf(x)>=t).sort((x,y)=>dateOf(x).localeCompare(dateOf(y)))[0]||records[0]||null;render();
  }catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load this desk: '+e(err.message)+'</p>';status?.(err.message,true)}}
 }
 async function guarded(fn){if(busy||ro())return;busy=true;for(const b of root.querySelectorAll('button'))b.disabled=true;try{const msg=await fn();await refresh();if(msg)say(msg)}catch(err){await refresh();say(err.message,true)}finally{busy=false}}
 const values=(form,keys)=>{const o={};for(const k of keys){const f=fieldOf(k),el=form.elements[k];if(!el)continue;o[k]=f.type==='checkbox'?el.checked:f.type==='number'?(el.value===''?'':Number(el.value)):el.value.trim()}return o};
 const save=(changes,st)=>api('/api/suite/'+key+'/'+current.id,{method:'PATCH',data:{version:current.version,title:changes.title??current.title,status:st||current.status,fields:{...current.fields,...changes.fields}}});
 const timeText=f=>f.startTime?ampm(f.startTime)+(f.endTime?' to '+ampm(f.endTime):''):'';
 root.addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.target;if(ro())return;
  if(form.matches('[data-pd-new]'))return guarded(async()=>{
   const fields=values(form,cfg.create),title=(cfg.titleFrom(fields)||cfg.noun).trim();
   const r=await api('/api/suite/'+key,{method:'POST',data:{title:title.charAt(0).toUpperCase()+title.slice(1),status:'draft',fields}});current={id:r.id};return 'Created. Fill in the rest and save.';
  });
  if(form.matches('[data-pd-edit]'))return guarded(async()=>{await save({title:form.elements.__title.value.trim(),fields:values(form,spec.fields.map(f=>f.key))});return 'Saved.'});
  if(form.matches('[data-pd-publish]'))return guarded(async()=>{
   const f=current.fields,pub=form.elements.publicCalendar?.checked===true;
   await api('/api/committee/announcements',{method:'POST',data:{action:'create',title:current.title,body:[f.coach&&'With '+f.coach,f.needs,f.programme].filter(Boolean).join('\n').slice(0,3900),audience:cfg.publish==='film'?'film':'all',eventDate:dateOf(current),eventTime:timeText(f),location:f.location||f.site||'',rsvp:form.elements.rsvp.checked,publicCalendar:pub,sourceId:current.id}});
   return 'On the calendar'+(pub?', including the public What’s on page.':cfg.publish==='film'?' for Film Club members.':' for members.');
  });
 });
 root.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-pd-refresh')){await refresh();say('Up to date.');return}
  if(b.dataset.pdOpen){await refresh(b.dataset.pdOpen);root.querySelector('.mt-head h4')?.focus();if(matchMedia('(max-width:820px)').matches)root.querySelector('.mt-detail')?.scrollIntoView({block:'start'});return}
  if(b.hasAttribute('data-pd-cancel')){if(!confirm('Cancel “'+current.title+'”? It stays on record as cancelled.'))return;return guarded(async()=>{for(const a of mine())await api('/api/committee/announcements',{method:'POST',data:{action:'archive',id:a.id}});await save({},'archived');return 'Cancelled.'})}
  if(b.hasAttribute('data-pd-repeat'))return guarded(async()=>{const f=current.fields,d=f.date?plusDays(f.date,7):'';const r=await api('/api/suite/'+key,{method:'POST',data:{title:current.title,status:'draft',fields:{...f,date:d,safeguards:false}}});current={id:r.id};return 'Copied to '+longDate(d)+'. Check the details and save.'});
  if(b.hasAttribute('data-pd-takedown')){if(!confirm('Take this off the calendar?'))return;const id=b.closest('[data-md-id]').dataset.mdId;return guarded(async()=>{await api('/api/committee/announcements',{method:'POST',data:{action:'archive',id}});return 'Taken off the calendar.'})}
  if(b.hasAttribute('data-pd-results'))return guarded(async()=>{
   const rows=lines(current.fields.results).map(l=>l.split('|').map(x=>x.trim())).filter(r=>r[0]).sort((a,c)=>(Number(c[1])||0)-(Number(a[1])||0));
   const body=rows.map((r,i)=>(i+1)+'. '+r[0]+(r[1]?' ('+r[1]+')':'')).join('\n')+(current.fields.prizes?'\n\nPrizes: '+lines(current.fields.prizes).join('; '):'');
   await api('/api/committee/announcements',{method:'POST',data:{action:'create',title:'Results: '+current.title,body:body.slice(0,3900),audience:'all',sourceId:current.id}});return 'Results shared with members as a notice.';
  });
 });
 return {
  async open(k){key=k;cfg=CONFIG[k];spec=SUITE_BY_KEY[k];current=null;root.hidden=false;root.textContent='Loading…';await refresh();root.querySelector('#pd-desk-title')?.focus({preventScroll:true})},
  close(){epoch++;root.hidden=true}
 };
}
