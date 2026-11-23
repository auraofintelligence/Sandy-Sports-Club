import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const js=read('../studio/social-visual-ui.js');
const css=read('../studio/sandy-studio.css');
const controller=read('../studio/social-campaigns.js');
const compiled=js.replace(/^import .*?;\s*$/gm,'').replace(/^export\s+/gm,'');
const {renderMonthCalendar}=new Function('renderDaySignature','signatureOfficer',compiled+'\nreturn {renderMonthCalendar}')(()=>'',()=>'');
const day='2026-11-01';
const posts=['19:00','08:30','14:00','09:30','17:15','06:45','12:30','20:15','11:15']
  .map((time,i)=>({id:'p'+i,date:day,suggestedTime:time,title:'Post '+i,layerIds:['volleyball']}));
const html=renderMonthCalendar({month:'2026-11',days:[{date:day}],posts,esc:String,today:'2026-11-24',
  getPostTime:post=>post.id==='p0'?'07:15':post.suggestedTime});
const icons=[...html.matchAll(/class="annual-calendar-post-icon" title="([^"]+)"/g)].map(m=>m[1]);
test('renders every repeated post icon without capping or deduplication',()=>{
  assert.equal(icons.length,posts.length);
});
test('orders icons by user-edited posting time, left to right',()=>{
  assert.deepEqual(icons.map(x=>x.split(' · ').at(-1)),
    ['Post 5','Post 0','Post 1','Post 3','Post 8','Post 6','Post 2','Post 4','Post 7']);
  assert.match(controller,/getPostTime:post=>postTime\(post,getEdit\(post.id\)\)/);
});
test('narrow calendar cells wrap icons and retain a legible week summary',()=>{
  assert.match(css,/grid-template-columns:repeat\(auto-fit,minmax\(16px,18px\)\)/);
  assert.match(css,/@container \(max-width:790px\)/);
  assert.match(css,/grid-column:1\/-1/);
  assert.match(css,/@container \(max-width:480px\)/);
});
