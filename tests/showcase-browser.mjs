import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,statSync,mkdtempSync,rmSync} from 'node:fs';
import {createServer} from 'node:https';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import worker from '../worker/index.mjs';
import {showcaseSql} from '../backend/showcase/seed.mjs';
import {SUITE_DESKS} from '../studio/sandy-suite-spec.js';
import {STAFF} from '../worker/shared.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),tmp=mkdtempSync(join(tmpdir(),'sandy-browser-'));
const stamp='2026-11-25T00:00:00Z',digest=v=>createHash('sha256').update(v).digest('hex');
function fixture(sqlText){
 const sql=new DatabaseSync(':memory:');sql.exec(sqlText);
 const DB={prepare(query){
  const q=sql.prepare(query),bind=(...args)=>({first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>({meta:{changes:Number(q.run(...args).changes)}})});
  return {...bind(),bind};
 },withSession(){return this},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
 return {sql,DB};
}
const live=fixture(readFileSync(join(root,'backend/migrations/0001_club.sql'),'utf8')),showcase=fixture(showcaseSql()),actors={};
for(const role of STAFF){
 const id=randomUUID(),token=randomBytes(32).toString('hex');actors[role]={id,token};
 live.sql.prepare("INSERT INTO club_accounts(id,username,role,office_label,display_name,state,password_salt,password_verifier,created_utc) VALUES(?,?,?,?,?,'active','fictional','fictional',?)").run(id,'fixture-'+role,role,role,'Fixture live '+role,stamp);
 live.sql.prepare('INSERT INTO club_sessions VALUES(?,?,0,4102444800)').run(digest(token),id);
}
live.sql.prepare("INSERT INTO club_records(id,kind,title,body_json,status,created_by,updated_by,created_utc,updated_utc) VALUES(?,'social_idea','PRIVATE LIVE SENTINEL','{}','draft',?,?,?,?)").run(randomUUID(),actors.webmaster.id,actors.webmaster.id,stamp,stamp);
const env={DB:live.DB,SANDY_SHOWCASE_DB:showcase.DB,SANDY_AUTH_PEPPER:randomBytes(32).toString('hex'),SANDY_SHOWCASE_KEY:randomBytes(32).toString('hex'),SANDY_CLUB_APPROVALS:'disabled',SANDY_INVITES_ENABLED:'disabled'};
const snapshot=sql=>Object.fromEntries(sql.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({name})=>[name,sql.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
const liveBefore=snapshot(live.sql),demoBefore=snapshot(showcase.sql);
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2','.md':'text/plain; charset=utf-8'};
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-keyout',join(tmp,'key.pem'),'-out',join(tmp,'cert.pem')],{stdio:'ignore'});
let origin;
const server=createServer({key:readFileSync(join(tmp,'key.pem')),cert:readFileSync(join(tmp,'cert.pem'))},async(req,res)=>{
 try{
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')){
   const body=[];for await(const chunk of req)body.push(chunk);
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):v);
   const response=await worker.fetch(new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(body)})}),env);
   res.statusCode=response.status;for(const [k,v] of response.headers)if(k!=='set-cookie')res.setHeader(k,v);
   const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
   res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  let pathname=decodeURIComponent(url.pathname);if(pathname==='/club-admin')pathname='/club-admin.html';if(pathname==='/')pathname='/index.html';
  const file=resolve(root,'.'+pathname),rel=file.slice(root.length);
  if(!file.startsWith(root)||/(^|\/)(?:\.[^/]+|worker|backend|tests|scripts|node_modules)(?:\/|$)/.test(rel)||!statSync(file,{throwIfNoEntry:false})?.isFile()){res.writeHead(404);res.end('Not found');return}
  res.writeHead(200,{'Content-Type':mimes[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));
 }catch(e){console.error('Fixture server error',e.message);res.writeHead(500);res.end('Fixture error')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='https://127.0.0.1:'+server.address().port;
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true});
 async function context(role,viewport={width:1366,height:900}){
  const c=await browser.newContext({ignoreHTTPSErrors:true,viewport});
  await c.route('**/*',route=>route.request().url().startsWith(origin)||route.request().url().startsWith('data:')?route.continue():route.abort());
  if(role)await c.addCookies([{name:'__Host-sandy_session',value:actors[role].token,url:origin,secure:true,httpOnly:true,sameSite:'Strict'}]);
  return c;
 }
 const makePage=async c=>{const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);return p};
 const wait=async(p,selector)=>p.locator(selector).first().waitFor({state:'visible'});
 const go=async(p,path)=>p.goto(origin+path,{waitUntil:'domcontentloaded'});
 const roleTabs=async p=>p.locator('[data-tab]').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>n.dataset.tab).sort());
 async function desk(p,key){
  await go(p,'/club-admin.html?desk='+key+'#committee/'+key);await wait(p,'#committee-suite .suite-record');
  assert.equal(await p.locator('#suite-desk-name').textContent(),SUITE_DESKS.find(d=>d.key===key).title);
  assert.match(await p.locator('.suite-record strong').first().textContent(),/^\[EXAMPLE\]/);
 }
 async function select(p,role){
  await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.locator('#club-view-role').selectOption(role)]);
  if(role==='member')await wait(p,'#member-panel');else await wait(p,'#club-console');
 }
 const owner=await context('webmaster'),p=await makePage(owner);
 await go(p,'/club-admin.html#overview');await wait(p,'#club-console');
 assert.equal(await p.locator('#club-view-role').inputValue(),'webmaster');
 await p.evaluate(()=>{localStorage.setItem('sandy-constitution-draft',JSON.stringify({name:'PRIVATE LOCAL SENTINEL'}));localStorage.setItem('sandy-social-studio-local-revisions-v1',JSON.stringify({settings:{private:'PRIVATE LOCAL SENTINEL'},version:4}));localStorage.setItem('sandy-social-ideas-v1',JSON.stringify({items:[{title:'PRIVATE LOCAL SENTINEL'}]}));});
 for(const role of STAFF.filter(r=>r!=='webmaster')){
  const real=await context(role),rp=await makePage(real);
  await go(rp,'/club-admin.html#overview');await wait(rp,'#club-console');
  const realTabs=await roleTabs(rp);await select(p,role);
  assert.deepEqual(await roleTabs(p),realTabs,role+' menu parity');
  assert.match(await p.locator('#club-status').textContent(),/SYNTHETIC VIEW ONLY/);
  assert.equal(await p.locator('#club-view-role').inputValue(),role);
  await go(p,'/club-admin.html?check='+role+'#committee/notices');await wait(p,'#committee-suite .suite-record');
  for(const d of SUITE_DESKS)assert.equal(await p.locator('[data-committee-desk="'+d.key+'"]').isDisabled(),!d.roles.includes(role),role+' '+d.key);
  await real.close();
 }
 console.log('PASS: every prospective officer has the same navigation and desk permissions as independently authenticated fictional roles');
 await select(p,'treasurer');await desk(p,'stock');
 assert.equal(await p.locator('#suite-new').isDisabled(),true);assert.equal(await p.locator('[data-suite-action="movement"]').isDisabled(),true);
 await p.locator('[data-suite-action="open"]').click();await wait(p,'#suite-editor');
 assert.equal(await p.locator('#suite-save').isDisabled(),true);assert.equal(await p.locator('#suite-form [name="title"]').isDisabled(),true);
 await p.locator('[data-suite-action="history"]').click();await wait(p,'.suite-history');
 assert.match(await p.locator('.suite-history').textContent(),/synthetic_fixture/);
 await select(p,'secretary');await go(p,'/club-admin.html?restricted=1#committee/stock');await wait(p,'#club-console');
 await p.waitForFunction(()=>document.querySelector('#club-status').textContent.includes('cannot open that committee desk'));
 assert.equal(await p.locator('#committee-suite .suite-record').count(),0);
 await desk(p,'meetings');assert.equal(await p.locator('[data-suite-action="followups"]').isDisabled(),true);
 const stale=await makePage(owner);await go(stale,'/club-admin.html?stale=1#records');await wait(stale,'#club-records');
 await stale.waitForFunction(()=>document.querySelector('#records-list').textContent.includes('[EXAMPLE]'));
 await go(p,'/club-admin.html?constitution=1#constitution');
 const constitution=p.frameLocator('iframe[data-tool="constitution"]');
 await constitution.locator('[data-shared-constitution="save"]').waitFor({state:'visible'});
 await constitution.locator('#constitution-text').waitFor({state:'visible'});
 assert.match(await constitution.locator('#constitution-text').textContent(),/Sandy Sports Club \(example draft\)/);
 assert.equal(await constitution.locator('[data-shared-constitution="save"]').isDisabled(),true);
 assert.doesNotMatch(await constitution.locator('body').textContent(),/PRIVATE LOCAL SENTINEL/);
 await go(p,'/club-admin.html?studio=1#social');
 const studio=p.frameLocator('iframe[data-tool="social"]');
 await studio.locator('[data-annual-save]').waitFor({state:'attached'});
 await studio.locator('#studio-shared-status').waitFor({state:'visible'});
 assert.match(await studio.locator('#studio-shared-status').textContent(),/SYNTHETIC VIEW ONLY/);
 await studio.locator('[data-annual-save]:disabled').waitFor({state:'attached'});
 await studio.locator('#sandy-ideas-form button[type="submit"]:disabled').waitFor({state:'attached'});
 await studio.locator('#sandy-handoff-form button[type="submit"]:disabled').waitFor({state:'attached'});
 assert.equal(await studio.locator('#studio-legacy-transfer').count(),0);
 assert.doesNotMatch(await studio.locator('body').textContent(),/PRIVATE LOCAL SENTINEL/);
 assert.match(await p.evaluate(()=>localStorage.getItem('sandy-constitution-draft')),/PRIVATE LOCAL SENTINEL/);
 assert.match(await p.evaluate(()=>localStorage.getItem('sandy-social-ideas-v1')),/PRIVATE LOCAL SENTINEL/);
 await select(p,'webmaster');
 const staleResult=await stale.evaluate(async()=>{const {viewFetch}=await import('/club-view-client.js');const r=await viewFetch('/api/records');return {status:r.status,body:await r.text()}});
 assert.equal(staleResult.status,409);assert.doesNotMatch(staleResult.body,/PRIVATE LIVE SENTINEL/);await stale.close();
 await go(p,'/club-admin.html?restored=1#records');await wait(p,'#records-list .club-record-card');
 assert.match(await p.locator('#records-list').textContent(),/PRIVATE LIVE SENTINEL/);
 console.log('PASS: actual stock, meetings, restricted deep link, Constitution, Social Studio and stale-tab restoration');
 await select(p,'member');assert.match(await p.locator('#member-profile').textContent(),/Illustrative demo member/);
 assert.equal(await p.locator('#member-export').isDisabled(),true);
 await p.locator('#member-exit-view').click();await p.waitForURL('**/club-admin.html');await wait(p,'#club-console');await owner.close();
 const mobile=await context(null,{width:390,height:844}),m=await makePage(mobile);
 await go(m,'/club-login.html');await m.locator('#club-showcase-panel summary').click();
 await m.locator('#club-showcase-login input[name="key"]').fill(env.SANDY_SHOWCASE_KEY);
 await Promise.all([m.waitForNavigation({waitUntil:'domcontentloaded'}),m.locator('#club-showcase-login button[type="submit"]').click()]);
 await wait(m,'#club-console');assert.match(await m.locator('#club-status').textContent(),/SYNTHETIC VIEW ONLY/);
 assert.equal(await m.locator('#club-view-role-wrap').isHidden(),true);
 for(const d of SUITE_DESKS)await desk(m,d.key);
 console.log('PASS: independent phone-sized showcase navigated all '+SUITE_DESKS.length+' working desks with fictional records');
 await go(m,'/club-admin.html?accounts=1#accounts');await wait(m,'#account-rows tr');assert.equal(await m.locator('[data-office-invite],[data-account-action]').count(),0);
 await go(m,'/member-home.html?demo=1#sports');await wait(m,'#member-panel');assert.equal(await m.locator('#member-sport-preferences button[type="submit"]').isDisabled(),true);
 await go(m,'/club-admin.html?logout=1#overview');await wait(m,'#club-console');
 await m.locator('#club-exit-view').click();await m.waitForURL('**/club-login.html');
 assert.equal((await m.evaluate(async()=>await (await fetch('/api/session')).json())).authenticated,false);
 await mobile.close();
 assert.deepEqual(snapshot(live.sql),liveBefore,'all live fixture rows unchanged');
 assert.deepEqual(snapshot(showcase.sql),demoBefore,'all showcase fixture rows unchanged');
 assert.deepEqual(errors,[],'no uncaught browser JavaScript errors');
 console.log('PASS: both complete database snapshots unchanged and no uncaught browser errors');
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));live.sql.close();showcase.sql.close();rmSync(tmp,{recursive:true,force:true});
}
