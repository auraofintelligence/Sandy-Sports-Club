// Dedicated committee noticeboard and officer work lists on the existing
// Sandy record store. No real appointment, email, payment or approval.
import {STAFF,requireRole,dbFor,fail,json,payload,field,dateField,version,now,id,revision,audit} from './shared.mjs';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {suiteBody,suiteAllowed,visibleRecords,taskAllocators,genericAllowed} from './record-policy.mjs';
const notices=SUITE_BY_KEY.notices,todos=SUITE_BY_KEY.todos;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const officeLabels={webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee officer'};
const label=key=>officeLabels[key]||'Unallocated';
const day=stamp=>new Date(Date.parse(stamp)+36000000).toISOString().slice(0,10);
const plus=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const allocator=actor=>taskAllocators.includes(actor.role);
const closed=row=>['completed','archived','rejected','approved'].includes(row.status);
const normalize=s=>String(s||'').toLowerCase().replace(/^example\s+|^fictional\s+|^proposed\s+/g,'').replace(/[^a-z]/g,'');
function legacyOffice(s){return STAFF.find(k=>normalize(k)===normalize(s)||normalize(label(k))===normalize(s))||''}
function taskOffice(body){return body.committeeOps?.office??legacyOffice(body.fields.owner)}
function assertId(value){if(typeof value!=='string'||!uuid.test(value))fail(400,'Choose a valid working record identifier.','invalid_id');return value}
async function stableId(value){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sandy-committee-v1/'+value))).slice(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
const dateOrEmpty=x=>x?dateField(x,false):'';
const string=(x,n)=>field(x,n);
const failConflict=()=>fail(409,'This working record changed. Refresh and try again.','committee_conflict');
const rowById=(db,key)=>db.prepare('SELECT * FROM club_records WHERE id=?').bind(key).first();
async function entries(db,desk,identity,limit=1000){
 return visibleRecords(db,"WHERE kind=? AND json_extract(body_json,'$.sandySuiteVersion')=1 AND json_extract(body_json,'$.domain')=?",[desk.kind,desk.key],'updated_utc DESC,id DESC',limit,r=>suiteAllowed(r,desk,identity));
}
async function legacy(db,desk,actor){
 const rows=await visibleRecords(db,"WHERE kind=? AND json_extract(body_json,'$.source')='sandy-committee-room-v1' AND json_extract(body_json,'$.desk')=?",[desk.kind,desk.key],'updated_utc DESC,id DESC',100,r=>genericAllowed(r,actor));
 return rows.map(r=>{const b=JSON.parse(r.body_json);return {id:r.id,title:r.title,details:b.notes||'',owner:b.owner||'',updatedAt:r.updated_utc,status:r.status}});
}
const timing=(due,today,review=false)=>!due?'undated':due<today?(review?'stale':'overdue'):due===today?(review?'stale':'dueToday'):due<=plus(today,7)?(review?'reviewSoon':'dueSoon'):'current';
function canComplete(actor,body){
 const office=taskOffice(body),claimed=body.committeeOps?.claimedBy;
 return Boolean(office&&office===actor.role&&(!claimed||claimed===actor.id));
}
const canSeeTask=(row,body,actor)=>suiteAllowed(row,todos,actor)&&(allocator(actor)||!taskOffice(body)||canComplete(actor,body));
const requestKey=values=>JSON.stringify(values);
function newRecord(db,key,kind,title,body,status,eventDate,actor,at,extraWhere='',args=[]){
 return db.prepare('INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,?,?,?,?,?,1,?,?,?,? '+extraWhere+' ON CONFLICT(id) DO NOTHING').bind(key,kind,title,JSON.stringify(body),status,eventDate||null,actor.id,actor.id,at,at,...args);
}
function historyWrites(db,actor,at,key,v,operation,snapshot,changes={}){
 return [revision(db,{kind:'record',resourceId:key,resourceVersion:v,action:operation,actor,at,snapshot,changes,guarded:true}),audit(db,actor,operation,'record',key,at,true,{fromVersion:v-1,toVersion:v})];
}
function taskBody({title,details,office,due,noticeId=null,key='',claimedBy=null,extra={}}){
 return {sandySuiteVersion:1,domain:'todos',fields:{action:title,owner:office?label(office):'',dueDate:due,priority:'Normal',linkedDesk:noticeId||'',progress:details,complete:false},committeeOps:{version:1,kind:'task',office,noticeId,request:key,claimedBy,...extra}};
}
function noticeBody({title,details,recipients,important,review,due,office,taskId,key}){
 return {sandySuiteVersion:1,domain:'notices',fields:{subject:title,audience:recipients.length===STAFF.length?'All proposed officers':'Office holders',message:details,dueDate:due||review,responseOwner:office?label(office):'',responses:'',clearedForDiscussion:false},committeeOps:{version:1,kind:'notice',noticeType:taskId?'action':'info',recipients,important,reviewDate:review,taskId,request:key}};
}
function noticeRecipients(scope,actor){
 if(scope==='all')return [...STAFF];
 if(scope==='leadership')return ['webmaster','president','vice_president','secretary','assistant_secretary'];
 if(STAFF.includes(scope))return [scope];
 fail(400,'Choose a recipient office or group.','invalid_scope');
}
function scopeOffice(office,actor,{unallocated=false}={}){
 if(office===''&&unallocated&&allocator(actor))return '';
 if(!STAFF.includes(office))fail(400,'Choose an officer seat.','invalid_office');
 if(office!==actor.role&&!allocator(actor))fail(403,'Only the Secretary, Assistant Secretary or Webmaster may allocate jobs to another office.','office_forbidden');
 return office;
}
function managers(row,actor){return row.created_by===actor.id||allocator(actor)}
async function replayCreate(db,key,desk,actor,signature){
 const row=await rowById(db,key);if(!row)return false;
 const b=suiteBody(row,desk);
 if(b?.committeeOps?.request===signature&&row.created_by===actor.id)return true;
 failConflict();
}
async function postNotice(db,actor,b,at,today){
 const key=assertId(b.id),title=string(b.title,180),details=string(b.details,9000);
 if(!title||!details)fail(400,'Enter a title and notice text.','missing_notice');
 if(!['info','action'].includes(b.kind)||typeof b.important!=='boolean')fail(400,'Choose an update or action and its importance.','invalid_notice');
 const recipients=noticeRecipients(b.scope||'all',actor),isTask=b.kind==='action';
 const office=isTask?scopeOffice(b.office,actor):'',due=isTask?dateField(b.dueDate,false):'',review=isTask?'':dateOrEmpty(b.reviewDate)||plus(today,30);
 if(isTask&&!recipients.includes(office))fail(400,'The responsible office must be included in the notice audience.','notice_scope');
 const signature=requestKey([title,details,b.kind,recipients,b.important,office,due,b.reviewDate||'']);
 if(await replayCreate(db,key,notices,actor,signature))return;
 const taskId=isTask?await stableId('notice-task/'+key):null;
 const body=noticeBody({title,details,recipients,important:b.important,review,due,office,taskId,key:signature});
 const writes=[newRecord(db,key,'notice',title,body,'draft',due||review,actor,at,isTask?'WHERE NOT EXISTS(SELECT 1 FROM club_records WHERE id=?)':'WHERE 1',isTask?[taskId]:[]),...historyWrites(db,actor,at,key,1,'committee_notice_posted',body,{noticeType:b.kind})];
 if(isTask){
  const tb=taskBody({title,details,office,due,noticeId:key,key:signature});
  // Only attach to an exact newly written notice, never a colliding unrelated ID.
  writes.push(newRecord(db,taskId,'task',title,tb,'draft',due,actor,at,"WHERE EXISTS(SELECT 1 FROM club_records WHERE id=? AND created_by=? AND version=1 AND body_json=?)",[key,actor.id,JSON.stringify(body)]),...historyWrites(db,actor,at,taskId,1,'committee_notice_task_created',tb,{noticeId:key}));
 }
 const results=await db.batch(writes);
 if(!results[0].meta.changes){if(await replayCreate(db,key,notices,actor,signature))return;failConflict()}
 if(isTask&&!results[3].meta.changes)fail(500,'The notice job did not attach. Contact Webmaster.','notice_task_failed');
}
async function receipt(db,actor,row,seen,at){
 if(seen>row.version||seen<1)failConflict();
 const key=await stableId('seen/'+actor.id+'/'+row.id),body={sandyCommitteeReceipt:1,ownerId:actor.id,noticeId:row.id,seenVersion:seen};
 await db.batch([
  db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'notice','Private notice read receipt',?,'completed',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body_json=excluded.body_json,version=excluded.version,updated_utc=excluded.updated_utc WHERE club_records.created_by=excluded.created_by AND json_extract(club_records.body_json,'$.sandyCommitteeReceipt')=1 AND json_extract(club_records.body_json,'$.noticeId')=? AND club_records.version<excluded.version")
   .bind(key,JSON.stringify(body),seen,actor.id,actor.id,at,at,row.id),
  ...historyWrites(db,actor,at,key,seen,'committee_notice_seen',{seenVersion:seen},{})
 ]);
}
async function mutateRow(db,row,body,actor,at,operation,changes,status=row.status,eventDate=row.event_date,guard='',args=[]){
 const v=row.version+1;
 const result=await db.batch([
  db.prepare('UPDATE club_records SET body_json=?,status=?,event_date=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? '+guard).bind(JSON.stringify(body),status,eventDate||null,actor.id,at,row.id,row.version,...args),
  ...historyWrites(db,actor,at,row.id,v,operation,{title:row.title,status,...body},changes)
 ]);
 if(!result[0].meta.changes)failConflict();
}
async function mutationRetry(db,key,actor,operation,v,signature){
 const prior=await db.prepare("SELECT operation,actor_id,changes_json FROM club_revisions WHERE resource_kind='record' AND resource_id=? AND resource_version=?").bind(key,v+1).first();
 if(!prior)return false;
 if(prior.operation===operation&&prior.actor_id===actor.id&&JSON.parse(prior.changes_json).request===signature)return true;
 failConflict();
}
async function changeNotice(db,actor,b,at,today){
 const key=assertId(b.id),row=await rowById(db,key),body=suiteBody(row,notices),expected=version(b.version);
 if(!body||!suiteAllowed(row,notices,actor))fail(404,'Notice not found.','not_found');
 if(b.action==='seen'){await receipt(db,actor,row,expected,at);return}
 if(!managers(row,actor))fail(403,'Ask the author, Secretary or Webmaster to update this notice.','notice_forbidden');
 const existing=body.committeeOps||{version:1,kind:'notice',noticeType:'info',recipients:[...STAFF],important:false,reviewDate:body.fields.dueDate||plus(day(row.created_utc),30),taskId:null};
 const operation='committee_notice_'+b.action,requested=b.action==='review'?dateOrEmpty(b.reviewDate):'',signature=requestKey([b.action,requested]);
 if(expected!==row.version){if(await mutationRetry(db,key,actor,operation,expected,signature))return;failConflict()}
 if(row.status==='archived'||row.status==='approved')failConflict();
 if(b.action==='review'){
  if(existing.noticeType!=='info')fail(400,'Complete the linked task in Officer to-do lists.','notice_task');
  const review=requested||plus(today,30);if(review<=today)fail(400,'Choose a future review date.','notice_review_date');
  await mutateRow(db,row,{...body,fields:{...body.fields,dueDate:review},committeeOps:{...existing,reviewDate:review}},actor,at,operation,{request:signature},row.status,review);return;
 }
 if(b.action!=='archive')fail(400,'Choose a notice action.','invalid_action');
 if(existing.taskId){
  const linked=await rowById(db,existing.taskId),tb=suiteBody(linked,todos);
  if(!tb||!tb.fields.complete||linked.status!=='completed')fail(409,'Complete the linked officer task before archiving this notice.','notice_open_job');
  await mutateRow(db,row,{...body,committeeOps:existing},actor,at,operation,{request:signature},'archived',row.event_date,"AND EXISTS(SELECT 1 FROM club_records WHERE id=? AND version=? AND status='completed')",[linked.id,linked.version]);return;
 }
 await mutateRow(db,row,{...body,committeeOps:existing},actor,at,operation,{request:signature},'archived');
}
async function board(db,actor,today,archive){
 const rows=await entries(db,notices,actor),receipts=await db.prepare("SELECT body_json FROM club_records WHERE kind='notice' AND created_by=? AND json_extract(body_json,'$.sandyCommitteeReceipt')=1").bind(actor.id).all();
 const seen=new Map((receipts.results||[]).map(r=>{const b=JSON.parse(r.body_json);return [b.noticeId,b.seenVersion]}));
 const accounts=await db.prepare('SELECT id,office_label,role FROM club_accounts').all(),author=new Map(accounts.results.map(a=>[a.id,a.office_label||label(a.role)]));
 const all=[];
 for(const row of rows){
  const b=suiteBody(row,notices),o=b.committeeOps||{},task=o.taskId?await rowById(db,o.taskId):null,tb=task?suiteBody(task,todos):null;
  const complete=Boolean(tb&&task.status==='completed'&&tb.fields.complete===true),archived=row.status==='archived',action=o.noticeType==='action';
  const review=o.reviewDate||b.fields.dueDate||plus(day(row.created_utc),30),due=action?(tb?.fields.dueDate||b.fields.dueDate||''):'';
  const state=archived?'archived':complete?'done':timing(action?due:review,today,!action);
  const unread=!archived&&row.updated_by!==actor.id&&(seen.get(row.id)||0)<row.version;
  all.push({id:row.id,title:row.title,details:b.fields.message||'',version:row.version,author:author.get(row.created_by)||'Former office holder',createdAt:row.created_utc,updatedAt:row.updated_utc,
   noticeType:action?'action':'info',important:Boolean(o.important),recipients:o.recipients||[...STAFF],taskId:o.taskId||null,office:tb?taskOffice(tb):'',dueDate:due,reviewDate:action?'':review,status:state,unread,legacy:!b.committeeOps,canReview:!action&&!archived&&row.status!=='approved'&&managers(row,actor),canArchive:!archived&&row.status!=='approved'&&managers(row,actor)&&(!action||complete)});
 }
 const active=all.filter(x=>x.status!=='archived');
 const counts={unread:active.filter(x=>x.unread).length,amber:active.filter(x=>['dueSoon','dueToday','reviewSoon','stale'].includes(x.status)).length,red:active.filter(x=>x.status==='overdue').length};
 return {today,counts,notices:all.filter(x=>archive?x.status==='archived':x.status!=='archived'),viewerOffice:actor.role,canAssign:allocator(actor),offices:STAFF.map(key=>({key,label:label(key)})),legacy:await legacy(db,notices,actor)};
}
const duties={
 webmaster:['Maintain access controls and review Webmaster requests','Check role previews, release status and private record integrity'],
 president:['Prepare chairing and governance review','Review proposed community programme and committee priorities'],
 vice_president:['Support the President and coordinate cross-town participation','Review volunteer and event readiness'],
 secretary:['Maintain draft minutes, notices, officer task lists and meeting calendar','Review the monthly Social Studio plan and source event dates'],
 assistant_secretary:['Prepare meeting material and returned officer work lists','Review notice deadlines and unresolved actions'],
 treasurer:['Review proposed AUD budgets, equipment and fundraising records','Reconcile stock, receipts and outstanding costs'],
 committee:['Contribute to proposed activities and take practical assigned jobs','Check site, safety and volunteer requirements before commitments']
};
async function monthlyKey(today){return stableId('monthly-secretary-social/'+today.slice(0,7))}
const monthlyDue=today=>new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),0)).toISOString().slice(0,10);
async function taskList(db,actor,today,filter){
 if(filter&&filter!=='all'&&filter!=='unallocated'&&!STAFF.includes(filter))fail(400,'Choose an officer seat.','invalid_office');
 if(filter&&filter!==actor.role&&filter!=='unallocated'&&filter!=='all'&&!allocator(actor))fail(403,'Your sign-in opens your own officer list.','office_forbidden');
 const rows=await entries(db,todos,actor),result=[];
 for(const row of rows){
  const b=suiteBody(row,todos);if(!canSeeTask(row,b,actor))continue;
  const o=b.committeeOps||{},office=taskOffice(b),done=row.status==='completed'||b.fields.complete===true,archived=['archived','rejected','approved'].includes(row.status);
  if(filter&&filter!=='all'&&(filter==='unallocated'?Boolean(office):office!==filter))continue;
  result.push({id:row.id,title:row.title,details:b.fields.progress||'',office,ownerText:b.fields.owner||'',dueDate:b.fields.dueDate||'',version:row.version,source:o.noticeId?'notice':b.sourceMeeting?'meeting':o.monthly?'monthly':'manual',sourceId:o.noticeId||b.sourceMeeting||null,done,archived,legacy:!b.committeeOps,status:done?'done':archived?'archived':timing(b.fields.dueDate,today),completion:o.completion||null,canAssign:allocator(actor)&&!closed(row)&&!done,canTake:!office&&!closed(row)&&!done,canComplete:canComplete(actor,b)&&!closed(row)&&!done,canPaper:allocator(actor)&&Boolean(office)&&!closed(row)&&!done});
 }
 const key=await monthlyKey(today);
 if((allocator(actor)||actor.role==='secretary')&&(!filter||filter==='all'||filter==='secretary')&&!await rowById(db,key)){
  result.push({id:key,title:'Review the monthly Social Studio plan',details:'Check island event anchors, review dates and the proposed editorial programme. No external publication is authorised.',office:'secretary',dueDate:monthlyDue(today),version:0,source:'monthly',sourceId:null,done:false,archived:false,legacy:false,status:timing(monthlyDue(today),today),canAssign:false,canTake:false,canComplete:actor.role==='secretary',canPaper:allocator(actor)});
 }
 result.sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.title.localeCompare(b.title));
 return {today,viewerOffice:actor.role,canAssign:allocator(actor),offices:STAFF.filter(k=>allocator(actor)||k===actor.role).map(key=>({key,label:label(key),duties:duties[key]})),tasks:result,legacy:await legacy(db,todos,actor)};
}
async function addTask(db,actor,b,at){
 const key=assertId(b.id),title=string(b.title,180),details=string(b.details,9000),office=scopeOffice(b.office,actor,{unallocated:true}),due=dateOrEmpty(b.dueDate);
 if(!title)fail(400,'Enter an action.','missing_task');
 const signature=requestKey([title,details,office,due]);
 if(await replayCreate(db,key,todos,actor,signature))return;
 const body=taskBody({title,details,office,due,key:signature});
 const results=await db.batch([newRecord(db,key,'task',title,body,'draft',due,actor,at,'WHERE 1'),...historyWrites(db,actor,at,key,1,'committee_task_added',body,{office})]);
 if(!results[0].meta.changes&&!await replayCreate(db,key,todos,actor,signature))failConflict();
}
async function monthlyComplete(db,actor,b,at,today){
 if(b.action!=='complete'||b.version!==0||b.id!==await monthlyKey(today)||typeof b.paper!=='boolean')fail(400,'Choose the current monthly work item.','invalid_task');
 if(b.paper?!allocator(actor):actor.role!=='secretary')fail(403,'Only the Secretary or an authorised paper-list recorder can complete this duty.','office_forbidden');
 const signature=requestKey(['monthly',today.slice(0,7),b.paper]),key=b.id,title='Review the monthly Social Studio plan';
 if(await replayCreate(db,key,todos,actor,signature))return;
 const body=taskBody({title,details:'Monthly standard duty',office:'secretary',due:monthlyDue(today),key:signature,extra:{monthly:true,completion:{at,by:actor.office_label||label(actor.role),paper:b.paper}}});
 body.fields.complete=true;
 const results=await db.batch([newRecord(db,key,'task',title,body,'completed',body.fields.dueDate,actor,at,'WHERE 1'),...historyWrites(db,actor,at,key,1,'committee_task_completed',body,{paper:b.paper,office:'secretary'})]);
 if(!results[0].meta.changes&&!await replayCreate(db,key,todos,actor,signature))failConflict();
}
async function changeTask(db,actor,b,at,today){
 const key=assertId(b.id);
 if(b.version===0){await monthlyComplete(db,actor,b,at,today);return}
 const row=await rowById(db,key),body=suiteBody(row,todos),expected=version(b.version);
 if(!body||!canSeeTask(row,body,actor))fail(404,'Officer task not found in your list.','not_found');
 if(!['assign','take','complete'].includes(b.action))fail(400,'Choose a task action.','invalid_action');
 if(b.action==='complete'&&typeof b.paper!=='boolean')fail(400,'Choose how completion was recorded.','invalid_task');
 const operation='committee_task_'+b.action,office=taskOffice(body),o=body.committeeOps||{version:1,kind:'task',office,noticeId:null,claimedBy:null,request:''},signature=requestKey([b.action,b.office||'',b.paper===true]);
 if(expected!==row.version){if(await mutationRetry(db,key,actor,operation,expected,signature))return;failConflict()}
 if(closed(row)||body.fields.complete)failConflict();
 let nextOffice=office,claimedBy=o.claimedBy||null;
 if(b.action==='assign'){
  if(!allocator(actor))fail(403,'Only an authorised officer allocates jobs across offices.','office_forbidden');
  nextOffice=scopeOffice(b.office,actor,{unallocated:true});claimedBy=null;
  if(o.noticeId){const notice=await rowById(db,o.noticeId),nb=suiteBody(notice,notices);if(!nb?.committeeOps?.recipients?.includes(nextOffice))fail(409,'This linked notice must include the assigned office.','notice_scope')}
 }else if(b.action==='take'){
  if(office)fail(409,'This job is already allocated. Ask the responsible officer to update it.','task_allocated');
  nextOffice=actor.role;claimedBy=actor.id;
 }else if(b.paper?!allocator(actor)||!office:!canComplete(actor,body))fail(403,'Complete your own task or record a returned paper sheet as an authorised officer.','office_forbidden');
 const done=b.action==='complete',next={...body,fields:{...body.fields,owner:nextOffice?label(nextOffice):'',complete:done},committeeOps:{...o,office:nextOffice,claimedBy,...(done?{completion:{at,by:actor.office_label||label(actor.role),paper:b.paper}}:{})}};
 await mutateRow(db,row,next,actor,at,operation,{request:signature,office:nextOffice,paper:b.paper===true},done?'completed':row.status);
}
export async function committeeOpsEndpoint(req,env,path,actor){
 requireRole(actor,STAFF);
 if(!['GET','POST'].includes(req.method))fail(405,'Open the committee workspace.','method_not_allowed');
 const db=dbFor(env),at=now(),today=day(at),params=new URL(req.url).searchParams,notice=path==='/api/committee/notices';
 if(req.method==='POST'){
  if(params.size)fail(400,'Submit a working action without filters.','invalid_filter');
  const b=await payload(req,20000);
  if(notice){if(b.action==='post')await postNotice(db,actor,b,at,today);else if(['seen','review','archive'].includes(b.action))await changeNotice(db,actor,b,at,today);else fail(400,'Choose a notice action.','invalid_action')}
  else {if(b.action==='add')await addTask(db,actor,b,at);else await changeTask(db,actor,b,at,today)}
 }
 if(notice){
  if([...params].some(([k,v])=>!['archive','summary'].includes(k)||v!=='1')||params.size>1)fail(400,'Choose the current board or archive.','invalid_filter');
  const view=await board(db,actor,today,params.has('archive'));return json(params.has('summary')?{today,counts:view.counts}:view);
 }
 if([...params.keys()].some(k=>k!=='office')||params.size>1)fail(400,'Choose an officer list.','invalid_filter');
 return json(await taskList(db,actor,today,params.get('office')));
}
