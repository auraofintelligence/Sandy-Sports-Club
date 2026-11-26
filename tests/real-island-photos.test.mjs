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
 'real-straddie-aerial':['card-index-three-towns','J Brew','CC BY-SA 2.0'],
 'real-main-beach-point-lookout':['hero-member-calendar','S. Newrick','CC BY-SA 4.0'],
 'real-amity-point-jetty':['card-const-sport-place','Pacificwizard','CC0'],
 'real-brown-lake-bummiera':['card-prog-country','John Tann','CC BY 2.0'],
 'real-gorge-walk-point-lookout':['card-ch-calendar','Saruman-the-white','CC BY-SA 4.0'],
 'real-dunwich-beach-barges':['card-src-ballow-hub','Debra Jordan','CC BY 3.0'],
};
test('island scenery uses credited real photographs, not AI images',()=>{
 const gallery=read('image-gallery.html'),licence=read('LICENSE.md');
 const sec=gallery.slice(gallery.indexOf('id="real-island"'));
 for(const [img,[old,who,lic]] of Object.entries(REAL)){
  const uses=pages.filter(p=>read(p).includes('/assets/'+img+'.webp'));
  assert.equal(uses.length,1,img+' live once');
  const html=read(uses[0]);
  assert.ok(html.includes(`data-kind="Photo: ${who}, ${lic}"`)||html.includes(`by ${who}, ${lic}, via Wikimedia Commons`),img+' carries a visible credit');
  assert.ok(!pages.some(p=>read(p).includes('/assets/'+old+'.webp')),old+' is no longer live');
  assert.ok(sec.includes('/assets/'+img+'.webp')&&sec.includes('/assets/'+old+'.webp'),img+' paired with the image previously used');
  assert.ok(licence.includes('assets/'+img+'.webp')&&licence.includes(who)&&licence.includes(lic),img+' credited in LICENSE.md');
 }
});
