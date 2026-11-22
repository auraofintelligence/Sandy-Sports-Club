import {privateAreaKeys,sealPrivateText,openPrivateText} from './member-network.mjs';
import {returningActivationToken} from './returning-members.mjs';

const scope='Sandy pending account invitation vault v1';
const now=()=>Math.floor(Date.now()/1000);
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const reservedOffice=`i.reset_id IS NOT NULL AND i.role IN ('committee','treasurer')
  AND EXISTS(SELECT 1 FROM club_accounts a JOIN office_slots s ON s.account_id=a.id
    WHERE a.id=i.reset_id AND a.login=i.login AND a.role=i.role AND a.disabled=1
    AND s.office=i.login AND s.status='reserved')`;
const eligible=`i.login IS NOT NULL AND i.role IN ('member','committee','treasurer')
  AND i.used_by IS NULL AND i.expires>?
  AND ((i.reset_id IS NULL AND NOT EXISTS(SELECT 1 FROM club_accounts a WHERE a.login=i.login)) OR (${reservedOffice}))
  AND EXISTS(SELECT 1 FROM club_accounts actor WHERE actor.id=? AND actor.disabled=0
    AND (actor.role='administrator' OR (actor.role='treasurer' AND i.role='member')))
  AND NOT EXISTS(SELECT 1 FROM returning_member_offers blocked WHERE blocked.activation_digest=i.digest AND blocked.status<>'activation')`;
const sourceJoins=`FROM club_invites i LEFT JOIN membership_applications m ON m.invite_digest=i.digest AND m.status='invited' AND m.account_id IS NULL
  LEFT JOIN returning_member_offers r ON r.activation_digest=i.digest AND r.application_id=m.id AND r.status='activation'`;
const handoff=`created_by='sandy-officer-invitation-handoff' AND invite_ref IS NOT NULL AND reset_id IS NULL AND used_by IS NULL AND expires>?
  AND ((role='treasurer' AND login='treasurer') OR (role='committee' AND login IN ('president','vicepresident','secretary','assistantsecretary')))
  AND NOT EXISTS(SELECT 1 FROM club_accounts WHERE login=club_invites.login)`;
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};

function vaultAvailable(db){
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='club_invites_private_ref'").first();
}
async function envelope(secret,key,token){
  const keys=await privateAreaKeys(secret,scope);
  return sealPrivateText(keys.content,key,token);
}
export async function preserveNewInvite(env,key,token){
  if(!await vaultAvailable(env.DB))return [];
  const copy=await envelope(env.PRIVATE_AUTH_KEY,key,token);
  return [env.DB.prepare(`UPDATE club_invites AS i SET invite_copy=? WHERE i.digest=? AND i.invite_ref IS NOT NULL
    AND i.used_by IS NULL AND i.expires>? AND (i.reset_id IS NULL OR (${reservedOffice}))`).bind(copy,key,now())];
}
export async function preserveHandoffInvite(env,key,token){
  if(!await vaultAvailable(env.DB))return false;
  const db=env.DB;
  if(!await db.prepare('SELECT 1 FROM club_invites WHERE digest=? AND '+handoff).bind(key,now()).first())return false;
  const copy=await envelope(env.PRIVATE_AUTH_KEY,key,token);
  const result=await db.prepare('UPDATE club_invites SET invite_copy=COALESCE(invite_copy,?) WHERE digest=? AND '+handoff)
    .bind(copy,key,now()).run();
  return result.meta.changes===1;
}

export async function pendingInvitations(req,env,actor,{json,bodyJson,HttpError}){
  const fail=(status,msg,code)=>{throw new HttpError(status,msg,code);};
  if(!actor?.canManageStock)fail(actor?403:401,'Webmaster or Treasurer access is required.','not_authorised');
  const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
  const unavailable=()=>fail(404,'This pending invitation is unavailable. Refresh the list.','invitation_unavailable');
  if(req.method==='GET'){
    const rows=await db.prepare(`SELECT i.invite_ref AS id,i.login,i.role,i.expires,i.paid_through AS paidThrough,
      CASE WHEN r.id IS NOT NULL THEN 'returning' WHEN m.id IS NOT NULL THEN 'application' ELSE 'account' END AS source,
      (i.invite_copy IS NOT NULL OR r.id IS NOT NULL) AS canCopy ${sourceJoins} WHERE i.invite_ref IS NOT NULL AND ${eligible}
      ORDER BY i.expires,i.login`).bind(now(),actor.id).all();
    return json({invitations:rows.results.map(row=>({...row,canCopy:!!row.canCopy}))},200,headers);
  }
  if(req.method!=='POST')fail(405,'Use the private invitation controls.','method_not_allowed');
  const data=await bodyJson(req);
  if(typeof data.id!=='string'||!/^[a-f0-9]{32}$/.test(data.id)||!['copy','replace'].includes(data.action)||
    Object.keys(data).some(k=>!['id','action'].includes(k)))fail(400,'Choose a pending invitation.','invalid_input');
  const row=await db.prepare(`SELECT i.digest,i.login,i.role,i.expires,i.invite_copy AS copy,r.id AS returningId,r.activation_generation AS generation
    ${sourceJoins} WHERE i.invite_ref=? AND ${eligible}`).bind(data.id,now(),actor.id).first();
  if(!row)unavailable();
  const audit=(action,key)=>db.prepare(`INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM club_invites i
    WHERE i.digest=? AND i.invite_ref=? AND ${eligible})`).bind(crypto.randomUUID(),actor.id,actor.accountRole,action,data.id,
    new Date().toISOString(),key,data.id,now(),actor.id);
  let token;
  if(data.action==='copy'){
    if(row.copy){
      const keys=await privateAreaKeys(env.PRIVATE_AUTH_KEY,scope);
      token=await openPrivateText(keys.content,row.digest,row.copy);
    }else if(row.returningId){
      token=await returningActivationToken(env.PRIVATE_AUTH_KEY,row.returningId,row.generation);
    }else fail(409,'The original link was not saved. Choose Replace link to make a replacement.','replacement_needed');
    if(await digest(token)!==row.digest)fail(409,'The private link could not be recovered. Ask the Webmaster to check this invitation.','recovery_unavailable');
    if(!(await audit('pending_invitation_copied',row.digest).run()).meta.changes)unavailable();
  }else{
    if(row.copy||row.returningId)fail(409,'This invitation already has a private link ready to copy. Refresh the list.','link_available');
    token=hex(crypto.getRandomValues(new Uint8Array(32)));
    const next=await digest(token),copy=await envelope(env.PRIVATE_AUTH_KEY,next,token);
    const [updated]=await db.batch([
      db.prepare(`UPDATE club_invites AS i SET digest=?,invite_copy=? WHERE digest=? AND invite_ref=? AND invite_copy IS NULL AND ${eligible}
        AND NOT EXISTS(SELECT 1 FROM returning_member_offers r WHERE r.activation_digest=i.digest)`)
        .bind(next,copy,row.digest,data.id,now(),actor.id),
      audit('pending_invitation_replaced',next)
    ]);
    if(!updated.meta.changes)fail(409,'This invitation changed. Refresh the list before continuing.','invitation_changed');
  }
  return json({token,login:row.login,role:row.role,expires:row.expires},200,headers);
}
