// Owner rule: every card on the key pages shows its own image, on top of the card,
// and every page hero carries a real image rather than a plain gradient banner.
// Every image a public page references must exist on disk and be a reviewed public
// file, so it cannot 404 once deployed.
// Live check after a deploy: node tools/check-live-images.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
const KEY_PAGES=['index','facilities','film-club','flag-football','programme','join','places','clubhouse','committee','members'];
const HERO_PAGES=PUBLIC_FILES.filter(f=>f.endsWith('.html')).filter(f=>readFileSync(join(root,f),'utf8').includes('class="page-hero'));
const read=p=>readFileSync(join(root,p),'utf8');

test('every card on the key pages has an image on top',()=>{
 for(const p of KEY_PAGES){
  const html=read(p+'.html');
  const cards=[...html.matchAll(/<article class="card([^"]*)">([\s\S]*?)<\/article>/g)];
  assert.ok(cards.length>0,`${p}.html has no cards`);
  for(const [,cls,body] of cards){
   const title=(body.match(/<h3>(?:<a [^>]*>)?([^<]*)/)||[])[1]||'(untitled)';
   assert.match(body,/^<img src="\/assets\/[\w.-]+\.(?:webp|png|jpe?g)"[^>]* alt="[^"]{12,}"/,`${p}.html card "${title}" has no image as its first child`);
   if(cls.includes('card-link'))assert.match(body,/class="card-cue"/,`${p}.html card "${title}" lost its card cue`);
  }
 }
});

test('no page hero is an image-less gradient banner',()=>{
 assert.ok(HERO_PAGES.length>=40);
 for(const f of HERO_PAGES){
  const html=read(f);
  assert.ok(!html.includes('page-hero no-image'),`${f} hero has no image`);
  for(const m of html.matchAll(/<section class="page-hero">(<img [^>]*>)?/g))assert.ok(m[1],`${f} hero has no image`);
 }
});

test('every referenced image exists and is a public file (no 404s)',()=>{
 const pub=new Set(PUBLIC_FILES);
 let n=0;
 for(const f of PUBLIC_FILES.filter(x=>x.endsWith('.html'))){
  for(const m of read(f).matchAll(/["'(]\/(assets\/[\w.-]+\.(?:webp|png|jpe?g|gif|avif))/gi)){
   n++;
   assert.ok(existsSync(join(root,m[1])),`${f} references missing ${m[1]}`);
   assert.ok(pub.has(m[1]),`${f} references ${m[1]} which is not in PUBLIC_FILES so it would 404`);
  }
 }
 assert.ok(n>100,'expected over 100 image references across the site');
});
