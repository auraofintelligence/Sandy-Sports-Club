import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../worker/index.mjs';
import {PUBLIC_FILES,publicPath} from '../worker/public-assets.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('reviewed asset allowlist includes the existing public site and rejects unknown or private files',t=>{
 const dir=mkdtempSync(join(tmpdir(),'sandy-assets-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const run=(args,input)=>spawnSync('git',args,{cwd:dir,encoding:'utf8',input});
 assert.equal(run(['init','-q']).status,0);
 writeFileSync(join(dir,'.gitignore'),readFileSync(join(root,'.assetsignore')));
 const tracked=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});assert.equal(tracked.status,0);
 const actual=tracked.stdout.split('\0').filter(Boolean);
 const probes=['backup.sqlite','export.json','private.pdf','new-unreviewed.js','assets/private-photo.png','studio/private-export.csv','studio/new-unreviewed.js','backend/recovery/secret.sql','.env.production','.dev.vars.production','.wrangler/state/private.db','wrangler.full.jsonc'];
 const candidates=[...new Set([...actual,...probes])].filter(x=>x!=='.gitignore');
 for(const p of candidates){mkdirSync(dirname(join(dir,p)),{recursive:true});writeFileSync(join(dir,p),'fixture, never real data')}
 const checked=run(['check-ignore','--no-index','--stdin','-z'],candidates.join('\0')+'\0');
 assert.ok([0,1].includes(checked.status),checked.stderr);
 const ignored=new Set(checked.stdout.split('\0').filter(Boolean));
 assert.deepEqual(candidates.filter(p=>!ignored.has(p)).sort(),[...PUBLIC_FILES].sort());
 for(const p of probes)assert.equal(publicPath('/'+p),null,p);
 for(const p of PUBLIC_FILES)assert.equal(publicPath('/'+p),'/'+p);
});
test('Worker denies private assets and encoded variants before reaching the asset binding; private shells remain embeddable and no-store',async()=>{
 let reads=0;const env={ASSETS:{async fetch(){reads++;return new Response('synthetic asset',{headers:{'Cache-Control':'public, max-age=86400','Content-Type':'text/html'}})}}};
 const call=path=>worker.fetch(new Request('https://sandy-isolation.test'+path),env);
 for(const p of ['/backend/RECOVERY.md','/backend/recovery/owner-recovery.mjs','/worker/auth.mjs','/tests/gate-a-owner-recovery.integration.mjs','/studio/backend/schema.sql','/.env','/.git/config','/wrangler.jsonc','/backup.sqlite','/assets/private-photo.png','/backend%2frecovery%2fowner-recovery.mjs','/%62ackend/RECOVERY.md','/assets/%252e%252e/worker/auth.mjs','/api','/api%2frecords']){
  const response=await call(p);assert.equal(response.status,404,p);assert.match(response.headers.get('Cache-Control'),/no-store/);
 }
 assert.equal(reads,0);
 for(const p of ['/club-admin','/club-login.html','/member-home/','/social-studio.html?workspace=1','/constitution.html?workspace=1']){
  const response=await call(p);assert.equal(response.status,200,p);assert.match(response.headers.get('Cache-Control'),/no-store/);
  assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN');assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'self'/);
 }
 assert.equal(reads,5);
 assert.match((await call('/assets/venue-home-hero.webp')).headers.get('Cache-Control'),/public/);
 const config=JSON.parse(readFileSync(join(root,'wrangler.jsonc'),'utf8'));
 assert.equal(config.name,'sandy-sports-club');assert.equal(config.d1_databases.length,2);
 assert.deepEqual(config.d1_databases[1],{binding:'SANDY_SHOWCASE_DB',database_name:'sandy-sports-clubhouse-showcase',database_id:'fbc64621-a57a-43e7-8138-717576d167c2'});
 assert.notEqual(config.d1_databases[0].database_id,config.d1_databases[1].database_id);
 assert.equal(config.d1_databases[0].database_id,'ada9c7fc-a138-4158-8986-8d6d6e8bfa94');
 assert.equal(config.vars.SANDY_CLUB_APPROVALS,'disabled');assert.equal(config.vars.SANDY_INVITES_ENABLED,'disabled');assert.equal(config.vars.SANDY_PRIVATE_LIBRARY_ENABLED,'disabled');
 for(const p of ['/api/*','/backend*','/worker*','/tests*','/studio/backend*','/club-admin*','/member-home*'])assert.ok(config.assets.run_worker_first.includes(p));
});
