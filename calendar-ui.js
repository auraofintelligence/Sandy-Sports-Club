// Shared "What's on" list for the public calendar page and the member Calendar tab.
// Each event can be saved on its own (.ics); the whole calendar can be subscribed to or downloaded.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthName=d=>new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric',timeZone:'Australia/Brisbane'}).format(new Date(d+'T12:00:00+10:00'));
const dayParts=d=>{const x=new Date(d+'T12:00:00+10:00'),f=o=>new Intl.DateTimeFormat('en-AU',{...o,timeZone:'Australia/Brisbane'}).format(x);return {wd:f({weekday:'short'}),day:f({day:'numeric'}),mon:f({month:'short'})}};
const TAGS={public:'Open to everyone',members:'Members',film:'Film Club',tickets:'Tickets'};
const REPLIES={going:'Going',maybe:'Maybe',not_going:'Can’t make it'};

export function singleIcs(e){
 const d=s=>s.replaceAll('-',''),t=s=>s.replace(':','')+'00',x=s=>String(s||'').replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
 const next=new Date(Date.parse(e.date+'T00:00:00Z')+864e5).toISOString().slice(0,10);
 const when=e.start?['DTSTART;TZID=Australia/Brisbane:'+d(e.date)+'T'+t(e.start),e.end?'DTEND;TZID=Australia/Brisbane:'+d(e.date)+'T'+t(e.end):'DURATION:PT2H']:['DTSTART;VALUE=DATE:'+d(e.date),'DTEND;VALUE=DATE:'+d(next)];
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandy Sports Club//Calendar//EN','BEGIN:VTIMEZONE','TZID:Australia/Brisbane','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+1000','TZOFFSETTO:+1000','TZNAME:AEST','END:STANDARD','END:VTIMEZONE',
  'BEGIN:VEVENT','UID:'+e.id+'@sandy-sports-club','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z',...when,'SUMMARY:'+x(e.title),e.location?'LOCATION:'+x(e.location):'',
  'DESCRIPTION:'+x([e.time&&!e.start?'Time: '+e.time:'',e.summary,e.link?'Details: '+location.origin+e.link:''].filter(Boolean).join('\n')),e.link?'URL:'+location.origin+e.link:'','END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
}
function save(e){
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([singleIcs(e)],{type:'text/calendar'}));
 a.download=(e.title.replace(/[^\w .-]+/g,'').trim()||'event')+'.ics';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
export function howTo({feed,subscribe}){
 const webcal=subscribe?subscribe.replace(/^https?:/,'webcal:'):'';
 return '<div class="cal-get"><h3>Put it in your calendar</h3>'+
  '<div class="cal-get-buttons">'+(subscribe?'<a class="cal-btn" href="'+esc(webcal)+'">Subscribe (stays up to date)</a>':'')+'<a class="cal-btn ghost" href="'+esc(feed)+'" download>Download all (.ics)</a>'+
  (subscribe?'<button type="button" class="cal-btn ghost" data-cal-copy="'+esc(subscribe)+'">Copy calendar link</button>':'')+'</div>'+
  '<p class="cal-small">'+(subscribe?'Subscribing keeps new and changed events coming through on their own. A downloaded file is a one-off copy.':'This is a one-off copy. Download it again after changes.')+' Every event also has its own “Add to my calendar” button.</p>'+
  '<details class="cal-help"><summary>How to add it: iPhone, Android, Google, Outlook</summary>'+
  '<h4>iPhone or iPad</h4><p>'+(subscribe?'Tap <strong>Subscribe</strong>, then <strong>Subscribe</strong> again. ':'')+'Or tap a downloaded .ics file and choose <strong>Add All</strong>.</p>'+
  '<h4>Mac (Apple Calendar)</h4><p>'+(subscribe?'Click <strong>Subscribe</strong>, or in Calendar choose File, New Calendar Subscription and paste the copied link. ':'')+'Or double-click a downloaded .ics file.</p>'+
  '<h4>Google Calendar (and most Android phones)</h4><p>On a computer, open calendar.google.com. '+(subscribe?'Next to “Other calendars” click <strong>+</strong>, choose <strong>From URL</strong>, paste the copied link and click Add calendar. It then shows on your phone too. ':'')+'For a downloaded file: Settings, <strong>Import &amp; export</strong>, choose the .ics file, then Import.</p>'+
  '<h4>Outlook</h4><p>'+(subscribe?'Outlook.com: Add calendar, <strong>Subscribe from web</strong>, paste the copied link. ':'')+'Desktop Outlook: File, Open &amp; Export, Import/Export, then choose the .ics file. Or open the file and choose Save &amp; Close.</p>'+
  '<h4>Samsung or other Android calendar</h4><p>Open the downloaded .ics file from your Downloads and choose your calendar app. If nothing happens, add it to Google Calendar first and it will sync.</p>'+
  '</details></div>';
}
export function renderCalendar(root,{events,feed,subscribe,member=false,onReply,empty='Nothing on the calendar yet. Check back soon.'}){
 const groups=new Map();for(const e of events){const k=e.date.slice(0,7);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e)}
 const card=e=>{const p=dayParts(e.date),tags=[e.kind==='tickets'?'tickets':e.audience].filter(Boolean);
  return '<article class="cal-event" data-cal-id="'+esc(e.id)+'"><div class="cal-date" aria-hidden="true"><span>'+esc(p.wd)+'</span><strong>'+esc(p.day)+'</strong><span>'+esc(p.mon)+'</span></div>'+
   '<div class="cal-body"><h4>'+esc(e.title)+'</h4><p class="cal-when">'+esc([p.wd+' '+p.day+' '+p.mon,e.time].filter(Boolean).join(' · '))+(e.location?' · '+esc(e.location):'')+'</p>'+
   (e.summary?'<p class="cal-sum">'+esc(e.summary)+'</p>':'')+
   '<p class="cal-tags">'+tags.map(t=>'<span class="cal-tag cal-'+t+'">'+TAGS[t]+'</span>').join('')+(e.myResponse?'<span class="cal-tag cal-mine">You: '+esc(REPLIES[e.myResponse]||e.myResponse)+'</span>':'')+'</p>'+
   '<div class="cal-actions"><button type="button" data-cal-save>Add to my calendar</button>'+(e.link?'<a href="'+esc(e.link)+'">'+esc(e.linkLabel||'Details')+'</a>':'')+
   (member&&e.rsvp?'<span class="cal-reply" role="group" aria-label="Your reply">'+Object.entries(REPLIES).map(([k,l])=>'<button type="button" data-cal-reply="'+k+'" aria-pressed="'+(e.myResponse===k)+'">'+l+'</button>').join('')+'</span>':'')+'</div></div></article>'};
 root.innerHTML=(events.length?[...groups].map(([k,list])=>'<section class="cal-month"><h3>'+esc(monthName(k+'-15'))+'</h3>'+list.map(card).join('')+'</section>').join(''):'<p class="cal-empty">'+esc(empty)+'</p>')+howTo({feed,subscribe});
 root.onclick=async ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.calCopy!==undefined){try{await navigator.clipboard.writeText(b.dataset.calCopy);b.textContent='Link copied'}catch{prompt('Copy this calendar link:',b.dataset.calCopy)}return}
  const e=events.find(x=>x.id===b.closest('[data-cal-id]')?.dataset.calId);if(!e)return;
  if(b.hasAttribute('data-cal-save')){save(e);return}
  if(b.dataset.calReply&&onReply){b.disabled=true;try{await onReply(e,b.dataset.calReply)}finally{b.disabled=false}}
 };
}
