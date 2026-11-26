// Public card grids use whole-card links: one anchor per card, inside the title so the
// title is its accessible name, stretched over the card. No separate "Explore further"
// text link, no nested links, and visible hover, focus and active styles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url);
const read=f=>readFileSync(new URL(f,root),'utf8');
const pages=PUBLIC_FILES.filter(f=>f.endsWith('.html'));
const cardsIn=html=>[...html.matchAll(/<article class="(card(?: [^"]*)?)">([\s\S]*?)<\/article>/g)].map(m=>({cls:m[1].split(' '),body:m[2]}));
test('every linked card is one whole-card link named by its title',()=>{
 let linked=0;
 for(const page of pages){
  const html=read(page);
  assert.ok(!/Explore further/.test(html),page+' still has a separate "Explore further" link');
  for(const c of cardsIn(html)){
   const anchors=[...c.body.matchAll(/<a\b[^>]*>/g)];
   if(!anchors.length){assert.ok(!c.cls.includes('card-link'),page+': card-link without a link');continue}
   linked++;
   assert.ok(c.cls.includes('card-link'),page+': a card with a link must be a whole-card link');
   assert.equal(anchors.length,1,page+': one link per card, no nested or extra links');
   const title=c.body.match(/<h3><a href="([^"]+)">([^<]+(?:<br>[^<]*)*)<\/a><\/h3>/);
   assert.ok(title&&title[2].trim(),page+': the link sits in the card title so the title is its name');
   assert.match(c.body,/<span class="card-cue" aria-hidden="true">&(?:rarr|nearr);<\/span>/,page+': decorative cue is hidden from assistive technology');
  }
 }
 assert.ok(linked>=100,'expected the public card grids to be checked, found '+linked);
});
test('the page builder emits whole-card links',()=>{
 const py=read('build_pages.py');
 assert.ok(!/Explore further/.test(py));
 assert.match(py,/<article class="card card-link">/);
});
test('card link styles cover stretch, hover, focus-visible, active, 44px targets and responsive grids',()=>{
 const css=read('pages.css');
 for(const rule of [/\.card\.card-link h3 a::after\{content:"";position:absolute;inset:0/,/\.card\.card-link:hover\{/,/\.card\.card-link h3 a:focus-visible::after\{outline:3px solid/,/\.card\.card-link:active\{/,/\.card-cue\{[^}]*width:44px;height:44px/,/min-height:44px/,/\.card-grid\{max-width:1320px\}/,/@media\(max-width:700px\)\{\.card-grid,\.card-grid\.two,\.card-grid\.four\{grid-template-columns:1fr\}/,/prefers-reduced-motion/])
  assert.match(css,rule);
 assert.match(css,/\.card\{position:relative\}/,'cards are the positioning context for the stretched link');
});
