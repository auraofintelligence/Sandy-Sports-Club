// Owner approval (27 Nov 2026): the balanced club image set goes live, each image in
// the slot its gallery caption named. The images it replaced stay as files and are
// listed in the gallery as Previously used. No original and no location photo is
// replaced, and every image is still used on at most one live page slot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
const read=p=>readFileSync(join(root,p),'utf8');
const set=JSON.parse(read('tools/balanced-set.json'));
const pages=PUBLIC_FILES.filter(f=>f.endsWith('.html')&&f!=='image-gallery.html');
const gallery=read('image-gallery.html');
const block=(html,title)=>{
 for(const m of html.matchAll(/<article class="card[^"]*">((?:(?!<\/?article).)*?)<\/article>/gs)){
  const h=m[1].match(/<h3>(?:<a [^>]*>)?([^<]*)/);
  if(h&&h[1].trim()===title)return m[1];
 }
 return null;
};
test('balanced club set: 30 images with a fair age mix',()=>{
 assert.equal(set.length,30);
 const ages={};for(const [,,age] of set)ages[age]=(ages[age]||0)+1;
 const youth=(ages.Juniors||0)+(ages.Teens||0);
 assert.ok(youth>=8&&youth<set.length/2,'youth should be a fair share, not the majority');
 for(const k of ['Adults','Seniors','Families and mixed ages'])assert.ok(ages[k]>=3,k+' under represented');
 assert.match(gallery,/<h2>Balanced club set<\/h2>/);
});
test('each balanced image is live in exactly its suggested slot and nowhere else',()=>{
 for(const [n,slug,,,slot] of set){
  const f=`assets/balanced-${n}-${slug}.webp`;
  assert.ok(existsSync(join(root,f))&&PUBLIC_FILES.includes(f),f+' missing or not public');
  assert.ok(gallery.includes(`/${f}"`),f+' not in the gallery');
  const m=slot.match(/^(\S+\.html) (?:page banner|card "(.*)")$/);
  assert.ok(m,slot);
  const html=read(m[1]);
  if(m[2]===undefined)assert.match(html,new RegExp(`<section class="page-hero"><img src="/${f.replace(/[.]/g,'\\.')}"`),f+' should be the banner of '+m[1]);
  else{const b=block(html,m[2]);assert.ok(b&&b.includes(`/${f}"`),f+' should be on the '+m[2]+' card of '+m[1]);}
  const uses=pages.reduce((c,p)=>c+(read(p).split(`/${f}"`).length-1),0);
  assert.equal(uses,1,f+' must be used once');
 }
});
test('the images the balanced set replaced stay as files and show as Previously used',()=>{
 const pairs=gallery.slice(gallery.indexOf('id="balanced"'),gallery.indexOf('id="straddie-scale"'));
 const prev=[...pairs.matchAll(/PREVIOUSLY USED<\/p><figure class="gallery-item"><img src="\/assets\/([^"]+)"[^>]*><figcaption><strong>[^<]+<\/strong> <span class="gallery-status removed">Previously used<\/span>/g)].map(m=>m[1]);
 assert.equal(prev.length,30,'every balanced slot shows the image it replaced');
 for(const f of prev){
  assert.ok(existsSync(join(root,'assets',f)),f+' file kept');
  for(const p of pages)assert.ok(!read(p).includes(`/assets/${f}"`),f+' should no longer be live on '+p);
 }
});
test('Straddie scale redraws replace the oversized concept images and keep the old files',()=>{
 const sec=gallery.slice(gallery.indexOf('id="straddie-scale"'),gallery.indexOf('id="people-standard"'));
 const now=[...sec.matchAll(/IN THAT SLOT NOW<\/p><figure class="gallery-item"><img src="\/assets\/([^"]+)"/g)].map(m=>m[1]);
 const prev=[...sec.matchAll(/PREVIOUSLY USED<\/p><figure class="gallery-item"><img src="\/assets\/([^"]+)"/g)].map(m=>m[1]);
 assert.equal(now.length,11);assert.equal(prev.length,11);
 for(const f of now){assert.match(f,/-straddie\.webp$/);assert.ok(PUBLIC_FILES.includes('assets/'+f),f+' public');assert.equal(pages.reduce((c,p)=>c+(read(p).split(`/assets/${f}"`).length-1),0),1,f+' used once');}
 for(const f of prev){assert.ok(existsSync(join(root,'assets',f)),f+' kept');for(const p of pages)assert.ok(!read(p).includes(`/assets/${f}"`),f+' no longer live');}
 assert.ok(pages.every(p=>!read(p).includes('/assets/hero-assets.webp"')),'the stadium image is off the Assets page');
});
test('committee balance and child safe amenities redraws are live, and the two deleted images are gone everywhere',()=>{
 const sec=gallery.slice(gallery.indexOf('id="people-standard"'),gallery.indexOf('id="sitewide"'));
 const now=[...sec.matchAll(/IN THAT SLOT NOW<\/p><figure class="gallery-item"><img src="\/assets\/([^"]+)"/g)].map(m=>m[1]);
 assert.ok(now.length>=22);
 for(const f of now){assert.ok(PUBLIC_FILES.includes('assets/'+f),f+' public');assert.equal(pages.reduce((c,p)=>c+(read(p).split(`/assets/${f}"`).length-1),0),1,f+' used once');}
 for(const f of ['hero-constitution.webp','card-fac-dressing-rooms.webp']){
  assert.ok(!existsSync(join(root,'assets',f)),f+' deleted');
  assert.ok(!PUBLIC_FILES.includes('assets/'+f),f+' not public');
  assert.ok(!gallery.includes(f),f+' not in the gallery');
  for(const p of pages)assert.ok(!read(p).includes(f),f+' not on '+p);
 }
 assert.match(read('facilities.html'),/Private, lockable, fully enclosed shower and change cubicles, an accessible family change room/);
 assert.ok(gallery.includes('Concept set for early promotion; to be replaced with real island photography.'));
});
test('the LED screen is described as mobile and segmented, and the original stays on the home card',()=>{
 for(const p of ['index.html','film-club.html','donate.html'])assert.match(read(p),/mobile, segmented LED/,p);
 assert.ok(read('index.html').includes('/assets/modular-led-concept.webp"'),'home LED card keeps the original');
 assert.match(read('donate.html'),/<section class="page-hero"><img src="\/assets\/led-cinema-screen-campaign\.webp" alt="Concept image of a mobile, segmented LED screen[^"]*">[\s\S]*?<small class="caption">[^<]*mobile, segmented LED panels/);
});

test('site wide pass redraws are live once each and paired in the gallery',()=>{
 const sec=gallery.slice(gallery.indexOf('id="sitewide"'),gallery.indexOf('id="real-island"'));
 const news=['sport-flag-football-island','grants-capital-island','card-stat-paris-island','card-stat-adelaide-island','card-stat-rankings-island','card-stat-beach-soccer-island','card-grant-infrastructure-equal','card-grant-private-investment-equal','card-sport-beach-cricket-family','card-sport-beach-rugby-league-mixed','card-sport-island-made-formats-mixed','card-survey-afl-crossover-mixed','card-survey-beach-handball-mixed','card-survey-beach-rugby-league-mixed','card-asset-broadcast-mixed','card-asset-mobile-panels-mixed','card-asset-resilience-mixed','card-ch-facilities-mixed'];
 for(const n of news){
  const uses=pages.filter(p=>read(p).includes('/assets/'+n+'.webp'));
  assert.equal(uses.length,1,n+' live once');
  assert.ok(sec.includes('/assets/'+n+'.webp'),n+' paired in the gallery');
 }
 assert.equal((sec.match(/Previously used/g)||[]).length,18);
});
