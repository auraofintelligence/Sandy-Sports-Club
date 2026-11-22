const ageBands = new Set(['unconfirmed', 'under16', '16+']);
const officerFields = `SELECT a.id AS accountId,a.login,COALESCE(c.age_band,'unconfirmed') AS ageBand,
  COALESCE(c.guardian_permission,0) AS guardianPermission,COALESCE(c.version,0) AS version,c.verified_at AS verifiedAt
  FROM club_accounts a LEFT JOIN member_age_checks c ON c.account_id=a.id WHERE a.role='member'`;

export async function memberSafeguardFlags(db, accountId) {
  const row = await db.prepare('SELECT * FROM member_safeguard_flags WHERE accountId=?').bind(accountId).first();
  return {
    ageBand: row?.ageBand || 'unconfirmed', guardianPermission: Boolean(row?.guardianPermission),
    accepted: Boolean(row?.accepted), termsVersion: row?.termsVersion || '', version: row?.version || 0,
    socialAccess: Boolean(row?.socialAccess), canEnterHonours: Boolean(row?.canEnterHonours),
    canUseJournal: Boolean(row?.canUseJournal)
  };
}

export async function memberSafeguardsEndpoint(request, env, identity, {requireRole,requireDb,bodyJson,HttpError,json}) {
  const url = new URL(request.url);
  const committee = url.pathname === '/api/committee/safeguards';
  requireRole(identity, committee ? ['committee'] : ['member']);
  const storage = requireDb(env), db = storage.withSession ? storage.withSession('first-primary') : storage;
  const fail = (status, message) => { throw new HttpError(status, message, 'membership_safeguards'); };
  const changed = () => fail(409, 'This record has changed. Refresh it before saving.');
  const validate = (body, fields) => {
    if (!Number.isSafeInteger(body.version) || body.version < 0 || Object.keys(body).some(key => !fields.includes(key)))
      fail(400, 'Check the choices on this form and try again.');
  };
  const audit = (action, id, time) => db.prepare(`INSERT INTO audit_log(id,actor_id,actor_role,action,entity_id,occurred_at)
    SELECT ?,?,?,?,?,? WHERE changes()=1`).bind(crypto.randomUUID(),identity.id,identity.role,action,id,time);
  if (!committee) {
    const own = await memberSafeguardFlags(db,identity.id);
    if (!own.termsVersion || identity.accountRole !== 'member') fail(403, 'Use a current paid member account to check your choices.');
    if (request.method === 'GET') return json(own);
    if (request.method !== 'POST') fail(405, 'Open the member safety page to change your choice.');
    const body = await bodyJson(request,2048);
    validate(body,['action','termsVersion','version']);
    if (!['accept','withdraw'].includes(body.action) || typeof body.termsVersion !== 'string') fail(400, 'Choose whether to accept or withdraw.');
    const accept = body.action === 'accept';
    if (accept && (own.ageBand !== '16+' || body.termsVersion !== own.termsVersion))
      fail(own.ageBand !== '16+' ? 403 : 409, 'Read the current terms after the committee confirms your 16+ age group.');
    if (own.version !== body.version) changed();
    if (own.accepted === accept) return json(own);
    const time = new Date().toISOString();
    const update = db.prepare(`INSERT INTO member_terms_acceptance(account_id,terms_version,accepted,version,updated_at)
      SELECT accountId,termsVersion,?,version+1,? FROM member_safeguard_flags
      WHERE accountId=? AND paid=1 AND version=? AND (?=0 OR (ageBand='16+' AND termsVersion=?))
      ON CONFLICT(account_id) DO UPDATE SET terms_version=excluded.terms_version,accepted=excluded.accepted,
        version=excluded.version,updated_at=excluded.updated_at WHERE member_terms_acceptance.version=?`)
      .bind(+accept,time,identity.id,body.version,+accept,body.termsVersion,body.version);
    const [result] = await db.batch([update,audit(accept?'member_terms_accepted':'member_terms_withdrawn',identity.id,time)]);
    if (!result.meta.changes) changed();
    return json(await memberSafeguardFlags(db,identity.id));
  }

  const shape = row => ({...row,guardianPermission:Boolean(row.guardianPermission)});
  if (request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return json({members:[]});
    if (q.length > 96) fail(400, 'Use the member’s club sign-in name.');
    const result = await db.prepare(officerFields+' AND instr(lower(a.login),lower(?))>0 ORDER BY a.login LIMIT 30').bind(q).all();
    return json({members:result.results.map(shape)});
  }
  if (request.method !== 'POST') fail(405,'Open the committee membership desk to update a check.');
  const body = await bodyJson(request,2048);
  validate(body,['action','accountId','version','ageBand','guardianPermission','ageCheckedOffline','guardianCheckedOffline']);
  if (body.action !== 'verify' || typeof body.accountId !== 'string' || !ageBands.has(body.ageBand) ||
      typeof body.guardianPermission !== 'boolean' || (body.guardianPermission && body.ageBand !== 'under16'))
    fail(400, 'Choose an age group. Guardian permission applies to the under 16 group.');
  const get = () => db.prepare(officerFields+' AND a.id=?').bind(body.accountId).first();
  const row = await get();
  if (!row) fail(404, 'This member record could not be found.');
  if (row.version !== body.version) changed();
  if (body.ageBand !== 'unconfirmed' && row.ageBand !== body.ageBand && body.ageCheckedOffline !== true)
    fail(400, 'Confirm you have checked the age group with the member or guardian.');
  if (body.guardianPermission && !row.guardianPermission && body.guardianCheckedOffline !== true)
    fail(400, 'Check the guardian’s permission directly before recording it.');
  if (row.ageBand === body.ageBand && Boolean(row.guardianPermission) === body.guardianPermission) return json({member:shape(row)});
  const time = new Date().toISOString();
  const update = db.prepare(`INSERT INTO member_age_checks(account_id,age_band,guardian_permission,version,verified_at,verified_by)
    SELECT a.id,?,?,?, ?,? FROM club_accounts a LEFT JOIN member_age_checks c ON c.account_id=a.id
    WHERE a.role='member' AND a.id=? AND COALESCE(c.version,0)=?
    ON CONFLICT(account_id) DO UPDATE SET age_band=excluded.age_band,guardian_permission=excluded.guardian_permission,
      version=excluded.version,verified_at=excluded.verified_at,verified_by=excluded.verified_by WHERE member_age_checks.version=?`)
    .bind(body.ageBand,+body.guardianPermission,body.version+1,time,identity.id,body.accountId,body.version,body.version);
  const [result] = await db.batch([update,audit('member_age_permission_updated',body.accountId,time)]);
  if (!result.meta.changes) changed();
  return json({member:shape(await get())});
}
