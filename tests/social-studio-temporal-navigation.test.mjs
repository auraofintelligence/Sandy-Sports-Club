import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const visual=read('../studio/social-visual-ui.js');
const controller=read('../studio/social-campaigns.js');
const css=read('../studio/sandy-studio.css');
const {renderMonthCalendar}=new Function('renderDaySignature','signatureOfficer',
  visual.replace(/^import .*?;\s*$/gm,'').replace(/^export\s+/gm,'')+'\nreturn {renderMonthCalendar}')(
  ()=>'',()=>'');

test('calendar marks past, today and future explicitly on consecutive dates',()=>{
  const dates=['2026-11-23','2026-11-24','2026-11-25'];
  const posts=dates.map((date,i)=>({id:'p'+i,date,title:'Planning item',layerIds:['health'],suggestedTime:'12:00'}));
  const html=renderMonthCalendar({month:'2026-11',days:dates.map(date=>({date})),posts,
    esc:String,today:'2026-11-24'});
  const states=[...html.matchAll(/data-temporal="([^"]+)" data-calendar-day="(2026-11-2[345])"/g)]
    .map(x=>[x[2],x[1]]);
  assert.deepEqual(states,[['2026-11-23','past'],['2026-11-24','today'],['2026-11-25','future']]);
  for(const label of ['PAST','TODAY','FUTURE'])assert.match(html,new RegExp('>'+label+'<'));
  assert.equal((html.match(/aria-current="date"/g)||[]).length,1);
});

test('date status is distinguishable by text and contrast, not just a pale colour',()=>{
  for(const selector of ['.annual-calendar-day.past','.annual-calendar-day.today',
    '.annual-calendar-day.future','.annual-temporal-key','.annual-calendar-period'])
    assert.ok(css.includes(selector),selector);
  assert.match(css,/@container \(max-width:480px\)/);
});

test('month calendar has a jump to Brisbane today and a visible three-way date key',()=>{
  for(const text of ['data-annual-today','annual-date-key past','annual-date-key today',
    'annual-date-key future','brisbaneToday()','todayInRange','Go to today'])
    assert.ok(controller.includes(text),'Missing '+text);
});
