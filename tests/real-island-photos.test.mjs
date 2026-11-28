import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const pages=PUBLIC_FILES.filter(f=>f.endsWith('.html')&&f!=='image-gallery.html');
const REAL={
 'real-main-beach-point-lookout':['hero-member-calendar','S. Newrick','CC BY-SA 4.0'],
 'real-amity-point-jetty':['card-const-sport-place','Pacificwizard','CC0'],
 'real-brown-lake-bummiera':['card-prog-country','John Tann','CC BY 2.0'],
 'real-gorge-walk-point-lookout':['card-ch-calendar','Saruman-the-white','CC BY-SA 4.0'],
 'real-dunwich-beach-barges':['card-src-ballow-hub','Debra Jordan','CC BY 3.0'],
};
test('the three towns card shows a credited real photo of each town',()=>{
 const home=read('index.html'),licence=read('LICENSE.md'),gallery=read('image-gallery.html');
 assert.ok(home.includes('<img src="/assets/real-three-towns.webp"'),'home card shows the three towns composite');
 assert.ok(home.includes('data-kind="Photos: Tanya Dedyukhina, CC BY 3.0; Pacificwizard, CC0; NJM2010, CC0"'),'every panel credited on the card');
 assert.ok(!home.includes('real-straddie-aerial'),'aerial no longer on the home page');
 const sec=gallery.slice(gallery.indexOf('id="real-island"'));
 assert.ok(sec.includes('/assets/real-straddie-aerial.webp')&&sec.includes('/assets/real-three-towns.webp'),'aerial kept in the gallery as previously used');
 for(const who of ['Tanya Dedyukhina','Pacificwizard','NJM2010'])assert.ok(licence.includes(who)&&sec.includes(who),who+' credited');
});
test('island scenery uses credited real photographs, not AI images',()=>{
 const gallery=read('image-gallery.html'),licence=read('LICENSE.md');
 const sec=gallery.slice(gallery.indexOf('id="real-island"'));
 for(const [img,[old,who,lic]] of Object.entries(REAL)){
  const uses=pages.filter(p=>read(p).includes('/assets/'+img+'.webp'));
  // Owner image review, 28 Nov 2026: the Gorge Walk photo came off "Island calendar and people" (no people in it).
  if(img==='real-gorge-walk-point-lookout'){assert.equal(uses.length,0);assert.ok(sec.includes('/assets/'+img+'.webp')&&licence.includes(who),img+' kept and credited');continue}
  assert.equal(uses.length,1,img+' live once');
  const html=read(uses[0]);
  assert.ok(html.includes(`data-kind="Photo: ${who}, ${lic}"`)||html.includes(`by ${who}, ${lic}, via Wikimedia Commons`),img+' carries a visible credit');
  assert.ok(!pages.some(p=>read(p).includes('/assets/'+old+'.webp')),old+' is no longer live');
  assert.ok(sec.includes('/assets/'+img+'.webp')&&sec.includes('/assets/'+old+'.webp'),img+' paired with the image previously used');
  assert.ok(licence.includes('assets/'+img+'.webp')&&licence.includes(who)&&licence.includes(lic),img+' credited in LICENSE.md');
 }
});
