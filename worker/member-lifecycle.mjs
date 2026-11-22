const types = ['adult','cadet','junior','social','casual','lifetime','unconfirmed'];
const topics = {general:'general_notices',meeting:'meetings',competition:'competitions',working_bee:'working_bees'};
const today = (now = new Date()) => new Date(+now + 10*3600000).toISOString().slice(0,10);
// A 29 February birthday is observed on the last day of February every year.
export const birthdayDue = daySql => `(p.birthday_md=substr(${daySql},6) OR (p.birthday_md='02-29'
  AND substr(${daySql},6)='02-28' AND substr(date(${daySql},'+1 day'),6)='03-01'))`;
const monthEnd = n => `date(a.paid_through,'start of month','+${n} months',
  '+'||(min(CAST(strftime('%d',a.paid_through) AS INTEGER),
  CAST(strftime('%d',date(a.paid_through,'start of month','+${n+1} months','-1 day')) AS INTEGER))-1)||' days')`;

export async function runMemberCycle(env, at = new Date()) {
  if (!env.DB) throw new Error('Member database is unavailable');
  const db=env.DB, day=today(at);
  const clock=await db.prepare('SELECT completed_day FROM member_cycle_clock WHERE id=1').first();
  if(clock?.completed_day===day) return;
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO member_newsletter_jobs(month) VALUES (?)').bind(day.slice(0,7)),
    db.prepare(`UPDATE member_numbers SET account_id=NULL,released_day=? WHERE account_id IN
      (SELECT a.id FROM club_accounts a WHERE a.role='member' AND (a.disabled=1 OR (a.paid_through IS NOT NULL AND ? >= ${monthEnd(3)})))`).bind(day,day),
    db.prepare(`WITH waiting AS (SELECT a.id, ROW_NUMBER() OVER(ORDER BY a.created_at,a.id) AS rn
      FROM club_accounts a JOIN member_profiles p ON p.account_id=a.id LEFT JOIN member_numbers n ON n.account_id=a.id
      WHERE a.disabled=0 AND a.paid_through>=? AND n.number IS NULL),
      released AS (SELECT number,ROW_NUMBER() OVER(ORDER BY number) AS rn FROM member_numbers WHERE account_id IS NULL),
      bounds AS (SELECT max(s.number_start-1,coalesce((SELECT MAX(number) FROM member_numbers),0)) AS high, (SELECT count(*) FROM released) AS free
      FROM member_lifecycle_settings s WHERE s.number_start IS NOT NULL)
      INSERT INTO member_numbers(number,account_id,assigned_day)
      SELECT coalesce(r.number,b.high+w.rn-b.free),w.id,? FROM waiting w CROSS JOIN bounds b LEFT JOIN released r ON r.rn=w.rn WHERE 1
      ON CONFLICT(number) DO UPDATE SET account_id=excluded.account_id,assigned_day=excluded.assigned_day,released_day=NULL WHERE member_numbers.account_id IS NULL`).bind(day,day),
    db.prepare(`INSERT OR IGNORE INTO member_notices(id,account_id,kind,title,body,issue_day,cycle)
      SELECT 'birthday:'||p.account_id||':'||substr(?1,1,4),p.account_id,'birthday','Happy birthday from Sandy Sports Club','The club wishes you a happy birthday and a wonderful day.',?1,substr(?1,1,4)
      FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id WHERE a.disabled=0 AND a.paid_through>=?1 AND ${birthdayDue('?1')}`).bind(day),
    db.prepare(`INSERT OR IGNORE INTO member_birthday_gifts(code,account_id,issue_year,valid_until,kind,value,terms,approval_reference)
      SELECT upper(hex(randomblob(8))),n.account_id,n.cycle,date(?1,'+'||(s.offer_days-1)||' days'),s.offer_kind,s.offer_value,s.offer_terms,s.offer_reference
      FROM member_notices n JOIN member_profiles p ON p.account_id=n.account_id JOIN club_accounts a ON a.id=p.account_id
      CROSS JOIN member_lifecycle_settings s WHERE n.kind='birthday' AND n.issue_day=?1 AND s.offer_kind IS NOT NULL
      AND a.disabled=0 AND a.paid_through>=?1 AND ${birthdayDue('?1')}`).bind(day),
    db.prepare(`WITH times AS (SELECT a.id,a.paid_through,CASE
      WHEN ?1>${monthEnd(3)} OR ?1<date(a.paid_through,'-30 days') THEN NULL
      WHEN ?1>=${monthEnd(3)} THEN 'window-closed'
      WHEN ?1>=${monthEnd(2)} THEN 'second-month'
      WHEN ?1>=${monthEnd(1)} THEN 'first-month'
      WHEN ?1>a.paid_through THEN 'lapsed' WHEN ?1=a.paid_through THEN 'expiry'
      WHEN ?1>=date(a.paid_through,'-7 days') THEN 'seven' ELSE 'thirty' END AS stage
      FROM club_accounts a JOIN member_profiles p ON p.account_id=a.id WHERE a.disabled=0 AND a.paid_through IS NOT NULL AND p.membership_type <> 'lifetime')
      INSERT OR IGNORE INTO member_notices(id,account_id,kind,title,body,issue_day,cycle)
      SELECT 'renew:'||id||':'||paid_through||':'||stage,id,'renewal',
      CASE WHEN stage='window-closed' THEN 'Your renewal reminder window has ended' WHEN ?1>paid_through THEN 'Your membership has lapsed' ELSE 'Membership renewal reminder' END,
      'Your current membership is valid through '||paid_through||'. Contact the treasurer to arrange or confirm renewal.',?1,paid_through FROM times WHERE stage IS NOT NULL`).bind(day),
    db.prepare(`DELETE FROM member_delivery_queue WHERE notice_id IN
      (SELECT n.id FROM member_notices n JOIN club_accounts a ON a.id=n.account_id WHERE n.kind='renewal'
      AND (? > ${monthEnd(3)} OR EXISTS (SELECT 1 FROM member_notices newer WHERE newer.account_id=n.account_id
      AND newer.kind='renewal' AND newer.issue_day>n.issue_day)))`).bind(day),
    db.prepare('UPDATE member_cycle_clock SET completed_day=? WHERE id=1').bind(day),
  ]);
}

const text = (value,max) => typeof value==='string' && value.trim().length<=max ? value.trim() : '';
const int = (value,min,max) => Number.isSafeInteger(value) && value>=min && value<=max;
const okDate = value => typeof value==='string' && /^\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse('2000-'+value+'T00:00:00Z')) && new Date('2000-'+value+'T00:00:00Z').toISOString().slice(5,10)===value;

function inboxCount(db,id,lapsed) {
  return db.prepare("SELECT count(*) AS total FROM member_notices WHERE account_id=? AND read_at IS NULL AND (?=0 OR kind IN ('renewal','payment'))").bind(id,+lapsed);
}

async function memberData(db,id,day,lapsed) {
  const [profile,notices,gifts,unread] = await db.batch([
    db.prepare(`SELECT p.membership_type AS type,p.general_notices AS generalNotices,p.newsletters,p.meetings,p.competitions,p.working_bees AS workingBees,
      p.birthday_md AS birthday,p.pref_email AS emailEnabled,p.contact_email AS email,p.contact_mobile AS mobile,
      p.revision,p.pack_stage AS packStage,p.pack_method AS packMethod,n.number,a.paid_through AS paidThrough,date(a.created_at,'unixepoch','+10 hours') AS joined
      FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id LEFT JOIN member_numbers n ON n.account_id=p.account_id WHERE p.account_id=? AND a.disabled=0`).bind(id),
    db.prepare("SELECT n.id,n.kind,n.title,n.body,n.issue_day AS day,n.read_at AS readAt,coalesce(b.important,0) AS important FROM member_notices n LEFT JOIN member_bulletins b ON n.id LIKE 'bulletin:%' AND b.id=substr(n.id,10,length(n.id)-length(n.account_id)-10) WHERE n.account_id=? AND (?=0 OR n.kind IN ('renewal','payment')) ORDER BY (n.read_at IS NULL) DESC,coalesce(b.important,0) DESC,n.issue_day DESC,n.rowid DESC LIMIT 60").bind(id,+lapsed),
    db.prepare('SELECT code,valid_until AS validUntil,kind,value,terms,redeemed_at AS redeemedAt FROM member_birthday_gifts WHERE account_id=? AND valid_until>=? AND ?=0 ORDER BY issue_year DESC').bind(id,day,+lapsed),
    inboxCount(db,id,lapsed),
  ]);
  return {profile:profile.results[0]??null,notices:notices.results,gifts:gifts.results,unread:unread.results[0].total};
}

async function committeeData(db,day) {
  const [settings,members,queue,newsletter,bulletins] = await db.batch([
    db.prepare('SELECT number_start AS numberStart,number_reference AS numberReference,offer_kind AS offerKind,offer_value AS offerValue,offer_terms AS offerTerms,offer_days AS offerDays,offer_reference AS offerReference FROM member_lifecycle_settings WHERE id=1'),
    db.prepare(`SELECT a.id,a.login,p.membership_type AS type,p.pack_stage AS packStage,p.pack_method AS packMethod,a.paid_through AS paidThrough,n.number
      FROM club_accounts a JOIN member_profiles p ON p.account_id=a.id LEFT JOIN member_numbers n ON n.account_id=a.id WHERE a.disabled=0 ORDER BY a.login`),
    db.prepare(`SELECT q.channel,count(*) AS pending FROM member_delivery_queue q JOIN member_notices n ON n.id=q.notice_id
      JOIN club_accounts a ON a.id=n.account_id WHERE a.disabled=0 AND q.channel='email' GROUP BY q.channel`),
    db.prepare('SELECT month,published_by AS publishedBy FROM member_newsletter_jobs WHERE month=?').bind(day.slice(0,7)),
    db.prepare('SELECT id,kind,title,audience,issue_day AS day FROM member_bulletins ORDER BY issue_day DESC,rowid DESC LIMIT 12'),
  ]);
  return {settings:settings.results[0],members:members.results,queue:queue.results,newsletter:newsletter.results[0],bulletins:bulletins.results};
}

export async function lifecycleEndpoint(path,request,env,identity,{json,bodyJson,HttpError,requireDb}) {
  const staff=path==='/api/committee/lifecycle', day=today();
  const fail=(status,message)=>{throw new HttpError(status,message,'member_lifecycle');};
  if(!identity)fail(401,'Sign in to open your club messages.');
  if(staff && identity.role!=='committee')fail(403,'Committee access is required.');
  if(!staff && !['member','signed_in','committee'].includes(identity.role))fail(403,'Club account required.');
  if(!['GET','POST'].includes(request.method))fail(405,'This action is unavailable.');
  const db=requireDb(env);
  if (!staff && request.method==='GET' && new URL(request.url).searchParams.get('summary')==='1') {
    return json({unread:(await inboxCount(db,identity.id,identity.role==='signed_in').first()).total});
  }
  const log=(action,entity)=>db.prepare(`INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()>0`).bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,action,entity,new Date().toISOString());
  const apply=async(sql,args,action,entity)=>{const [saved]=await db.batch([db.prepare(sql).bind(...args),log(action,entity)]);if(!saved.meta.changes)fail(409,'This record has changed or is unavailable. Refresh before trying again.');};
  if(request.method==='POST'){
    const b=await bodyJson(request);
    if(!staff){
      const profile=await db.prepare('SELECT p.*,a.disabled FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id WHERE p.account_id=? AND a.disabled=0').bind(identity.id).first();
      if(!profile)fail(403,'An individual membership account is required.');
      if(b.action==='read'){
        await db.prepare('UPDATE member_notices SET read_at=COALESCE(read_at,?) WHERE id=? AND account_id=?').bind(new Date().toISOString(),text(b.id,200),identity.id).run();
      }else if(b.action==='preferences'){
        const birthday=b.birthdayEnabled?b.birthday:null;
        const email=text(b.email,200), mobile=text(b.mobile,40);
        if(['cadet','junior'].includes(profile.membership_type) && (email!==profile.contact_email || mobile!==profile.contact_mobile))fail(403,'Ask the committee to update the verified guardian contact.');
        if(!int(b.revision,0,2147483646)||typeof b.birthdayEnabled!=='boolean'||(b.birthdayEnabled&&!okDate(birthday)))fail(400,'Choose the day and month of your birthday, or leave birthday messages off.');
        if((b.generalNotices!==undefined && typeof b.generalNotices!=='boolean') || [b.emailEnabled,b.newsletters,b.meetings,b.competitions,b.workingBees].some(v=>typeof v!=='boolean'))fail(400,'Please check your notice preferences.');
        if((email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||(b.emailEnabled&&!email)||(mobile&&!/^\+?[\d ()-]{6,20}$/.test(mobile)))fail(400,'Check the email address and contact phone.');
        const [saved]=await db.batch([
          db.prepare(`UPDATE member_profiles SET birthday_md=?,newsletters=?,meetings=?,competitions=?,working_bees=?,general_notices=coalesce(?,general_notices),pref_email=?,pref_sms=0,contact_email=?,contact_mobile=?,revision=revision+1
            WHERE account_id=? AND revision=?`).bind(birthday,+b.newsletters,+b.meetings,+b.competitions,+b.workingBees,b.generalNotices===undefined?null:+b.generalNotices,+b.emailEnabled,email,mobile,identity.id,b.revision),
          log('member_preferences_updated',identity.id),
          db.prepare(`DELETE FROM member_delivery_queue WHERE notice_id IN (SELECT id FROM member_notices WHERE account_id=?)
            AND channel='email' AND EXISTS (SELECT 1 FROM member_profiles WHERE account_id=? AND pref_email=0)`).bind(identity.id,identity.id),
          db.prepare(`DELETE FROM member_delivery_queue WHERE notice_id IN (SELECT n.id FROM member_notices n
            JOIN member_profiles p ON p.account_id=n.account_id WHERE n.account_id=? AND n.kind='newsletter' AND p.newsletters=0)`).bind(identity.id),
          db.prepare("DELETE FROM member_birthday_gifts WHERE account_id=? AND redeemed_at IS NULL AND EXISTS(SELECT 1 FROM member_profiles WHERE account_id=? AND birthday_md IS NULL)").bind(identity.id,identity.id),
          db.prepare("DELETE FROM member_notices WHERE account_id=? AND kind='birthday' AND EXISTS(SELECT 1 FROM member_profiles WHERE account_id=? AND birthday_md IS NULL)").bind(identity.id,identity.id),
        ]);
        if(!saved.meta.changes)fail(409,'Your preferences changed elsewhere. Refresh and try again.');
      }else fail(400,'Choose a member action.');
    }else{
      const memberId=text(b.accountId,100);
      if(b.action==='pack'){
        const needs={ready:'prepare',posted:'ready',collected:'ready'},methods={posted:'post',collected:'collect'};
        if(!Object.hasOwn(needs,b.stage))fail(400,'Choose a pack stage.');
        const method=methods[b.stage]||null;
        await apply(`UPDATE member_profiles SET pack_stage=?,pack_method=coalesce(?,pack_method)
          WHERE account_id=? AND pack_stage=? AND (? IS NULL OR pack_method IN ('confirm',?))
          AND EXISTS (SELECT 1 FROM club_accounts WHERE id=? AND disabled=0)`,[b.stage,method,memberId,needs[b.stage],method,method,memberId],'member_pack_'+b.stage,memberId);
      }else if(b.action==='member-type'){
        if(!types.includes(b.type))fail(400,'Choose a membership type.');
        await apply('UPDATE member_profiles SET membership_type=?,revision=revision+1 WHERE account_id=?',[b.type,memberId],'membership_type_confirmed',memberId);
      }else if(b.action==='enable-numbers'){
        if(!identity.administrator || b.checked!==true)fail(403,'The Webmaster must first check the existing membership number register.');
        const ref=text(b.reference,180);if(!int(b.start,1,99900000)||!ref)fail(400,'Enter the first unused number and the register or minute you checked.');
        await apply('UPDATE member_lifecycle_settings SET number_start=?,number_reference=? WHERE id=1 AND number_start IS NULL AND ?>COALESCE((SELECT MAX(number) FROM member_numbers),0)',[b.start,ref,b.start],'membership_number_allocation_approved','member-register');
      }else if(b.action==='existing-number'){
        if(!identity.administrator||!int(b.number,1,99999999))fail(403,'The Webmaster must verify the existing membership number.');
        await apply(`INSERT OR IGNORE INTO member_numbers(number,account_id,assigned_day) SELECT ?,p.account_id,? FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id
          WHERE a.disabled=0 AND p.account_id=? AND NOT EXISTS(SELECT 1 FROM member_numbers WHERE account_id=p.account_id) AND (SELECT number_start FROM member_lifecycle_settings) IS NULL`,
          [b.number,day,memberId],'existing_member_number_linked',memberId);
      }else if(b.action==='offer'){
        if(!identity.administrator||b.approved!==true)fail(403,'The Webmaster must record the committee’s approval.');
        const terms=text(b.terms,500), ref=text(b.reference,180);
        if(!['percent','fixed'].includes(b.kind)||!int(b.value,1,b.kind==='percent'?100:1000000)||!int(b.days,1,365)||!terms||!ref)fail(400,'Enter the approved discount, validity, terms and minute reference.');
        await apply('UPDATE member_lifecycle_settings SET offer_kind=?,offer_value=?,offer_terms=?,offer_days=?,offer_reference=? WHERE id=1',[b.kind,b.value,terms,b.days,ref],'birthday_offer_approved','birthday-offer');
      }else if(b.action==='pause-offer'){
        if(!identity.administrator)fail(403,'Webmaster access is required.');
        await apply('UPDATE member_lifecycle_settings SET offer_kind=NULL WHERE id=1',[],'birthday_offer_paused','birthday-offer');
      }else if(b.action==='lookup-gift' || b.action==='redeem'){
        if(!identity.canManageStock)fail(403,'Treasurer access is required to record a redemption.');
        if(!int(b.cents,1,100000000)||!/^[A-F0-9]{16}$/.test(b.code??''))fail(400,'Check the offer code and eligible purchase amount.');
        if(b.action==='lookup-gift'){
          const grant=await db.prepare(`SELECT g.kind,g.value,g.terms,g.valid_until AS validUntil FROM member_birthday_gifts g
            JOIN club_accounts a ON a.id=g.account_id WHERE g.code=? AND g.redeemed_at IS NULL AND g.valid_until>=?
            AND a.disabled=0 AND a.paid_through>=?`).bind(b.code,day,day).first();
          if(!grant)fail(404,'No current, unused offer matches this code.');
          return json({gift:{...grant,purchaseCents:b.cents,discountCents:grant.kind==='percent'?Math.round(b.cents*grant.value/100):Math.min(b.cents,grant.value)}});
        }
        if(b.checked!==true)fail(400,'Please confirm you checked the offer terms.');
        await apply(`UPDATE member_birthday_gifts SET redeemed_at=?,redeemed_by=?,purchase_cents=?,discount_cents=
          CASE WHEN kind='percent' THEN CAST((?*value+50)/100 AS INTEGER) ELSE min(value,?) END
          WHERE code=? AND valid_until>=? AND redeemed_at IS NULL AND EXISTS(SELECT 1 FROM club_accounts a WHERE a.id=member_birthday_gifts.account_id AND a.disabled=0 AND a.paid_through>=?)`,
          [new Date().toISOString(),identity.id,b.cents,b.cents,b.cents,b.code,day,day],'birthday_gift_redeemed','gift');
        const gift=await db.prepare('SELECT purchase_cents AS purchaseCents,discount_cents AS discountCents FROM member_birthday_gifts WHERE code=?').bind(b.code).first();
        return json({gift});
      }else if(b.action==='publish'){
        if(b.kind==='newsletter')fail(409,'Open the newsletter desk to review and publish an edition.');
        const title=text(b.title,120),message=text(b.message,1800),audience=text(b.audience,32);
        if((b.important!==undefined && typeof b.important!=='boolean')||!Object.hasOwn(topics,b.kind)||!title||!message||!(audience==='all'||types.includes(audience))||b.approved!==true||!/^[-\da-f]{36}$/i.test(b.id??''))fail(400,'Check the approved notice, membership group and wording.');
        const [saved]=await db.batch([
          db.prepare('INSERT OR IGNORE INTO member_bulletins(id,kind,audience,title,body,issue_day,created_by,important) VALUES(?,?,?,?,?,?,?,?)').bind(b.id,b.kind,audience,title,message,day,identity.id,Number(b.important===true)),
          log('member_notice_published',b.id),
        ]);
        if(!saved.meta.changes && !(await db.prepare('SELECT id FROM member_bulletins WHERE id=? AND title=? AND body=? AND kind=? AND audience=? AND created_by=? AND important=?').bind(b.id,title,message,b.kind,audience,identity.id,Number(b.important===true)).first()))fail(409,'A newsletter for this group already exists for this month, or this notice has changed.');
      }else if(b.action==='queue'){
        const result=await db.prepare(`SELECT a.login,n.issue_day AS day,q.channel,p.contact_email AS destination,
          n.title,n.body||CASE WHEN g.code IS NULL THEN '' ELSE ' Birthday offer '||g.code||'. '||g.terms||' Valid through '||g.valid_until||'.' END AS body
          FROM member_delivery_queue q JOIN member_notices n ON n.id=q.notice_id JOIN member_profiles p ON p.account_id=n.account_id
          LEFT JOIN member_birthday_gifts g ON n.kind='birthday' AND g.account_id=n.account_id AND g.issue_year=n.cycle
          AND g.valid_until>=? AND g.redeemed_at IS NULL
          JOIN club_accounts a ON a.id=n.account_id WHERE a.disabled=0 AND q.channel='email' AND p.pref_email=1
          ORDER BY n.issue_day DESC,q.notice_id,q.channel`).bind(day).all();
        return json({rows:result.results});
      }else fail(400,'Choose a committee action.');
    }
  }
  if (!identity.readOnly && !env.SHOWCASE_READ_ONLY) await runMemberCycle(env);
  return json(staff ? await committeeData(db,day) : await memberData(db,identity.id,day,identity.role==='signed_in'));
}
