// Owner request (27 Nov 2026): the sports, their rules and equipment, the survey and the
// image gallery are reachable from the shared navigation on every page.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
const read=p=>readFileSync(join(root,p),'utf8');
const site=read('site.js'),css=read('pages.css');
test('the sports menu links every sport page, its rules and equipment, and the survey',()=>{
 const sports=PUBLIC_FILES.filter(f=>/^sport-[\w-]+\.html$/.test(f));
 assert.equal(sports.length,14);
 for(const f of sports){
  assert.ok(site.includes(`['${f}',`),f+' missing from the sports menu');
  assert.match(read(f),/<section id="how-its-played" class="page-section/,f+' has no how-its-played anchor');
 }
 assert.ok(site.includes('#how-its-played" aria-label="${label}: rules and equipment">Rules and equipment</a>'));
 assert.ok(site.includes('<a href="/sports.html#survey">Sports survey</a>'));
 assert.match(read('sports.html'),/<section class="page-section sunny" id="survey">/);
});
test('the sports menu is a keyboard accessible disclosure that works in the mobile panel',()=>{
 assert.ok(site.includes('class="nav-sub-toggle" aria-expanded="false" aria-controls="nav-sports"'));
 assert.ok(site.includes('<div class="nav-sub" id="nav-sports" hidden>'));
 assert.ok(site.includes("e.key!=='Escape'"),'Escape closes the menu');
 assert.match(css,/\.nav-sub-toggle\{[^}]*min-width:44px;min-height:44px/);
 assert.match(css,/@media\(max-width:1600px\)\{\n  \.site-header nav,\.site-header nav\.open\{flex-wrap:nowrap\}\n  \.site-header nav \.nav-group\{display:grid/,'the Menu panel shows the sports list inline without wrapping into columns');
});
test('every public page loads the shared navigation',()=>{
 for(const f of PUBLIC_FILES.filter(f=>f.endsWith('.html'))){
  const h=read(f);
  if(!h.includes('/site.js'))continue;
  assert.ok(h.includes('data-site-header')||h.includes('data-site-footer'),f+' has site.js but no shared navigation slot');
 }
});
