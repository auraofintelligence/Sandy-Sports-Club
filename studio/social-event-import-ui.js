// Private Sandy Sports committee annual-calendar import preview. No publishing or event edits.
const originName=id=>id?.startsWith('m-import-event-')?'Club event run sheet':
  id?.startsWith('m-import-meeting-')?'Committee meeting register':
  id?.startsWith('m-import-csv-')?'Annual CSV':'Manual event';
const statusOf=(candidate,existing)=>{
  if(candidate.inactive)return 'Closed run sheet · import to remove prior verification';
  if(!existing)return 'Not yet imported';
  if(candidate.title!==existing.title||candidate.date!==existing.date)return 'Source date/details changed · reconfirm before public promotion';
  return existing.confirmed?'Imported · date verified':'Imported · planning only';
};
export function renderCalendarImportPanel({candidates=[],selected=new Set(),verified=new Set(),milestones=[],
  loading=false,notice='',error='',reviewOnly=false,esc}){
  const imported=milestones.filter(m=>m.id?.startsWith('m-import-'));
  const saved=new Map(milestones.map(item=>[item.id,item]));
  const counts=imported.length+' imported planning '+(imported.length===1?'anchor':'anchors');
  const rows=candidates.length?'<div class="annual-calendar-import-list">'+candidates.map((item,i)=>{
    const previous=saved.get(item.id),status=statusOf(item,previous);
    const verifiedReady=!item.inactive&&verified.has(item.id)&&
      (previous?.title===item.title&&previous?.date===item.date||!previous);
    return '<article class="annual-calendar-import-event">'+
      '<label class="annual-calendar-import-select"><input type="checkbox" data-calendar-import-select="'+esc(item.id)+'"'+
        (selected.has(item.id)?' checked':'')+' aria-label="Include '+esc(item.title)+'"></label>'+
      '<div class="annual-calendar-import-detail"><strong>'+esc(item.title)+'</strong>'+
      '<span>📅 '+esc(item.date)+' · '+esc(item.origin)+' · '+esc(item.status)+'</span>'+
      (item.description?'<small>'+esc(item.description)+'</small>':'')+
      '<small class="annual-import-existing">'+esc(status)+'</small>'+
      '<label class="annual-calendar-import-verified"><input type="checkbox" data-calendar-import-verify="'+esc(item.id)+'"'+
        (verifiedReady?' checked':'')+(item.inactive?' disabled':'')+'> '+
        (item.inactive?'Run sheet is closed; cannot auto-confirm promotion':
          'Committee has verified this date and approved promotion planning')+'</label>'+
      '</div></article>';
  }).join('')+'</div>':'<p class="annual-small">No dates loaded yet. Read the existing committee calendars or choose a CSV file.</p>';
  return '<details class="annual-calendar-import"><summary><span>📆 Import the committee annual events calendar</span>'+
    '<small>'+counts+' · Extra spontaneous ideas remain welcome</small></summary>'+
    '<div class="annual-calendar-import-content"><p>Bring the committee’s agreed annual events into the social planner without building a second events register. '+
    'Select which events to use, then verify dates before promoting them. Working dates create internal planning prompts only.</p>'+
    (!reviewOnly?'<div class="annual-calendar-import-sources">'+
      '<button type="button" class="button outline" data-events-fetch'+(loading?' disabled':'')+'>↻ Load Sandy Sports event run sheets and meetings</button>'+
      '<span>Sources: <a href="#committee/events">Event run sheets</a> · <a href="#committee/meetings">Committee meetings</a></span>'+
      '</div>':
      '<p class="annual-small"><strong>Public preview:</strong> Private club calendars cannot be loaded here. Use a CSV to test an annual plan.</p>')+
    '<div class="annual-calendar-import-csv"><label>Or import your own annual calendar (CSV)'+
      '<input type="file" data-events-csv accept=".csv,text/csv"></label>'+
      '<button type="button" class="button outline small" data-events-template>Download blank CSV template</button></div>'+
    '<p class="annual-small">CSV headings: <code>title,date,type,id,notes</code>. Dates use YYYY-MM-DD. Type may be event, meeting, season_open or season_close. '+
    'Importing a CSV never proves an event is confirmed.</p>'+
    (error?'<p role="alert" class="annual-import-error">'+esc(error)+'</p>':'')+
    (notice?'<p role="status" class="annual-import-notice">'+esc(notice)+'</p>':'')+
    '<div class="annual-calendar-import-heading"><strong>'+candidates.length+' available events</strong>'+
      '<span>Nothing is imported until you select Apply to Social Studio</span></div>'+
    rows+
    (candidates.length?'<div class="annual-calendar-import-actions">'+
      '<button type="button" class="button" data-events-apply'+(loading?' disabled':'')+'>Import selected events into social patterns</button>'+
      '<button type="button" class="button outline" data-events-select-all>Select all listed</button>'+
      '<button type="button" class="button outline" data-events-select-none>Clear selection</button>'+
    '</div>':'')+
    '<p class="annual-small"><strong>Editorial flexibility:</strong> Verified events can generate invitations, countdowns, day-of ideas and careful follow-ups. '+
    'Unconfirmed dates produce clearly labelled internal planning reminders, not public announcements. '+
    'Individually saved days always take precedence. You can still add an unexpected event, celebrity visit or whimsical idea from Day mode.</p>'+
    '</div></details>';
}
