import {CAMPAIGN_LAYERS,POSTING_DAY_TYPES,dayPostingBounds,normaliseDailyLimits,defaultCampaignSettings,generateCampaignYear,monthSettingsFor,copyMonthSettings,weekStart,settingsForDate,scopeSettingsFor} from './social-campaign-engine.js?v=20261123-annual-events';
import {BUILTIN_DAY_PATTERNS,allDayPresets,patternFor,planFromPattern,planFromPosts,newDaySlot,validSlot} from './social-day-patterns.js?v=20261124-itemised';
import {renderItemisedDay,renderWeekItemised,mondayOf,nextDay} from './social-day-ui.js?v=20261123-annual-events';
import {renderSaveFeedback,renderCampaignHistory} from './social-save-history.js?v=20261123-history';
import {PUBLISHING_DESTINATIONS,placementSources,CREATIVE_SPEC_VERSION,MASTER_ASSET_PRESETS} from './social-placements.js?v=20261123-formats';
import {renderDestinationChoices,renderAssetGuide} from './social-format-guide.js?v=20261123-formats';
import {LAYER_ICONS,renderMonthCalendar,renderCalendarDialog,postLabel,postBrief,postTime,isMinuteTime,brisbaneToday} from './social-visual-ui.js?v=20261124-temporal-parity';
import {renderTimingPanel,renderAnalyticsPanel} from './social-insights-ui.js?v=20261123-annual-events';
import {parseDelimited,suggestedMapping,metricFromRow,linkMetrics,latestMetrics,summarizeMetrics,compareContentPatterns,planMetricsCSV} from './social-performance.js?v=20261123-timing-reports';
import {parseAnnualCalendarCSV,clubEventCandidates,meetingCandidates,mergeEventCandidates,importCalendarAnchors,surpriseDayItem} from './social-event-import.js?v=20261123-annual-events';
import {renderCalendarImportPanel} from './social-event-import-ui.js?v=20261123-annual-events';

const endpoint='/api/committee/social-campaign-settings';
const choices={
  membership:[['all','All classes'],['supporter','Interested supporter'],['founder','Prospective founder'],['member','Future member'],['family','Family'],['volunteer','Volunteer'],['partner','Potential partner'],['prospect','Expression of interest']],
  gender:[['all','All genders'],['women','Women'],['men','Men'],['self-described','Other self-described']],
  place:[['all','All locations'],['local','Island locals'],['tourist','Tourists / visitors'],['regional','Regional / mainland']]
};
const checked=value=>value?' checked':'';
const nextMonth=(start,index)=>new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5))-1+index,1)).toISOString().slice(0,7);
const nextMonthValue=value=>nextMonth(value,1);
const monthName=value=>new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',month:'short',year:'numeric'}).format(new Date(value+'-01T00:00:00Z'));
const audienceText=selection=>Object.values(selection||{}).map(values=>values.join(', ')).join(' · ');
const csvDate=value=>value.slice(0,10);

export function setupAnnualCampaigns({mount,api,esc,isActive,onUse,reviewOnly=false,strictShared=false,viewOnly=false}){
  let settings=defaultCampaignSettings(),saved=JSON.stringify(settings),version=0,loaded=false,busy=false,notice='';
  let sharedSettingsReady=true;
  let saveState='idle',saveMessage='',latestSave=null,historyRows=null,historyError='',historyLoading=false;
  const offlineKey='sandy-social-studio-offline-draft-v1';
  const normaliseSettings=value=>{
    const config=value&&typeof value==='object'?value:defaultCampaignSettings();
    config.monthOverrides??={};config.weekOverrides??={};config.dayOverrides??={};
    config.dayPlans??={};config.dayArchetypes??={};
    config.postingTime??='auto';config.timingSignals??=defaultCampaignSettings().timingSignals;
    config.milestones??=[];config.limits=normaliseDailyLimits(config.limits);
    for(const bucket of ['monthOverrides','weekOverrides','dayOverrides'])
      for(const scoped of Object.values(config[bucket])){
        scoped.postingTime??='auto';scoped.limits=normaliseDailyLimits(scoped.limits);
      }
    return config;
  };
  const browserDraft=()=>{
    try{
      const payload=JSON.parse(localStorage.getItem(offlineKey)||'null');
      const value=payload?.version===1?payload.settings:null;
      if(!value||!value.layers||!value.limits||!value.delivery||
        !value.monthOverrides||!value.weekOverrides||!value.dayOverrides)return null;
      return normaliseSettings(value);
    }catch{return null;}
  };
  const saveBrowserDraft=()=>{
    try{localStorage.setItem(offlineKey,JSON.stringify({version:1,settings}));return true;}
    catch{return false;}
  };
  let selectedLayer='volleyball',startMonth=new Date(Date.now()+36000000).toISOString().slice(0,7),selectedMonth=startMonth;
  let lastPreview=null,monthDraft=null,batchMonth='',batchDirty=false;
  let planningScope='month',focusDay=brisbaneToday();
  let workingDayPlans=null,dayFormTouched=false;
  let modalDay=null,modalView='day',modalPostId=null,topicFilter='all',visiblePosts=[],postEdits={};
  let metrics=[],pendingReport=null,metricsPlatform='facebook',metricsNotice='',editingMilestone='';
  let eventCandidates=[],eventSelected=new Set(),eventVerified=new Set(),eventImportNotice='',eventImportError='',eventLoading=false;
  const metricsKey=()=> 'sandy-social-performance-v1:'+(reviewOnly?'review':'committee');
  let metricsVersion=0,lastMetrics=[];
  const importMetrics=async()=>{
    if(strictShared){
      const row=await api('/api/committee/social-metrics',{cache:'no-store'});
      metricsVersion=row.version||0;metrics=Array.isArray(row.metrics)?row.metrics:[];
      lastMetrics=structuredClone(metrics);return;
    }
    try{const data=JSON.parse(localStorage.getItem(metricsKey())||'[]');metrics=Array.isArray(data)?data.slice(0,15000):[]}
    catch{metrics=[]}
  };
  const storeMetrics=async()=>{
    if(strictShared){
      try{
        const result=await api('/api/committee/social-metrics',{method:'POST',
         body:JSON.stringify({version:metricsVersion,metrics})});
        metricsVersion=result.version;lastMetrics=structuredClone(metrics);return true;
      }catch(e){
        metrics=structuredClone(lastMetrics);
        metricsNotice='Imported metrics were NOT saved: '+(e.message||'shared service unavailable');
        return false;
      }
    }
    try{localStorage.setItem(metricsKey(),JSON.stringify(metrics));return true}catch{return false}
  };
  const linkedMetrics=()=>linkMetrics(metrics,lastPreview?.posts||[],postEdits);
  let metricLookup=new Map();
  const metricsForPost=id=>metricLookup.get(id)||[];
  const prepareMetricLookup=()=>{
    metricLookup=new Map();
    for(const metric of latestMetrics(linkedMetrics())){
      if(!metricLookup.has(metric.matchedPostId))metricLookup.set(metric.matchedPostId,[]);
      metricLookup.get(metric.matchedPostId).push(metric);
    }
  };
  const editKey=()=> 'sandy-social-post-edits-v1:'+startMonth+':'+(reviewOnly?'review':'committee');
  let editVersion=0,lastSavedEdits={},editSaveQueue=Promise.resolve();
  async function loadEdits(){
    if(strictShared){
      const row=await api('/api/committee/social-post-edits',{cache:'no-store'});
      editVersion=row.version||0;postEdits=row.edits&&typeof row.edits==='object'?row.edits:{};
      lastSavedEdits=structuredClone(postEdits);return true;
    }
    try{
      const item=JSON.parse(localStorage.getItem(editKey())||'{}');
      postEdits=item&&typeof item==='object'&&!Array.isArray(item)?item:{};
    }catch{postEdits={};}
    return true;
  }
  function persistEdits(){
    if(!strictShared){
      try{localStorage.setItem(editKey(),JSON.stringify(postEdits));return Promise.resolve(true)}
      catch{return Promise.resolve(false)}
    }
    editSaveQueue=editSaveQueue.then(async()=>{
      const copy=structuredClone(postEdits);
      try{
        const result=await api('/api/committee/social-post-edits',{
          method:'POST',body:JSON.stringify({version:editVersion,edits:copy})});
        editVersion=result.version;lastSavedEdits=copy;return true;
      }catch(error){
        postEdits=structuredClone(lastSavedEdits);
        notice='Post edits were NOT saved to the shared database: '+(error?.message||'connection failed')+'. Reload before editing again.';
        return false;
      }
    });
    return editSaveQueue;
  }
  const getEdit=id=>postEdits[id]||{};
  const overrideBucket=()=>({day:'dayOverrides',week:'weekOverrides',month:'monthOverrides'})[planningScope];
  const scopeKey=()=>planningScope==='day'?focusDay:planningScope==='week'?weekStart(focusDay):selectedMonth;
  const scopeLabel=()=>planningScope==='month'?monthName(selectedMonth):
    planningScope==='week'?'week of '+new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(scopeKey()+'T00:00:00Z')):
    new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(focusDay+'T00:00:00Z'));
  const scopeEnd=()=>{
    const offset=planningScope==='day'?1:planningScope==='week'?7:null;
    if(offset===null)return nextMonth(selectedMonth,1);
    return new Date(Date.parse(scopeKey()+'T00:00:00Z')+86400000*offset).toISOString().slice(0,10);
  };
  function currentBatch(){
    const key=planningScope+':'+scopeKey();
    if(!monthDraft||batchMonth!==key){
      batchMonth=key;
      monthDraft=copyMonthSettings(scopeSettingsFor(settings,planningScope,scopeKey()));
      batchDirty=false;
    }
    return monthDraft;
  }
  const draftPlans=()=>workingDayPlans??=(structuredClone(settings.dayPlans||{}));
  const dayPlanFor=day=>{
    const existing=draftPlans()[day];
    if(existing)return existing;
    const posts=(lastPreview?.posts||[]).filter(post=>post.date===day);
    return planFromPosts(posts,postEdits);
  };
  const currentDayKind=day=>dayPostingBounds(day,settingsForDate(settings,day).limits).category;
  const previewSettings=()=>{
    const data={...settings,dayPlans:workingDayPlans??settings.dayPlans};
    if(planningScope==='month')data.monthOverrides={...settings.monthOverrides,[selectedMonth]:currentBatch()};
    return data;
  };
  const selectMonth=month=>{
    selectedMonth=month;
    if(!focusDay.startsWith(month))focusDay=(brisbaneToday().startsWith(month)?brisbaneToday():month+'-01');
    monthDraft=null;batchMonth='';modalDay=null;modalPostId=null;modalView='day';
  };
  const root=()=>mount.querySelector('[data-annual-root]');
  const changed=()=>JSON.stringify(settings)!==saved||Boolean(workingDayPlans&&JSON.stringify(workingDayPlans)!==JSON.stringify(settings.dayPlans));
  const limitChange=(limits,key,value)=>{
    const name=key.endsWith('Min')?key.slice(0,-3):key;
    if(!POSTING_DAY_TYPES.some(day=>day.id===name))return;
    const next=Math.max(1,Math.min(20,Number(value)||1));
    limits[key]=next;
    if(key.endsWith('Min')&&limits[name]<next)limits[name]=next;
    if(!key.endsWith('Min')&&limits[name+'Min']>next)limits[name+'Min']=next;
  };
  const dayTypeNames=POSTING_DAY_TYPES;
  function controls(){
    const rows=CAMPAIGN_LAYERS.map(layer=>{
      const p=settings.layers[layer.id];
      return '<tr><th scope="row">'+esc(layer.label)+'</th>'+
        '<td><input type="checkbox" data-annual-enabled="'+layer.id+'" aria-label="Generate '+esc(layer.label)+'"'+checked(p.enabled)+'></td>'+
        '<td><input type="checkbox" data-annual-visible="'+layer.id+'" aria-label="Show '+esc(layer.label)+'"'+checked(p.visible)+'></td>'+
        '<td><input type="number" data-annual-frequency="'+layer.id+'" aria-label="Weekly frequency for '+esc(layer.label)+'" min="0" max="7" step="1" value="'+p.weekly+'"></td></tr>';
    }).join('');
    const limits=dayTypeNames.map(({id,label,icon})=>
      '<fieldset class="annual-annual-limit-pair"><legend>'+icon+' '+esc(label)+'</legend>'+
      '<label>Minimum <input type="number" data-annual-limit="'+id+'Min" min="1" max="20" step="1" value="'+settings.limits[id+'Min']+'"></label>'+
      '<label>Maximum <input type="number" data-annual-limit="'+id+'" min="1" max="20" step="1" value="'+settings.limits[id]+'"></label></fieldset>').join('');
    const audience=Object.entries(choices).map(([field,options])=>
      '<fieldset><legend>'+{membership:'Member classes',gender:'Gender (voluntary)',place:'Location / visitors'}[field]+'</legend>'+
      options.map(([id,label])=>'<label><input type="checkbox" data-annual-audience="'+field+'" value="'+id+'"'+
        checked(settings.layers[selectedLayer].audience[field].includes(id))+'>'+esc(label)+'</label>').join('')+
      '</fieldset>').join('');
    const delivery=mode=>renderDestinationChoices({destinations:PUBLISHING_DESTINATIONS,selected:settings.delivery[mode],
      mode,prefix:'data-annual-destination',esc});
    return '<div class="annual-settings"><div class="annual-limits">'+limits+
      '<label>Video share target <input type="number" data-annual-video min="0" max="100" step="1" value="'+settings.videoShare+'"><small>% of posts</small></label></div>'+
      '<div class="annual-delivery"><h3>Publishing placements and advertising</h3>'+delivery('organic')+
      '<label><input type="checkbox" data-annual-paid-planning'+checked(settings.delivery.paidPlanning)+'> Include paid-ad creative suggestions (approval required)</label>'+
      delivery('paid')+
      '<p class="annual-small">Paid presets are only production briefs. Budgets, accounts, targeting permission, review and launch must be agreed separately. Straddie Noticeboard is a proposed outlet, not a connected advertising service.</p></div>'+
      '<div class="annual-pattern-table"><table><thead><tr><th>Pattern layer</th><th>Generate</th><th>Show</th><th>Per week</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="annual-audience"><label>Audience for <select data-annual-select-layer>'+
      CAMPAIGN_LAYERS.map(layer=>'<option value="'+layer.id+'"'+(selectedLayer===layer.id?' selected':'')+'>'+esc(layer.label)+'</option>').join('')+
      '</select></label>'+audience+'</div>'+
      '<p class="annual-small">NSW visits form a separate, smaller wave: two suggestions per week by default versus three for QLD breaks. Western NSW summer extensions receive up to one suggestion per week. Overlap never doubles the daily cap.</p>'+
      '<p class="annual-small">Audience categories guide content, not who can view public posts. Gender is voluntary and never inferred. No automated publishing is enabled.</p>'+
      '<div class="annual-actions"><button type="button" class="button" data-annual-save'+(busy?' disabled':'')+'>'+(reviewOnly?'Save draft settings in this browser':'Save committee settings')+'</button>'+
      '<button type="button" class="button outline" data-annual-reload'+(busy?' disabled':'')+'>Reload saved settings</button></div></div>';
  }

  function dailyWeekControls(){
    const dates=lastPreview?.days||[];
    if(!dates.some(item=>item.date===focusDay))focusDay=dates[0]?.date||focusDay;
    if(planningScope==='day'){
      const day=focusDay,dayPlan=dayPlanFor(day),type=currentDayKind(day);
      return renderItemisedDay({day,type,dayPlan,savedPatterns:settings.dayArchetypes,
        esc,layers:CAMPAIGN_LAYERS,reviewOnly});
    }
    const monday=mondayOf(focusDay);
    return renderWeekItemised({
      day:focusDay,startDate:monday,esc,savedPatterns:settings.dayArchetypes,
      dates:Array.from({length:7},(_,i)=>{
        const date=nextDay(monday,i),inside=dates.some(d=>d.date===date);
        const type=currentDayKind(date);
        const plan=inside?dayPlanFor(date):{items:[]};
        return {date,type,items:plan.items,patternId:plan.patternId||'',
          signature:plan.signature||null,curated:Boolean(draftPlans()[date]),inside};
      })
    });
  }
  function captureDayEditor(force=false){
    if(planningScope!=='day'||(!dayFormTouched&&!force))return;
    const editor=root()?.querySelector('[data-day-editor]');
    if(!editor||editor.dataset.dayEditor!==focusDay)return;
    const existing=dayPlanFor(focusDay);
    const items=[...editor.querySelectorAll('[data-daily-item]')].map(item=>{
      const read=field=>item.querySelector('[data-day-item-field="'+field+'"]')?.value||'';
      return {id:item.dataset.dailyItem,layerId:read('layerId'),time:read('time'),
        format:read('format'),title:read('title').trim(),brief:read('brief').trim()};
    });
    if(!items.length){
      notice='Keep at least one post on each day.';
      const status=root()?.querySelector('[data-annual-notice]');if(status)status.textContent=notice;
      return false;
    }
    if(items.some(item=>!validSlot(item))){
      notice='Check each post’s title, time, topic and format.';
      const status=root()?.querySelector('[data-annual-notice]');if(status)status.textContent=notice;
      return false;
    }
    draftPlans()[focusDay]={patternId:existing.patternId||'',items,
      ...(existing.signature?{signature:existing.signature}:{})};
    dayFormTouched=false;return true;
  }
  function applyDailyPattern(date,id){
    const type=currentDayKind(date),pattern=patternFor(type,id,settings.dayArchetypes);
    if(!pattern)return false;
    const previous=draftPlans()[date];
    draftPlans()[date]={...planFromPattern(pattern),
      ...(previous?.signature?{signature:previous.signature}:{})};
    dayFormTouched=false;
    return true;
  }
  function saveItemisedPlans(label){
    settings.dayPlans=structuredClone(draftPlans());
    notice='Saving '+label+' as a committee planning draft; no posts are authorised or published.';
    void save();
  }
  function monthControls(){
    if(planningScope!=='month')return dailyWeekControls();
    const batch=currentBatch();
    const activeLayers=CAMPAIGN_LAYERS.filter(layer=>batch.layers[layer.id]?.enabled&&batch.layers[layer.id]?.weekly>0);
    const popular=['volleyball','other','flagFootball','beachCricket','health','visitors','voice','events','film','weather'];
    const quick=CAMPAIGN_LAYERS.filter(layer=>popular.includes(layer.id)).map(layer=>
      '<label class="annual-quick-topic"><input type="checkbox" data-month-enabled="'+layer.id+'"'+checked(batch.layers[layer.id]?.enabled)+'>'+
      '<span aria-hidden="true">'+(LAYER_ICONS[layer.id]||'📌')+'</span><span>'+esc(layer.label)+'</span></label>').join('');
    const monthCustom=Boolean(settings.monthOverrides[selectedMonth]);
    const enabledSummary='<aside class="annual-pattern-status'+(activeLayers.length?' active':' empty')+'" role="status">'+
      '<strong>'+(activeLayers.length?activeLayers.length+' active topic patterns':'No content patterns switched on')+'</strong>'+
      '<span>'+(activeLayers.length?'The calendar below previews these topics. Apply & save to keep this month.':
      'The daily minimums will not generate posts until you switch on a topic below.')+'</span>'+
      (monthCustom?'<span class="annual-scope-note">This month has custom settings that override annual themes. '+
      '<button type="button" data-month-use-annual class="button outline small">Use annual themes for this month</button></span>':'')+
      '</aside>';
    const quickPick='<section class="annual-topic-quickpanel" aria-label="Quick topic switches"><h3>Choose topics to generate posts</h3>'+
      '<p>Switch on a topic below. Its posting frequency is adjustable under “All topic sliders.” Generate creates posts; Show only hides them.</p>'+
      '<div class="annual-quick-topic-grid">'+quick+'</div></section>';
    const chosen=scopeKey(),bucket=overrideBucket();
    const scopes=[['day','Day'],['week','Week'],['month','Month']].map(([id,label])=>
      '<button type="button" data-planning-scope="'+id+'" aria-pressed="'+(planningScope===id)+'">'+label+'</button>').join('');
    const range=(label,icon,attr,value,max,unit='')=>
      '<label class="annual-range-card"><span class="annual-range-heading"><span class="annual-range-label"><span aria-hidden="true">'+icon+'</span> '+esc(label)+'</span>'+
      '<output data-range-output="'+attr+'">'+value+unit+'</output></span>'+
      '<input type="range" min="'+(attr==='video'?0:1)+'" max="'+max+'" step="1" '+(attr==='video'?'data-month-video': 'data-month-limit="'+attr+'"')+
      ' value="'+value+'" aria-label="'+esc(label)+'"></label>';
    const limits=dayTypeNames.map(({id,label,icon})=>
      '<fieldset class="annual-limit-pair"><legend>'+icon+' '+esc(label)+'</legend>'+
      '<div class="annual-limit-range-grid">'+
      range('Minimum','🔽',id+'Min',batch.limits[id+'Min'],20)+
      range('Maximum','🔼',id,batch.limits[id],20)+'</div>'+
      '<small>'+batch.limits[id+'Min']+' to '+batch.limits[id]+' suggested posts per day</small></fieldset>').join('');
    const layers=CAMPAIGN_LAYERS.map(layer=>{
      const row=batch.layers[layer.id];
      return '<article class="annual-topic-card"><div class="annual-topic-top"><span class="annual-topic-icon" aria-hidden="true">'+(LAYER_ICONS[layer.id]||'📌')+'</span>'+
        '<strong>'+esc(layer.label)+'</strong></div>'+
        '<div class="annual-topic-toggles"><label><input type="checkbox" data-month-enabled="'+layer.id+'"'+checked(row.enabled)+'> Generate</label>'+
        '<label><input type="checkbox" data-month-visible="'+layer.id+'"'+checked(row.visible)+'> 👁 Show</label></div>'+
        '<label class="annual-topic-range"><span>Posts per week <output data-range-output="layer-'+layer.id+'">'+row.weekly+'</output></span>'+
        '<input type="range" min="0" max="7" step="1" data-month-weekly="'+layer.id+'" value="'+row.weekly+'"></label></article>';
    }).join('');
    const audience=Object.entries(choices).map(([field,options])=>
      '<fieldset><legend>'+{membership:'Membership class',gender:'Gender (voluntary)',place:'Location and visitors'}[field]+'</legend>'+
      options.map(([id,label])=>'<label><input data-month-audience="'+field+'" type="checkbox" value="'+id+'"'+
        checked(batch.layers[selectedLayer].audience[field].includes(id))+'>'+esc(label)+'</label>').join('')+'</fieldset>').join('');
    const destinations=mode=>renderDestinationChoices({destinations:PUBLISHING_DESTINATIONS,selected:batch.delivery[mode],
      mode,prefix:'data-month-destination',esc});
    return '<section class="annual-batch" id="annual-plan-settings" aria-label="Day, week or month planning controls">'+
      '<header class="annual-batch-head"><div><span class="annual-eyebrow">🎛️ PLAN YOUR POSTS</span>'+
      '<h2>Plan '+esc(scopeLabel())+'</h2></div>'+
      '<span class="annual-batch-status">'+((settings[bucket]||{})[chosen]?'Custom schedule':'Annual defaults')+
      (batchDirty?' · unsaved changes':'')+'</span></header>'+
      '<div class="annual-scope-toolbar"><div class="annual-scope-buttons" aria-label="Choose planning period">'+scopes+'</div>'+
      '<label>Day to plan <input type="date" data-scope-day value="'+focusDay+'" min="'+startMonth+'-01" max="'+new Date(Date.UTC(Number(startMonth.slice(0,4))+1,Number(startMonth.slice(5))-1,0)).toISOString().slice(0,10)+'"></label></div>'+
      '<details class="annual-month-bulk-options"><summary><span>🎛️ Pattern sliders and bulk options</span>'+
      '<small>Video share, posting ranges, topics and platforms · Open to adjust</small></summary>'+
      '<div class="annual-month-bulk-body">'+enabledSummary+quickPick+
      '<div class="annual-time-default"><label>🕒 First post time (Brisbane AEST)'+
      '<input type="time" step="60" data-scope-time value="'+(batch.postingTime==='auto'?'':esc(batch.postingTime))+'"></label>'+
      '<button type="button" data-scope-auto class="button outline small">Use suggested times</button>'+
      '<span>Choose any hour and minute. Further posts are staggered; individual times can be edited in each post.</span></div>'+
      '<div class="annual-slider-grid">'+range('Video share','🎬','video',batch.videoShare,100,'%')+'</div>'+
      '<div class="annual-day-limits"><div class="annual-day-limits-head"><strong>📆 Posting frequency by day type</strong>'+
      '<p>Choose the minimum and maximum for each kind of day. Each date follows one set of limits, even when holidays overlap.</p></div>'+
      '<div class="annual-day-limit-grid">'+limits+'</div>'+
      '<p class="annual-small">Priority: public holiday → long weekend → QLD school holidays → Friday → weekend → ordinary weekday. '+
      'Dates: <a href="https://www.qld.gov.au/recreation/travel/holidays/public" target="_blank" rel="noopener noreferrer">QLD public holidays</a> and '+
      '<a href="https://www.qld.gov.au/recreation/travel/holidays/show" target="_blank" rel="noopener noreferrer">local show holidays</a>. Unannounced Redland show holidays are not assumed.</p></div>'+
      '<details class="annual-batch-layer-options"><summary><span>🏐 All topic sliders, visibility and audiences</span><small>'+CAMPAIGN_LAYERS.length+' adjustable categories</small></summary>'+
      '<div class="annual-topic-grid">'+layers+'</div>'+
      '<div class="annual-audience"><label>Audience settings for <select data-month-select-layer>'+
      CAMPAIGN_LAYERS.map(layer=>'<option value="'+layer.id+'"'+(selectedLayer===layer.id?' selected':'')+'>'+esc(layer.label)+'</option>').join('')+
      '</select></label>'+audience+'</div></details>'+
      '<details class="annual-batch-platform-options"><summary><span>📱 Publishing formats and ad ideas</span><small>5 destinations</small></summary>'+
      destinations('organic')+
      '<label class="annual-batch-check"><input type="checkbox" data-month-paid-planning'+checked(batch.delivery.paidPlanning)+'> Include paid creative suggestions</label>'+
      destinations('paid')+'</details>'+
      '<div class="annual-actions"><button type="button" class="button" data-month-apply'+(busy?' disabled':'')+'>✓ Apply & save '+esc(scopeLabel())+'</button>'+
      '<button type="button" class="button outline" data-month-copy-next'+(busy?' disabled':'')+'>Copy to next '+planningScope+'</button>'+
      '<button type="button" class="button outline" data-month-reset'+(busy?' disabled':'')+'>Reset '+planningScope+'</button></div>'+
      (saveMessage?'<p class="annual-month-save-message" role="status">'+esc(saveMessage)+'</p>':'')+
      '<p class="annual-small">Monthly patterns are planning suggestions. Individually edited days remain protected; generating a schedule never authorises publication.</p>'+
      '</div></details></section>';
  }

  function preview(){
    if(!loaded)return saveState==='error'?'<p class="annual-loading" role="alert">'+esc(saveMessage||'Shared club records unavailable. No changes have been saved.')+'</p>':
      '<p class="annual-loading" role="status">Preparing your calendar…</p>';
    const months=Array.from({length:12},(_,i)=>nextMonth(startMonth,i));
    if(!months.includes(selectedMonth))selectMonth(months[0]);
    const scoped=previewSettings();
    let plan;try{plan=generateCampaignYear(startMonth,scoped);}catch(e){return '<p role="alert">'+esc(e.message)+'</p>';}
    lastPreview=plan;
    prepareMetricLookup();
    const allVisible=plan.posts.filter(p=>!getEdit(p.id).hidden &&
      (p.layerIds.includes('daily')||p.layerIds.some(id=>settingsForDate(scoped,p.date).layers[id]?.visible)));
    visiblePosts=topicFilter==='all'?allVisible:allVisible.filter(p=>p.layerIds.includes(topicFilter));
    const current=visiblePosts.filter(p=>p.date.startsWith(selectedMonth));
    const monthDays=plan.days.filter(day=>day.date.startsWith(selectedMonth));
    const qld=monthDays.filter(day=>day.holiday).length,nsw=monthDays.filter(day=>day.nswHoliday).length;
    const videoCount=current.filter(p=>p.durationSeconds).length,composites=current.filter(p=>p.composite).length;
    const i=months.indexOf(selectedMonth);
    const todayIso=brisbaneToday(),todayMonth=todayIso.slice(0,7),todayInRange=months.includes(todayMonth);
    const todayLabel=new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(todayIso+'T00:00:00Z'));
    const choice=months.map(m=>'<option value="'+m+'"'+(m===selectedMonth?' selected':'')+'>'+monthName(m)+'</option>').join('');
    const stat=(icon,value,label)=>'<div class="annual-stat-card"><span class="annual-stat-icon" aria-hidden="true">'+icon+'</span>'+
      '<div><strong>'+value+'</strong><span>'+esc(label)+'</span></div></div>';
    const master='<details class="annual-master-library"><summary>📐 Visual guide: sizes, aspect ratios and export examples</summary>'+
      renderAssetGuide({presets:MASTER_ASSET_PRESETS,esc,version:CREATIVE_SPEC_VERSION.id})+
      '<p class="annual-format-sources">Check official current placement guidelines: '+
      '<a href="'+esc(placementSources.meta)+'" target="_blank" rel="noopener noreferrer">Meta</a> · '+
      '<a href="'+esc(placementSources.googleAds)+'" target="_blank" rel="noopener noreferrer">Google Ads</a> · '+
      '<a href="'+esc(placementSources.tiktok)+'" target="_blank" rel="noopener noreferrer">TikTok</a>.</p></details>';
    return '<div class="annual-preview">'+
      '<div class="annual-month-toolbar"><div><span class="annual-eyebrow">YOUR CONTENT STUDIO · 365-DAY PLAN</span>'+
      '<h2>'+monthName(selectedMonth)+'</h2><p>Choose a day to see what you could share.</p></div>'+
      '<div class="annual-month-navigation"><button type="button" data-annual-step="-1" aria-label="Previous month"'+(i===0?' disabled':'')+'>‹</button>'+
      '<label class="sr-only" for="annual-month-picker">Choose a month</label>'+
      '<select id="annual-month-picker" data-annual-month>'+choice+'</select>'+
      '<button type="button" data-annual-step="1" aria-label="Next month"'+(i===months.length-1?' disabled':'')+'>›</button>'+
      '<button type="button" class="annual-jump-today" data-annual-today'+(todayInRange?'':' disabled title="Today is outside this planning year"')+'>Go to today</button></div></div>'+
      (current.length===0?'<aside class="annual-calendar-empty" role="status"><strong>No posts in '+monthName(selectedMonth)+'</strong><span>Switch on a content topic under Plan your posts → Pattern sliders. Save the month when the calendar shows the posts you want. Posting minimums, video share and visibility alone do not activate topics.</span><button type="button" data-month-open-topics class="button outline small">Choose topics</button></aside>':'')+
      '<div class="annual-visual-stats">'+stat('🗓️',current.length,'Posts this month')+
      stat('🎬',videoCount+' / '+current.length,'Video ideas')+
      stat('🔗',composites,'Combined topics')+
      stat('🏖️',qld+(nsw?' + '+nsw:''),'QLD / NSW holiday days')+'</div>'+
      '<section class="annual-calendar-shell" aria-label="Click-to-open monthly calendar">'+
      '<div class="annual-temporal-key" role="note" aria-label="Date status key: past today and future in Brisbane time">'+
      '<span class="annual-date-key past"><strong>PAST</strong><small>Before today</small></span>'+
      '<span class="annual-date-key today"><strong>TODAY</strong><small>'+esc(todayLabel)+' · Brisbane</small></span>'+
      '<span class="annual-date-key future"><strong>FUTURE</strong><small>After today</small></span></div>'+
      '<div class="annual-calendar-header"><div><h3>📅 Calendar</h3><p>Tap any date for a quick brief. Open a post to edit or explore.</p></div>'+
      '<label class="annual-calendar-filter">Topic <select data-annual-topic>'+
      '<option value="all">All topics</option>'+CAMPAIGN_LAYERS.map(l=>'<option value="'+l.id+'"'+(topicFilter===l.id?' selected':'')+'>'+
      esc((LAYER_ICONS[l.id]||'📌')+' '+l.label)+'</option>').join('')+'</select></label></div>'+
      renderMonthCalendar({month:selectedMonth,days:plan.days,posts:current,esc,metricsForPost,
        getPostTime:post=>postTime(post,getEdit(post.id))})+
      '<div class="annual-calendar-legend"><span class="annual-legend-today">● Today</span>'+
      '<span class="annual-legend-past">◐ Past</span><span class="annual-legend-future">○ Future</span>'+
      '<span class="annual-legend-holiday"><span class="annual-cal-notation ph">PH</span> Public holiday</span>'+
      '<span class="annual-legend-long"><span class="annual-cal-notation lw">LW</span> Long weekend</span>'+
      '<span><i class="qld"></i> QLD school holidays</span><span><i class="nsw"></i> NSW school holidays</span></div></section>'+
      '<div class="annual-schedule-export"><span>🕒 '+(current.length?'Tap a date to review or edit this draft schedule.':'Start by switching on topic patterns, or plan one day manually. No posts have been generated.')+'</span>'+
      (Object.values(postEdits).some(e=>e.hidden)?'<button type="button" class="button outline small" data-calendar-restore>Restore removed suggestions</button>':'')+
      '<div class="annual-schedule-actions"><button type="button" class="button outline small" data-calendar-export>⬇ Export monthly schedule CSV</button>'+
      '<button type="button" class="button outline small" data-calendar-copy-creation>📋 Copy monthly creation brief</button></div></div>'+
      monthControls()+
      '<details class="annual-year-overview"><summary>🗓️ Browse all 12 months <small>'+plan.totals.posts+' planned suggestions</small></summary>'+
      '<div class="annual-month-grid">'+months.map(m=>'<button type="button" data-annual-go="'+m+'" aria-pressed="'+(selectedMonth===m)+'">'+
      monthName(m)+'<span>'+allVisible.filter(p=>p.date.startsWith(m)).length+' ideas</span></button>').join('')+'</div>'+
      '<label class="annual-start-choice">Year begins <input type="month" data-annual-start min="2026-01" max="2028-02" value="'+startMonth+'"></label></details>'+
      master+
      '<p class="annual-small annual-footer-guidance">Ideas are drafts. Check dates, permissions, applicable sport rules and current conditions before publishing.</p></div>';
  }

  function markup(){
    const visual=preview();
    const performanceRows=linkedMetrics();
    const current=visiblePosts.filter(p=>p.date.startsWith(selectedMonth));
    const analytics=renderAnalyticsPanel({
      summary:summarizeMetrics(performanceRows,current),
      patterns:compareContentPatterns(performanceRows,current),
      unlinked:performanceRows.filter(m=>!m.matchedPostId),
      recordCount:metrics.length,headers:pendingReport?.headers||[],
      mapping:pendingReport?.mapping||{},platform:metricsPlatform,filename:pendingReport?.filename||'',
      notice:metricsNotice,posts:current,esc
    });
    const importedEvents=renderCalendarImportPanel({candidates:eventCandidates,selected:eventSelected,verified:eventVerified,
      milestones:settings.milestones,loading:eventLoading,notice:eventImportNotice,error:eventImportError,reviewOnly,esc});
    const signals=renderTimingPanel(settings,esc,editingMilestone);
    const popup=renderCalendarDialog({day:modalDay,view:modalView,postId:modalPostId,
      posts:visiblePosts,plan:lastPreview,esc,getEdit,reviewOnly,metricsForPost});
    return '<section class="annual-root" data-annual-root aria-label="12-month social workbench">'+
      '<details class="annual-planner" open><summary><strong>📅 Social media workbench</strong> · 12-month plan</summary>'+
      (loaded?renderSaveFeedback({status:saveState,message:saveMessage,latest:latestSave,reviewOnly,esc}):'')+
      (loaded&&!sharedSettingsReady?'<div class="annual-storage-warning" role="alert"><strong>Shared settings are unavailable</strong>'+
        '<p>Your planning calendar still works. Changes here stay in this browser only and are not shared with Sandy Sports officers.</p>'+
        '<button type="button" class="button outline small" data-annual-reconnect>Retry connection</button></div>':'')+
      visual+(loaded?importedEvents+renderCampaignHistory({history:historyRows,loading:historyLoading,
        error:historyError,reviewOnly,esc})+signals+analytics:'')+
      (loaded?'<details class="annual-default-settings"><summary>⚙️ Global annual defaults</summary>'+controls()+'</details>':'')+
      '</details><p class="annual-small" data-annual-notice role="status" aria-live="polite">'+esc(notice)+'</p>'+
      popup+'</section>';
  }
  function draw(){
    const pane=root();if(!pane)return;
    const states={};
    for(const cls of ['annual-planner','annual-month-bulk-options','annual-batch-layer-options','annual-batch-platform-options',
      'annual-default-settings','annual-year-overview','annual-master-library','annual-history','annual-calendar-import','annual-signals','annual-analytics']){
      states[cls]=pane.querySelector('.'+cls)?.open??(cls==='annual-planner');
    }
    const temp=document.createElement('div');temp.innerHTML=markup();
    const next=temp.firstElementChild;pane.replaceWith(next);
    for(const [cls,open] of Object.entries(states)){
      const panel=next.querySelector('.'+cls);if(panel)panel.open=open;
    }
    if(modalDay){
      const dialog=next.querySelector('[data-annual-day-dialog]');
      if(dialog && !dialog.open)dialog.showModal();
    }
  }
  async function open(){
    if(loaded||busy||!isActive())return;
    busy=true;
    try{
      const row=await api(endpoint,{cache:'no-store'});
      if(!isActive())return;
      version=row.version;
      const remote=normaliseSettings(row.settings||defaultCampaignSettings());
      const local=!reviewOnly&&!strictShared?browserDraft():null;
      settings=local||remote;saved=JSON.stringify(remote);sharedSettingsReady=true;
      loaded=true;monthDraft=null;batchMonth='';workingDayPlans=null;dayFormTouched=false;await loadEdits();await importMetrics();
      latestSave={version:row.version,updatedAt:row.updatedAt,updatedByName:row.updatedByName,updatedOffice:row.updatedOffice};
      historyRows=null;historyError='';
      saveState=local||reviewOnly?'local':row.version>0?'shared':'idle';
      saveMessage=local?'Browser-only changes loaded. Review them before sharing with the committee.':
        reviewOnly?'Trial settings are kept in this browser between refreshes; no club data is changed.':
        viewOnly?'Synthetic settings loaded. No actual club plan is displayed.':row.updatedAt?'Shared settings loaded from the Sandy Sports database.':'No committee settings saved yet.';
      notice=saveMessage;
    }catch(e){
      if(!isActive())return;
      if(!strictShared&&e.status>=500){
        settings=browserDraft()||normaliseSettings(defaultCampaignSettings());
        saved=JSON.stringify(settings);loaded=true;sharedSettingsReady=false;
        version=0;monthDraft=null;batchMonth='';workingDayPlans=null;dayFormTouched=false;await loadEdits();await importMetrics();
        latestSave=null;saveState='local';historyRows=null;
        saveMessage='The club database is unavailable. Changes can be kept in this browser, but not shared yet.';
        notice=saveMessage;
      }else{
        saveState='error';saveMessage='Could not load committee settings: '+e.message;notice=saveMessage;
      }
    }finally{busy=false;draw();}
  }
  async function save(){
    if(viewOnly){notice='Synthetic view only. No change can be saved.';draw();return;}
    if(busy||!loaded||!isActive())return;
    if(!sharedSettingsReady){
      if(strictShared){saveState='error';saveMessage='Cannot save: the shared club database is unavailable. No browser-local substitute will be used.';notice=saveMessage;draw();return;}
      if(saveBrowserDraft()){
        saved=JSON.stringify(settings);
        saveState='local';saveMessage='Saved on this browser only. Retry the connection before treating this as shared with Sandy Sports.';
      }else{
        saveState='error';saveMessage='This browser could not store the settings. Nothing is confirmed as saved.';
      }
      notice=saveMessage;draw();return;
    }
    busy=true;saveState='saving';saveMessage='Saving and checking the result…';draw();
    try{
      const row=await api(endpoint,{method:'POST',body:JSON.stringify({version,settings})});
      if(!isActive())return;
      version=row.version;settings=normaliseSettings(row.settings);
      saved=JSON.stringify(settings);workingDayPlans=null;dayFormTouched=false;
      latestSave={version:row.version,updatedAt:row.updatedAt,
        updatedByName:row.updatedByName,updatedOffice:row.updatedOffice};
      historyRows=null;historyError='';
      if(!viewOnly)try{localStorage.removeItem(offlineKey);}catch{}
      saveState=reviewOnly?'local':'shared';
      saveMessage=reviewOnly?'Saved on this browser. The calendar now uses the saved topic switches and posting limits. This is not shared with Sandy Sports.':
        'Saved to the shared Sandy Sports database as version '+row.version+'. You can refresh without losing these settings.';
      notice=saveMessage;
    }catch(e){
      const draftKept=strictShared?false:saveBrowserDraft();
      if(e.status>=500)sharedSettingsReady=false;
      saveState=draftKept?'local':'error';
      saveMessage=(e.status===409?'Another officer saved a newer version. ':
        e.message?e.message+'. ':'The save was not confirmed. ')+
        (draftKept?'Your settings are preserved only in this browser, not shared with Sandy Sports.':
          'Your settings could not be stored. Do not leave this page without copying them.');
      notice=saveMessage;
    }finally{busy=false;draw();}
  }
  async function loadHistory(){
    if(historyLoading||!loaded)return;
    historyLoading=true;historyError='';draw();
    try{
      const result=await api(endpoint+'?history=1',{cache:'no-store'});
      if(!isActive())return;
      historyRows=result.history||[];
    }catch(e){historyError='Could not load the change history: '+e.message;}
    finally{historyLoading=false;draw();}
  }
  async function exportHistoryVersion(value){
    const number=Number(value);
    if(!Number.isInteger(number)||number<1)return;
    try{
      const result=await api(endpoint+'?version='+number,{cache:'no-store'});
      if(!isActive())return;
      const blob=new Blob([JSON.stringify(result.revision,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='sandy-social-settings-version-'+number+'.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      notice='Downloaded version '+number+' for comparison. Nothing was restored or overwritten.';
    }catch(e){historyError='Could not download version '+number+': '+e.message;draw();}
  }
  function updateAudience(field,id,on){
    const existing=settings.layers[selectedLayer].audience[field];
    let list=id==='all'?['all']:on?[...existing.filter(v=>v!=='all'),id]:existing.filter(v=>v!==id);
    if(!list.length)list=['all'];
    settings.layers[selectedLayer].audience[field]=[...new Set(list)];
  }
  async function copyMonthlyCreationBrief(){
    if(!lastPreview)return;
    const current=lastPreview.posts.filter(p=>p.date.startsWith(selectedMonth)&&!getEdit(p.id).hidden);
    const brief=[
      'Sandy Sports Social Studio · '+monthName(selectedMonth)+' content preparation brief',
      'Prepared for Sandy Sports editorial review. This is NOT approval to publish.',
      'An agreed content creator, including a proposed Ready SET Co-op service, may prepare draft graphics, videos, captions and posting plans.',
      'Sandy Sports keeps the right to edit, add, remove or reject all material before deciding whether to approve it.',
      ...current.map(post=>
        post.date+' '+postTime(post,getEdit(post.id))+' AEST · '+postLabel(post,getEdit(post.id))+
        '\n'+postBrief(post,getEdit(post.id))+
        '\nFormats: '+post.format+' · Platforms: '+post.channels.join(', '))
    ].join('\n\n');
    try{
      await navigator.clipboard.writeText(brief);
      notice='Copied '+current.length+' planned ideas. Share the brief only if the club chooses an external creator.';
      const output=root()?.querySelector('[data-annual-notice]');if(output)output.textContent=notice;
    }catch{
      notice='Could not access the clipboard. Use the monthly CSV export instead.';
    }
  }
  function exportSchedule(){
    if(!lastPreview)return;
    const columns=['post_id','date','time_AEST','time_zone','title','content_format','channels','status','brief','notes','lead_signal_kind','lead_days','views','likes','comments','shares','saves','clicks'];
    const rows=lastPreview.posts.filter(p=>p.date.startsWith(selectedMonth)).map(p=>{
      const edit=getEdit(p.id);
      const item={
        post_id:p.id,date:p.date,time_AEST:postTime(p,edit),time_zone:'Australia/Brisbane',
        title:postLabel(p,edit),content_format:p.format,channels:p.channels.join('|'),status:edit.status||'Idea',
        brief:postBrief(p,edit),notes:edit.notes||'',
        lead_signal_kind:p.timingSignal?.kind||'',lead_days:p.timingSignal?.leadDays??'',
        views:edit.metrics?.views??'',likes:edit.metrics?.likes??'',comments:edit.metrics?.comments??'',
        shares:edit.metrics?.shares??'',saves:edit.metrics?.saves??'',clicks:edit.metrics?.clicks??''
      };
      return columns.map(key=>{
        let cell=String(item[key]??'').replace(/\r?\n/g,' ');
        if(/^\s*[=+@-]/.test(cell))cell="'"+cell;
        return '"'+cell.replaceAll('"','""')+'"';
      }).join(',');
    });
    const csv='\uFEFF'+[columns.join(','),...rows].join('\r\n');
    const link=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    link.href=url;link.download='sandy-social-schedule-'+selectedMonth+'.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    notice='Exported '+rows.length+' posts for '+monthName(selectedMonth)+'. Times use Brisbane AEST.';
  }

  async function loadClubAnnualEvents(){
    if(eventLoading||reviewOnly||!loaded)return;
    eventLoading=true;eventImportError='';eventImportNotice='Reading the existing committee calendar…';draw();
    const result=await Promise.allSettled([
      api('/api/committee/events',{cache:'no-store'}),
      api('/api/meetings',{cache:'no-store'})
    ]);
    if(!isActive())return;
    eventLoading=false;
    const items=[],problems=[];
    if(result[0].status==='fulfilled')items.push(...clubEventCandidates(result[0].value.events,startMonth));
    else problems.push('event run sheets: '+result[0].reason?.message);
    if(result[1].status==='fulfilled')items.push(...meetingCandidates(result[1].value.meetings,startMonth));
    else problems.push('meeting register: '+result[1].reason?.message);
    if(items.length){
      eventCandidates=mergeEventCandidates(eventCandidates,items);
      const previous=new Map(settings.milestones.map(m=>[m.id,m]));
      for(const item of items){
        const old=previous.get(item.id);
        if(!item.inactive||old)eventSelected.add(item.id);
        if(!item.inactive&&old?.confirmed&&old.title===item.title&&old.date===item.date)
          eventVerified.add(item.id);
        else eventVerified.delete(item.id);
      }
      eventImportNotice='Found '+items.length+' dated records. Review the selection and verified-date boxes before importing.';
    }else eventImportNotice='No dated committee events or meetings found in this 12-month window.';
    eventImportError=problems.join('; ');draw();
  }
  mount.addEventListener('change',async event=>{
    const file=event.target;
    if(!file.hasAttribute('data-events-csv'))return;
    const selected=file.files?.[0];if(!selected)return;
    try{
      if(selected.size>3_000_000)throw Error('Choose a CSV file smaller than 3 MB.');
      const parsed=parseAnnualCalendarCSV(await selected.text(),startMonth);
      eventCandidates=mergeEventCandidates(eventCandidates,parsed.candidates);
      const existing=new Map(settings.milestones.map(m=>[m.id,m]));
      for(const item of parsed.candidates){
        eventSelected.add(item.id);
        const previous=existing.get(item.id);
        if(previous?.confirmed&&previous.title===item.title&&previous.date===item.date)eventVerified.add(item.id);
        else eventVerified.delete(item.id);
      }
      eventImportError='';
      eventImportNotice='Loaded '+parsed.candidates.length+' dated records from '+selected.name+
        (parsed.invalidRows.length?'. Skipped rows '+parsed.invalidRows.slice(0,10).join(', ')+'.':'.')+
        ' Review before importing. No event was assumed confirmed.';
    }catch(e){eventImportError=e.message||String(e);}
    draw();
  });
  mount.addEventListener('change',async event=>{
    const file=event.target;
    if(!file.hasAttribute('data-metric-file'))return;
    const chosen=file.files?.[0];
    if(!chosen)return;
    try{
      if(chosen.size>3_000_000)throw Error('Choose a CSV file smaller than 3 MB.');
      const parsed=parseDelimited(await chosen.text());
      pendingReport={...parsed,filename:chosen.name,mapping:suggestedMapping(parsed.headers)};
      metricsNotice='Loaded '+parsed.rows.length+' report rows. Check the column mapping before importing.';
    }catch(err){pendingReport=null;metricsNotice=err.message;}
    draw();
  });
  mount.addEventListener('input',event=>{
    const target=event.target;
    if(target.closest?.('[data-day-editor]')){
      dayFormTouched=true;
      const region=root()?.querySelector('[data-annual-notice]');
      if(region)region.textContent='Unsaved day edits. Select Save this day’s posts to share them.';
      return;
    }
    const key=target.hasAttribute('data-month-video')?'video':
      target.hasAttribute('data-month-limit')?target.dataset.monthLimit:
      target.hasAttribute('data-month-weekly')?'layer-'+target.dataset.monthWeekly:null;
    if(!key)return;
    const output=target.closest('label')?.querySelector('[data-range-output]');
    if(output)output.textContent=target.value+(key==='video'?'%':'');
  });
  mount.addEventListener('change',event=>{
    if(!isActive()||!loaded||!event.target.closest('[data-annual-root]'))return;
    const e=event.target;
    if(e.hasAttribute('data-calendar-import-select')){
      const id=e.dataset.calendarImportSelect;
      if(e.checked)eventSelected.add(id);else eventSelected.delete(id);
      return;
    }
    if(e.hasAttribute('data-calendar-import-verify')){
      const id=e.dataset.calendarImportVerify;
      const event=eventCandidates.find(item=>item.id===id);
      if(e.checked&&!event?.inactive){eventVerified.add(id);eventSelected.add(id);}
      else eventVerified.delete(id);
      draw();
      return;
    }
    if(e.closest?.('[data-day-editor]')){dayFormTouched=true;return;}
    if(e.hasAttribute('data-day-pattern')||e.hasAttribute('data-week-pattern'))return;
    const batch=e.hasAttribute('data-month-video')||e.hasAttribute('data-month-limit')||
      e.hasAttribute('data-month-enabled')||e.hasAttribute('data-month-visible')||
      e.hasAttribute('data-month-weekly')||e.hasAttribute('data-month-audience')||
      e.hasAttribute('data-month-select-layer')||e.hasAttribute('data-month-destination')||
      e.hasAttribute('data-month-paid-planning');
    if(batch){
      const current=currentBatch();
      if(e.hasAttribute('data-month-video'))current.videoShare=Math.max(0,Math.min(100,Number(e.value)||0));
      else if(e.hasAttribute('data-month-limit'))limitChange(current.limits,e.dataset.monthLimit,e.value);
      else if(e.hasAttribute('data-month-enabled'))current.layers[e.dataset.monthEnabled].enabled=e.checked;
      else if(e.hasAttribute('data-month-visible'))current.layers[e.dataset.monthVisible].visible=e.checked;
      else if(e.hasAttribute('data-month-weekly'))current.layers[e.dataset.monthWeekly].weekly=Math.max(0,Math.min(7,Number(e.value)||0));
      else if(e.hasAttribute('data-month-select-layer'))selectedLayer=e.value;
      else if(e.hasAttribute('data-month-paid-planning'))current.delivery.paidPlanning=e.checked;
      else if(e.hasAttribute('data-month-destination')){
        const k=e.dataset.monthDestination;
        current.delivery[k]=e.checked?[...new Set([...current.delivery[k],e.value])]:current.delivery[k].filter(x=>x!==e.value);
      }else if(e.hasAttribute('data-month-audience')){
        const k=e.dataset.monthAudience,existing=current.layers[selectedLayer].audience[k];
        const next=e.value==='all'?['all']:e.checked?[...existing.filter(x=>x!=='all'),e.value]:existing.filter(x=>x!==e.value);
        current.layers[selectedLayer].audience[k]=next.length?[...new Set(next)]:['all'];
      }
      batchDirty=true;notice='Previewing '+monthName(selectedMonth)+' adjustments. Choose Apply and save to keep this month.';
      draw();return;
    }
    if(e.hasAttribute('data-metric-platform')){metricsPlatform=e.value;draw();return;}
    if(e.hasAttribute('data-metric-map')){
      if(pendingReport)pendingReport.mapping[e.dataset.metricMap]=e.value;
      draw();return;
    }
    if(e.hasAttribute('data-signal-enabled')){
      settings.timingSignals[e.dataset.signalEnabled].enabled=e.checked;draw();return;
    }
    if(e.hasAttribute('data-signal-leads')){
      const raw=e.value.trim(),values=raw?raw.split(',').map(x=>Number(x.trim())):[];
      if(values.length>12||values.some(n=>!Number.isInteger(n)||n<1||n>365)||new Set(values).size!==values.length){
        notice='Lead-in values must be unique numbers from 1 to 365, separated by commas.';draw();return;
      }
      settings.timingSignals[e.dataset.signalLeads].leadDays=values.sort((a,b)=>b-a);
      notice='Timing signals updated. Save the timing patterns to keep them.';draw();return;
    }
    if(e.hasAttribute('data-scope-day')){
      if(batchDirty&&!window.confirm('Discard unapplied planning changes?')){draw();return;}
      if(!lastPreview?.days.some(d=>d.date===e.value)){notice='Choose a date within the 12-month plan.';draw();return;}
      if(planningScope==='day'&&dayFormTouched&&!captureDayEditor()){draw();return;}
      focusDay=e.value;selectedMonth=focusDay.slice(0,7);monthDraft=null;batchMonth='';draw();return;
    }
    if(e.hasAttribute('data-scope-time')){
      if(e.value && !isMinuteTime(e.value)){notice='Choose a valid Brisbane time (HH:MM).';draw();return;}
      currentBatch().postingTime=e.value||'auto';batchDirty=true;draw();return;
    }
    if(e.hasAttribute('data-annual-topic')){
      topicFilter=e.value;draw();return;
    }
    if(e.hasAttribute('data-annual-enabled'))settings.layers[e.dataset.annualEnabled].enabled=e.checked;
    else if(e.hasAttribute('data-annual-visible'))settings.layers[e.dataset.annualVisible].visible=e.checked;
    else if(e.hasAttribute('data-annual-frequency'))settings.layers[e.dataset.annualFrequency].weekly=Math.max(0,Math.min(7,Number(e.value)||0));
    else if(e.hasAttribute('data-annual-limit'))limitChange(settings.limits,e.dataset.annualLimit,e.value);
    else if(e.hasAttribute('data-annual-video'))settings.videoShare=Math.max(0,Math.min(100,Number(e.value)||0));
    else if(e.hasAttribute('data-annual-paid-planning'))settings.delivery.paidPlanning=e.checked;
    else if(e.hasAttribute('data-annual-destination')){
      const mode=e.dataset.annualDestination,ids=settings.delivery[mode];
      settings.delivery[mode]=e.checked?[...new Set([...ids,e.value])]:ids.filter(id=>id!==e.value);
    }
    else if(e.hasAttribute('data-annual-select-layer'))selectedLayer=e.value;
    else if(e.hasAttribute('data-annual-audience'))updateAudience(e.dataset.annualAudience,e.value,e.checked);
    else if(e.hasAttribute('data-annual-start') && /^20\d{2}-(0[1-9]|1[0-2])$/.test(e.value)){
      if(batchDirty&&!window.confirm('Discard unapplied changes to this month?')){draw();return;}
      startMonth=e.value;selectMonth(startMonth);loadEdits();
    }
    else if(e.hasAttribute('data-annual-month')){
      if(batchDirty&&!window.confirm('Discard unapplied changes to this month?')){draw();return;}
      selectMonth(e.value);
    }
    if(!batchDirty && !settings[overrideBucket()]?.[scopeKey()]){monthDraft=null;batchMonth='';}
    notice=changed()?(reviewOnly?'Unsaved browser-only changes. Save this local revision before trying another layout.':'Unsaved changes. Select Save committee settings to share them.'):'Settings match the saved version.';
    draw();
  });
  mount.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b||!b.closest('[data-annual-root]')||!isActive())return;
    if(b.hasAttribute('data-events-fetch')){void loadClubAnnualEvents();return;}
    if(b.hasAttribute('data-events-select-all')){
      for(const item of eventCandidates)eventSelected.add(item.id);
      eventImportNotice='Selected '+eventSelected.size+' events for review.';draw();return;
    }
    if(b.hasAttribute('data-events-select-none')){
      eventSelected.clear();eventImportNotice='No events selected.';draw();return;
    }
    if(b.hasAttribute('data-events-template')){
      const blob=new Blob(['title,date,type,id,notes\r\n'],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='sandy-annual-event-calendar-template.csv';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),5000);return;
    }
    if(b.hasAttribute('data-events-apply')){
      if(!eventSelected.size){eventImportError='Select at least one planned event to import.';draw();return;}
      try{
        const chosen=eventCandidates.filter(item=>eventSelected.has(item.id));
        const result=importCalendarAnchors(settings.milestones,chosen,[...eventSelected],[...eventVerified]);
        settings.milestones=result.milestones;
        eventImportError='';
        eventImportNotice='Imported '+result.added+' new, '+result.updated+' updated events'+
          (result.verificationReset?'; '+result.verificationReset+' changed dates need reconfirmation':'')+
          '. These are draft ideas until Sandy Sports approves individual posts.';
        void save();
      }catch(error){eventImportError=error.message;draw();}
      return;
    }
    if(b.hasAttribute('data-history-load')){void loadHistory();return;}
    if(b.hasAttribute('data-history-export')){void exportHistoryVersion(b.dataset.historyExport);return;}
    if(b.hasAttribute('data-signal-save')){void save();return;}
    if(b.hasAttribute('data-milestone-cancel')){editingMilestone='';draw();return;}
    if(b.hasAttribute('data-signal-edit')){
      editingMilestone=b.dataset.signalEdit;draw();return;
    }
    if(b.hasAttribute('data-signal-remove')){
      if(!window.confirm('Remove this timing milestone?'))return;
      settings.milestones=settings.milestones.filter(x=>x.id!==b.dataset.signalRemove);
      if(editingMilestone===b.dataset.signalRemove)editingMilestone='';
      notice='Milestone removed. Save timing patterns to retain the change.';draw();return;
    }
    if(b.hasAttribute('data-milestone-add')){
      const pane=root(),kind=pane.querySelector('[data-milestone-kind]')?.value;
      const title=pane.querySelector('[data-milestone-title]')?.value.trim();
      const date=pane.querySelector('[data-milestone-date]')?.value;
      const sourceUrl=pane.querySelector('[data-milestone-source]')?.value.trim()||'';
      const confirmed=Boolean(pane.querySelector('[data-milestone-confirm]')?.checked);
      if(!['event','meeting','programme_open','programme_close'].includes(kind)||
        !title||title.length<4||title.length>140||
        !/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(date||'')||
        (sourceUrl&&!/^https:\/\/[^\s]+$/.test(sourceUrl))){
        notice='Enter a title, valid date and optional HTTPS source link.';draw();return;
      }
      const id=editingMilestone||('m-'+crypto.randomUUID());
      const item={id,kind,title,date,sourceUrl,confirmed};
      settings.milestones=[...settings.milestones.filter(x=>x.id!==id),item];
      editingMilestone='';notice='Saved milestone to the draft timing pattern. Select Save timing patterns to retain it.';draw();return;
    }
    if(b.hasAttribute('data-metric-import')){
      if(!pendingReport){metricsNotice='Choose a CSV report first.';draw();return;}
      if(!Object.values(pendingReport.mapping).some(Boolean)){metricsNotice='Map at least one column before importing.';draw();return;}
      const importedAt=new Date().toISOString();
      const records=pendingReport.rows.map(row=>({
        ...metricFromRow(row,pendingReport.mapping,{platform:metricsPlatform,
          filename:pendingReport.filename,importedAt}),
        id:crypto.randomUUID()
      }));
      metrics.push(...records);
      if(metrics.length>15000)metrics=metrics.slice(-15000);
      const savedMetrics=await storeMetrics();metricsNotice=savedMetrics?
        (strictShared?'Imported '+records.length+' rows into the shared club performance register.':'Imported '+records.length+' rows locally.'):
        'Performance metrics were NOT saved. Check the shared connection and retry.';
      pendingReport=null;draw();return;
    }
    if(b.hasAttribute('data-metric-link')){
      const pane=root(),id=pane.querySelector('[data-metric-unlinked]')?.value;
      const postId=pane.querySelector('[data-metric-link-post]')?.value;
      const record=metrics.find(m=>m.id===id),target=lastPreview?.posts.find(p=>p.id===postId);
      if(!record||!target){metricsNotice='Choose a report record and a planned post.';draw();return;}
      record.postId=postId;
      postEdits[postId]??={};
      const ref={platform:record.platform,externalId:record.externalId,postUrl:record.postUrl};
      const exists=(postEdits[postId].externalRefs||[]).some(x=>
        x.platform===ref.platform&&x.externalId===ref.externalId&&x.postUrl===ref.postUrl);
      if(!exists)postEdits[postId].externalRefs=[...(postEdits[postId].externalRefs||[]),ref];
      const persisted=await persistEdits();if(!persisted){draw();return;}
      const linkedSaved=await storeMetrics();
      metricsNotice=linkedSaved?'Linked the '+record.platform+' report row to '+target.date+' in the shared register.':'The linked result could not be saved.';draw();return;
    }
    if(b.hasAttribute('data-analytics-export')){
      if(!lastPreview)return;
      const csv=planMetricsCSV(lastPreview.posts,postEdits,linkedMetrics());
      const link=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      link.href=url;link.download='sandy-social-content-and-results-'+startMonth+'.csv';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      metricsNotice='Exported the year-long plan with any linked platform results.';return;
    }
    if(b.hasAttribute('data-planning-scope')){
      if(planningScope==='day'&&dayFormTouched&&!captureDayEditor())return;
      const value=b.dataset.planningScope;
      if(!['day','week','month'].includes(value))return;
      if(batchDirty&&!window.confirm('Discard unapplied changes to this planning period?'))return;
      planningScope=value;monthDraft=null;batchMonth='';draw();return;
    }
    if(b.hasAttribute('data-scope-auto')){
      currentBatch().postingTime='auto';batchDirty=true;draw();return;
    }
    if(b.hasAttribute('data-calendar-plan-day')){
      focusDay=b.dataset.calendarPlanDay;planningScope='day';
      modalDay=null;modalPostId=null;modalView='day';monthDraft=null;batchMonth='';draw();
      root()?.querySelector('#annual-plan-settings')?.scrollIntoView({behavior:'smooth',block:'start'});return;
    }
    if(b.hasAttribute('data-calendar-time-preset')){
      const time=root()?.querySelector('[data-post-time]');
      if(time){time.value=b.dataset.calendarTimePreset;time.focus();}
      return;
    }
    if(b.hasAttribute('data-calendar-hour')){
      const time=root()?.querySelector('[data-post-time]');if(time){
        const minute=isMinuteTime(time.value)?time.value.slice(3):'00';time.value=b.dataset.calendarHour+':'+minute;
        time.focus();
      }return;
    }
    if(b.hasAttribute('data-calendar-export')){exportSchedule();return;}
    if(b.hasAttribute('data-calendar-copy-creation')){void copyMonthlyCreationBrief();return;}
    if(b.hasAttribute('data-calendar-restore')){
      for(const record of Object.values(postEdits))delete record.hidden;
      const persisted=await persistEdits();notice=persisted?'Restored removed suggestions in shared records.':'Could not save restored suggestions.';draw();return;
    }
    if(b.hasAttribute('data-calendar-add')){
      const day=b.dataset.calendarAdd;
      if(!/^20\d\d-\d\d-\d\d$/.test(day))return;
      root()?.querySelector('[data-annual-day-dialog]')?.close();
      modalDay=null;modalPostId=null;modalView='day';
      onUse({title:'',body:'',channels:[],plannedDate:day});return;
    }
    if(b.hasAttribute('data-calendar-dismiss')){
      const id=b.dataset.calendarDismiss;
      if(!visiblePosts.some(post=>post.id===id&&post.date===modalDay))return;
      if(!window.confirm('Remove this generated suggestion from your browser view? Club-saved posts are unaffected.'))return;
      postEdits[id]={...getEdit(id),hidden:true};
      const persisted=await persistEdits();modalView='day';modalPostId=null;
      notice=persisted?'Removed the suggestion from the shared draft view.':'Could not save the removed suggestion to the shared records.';
      draw();return;
    }
    if(b.hasAttribute('data-day-apply-pattern')){
      const id=root()?.querySelector('[data-day-pattern]')?.value;
      if(!id)return;
      if(dayFormTouched&&!captureDayEditor())return;
      if(!window.confirm('Replace this day’s itemised post list with the selected pattern?'))return;
      if(applyDailyPattern(focusDay,id)){notice='Pattern applied. Review the individual posts, then Save day.';draw();}
      return;
    }
    if(b.hasAttribute('data-day-add-item')||b.hasAttribute('data-day-surprise')){
      if(dayFormTouched&&!captureDayEditor())return;
      const plan=dayPlanFor(focusDay);
      if(plan.items.length>=12){notice='The limit is 12 individual suggestions per day.';draw();return;}
      const ids=new Set(plan.items.map(x=>x.id));let n=1;while(ids.has('s'+n))n++;
      const surprise=b.hasAttribute('data-day-surprise');
      draftPlans()[focusDay]={...plan,items:[...plan.items,
        surprise?surpriseDayItem(n):newDaySlot(n)]};
      notice=surprise?'Added a spontaneous opportunity. Verify permissions and save the day before club approval.':
        'Added a new post item. Edit its details, then save the day.';
      draw();return;
    }
    if(b.hasAttribute('data-day-remove-item')){
      if(dayFormTouched&&!captureDayEditor())return;
      const id=b.dataset.dayRemoveItem,plan=dayPlanFor(focusDay);
      if(plan.items.length<=1){notice='Keep at least one item for each planned day.';draw();return;}
      draftPlans()[focusDay]={...plan,items:plan.items.filter(item=>item.id!==id)};
      notice='Removed this item from the day’s draft. Save to keep the change.';draw();return;
    }
    if(b.hasAttribute('data-day-move-up')||b.hasAttribute('data-day-move-down')){
      if(dayFormTouched&&!captureDayEditor())return;
      const id=b.dataset.dayMoveUp||b.dataset.dayMoveDown,plan=dayPlanFor(focusDay);
      const index=plan.items.findIndex(item=>item.id===id);
      const to=index+(b.hasAttribute('data-day-move-up')?-1:1);
      if(index<0||to<0||to>=plan.items.length)return;
      const items=[...plan.items];[items[index],items[to]]=[items[to],items[index]];
      draftPlans()[focusDay]={...plan,items};
      notice='Reordered your daily items. Select Save this day’s posts to retain the order.';draw();return;
    }
    if(b.hasAttribute('data-day-update-pattern')){
      if(!captureDayEditor(true))return;
      const type=currentDayKind(focusDay),plan=dayPlanFor(focusDay);
      const stored=(settings.dayArchetypes[type]||[]).find(p=>p.id===plan.patternId);
      if(!stored)return;
      const name=root()?.querySelector('[data-day-pattern-name]')?.value.trim();
      if(!name||name.length>75){notice='Enter a pattern name of up to 75 characters.';draw();return;}
      settings.dayArchetypes[type]=settings.dayArchetypes[type].map(p=>p.id===stored.id?
        {...p,name,items:structuredClone(plan.items)}:p);
      saveItemisedPlans('updated daily archetype');return;
    }
    if(b.hasAttribute('data-day-delete-pattern')){
      if(dayFormTouched&&!captureDayEditor())return;
      const type=currentDayKind(focusDay),plan=dayPlanFor(focusDay),id=plan.patternId;
      if(!id?.startsWith('custom-')||!window.confirm('Delete this saved archetype? The current day’s posts will remain.'))return;
      settings.dayArchetypes[type]=(settings.dayArchetypes[type]||[]).filter(p=>p.id!==id);
      draftPlans()[focusDay]={...plan,patternId:''};
      saveItemisedPlans('revised daily pattern library');return;
    }
    if(b.hasAttribute('data-day-save')){
      if(!captureDayEditor(true)){draw();return;}
      saveItemisedPlans('daily posts');return;
    }
    if(b.hasAttribute('data-day-reset')){
      if(!window.confirm('Restore generated suggestions for this date? This removes the customised daily plan.'))return;
      delete draftPlans()[focusDay];dayFormTouched=false;saveItemisedPlans('restored suggestions');return;
    }
    if(b.hasAttribute('data-day-save-pattern')){
      if(!captureDayEditor(true)){draw();return;}
      const name=root()?.querySelector('[data-day-pattern-name]')?.value.trim();
      if(!name||name.length>75){notice='Give the reusable pattern a name of up to 75 characters.';draw();return;}
      const type=currentDayKind(focusDay),items=settings.dayArchetypes[type]||[];
      if(items.length>=8){notice='This day type already has eight saved custom patterns.';draw();return;}
      const pattern={id:'custom-'+crypto.randomUUID(),name,items:structuredClone(dayPlanFor(focusDay).items)};
      settings.dayArchetypes[type]=[...items,pattern];
      draftPlans()[focusDay].patternId=pattern.id;
      saveItemisedPlans('daily pattern');return;
    }
    if(b.hasAttribute('data-week-apply')){
      const date=b.dataset.weekApply;
      if(!lastPreview?.days.some(d=>d.date===date))return;
      const id=root()?.querySelector('[data-week-pattern="'+date+'"]')?.value;
      if(!id){notice='Choose a day pattern first.';draw();return;}
      if(draftPlans()[date]&&!window.confirm('Replace the existing post list for '+date+'?'))return;
      if(applyDailyPattern(date,id)){notice='Pattern applied to '+date+'. Save the week to keep it.';draw();}
      return;
    }
    if(b.hasAttribute('data-week-edit')){
      const date=b.dataset.weekEdit;
      if(!lastPreview?.days.some(d=>d.date===date))return;
      focusDay=date;selectedMonth=date.slice(0,7);planningScope='day';draw();
      root()?.querySelector('#annual-plan-settings')?.scrollIntoView?.({behavior:'smooth',block:'start'});return;
    }
    if(b.hasAttribute('data-week-reset')){
      const date=b.dataset.weekReset;delete draftPlans()[date];
      notice='Generated suggestions restored for '+date+'. Save the week to keep the change.';draw();return;
    }
    if(b.hasAttribute('data-week-fill')){
      if(!window.confirm('Fill unedited days of this week with their first saved archetype?'))return;
      const start=mondayOf(focusDay);
      for(let i=0;i<7;i++){
        const date=nextDay(start,i);
        if(!lastPreview?.days.some(d=>d.date===date)||draftPlans()[date])continue;
        const type=currentDayKind(date),first=allDayPresets(type,settings.dayArchetypes)[0];
        if(first)applyDailyPattern(date,first.id);
      }
      notice='Starter patterns applied to unedited days. Save the week to keep them.';draw();return;
    }
    if(b.hasAttribute('data-week-save')){saveItemisedPlans('weekly daily plans');return;}
    if(b.hasAttribute('data-calendar-close')){
      root()?.querySelector('[data-annual-day-dialog]')?.close();
      modalDay=null;modalPostId=null;modalView='day';return;
    }
    if(b.hasAttribute('data-calendar-day')){
      modalDay=b.dataset.calendarDay;focusDay=modalDay;modalPostId=null;modalView='day';draw();return;
    }
    if(b.hasAttribute('data-calendar-back')){modalView='day';modalPostId=null;draw();return;}
    if(b.hasAttribute('data-calendar-detail')||b.hasAttribute('data-calendar-edit')){
      const id=b.dataset.calendarDetail||b.dataset.calendarEdit;
      if(!visiblePosts.some(post=>post.id===id&&post.date===modalDay))return;
      modalPostId=id;modalView=b.hasAttribute('data-calendar-edit')?'edit':'detail';draw();return;
    }
    if(b.hasAttribute('data-calendar-save')){
      const id=b.dataset.calendarSave,post=visiblePosts.find(item=>item.id===id&&item.date===modalDay);
      if(!post)return;
      const modal=root()?.querySelector('[data-annual-day-dialog]');
      const title=modal?.querySelector('[data-post-title]')?.value.trim();
      const brief=modal?.querySelector('[data-post-brief]')?.value.trim();
      const notes=modal?.querySelector('[data-post-notes]')?.value.trim();
      const status=modal?.querySelector('[data-post-status]')?.value;
      const time=modal?.querySelector('[data-post-time]')?.value;
      if(!title||!brief||!isMinuteTime(time)){modal?.querySelector(!title?'[data-post-title]':!brief?'[data-post-brief]':'[data-post-time]')?.focus();return;}
      postEdits[id]={title,brief,notes,status,time};
      const persisted=await persistEdits();
      notice=persisted?(strictShared?'Post edit saved to shared D1 with a server revision.':'Post edit saved in this browser.'):'Post edit NOT saved; check the shared connection.';
      modalView='detail';modalPostId=id;draw();return;
    }
    if(b.hasAttribute('data-annual-today')){
      const today=brisbaneToday();
      if(!Array.from({length:12},(_,i)=>nextMonth(startMonth,i)).includes(today.slice(0,7)))return;
      if(batchDirty&&!window.confirm('Discard unapplied changes to this month before jumping to today?'))return;
      selectMonth(today.slice(0,7));focusDay=today;draw();
      root()?.querySelector('.annual-calendar-shell')?.scrollIntoView?.({behavior:'smooth',block:'start'});
      return;
    }
    if(b.hasAttribute('data-annual-step')){
      const months=Array.from({length:12},(_,i)=>nextMonth(startMonth,i));
      const target=months.indexOf(selectedMonth)+Number(b.dataset.annualStep);
      if(target<0||target>=months.length)return;
      if(batchDirty&&!window.confirm('Discard unapplied month settings?'))return;
      selectMonth(months[target]);draw();return;
    }
    if(b.hasAttribute('data-month-open-topics')){
      const panel=root()?.querySelector('.annual-month-bulk-options');
      if(panel)panel.open=true;
      root()?.querySelector('.annual-topic-quickpanel')?.scrollIntoView?.({behavior:'smooth',block:'center'});
      return;
    }
    if(b.hasAttribute('data-month-use-annual')){
      if(planningScope!=='month'||!settings.monthOverrides?.[selectedMonth])return;
      if(batchDirty&&!window.confirm("Discard unsaved changes to this month's patterns and use annual defaults?"))return;
      delete settings.monthOverrides[selectedMonth];monthDraft=null;batchMonth='';batchDirty=false;
      notice='Restored current annual settings for '+monthName(selectedMonth)+'. Saving this choice.';
      void save();return;
    }
    if(b.hasAttribute('data-month-apply')){
      const chosen=copyMonthSettings(currentBatch());
      settings[overrideBucket()][scopeKey()]=chosen;
      batchDirty=false;
      const count=CAMPAIGN_LAYERS.filter(layer=>chosen.layers[layer.id]?.enabled&&chosen.layers[layer.id]?.weekly>0).length;
      notice=count?'Saving '+count+' active topics for '+monthName(selectedMonth)+'…':
        'No topics enabled: saving will keep this month empty. Switch on a topic to generate posts.';
      void save();return;
    }
    if(b.hasAttribute('data-month-copy-next')){
      const key=scopeKey(),scope=planningScope,bucket=overrideBucket(),copy=copyMonthSettings(currentBatch());
      const offset=scope==='day'?1:scope==='week'?7:null;
      const next=offset===null?nextMonth(key,1):
        new Date(Date.parse(key+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
      settings[bucket][key]=copyMonthSettings(copy);
      settings[bucket][next]=copyMonthSettings(copy);
      batchDirty=false;notice='Copied '+scope+' planning settings to '+next+'.';
      void save();return;
    }
    if(b.hasAttribute('data-month-reset')){
      delete settings[overrideBucket()][scopeKey()];monthDraft=null;batchMonth='';
      batchDirty=false;void save();return;
    }
    if(b.hasAttribute('data-annual-reconnect')){
      if((changed()||batchDirty)&&!window.confirm('Keep working locally? Retry will reload saved settings but will not discard a saved browser-only copy.'))return;
      loaded=false;void open();return;
    }
    if(b.hasAttribute('data-annual-save')){void save();return;}
    if(b.hasAttribute('data-annual-reload')){if(changed()&&!window.confirm('Discard unsaved pattern changes?'))return;loaded=false;void open();return;}
    if(b.hasAttribute('data-annual-go')){
      if(batchDirty&&!window.confirm('Discard unapplied changes to this month?'))return;
      selectMonth(b.dataset.annualGo);draw();return;
    }
    if(b.hasAttribute('data-annual-use')){
      const post=lastPreview?.posts.find(p=>p.id===b.dataset.annualUse);if(!post)return;
      const edit=getEdit(post.id);
      root()?.querySelector('[data-annual-day-dialog]')?.close();
      modalDay=null;modalPostId=null;modalView='day';
      onUse({title:postLabel(post,edit),body:postBrief(post,edit)+(edit.notes?'\n\nWorking notes: '+edit.notes:'')+
        '\n\nSuggested format: '+post.format+' ('+post.size+'). '+post.cta+
        '.\n[Planning note only: target '+postTime(post,edit)+' AEST (Australia/Brisbane). Remove this note before publishing.]',
        channels:post.channels,plannedDate:post.date,plannedTime:postTime(post,edit),
        postId:post.id,topicLayers:post.layerIds,format:post.format,
        creativeVariants:post.creativeVariants||[],timingSignal:post.timingSignal||null,timeOfDaySignal:post.timeOfDaySignal||null,
        proposalSource:post.layerIds?.[0]||''});
    }
  });
  mount.addEventListener('close',event=>{
    if(event.target.matches('[data-annual-day-dialog]')){modalDay=null;modalPostId=null;modalView='day';}
  },true);
  return {markup,open,reset(){loaded=false;busy=false;sharedSettingsReady=true;
    eventCandidates=[];eventSelected.clear();eventVerified.clear();eventImportNotice='';eventImportError='';eventLoading=false;
    saveState='idle';saveMessage='';
    latestSave=null;historyRows=null;historyError='';historyLoading=false;workingDayPlans=null;dayFormTouched=false;
    settings=defaultCampaignSettings();saved=JSON.stringify(settings);
    version=0;notice='';lastPreview=null;modalDay=null;modalPostId=null;modalView='day';planningScope='month';monthDraft=null;batchMonth='';}};

}
