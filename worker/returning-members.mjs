import {validateApplication,applicationSubmissionAllowed} from './applications.mjs';

const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const tokenFormat=/^[a-f\d]{64}$/;
const userFormat=/^[a-z0-9][a-z0-9._@+-]{2,79}$/;
const stamp=()=>new Date().toISOString();
const now=()=>Math.floor(Date.now()/1000);
const day="date('now','+10 hours')";
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const encode=s=>new TextEncoder().encode(s);
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encode(s)));
async function privateKey(secret,type,value){
  const key=await crypto.subtle.importKey('raw',encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encode('Sandy Sports Club returning member v1/'+type+'/'+value)));
}
export const returningActivationToken=(secret,id,generation)=>privateKey(secret,'activation',id+'/'+generation);
const priority="CASE o.status WHEN 'proposed' THEN 0 WHEN 'approved' THEN 1 WHEN 'activation' THEN 2 ELSE 3 END";
const selectOffer=`SELECT o.*,o.rowid AS sequence,${priority} AS priority,a.login,
  CASE WHEN o.target_type='account' THEN a.login WHEN o.target_type='paper' THEN o.paper_label ELSE m.full_name END AS label,
  m.status AS applicationStatus,m.invite_expires AS inviteExpires,m.invite_login AS inviteLogin
  FROM returning_member_offers o LEFT JOIN club_accounts a ON a.id=o.account_id LEFT JOIN membership_applications m ON m.id=o.application_id`;
const card=r=>({id:r.id,targetType:r.target_type,label:r.label,status:r.status,version:r.version,approvedAt:r.approved_at,
  proposedAt:r.proposed_at,acceptedAt:r.accepted_at,grantedAt:r.granted_at,paidThrough:r.paid_through,applicationStatus:r.applicationStatus});

export async function returningMembersEndpoint(request,env,identity,{bodyJson,requireDb,HttpError,json}){
  const fail=(status,msg)=>{throw new HttpError(status,msg,'returning_membership');};
  const conflict=()=>fail(409,'This offer or membership record has changed. Refresh before continuing.');
  const unavailable=()=>fail(404,'This private offer is unavailable. Ask the Secretary to check the link.');
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  if(!env.PRIVATE_AUTH_KEY)fail(503,'Private membership offers are being set up.');
  const url=new URL(request.url),publicLink=url.pathname==='/api/returning-offer',officer=url.pathname==='/api/committee/returning-members';
  const isMember=identity?.accountRole==='member' && ['signed_in','member'].includes(identity.role);
  const issue=identity?.role==='committee'&&identity.accountRole==='committee'&&['secretary','assistantsecretary'].includes(identity.name);
  const finance=identity?.role==='committee'&&identity.accountRole==='treasurer';
  if(!publicLink&&!(officer?(issue||finance):isMember))fail(identity?403:401,officer?'The Secretary, Assistant Secretary and Treasurer manage returning offers.':'Sign in with your individual membership account.');
  const byId=id=>db.prepare(selectOffer+' WHERE o.id=?').bind(id).first();
  const audit=(actor,role,action,id)=>db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1')
    .bind(crypto.randomUUID(),actor,role,action,id,stamp());
  const save=async statements=>{
    let result;
    try{result=await db.batch(statements);}catch(e){if(/UNIQUE|returning account unavailable/i.test(e.message))conflict();throw e;}
    if(!result[0].meta.changes)conflict();
  };
  const viewLink=o=>{
    const account=o.target_type==='account',matching=isMember&&identity.id===o.account_id;
    const applicationReady=o.applicationStatus==='approved'||o.status==='activation';
    return {targetType:o.target_type,status:o.status,signInRequired:account&&!isMember,wrongAccount:account&&Boolean(identity)&&!matching,
      signOutRequired:!account&&Boolean(identity)&&['approved','activation'].includes(o.status),
      canAccept:account?matching&&o.status==='approved':!identity&&applicationReady&&['approved','activation'].includes(o.status),
      needsApplication:o.target_type==='paper'&&!o.application_id&&o.status==='approved',applicationStatus:o.applicationStatus,
      paidThrough:o.status==='granted'&&matching?o.paid_through:null};
  };
  const grantAccount=async(o,version)=>{
    if(!isMember||o.account_id!==identity.id)fail(identity?403:401,'Sign in with the membership account named in this offer.');
    if(o.status==='granted')return json({offer:card(o)});
    if(o.status!=='approved'||version!==o.version)conflict();
    const time=stamp();
    const update=db.prepare(`UPDATE returning_member_offers SET status='granted',accepted_at=?,granted_at=?,version=version+1,
      (previous_through,paid_through,category)=(SELECT a.paid_through,
        date(CASE WHEN a.paid_through>=${day} THEN date(a.paid_through,'+1 day') ELSE ${day} END,'+1 year','-1 day'),p.membership_type
        FROM club_accounts a JOIN member_profiles p ON p.account_id=a.id WHERE a.id=returning_member_offers.account_id)
      WHERE id=? AND version=? AND status='approved' AND target_type='account' AND account_id=? AND approved_by IS NOT NULL
      AND EXISTS(SELECT 1 FROM club_accounts a WHERE a.id=account_id AND a.role='member' AND a.disabled=0)`)
      .bind(time,time,o.id,version,identity.id);
    try{await save([update,audit(identity.id,'member','returning_offer_accepted',o.id)]);}
    catch(error){
      if(error.status!==409)throw error;
      const current=await byId(o.id);
      if(current?.status!=='granted'||current.account_id!==identity.id)throw error;
    }
    return json({offer:card(await byId(o.id))});
  };

  if(request.method==='GET'&&!publicLink){
    if(!officer){
      const rows=await db.prepare(selectOffer+" WHERE o.account_id=? AND o.status IN ('approved','granted') ORDER BY o.proposed_at DESC").bind(identity.id).all();
      return json({offers:rows.results.map(card)});
    }
    if(url.searchParams.get('summary')==='1'){
      const query=finance?db.prepare("SELECT count(*) AS count FROM returning_member_offers WHERE status='proposed'"):
        db.prepare(`SELECT count(*) AS count FROM returning_member_offers o LEFT JOIN club_accounts a ON a.id=o.account_id
          LEFT JOIN membership_applications m ON m.id=o.application_id
          WHERE o.status IN ('approved','activation') AND (o.link_digest IS NULL OR o.link_expires<=?)
          AND (o.target_type<>'account' OR (a.role='member' AND a.disabled=0))
          AND (m.id IS NULL OR m.status NOT IN ('declined','active'))`).bind(now());
      return json(await query.first());
    }
    const q=(url.searchParams.get('q')||'').trim();
    if(q.length>80)fail(400,'Use a shorter name or club username.');
    const before=url.searchParams.get('before'),cursor=before?.match(/^([0-3]):([1-9]\d{0,14})$/);
    if(before&&!cursor)fail(400,'Use Show more offers to continue through the list.');
    const from=cursor?Number(cursor[1]):-1,sequence=cursor?Number(cursor[2]):0;
    const recent=await db.prepare(selectOffer+` WHERE (?='' OR instr(lower(coalesce(a.login,'')||' '||coalesce(m.full_name,'')||' '||o.paper_label),lower(?))>0)
      AND (${priority}>? OR (${priority}=? AND o.rowid<?)) ORDER BY priority,o.rowid DESC LIMIT 201`).bind(q,q,from,from,sequence).all();
    const page=recent.results.slice(0,200),last=page.at(-1),nextOffers=recent.results.length>200?last.priority+':'+last.sequence:null;
    let matches=[];
    if(q.length>=2 && issue){
      const rows=await db.prepare(`SELECT 'account' AS targetType,a.id AS targetId,a.login AS label,a.paid_through AS paidThrough
        FROM club_accounts a WHERE a.role='member' AND a.disabled=0 AND instr(lower(a.login),lower(?))>0
        UNION ALL SELECT 'application',m.id,m.full_name,NULL FROM membership_applications m WHERE m.status='approved'
        AND m.account_id IS NULL AND instr(lower(m.full_name),lower(?))>0 ORDER BY label LIMIT 35`).bind(q,q).all();
      matches=rows.results;
    }
    return json({canIssue:issue,canApprove:finance,offers:page.map(card),matches,nextOffers});
  }
  if(request.method!=='POST')fail(405,'Use the membership offer form.');
  const b=await bodyJson(request,5500),action=b.action;
  if(officer){
    if(!uuid.test(b.id||''))fail(400,'Reopen the membership offer and try again.');
    if(action==='propose'){
      if(!issue)fail(403,'The Secretary or Assistant Secretary starts a returning offer.');
      const type=b.targetType,paper=type==='paper',ref=String(b.registerRef||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
      const label=paper&&typeof b.label==='string'?b.label.trim():'';
      if(!['account','application','paper'].includes(type)||b.registerChecked!==true||ref.length<2||ref.length>100||
        (paper&&(!label||label.length>100))||(!paper&&(typeof b.targetId!=='string'||!b.targetId)))
        fail(400,'Confirm the previous membership and enter its unique register reference and member record.');
      const refKey=await privateKey(env.PRIVATE_AUTH_KEY,'register',ref),target=paper?null:b.targetId;
      const previous=await byId(b.id);
      if(previous){
        if(previous.register_digest!==refKey||previous.target_type!==type||previous.proposed_by!==identity.id||
          (paper?previous.paper_label!==label:type==='account'?previous.account_id!==target:previous.application_id!==target))conflict();
        return json({offer:card(previous)});
      }
      const condition=paper?'1':type==='account'?"EXISTS(SELECT 1 FROM club_accounts WHERE id=? AND role='member' AND disabled=0)":
        "EXISTS(SELECT 1 FROM membership_applications WHERE id=? AND status='approved' AND account_id IS NULL)";
      await save([db.prepare(`INSERT INTO returning_member_offers(id,target_type,register_digest,paper_label,account_id,application_id,status,proposed_by,proposed_at)
        SELECT ?,?,?,?,?,?,'proposed',?,? WHERE ${condition}`).bind(b.id,type,refKey,label,type==='account'?target:null,type==='application'?target:null,
        identity.id,stamp(),...(paper?[]:[target])),audit(identity.id,identity.accountRole,'returning_previous_membership_checked',b.id)]);
      return json({offer:card(await byId(b.id))},201);
    }
    const o=await byId(b.id);if(!o)unavailable();
    if(!Number.isSafeInteger(b.version)||b.version!==o.version)conflict();
    if(action==='approve'){
      if(!finance||identity.id===o.proposed_by)fail(403,'A separate Treasurer must approve the complimentary year.');
      await save([db.prepare("UPDATE returning_member_offers SET status='approved',version=version+1,approved_by=?,approved_at=? WHERE id=? AND version=? AND status='proposed' AND proposed_by<>?")
        .bind(identity.id,stamp(),o.id,b.version,identity.id),audit(identity.id,identity.accountRole,'returning_fee_waiver_approved',o.id)]);
    }else if(action==='cancel'){
      if(!issue)fail(403,'The Secretary or Assistant Secretary can withdraw this offer.');
      await save([db.prepare("UPDATE returning_member_offers SET status='cancelled',version=version+1,cancelled_by=?,cancelled_at=?,link_digest=NULL WHERE id=? AND version=? AND status IN ('proposed','approved')")
        .bind(identity.id,stamp(),o.id,b.version),audit(identity.id,identity.accountRole,'returning_offer_cancelled',o.id)]);
    }else if(action==='link'){
      if(!issue)fail(403,'The Secretary or Assistant Secretary prepares the private invitation.');
      if(!['approved','activation'].includes(o.status))conflict();
      const active=o.link_expires>now(),generation=o.link_generation+(active?0:1);
      const token=await privateKey(env.PRIVATE_AUTH_KEY,'offer',o.id+'/'+generation);
      if(!active)await save([db.prepare(`UPDATE returning_member_offers SET link_digest=?,link_generation=?,link_expires=?
        WHERE id=? AND version=? AND link_generation=? AND status IN ('approved','activation')`)
        .bind(await digest(token),generation,now()+30*86400,o.id,o.version,o.link_generation),audit(identity.id,identity.accountRole,'returning_invitation_prepared',o.id)]);
      return json({token});
    }else fail(400,'Choose a membership offer action.');
    return json({offer:card(await byId(o.id))});
  }
  if(!publicLink){
    if(action!=='accept'||b.confirm!==true||typeof b.id!=='string')fail(400,'Confirm that you want to accept the complimentary year.');
    const o=await byId(b.id);if(!o||identity.id!==o.account_id)unavailable();return grantAccount(o,b.version);
  }
  if(typeof b.token!=='string'||!tokenFormat.test(b.token))unavailable();
  const o=await db.prepare(selectOffer+" WHERE o.link_digest=? AND o.link_expires>? AND o.status IN ('approved','activation','granted')").bind(await digest(b.token),now()).first();
  if(!o)unavailable();
  if(action==='check')return json(viewLink(o));
  if(o.target_type==='account'){
    if(action!=='accept'||b.confirm!==true)fail(400,'Confirm that you want to accept the complimentary year.');
    return grantAccount(o,o.version);
  }
  if(identity)fail(403,'This private offer is for a returning member who is setting up a new account. Sign out first.');
  if(action==='apply'){
    if(o.target_type!=='paper'||o.status!=='approved'||!b.application||typeof b.application!=='object')conflict();
    const fields=validateApplication(b.application,HttpError),key=b.application.requestId;
    if(o.application_id){
      const prior=await db.prepare('SELECT request_id FROM membership_applications WHERE id=?').bind(o.application_id).first();
      if(prior?.request_id!==key)conflict();
      return json(viewLink(o));
    }
    if(!await applicationSubmissionAllowed(request,env))fail(429,'Please try again in 15 minutes.');
    const id=crypto.randomUUID();
    await save([db.prepare(`INSERT INTO membership_applications(id,request_id,full_name,membership_type,contact_email,contact_mobile,pack_method,postal_address,guardian_name,guardian_authorised,guardian_social)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM returning_member_offers WHERE id=? AND status='approved' AND application_id IS NULL AND link_digest=? AND link_expires>?)`)
      .bind(id,key,...fields,o.id,o.link_digest,now()),db.prepare('UPDATE returning_member_offers SET application_id=?,version=version+1 WHERE id=? AND changes()=1').bind(id,o.id),
      audit('returning-recipient','applicant','returning_application_submitted',o.id)]);
    return json(viewLink(await byId(o.id)),201);
  }
  if(action!=='accept'||b.confirm!==true)fail(400,'Confirm that you want to accept the complimentary year.');
  const login=typeof b.login==='string'?b.login.trim().toLowerCase():'';
  if(!userFormat.test(login))fail(400,'Choose a username of 3 to 80 letters, numbers or email characters.');
  if(!o.application_id||!['approved','invited'].includes(o.applicationStatus)||!['approved','activation'].includes(o.status))conflict();
  const active=o.status==='activation'&&o.inviteExpires>now();
  if(o.status==='activation'&&o.inviteLogin!==login)fail(409,'Use the username you chose when accepting this offer.');
  const generation=o.activation_generation+(active?0:1),token=await returningActivationToken(env.PRIVATE_AUTH_KEY,o.id,generation);
  if(active)return json({offer:{status:'activation'},activation:{token,login}});
  const key=await digest(token),expires=now()+86400,at=stamp();
  await save([db.prepare(`UPDATE membership_applications SET status='invited',invite_login=?,invite_digest=?,invite_expires=?
    WHERE id=? AND account_id IS NULL AND (status='approved' OR (status='invited' AND invite_digest=? AND invite_expires<=?))
    AND (membership_type NOT IN ('cadet','junior') OR (guardian_authorised=1 AND guardian_reviewed=1))
    AND NOT EXISTS(SELECT 1 FROM club_accounts WHERE login=?)
    AND NOT EXISTS(SELECT 1 FROM club_invites WHERE login=? AND used_by IS NULL AND expires>?)
    AND EXISTS(SELECT 1 FROM returning_member_offers WHERE id=? AND version=? AND approved_by IS NOT NULL AND link_digest=? AND link_expires>?)`)
    .bind(login,key,expires,o.application_id,o.activation_digest,now(),login,login,now(),o.id,o.version,o.link_digest,now()),
    db.prepare(`INSERT INTO club_invites(digest,login,role,created_by,expires,paid_through)
      SELECT ?,?,'member',?,?,NULL WHERE changes()=1`).bind(key,login,o.approved_by,expires),
    db.prepare(`UPDATE returning_member_offers SET status='activation',version=version+1,accepted_at=coalesce(accepted_at,?),
      activation_digest=?,activation_generation=? WHERE id=? AND changes()=1`).bind(at,key,generation,o.id),
    audit('returning-recipient','applicant','returning_year_accepted_and_invited',o.id)]);
  return json({offer:{status:'activation'},activation:{token,login}});
}
