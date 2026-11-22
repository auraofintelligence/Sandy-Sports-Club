const zone='Australia/Brisbane';
const monthLabel=new Intl.DateTimeFormat('en-AU',{timeZone:zone,month:'long',year:'numeric'});
const dayLabel=new Intl.DateTimeFormat('en-AU',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'});
const clock=new Intl.DateTimeFormat('en-AU',{timeZone:zone,hour:'numeric',minute:'2-digit'});
const local=day=>new Date(day+'T12:00:00+10:00');
const timeLabel=(date,time)=>time?clock.format(new Date(date+'T'+time+':00+10:00'))+' AEST':'Time to be advised';
const monthStep=(month,step)=>{
  const [y,m]=month.split('-').map(Number);
  return new Date(Date.UTC(y,m-1+step,1)).toISOString().slice(0,7);
};

function copyText(event) {
  return [event.title,dayLabel.format(local(event.date)),timeLabel(event.date,event.time),event.place,event.details].filter(Boolean).join('\n');
}
function eventDetails(event,esc) {
  const time=timeLabel(event.date,event.time);
  const download=event.source==='public'
    ? '<a class="button outline small" href="'+esc(event.calendarUrl)+'">Add to my calendar</a>'
    : '<details class="member-cal-help"><summary>Add to my calendar</summary><ol><li>Choose <a data-raw-calendar href="'+esc(event.calendarUrl)+'" download="sandy-member-event.ics">Save event file</a>. Look in Downloads if your calendar does not open.</li><li>On Apple or Outlook, open the file, choose your personal calendar and save. For Google Calendar on a computer, go to Settings, then Import &amp; export, and import the file.</li><li>On a phone you can also choose Copy event details, create a new event in your calendar and paste the details. Check the clubhouse for later changes.</li></ol></details>';
  return '<details class="member-cal-event" data-cal-event="'+esc(event.id)+'" data-cal-date="'+esc(event.date)+'"><summary><span>'+esc(dayLabel.format(local(event.date)))+' · '+esc(time)+'</span><strong>'+esc(event.title)+'</strong></summary>' +
    '<p class="member-cal-audience">'+(event.source==='public'?'Also on the public club calendar':'Shared with club members')+'</p>' +
    (event.place?'<p><b>Where</b> · '+esc(event.place)+'</p>':'') +
    (event.details?'<p class="member-cal-description">'+esc(event.details)+'</p>':'') +
    '<div class="member-cal-actions">'+download+'<button class="text-link" type="button" data-cal-copy>Copy event details</button></div><div data-copy-result role="status"></div></details>';
}
function monthGrid(data,esc) {
  const [year,month]=data.month.split('-').map(Number);
  const start=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
  const total=new Date(Date.UTC(year,month,0)).getUTCDate();
  let cells='';
  for(const label of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])cells+='<span class="cal-weekday">'+label+'</span>';
  for(let i=0;i<start;i++)cells+='<span aria-hidden="true"></span>';
  const counts=new Map();
  for(const event of data.events)counts.set(event.date,(counts.get(event.date)||0)+1);
  for(let i=1;i<=total;i++){
    const date=data.month+'-'+String(i).padStart(2,'0'),count=counts.get(date)||0,current=date===data.today?' aria-current="date"':'';
    cells+=count?'<button type="button" data-cal-day="'+date+'"'+current+' aria-label="'+esc(dayLabel.format(local(date))+', '+count+(count===1?' event':' events'))+'"><strong>'+i+'</strong><small>'+count+(count===1?' event':' events')+'</small></button>':
      '<span class="cal-day"'+current+'>'+i+'</span>';
  }
  return '<div class="member-month-grid" aria-label="Monthly calendar">'+cells+'</div>';
}

export function setupMemberCalendar({api,esc}) {
  const mount=document.getElementById('member-calendar');
  if(!mount)return;
  let session=null,desk=null,controller=null;
  const active=()=>session?.authenticated&&['member','committee'].includes(session.role)&&location.hash==='#members/calendar';
  function clear(){controller?.abort();controller=null;desk=null;mount.replaceChildren();}
  function paint() {
    const label=monthLabel.format(local(desk.month+'-01'));
    mount.innerHTML='<header class="member-cal-head"><h2>Member calendar</h2><p>Club dates and events the committee has shared with members. Choose a marked day to see where and when to meet.</p></header>'+
      '<div class="member-cal-controls"><h3 tabindex="-1" data-cal-month>'+esc(label)+'</h3><div><button class="button outline small" type="button" data-cal-go="-1"'+(desk.month==='1900-01'?' disabled':'')+'>Previous</button> <button class="button outline small" type="button" data-cal-go="0">Today</button> <button class="button outline small" type="button" data-cal-go="1"'+(desk.month==='2100-12'?' disabled':'')+'>Next</button></div></div>'+
      monthGrid(desk,esc)+'<section class="member-cal-list"><h3>Dates this month</h3>'+
      (desk.events.length?desk.events.map(e=>eventDetails(e,esc)).join(''):'<p>No club dates have been shared for this month.</p>')+'</section><p data-cal-status role="status"></p>';
  }
  async function load(month='') {
    if(!active())return;
    controller?.abort();const token=new AbortController();controller=token;
    if(!desk)mount.innerHTML='<h2>Member calendar</h2><p role="status">Opening club dates…</p>';
    try{
      const next=await api('/api/member/calendar'+(month?'?month='+encodeURIComponent(month):''),{signal:token.signal,cache:'no-store'});
      if(controller!==token||!active())return;
      desk=next;paint();if(month)mount.querySelector('[data-cal-month]').focus({preventScroll:true});
    }catch(error){
      if(controller!==token||!active())return;
      if(error.status===401||error.status===403||!desk){desk=null;mount.innerHTML='<h2>Member calendar</h2><p data-cal-status role="alert"></p><button type="button" class="button outline small" data-cal-retry>Try again</button>';}
      mount.querySelector('[data-cal-status]').textContent=error.message;
    }finally{if(controller===token)controller=null;}
  }
  mount.addEventListener('click',async e=>{
    const button=e.target.closest('button');
    if(!button||!active())return;
    if(button.hasAttribute('data-cal-retry')){load();return;}
    if(!desk)return;
    if(button.hasAttribute('data-cal-go')){
      const step=Number(button.dataset.calGo);
      load(step?monthStep(desk.month,step):'');return;
    }
    if(button.hasAttribute('data-cal-day')){
      const matches=[...mount.querySelectorAll('[data-cal-date]')].filter(el=>el.dataset.calDate===button.dataset.calDay);
      for(const item of matches)item.open=true;
      matches[0]?.querySelector('summary')?.focus();return;
    }
    if(button.hasAttribute('data-cal-copy')){
      const details=button.closest('[data-cal-event]'),event=desk.events.find(x=>x.id===details.dataset.calEvent),feedback=details.querySelector('[data-copy-result]');
      if(!event)return;
      try{await navigator.clipboard.writeText(copyText(event));if(feedback.isConnected)feedback.textContent='Copied. Paste the details into a new entry in your personal calendar.';}
      catch{if(!feedback.isConnected)return;feedback.innerHTML='<label>Select and copy these event details<textarea rows="5" readonly></textarea></label>';const area=feedback.querySelector('textarea');area.value=copyText(event);area.focus();area.select();}
    }
  });
  window.addEventListener('plfc:navigated',()=>{if(active()){if(!desk&&!controller)load();}else clear();});
  window.addEventListener('plfc:session-changed',e=>{clear();session=e.detail;if(active())load();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',e=>{if(e.persisted&&active())load();});
}
