import {memberSafeguardFlags} from './member-safeguards.mjs';

const categories = new Set(['adult','cadet','junior','social','casual','lifetime']);
const youthCategories = new Set(['cadet','junior']);
const statuses = new Set(['pending','followup','approved','invited','active','declined']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const now = () => Math.floor(Date.now() / 1000);
const clean = value => typeof value === 'string' ? value.trim() : '';
const staff = user => user?.role === 'committee';

export function validateApplication(data,HttpError) {
  const fail = message => {throw new HttpError(400,message,'application_input');};
  const fullName = clean(data.fullName), category = clean(data.category), guardian = clean(data.guardianName);
  const email = clean(data.email).toLowerCase(), mobile = clean(data.mobile);
  const address = clean(data.address), pack = clean(data.packMethod), youth = youthCategories.has(category);
  if (!uuid.test(data.requestId) || !categories.has(category)) fail('Choose a membership category.');
  if (fullName.length < 2 || fullName.length > 100) fail('Enter the applicant’s name.');
  if (!email && !mobile) fail('Add one email address or phone number for the club to contact.');
  if ((email && (email.length>150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      (mobile && (!/^[+0-9 ()-]{7,25}$/.test(mobile) || mobile.replace(/\D/g,'').length < 7))) fail('Check the email address or phone number.');
  if (!['collect','post'].includes(pack) || (pack==='post' && (address.length<6 || address.length>350))) fail('Choose collection, or add a postal address for your pack.');
  if (data.adultDeclaration !== true || data.consent !== true) fail('Confirm the adult declaration and permission to submit.');
  if (youth && (guardian.length<2 || guardian.length>100 || data.guardianAuthorised !== true)) fail('A parent or legal guardian must complete and authorise a youth application.');
  return [fullName,category,email,mobile,pack,pack==='post'?address:'',youth?guardian:'',Number(youth),Number(youth && data.guardianSocial===true)];
}

export async function applicationSubmissionAllowed(request,env) {
  const bucket = Math.floor(now()/900);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const input = new TextEncoder().encode(env.PRIVATE_AUTH_KEY + '/membership-application/' + bucket + '/' + ip);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input)), x=>x.toString(16).padStart(2,'0')).join('');
  const result = await env.DB.batch([
    env.DB.prepare('DELETE FROM club_auth_attempts WHERE expires<?').bind(now()),
    env.DB.prepare('INSERT INTO club_auth_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(digest,(bucket+1)*900),
  ]);
  return result[1].results[0].count<=12;
}

export async function canJoinConversation(db, identity) {
  if (staff(identity)) return true;
  if (identity?.role !== 'member' || identity.accountRole !== 'member' || !db) return false;
  return (await memberSafeguardFlags(db,identity.id)).socialAccess;
}

export async function handleApplications(path,request,env,identity,{json,bodyJson,HttpError}) {
  const fail = (status,message,code) => {throw new HttpError(status,message,code);};
  if (!env.DB || !env.PRIVATE_AUTH_KEY) fail(503,'Membership applications are temporarily unavailable.','not_ready');
  const db = env.DB;
  if (path === '/api/applications/apply') {
    if (request.method!=='POST') fail(405,'Use the membership form to apply.','method_not_allowed');
    const data = await bodyJson(request);
    const fields = validateApplication(data,HttpError);
    if (!await applicationSubmissionAllowed(request,env)) fail(429,'Please try again in 15 minutes.','rate_limited');
    await db.prepare(`INSERT INTO membership_applications
      (id,request_id,full_name,membership_type,contact_email,contact_mobile,pack_method,postal_address,guardian_name,guardian_authorised,guardian_social)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING`).bind(crypto.randomUUID(),data.requestId,...fields).run();
    return json({received:true},202);
  }
  if (!staff(identity)) fail(identity?403:401,'Committee access is required.','not_authorised');
  const params = new URL(request.url).searchParams;
  if (path === '/api/applications' && request.method === 'GET') {
    const status = params.get('status') || 'pending', before = Number(params.get('before') || Number.MAX_SAFE_INTEGER);
    if (!statuses.has(status) || !Number.isSafeInteger(before) || before<=0) fail(400,'Choose an application group.','invalid_filter');
    const {results} = await db.prepare(`SELECT seq,id,full_name AS fullName,membership_type AS category,status,submitted_at AS submittedAt
      FROM membership_applications WHERE status=? AND seq<? ORDER BY seq DESC LIMIT 26`).bind(status,before).all();
    return json({applications:results.slice(0,25),next:results.length>25?results[24].seq:null});
  }
  const [,id,action] = path.match(/^\/api\/applications\/([0-9a-f-]+)(?:\/(review))?$/) || [];
  if (!id || !uuid.test(id)) fail(404,'Application unavailable.','not_found');
  const record = await db.prepare(`SELECT id,full_name AS fullName,membership_type AS category,status,submitted_at AS submittedAt,
    contact_email AS email,contact_mobile AS mobile,pack_method AS packMethod,postal_address AS address,guardian_name AS guardianName,
    guardian_authorised AS guardianAuthorised,guardian_social AS guardianSocial,guardian_reviewed AS guardianReviewed,
    social_reviewed AS socialReviewed,invite_login AS login,invite_expires AS inviteExpires,
    (SELECT r.status FROM returning_member_offers r WHERE r.application_id=membership_applications.id AND r.status<>'cancelled') AS returningStatus
    FROM membership_applications WHERE id=?`).bind(id).first();
  if (!record) fail(404,'Application unavailable.','not_found');
  if (request.method==='GET' && !action) return json({application:record});
  if (request.method!=='POST' || action!=='review') fail(405,'Use the review form.','method_not_allowed');
  const data = await bodyJson(request);
  if (!['approved','followup','declined'].includes(data.decision)) fail(400,'Choose a review outcome.','invalid_review');
  if (!['pending','followup'].includes(record.status)) fail(409,'This application has already been reviewed.','reviewed');
  const youth = youthCategories.has(record.category);
  if (data.decision==='approved' && youth && !(record.guardianAuthorised && data.guardianChecked===true)) {
    fail(400,'Verify the adult guardian before approving this youth application.','guardian_required');
  }
  if (data.socialChecked===true && !(data.decision==='approved' && youth && record.guardianSocial && data.guardianChecked===true)) {
    fail(400,'Club conversation access requires the guardian’s separate permission and staff verification.','guardian_required');
  }
  const result = await db.batch([
    db.prepare(`UPDATE membership_applications SET status=?,reviewed_at=?,reviewed_by=?,guardian_reviewed=?,social_reviewed=?
      WHERE id=? AND status=?`).bind(data.decision,now(),identity.id,Number(youth && data.guardianChecked===true),Number(data.socialChecked===true),id,record.status),
    db.prepare(`INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1`).bind(crypto.randomUUID(),identity.id,identity.accountRole || identity.role,
      'application_'+data.decision,id,new Date().toISOString()),
  ]);
  if (!result[0].meta.changes) fail(409,'This application changed during review. Open it again.','conflict');
  return json({status:data.decision});
}

// The account service has already verified staff authority, payment, paid-through date,
// username availability and role. Keep application state and the one-time invitation atomic.
export async function issueApplicationInvite({db,id,login,admin,key,token,expires,paidThrough,json,HttpError,copy=[]}) {
  const conflict=()=>{throw new HttpError(409,'The application or username is unavailable. Refresh the review before issuing an invitation.','invitation_unavailable');};
  if (!admin?.canManageStock || !uuid.test(id)) throw new HttpError(403,'Treasurer or Webmaster access is required.','not_authorised');
  let result;
  try {
    result = await db.batch([
      db.prepare(`UPDATE membership_applications SET status='invited',invite_login=?,invite_digest=?,invite_expires=?
        WHERE id=? AND (status='approved' OR (status='invited' AND invite_expires<=?))
        AND (membership_type NOT IN ('cadet','junior') OR (guardian_authorised=1 AND guardian_reviewed=1))
        AND NOT EXISTS(SELECT 1 FROM club_accounts WHERE login=?)
        AND NOT EXISTS(SELECT 1 FROM club_invites WHERE login=? AND used_by IS NULL AND expires>?)`).bind(login,key,expires,id,now(),login,login,now()),
      db.prepare(`INSERT INTO club_invites(digest,login,role,created_by,expires,paid_through)
        SELECT ?,?,'member',?,?,? WHERE EXISTS(SELECT 1 FROM membership_applications WHERE id=? AND invite_digest=?)`)
        .bind(key,login,admin.id,expires,paidThrough,id,key),
      db.prepare(`INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM membership_applications WHERE id=? AND invite_digest=?)`)
        .bind(crypto.randomUUID(),admin.id,admin.accountRole,'application_payment_verified_and_invited',id,new Date().toISOString(),id,key),
      ...copy,
    ]);
  } catch (error) {
    if(String(error.message).includes('use returning member invitation'))
      throw new HttpError(409,'This person has a returning offer. Open it to continue, or ask the Secretary to cancel it before taking payment.','returning_offer');
    if(String(error.message).includes('UNIQUE'))conflict();
    throw error;
  }
  if (!result[0].meta.changes || !result[1].meta.changes) conflict();
  return json({token,login,role:'member',expires},201);
}
