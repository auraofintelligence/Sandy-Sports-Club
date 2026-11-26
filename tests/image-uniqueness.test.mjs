// Owner rule: absolutely zero image reuse. Every image file appears in exactly one
// place (one page, one section) on the public site, and no two image files may be
// the same picture under a different name, crop or size.
// Brand marks (logo, icon, favicon, Mozzie mascot) are UI chrome, exempt by design.
// A responsive variant named <name>-640w.webp belongs to <name>.webp and must only
// appear in that same <img> tag's srcset.
// After adding or replacing an image run: python3 tools/image-hashes.py
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,extname} from 'node:path';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
const BRAND=new Set(['assets/sandy-original-logo.png','assets/sandy-original-icon.png','assets/mozzie.webp','favicon.png','favicon.ico']);
const IMG=/\.(webp|png|jpe?g|gif|avif)$/i;
const base=f=>f.replace(/-\d+w(?=\.[a-z]+$)/i,'');
const manifest=JSON.parse(readFileSync(join(root,'tests/image-manifest.json'),'utf8'));
const assetImages=readdirSync(join(root,'assets')).filter(f=>IMG.test(f)).map(f=>'assets/'+f);
const textFiles=PUBLIC_FILES.filter(f=>['.html','.js','.css'].includes(extname(f)));

function placements(){
 // Map image group -> list of "file#section" places it is referenced.
 const uses=new Map();
 for(const f of textFiles){
  const text=readFileSync(join(root,f),'utf8');
  if(f.endsWith('.html')){
   const sections=text.split(/(?=<section\b)/);
   sections.forEach((chunk,i)=>{
    for(const tag of chunk.match(/<img\b[^>]*>/g)||[]){
     const refs=[...tag.matchAll(/\/?(assets\/[\w.-]+\.(?:webp|png|jpe?g|gif|avif))/gi)].map(m=>m[1]);
     for(const g of new Set(refs.map(base))){if(!uses.has(g))uses.set(g,[]);uses.get(g).push(f+'#section'+i)}
    }
    const withoutImg=chunk.replace(/<img\b[^>]*>/g,'');
    for(const m of withoutImg.matchAll(/\/?(assets\/[\w.-]+\.(?:webp|png|jpe?g|gif|avif))/gi)){const g=base(m[1]);if(!uses.has(g))uses.set(g,[]);uses.get(g).push(f+'#section'+i+'(non-img)')}
   });
  }else{
   for(const m of text.matchAll(/\/?(assets\/[\w.-]+\.(?:webp|png|jpe?g|gif|avif))/gi)){const g=base(m[1]);if(!uses.has(g))uses.set(g,[]);uses.get(g).push(f)}
  }
 }
 return uses;
}

test('every non-brand image is used in exactly one public page section',()=>{
 const uses=placements();
 const problems=[];
 for(const [g,places] of uses){
  if(BRAND.has(g))continue;
  if(places.length!==1)problems.push(g+' used '+places.length+' times: '+places.join(', '));
 }
 assert.deepEqual(problems,[],problems.join('\n'));
});

test('every shipped image is used somewhere (no orphan or retired images)',()=>{
 const uses=placements();
 const orphans=assetImages.filter(f=>!BRAND.has(f)&&!uses.has(base(f)));
 assert.deepEqual(orphans,[]);
 for(const f of assetImages)assert.ok(PUBLIC_FILES.includes(f),f+' missing from PUBLIC_FILES');
});

test('image manifest matches the files on disk',()=>{
 assert.deepEqual(Object.keys(manifest).sort(),assetImages.sort(),'run python3 tools/image-hashes.py');
 for(const f of assetImages){
  const sha=createHash('sha256').update(readFileSync(join(root,f))).digest('hex');
  assert.equal(manifest[f].sha256,sha,f+' changed: run python3 tools/image-hashes.py');
 }
});

test('no two image files are the same picture (exact or perceptual near-duplicate)',()=>{
 const keys=Object.keys(manifest).sort();
 const ham=(a,b)=>{let x=BigInt('0x'+a)^BigInt('0x'+b),n=0;while(x){n+=Number(x&1n);x>>=1n}return n};
 const close=[];
 const shas=new Map();
 for(const k of keys){const s=manifest[k].sha256;if(shas.has(s))close.push(k+' is a byte copy of '+shas.get(s));shas.set(s,k)}
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  if(base(keys[i])===base(keys[j]))continue;
  const d=ham(manifest[keys[i]].dhash,manifest[keys[j]].dhash);
  if(d<=10)close.push(keys[i]+' ~ '+keys[j]+' (dHash distance '+d+')');
 }
 assert.deepEqual(close,[],close.join('\n'));
});

test('retired inflatable and low-quality images are gone',()=>{
 for(const f of ['hero-film.webp','hero-home.webp','hero-sports.webp','modular-led-concept.webp','women-led-setup.webp'])
  assert.ok(!assetImages.includes('assets/'+f),f+' should stay retired');
});
