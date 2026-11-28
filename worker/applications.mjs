// Membership and volunteer applications (MEM-01). Interest, application, review,
// recommendation, formal decision, withdrawal and rejection are separate steps.
// Personal details stay in the private people register; the Applications desk record
// carries only a reference and workflow state. Public applications are switched off
// unless SANDY_APPLICATIONS_ENABLED=enabled. Acceptance needs the formal authority gate
// and leaves the person "pending": no account, invitation, activation or payment here.
import {fail,json,now,dbFor,payload,field,bool,version,requireRole,ensureMemberData,ensureApprover,https,revision,audit,ACCESS_GROUPS} from './shared.mjs';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {suiteBody,suiteAllowed,visibleRecords} from './record-policy.mjs';
import {stableId,writeRecord,commit} from './meetings.mjs';
import {verifyTurnstile} from './people.mjs';
const desk=SUITE_BY_KEY.applications;
const PATHWAYS=desk.fields.find(f=>f.key==='applicationKind').options;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const OPEN=['received','under_review','recommended_accept','recommended_decline'];
const NEXT={received:['under_review','withdrawn'],under_review:['recommended_accept','recommended_decline','withdrawn'],
 recommended_accept:['accepted_pending','declined','under_review','withdrawn'],recommended_decline:['accepted_pending','declined','under_review','withdrawn'],
 accepted_pending:[],declined:[],withdrawn:[]};
const PERSON_STATUS={accepted_pending:'pending',declined:'inactive',withdrawn:'withdrawn'};
export const applicationsOpen=env=>env.SANDY_APPLICATIONS_ENABLED==='enabled';
const brisbaneToday=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
const reference=id=>'APP-'+id.slice(0,6).toUpperCase();
const memberData=actor=>ACCESS_GROUPS.memberRecords.includes(actor.role);
function inserts(db,actor,{appId,personId,person,pathway,source,interestId=null}){
 const at=now(),ref=reference(appId),actorId=actor.id;
 const body={sandySuiteVersion:1,domain:'applications',fields:{applicationKind:pathway,reference:ref,received:brisbaneToday(),reviewer:'',checks:'',decisionNotes:''},
  application:{state:'received',personId,source,interestId,history:[{state:'received',at,by:actor.office_label||actor.role}],fee:'Not set: membership classes and fees are for the owner to decide'}};
 return {ref,statements:[
  db.prepare("INSERT INTO club_people(id,full_name,email,mobile,membership_class,status,town,audience_region,consent_contact,consent_publication,source,notes,version,created_by,updated_by,created_utc,updated_utc) SELECT ?,?,?,?,?,'applicant',?,?,1,0,?,?,1,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM club_people WHERE id=?)")
   .bind(personId,person.name,person.email,person.mobile||'',person.membershipClass||'interested',person.town||'',person.region||'other','application:'+ref,person.statement||'',actorId,actorId,at,at,personId),
  db.prepare("INSERT INTO club_records(id,kind,title,body_json,status,event_date,version,created_by,updated_by,created_utc,updated_utc) VALUES(?,'volunteer',?,?,'proposal',?,1,?,?,?,?) ON CONFLICT(id) DO NOTHING")
   .bind(appId,'Application '+ref,JSON.stringify(body),brisbaneToday(),actorId,actorId,at,at),
  revision(db,{kind:'record',resourceId:appId,resourceVersion:1,action:'application_received',actor,at,snapshot:body,changes:{source,fromVersion:0,toVersion:1},guarded:true}),
  audit(db,actor,'application_received','record',appId,at,true,{fromVersion:0,toVersion:1}),
  ...(interestId?[db.prepare('UPDATE club_interest SET reviewed_utc=COALESCE(reviewed_utc,?),reviewed_by=COALESCE(reviewed_by,?) WHERE id=?').bind(at,actorId,interestId)]:[])]};
}
async function openByEmail(db,email){
 return db.prepare("SELECT r.id FROM club_people p JOIN club_records r ON r.kind='volunteer' AND json_extract(r.body_json,'$.application.personId')=p.id WHERE lower(p.email)=lower(?) AND json_extract(r.body_json,'$.application.state') IN ('received','under_review','recommended_accept','recommended_decline') LIMIT 1").bind(email).first();
}
async function publicApply(req,env){
 if(!applicationsOpen(env))fail(503,'Membership applications are not open yet. You can register interest instead.','applications_not_open');
 if(!env.SANDY_TURNSTILE_SECRET)fail(503,'Applications need verification that is not yet configured.','registration_not_ready');
 const b=await payload(req,12000);
 if(!bool(b.contactConsent)||!bool(b.privacyConsent))fail(400,'Agree to the contact and privacy terms before applying.','consent_required');
 if(!await verifyTurnstile(field(b.turnstileToken,2000),req,env.SANDY_TURNSTILE_SECRET))fail(403,'Complete the verification before submitting.','verification_required');
 const name=field(b.name,120),email=field(b.email,254),pathway=field(b.pathway,60);
 if(!name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!PATHWAYS.includes(pathway))fail(400,'Enter your name, a valid email and an application pathway.','invalid_application');
 if(!uuid.test(b.submissionId||''))fail(400,'Reload the form and try again.','invalid_submission');
 const db=dbFor(env),leadId=await stableId('application/'+b.submissionId);
 const ok={ok:true,notice:'Application received. It is not a membership, invitation or payment. The committee will review it.'};
 // The public form only records a consented request; officers open the formal
 // application from it. Retries and repeat requests from one email add nothing, and the
 // reply never reveals whether an email is already known.
 const pending=await db.prepare("SELECT 1 FROM club_interest WHERE lower(email)=lower(?) AND source LIKE 'application:%' AND reviewed_utc IS NULL LIMIT 1").bind(email).first();
 if(pending||await openByEmail(db,email))return json(ok,202);
 const region=['local','regional','tourist','other'].includes(b.audienceRegion)?b.audienceRegion:'other';
 await db.prepare("INSERT INTO club_interest(id,created_utc,first_name,email,town,audience_region,interests_json,comments,contact_consent,source) VALUES(?,?,?,?,?,?,?,?,1,?) ON CONFLICT(id) DO NOTHING")
  .bind(leadId,now(),name,email,field(b.town,100),region,JSON.stringify([pathway]),field(b.statement,1500),'application:'+pathway).run();
 return json(ok,202);
}
async function view(db,row,actor){
 const b=JSON.parse(row.body_json),a=b.application,out={id:row.id,version:row.version,reference:b.fields.reference,pathway:b.fields.applicationKind,received:b.fields.received,
  state:a.state,open:OPEN.includes(a.state),reviewer:b.fields.reviewer,checks:b.fields.checks,notes:b.fields.decisionNotes,history:a.history,source:a.source,fee:a.fee,next:NEXT[a.state]};
 if(memberData(actor)){const p=await db.prepare('SELECT id,full_name,email,town,status,version FROM club_people WHERE id=?').bind(a.personId).first();out.person=p?{id:p.id,name:p.full_name,email:p.email,town:p.town,status:p.status,version:p.version}:null}
 return out;
}
async function load(db,appId,actor){
 if(!uuid.test(appId||''))fail(404,'That application does not exist.','record_not_found');
 const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(appId).first(),body=suiteBody(row,desk);
 if(!body||!body.application||!suiteAllowed(row,desk,actor))fail(404,'That application does not exist.','record_not_found');
 return {row,body};
}
async function transition(req,env,db,actor,row,body){
 const b=await payload(req,8000);if(version(b.version)!==row.version)fail(409,'This application changed. Reload it.','conflict');
 const a=body.application,fields={...body.fields};let to=a.state,extra={};
 if(b.action==='review'){to='under_review';fields.reviewer=field(b.reviewer,100)||actor.office_label||actor.role}
 else if(b.action==='checks'){if(!OPEN.includes(a.state))fail(409,'This application is closed.','application_closed');fields.checks=field(b.checks,2000);fields.decisionNotes=field(b.notes??fields.decisionNotes,4000)}
 else if(b.action==='recommend'){if(!['accept','decline'].includes(b.outcome))fail(400,'Recommend accept or decline.','invalid_outcome');to='recommended_'+b.outcome;fields.decisionNotes=field(b.notes??fields.decisionNotes,4000)}
 else if(b.action==='decide'){
  ensureApprover(actor,env);
  if(!['accepted','declined'].includes(b.decision))fail(400,'Decide accepted or declined.','invalid_decision');
  const evidence=https(b.evidence);if(!evidence)fail(400,'Link the committee resolution or minute for this decision.','evidence_required');
  to=b.decision==='accepted'?'accepted_pending':'declined';extra={evidence};
 }
 else if(b.action==='withdraw'){const reason=field(b.reason,300);if(!reason)fail(400,'Record why the application was withdrawn.','reason_required');to='withdrawn';extra={reason}}
 else fail(400,'Choose a supported application step.','invalid_action');
 if(to!==a.state&&!NEXT[a.state].includes(to))fail(409,'That step is not available from '+a.state.replace(/_/g,' ')+'.','invalid_transition');
 if(b.action==='recommend'&&!memberData(actor))fail(403,'Only officers with member-data access can recommend an outcome.','forbidden');
 const history=to===a.state?a.history:[...a.history,{state:to,at:now(),by:actor.office_label||actor.role,...extra}].slice(-40);
 const nb={...body,fields,application:{...a,state:to,history}};
 const status=OPEN.includes(to)?(to==='received'?'proposal':'review'):to==='accepted_pending'?'completed':to==='declined'?'rejected':'archived';
 const stmts=[];
 if(PERSON_STATUS[to]){
  const p=await db.prepare('SELECT * FROM club_people WHERE id=?').bind(a.personId).first();
  if(p&&p.status==='applicant'){
   const at=now();
   stmts.push(db.prepare("UPDATE club_people SET status=?,version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=? AND status='applicant'").bind(PERSON_STATUS[to],actor.id,at,p.id,p.version),
    revision(db,{kind:'person',resourceId:p.id,resourceVersion:p.version+1,action:'application_'+to,actor,at,snapshot:{status:PERSON_STATUS[to]},changes:{updatedFields:['status'],from:'applicant',to:PERSON_STATUS[to],fromVersion:p.version,toVersion:p.version+1,reason:'Application '+fields.reference},guarded:true}),
    audit(db,actor,'person_updated','person',p.id,at,true,{fromVersion:p.version,toVersion:p.version+1}));
  }
 }
 const w=writeRecord(db,actor,row,nb,'application_'+(to===a.state?b.action:to),{status,changes:{from:a.state,to}});
 w.statements.push(...stmts);await commit(db,w,'This application changed. Reload it.');
 return json({ok:true,version:w.next,state:to,notice:to==='accepted_pending'?'Recorded as accepted, pending activation. No account, invitation or payment was created.':undefined});
}
export async function applicationsEndpoint(req,env,path,actor){
 if(path==='/api/apply'&&req.method==='POST')return publicApply(req,env);
 if(path==='/api/apply'&&req.method==='GET')return json({open:applicationsOpen(env)&&Boolean(env.SANDY_TURNSTILE_SECRET),pathways:PATHWAYS});
 requireRole(actor,desk.roles);
 const db=dbFor(env);
 if(path==='/api/committee/applications'&&req.method==='GET'){
  const rows=await visibleRecords(db,"WHERE kind='volunteer' AND json_extract(body_json,'$.domain')='applications' AND json_extract(body_json,'$.application.personId') IS NOT NULL",[],'created_utc DESC,id DESC',200,r=>suiteAllowed(r,desk,actor));
  const list=[];for(const r of rows)list.push(await view(db,r,actor));
  return json({applications:list,publicOpen:applicationsOpen(env),personalDetails:memberData(actor)});
 }
 if(path==='/api/committee/applications/from-interest'&&req.method==='POST'){
  ensureMemberData(actor);
  const b=await payload(req,4000),interestId=field(b.interestId,60);
  const lead=uuid.test(interestId)?await db.prepare('SELECT * FROM club_interest WHERE id=?').bind(interestId).first():null;
  if(!lead||lead.contact_consent!==1)fail(404,'That consented expression of interest does not exist.','interest_not_found');
  const pathway=field(b.pathway,60)||(lead.source.startsWith('application:')?lead.source.slice(12):'General future member');
  if(!PATHWAYS.includes(pathway))fail(400,'Choose an application pathway.','invalid_pathway');
  const appId=await stableId('interest-application/'+interestId),personId=await stableId('interest-applicant/'+interestId);
  if(await db.prepare('SELECT 1 FROM club_records WHERE id=?').bind(appId).first())return json({ok:true,id:appId,created:false});
  const dup=await openByEmail(db,lead.email);if(dup)return json({ok:true,id:dup.id,created:false,duplicate:true});
  const w=inserts(db,actor,{appId,personId,pathway,source:'interest',interestId,person:{name:lead.first_name,email:lead.email,town:lead.town,region:lead.audience_region,statement:lead.comments}});
  await db.batch(w.statements);return json({ok:true,id:appId,created:true,reference:w.ref},201);
 }
 const m=path.match(/^\/api\/committee\/applications\/([a-f0-9-]{36})$/);
 if(!m)fail(404,'Unknown application service.','not_found');
 const {row,body}=await load(db,m[1],actor);
 if(req.method==='GET')return json({application:await view(db,row,actor)});
 if(req.method==='POST')return transition(req,env,db,actor,row,body);
 fail(405,'Unsupported application operation.','method_not_allowed');
}
