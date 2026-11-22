const minute = 60_000;
const hour = 60 * minute;
const week = 7 * 24 * hour;
const clubGmail = env => String(env.NOTICE_GMAIL_FROM || '').trim().toLowerCase();
function transport(env) {
  let origin;
  try { origin=new URL(env.NOTICE_SITE_ORIGIN); } catch { return ''; }
  if(origin.protocol!=='https:')return '';
  const gmail = [env.NOTICE_GMAIL_CLIENT_ID,env.NOTICE_GMAIL_CLIENT_SECRET,env.NOTICE_GMAIL_REFRESH_TOKEN].every(value=>value?.trim())
    && /^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/.test(clubGmail(env));
  const resend = Boolean(env.RESEND_API_KEY?.trim() && env.NOTICE_EMAIL_FROM?.trim());
  if (env.NOTICE_EMAIL_PROVIDER) {
    if (env.NOTICE_EMAIL_PROVIDER==='gmail' && gmail) return 'gmail';
    if (env.NOTICE_EMAIL_PROVIDER==='resend' && resend) return 'resend';
    return '';
  }
  return gmail ? 'gmail' : resend ? 'resend' : '';
}
export const noticeEmailReady = env => Boolean(transport(env));

function base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function gmailToken(env, fetcher) {
  const auth = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(12_000),
    body:new URLSearchParams({grant_type:'refresh_token',client_id:env.NOTICE_GMAIL_CLIENT_ID,
      client_secret:env.NOTICE_GMAIL_CLIENT_SECRET,refresh_token:env.NOTICE_GMAIL_REFRESH_TOKEN})});
  if (!auth.ok) throw new Error('The club mailbox needs to be reconnected.');
  const {access_token:token} = await auth.json();
  if (!token) throw new Error('The club mailbox needs to be reconnected.');
  const check = await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{
    headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12_000)});
  if (!check.ok) throw new Error('The club mailbox could not be verified.');
  const user = await check.json();
  if (user.email_verified!==true || user.email?.toLowerCase()!==clubGmail(env)) throw new Error('Connect the verified Sandy Sports mailbox to send club email.');
  return token;
}

async function gmailMessage(to, subject, text, key, from) {
  if (!/^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/.test(to)) throw new Error('The recipient address is invalid.');
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
  const id = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const lines = ['From: Sandy Sports Club <'+from+'>','To: '+to,'Subject: =?UTF-8?B?'+base64(subject)+'?=',
    'Date: '+new Date().toUTCString(),'Message-ID: <'+id+'@gmail.com>','MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',
    base64(text.replace(/\r?\n/g,'\r\n')).match(/.{1,76}/g)?.join('\r\n') || ''];
  return base64(lines.join('\r\n')).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

// Never return provider request bodies or email addresses in errors.
export async function sendNoticeEmail(env, {to,subject,text,key}, fetcher = fetch, beforeGmailSend = async()=>{}) {
  const provider = transport(env);
  if (!provider) throw new Error('Club email delivery is awaiting setup.');
  let response;
  if (provider==='gmail') {
    const token = await gmailToken(env,fetcher);
    const raw = await gmailMessage(to,subject,text,key,clubGmail(env));
    await beforeGmailSend();
    response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({raw}),signal:AbortSignal.timeout(15_000)});
  } else response = await fetcher('https://api.resend.com/emails', {
    method:'POST',
    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify({from:env.NOTICE_EMAIL_FROM,to:[to],subject,text}),
    signal:AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const error = new Error('The email service could not accept the message.');
    error.status = response.status;
    const delay = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(delay) && delay > 0) error.retryAfter = delay * 1000;
    throw error;
  }
  const receipt = await response.json();
  if (typeof receipt.id !== 'string' || !receipt.id) throw new Error('The email service did not confirm acceptance.');
  return receipt.id;
}

// Most recent Monday 08:00 in Queensland. A delayed cron can still pick up
// that week's digest without sending an extra one.
function weekEnding(now) {
  const local = new Date(+now + 10*hour);
  const monday = Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-(local.getUTCDay()+6)%7,8)-10*hour;
  return now < monday ? monday-week : monday;
}

async function queueMail(db, now, day) {
  const stamp = now.toISOString();
  const cutoff = weekEnding(now);
  const from = new Date(cutoff-week).toISOString(), until = new Date(cutoff).toISOString();
  const item = "json_object('key',i.item_key,'section',i.section,'title',i.title)";
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO notice_email_outbox(account_id,enabled_at,kind,event_key,items_json)
      SELECT c.account_id,c.enabled_at,'important',i.item_key,json_array(${item}) FROM notice_email_items i
      JOIN notice_email_recipients c ON c.account_id=i.account_id AND c.important=1
      WHERE i.important=1 AND i.posted_at>=c.important_since AND i.posted_at<=?1 AND ?2 BETWEEN i.visible_from AND i.visible_until
        AND NOT EXISTS (SELECT 1 FROM notice_email_outbox q WHERE q.account_id=c.account_id AND q.kind='important' AND q.event_key=i.item_key)`).bind(stamp,day),
    db.prepare(`INSERT OR IGNORE INTO notice_email_outbox(account_id,enabled_at,kind,event_key,items_json)
      SELECT account_id,enabled_at,'weekly',?1,json_group_array(json(item)) FROM (
        SELECT c.account_id,c.enabled_at,${item} AS item FROM notice_email_delivery_items i
        JOIN notice_email_recipients c ON c.account_id=i.account_id AND c.weekly=1
        WHERE i.posted_at>=c.weekly_since AND i.posted_at>=?2 AND i.posted_at<?1 AND ?3 BETWEEN i.visible_from AND i.visible_until
          AND NOT EXISTS (SELECT 1 FROM notice_email_outbox q WHERE q.account_id=c.account_id AND q.kind='weekly' AND q.event_key=?1)
        ORDER BY i.posted_at DESC,i.item_key
      ) GROUP BY account_id,enabled_at`).bind(until,from,day)
  ]);
}

function message(env, row, items) {
  const origin = new URL(env.NOTICE_SITE_ORIGIN);
  if (origin.protocol !== 'https:') throw new Error('Club email links require a secure website.');
  const important = row.kind === 'important';
  const intro = important ? 'The club marked this update as important.' : 'Here are your club updates from the past week.';
  const parts = [intro];
  const locations = {'Club inbox':'clubhouse.html#members/notices','Committee noticeboard':'clubhouse.html#committee/notices','Prices':'clubhouse.html#committee','Webmaster help requests':'clubhouse.html?inbox=webmaster-help#committee/notices','Secretary copies of Webmaster requests':'clubhouse.html?inbox=webmaster-help#committee/notices'};
  for (const [section,route] of Object.entries(locations)) {
    const group = items.filter(item => item.section===section);
    if (!group.length) continue;
    const titles = group.map(item => 'Ã¢â‚¬Â¢ '+item.title.replace(/\s+/g,' ').trim());
    parts.push(section+'\n'+titles.join('\n')+'\n'+origin.origin+'/'+route);
  }
  const settings = row.role === 'member' ? 'clubhouse.html#members/notices' : 'clubhouse.html#committee/notices';
  parts.push('To change or stop these emails, sign in and open Email alerts.\n'+origin.origin+'/'+settings);
  return {to:row.email,subject:important ? 'Sandy Sports | Important club update' : 'Sandy Sports | Your weekly club updates',text:parts.join('\n\n'),key:'sandy-notices/'+row.provider_key};
}

async function finish(db,id,lease,state,stamp,receipt=null) {
  await db.prepare(`UPDATE notice_email_outbox SET state=?,completed_at=?,provider_id=?,lease=NULL,items_json='[]'
    WHERE id=? AND lease=? AND state='pending'`).bind(state,stamp,receipt,id,lease).run();
}

async function deliver(db, env, candidate, now, day, fetcher) {
  const stamp = now.toISOString(), lease = crypto.randomUUID();
  const provider = transport(env);
  const row = await db.prepare(`UPDATE notice_email_outbox SET lease=?,next_try=?,first_attempt=coalesce(first_attempt,?),provider=coalesce(provider,?),attempts=attempts+1
    WHERE id=? AND state='pending' AND next_try<=? RETURNING *`)
    .bind(lease,new Date(+now+2*minute).toISOString(),stamp,provider,candidate.id,stamp).first();
  if (!row) return 'busy';
  // Resend holds a key for 24 hours. An uncertain handoff past that window
  // needs checking against the provider instead of risking a second email.
  if (row.gmail_started || row.provider!==provider || (row.provider==='resend' && +now-Date.parse(row.first_attempt)>=23*hour)) {
    await finish(db,row.id,lease,'check',stamp);
    return 'check';
  }
  const [recipients, visible] = await db.batch([
    db.prepare(`SELECT email,role FROM notice_email_recipients WHERE account_id=? AND enabled_at=? AND
      ((?='important' AND important=1) OR (?='weekly' AND weekly=1))`).bind(row.account_id,row.enabled_at,row.kind,row.kind),
    db.prepare(`SELECT i.item_key,i.title FROM json_each(?) j JOIN notice_email_delivery_items i ON i.item_key=json_extract(j.value,'$.key')
      AND i.account_id=? JOIN notice_email_recipients c ON c.account_id=i.account_id WHERE ? BETWEEN i.visible_from AND i.visible_until
      AND i.posted_at>=CASE WHEN ?='important' THEN c.important_since ELSE c.weekly_since END`).bind(row.items_json,row.account_id,day,row.kind)
  ]);
  const currentTitles = new Map(visible.results.map(item=>[item.item_key,item.title]));
  const original = JSON.parse(row.items_json);
  const items = original.filter(item=>currentTitles.has(item.key)).map(item=>({...item,title:currentTitles.get(item.key)}));
  const changed = original.length!==items.length || original.some(item=>item.title!==currentTitles.get(item.key));
  if (!recipients.results.length || !items.length || (changed && row.attempts>1 && provider==='resend')) {
    await finish(db,row.id,lease,'cancelled',stamp);
    return 'cancelled';
  }
  if (changed) {
    await db.prepare('UPDATE notice_email_outbox SET items_json=? WHERE id=? AND lease=?').bind(JSON.stringify(items),row.id,lease).run();
  }
  let receipt;
  let gmailStarted = false;
  try {
    receipt = await sendNoticeEmail(env,message(env,{...row,...recipients.results[0]},items),fetcher,async()=>{
      // Gmail has no idempotency endpoint. Persist the boundary before the
      // network call so a crash or lost acknowledgement can never double-send.
      const armed = await db.prepare(`UPDATE notice_email_outbox SET gmail_started=1 WHERE id=? AND lease=? AND state='pending' AND gmail_started=0
        AND EXISTS (SELECT 1 FROM notice_email_recipients c WHERE c.account_id=notice_email_outbox.account_id
          AND c.enabled_at=notice_email_outbox.enabled_at AND c.email=? AND
          ((kind='weekly' AND c.weekly=1) OR (kind='important' AND c.important=1)))`)
        .bind(row.id,lease,recipients.results[0].email).run();
      if (!armed.meta.changes) throw new Error('The email delivery claim has expired.');
      gmailStarted = true;
    });
  } catch (error) {
    if (gmailStarted && (!error.status || error.status===408 || error.status>=500)) {
      await finish(db,row.id,lease,'check',stamp);
      return 'check';
    }
    if ([400,404,422].includes(error.status)) {
      await finish(db,row.id,lease,'failed',stamp);
      return 'failed';
    }
    const delay = Math.max(Math.min(60,5*2**Math.min(row.attempts-1,4))*minute,Math.min(error.retryAfter || 0,23*hour));
    await db.prepare('UPDATE notice_email_outbox SET lease=NULL,next_try=?,gmail_started=0 WHERE id=? AND lease=?')
      .bind(new Date(+now+delay).toISOString(),row.id,lease).run();
    return error.status===429 ? 'throttled' : 'retry';
  }
  // A database outage after provider acceptance retries with the same key.
  await finish(db,row.id,lease,'sent',stamp,receipt);
  return 'sent';
}

export async function runNoticeEmail(env, now = new Date(), {fetcher=fetch} = {}) {
  if (!noticeEmailReady(env)) return {configured:false,sent:0};
  const db = env.DB?.withSession ? env.DB.withSession('first-primary') : env.DB;
  if (!db) throw new Error('Club email storage is unavailable.');
  const day = new Date(+now+10*hour).toISOString().slice(0,10);
  await queueMail(db,now,day);
  const {results} = await db.prepare(`SELECT id FROM notice_email_outbox WHERE state='pending' AND next_try<=?
    ORDER BY attempts,id LIMIT 5`).bind(now.toISOString()).all();
  const summary = {configured:true,sent:0};
  for (const candidate of results) {
    const state = await deliver(db,env,candidate,now,day,fetcher);
    summary[state] = (summary[state] || 0)+1;
    if (state==='throttled') break;
  }
  return summary;
}
