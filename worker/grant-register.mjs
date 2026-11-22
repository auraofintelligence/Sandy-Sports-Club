import {officerSeats} from './officer-todos.mjs';

const offices={...officerSeats,webmaster:'Webmaster',unassigned:'To be agreed'};
const stages={checking:'Checking eligibility',preparing:'Preparing application',submitted:'Submitted',
  delivery:'Funding approved',reporting:'Preparing final report',closed:'Finished',declined:'Unsuccessful',parked:'Set aside'};
const fields='id,title,funder,source_url AS sourceUrl,office,stage,deadline,report_due AS reportDue,next_step AS nextStep,version,updated_at AS updatedAt';
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const headers={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};

async function fingerprint(values) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values)));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function saveGrant(db,identity,body,{HttpError,textField,dateField}) {
  const {id,version,office,stage,action}=body;
  if(typeof id!=='string' || !uuid.test(id) || !Number.isSafeInteger(version) || version<0)throw new HttpError(400,'Open the grant again before editing.','grant_id');
  const stamp=new Date().toISOString(),auditId=crypto.randomUUID();
  // The audit ID belongs only to this attempt. A failed version check must leave every link intact.
  const accepted='EXISTS (SELECT 1 FROM audit_log WHERE id=?)';
  let write,digest,auditAction,wishIds,legacyFields;
  const linkWrites=[];
  if(Object.hasOwn(body,'action')) {
    if(!['linkWish','unlinkWish'].includes(action) || !version || typeof body.wishId!=='string' || !uuid.test(body.wishId) ||
      Object.keys(body).some(key=>!['action','id','version','wishId'].includes(key)))throw new HttpError(400,'Choose a grant and an equipment wish.','grant_wish');
    const wishId=body.wishId.toLowerCase(),link=action==='linkWish';
    wishIds=[wishId];
    digest=await fingerprint([version,action,wishId]);
    auditAction=link?'grant_wish_linked':'grant_wish_unlinked';
    const existing='EXISTS (SELECT 1 FROM committee_grant_wishes WHERE grant_id=? AND wish_id=?)';
    write=db.prepare('UPDATE committee_grants SET version=version+1,updated_by=?,updated_at=?,last_change=? WHERE id=? AND version=? AND '+(link?'NOT ':'')+existing)
      .bind(identity.id,stamp,digest,id,version,id,wishId);
    linkWrites.push(link
      ?db.prepare('INSERT INTO committee_grant_wishes(grant_id,wish_id) SELECT ?,? WHERE '+accepted).bind(id,wishId,auditId)
      :db.prepare('DELETE FROM committee_grant_wishes WHERE grant_id=? AND wish_id=? AND '+accepted).bind(id,wishId,auditId));
  } else {
    if(!Object.hasOwn(offices,office) || !Object.hasOwn(stages,stage))throw new HttpError(400,'Choose an office and an application stage.','grant_option');
    const title=textField(body.title,'the grant name',140,true),funder=textField(body.funder,'the funder',140);
    const sourceUrl=textField(body.sourceUrl,'the funding link',700),nextStep=textField(body.nextStep,'the next step',600);
    const deadline=dateField(body.deadline,false),reportDue=dateField(body.reportDue,false);
    if(sourceUrl) {
      let url;try {url=new URL(sourceUrl);}catch { /* The message below covers malformed links. */ }
      if(!url || url.protocol!=='https:' || url.username || url.password)throw new HttpError(400,'Paste a public funding link starting with https://.','grant_link');
    }
    if(Object.hasOwn(body,'wishIds')) {
      if(!Array.isArray(body.wishIds) || body.wishIds.some(value=>typeof value!=='string' || !uuid.test(value)))throw new HttpError(400,'Select equipment from the current wish list.','grant_wish');
      wishIds=[...new Set(body.wishIds.map(value=>value.toLowerCase()))].sort();
      const selected=JSON.stringify(wishIds);
      linkWrites.push(
        db.prepare('DELETE FROM committee_grant_wishes WHERE grant_id=? AND wish_id NOT IN (SELECT value FROM json_each(?)) AND '+accepted).bind(id,selected,auditId),
        db.prepare('INSERT INTO committee_grant_wishes(grant_id,wish_id) SELECT ?,value FROM json_each(?) WHERE '+accepted+' ON CONFLICT(grant_id,wish_id) DO NOTHING').bind(id,selected,auditId)
      );
    }
    legacyFields={title,funder,sourceUrl,office,stage,deadline,reportDue,nextStep};
    digest=await fingerprint([version,legacyFields,wishIds??null]);
    auditAction=version===0?'grant_added':'grant_updated';
    const values=[title,funder,sourceUrl,office,stage,deadline,reportDue,nextStep,identity.id,stamp,digest];
    write=version===0
      ? db.prepare('INSERT INTO committee_grants(id,title,funder,source_url,office,stage,deadline,report_due,next_step,updated_by,updated_at,last_change) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,...values)
      : db.prepare('UPDATE committee_grants SET title=?,funder=?,source_url=?,office=?,stage=?,deadline=?,report_due=?,next_step=?,updated_by=?,updated_at=?,last_change=?,version=version+1 WHERE id=? AND version=?').bind(...values,id,version);
  }
  if(wishIds?.length) {
    const matched=await db.prepare('SELECT COUNT(*) AS count FROM equipment_wishes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(wishIds)).first();
    if(matched.count!==wishIds.length)throw new HttpError(400,'An equipment wish could not be found. Reopen the wish list before saving.','grant_wish');
  }
  const [saved]=await db.batch([write,db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1')
    .bind(auditId,identity.id,identity.accountRole||identity.role,auditAction,id,stamp),...linkWrites]);
  if(saved.meta.changes)return;
  const previous=await db.prepare('SELECT '+fields+',updated_by AS updatedBy,last_change AS lastChange FROM committee_grants WHERE id=?').bind(id).first();
  if(action && previous?.version===version)return; // The requested link state already holds.
  if(previous?.version===version+1 && previous.updatedBy===identity.id) {
    if(previous.lastChange===digest)return;
    // Accept a grant-form retry that was originally saved before links were introduced.
    if(!previous.lastChange && legacyFields && !wishIds && Object.entries(legacyFields).every(([key,value])=>value===previous[key]))return;
  }
  throw new HttpError(409,'Another officer updated this grant. Reopen the latest entry before saving.','grant_version');
}

export async function grantRegisterEndpoint(request,env,identity,helpers) {
  const {requireRole,requireDb,HttpError,json,bodyJson}=helpers;
  requireRole(identity,['committee']);
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  if(!['GET','POST'].includes(request.method))throw new HttpError(405,'Open the committee grant register.','grant_method');
  if(request.method==='POST')await saveGrant(db,identity,await bodyJson(request),helpers);
  const [records,wishes,links]=await db.batch([
    db.prepare('SELECT '+fields+' FROM committee_grants ORDER BY updated_at DESC,id'),
    db.prepare("SELECT id,name,purpose,goal_cents AS goalCents,total_cents AS totalCents,status,published FROM equipment_wishes ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,name COLLATE NOCASE,id"),
    db.prepare('SELECT grant_id,wish_id FROM committee_grant_wishes ORDER BY grant_id,wish_id')
  ]);
  const byGrant=new Map(records.results.map(row=>[row.id,{...row,wishIds:[]}]));
  for(const {grant_id,wish_id} of links.results)byGrant.get(grant_id).wishIds.push(wish_id);
  return json({offices,stages,grants:[...byGrant.values()],wishes:wishes.results.map(row=>({...row,published:!!row.published})),
    today:new Date(Date.now()+36000000).toISOString().slice(0,10)},200,headers);
}
