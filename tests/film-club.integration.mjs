import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './d1-fixture.mjs';
const root=new URL('..',import.meta.url).pathname;
async function join(f,username){
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional '+username,email:username+'@example.test',town:'Dunwich',audienceRegion:'local',
  username,password:'sandy77',adult:true,contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob:'1990-06-15'});
 assert.equal(res.status,201);return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
const day=n=>new Date(Date.now()+36e6+n*864e5).toISOString().slice(0,10);
test('Film Club: join by lane, list kit, share it, borrow it and give it back',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const ann=await join(f,'annie'),ben=await join(f,'benno'),cal=await join(f,'callum');
 let a=await f.call(ann,'/api/member/film');
 assert.equal(a.film,false);assert.deepEqual(a.shelf,[]);assert.ok(a.options.lanes.watch&&a.options.kinds.mic&&a.options.share.club);
 await f.call(ann,'/api/member/film','POST',{action:'join',lanes:[]},400);
 await f.call(ann,'/api/member/film','POST',{action:'kit-save',name:'Rode mic',kind:'mic',share:'club'},409);
 a=await f.call(ann,'/api/member/film','POST',{action:'join',lanes:['make','crew','nonsense']});
 assert.equal(a.film,true);assert.deepEqual(a.lanes,['make','crew']);assert.equal(a.members,1);
 a=await f.call(ann,'/api/member/film','POST',{action:'kit-save',name:'Rode Wireless GO',kind:'mic',share:'club',care:'Charge before returning'});
 await f.call(ann,'/api/member/film','POST',{action:'kit-save',name:'Old laptop',kind:'edit',share:'private'});
 await f.call(ann,'/api/member/film','POST',{action:'kit-save',name:'x',kind:'spaceship',share:'club'},400);
 const mic=a.myKit[0].id;
 // Not in the Film Club: no shelf, cannot ask.
 assert.deepEqual((await f.call(cal,'/api/member/film')).shelf,[]);
 await f.call(cal,'/api/member/film','POST',{action:'ask',kitId:mic,from:day(1)},409);
 let b=await f.call(ben,'/api/member/film','POST',{action:'join',lanes:['watch']});
 assert.equal(b.members,2);
 assert.deepEqual(b.shelf.map(k=>[k.name,k.owner,k.care]),[['Rode Wireless GO','Fictional','Charge before returning']],'private kit stays private');
 await f.call(ben,'/api/member/film','POST',{action:'ask',kitId:mic,from:day(3),to:day(1)},400);
 b=await f.call(ben,'/api/member/film','POST',{action:'ask',kitId:mic,from:day(2),to:day(3),note:'Saturday volleyball shoot'});
 assert.equal(b.shelf[0].myRequest,'asked');assert.equal(b.outgoing[0].who,'Fictional');
 await f.call(ben,'/api/member/film','POST',{action:'ask',kitId:mic,from:day(2)},409);
 a=await f.call(ann,'/api/member/film');
 assert.equal(a.incoming.length,1);assert.equal(a.incoming[0].note,'Saturday volleyball shoot');
 const rq=a.incoming[0].id;
 await f.call(ben,'/api/member/film','POST',{action:'yes',id:rq},409,'only the owner answers');
 await f.call(ann,'/api/member/film','POST',{action:'returned',id:rq},409,'cannot return before yes');
 await f.call(ann,'/api/member/film','POST',{action:'yes',id:rq});
 assert.equal((await f.call(ben,'/api/member/film')).outgoing[0].state,'yes');
 a=await f.call(ann,'/api/member/film','POST',{action:'returned',id:rq});
 assert.equal(a.incoming[0].state,'returned');
 // Owner and borrower were both queued an in-app/email notification.
 const {DB}=f.env;const q=(await DB.prepare("SELECT title FROM club_notify_queue WHERE title LIKE 'Film Club:%'").all()).results.map(r=>r.title).sort();
 assert.equal(q.length,2);assert.match(q[0],/borrow your Rode Wireless GO/);assert.match(q[1],/yes, you can borrow/);
 // Leaving takes lent kit back to private.
 a=await f.call(ann,'/api/member/film','POST',{action:'leave'});
 assert.equal(a.film,false);assert.equal(a.myKit.find(k=>k.id===mic).share,'private');
 assert.deepEqual((await f.call(ben,'/api/member/film')).shelf,[]);
 await f.call('web','/api/member/film','GET',undefined,403);
});
test('Film Club page: sprite icons, summer season, kit and island network links',()=>{
 const page=readFileSync(root+'film-club.html','utf8'),sprite=readFileSync(root+'assets/film-icons.svg','utf8');
 const used=[...page.matchAll(/film-icons\.svg#(fc-[a-z]+)/g)].map(m=>m[1]);
 assert.ok(used.length>20);for(const u of new Set(used))assert.ok(sprite.includes('id="'+u+'"'),u+' missing from the sprite');
 const memberJs=readFileSync(root+'member-film.js','utf8')+readFileSync(root+'worker/film.mjs','utf8');
 for(const k of ['phone','camera','mic','light','tripod','gimbal','drone','edit','storage','screen','sound','other','watch','live','learn','kit','share','calendar','clapper'])assert.ok(sprite.includes('id="fc-'+k+'"'),'fc-'+k);
 assert.equal((page.match(/<li><svg class="fc-icon fc-icon-lg"/g)||[]).length,8,'eight weeks');
 for(const s of ['minjerribah-screen-media-network','straddie-noticeboard-cloudflare','ready-setco','film-club-documentary-builders','straddie-content-assets-kit','davinci-resolve-automations'])assert.ok(page.includes(s),s);
 assert.match(page,/invited in/);assert.doesNotMatch(page,/require the relevant people to lead and approve/);
 assert.match(readFileSync(root+'site.js','utf8'),/\['film-club\.html','Film Club'\]/);
 assert.ok(memberJs.includes("'with_me'"));
});
