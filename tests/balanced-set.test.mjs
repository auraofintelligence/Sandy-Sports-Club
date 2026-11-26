// Owner rule (26 Nov 2026): the balanced club image set is proposed only. It appears in
// the gallery's "Balanced club set (proposed)" section and on no live page, so no
// existing image changes until the owner chooses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
const set=JSON.parse(readFileSync(join(root,'tools/balanced-set.json'),'utf8'));
test('balanced club set: 30 proposed images with a fair age mix, only in the gallery',()=>{
 assert.equal(set.length,30);
 const ages={};for(const [,,age] of set)ages[age]=(ages[age]||0)+1;
 const youth=(ages.Juniors||0)+(ages.Teens||0);
 assert.ok(youth>=8&&youth<set.length/2,'youth should be a fair share, not the majority');
 for(const k of ['Adults','Seniors','Families and mixed ages'])assert.ok(ages[k]>=3,k+' under represented');
 const gallery=readFileSync(join(root,'image-gallery.html'),'utf8');
 assert.match(gallery,/<h2>Balanced club set \(proposed\)<\/h2>/);
 const pages=PUBLIC_FILES.filter(f=>f.endsWith('.html')&&f!=='image-gallery.html');
 for(const [n,slug,,,slot] of set){
  const f=`assets/balanced-${n}-${slug}.webp`;
  assert.ok(existsSync(join(root,f))&&PUBLIC_FILES.includes(f),f+' missing or not public');
  assert.ok(gallery.includes(`/${f}"`)&&gallery.includes('Could suit: '+slot.replace(/"/g,'&quot;')),f+' not labelled in the gallery');
  for(const p of pages)assert.ok(!readFileSync(join(root,p),'utf8').includes(f),f+' must not be wired into '+p);
 }
});
