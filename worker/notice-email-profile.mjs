import {noticeEmailReady,sendNoticeEmail} from './notice-email.mjs';

const validEmail = /^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/;
const normalise = value => typeof value==='string' ? value.trim().toLowerCase() : '';
async function codeHash(id,email,code,secret) {
  const bytes=new TextEncoder().encode(JSON.stringify([secret,id,email,code]));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function noticeEmailProfile(request,env,identity,h,deliver=sendNoticeEmail) {
  h.requireRole(identity,['member','committee']);
  const storage=h.requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  const fail=(status,message)=>{throw new h.HttpError(status,message,'notice_email');};
  const id=identity.id,now=Date.now(),stamp=new Date(now).toISOString();
  const account=await db.prepare(`SELECT a.id,p.contact_email AS contact,
    (coalesce(c.age_band,'')='under16' OR coalesce(p.membership_type,'') IN ('junior','cadet')) AS guardian
    FROM club_accounts a LEFT JOIN member_profiles p ON p.account_id=a.id
    LEFT JOIN member_age_checks c ON c.account_id=a.id WHERE a.id=? AND a.disabled=0`).bind(id).first();
  if(!account)fail(403,'Use your individual clubhouse account to set up email.');
  const ready=noticeEmailReady(env),guardian=Boolean(account.guardian),contact=normalise(account.contact);
  const getChoices=()=>db.prepare('SELECT email,important,weekly FROM notice_email_choices WHERE account_id=?').bind(id).first();
  const getPending=()=>db.prepare('SELECT * FROM notice_email_pending WHERE account_id=?').bind(id).first();
  async function read(){
    const [choice,pending]=await Promise.all([getChoices(),getPending()]);
    const row=pending||choice;
    const applies=row && (!guardian||row.email===contact);
    return h.json({email:guardian?contact:row?.email||contact,important:applies?Boolean(row.important):false,
      weekly:applies?Boolean(row.weekly):false,verified:Boolean(applies && !pending && choice),
      pendingCode:Boolean(applies && pending?.code_hash && pending.expires_at>now && pending.tries<5),
      senderReady:ready,guardian,webmaster:Boolean(identity.administrator)});
  }
  if(request.method==='GET')return read();
  if(request.method!=='POST')fail(405,'Open your email choices to make a change.');
  const b=await h.bodyJson(request);
  if(b.action==='confirm'){
    if(typeof b.code!=='string'||!/^\d{6}$/.test(b.code))fail(400,'Enter the six digits from the club email.');
    const pending=await getPending();
    if(!pending?.code_hash || pending.expires_at<=now || pending.tries>=5 || (guardian && pending.email!==contact))
      fail(409,'Request a fresh code for your current address.');
    const hash=await codeHash(id,pending.email,b.code,env.PRIVATE_AUTH_KEY||'');
    const [saved]=await db.batch([
      db.prepare(`INSERT INTO notice_email_choices(account_id,email,important,weekly,enabled_at)
        SELECT account_id,email,important,weekly,? FROM notice_email_pending
        WHERE account_id=? AND code_hash=? AND expires_at>? AND tries<5
        ON CONFLICT(account_id) DO UPDATE SET email=excluded.email,important=excluded.important,weekly=excluded.weekly,enabled_at=excluded.enabled_at`)
        .bind(stamp,id,hash,now),
      db.prepare('DELETE FROM notice_email_pending WHERE account_id=? AND code_hash=? AND changes()=1').bind(id,hash),
      db.prepare('UPDATE notice_email_pending SET tries=tries+1 WHERE account_id=? AND code_hash=? AND tries<5').bind(id,pending.code_hash)
    ]);
    if(!saved.meta.changes)fail(400,'That code did not match. Check the latest email and try again.');
    return read();
  }
  if(b.action!=='save'||typeof b.important!=='boolean'||typeof b.weekly!=='boolean')fail(400,'Choose which emails you would like to receive.');
  const email=normalise(b.email),important=+b.important,weekly=+b.weekly;
  if((email||important||weekly) && (email.length>254||!validEmail.test(email)))fail(400,'Enter a valid email address.');
  if(guardian && email!==contact)fail(403,'Ask the committee to update the guardian email on your membership.');
  const choice=await getChoices();
  if(choice && choice.email===email){
    await db.batch([db.prepare(`UPDATE notice_email_choices SET important=?,weekly=?,
      enabled_at=CASE WHEN important=0 AND weekly=0 AND (? OR ?) THEN ? ELSE enabled_at END WHERE account_id=? AND email=?`)
      .bind(important,weekly,important,weekly,stamp,id,email),db.prepare('DELETE FROM notice_email_pending WHERE account_id=?').bind(id)]);
    return read();
  }
  // Keep unconfirmed choices separate from every address the mailer can use.
  const sendCode=ready && Boolean(important||weekly);
  const code=sendCode?String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'):'';
  const hash=sendCode?await codeHash(id,email,code,env.PRIVATE_AUTH_KEY||''):'';
  const [saved]=await db.batch([
    db.prepare(`INSERT INTO notice_email_pending(account_id,email,important,weekly,code_hash,attempted_at,expires_at,tries)
      VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(account_id) DO UPDATE SET email=excluded.email,important=excluded.important,
      weekly=excluded.weekly,code_hash=excluded.code_hash,tries=0,expires_at=excluded.expires_at,
      attempted_at=CASE WHEN excluded.code_hash IS NULL THEN attempted_at ELSE excluded.attempted_at END
      WHERE excluded.code_hash IS NULL OR attempted_at<=?`).bind(id,email,important,weekly,hash||null,sendCode?now:0,sendCode?now+1200000:0,now-120000),
    db.prepare('DELETE FROM notice_email_choices WHERE account_id=? AND changes()=1').bind(id)
  ]);
  if(!saved.meta.changes)fail(429,'A code was requested recently. Wait two minutes before requesting another.');
  if(sendCode){
    try{
      await deliver(env,{to:email,subject:'Confirm your Sandy Sports email',text:'Your Sandy Sports Club confirmation code is '+code+'. Enter it in your clubhouse profile within 20 minutes. If someone else entered your address, you can ignore this email.',key:'sandy-confirm-'+crypto.randomUUID()});
    }catch{
      await db.prepare('UPDATE notice_email_pending SET code_hash=NULL,expires_at=0 WHERE account_id=? AND code_hash=?').bind(id,hash).run();
      fail(503,'Your choices are saved. The club could not send the code. Try again in two minutes.');
    }
  }
  return read();
}
