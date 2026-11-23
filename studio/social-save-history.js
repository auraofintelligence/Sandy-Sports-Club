// Committee-only save feedback and full shared change history.
export const officerLabel=(office,name)=>{
  if(!office)return name||'Committee account';
  if(!name||office.toLowerCase().replace(/[\s-]+/g,'')===name.toLowerCase().replace(/[\s-]+/g,''))return office;
  return office+' · '+name;
};
export const saveTime=value=>{
  if(!value||Number.isNaN(Date.parse(value)))return '';
  return new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',
    year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
};
export function renderSaveFeedback({status='idle',message='',latest=null,reviewOnly=false,esc}){
  const classes=['shared','local','error','saving','idle'];
  const style=classes.includes(status)?status:'idle';
  const by=latest?.updatedByName?officerLabel(latest.updatedOffice,latest.updatedByName):'';
  const saved=latest?.updatedAt?saveTime(latest.updatedAt):'';
  const headline=status==='shared'?'✓ Saved for the Sandy Sports committee':
    status==='local'?(latest?.version?'◈ Browser-only save':'◈ Browser-only planning'):
    status==='error'?'⚠ Not saved to the club':
    status==='saving'?'⏳ Saving changes…':
    latest?.version>0?'✓ Shared settings are loaded':'No shared save yet';
  const details=message|| (reviewOnly?'This review page stores settings in this browser, not the club database.':
    'Changes are only shared after the committee database confirms the save.');
  return '<aside class="annual-save-feedback '+style+'" data-save-feedback role="status" aria-live="polite">'+
    '<strong>'+esc(headline)+'</strong><span>'+esc(details)+'</span>'+
    (by?'<small>'+(reviewOnly?'Last browser save: ':'Last shared save: ')+esc(by)+(saved?' · '+esc(saved):'')+
      (latest?.version?' · version '+latest.version:'')+'</small>':'')+
    '</aside>';
}
export function renderCampaignHistory({history=null,loading=false,error='',reviewOnly=false,esc}){
  const preview=reviewOnly;
  const intro=preview?'Only saves on this browser appear here. These are not committee audit records.':
    'Shared revisions are kept in the Sandy Sports database, including saves made through the Webmaster account. Every record identifies the signed-in officer and the fields changed.';
  const entries=Array.isArray(history)?(history.length?'<ol class="annual-history-list">'+history.map(row=>{
    const person=officerLabel(row.actorOffice,row.actorName);
    const changes=row.changes||{count:0,changes:[]};
    const note=changes.note||'';
    return '<li class="annual-history-entry"><div class="annual-history-entry-top">'+
      '<div><strong>Version '+row.version+' · '+esc(person)+'</strong>'+
      '<span>'+esc(saveTime(row.savedAt))+' · '+esc(row.actorRole||'Club account')+'</span></div>'+
      '<button type="button" class="button outline small" data-history-export="'+row.version+'">Download version</button></div>'+
      '<details><summary>'+esc(note||changes.count+' field '+(changes.count===1?'change':'changes'))+'</summary>'+
      (changes.changes?.length?'<ul class="annual-history-diffs">'+changes.changes.map(item=>
        '<li><strong>'+esc(item.field)+'</strong>'+
        '<div><span>Before</span><code>'+esc(item.before)+'</code></div>'+
        '<div><span>After</span><code>'+esc(item.after)+'</code></div></li>').join('')+'</ul>':
        '<p class="annual-small">No field differences recorded for this save.</p>')+
      (changes.count>changes.changes?.length?'<p class="annual-small">Additional changes are included in the downloadable version snapshot.</p>':'')+
      '</details></li>';
  }).join('')+'</ol>':'<p class="annual-small">No versions have been saved yet.</p>'):'';
  return '<details class="annual-history" id="annual-save-history"><summary>🕘 Saved changes and responsible officers <small>'+
    (preview?'This browser only':'Sandy Sports shared history')+'</small></summary>'+
    '<div class="annual-history-body"><p>'+esc(intro)+'</p>'+
    '<button type="button" class="button outline small" data-history-load'+(loading?' disabled':'')+'>'+
      (loading?'Loading…':history?'Refresh change history':'Load change history')+'</button>'+
    (error?'<p role="alert" class="annual-history-error">'+esc(error)+'</p>':'')+
    (history?entries:'<p class="annual-small">Open the change history to review saved versions and their authors.</p>')+
    '</div></details>';
}
