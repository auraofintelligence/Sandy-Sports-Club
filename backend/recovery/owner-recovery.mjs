// OFFLINE maintenance utility only. Do not import this from any Worker route.
// Execute only using an authorised, protected, atomic D1/SQLite adapter after
// verifying the existing account and preserving the production backup separately.
import {verifier} from '../../worker/auth.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const salt=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x);
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function recoverExistingWebmaster(db,input){
 const {accountId,username,observedSalt,observedVerifier,password,pepper,confirmation,approvalRef}=input||{};
 if(!db?.prepare||!db?.batch||!uuid(accountId)||!/^[-a-z0-9._+]{3,80}$/.test(username||'')||!salt(observedSalt)||!hash(observedVerifier)||
   typeof password!=='string'||password.length<16||password.length>256||typeof pepper!=='string'||pepper.length<32||
   confirmation!=='RECOVER EXISTING '+accountId||typeof approvalRef!=='string'||!/^[-a-zA-Z0-9._/]{3,100}$/.test(approvalRef))
  throw Error('Recovery requires a privately verified account, previous verifier, new password, existing pepper and explicit approval reference.');
 if(await verifier(password,observedSalt,pepper)===observedVerifier)throw Error('Choose a different password.');
 const nextSalt=hex(crypto.getRandomValues(new Uint8Array(16))),nextVerifier=await verifier(password,nextSalt,pepper);
 const marker=crypto.randomUUID(),rev=crypto.randomUUID(),at=new Date().toISOString();
 // The original account, username and exact observed credential state must still
 // match. A second Webmaster or a changed verifier prevents any write.
 const eligible="EXISTS(SELECT 1 FROM club_audit WHERE id=? AND action='owner_maintenance_recovery' AND resource_id=?)";
 const [saved]=await db.batch([
  db.prepare("UPDATE club_accounts SET password_salt=?,password_verifier=? WHERE id=? AND username=? AND role='webmaster' AND state='active' AND password_salt=? AND password_verifier=? AND (SELECT count(*) FROM club_accounts WHERE role='webmaster')=1").bind(nextSalt,nextVerifier,accountId,username,observedSalt,observedVerifier),
  db.prepare("INSERT INTO club_audit(id,actor_id,actor_role,action,resource_kind,resource_id,occurred_utc,context_json) SELECT ?,?,'webmaster','owner_maintenance_recovery','account',?,?,? WHERE changes()=1").bind(marker,accountId,accountId,at,JSON.stringify({mode:'owner-authorised-offline-maintenance',approvalRef})),
  db.prepare("INSERT INTO club_revisions(id,resource_kind,resource_id,resource_version,operation,actor_id,actor_role,actor_office,at_utc,changes_json,snapshot_json) SELECT ?,'account',?,COALESCE((SELECT MAX(resource_version) FROM club_revisions WHERE resource_kind='account' AND resource_id=?),0)+1,'owner_maintenance_recovery',?,'webmaster','Webmaster',?,?,? WHERE "+eligible).bind(rev,accountId,accountId,accountId,at,JSON.stringify({reason:'Owner-authorised protected recovery',approvalRef}),JSON.stringify({username,role:'webmaster',state:'active'}),marker,accountId),
  db.prepare('DELETE FROM club_sessions WHERE account_id=? AND '+eligible).bind(accountId,marker,accountId),
  db.prepare('DELETE FROM club_invites WHERE account_id=? AND redeemed_epoch IS NULL AND '+eligible).bind(accountId,marker,accountId)
 ]);
 if(saved.meta.changes!==1)throw Error('Recovery was not applied. Account identity or credential state changed, or the sole-Webmaster requirement did not match.');
 return {ok:true,accountId,approvalRef,at,auditId:marker};
}
