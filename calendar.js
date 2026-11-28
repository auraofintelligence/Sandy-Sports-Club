// Public "What's on" page: upcoming public events with .ics subscribe, download and per-event save.
import {renderCalendar} from './calendar-ui.js';
const state=document.getElementById('cal-state'),list=document.getElementById('cal-list');
fetch('/api/calendar',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Calendar unavailable ('+r.status+')'))).then(data=>{
 state.hidden=true;
 renderCalendar(list,{events:data.events||[],feed:'/api/calendar.ics',subscribe:location.origin+'/api/calendar.ics',empty:'No public events are on the calendar yet. Check back soon.'});
}).catch(err=>{state.textContent=err.message;state.classList.add('bad')});
