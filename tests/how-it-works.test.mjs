import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACCESS_GROUPS} from '../studio/sandy-access.js';
import {ACTORS,MEMBER_TABS,WORKFLOWS} from '../studio/sandy-processes.js';
import {DESKS} from '../committee-desks.js';
const root=new URL('..',import.meta.url).pathname,read=f=>readFileSync(root+f,'utf8');
test('every process step names a real access group or a known person',()=>{
 for(const w of WORKFLOWS)for(const [step,who] of w.steps)assert.ok(ACTORS[who]||ACCESS_GROUPS[who],w.key+': '+step+' has unknown actor '+who);
 assert.equal(new Set(WORKFLOWS.map(w=>w.key)).size,WORKFLOWS.length);
});
test('the My Membership tabs listed match member-home.html',()=>{
 const tabs=[...read('member-home.html').matchAll(/data-member-tab="([a-z-]+)"[^>]*>([^<]+)/g)].map(m=>[m[1],m[2].replace(/&amp;/g,'&').trim()]);
 assert.deepEqual(MEMBER_TABS.map(([k,l])=>[k,l]),tabs);
});
test('committee desks have unique keys, so one desk can never hide another',()=>{
 const keys=DESKS.map(d=>d.key);assert.equal(new Set(keys).size,keys.length,keys.filter((k,i)=>keys.indexOf(k)!==i).join(','));
 assert.ok(DESKS.some(d=>d.key==='island-news')&&DESKS.some(d=>d.key==='news'));
});
test('How the club works is linked and drawn from the site data',()=>{
 const page=read('how-it-works.html'),js=read('how-it-works.js');
 for(const s of ['data-hw-map','data-hw-access','data-hw-flows','/how-it-works.js'])assert.ok(page.includes(s),s);
 for(const s of ['SANDY_SITE_MAP','committee-desks.js','sandy-processes.js','accessTableHtml'])assert.ok(js.includes(s),s);
 assert.match(read('site.js'),/route\('how-it-works','How the club works'\)/);
 assert.match(read('constitution.html'),/how-it-works\.html/);assert.match(read('club-admin.html'),/how-it-works\.html#processes/);
});
