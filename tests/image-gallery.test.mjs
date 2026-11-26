// The owner's image gallery: a noindex review page outside the main navigation,
// linked only from the Webmaster page. It lists every original from b1964e4 and every
// newer image with its filename, where it is used and its status. It is allowed to
// repeat images shown elsewhere. Rebuild it with: python3 tools/build-gallery.py
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
const read=f=>readFileSync(join(root,f),'utf8');
const html=read('image-gallery.html');
const ORIGINALS=['flag-football-concept.webp','hero-community-builder.webp','hero-film.webp','hero-funding.webp','hero-home.webp','hero-markets.webp','hero-nearby.webp','hero-sports.webp','hero-trust.webp','hero-youth-elders.webp','modular-led-concept.webp','mozzie.webp','sandy-original-icon.png','sandy-original-logo.png','site-ballow-360-point-20.webp','site-ballow-aerial.webp','site-ballow-bay-tree.webp','site-ballow-roadside.webp','women-led-setup.webp'];
const section=id=>html.split('id="'+id+'"')[1].split('</section>')[0];

test('the gallery is public, noindex and outside the main navigation',()=>{
 assert.ok(PUBLIC_FILES.includes('image-gallery.html'));
 assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
 assert.ok(!read('sitemap.xml').includes('image-gallery'),'not in the sitemap');
 assert.ok(!read('site.js').includes('image-gallery'),'not in the site header, footer or navigation');
 const linkers=PUBLIC_FILES.filter(f=>f.endsWith('.html')&&f!=='image-gallery.html'&&read(f).includes('/image-gallery.html'));
 assert.deepEqual(linkers,['webmaster.html'],'linked from the Webmaster page only');
});

test('section 1 shows all 19 originals, section 2 every newer image, section 3 the proposed balanced set, each labelled',()=>{
 const orig=section('originals'),fresh=section('new'),proposed=section('balanced');
 for(const f of ORIGINALS)assert.ok(orig.includes('<img src="/assets/'+f+'"'),f+' missing from Originals');
 const all=readdirSync(join(root,'assets')).filter(f=>/\.(webp|png|jpe?g)$/.test(f)&&!/-\d+w\./.test(f));
 for(const f of all.filter(f=>!ORIGINALS.includes(f)))assert.ok((/^balanced-/.test(f)?proposed:fresh).includes('<img src="/assets/'+f+'"'),f+' missing from its gallery section');
 for(const m of html.matchAll(/<figure class="gallery-item"><img src="\/assets\/([^"]+)"[^>]*><figcaption><strong>([^<]+)<\/strong> <span class="gallery-status (live|removed|unused)">/g))assert.equal(m[1],m[2]);
 const labelled=[...html.matchAll(/<figure class="gallery-item"><img /g)].length;
 const captioned=[...html.matchAll(/<span class="gallery-status (?:live|removed|unused)">/g)].length;
 assert.equal(labelled,captioned,'every image carries a status');
});

test('replaced originals are shown side by side with the image now in that slot',()=>{
 const pairs=section('side-by-side');
 assert.match(pairs,/<div class="gallery-pair"><h3>sport-flag-football\.html: page banner<\/h3>[\s\S]*?flag-football-concept\.webp[\s\S]*?card-index-flag\.webp/);
 assert.ok(!/<h3>index\.html: /.test(pairs),'the home page shows its originals again, so it has no replaced slot');
});
