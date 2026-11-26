// Cloud-run actual Wrangler/workerd acceptance. All bindings are fictional,
// local and disposable. Never use --remote or a real Cloudflare credential.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {showcaseSql} from '../backend/showcase/seed.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const tmp=mkdtempSync(join(tmpdir(),'sandy-wrangler-fixture-')),configPath=join(root,'.sandy-wrangler-fixture-'+randomUUID()+'.jsonc');
const config=JSON.parse(readFileSync(join(root,'wrangler.jsonc'),'utf8'));
const fixtureSecret=()=>randomBytes(32).toString('hex');
const authPepper=fixtureSecret(),bootstrapKey=fixtureSecret(),showcaseKey=fixtureSecret();
config.name='sandy-release-isolated-test';config.workers_dev=false;
config.d1_databases=[{binding:'DB',database_name:'sandy-fixture-live',database_id:randomUUID(),migrations_dir:'backend/migrations'},{binding:'SANDY_SHOWCASE_DB',database_name:'sandy-fixture-demo',database_id:randomUUID()}];
config.vars={SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled',SANDY_PRIVATE_LIBRARY_ENABLED:'disabled',SANDY_AUTH_PEPPER:authPepper,SANDY_BOOTSTRAP_KEY:bootstrapKey,SANDY_SHOWCASE_KEY:showcaseKey};
const wrangler=join(root,'node_modules/.bin/wrangler'),env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};
for(const key of Object.keys(env))if(/^(CLOUDFLARE_|CF_API_|CF_ACCOUNT_)/.test(key))delete env[key];
const persist=join(tmp,'local-only'),fixturePath=join(tmp,'showcase.sql'),sentinels=[join(root,'assets','unreviewed-private-fixture.txt'),join(root,'studio','unreviewed-private-fixture.js')];
const marker='FICTIONAL PRIVATE ASSET MUST NOT BE SERVED';
let child,logs='';
const run=(args)=>execFileSync(wrangler,[...args,'--config',configPath],{cwd:root,env,stdio:'pipe',timeout:60000});
const origin='http://127.0.0.1:18781';
const go=(path,method='GET',body,cookie='',extra={})=>fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
async function jsonCall(path,method='GET',body,cookie='',expected=200,extra={}){
 const r=await go(path,method,body,cookie,extra),data=await r.json();assert.equal(r.status,expected,path+' '+JSON.stringify(data));return {data,cookies:r.headers.getSetCookie()};
}
const cookie=(r,name)=>r.cookies.find(x=>x.startsWith(name+'='))?.split(';')[0];
try{
 writeFileSync(configPath,JSON.stringify(config,null,2),{mode:0o600,flag:'wx'});
 writeFileSync(fixturePath,showcaseSql(),{mode:0o600});
 for(const file of sentinels)writeFileSync(file,marker,{flag:'wx'});
 for(const migration of ['0001_club.sql','0002_private_library.sql'])run(['d1','execute','DB','--local','--persist-to',persist,'--file',join(root,'backend/migrations',migration)]);
 run(['d1','execute','SANDY_SHOWCASE_DB','--local','--persist-to',persist,'--file',fixturePath]);
 child=spawn(wrangler,['dev','--local','--ip','127.0.0.1','--port','18781','--persist-to',persist,'--config',configPath],{cwd:root,env,stdio:['ignore','pipe','pipe'],detached:true});
 for(const stream of [child.stdout,child.stderr])stream.on('data',d=>{logs=(logs+d.toString()).slice(-12000)});
 let ready=false;
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)break;
  try{const r=await go('/api/health');if(r.ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,'Local Worker did not start. '+logs.slice(-1500));
 const health=(await jsonCall('/api/health')).data;assert.equal(health.operationalApprovals,false);
 const anon=(await jsonCall('/api/session')).data;assert.equal(anon.authenticated,false);
 for(const path of ['/api/records','/api/library','/api/accounts','/api/audit'])await jsonCall(path,'GET',undefined,'',401);
 for(const path of ['/backend/RECOVERY.md','/backend/recovery/owner-recovery.mjs','/worker/auth.mjs','/tests/wrangler-release.mjs','/studio/backend/schema.sql','/assets/unreviewed-private-fixture.txt','/studio/unreviewed-private-fixture.js','/'+configPath.split('/').at(-1),'/.env','/wrangler.jsonc','/backend%2frecovery%2fowner-recovery.mjs']){
  const r=await go(path);assert.equal(r.status,404,path);assert.ok(!(await r.text()).includes(marker),path);
 }
 for(const path of ['/club-admin','/club-login','/member-home','/social-studio','/constitution']){
  let response=await go(path);
  if([301,302,307,308].includes(response.status)){const next=new URL(response.headers.get('Location'),origin);response=await go(next.pathname+next.search)}
  assert.equal(response.status,200,path);assert.match(response.headers.get('Cache-Control')||'',/no-store/,path);assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN',path);
 }
 const image=await go('/assets/venue-home-hero.webp');assert.equal(image.status,200);assert.match(image.headers.get('Content-Type')||'',/image/);
 const username='fictional-wrangler-owner',password='fictional-test-password-'+randomUUID();
 await jsonCall('/api/auth/bootstrap','POST',{username,password,bootstrapKey},'',201);
 const login=await jsonCall('/api/auth/login','POST',{username,password}),owner=cookie(login,'__Host-sandy_session');assert.ok(owner);
 const session=(await jsonCall('/api/session','GET',undefined,owner)).data;assert.equal(session.identity.role,'webmaster');
 const reserve=(await jsonCall('/api/accounts','POST',{username:'fixture-secretary',role:'secretary'},owner,201)).data.account;
 await jsonCall('/api/accounts/'+reserve.id+'/invite','POST',{manual:true},owner,409);
 const work=(await jsonCall('/api/suite/meetings','POST',{title:'Fictional workerd meeting',fields:{meetingType:'Working group',date:'2027-04-12',followUps:'Check nets | Secretary | 2027-04-13'}},owner,201)).data;
 const a='/api/suite/meetings/'+work.id+'/followups';
 const tasks=await Promise.all([jsonCall(a,'POST',{version:1},owner),jsonCall(a,'POST',{version:1},owner)]);
 assert.equal(tasks.reduce((n,r)=>n+r.data.created,0),1);
 const preview=await jsonCall('/api/view/select','POST',{role:'secretary'},owner),view=cookie(preview,'__Host-sandy_view');assert.ok(view);
 const combined=owner+'; '+view,vs=(await jsonCall('/api/session','GET',undefined,combined)).data;assert.equal(vs.identity.role,'secretary');assert.equal(vs.synthetic,true);
 const records=(await jsonCall('/api/suite/meetings','GET',undefined,combined,200,{'X-Sandy-View':vs.viewContext})).data.records;
 assert.ok(records.every(r=>r.title.startsWith('[EXAMPLE]')));
 await jsonCall('/api/suite/meetings','POST',{title:'Not saved'},combined,403);
 await jsonCall('/api/view/exit','POST',{},combined);
 await jsonCall('/api/records','GET',undefined,owner,409,{'X-Sandy-View':vs.viewContext});
 const independent=await jsonCall('/api/view/login','POST',{key:showcaseKey}),show=cookie(independent,'__Host-sandy_view');assert.ok(show);
 const library=(await jsonCall('/api/library?scope=governance','GET',undefined,show)).data;assert.equal(library.synthetic,true);assert.equal(library.writeEnabled,false);
 const doc=library.documents[0],ticket=(await jsonCall('/api/library/'+doc.id+'/ticket','GET',undefined,show)).data.ticket;
 const binary=await go('/api/library/'+doc.id+'/download','GET',undefined,show,{'X-Sandy-Download':ticket});
 assert.equal(binary.status,200);assert.equal(Buffer.from(await binary.arrayBuffer()).toString('base64'),'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=');
 assert.equal((await jsonCall('/api/accounts','GET',undefined,owner)).data.accounts.length,2);
 console.log('PASS: isolated actual Wrangler/workerd assets, D1 login/atomic task creation, separate showcase and encrypted binary download');
}finally{
 if(child?.pid){try{process.kill(-child.pid,'SIGTERM')}catch{}await new Promise(r=>setTimeout(r,300));try{process.kill(-child.pid,'SIGKILL')}catch{}}
 for(const file of [configPath,...sentinels])rmSync(file,{force:true});
 rmSync(tmp,{recursive:true,force:true});
}
