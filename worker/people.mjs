import {fail,json,now,id,dbFor,payload,field,dateField,bool,version,ensureMemberData,requireRole,revision,audit} from './shared.mjs';
const classes=['interested','founding','adult','youth','family','social','volunteer','supporter','organisation','honorary','other'];
const states=['interested','founder_prospect','applicant','pending','active','lapsed','inactive','withdrawn'];
const regions=['','local','regional','tourist','other'];
const columns={
 name:'full_name',joined:'joined_on',renewal:'renewal_on',gender:'gender',town:'town',class:'membership_class',
 status:'status',created:'created_utc',region:'audience_region'
};
const view=(row)=>({
 id:row.id,accountId:row.account_id||null,name:row.full_name,preferredName:row.preferred_name,
 email:row.email,mobile:row.mobile,membershipClass:row.membership_class,status:row.status,
 joinedOn:row.joined_on,renewalOn:row.renewal_on,gender:row.gender,town:row.town,
 audienceRegion:row.audience_region,contactConsent:!!row.consent_contact,publicationConsent:!!row.consent_publication,
 source:row.source,notes:row.notes,version:row.version,
 createdAt:row.created_utc,updatedAt:row.updated_utc
});
function clean(b,env){
 const fullName=field(b.name,120),email=field(b.email,254),mobile=field(b.mobile,40);
 const membershipClass=field(b.membershipClass,40)||'interested',status=field(b.status,30)||'interested';
 const audienceRegion=field(b.audienceRegion,20);
 if(!fullName||!classes.includes(membershipClass)||!states.includes(status)||!regions.includes(audienceRegion))
  fail(400,'Provide a name and valid membership, status and audience categories.','invalid_member');
 if(email&&(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254))
  fail(400,'Enter a valid email or leave it blank.','invalid_email');
 if(status==='active'&&env.SANDY_CLUB_APPROVALS!=='enabled')
  fail(409,'Memberships cannot be activated before the club is established. Record an interested or pending person instead.','club_not_established');
 return {
  name:fullName,preferredName:field(b.preferredName,100),email,mobile,membershipClass,status,
  joinedOn:dateField(b.joinedOn),renewalOn:dateField(b.renewalOn),
  gender:field(b.gender,60),town:field(b.town,100),audienceRegion,
  contactConsent:bool(b.contactConsent),publicationConsent:bool(b.publicationConsent),
  source:field(b.source,150),notes:field(b.notes,4000)
 };
}
function editColumns(data){
 return [data.name,data.preferredName,data.email,data.mobile,data.membershipClass,data.status,data.joinedOn,data.renewalOn,data.gender,data.town,data.audienceRegion,
  data.contactConsent?1:0,data.publicationConsent?1:0,data.source,data.notes];
}
const sqlFields='full_name,preferred_name,email,mobile,membership_class,status,joined_on,renewal_on,gender,town,audience_region,consent_contact,consent_publication,source,notes';
async function history(db,entityId){
 const rows=await db.prepare("SELECT resource_version AS version,operation,actor_role AS role,actor_office AS office,at_utc AS at,changes_json AS changes FROM club_revisions WHERE resource_kind='person' AND resource_id=? ORDER BY resource_version DESC LIMIT 80")
  .bind(entityId).all();
 return (rows.results||[]).map(r=>({...r,changes:JSON.parse(r.changes)}));
}
export async function peopleEndpoint(req,env,path,identity){
 ensureMemberData(identity);
 const db=dbFor(env),url=new URL(req.url);
 if(path==='/api/people'&&req.method==='GET'){
  const sort=columns[url.searchParams.get('sort')]||'full_name',direction=url.searchParams.get('direction')==='desc'?'DESC':'ASC';
  const q=field(url.searchParams.get('q'),90),town=field(url.searchParams.get('town'),100),status=field(url.searchParams.get('status'),30),gender=field(url.searchParams.get('gender'),60),membershipClass=field(url.searchParams.get('class'),40),region=field(url.searchParams.get('region'),20);
  const size=Math.min(100,Math.max(1,Number(url.searchParams.get('limit')||50)||50));
  const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page')||0)||0));
  let where='WHERE 1=1',values=[];
  if(q){where+=" AND (full_name LIKE ? OR email LIKE ? OR town LIKE ?)";values.push(...Array(3).fill('%'+q.replace(/[%_]/g,'')+'%'));}
  if(town){where+=' AND town=?';values.push(town)}
  if(status&&states.includes(status)){where+=' AND status=?';values.push(status)}
  if(gender){where+=' AND gender=?';values.push(gender)}
  if(membershipClass){where+=' AND membership_class=?';values.push(membershipClass)}
  if(region&&regions.includes(region)){where+=' AND audience_region=?';values.push(region)}
  const rows=await db.prepare('SELECT * FROM club_people '+where+' ORDER BY '+sort+' '+direction+',id ASC LIMIT ? OFFSET ?')
    .bind(...values,size,page*size).all();
  const count=await db.prepare('SELECT COUNT(*) AS total FROM club_people '+where).bind(...values).first();
  return json({people:(rows.results||[]).map(view),total:count.total,page,limit:size,sort,direction});
 }
 if(path==='/api/people'&&req.method==='POST'){
  const b=await payload(req,16000),data=clean(b,env),at=now(),personId=id();
  await db.batch([
   db.prepare('INSERT INTO club_people(id,'+sqlFields+',version,created_by,updated_by,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)')
    .bind(personId,...editColumns(data),identity.id,identity.id,at,at),
   revision(db,{kind:'person',resourceId:personId,resourceVersion:1,action:'created',actor:identity,at,snapshot:data}),
   audit(db,identity,'person_created','person',personId,at)
  ]);
  return json({ok:true,id:personId,version:1,person:data},201);
 }
 const match=path.match(/^\/api\/people\/([a-f0-9-]{36})(?:\/(revisions))?$/);
 if(match){
  const personId=match[1],row=await db.prepare('SELECT * FROM club_people WHERE id=?').bind(personId).first();
  if(!row)fail(404,'No person has that record identifier.','person_not_found');
  if(req.method==='GET')return json(match[2]?{revisions:await history(db,personId)}:{person:view(row)});
  if(req.method==='PATCH'&&!match[2]){
   const b=await payload(req,16000),expected=version(b.version),data=clean({...view(row),...b},env),at=now();
   if(expected!==row.version)fail(409,'This person was updated by another officer. Refresh before saving.','conflict');
   const [result]=await db.batch([
    db.prepare('UPDATE club_people SET '+sqlFields.split(',').map(k=>k+'=?').join(',')+',version=version+1,updated_by=?,updated_utc=? WHERE id=? AND version=?')
      .bind(...editColumns(data),identity.id,at,personId,expected),
    revision(db,{kind:'person',resourceId:personId,resourceVersion:expected+1,action:'updated',actor:identity,at,snapshot:data,
      changes:{updatedFields:Object.keys(b).filter(k=>k!=='version')},guarded:true}),
    audit(db,identity,'person_updated','person',personId,at,true)
   ]);
   if(!result.meta.changes)fail(409,'This record changed while saving. Reload it.','conflict');
   return json({ok:true,id:personId,version:expected+1});
  }
 }
 fail(404,'Unknown membership-directory operation.','not_found');
}
async function verifyTurnstile(token,req,secret){
 try{
  const data=new URLSearchParams({secret,response:token,remoteip:req.headers.get('cf-connecting-ip')||''});
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:data,signal:AbortSignal.timeout(8000)});
  const result=await response.json();return result.success===true;
 }catch{return false}
}
export async function interestEndpoint(req,env,path,identity){
 const db=dbFor(env),at=now();
 if(path==='/api/interest'&&req.method==='POST'){
  if(!env.SANDY_TURNSTILE_SECRET)fail(503,'Public interest registration is not yet activated.','registration_not_ready');
  const b=await payload(req,8500);
  if(!bool(b.contactConsent))fail(400,'Explicit consent is required before recording contact information.','consent_required');
  if(!await verifyTurnstile(field(b.turnstileToken,2000),req,env.SANDY_TURNSTILE_SECRET))fail(403,'Complete the verification before submitting.','verification_required');
  const name=field(b.firstName,80),email=field(b.email,254),town=field(b.town,100),region=field(b.audienceRegion,20)||'other';
  if(!name||!email||!email.includes('@')||!regions.includes(region))fail(400,'Enter your name, email and visitor or locality category.','invalid_interest');
  const interests=Array.isArray(b.interests)?b.interests.filter(x=>typeof x==='string').slice(0,20).map(x=>field(x,60)):[];
  const leadId=id();
  await db.prepare('INSERT INTO club_interest(id,created_utc,first_name,email,town,audience_region,interests_json,comments,contact_consent,source) VALUES(?,?,?,?,?,?,?,?,1,?)')
   .bind(leadId,at,name,email,town,region,JSON.stringify(interests),field(b.comments,1800),field(b.source,100)).run();
  return json({ok:true,notice:'Expression of interest recorded. It is not a club membership or automatic invitation.'},201);
 }
 ensureMemberData(identity);
 if(path==='/api/interest'&&req.method==='GET'){
  const rows=await db.prepare('SELECT id,created_utc AS createdAt,first_name AS firstName,email,town,audience_region AS audienceRegion,interests_json AS interests,comments,reviewed_utc AS reviewedAt FROM club_interest ORDER BY created_utc DESC LIMIT 300').all();
  return json({interests:(rows.results||[]).map(r=>({...r,interests:JSON.parse(r.interests)}))});
 }
 const match=path.match(/^\/api\/interest\/([a-f0-9-]{36})\/review$/);
 if(match&&req.method==='POST'){
  const [result]=await db.batch([
   db.prepare('UPDATE club_interest SET reviewed_utc=?,reviewed_by=? WHERE id=? AND reviewed_utc IS NULL').bind(at,identity.id,match[1]),
   audit(db,identity,'interest_reviewed','interest',match[1],at,true)
  ]);
  if(!result.meta.changes)fail(409,'This interest was already reviewed or is missing.','conflict');
  return json({ok:true});
 }
 fail(404,'Unknown expression-of-interest operation.','not_found');
}
