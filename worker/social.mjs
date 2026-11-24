import {CAMPAIGN_LAYERS,defaultCampaignSettings} from '../studio/social-campaign-engine.js';
import {fail,json,now,dbFor,payload,field,version,requireRole,STAFF,revision,audit,changeSummary} from './shared.mjs';
const LAYER_IDS=CAMPAIGN_LAYERS.map(x=>x.id),LAYER_SET=new Set(LAYER_IDS);
const roles=['all','interested','supporters','founders','future-members','families','volunteers','clubs','member','adult','youth'];
const places=['all','local','regional','tourist','other'];
const genders=['all','women','men','self-described'];
const destinations=['youtube','facebook','instagram','tiktok','noticeboard'];
const dayTypes=['weekday','friday','weekend','longWeekend','publicHoliday','holiday'];
const date=s=>typeof s==='string'&&/^20\d\d-(0[1-9]|1[0-2])-[0-3]\d$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const month=s=>typeof s==='string'&&/^20\d\d-(0[1-9]|1[0-2])$/.test(s);
const time=s=>s==='auto'||typeof s==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
const obj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const uniqueAllowed=(values,allowed)=>Array.isArray(values)&&values.length>0&&values.length<=allowed.length&&
 new Set(values).size===values.length&&values.every(x=>allowed.includes(x))&&(!values.includes('all')||values.length===1);
function validSchedule(c){
 if(!obj(c)||!Number.isInteger(c.videoShare)||c.videoShare<0||c.videoShare>100||!time(c.postingTime))return false;
 if(!obj(c.limits)||!dayTypes.every(k=>{
  const a=c.limits[k+'Min'],b=c.limits[k];
  return Number.isInteger(a)&&a>=1&&a<=20&&Number.isInteger(b)&&b>=a&&b<=20;
 }))return false;
 if(!obj(c.layers)||Object.keys(c.layers).length!==LAYER_IDS.length)return false;
 for(const key of LAYER_IDS){
  const p=c.layers[key];if(!obj(p)||typeof p.enabled!=='boolean'||typeof p.visible!=='boolean'||!Number.isInteger(p.weekly)||p.weekly<0||p.weekly>7)return false;
  if(!obj(p.audience)||!uniqueAllowed(p.audience.membership,roles)||!uniqueAllowed(p.audience.gender,genders)||!uniqueAllowed(p.audience.place,places))return false;
 }
 if(!obj(c.delivery)||typeof c.delivery.paidPlanning!=='boolean')return false;
 for(const k of ['organic','paid'])if(!Array.isArray(c.delivery[k])||new Set(c.delivery[k]).size!==c.delivery[k].length||
  c.delivery[k].some(x=>!destinations.includes(x)))return false;
 return true;
}
function cleanSignatures(next,previous,identity,at){
 for(const [dateKey,day] of Object.entries(next.dayPlans||{})){
  const before=previous?.dayPlans?.[dateKey];
  const same=before&&JSON.stringify({patternId:before.patternId,items:before.items})===
   JSON.stringify({patternId:day.patternId,items:day.items});
  if(same&&before.signature){day.signature=before.signature;continue}
  if(same){delete day.signature;continue}
  const previousSignature=before?.signature;
  day.signature={
   preparedBy:previousSignature?.preparedBy||identity.name,
   preparedOffice:previousSignature?.preparedOffice||identity.office_label,
   preparedAt:previousSignature?.preparedAt||at,
   editedBy:identity.name,editedOffice:identity.office_label,editedAt:at
  };
 }
}
function validateSettings(c){
 const invalid=()=>fail(400,'The campaign settings are incomplete or contain an invalid pattern.','invalid_settings');
 if(!obj(c)||JSON.stringify(c).length>950000||!validSchedule(c))invalid();
 for(const [kind,max,check] of [
  ['monthOverrides',24,month],
  ['weekOverrides',80,s=>date(s)&&new Date(s+'T00:00:00Z').getUTCDay()===1],
  ['dayOverrides',366,date]]){
  if(!obj(c[kind])||Object.keys(c[kind]).length>max)invalid();
  for(const [key,config] of Object.entries(c[kind]))if(!check(key)||!validSchedule(config))invalid();
 }
 if(!obj(c.timingSignals)||Object.keys(c.timingSignals).length>12)invalid();
 const signalKinds=['holidays','nswHolidays','event','meeting','programme_open','programme_close'];
 for(const [name,signal] of Object.entries(c.timingSignals)){
  if(!signalKinds.includes(name)||!obj(signal)||typeof signal.enabled!=='boolean'||!Array.isArray(signal.leadDays)||
   signal.leadDays.length>12||new Set(signal.leadDays).size!==signal.leadDays.length||
   signal.leadDays.some(n=>!Number.isInteger(n)||n<1||n>365))invalid();
 }
 if(!Array.isArray(c.milestones)||c.milestones.length>80)invalid();
 const seen=new Set();
 for(const m of c.milestones){
  if(!obj(m)||typeof m.id!=='string'||m.id.length>96||seen.has(m.id)||!signalKinds.includes(m.kind)||
   typeof m.title!=='string'||m.title.length<3||m.title.length>140||!date(m.date)||typeof m.confirmed!=='boolean'||
   typeof m.sourceUrl!=='string'||m.sourceUrl.length>700)invalid();
  if(m.sourceUrl&&(!m.sourceUrl.startsWith('https://')||/\s/.test(m.sourceUrl)))invalid();
  seen.add(m.id);
 }
 if(!obj(c.dayPlans)||Object.keys(c.dayPlans).length>366)invalid();
 const slotsOk=items=>Array.isArray(items)&&items.length>=1&&items.length<=20&&new Set(items.map(i=>i.id)).size===items.length&&
  items.every(x=>obj(x)&&typeof x.id==='string'&&x.id.length<=60&&LAYER_SET.has(x.layerId)&&
   ['video','image','carousel','link'].includes(x.format)&&time(x.time)&&x.time!=='auto'&&
   typeof x.title==='string'&&x.title.length>0&&x.title.length<=180&&
   typeof x.brief==='string'&&x.brief.length<=4000);
 for(const [key,plan] of Object.entries(c.dayPlans)){
  if(!date(key)||!obj(plan)||typeof plan.patternId!=='string'||plan.patternId.length>100||!slotsOk(plan.items))invalid();
  delete plan.signature; // supplied officer signatures are NEVER accepted from the browser.
 }
 if(!obj(c.dayArchetypes)||Object.keys(c.dayArchetypes).length>6)invalid();
 for(const [key,presets] of Object.entries(c.dayArchetypes)){
  if(!dayTypes.includes(key)||!Array.isArray(presets)||presets.length>8)invalid();
  for(const preset of presets)if(!obj(preset)||typeof preset.id!=='string'||preset.id.length>90||
    typeof preset.name!=='string'||preset.name.length>75||!slotsOk(preset.items))invalid();
 }
 return c;
}
const officeLabel=identity=>identity.office_label||identity.role;
async function one(db,table){
 return db.prepare('SELECT version,'+(table==='studio_settings'?'settings_json':table==='studio_metrics'?'metrics_json':'edits_json')+' AS data,updated_utc AS updatedAt,updated_by AS updatedBy FROM '+table+' WHERE id=1').first();
}
async function history(db,kind,rev=null){
 const where=rev===null?'':" AND resource_version=?";
 const q=await db.prepare('SELECT resource_version AS version,at_utc AS savedAt,actor_id AS actorId,actor_role AS actorRole,actor_office AS actorOffice,changes_json AS changes'+
  (rev!==null?',snapshot_json AS settings':'')+
  " FROM club_revisions WHERE resource_kind=? AND resource_id='sandy-social'"+where+' ORDER BY resource_version DESC LIMIT '+(rev!==null?1:50))
   .bind(...(rev===null?[kind]:[kind,rev])).all();
 return (q.results||[]).map(row=>({...row,changes:JSON.parse(row.changes),...(row.settings?{settings:JSON.parse(row.settings)}:{})}));
}
export async function socialEndpoint(req,env,path,identity){
 requireRole(identity,STAFF);const db=dbFor(env),url=new URL(req.url),isEdits=path==='/api/committee/social-post-edits',isMetrics=path==='/api/committee/social-metrics';
 if(!isEdits&&!isMetrics&&path!=='/api/committee/social-campaign-settings')fail(404,'This Social Studio endpoint does not exist.','not_found');
 const table=isEdits?'studio_post_edits':isMetrics?'studio_metrics':'studio_settings',kind=isEdits?'social-edits':isMetrics?'social-metrics':'social-settings';
 const present=await one(db,table);
 if(req.method==='GET'){
  if(url.searchParams.get('history')==='1'){
   return json({version:present?.version||0,history:await history(db,kind)});
  }
  const revisionRequested=url.searchParams.get('version');
  if(revisionRequested){
   const requested=version(Number(revisionRequested));if(!requested)fail(400,'Use a positive revision number.','invalid_version');
   const rows=await history(db,kind,requested);
   if(!rows.length)fail(404,'That server revision was not found.','missing_revision');
   return json({revision:rows[0]});
  }
  const result=present?JSON.parse(present.data):null;
  return json({version:present?.version||0,
   ...(isEdits?{edits:result||{}}:isMetrics?{metrics:result||[]}:{settings:result}),
   updatedAt:present?.updatedAt||null,updatedBy:present?.updatedBy||null,
   updatedByName:present?.updatedBy||null,updatedOffice:present?officeLabel(identity):null});
 }
 if(req.method!=='POST')fail(405,'Use GET or POST for shared planning records.','method_not_allowed');
 if(identity.role==='webmaster_demo')fail(403,'The demo webmaster cannot save shared club data.','read_only');
 const b=await payload(req,isMetrics?800000:isEdits?450000:1050000),previous=present?JSON.parse(present.data):null;
 const expected=version(b.version);
 if((present?.version||0)!==expected)fail(409,'Another officer saved a newer version. Reload before editing.','revision_conflict');
 let next;
 if(isMetrics){
  if(!Array.isArray(b.metrics)||b.metrics.length>10000||JSON.stringify(b.metrics).length>750000||
     b.metrics.some(item=>!obj(item)||Object.keys(item).length>35||Object.values(item).some(v=>typeof v==='string'&&v.length>1200)))
    fail(400,'The imported performance metrics are invalid or too large.','invalid_metrics');
  next=b.metrics;
 }else if(isEdits){
  if(!obj(b.edits)||JSON.stringify(b.edits).length>400000||Object.keys(b.edits).length>10000)
   fail(400,'The post edit register is too large or invalid.','invalid_post_edits');
  for(const [key,edit] of Object.entries(b.edits)){
   if(key.length>180||!obj(edit)||Object.keys(edit).length>12||
    Object.values(edit).some(x=>typeof x==='string'&&x.length>6000))
    fail(400,'Invalid post edit record.','invalid_post_edit');
  }
  next=b.edits;
 }else{
  next=validateSettings(b.settings);
  cleanSignatures(next,previous,identity,now());
 }
 const at=now(),encoded=JSON.stringify(next),newVersion=expected+1;
 const write=expected===0?
  db.prepare('INSERT INTO '+table+'(id,version,'+(isEdits?'edits_json':isMetrics?'metrics_json':'settings_json')+',updated_by,updated_utc) SELECT 1,1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM '+table+' WHERE id=1)')
   .bind(encoded,identity.id,at):
  db.prepare('UPDATE '+table+' SET version=version+1,'+(isEdits?'edits_json':isMetrics?'metrics_json':'settings_json')+'=?,updated_by=?,updated_utc=? WHERE id=1 AND version=?')
   .bind(encoded,identity.id,at,expected);
 const [result]=await db.batch([
  write,
  revision(db,{kind,resourceId:'sandy-social',resourceVersion:newVersion,action:'saved',actor:identity,at,snapshot:next,
   changes:changeSummary(previous||{},next),guarded:true}),
  audit(db,identity,'shared_social_saved',kind,'sandy-social',at,true)
 ]);
 if(!result.meta.changes)fail(409,'The shared plan changed during saving. Refresh its latest version.','revision_conflict');
 return json({version:newVersion,...(isEdits?{edits:next}:isMetrics?{metrics:next}:{settings:next}),
  updatedAt:at,updatedBy:identity.id,updatedByName:identity.name,updatedOffice:officeLabel(identity),
  lastChange:changeSummary(previous||{},next)});
}
