import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STAFF,requireRole,ensureApprover,ApiError} from '../worker/shared.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('staff roles exclude the view-only webmaster and member account',()=>{
 assert.ok(STAFF.includes('webmaster'));
 assert.ok(!STAFF.includes('webmaster_demo'));
 assert.ok(!STAFF.includes('member'));
 assert.throws(()=>requireRole({role:'webmaster_demo'},STAFF),e=>e.status===403);
 assert.throws(()=>requireRole(null,STAFF),e=>e.status===401);
});
test('formal approval fails closed while Sandy is only a proposal',()=>{
 assert.throws(()=>ensureApprover({role:'webmaster'},{}),e=>e.status===409);
 assert.throws(()=>ensureApprover({role:'committee'},{SANDY_CLUB_APPROVALS:'enabled'}),e=>e.status===403);
});
test('static deployment keeps private Worker and migrations out of public assets',()=>{
 const ignore=read('../.assetsignore');
 for(const p of ['worker/','backend/','tests/','.github/','studio/backend/'])assert.ok(ignore.includes(p),p);
});
test('full Worker deployment preserves the verified Sandy D1 and separate owner-supplied showcase binding with safety gates disabled',()=>{
 const normal=JSON.parse(read('../wrangler.jsonc'));
 const full=JSON.parse(read('../wrangler.full.example.jsonc'));
 assert.equal(normal.name,'sandy-sports-club');
 assert.equal(normal.main,'./worker/index.mjs');
 assert.equal(normal.d1_databases[0].database_name,'sandy-sports-clubhouse');
 assert.equal(normal.d1_databases[0].database_id,'ada9c7fc-a138-4158-8986-8d6d6e8bfa94');
 assert.equal(normal.d1_databases[0].binding,'DB');
 assert.equal(normal.d1_databases.length,2);
 assert.deepEqual(normal.d1_databases[1],{binding:'SANDY_SHOWCASE_DB',database_name:'sandy-sports-clubhouse-showcase',database_id:'fbc64621-a57a-43e7-8138-717576d167c2'});
 assert.notEqual(normal.d1_databases[0].database_id,normal.d1_databases[1].database_id);
 assert.ok(normal.assets.run_worker_first.includes('/api/*'));
 assert.equal(normal.vars.SANDY_CLUB_APPROVALS,'disabled');
 assert.equal(normal.vars.SANDY_INVITES_ENABLED,'disabled');
 assert.equal(full.main,'./worker/index.mjs');
 assert.equal(full.d1_databases[0].database_id,'REPLACE_WITH_NEW_SANDY_D1_UUID');
});
test('no Sandy authenticated Studio path writes official records to localStorage',()=>{
 const app=read('../studio/sandy-studio-app.js');
 const ideas=read('../studio/sandy-brainstorm.js');
 const handoffs=read('../studio/sandy-workflows.js');
 assert.ok(app.includes('strictShared:true'));
 assert.ok(app.includes('/api/session'));
 assert.ok(ideas.includes("'/api/records?kind=social_idea'"));
 assert.ok(handoffs.includes("'/api/studio/briefs'"));
 assert.ok(!ideas.includes('localStorage.setItem'));
 assert.ok(!handoffs.includes('localStorage.setItem'));
});
test('manual committee invites require real webmaster action and do not enable automatic invitations or publication',()=>{
 const auth=read('../worker/auth.mjs'),worker=read('../worker/index.mjs'),briefs=read('../worker/briefs.mjs');
 const wrangler=JSON.parse(read('../wrangler.jsonc'));
 assert.ok(auth.includes("if(b.manual!==true)"));
 assert.ok(auth.includes("requireRole(identity,['webmaster'])"));
 assert.ok(auth.includes("target.role"));
 assert.ok(auth.includes("return json({token,username:target.username"));
 assert.ok(wrangler.vars.SANDY_INVITES_ENABLED==='disabled');
 assert.ok(worker.includes('invitationSendingEnabled:false'));
 assert.ok(briefs.includes('ensureApprover(identity,env)'));
 assert.ok(!worker.includes('sendSMS('));
});
test('Social Media Hub, constitution builder and officer invites live inside Sandy Clubhouse',()=>{
 const html=read('../club-admin.html'),code=read('../club-admin.js');
 const builder=read('../constitution.js'),login=read('../club-login.js');
 for(const key of ['club-social','club-constitution','club-invitation-result','club-invitation-link'])
  assert.ok(html.includes('id="'+key+'"'),key);
 assert.ok(code.includes("loadEmbeddedTool('social')"));
 assert.ok(code.includes("loadEmbeddedTool('constitution')"));
 assert.ok(code.includes("data:{manual:true}"));
 assert.ok(code.includes("encodeURIComponent('Sandy Sports Club private officer account setup')"));
 assert.ok(builder.includes('setupSharedConstitution()'));
 assert.ok(builder.includes("'/api/records?kind=governance'"));
 assert.ok(login.includes('openPrivateInvitation()'));
});

test('public proposal and real clubhouse have distinct prominent navigation',()=>{
 const site=read('../site.js'),proposal=read('../clubhouse.html');
 const admin=read('../club-admin.html'),script=read('../club-admin.js'),css=read('../club-system.css');
 assert.ok(site.includes("['clubhouse.html','Club proposal']"));
 assert.ok(site.includes("['club-admin.html','My Clubhouse']"));
 assert.ok(site.includes("entry.href='/club-admin.html'"));
 assert.ok(proposal.includes('class="clubhouse-entry"'));
 assert.ok(proposal.includes('href="/club-admin.html" class="button coral"'));
 assert.ok(admin.includes('<h1>My Clubhouse</h1>'));
 assert.ok(admin.includes('class="clubhouse-menu"'));
 assert.ok(script.includes("sectionLabel.textContent=button?.textContent?.trim()"));
 assert.ok(css.includes('.clubhouse-menu .club-tabs{display:grid'));
});

test('real PLFC Constitution V1.2 files are referenced for comparison without copying a protected document',()=>{
 const html=read('../club-admin.html'),builder=read('../constitution.html');
 for(const source of ['1cV_baU8tf7O4C5gdrP16gaRVFxHF_8mg','1Z1uYKTy3Mi19bub9bG749ZICbjosoW0o']){
  assert.ok(html.includes(source),'My Clubhouse should link to actual PLFC Drive file');
  assert.ok(builder.includes(source),'Standalone builder should link to actual PLFC Drive file');
 }
 assert.ok(html.includes('Constitution builder'));
 assert.ok(html.includes('View / download PLFC PDF'));
 assert.ok(builder.includes('Compare with the original PLFC Constitution V1.2'));
});

test('private Sandy clubhouse pages show the real favicon and island project links',()=>{
 const home=read('../club-admin.html'),login=read('../club-login.html'),member=read('../member-home.html');
 for(const html of [home,login,member])assert.ok(html.includes('href="/favicon.png" type="image/png"'), 'favicon link missing');
 for(const url of [
  'https://ready-setco.auraofintelligence.workers.dev/index.html',
  'https://auraofintelligence.github.io/minjerribah-screen-media-network/',
  'https://straddie-noticeboard-cloudflare.auraofintelligence.workers.dev/',
  'https://auraofintelligence.github.io/strange-but-true/index.html'
 ])assert.ok(home.includes(url),url);
 assert.ok(home.includes('class="club-island-links"'));
 assert.equal((home.match(/<img src="https?:\/\/[^\"]+" width="56" height="56"/g)||[]).length,4);
});

test('PLFC committee room desks are available as real shared drafts with attribution and safe gates',()=>{
 const html=read('../club-admin.html'),menu=read('../club-committee.js'),admin=read('../club-admin.js');
 const labels=['Committee notices','To-do lists','Newsletter desk','Social Studio','Officer handover',
  'Meetings','Events and fundraising','Club assets and loans','Sponsors and supporters','Grant register',
  'Results, prizes and sponsors','Member age and permissions','AGM jobs','Applications',
  'Invite returning members','Membership automations','Ready SETCO decisions','Documents','Manage club access',
  'Shop, stock and prices'];
 for(const label of labels)assert.ok(menu.includes("label:'"+label+"'"),label);
 assert.ok(html.includes('id="club-committee"'));
 assert.ok(admin.includes("setupCommitteeRoom({api,esc,status,openTab,getIdentity:()=>identity})"));
 assert.ok(admin.includes("committee:()=>committeeRoom?.open()"));
 assert.ok(menu.includes("api('/api/records?kind='"));
 assert.ok(menu.includes("method:'PATCH'"));
 assert.ok(menu.includes("method:'POST'"));
 assert.ok(menu.includes("'/revisions'"));
 assert.ok(menu.includes("key:'safety'"));
 assert.ok(menu.includes("kind:'safeguard',restricted:true"));
 assert.ok(!menu.includes("localStorage.setItem"));
});
test('Mozzie offers guided clubhouse tours without claiming live AI or sending content to services',()=>{
 const source=read('../club-mozzie.js'),site=read('../site.js');
 for(const label of ['Your Clubhouse','Committee room','Social Media Hub','Constitution builder','Officer invitations','Connected island projects'])
  assert.ok(source.includes("title:'"+label+"'"));
 assert.ok(source.includes('no live AI conversation'));
 assert.ok(source.includes("document.getElementById('guide-panel')"));
 assert.ok(site.includes("helper.src='/club-mozzie.js"));
 assert.ok(!source.includes('fetch('));
});
