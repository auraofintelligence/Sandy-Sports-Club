// Visible panels for planned trigger timing and browser-local performance reports.
const LABELS={
  holidays:['🏖️','QLD school holiday inspiration','Seed travel ideas before accommodation is booked'],
  nswHolidays:['🧳','NSW school holiday inspiration','A smaller secondary visitor wave'],
  event:['🎪','Confirmed events and competitions','Start invitations before the event'],
  meeting:['📋','Club meetings','Reminder and RSVP lead-ins'],
  season_open:['🐟','Programme starts','Only use verified programme dates'],
  season_close:['🛟','Programme ends','Explain verified limits and upcoming changes']
};
const escMap=Object.fromEntries([['&','&amp;'],['<','&lt;'],['>','&gt;'],['"','&quot;'],["'",'&#39;']]);
const fallbackEsc=value=>String(value??'').replace(/[&<>"']/g,x=>escMap[x]);
export function renderTimingPanel(settings,esc=fallbackEsc,editingId=''){
  const rules=settings.timingSignals||{};
  const timing=Object.entries(LABELS).map(([kind,[icon,title,subtitle]])=>{
    const rule=rules[kind]||{enabled:false,leadDays:[]};
    return '<article class="annual-signal-card"><div class="annual-signal-heading"><span aria-hidden="true">'+icon+'</span>'+
      '<div><strong>'+esc(title)+'</strong><small>'+esc(subtitle)+'</small></div>'+
      '<label class="annual-signal-switch"><input type="checkbox" data-signal-enabled="'+kind+'"'+(rule.enabled?' checked':'')+'> Active</label></div>'+
      '<label>Lead-in days before target <input data-signal-leads="'+kind+'" type="text" maxlength="64" value="'+rule.leadDays.join(', ')+'" placeholder="84, 56, 42, 28, 14, 7" aria-label="Lead-in days for '+esc(title)+'"></label>'+
      '<small>Example: 84, 56, 42 = 12, 8 and 6 weeks before</small></article>';
  }).join('');
  const editing=(settings.milestones||[]).find(item=>item.id===editingId);
  const milestones=(settings.milestones||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).map(item=>
    '<li><span><strong>'+esc(item.title)+'</strong><small>'+esc(item.date)+' · '+esc(LABELS[item.kind]?.[1]||item.kind)+
    (item.id.startsWith('m-import-')?' · Imported from committee calendar/CSV':'')+
    (item.confirmed?' · Date verified':' · Tentative planning only')+'</small></span>'+
    '<span class="annual-milestone-actions"><button type="button" data-signal-edit="'+esc(item.id)+'">Edit</button>'+
    '<button type="button" data-signal-remove="'+esc(item.id)+'" aria-label="Remove milestone '+esc(item.title)+'">Remove</button></span></li>').join('');
  return '<details class="annual-signals"><summary>📣 Timing signals and lead-in campaigns <small>School holidays, meetings, events and seasons</small></summary>'+
    '<p>Turn lead-ins on or off, then choose how many days ahead to spark interest. Holiday windows are planning ideas, not verified booking behaviour.</p>'+
    '<div class="annual-signal-grid">'+timing+'</div>'+
    '<h3>Confirmed dates and milestones</h3>'+
    '<p>Confirmed dates generate countdowns. Imported unconfirmed dates may show internal preparation ideas only. '+
    'Use the annual calendar importer above to bring existing event records into this list; verify dates and applicable fishing rules before any public promotion.</p>'+
    '<div class="annual-milestone-form"><label>Type <select data-milestone-kind>'+
    Object.entries(LABELS).filter(([k])=>!['holidays','nswHolidays'].includes(k)).map(([k,v])=>
      '<option value="'+k+'"'+(editing?.kind===k?' selected':'')+'>'+esc(v[1])+'</option>').join('')+'</select></label>'+
    '<label>Title <input data-milestone-title maxlength="140" value="'+esc(editing?.title||'')+'" placeholder="E.g. confirmed club fishing meet"></label>'+
    '<label>Target date <input data-milestone-date type="date" value="'+esc(editing?.date||'')+'"></label>'+
    '<label>Official or club reference (optional) <input data-milestone-source type="url" maxlength="400" value="'+esc(editing?.sourceUrl||'')+'" placeholder="https://…"></label>'+
    '<label class="annual-signal-confirm"><input type="checkbox" data-milestone-confirm'+(editing?.confirmed?' checked':'')+'> Date and details verified</label>'+
    '<button type="button" class="button small" data-milestone-add>'+(editing?'Save milestone':'Add milestone')+'</button>'+
    (editing?'<button type="button" class="button outline small" data-milestone-cancel>Cancel edit</button>':'')+'</div>'+
    '<ul class="annual-milestone-list">'+(milestones||'<li>No custom milestones yet. Holiday lead-ins are generated from published school calendars.</li>')+'</ul>'+
    '<button type="button" class="button small" data-signal-save>Save timing patterns</button>'+
    '<p class="annual-small">A future scheduler can consume planned dates and Brisbane times from the CSV export.</p></details>';
}
export function renderAnalyticsPanel({summary=[],patterns=[],unlinked=[],recordCount=0,headers=[],mapping={},platform='facebook',filename='',notice='',esc=fallbackEsc,posts=[]}){
  const fields=[['postId','Sandy Sports post ID'],['externalId','Platform post ID'],['postUrl','Platform post URL'],
    ['publishedAt','Published date'],['views','Views / impressions'],['likes','Likes / reactions'],
    ['comments','Comments'],['shares','Shares'],['saves','Saves'],['clicks','Clicks']];
  const mappingFields=headers.length?'<div class="annual-metric-mapping">'+fields.map(([field,label])=>
    '<label>'+label+'<select data-metric-map="'+field+'"><option value="">Not in file</option>'+
    headers.map(h=>'<option value="'+esc(h)+'"'+(mapping[field]===h?' selected':'')+'>'+esc(h)+'</option>').join('')+
    '</select></label>').join('')+'</div>':'';
  const metricCards=summary.length?'<div class="annual-metrics-platforms">'+summary.map(item=>{
    const rate=item.views?((item.interactions/item.views)*100).toFixed(1):'—';
    const max=Math.max(...summary.map(x=>x.views),1);
    return '<article class="annual-metric-card"><div><strong>'+esc(item.platform)+'</strong><span>'+item.posts+' linked posts</span></div>'+
      '<div><strong>'+item.views.toLocaleString('en-AU')+'</strong><span>Reported visibility</span></div>'+
      '<div><strong>'+item.interactions.toLocaleString('en-AU')+'</strong><span>Interactions</span></div>'+
      '<div><strong>'+rate+(rate==='—'?'':'%')+'</strong><span>Interactions / views*</span></div>'+
      '<div class="annual-metric-bar"><i style="width:'+Math.round(item.views/max*100)+'%"></i></div></article>';
  }).join('')+'</div>':'<p>No linked platform reports yet. Import a CSV after you export it from a social platform.</p>';
  const pendingList=unlinked.slice(0,100),unlinkedOptions=pendingList.map(x=>
    '<option value="'+esc(x.id)+'">'+esc(x.platform+' · '+(x.externalId||x.postUrl||x.filename||'Imported row'))+'</option>').join('');
  const postOptions=posts.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.date+' · '+p.title.slice(0,75))+'</option>').join('');
  return '<details class="annual-analytics"><summary>📊 Learn from actual social results <small>Import, compare and export</small></summary>'+
    '<p>Keep your content plans and platform results together. Import CSV reports locally; nothing is uploaded or connected to social accounts.</p>'+
    '<h3>Platform comparison</h3>'+metricCards+
    '<p class="annual-small">*Platform definitions of reach, impressions, views and interactions differ. Compare trends within each platform; do not treat percentages as equivalent audience measurements.</p>'+
    (patterns.length?'<details class="annual-pattern-insights"><summary>🔎 Content patterns from imported reports</summary>'+
      '<p>Observed averages for categories with at least two linked posts, grouped by platform. Small samples are descriptive, not proof of the best publishing approach.</p>'+
      '<div class="annual-insights-table-wrap"><table><thead><tr><th>Platform</th><th>Sandy Sports content category</th><th>Posts</th><th>Avg. visibility metric</th></tr></thead><tbody>'+
      patterns.slice(0,24).map(x=>'<tr><td>'+esc(x.platform)+'</td><td>'+esc(x.layer.replace(/([A-Z])/g,' $1'))+
        '</td><td>'+x.posts+'</td><td>'+x.averageViews.toLocaleString('en-AU')+'</td></tr>').join('')+
      '</tbody></table></div><p>Use the observations to adjust future timing or topics manually, with real editorial judgement.</p></details>':'')+
    '<div class="annual-analytics-import"><h3>Import a platform CSV</h3><div class="annual-metric-import-controls">'+
    '<label>Platform<select data-metric-platform>'+['youtube','facebook','instagram','tiktok','noticeboard'].map(name=>
      '<option value="'+name+'"'+(name===platform?' selected':'')+'>'+name+'</option>').join('')+'</select></label>'+
    '<label>CSV report<input type="file" accept=".csv,text/csv" data-metric-file></label></div>'+
    (headers.length?'<p>Loaded <strong>'+esc(filename)+'</strong>. Map the report columns below; the Sandy Sports post ID is optional. Unmatched rows can be linked manually.</p>'+
      mappingFields+'<button type="button" class="button small" data-metric-import>Import mapped rows</button>':'')+
    '<p role="status" class="annual-small">'+esc(notice)+'</p></div>'+
    '<div class="annual-metric-reconcile"><h3>Match imported results to planned posts</h3>'+
    '<p>'+recordCount+' imported records · '+unlinked.length+' not linked. Only explicit Sandy Sports IDs or previously linked external IDs are matched automatically.</p>'+
    (unlinked.length?'<div class="annual-metric-link"><label>Unmatched report record<select data-metric-unlinked>'+unlinkedOptions+'</select></label>'+
      '<label>Sandy Sports planned post<select data-metric-link-post>'+postOptions+'</select></label>'+
      '<button class="button small" type="button" data-metric-link>Link this record</button></div>':'')+
    (unlinked.length>100?'<p class="annual-small">Showing the first 100 unmatched records. Link those before continuing.</p>':'')+
    '</div><div class="annual-analytics-export"><button type="button" class="button" data-analytics-export>⬇ Export plan + actual results CSV</button>'+
    '<p class="annual-small">Export includes post ID, content brief, topic, creative format, Brisbane posting time, audience call to action, timing signals, linked platform IDs and recorded metrics.</p></div></details>';
}
