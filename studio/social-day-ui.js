import {renderDaySignature} from './social-day-signatures.js?v=20261124-office-signatures';
import {DAY_ARCHETYPE_LABELS,DAILY_FORMATS,allDayPresets} from './social-day-patterns.js';
const dateName=day=>new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'));
const timeLabel=day=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'));
const scopeHeader=(mode,day,month,esc)=>{
  const tabs=[['day','Day'],['week','Week'],['month','Month']].map(([value,label])=>
    '<button type="button" data-planning-scope="'+value+'" aria-pressed="'+(mode===value)+'">'+label+'</button>').join('');
  return '<header class="annual-batch-head"><div><span class="annual-eyebrow">✏️ PLAN YOUR POSTS</span>'+
    '<h2>'+(mode==='week'?'Daily plans for the week':mode==='day'?'Posts for '+esc(dateName(day)):'Monthly patterns')+'</h2></div>'+
    '<span class="annual-batch-status">'+(mode==='day'?'Item by item':mode==='week'?'Choose a pattern for each day':'Quick guide')+'</span></header>'+
    '<div class="annual-scope-toolbar"><div class="annual-scope-buttons" aria-label="Choose planning period">'+tabs+'</div>'+
    '<label>Selected day <input type="date" data-scope-day value="'+esc(day)+'" aria-label="Choose a day to plan"></label></div>';
};
const patternSelector=(day,type,saved,esc,chosen='')=>'<label class="annual-day-pattern-picker">'+
  '<span>Start with a '+esc(DAY_ARCHETYPE_LABELS[type]||'day')+' pattern</span>'+
  '<select data-day-pattern><option value=""'+(chosen?'':' selected')+'>Keep current items</option>'+
  allDayPresets(type,saved).map(p=>'<option value="'+esc(p.id)+'"'+(p.id===chosen?' selected':'')+'>'+esc(p.name)+' · '+p.items.length+
    (p.items.length===1?' post':' posts')+'</option>').join('')+'</select></label>';
const layerSelect=(item,layers,esc)=>'<select data-day-item-field="layerId" aria-label="Topic">'+
  layers.map(l=>'<option value="'+esc(l.id)+'"'+(item.layerId===l.id?' selected':'')+'>'+esc(l.label)+'</option>').join('')+
  '</select>';
const formatSelect=(item,esc)=>'<select data-day-item-field="format" aria-label="Content format">'+
  DAILY_FORMATS.map(([value,label])=>'<option value="'+value+'"'+(item.format===value?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select>';
export function renderItemisedDay({day,type,dayPlan,savedPatterns,esc,layers}){
  const items=dayPlan.items||[];
  const savedCustom=(savedPatterns[type]||[]).find(x=>x.id===dayPlan.patternId);
  return '<section class="annual-batch annual-itemised-planner" id="annual-plan-settings" aria-label="Item-by-item social day planner">'+
    scopeHeader('day',day,day.slice(0,7),esc)+
    renderDaySignature(dayPlan.signature,esc)+
    '<p class="annual-day-lead"><strong>'+esc(DAY_ARCHETYPE_LABELS[type]||'Daily content')+'</strong> · '+
    items.length+' planned '+(items.length===1?'item':'items')+'. Set the exact time, type and subject of each post. '+
    'No monthly sliders on this screen.</p>'+
    '<div class="annual-day-pattern-toolbar">'+patternSelector(day,type,savedPatterns,esc,dayPlan.patternId)+
    '<button type="button" class="button outline" data-day-apply-pattern>Use selected pattern</button></div>'+
    '<div class="annual-itemised-stack" data-day-editor="'+esc(day)+'">'+
      items.map((item,index)=>
        '<article class="annual-itemised-post" data-daily-item="'+esc(item.id)+'">'+
        '<header><span class="annual-itemised-post-number">'+(index+1)+'</span><strong>Post '+(index+1)+'</strong>'+
        '<div class="annual-itemised-move">'+
        (index>0?'<button type="button" class="button outline small" data-day-move-up="'+esc(item.id)+'" aria-label="Move post '+(index+1)+' earlier">↑</button>':'')+
        (index<items.length-1?'<button type="button" class="button outline small" data-day-move-down="'+esc(item.id)+'" aria-label="Move post '+(index+1)+' later">↓</button>':'')+'</div>'+
        '<button type="button" class="button outline small" data-day-remove-item="'+esc(item.id)+'" aria-label="Remove post '+(index+1)+'">Remove</button></header>'+
        '<div class="annual-itemised-post-fields">'+
        '<label>🕒 Post time (Brisbane AEST)<input type="time" data-day-item-field="time" value="'+esc(item.time)+'" step="60"></label>'+
        '<label>🐟 Topic'+layerSelect(item,layers,esc)+'</label>'+
        '<label>🎬 Format'+formatSelect(item,esc)+'</label></div>'+
        '<label>Post title<input type="text" data-day-item-field="title" maxlength="180" value="'+esc(item.title)+'"></label>'+
        '<label>Creative brief<textarea data-day-item-field="brief" rows="2" maxlength="4000">'+esc(item.brief)+'</textarea></label>'+
        '</article>'
      ).join('')+'</div>'+
      '<div class="annual-day-operations">'+
      '<button type="button" class="button outline" data-day-add-item>＋ Add a post</button>'+
      '<button type="button" class="button outline annual-surprise-button" data-day-surprise>✨ Unexpected opportunity</button>'+
      '<button type="button" class="button outline" data-day-reset>↺ Use generated suggestions</button>'+
      '</div>'+
      '<div class="annual-day-save"><button type="button" class="button" data-day-save>✓ Save this day’s posts</button>'+
      '<p>These itemised posts override monthly pattern suggestions for this date. Saving does not authorise or publish them.</p></div>'+
      '<details class="annual-day-presets"><summary>💾 Save this day as a reusable pattern</summary>'+
        '<p>Give the layout a name for future '+esc(DAY_ARCHETYPE_LABELS[type])+' days.</p>'+
        '<div class="annual-day-preset-save"><label>Pattern name<input data-day-pattern-name maxlength="75" value="'+esc(savedCustom?.name||'')+'" placeholder="e.g. Morning tips and evening questions"></label>'+
        '<button type="button" class="button outline" data-day-save-pattern>Save new pattern</button>'+
        (savedCustom?'<button type="button" class="button outline" data-day-update-pattern>Update this pattern</button>'+
          '<button type="button" class="button outline" data-day-delete-pattern>Delete saved pattern</button>':'')+
        '</div></details>'+
    '</section>';
}
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export function renderWeekItemised({day,startDate,dates,savedPatterns,esc}){
  const days=dates.map(({date,type,items,curated,inside,patternId='',signature=null})=>{
    const patterns=allDayPresets(type,savedPatterns);
    return '<article class="annual-week-day'+(inside?'':' outside')+'" data-week-day="'+date+'">'+
      '<div class="annual-week-day-main"><div><span class="annual-week-day-kicker">'+esc(DAY_ARCHETYPE_LABELS[type]||'Day')+'</span>'+
      '<h3>'+esc(timeLabel(date))+'</h3></div>'+
      '<span class="annual-week-day-count">'+(inside?items.length+' '+(items.length===1?'post':'posts'):'Outside 12-month plan')+'</span></div>'+
      (signature?'<div class="annual-week-owner">'+renderDaySignature(signature,esc,true)+'</div>':'')+
      (inside?
      '<div class="annual-week-day-items">'+(items.length?items.map(item=>
        '<span><strong>'+esc(item.time)+'</strong> · '+esc(item.title)+'</span>').join(''):
        '<span>No items yet</span>')+'</div>'+
      '<div class="annual-week-day-actions"><label>Daily pattern<select data-week-pattern="'+date+'">'+
        '<option value=""'+(patternId?'':' selected')+'>Choose a pattern…</option>'+
        patterns.map(p=>'<option value="'+esc(p.id)+'"'+(patternId===p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>'+
        '<button type="button" class="button outline small" data-week-apply="'+date+'">Apply pattern</button>'+
        '<button type="button" class="button outline small" data-week-edit="'+date+'">Edit posts</button>'+
        (curated?'<button type="button" class="button outline small" data-week-reset="'+date+'">Restore suggestions</button>':'')+
      '</div>':'')+'</article>';
  }).join('');
  const prefix=startDate||mondayOf(day);
  return '<section class="annual-batch annual-week-itemised" id="annual-plan-settings" aria-label="Weekly daily-pattern planner">'+
    scopeHeader('week',day,day.slice(0,7),esc)+
    '<p class="annual-day-lead">Pick a saved daily archetype for each date, or open that day to edit its individual posts. '+
    'These are seven day plans, not weekly posting-density sliders.</p>'+
    '<div class="annual-week-summary"><strong>Week of '+esc(timeLabel(prefix))+'</strong>'+
    '<span>Minutes, subjects and formats remain editable per post</span></div>'+
    '<div class="annual-week-days">'+days+'</div>'+
    '<div class="annual-day-operations"><button type="button" class="button outline" data-week-fill>✨ Fill the week with starter patterns</button>'+
    '<button type="button" class="button" data-week-save>✓ Save this week’s daily plans</button></div>'+
    '<p class="annual-small">Pattern choices replace only the selected day’s suggestions and never change already authorised club posts.</p></section>';
}
export const mondayOf=day=>shift(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7));
export const nextDay=(day,days)=>shift(day,days);
