import { createRemoteJWKSet, jwtVerify } from 'jose';
import { CLUB, EVENTS, PROGRAMME, COMPETITION, FEATURES, makeCalendar } from './data.mjs';
import { passwordIdentity, accountEndpoint } from './accounts.mjs';
import {webmasterHelpEndpoint} from './webmaster-help.mjs';
import { canManageStock, stockEndpoint } from './stock.mjs';
import {waiverReportEndpoint} from './returning-waiver-report.mjs';
import {merchOrdersEndpoint} from './merch-orders.mjs';
import {pricingEndpoint} from './pricing.mjs';
import { handleLibrary } from './library.mjs';
import {meetingRegister} from './meeting-register.mjs';
import {containsProceedings} from './formal-agenda.mjs';
import {assistMinutes} from './minute-assistant.mjs';
import {communityEndpoint} from './community.mjs';
import {handleApplications} from './applications.mjs';
import {handoffEndpoint} from './handoffs.mjs';
import {operatingAuthority} from './operating-authority.mjs';
import {runMeetingReminders,meetingRemindersEndpoint} from './meeting-reminders.mjs';
import {agmJobs} from './agm-jobs.mjs';
import {socialPlannerEndpoint} from './social-planner.mjs';
import {socialBrainstormEndpoint} from './social-brainstorm.mjs';
import {fundraisingEventsEndpoint} from './fundraising-events.mjs';
import {memberCalendarEndpoint} from './member-calendar.mjs';
import {clubEquipmentEndpoint} from './club-equipment.mjs';
import {equipmentWishesEndpoint} from './equipment-wishes.mjs';
import {sponsorOffersEndpoint} from './sponsor-offers.mjs';
import {shopPhotosEndpoint} from './shop-photos.mjs';
import {memberRecipesEndpoint} from './member-recipes.mjs';
import {sharedMealsEndpoint} from './shared-meals.mjs';
import {memberNetworkEndpoint} from './member-network.mjs';
import {returningMembersEndpoint} from './returning-members.mjs';
import {memberExportEndpoint} from './member-export.mjs';
import {memberSafeguardsEndpoint} from './member-safeguards.mjs';
import {grantRegisterEndpoint} from './grant-register.mjs';
import {noticeEmailProfile} from './notice-email-profile.mjs';
import {runNoticeEmail} from './notice-email.mjs';
import {committeeNoticesEndpoint} from './committee-notices.mjs';
import {officerTodosEndpoint} from './officer-todos.mjs';
import {newslettersEndpoint} from './newsletters.mjs';
import {lifecycleEndpoint,runMemberCycle} from './member-lifecycle.mjs';
import {retireOfficerDemo} from './demo-officers.mjs';
import {showcase} from './showcase.mjs';
export {OfficerDemoRoom} from './demo-officers.mjs';

const MAX_BODY_BYTES = 32768;
const jwksByIssuer = new Map();
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src https://www.youtube-nocookie.com https://www.facebook.com/plugins/page.php; frame-ancestors 'self'",
};

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...securityHeaders, ...headers } });
}

function json(value, status = 200, headers = {}) {
  return response(JSON.stringify(value), status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
}

function emails(value) {
  return new Set(String(value || '').split(/[\s,;]+/).map(email => email.trim().toLowerCase()).filter(Boolean));
}

function roleFor(email, env) {
  if (emails(env.COMMITTEE_EMAILS).has(email.toLowerCase())) return 'committee';
  if (emails(env.MEMBER_EMAILS).has(email.toLowerCase())) return 'member';
  return 'signed_in';
}

export async function getIdentity(request, env = {}) {
  const account = await passwordIdentity(request, env);
  if (account) return account;
  if (env.AUTH_MODE !== 'access') return null;
  const issuer = String(env.ACCESS_ISSUER || '').replace(/\/$/, '');
  const audience = String(env.ACCESS_AUD || '');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer) || !audience) return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || token.length > 16384) return null;
  try {
    if (!jwksByIssuer.has(issuer)) jwksByIssuer.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    const { payload } = await jwtVerify(token, jwksByIssuer.get(issuer), { issuer, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'email', 'exp', 'iat'] });
    if (typeof payload.email !== 'string' || typeof payload.sub !== 'string') return null;
    return { id: `access:${payload.sub}`, email: payload.email, name: payload.email, role: roleFor(payload.email, env) };
  } catch { return null; }
}

function requireRole(identity, roles) {
  if (!identity) throw new HttpError(401, 'Sign in to access this part of the club.', 'sign_in_required');
  if (!roles.includes(identity.role)) throw new HttpError(403, 'Your account has not been given access to this part of the club yet.', 'access_not_granted');
}

function requireDb(env) {
  if (!env.DB?.prepare) throw new HttpError(503, 'Club storage is not connected yet. Please try again after setup.', 'storage_not_ready');
  return env.DB;
}

async function storageReady(env) {
  if (!env.DB?.prepare) return false;
  try {
    const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('club_accounts', 'meeting_notes', 'audit_log')").all();
    return result.results?.length === 3;
  } catch { return false; }
}

async function bodyJson(request, limit = MAX_BODY_BYTES) {
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new HttpError(403, 'Please submit this form from the club website.', 'origin_mismatch');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new HttpError(415, 'This form requires a JSON request.', 'invalid_content_type');
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, 'This form is too large.', 'body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'The form was empty.', 'invalid_json');
  let size = 0;
  const parts = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, 'This form is too large.', 'body_too_large');
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Please check the form and try again.', 'invalid_json'); }
}

function textField(value, label, max, required = false) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw new HttpError(400, `Please check ${label}.`, 'invalid_input');
  }
  const clean = value.trim();
  if ((required && !clean) || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)) throw new HttpError(400, `Please check ${label}.`, 'invalid_input');
  return clean;
}

function dateField(value, required = true) {
  if (!required && (value == null || value === '')) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Please choose a valid date.', 'invalid_date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2100-12-31') throw new HttpError(400, 'Please choose a valid date.', 'invalid_date');
  return value;
}

function onlyKeys(value, allowed) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new HttpError(400, 'This form contains an unexpected field.', 'invalid_input');
}

function meetingRecord(row,meta) {
  return { ...meta, notes: row?.notes || '', actions: JSON.parse(row?.actions_json || '[]'), decisions: JSON.parse(row?.decisions_json || '[]'), status: row?.status || 'draft', approvedAt: row?.approved_at || null, approvedBy: row?.approved_by || null, version: row?.version || 0, updatedAt: row?.updated_at || null };
}

async function meeting(request, env, identity) {
  requireRole(identity, ['committee']);
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  const id=new URL(request.url).searchParams.get('id');
  if(!id)throw new HttpError(400,'Choose a meeting first.','invalid_meeting');
  const info=await db.prepare(`SELECT r.id,r.title,r.date,r.time,r.location,m.released_at AS releasedAt,m.body AS releasedText,
    coalesce(json_extract(a.formal_json,'$.kind'),r.agenda_kind) AS kind,
    coalesce(json_extract(a.formal_json,'$.quorumStatus'),'unchecked') AS quorumStatus,
    coalesce(a.revision,0) AS agendaRevision,a.formal_json AS formal
    FROM meeting_register r LEFT JOIN member_minutes m ON m.meeting_id=r.id LEFT JOIN meeting_agendas a ON a.meeting_id=r.id WHERE r.id=?`).bind(id).first();
  if(!info)throw new HttpError(404,'This meeting could not be found.','not_found');
  const {formal,agendaRevision,...meta}=info;
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT * FROM meeting_notes WHERE id = ?').bind(id).first();
    return json({ meeting: meetingRecord(row,meta) });
  }
  if (request.method !== 'PUT') throw new HttpError(405, 'This action is not available.', 'method_not_allowed');
  const body = await bodyJson(request, 320000);
  onlyKeys(body, ['notes', 'actions', 'decisions', 'status', 'version','agendaVersion']);
  const notes = textField(body.notes, 'the meeting notes', 16000);
  if (!Number.isInteger(body.version) || body.version < 0 || body.version > 2147483646) throw new HttpError(400, 'Please reload the meeting before saving.', 'invalid_version');
  if (!Array.isArray(body.actions) || body.actions.length > 50) throw new HttpError(400, 'Please keep the action list to 50 items.', 'invalid_input');
  const seen = new Set();
  const actions = body.actions.map(action => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new HttpError(400, 'Please check the action list.', 'invalid_input');
    onlyKeys(action, ['id', 'text', 'owner', 'dueDate', 'done']);
    const id = textField(action.id, 'the action identifier', 64, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || seen.has(id) || typeof action.done !== 'boolean') throw new HttpError(400, 'Please check the action list.', 'invalid_input');
    seen.add(id);
    return { id, text: textField(action.text, 'the action', 500, true), owner: textField(action.owner, 'the action owner', 100), dueDate: dateField(action.dueDate, false), done: action.done };
  });
  const updatedAt = new Date().toISOString();
  const current = meetingRecord(await db.prepare('SELECT * FROM meeting_notes WHERE id=?').bind(id).first(),meta);
  if (current.version !== body.version) throw new HttpError(409,'Another committee member saved a newer version. Reload before saving.','version_conflict');
  const status = body.status ?? current.status;
  const approving = status === 'approved' && current.status === 'draft';
  if (approving && meta.kind==='agm' && meta.quorumStatus==='unchecked')
    throw new HttpError(400,'Record whether the AGM reached quorum before finalising its record. You can save the draft at any time.','agm_quorum_unchecked');
  if (approving && meta.kind==='agm' && meta.date>new Date(Date.now()+10*3600000).toISOString().slice(0,10))
    throw new HttpError(400,'Save this as a draft. You can confirm the record from the day of the AGM.','agm_in_future');
  const inputDecisions = body.decisions ?? current.decisions;
  if (!['draft','approved'].includes(status) || !Array.isArray(inputDecisions) || inputDecisions.length > 50) throw new HttpError(400,'Check the decisions and approval status.','invalid_input');
  const decisions = inputDecisions.map(value => textField(value,'the decision',500,true));
  if (meta.kind==='informal' && decisions.length && JSON.stringify(decisions)!==JSON.stringify(current.decisions))
    throw new HttpError(400,'Use the catch-up notes for suggestions and the action list for follow-ups. Formal resolutions belong in a separate meeting.','informal_decision');
  if (meta.kind!=='informal' && meta.quorumStatus!=='present' &&
    ((approving && meta.quorumStatus!=='lost' && decisions.length) || (formal && decisions.some(d=>!current.decisions.includes(d)))))
    throw new HttpError(400,'A new decision needs a quorum. Keep the adjournment and proposed next steps in the meeting record.','decision_without_quorum');
  const fixedActions = list => JSON.stringify(list.map(({id,text,owner,dueDate}) => [id,text,owner,dueDate]));
  if (current.status === 'approved' && (status !== 'approved' || notes !== current.notes || JSON.stringify(decisions) !== JSON.stringify(current.decisions) || fixedActions(actions) !== fixedActions(current.actions))) {
    throw new HttpError(409,'These minutes are approved. Follow-up completion can still be updated.','approved_record');
  }
  if (approving && (body.agendaVersion!==undefined || formal) && body.agendaVersion!==agendaRevision)
    throw new HttpError(409,'The agenda or proceedings have changed. Open the saved agenda and review it before confirming the record.','agenda_conflict');
  if (status === 'approved' && ((!notes && !containsProceedings(formal && JSON.parse(formal))) || actions.some(a => !a.owner || !a.dueDate)))
    throw new HttpError(400,'Add the reviewed meeting record and give each action an owner and a due date before confirming it.','incomplete_minutes');
  const approvedAt = approving ? updatedAt : current.approvedAt;
  const approvedBy = approving ? identity.id : current.approvedBy;
  const mutationId = crypto.randomUUID();
  const result = await db.batch([
    db.prepare(`INSERT INTO meeting_notes (id,notes,actions_json,decisions_json,status,approved_at,approved_by,version,updated_at,updated_by,last_mutation_id)
      SELECT ?,?,?,?,?,?,?,1,?,?,? WHERE (?=0 OR EXISTS (SELECT 1 FROM meeting_notes WHERE id=? AND version=?))
      AND (?=0 OR coalesce((SELECT revision FROM meeting_agendas WHERE meeting_id=?),0)=?)
      ON CONFLICT(id) DO UPDATE SET notes=excluded.notes,actions_json=excluded.actions_json,decisions_json=excluded.decisions_json,status=excluded.status,approved_at=excluded.approved_at,approved_by=excluded.approved_by,version=meeting_notes.version+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by,last_mutation_id=excluded.last_mutation_id WHERE meeting_notes.version=?`)
      .bind(id,notes,JSON.stringify(actions),JSON.stringify(decisions),status,approvedAt,approvedBy,updatedAt,identity.id,mutationId,body.version,id,body.version,
        Number(approving || decisions.length>0),id,agendaRevision,body.version),
    db.prepare('INSERT INTO audit_log (id, actor_id, actor_role, action, entity_id, occurred_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM meeting_notes WHERE id = ? AND last_mutation_id = ?)').bind(crypto.randomUUID(), identity.id, identity.role, approving ? 'minutes_approved' : 'meeting_updated', id, updatedAt, id, mutationId),
  ]);
  if (!result[0]?.meta?.changes) throw new HttpError(409, 'Someone saved a newer meeting draft. Reload the meeting before saving your changes.', 'version_conflict');
  return json({meeting:{...current,notes,actions,decisions,status,approvedAt,approvedBy,updatedAt,version:body.version+1}});
}

async function audit(request, env, identity) {
  requireRole(identity, ['committee']);
  if (request.method !== 'GET') throw new HttpError(405, 'This action is not available.', 'method_not_allowed');
  const db = requireDb(env);
  const result = await db.prepare('SELECT id, actor_id, actor_role, action, entity_id, occurred_at FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 50').all();
  return json({ audit: (result.results || []).map(row => ({ id: row.id, actorId: row.actor_id, actorRole: row.actor_role, action: row.action, entityId: row.entity_id, occurredAt: row.occurred_at })) });
}

export function handleRequest(request, env = {}) {
  return showcase(request,env,(req,settings)=>retireOfficerDemo(req,settings,serveClub),{json,bodyJson,HttpError})
    .catch(error=>error instanceof HttpError?json({error:error.message,code:error.code},error.status):json({error:'The demonstration service is temporarily unavailable.',code:'service_unavailable'},500));
}

async function serveClub(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const viewAs = request.headers.get('X-Sandy-View-As');
    if (path.startsWith('/api/') && viewAs !== null) {
      if (!['president','vicepresident','secretary','assistantsecretary','treasurer','member'].includes(viewAs))
        throw new HttpError(400, 'Choose a supported club view.', 'invalid_club_view');
      if (!['GET','HEAD'].includes(request.method))
        throw new HttpError(403, 'Role previews are view only. Return to the Webmaster workspace before making changes.', 'role_preview_read_only');
      const viewer = await passwordIdentity(request,env);
      if (!viewer?.administrator && !viewer?.realAdministrator)
        throw new HttpError(viewer?403:401, 'Webmaster sign-in is required for role previews.', 'not_authorised');
      if (path.startsWith('/api/accounts') || path.startsWith('/api/auth/'))
        throw new HttpError(403, 'Account administration is unavailable in a role preview.', 'role_preview_read_only');
    }
    if (path.startsWith('/api/auth/') || path === '/api/accounts' || path.startsWith('/api/accounts/')) {
      return await accountEndpoint(path,request,env,{json,bodyJson,HttpError});
    }
    const helpers={json,response,bodyJson,HttpError,requireRole,requireDb,textField,dateField};
    if(path==='/api/access-help'||path==='/api/access-help/status'||path==='/api/committee/access-help')
      return await webmasterHelpEndpoint(request,env,path==='/api/committee/access-help'?await passwordIdentity(request,env):null,helpers);
    if(path==='/api/committee/equipment'||path.startsWith('/api/committee/equipment/'))return await clubEquipmentEndpoint(request,env,await getIdentity(request,env),helpers);
    if(path==='/api/committee/equipment-wishes'||path==='/api/member/equipment-wishes')return await equipmentWishesEndpoint(request,env,await getIdentity(request,env),helpers);
    if(path==='/api/sponsor-offers'||path==='/api/committee/sponsors'||path.startsWith('/api/committee/sponsors/'))return await sponsorOffersEndpoint(request,env,path==='/api/sponsor-offers'?null:await getIdentity(request,env),helpers);
    if(path==='/api/member/recipes'||path.startsWith('/api/member/recipes/'))return await memberRecipesEndpoint(request,env,await getIdentity(request,env),helpers);
    if(path==='/api/member/meals'||path==='/api/meal-guest')return await sharedMealsEndpoint(request,env,await getIdentity(request,env),helpers);
    if(path==='/api/fees'||path==='/api/treasurer/fees'||path==='/api/committee/price-alerts')
      return await pricingEndpoint(path,request,env,path==='/api/fees'?null:await getIdentity(request,env),helpers);
    if(path==='/api/shop/offers'||path==='/api/shop/requests') return await merchOrdersEndpoint(request,env,null,helpers);
    if(path.startsWith('/api/shop/photos/'))return await shopPhotosEndpoint(request,env,null,helpers);
    if(path==='/api/stock/shop-photos'||path.startsWith('/api/stock/shop-photos/'))return await shopPhotosEndpoint(request,env,await getIdentity(request,env),helpers);
    if(path==='/api/stock/shop'||path.startsWith('/api/stock/shop/')||path.startsWith('/api/stock/requests/')) return await merchOrdersEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/applications' || path.startsWith('/api/applications/')) return await handleApplications(path,request,env,path==='/api/applications/apply'?null:await getIdentity(request,env),helpers);
    if (path === '/api/handoffs' || path.startsWith('/api/handoffs/')) return await handoffEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/operating-authority') return await operatingAuthority(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/news' || path === '/api/member/news') return await newslettersEndpoint(path,request,env,await getIdentity(request,env),helpers);
    if (path === '/api/member/lifecycle' || path === '/api/committee/lifecycle') return await lifecycleEndpoint(path,request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/social-planner') return await socialPlannerEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/social-brainstorm') return await socialBrainstormEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/events') return await fundraisingEventsEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path==='/api/member/calendar' || path.startsWith('/api/member/calendar/') || /^\/api\/committee\/events\/[\da-f-]+\/member-notice$/i.test(path))
      return await memberCalendarEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/member/safeguards'||path === '/api/committee/safeguards') return await memberSafeguardsEndpoint(request,env,await getIdentity(request,env),helpers);
    if (['/api/committee/returning-members','/api/member/returning-members','/api/returning-offer'].includes(path)) return await returningMembersEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/member/export'||path.startsWith('/api/member/export/')) return await memberExportEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/member/network'||path.startsWith('/api/member/network/')) return await memberNetworkEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/grants') return await grantRegisterEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/account/notice-email') return await noticeEmailProfile(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/notices') return await committeeNoticesEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/committee/todos') return await officerTodosEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/meetings/agm-jobs') return await agmJobs(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/meetings/reminders') return await meetingRemindersEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/meetings' || path.startsWith('/api/meetings/') || path === '/api/member/minutes') return await meetingRegister(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/meeting/assist') return await assistMinutes(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/community' || path.startsWith('/api/community/')) return await communityEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/library' || path.startsWith('/api/library/')) return await handleLibrary(request,env,await getIdentity(request,env));
    if (path === '/api/committee/membership-waivers/report' || path === '/api/committee/membership-waivers/report.csv') return await waiverReportEndpoint(request,env,await getIdentity(request,env),helpers);
    if (path === '/api/shop/catalogue') return await stockEndpoint(path,request,env,null,{json,bodyJson,HttpError,requireDb});
    if (path === '/api/stock' || path === '/api/stock/report' || path === '/api/stock/delivery-costs') {
      const identity = await getIdentity(request,env);
      requireRole(identity,['member','committee']);
      return await stockEndpoint(path,request,env,identity,{json,bodyJson,HttpError,requireDb});
    }
    if (path === '/api/session') {
      if (request.method !== 'GET') throw new HttpError(405, 'This action is not available.', 'method_not_allowed');
      const identity = await getIdentity(request, env);
      return json({authenticated:Boolean(identity),identity:identity?{id:identity.id,email:identity.email,name:identity.name}:null,role:identity?.role || 'anonymous',
        accountRole:identity?.accountRole||null,administrator:Boolean(identity?.administrator),webmasterViewer:Boolean(identity?.realAdministrator),
        viewAs:identity?.viewAs||null,readOnly:Boolean(identity?.readOnly),canManageStock:canManageStock(identity,env),paidThrough:identity?.paidThrough||null,storageReady:await storageReady(env),
        authMode:env.PRIVATE_AUTH_KEY?'password':env.AUTH_MODE==='access'?'access':'unconfigured',signInUrl:null});
    }
    if (path === '/api/club') {
      if (request.method !== 'GET') throw new HttpError(405, 'This action is not available.', 'method_not_allowed');
      return json({ club: CLUB, events: EVENTS, programme: PROGRAMME, competition: COMPETITION, features: FEATURES }, 200, { 'Cache-Control': 'public, max-age=300' });
    }
    if (path === '/calendar.ics' || /^\/calendar\/[^/]+\.ics$/.test(path)) {
      if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'This action is not available.', 'method_not_allowed');
      const eventId = path === '/calendar.ics' ? null : path.slice('/calendar/'.length, -4);
      const selected = eventId ? EVENTS.filter(event => event.id === eventId) : EVENTS;
      if (!selected.length) throw new HttpError(404, 'That event could not be found.', 'not_found');
      return response(request.method === 'HEAD' ? null : makeCalendar(selected), 200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${eventId || 'sandy-club-calendar'}.ics"`, 'Cache-Control': 'public, max-age=300' });
    }
    if (['/api/meeting', '/api/audit'].includes(path)) {
      const identity = await getIdentity(request, env);
      try {
        if (path === '/api/meeting') return await meeting(request, env, identity);
        return await audit(request, env, identity);
      }
      catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(503, 'Club storage is temporarily unavailable. Your changes were not confirmed. Please try again.', 'storage_unavailable'); }
    }
    if (path.startsWith('/api/')) throw new HttpError(404, 'That service could not be found.', 'not_found');
    if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'This action is not available.', 'method_not_allowed');
    if (env.ASSETS) return await env.ASSETS.fetch(request);
    return json({ error: 'That page could not be found.', code: 'not_found' }, 404);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message, code: error.code }, error.status);
    return json({ error: 'The club service could not complete that request. Please try again.', code: 'service_unavailable' }, 500);
  }
}

export default {
  fetch: handleRequest,
  scheduled(event,env,ctx) {
    const at=new Date(event.scheduledTime);
    ctx.waitUntil(runMeetingReminders(env,at));
    ctx.waitUntil(runNoticeEmail(env,at));
    if(at.getUTCMinutes()===0)ctx.waitUntil(runMemberCycle(env,at));
  }
};
