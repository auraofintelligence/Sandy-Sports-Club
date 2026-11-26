// Fetch every public page from the live site, check each card on the key pages has an
// image, and confirm every referenced image URL returns 200. Usage:
// node tools/check-live-images.mjs [base-url]
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const base=(process.argv[2]||'https://sandy-sports-club.auraofintelligence.workers.dev').replace(/\/$/,'');
const KEY=new Set(['index','facilities','film-club','flag-football','programme','join','places','clubhouse','committee','members']);
const pages=PUBLIC_FILES.filter(f=>f.endsWith('.html'));
const images=new Map();let bad=0;
for(const f of pages){
 const r=await fetch(`${base}/${f}`,{redirect:'follow'});
 if(r.status!==200){console.log('PAGE',r.status,f);bad++;continue}
 const html=await r.text();
 if(KEY.has(f.replace('.html',''))){
  for(const [,body] of html.matchAll(/<article class="card[^"]*">([\s\S]*?)<\/article>/g))if(!/^<img /.test(body)){console.log('NO-IMAGE card on',f);bad++}
 }
 for(const m of html.matchAll(/["'(]\/(assets\/[\w.-]+\.(?:webp|png|jpe?g|gif|avif))/gi))images.set(m[1],f);
}
for(const [img,f] of images){
 const r=await fetch(`${base}/${img}`,{method:'GET'});
 const type=r.headers.get('content-type')||'';
 await r.arrayBuffer();
 if(r.status!==200||!type.startsWith('image/')){console.log('IMAGE',r.status,type,img,'on',f);bad++}
}
console.log(`${pages.length} pages, ${images.size} image URLs checked, ${bad} problems`);
process.exit(bad?1:0);
