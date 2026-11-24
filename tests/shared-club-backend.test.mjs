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
test('separate full Worker configuration cannot be deployed before providing a Sandy-only DB ID',()=>{
 const normal=JSON.parse(read('../wrangler.jsonc'));
 const full=JSON.parse(read('../wrangler.full.example.jsonc'));
 assert.ok(!normal.main&&!normal.d1_databases,'Normal live static deployment stays untouched');
 assert.equal(full.main,'./worker/index.mjs');
 assert.equal(full.d1_databases[0].database_id,'REPLACE_WITH_NEW_SANDY_D1_UUID');
 assert.equal(full.d1_databases[0].binding,'DB');
 assert.ok(full.assets.run_worker_first.includes('/api/*'));
 assert.equal(full.vars.SANDY_CLUB_APPROVALS,'disabled');
 assert.equal(full.vars.SANDY_INVITES_ENABLED,'disabled');
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
test('office invitations and publication require separate gating',()=>{
 const auth=read('../worker/auth.mjs'),worker=read('../worker/index.mjs'),briefs=read('../worker/briefs.mjs');
 assert.ok(auth.includes("SANDY_INVITES_ENABLED!=='enabled'"));
 assert.ok(briefs.includes('ensureApprover(identity,env)'));
 assert.ok(!worker.includes('sendSMS('));
});
