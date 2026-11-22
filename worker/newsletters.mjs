import { runMemberCycle, birthdayDue } from './member-lifecycle.mjs';
import { readRecipe } from '../public/newsletter-recipe.mjs';

const offices = ['president','vicepresident','secretary','assistantsecretary','treasurer'];
const monthPattern = /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/;
const editionColumns = 'month,title,body,president_message AS presidentMessage,status,version,published_at AS publishedAt';
const contributionColumns = 'month,office,title,body,status,version,updated_at AS updatedAt';
const archivePage = 12;
const emptyEdition = month => ({month,title:'',body:'',presidentMessage:'',status:'draft',version:0,publishedAt:null});
const dayInBrisbane = date => new Date(+date+36000000).toISOString().slice(0,10);

function officeRights(identity) {
  const office = ['committee','treasurer'].includes(identity.accountRole) && offices.includes(identity.name) ? identity.name : null;
  const owner = identity.administrator === true;
  const canReviewBirthdays=['secretary','assistantsecretary'].includes(office);
  return {office,canReviewBirthdays,canEdit:owner || canReviewBirthdays,canApprove:owner || office==='president'};
}

function page(rows) {
  const months = [...new Set(rows.map(row=>row.month))];
  return {editions:rows.filter(row=>months.indexOf(row.month)<archivePage),nextBefore:months.length>archivePage?months[archivePage-1]:null};
}

async function memberArchive(db, identity, before) {
  const rows = await db.prepare(`WITH eligible AS (
    SELECT coalesce(b.edition_month,substr(b.issue_day,1,7)) AS month,b.id AS bulletinId,b.title,coalesce(e.body,b.body) AS body,
    coalesce(e.president_message,'') AS presidentMessage,coalesce(e.published_at,b.issue_day) AS publishedAt,
    coalesce((SELECT json_group_array(json_object('office',c.office,'kind',c.kind,'title',c.title,'body',c.body)) FROM
      (SELECT office,kind,title,body FROM newsletter_articles WHERE month=e.month AND status='included' ORDER BY kind,office) c),'[]') AS articles
    FROM member_bulletins b LEFT JOIN newsletter_editions e ON e.bulletin_id=b.id WHERE b.kind='newsletter'
    AND coalesce(b.edition_month,substr(b.issue_day,1,7))<? AND (b.audience='all' OR ?=1 OR EXISTS(
      SELECT 1 FROM member_notices n WHERE n.account_id=? AND n.id='bulletin:'||b.id||':'||n.account_id))
  ), months AS (SELECT DISTINCT month FROM eligible ORDER BY month DESC LIMIT 13)
  SELECT month,title,body,presidentMessage,publishedAt,articles FROM eligible JOIN months USING(month) ORDER BY month DESC,publishedAt DESC,bulletinId`)
    .bind(before,Number(identity.role==='committee'),identity.id).all();
  return page(rows.results.map(({articles,...row})=>({...row,contributions:JSON.parse(articles)})));
}

async function committeeDesk(db, rights, month, before, day) {
  const birthdayMonth=day.slice(0,7);
  const [selected,archive,contributions,history,prompt,birthdays,review] = await db.batch([
    db.prepare(`SELECT ${editionColumns} FROM newsletter_editions WHERE month=?`).bind(month),
    db.prepare(`SELECT month,title,status,version,published_at AS publishedAt FROM newsletter_editions
      WHERE month<? AND version>0 ORDER BY month DESC LIMIT 13`).bind(before),
    db.prepare(`SELECT kind,${contributionColumns} FROM newsletter_articles WHERE month=? AND (office=? OR status<>'draft') ORDER BY kind,office`).bind(month,rights.office),
    db.prepare(`SELECT c.month,c.office,c.kind,c.title,c.body,c.status,c.version,c.updated_at AS updatedAt,e.status AS editionStatus
      FROM newsletter_articles c JOIN newsletter_editions e ON e.month=c.month WHERE c.office=? ORDER BY c.month DESC,c.kind`).bind(rights.office),
    db.prepare(`SELECT substr(?1,1,7) AS month,date(?1,'start of month') AS dueDay,date(?1,'start of month','+1 month') AS nextDueDay,
      CASE WHEN EXISTS (SELECT 1 FROM newsletter_editions WHERE month=substr(?1,1,7) AND status='published')
      THEN 'published' ELSE 'due' END AS status`).bind(day),
    db.prepare(`WITH RECURSIVE dates(day) AS (SELECT date(?1,'start of month') WHERE ?2
      UNION ALL SELECT date(day,'+1 day') FROM dates WHERE day<date(?1,'start of month','+1 month','-1 day'))
      SELECT dates.day,count(*) AS due,count(issued.account_id) AS greeted FROM dates
      JOIN member_profiles p ON ${birthdayDue('dates.day')} JOIN club_accounts a ON a.id=p.account_id
      LEFT JOIN member_birthday_issued issued ON issued.account_id=p.account_id AND issued.issue_year=substr(dates.day,1,4)
      WHERE a.disabled=0 AND a.paid_through>=dates.day GROUP BY dates.day ORDER BY dates.day`).bind(day,Number(rights.canReviewBirthdays)),
    db.prepare('SELECT month,reviewed_at AS reviewedAt,reviewed_by AS reviewedBy FROM member_newsletter_jobs WHERE month=? AND ?')
      .bind(birthdayMonth,Number(rights.canReviewBirthdays)),
  ]);
  return {edition:selected.results[0]??emptyEdition(month),...page(archive.results),rights,today:day,
    contributions:contributions.results,contributionHistory:history.results,monthlyPrompt:prompt.results[0],birthdays:birthdays.results,
    birthdayReview:rights.canReviewBirthdays?(review.results[0]||{month:birthdayMonth,reviewedAt:null,reviewedBy:null}):null};
}

function field(input,name,limit,fail,fallback='') {
  if(!Object.hasOwn(input,name))return fallback;
  if(typeof input[name]!=='string' || input[name].trim().length>limit)fail(400,`Check the wording. The maximum for this field is ${limit} characters.`);
  return input[name].trim();
}

async function fingerprint(input) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function audit(db,identity,action,entity,at) {
  return db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1')
    .bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,'newsletter_'+action,entity,at);
}

const ensureEdition = (db,month) => db.prepare('INSERT OR IGNORE INTO newsletter_editions(month,bulletin_id) VALUES(?,?)').bind(month,crypto.randomUUID());

async function editContribution(db,identity,rights,input,at,fail) {
  const {month,version,action}=input;
  const selecting=['include-contribution','exclude-contribution','return-contribution'].includes(action);
  if(selecting && !rights.canEdit)fail(403,'The secretary or assistant secretary selects contributions.');
  if(!selecting && (!rights.office || (input.office!==undefined && input.office!==rights.office)))fail(403,'Use your own officer sign-in to send a contribution.');
  const office=selecting?input.office:rights.office;
  if(!offices.includes(office))fail(400,'Choose a committee office.');
  const kind=input.kind===undefined?'article':input.kind;
  if(!['article','recipe'].includes(kind))fail(400,'Choose an office update or a recipe.');
  const table=kind==='recipe'?'newsletter_recipes':'newsletter_contributions';
  const select=db.prepare(`SELECT ? AS kind,${contributionColumns},last_key AS lastKey FROM ${table} WHERE month=? AND office=?`).bind(kind,month,office);
  const existing=await select.first();
  const title=selecting?(existing?.title||''):field(input,'title',120,fail,existing?.title||'');
  const body=selecting?(existing?.body||''):field(input,'body',kind==='recipe'?3600:1800,fail,existing?.body||'');
  const keyParts=[identity.id,action,month,office,version,title,body];
  if(kind==='recipe')keyParts.push(kind);
  const key=await fingerprint(keyParts);
  if(existing?.lastKey===key){const {lastKey,...contribution}=existing;return {contribution};}
  if(version!==(existing?.version||0))fail(409,'This contribution changed. Open the latest copy before continuing.');
  let status;
  if(selecting) {
    const allowed={'include-contribution':['submitted'],'exclude-contribution':['included'],'return-contribution':['submitted','included']}[action];
    if(!allowed.includes(existing?.status))fail(409,'Open the latest contribution before making your selection.');
    status={'include-contribution':'included','exclude-contribution':'submitted','return-contribution':'draft'}[action];
  } else {
    if(existing?.status && existing.status!=='draft')fail(409,'This article has already been sent to the secretary.');
    if(!title && !body)fail(400,'Write a title or a few words to save.');
    if(action==='submit-contribution' && (!title || !body))fail(400,'Add the title and the article before sending it.');
    if(action==='submit-contribution' && kind==='recipe') {
      const recipe=readRecipe(body);
      if(!recipe.ingredients || !recipe.method)fail(400,'Add ingredients and cooking steps before sending your recipe.');
    }
    status=action==='submit-contribution'?'submitted':'draft';
  }
  const write=db.prepare(`INSERT INTO ${table}(month,office,title,body,status,version,updated_at,updated_by,last_key)
    SELECT ?1,?2,?3,?4,?5,1,?6,?7,?8 FROM newsletter_editions WHERE month=?1 AND status='draft'
    AND (?9=0 OR EXISTS(SELECT 1 FROM ${table} WHERE month=?1 AND office=?2 AND version=?9))
    ON CONFLICT(month,office) DO UPDATE SET title=excluded.title,body=excluded.body,status=excluded.status,
    version=${table}.version+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by,last_key=excluded.last_key
    WHERE ${table}.version=?9`).bind(month,office,title,body,status,at,identity.id,key,version);
  const result=await db.batch([ensureEdition(db,month),write,audit(db,identity,action,month+'/'+office+(kind==='recipe'?'/recipe':''),at),select]);
  const row=result[3].results[0];
  if(row?.lastKey!==key)fail(409,'The edition or contribution has changed. Open the latest copy.');
  const {lastKey,...contribution}=row;
  return {contribution};
}

async function editEdition(db,identity,rights,input,at,fail) {
  const {action,month,version}=input;
  const allowed = action==='return' ? rights.canEdit||rights.canApprove
    : ['approve','message'].includes(action) ? rights.canApprove : rights.canEdit;
  if(!allowed)fail(403,'Your office does not have permission for that newsletter action.');
  const select=db.prepare(`SELECT ${editionColumns},last_key AS lastKey FROM newsletter_editions WHERE month=?`).bind(month);
  const current=await select.first() || emptyEdition(month);
  const title=action==='save'?field(input,'title',120,fail,current.title):current.title;
  const body=action==='save'?field(input,'body',6000,fail,current.body):current.body;
  const presidentMessage=['save','message'].includes(action)?field(input,'presidentMessage',1800,fail,current.presidentMessage):current.presidentMessage;
  const key=await fingerprint([identity.id,action,month,version,title,body,presidentMessage]);
  if(current.lastKey===key){const {lastKey,...edition}=current;return {edition};}
  if(version!==current.version)fail(409,'This edition changed. Open the latest copy before continuing.');
  const previous={save:['draft'],message:['draft'],submit:['draft'],approve:['review'],return:['review','approved'],publish:['review','approved']}[action];
  if(!previous.includes(current.status))fail(409,'The edition is at a different stage. Open the latest copy.');
  if((action==='save' || action==='message') && !title && !body && !presidentMessage)fail(400,'Add a title or a few words to begin the edition.');
  if(action==='submit' && (!title || (!body && !presidentMessage &&
    !await db.prepare("SELECT 1 FROM newsletter_articles WHERE month=? AND status='included' LIMIT 1").bind(month).first())))
    fail(400,'Add a title and at least one article, message or introduction before submitting.');
  const next={save:'draft',message:'draft',submit:'review',approve:'approved',return:'draft',publish:'published'}[action];
  const write=db.prepare(`UPDATE newsletter_editions SET title=?1,body=?2,president_message=?3,status=?4,
    updated_at=?5,updated_by=?6,version=version+1,last_key=?7,published_at=CASE WHEN ?4='published' THEN ?5 ELSE NULL END,
    approved_by=CASE WHEN ?4='approved' THEN ?6 WHEN ?4='published' THEN approved_by END,
    approved_at=CASE WHEN ?4='approved' THEN ?5 WHEN ?4='published' THEN approved_at END
    WHERE month=?8 AND version=?9 AND status=?10 AND
    (?4<>'published' OR status='approved' OR (president_message='' AND NOT EXISTS(
      SELECT 1 FROM newsletter_contributions WHERE month=?8 AND office='president' AND status='included')))`)
    .bind(title,body,presidentMessage,next,at,identity.id,key,month,version,current.status);
  const result=await db.batch([ensureEdition(db,month),write,audit(db,identity,action,month,at),select]);
  const row=result[3].results[0];
  if(row?.lastKey!==key)fail(409,action==='publish'?'Check the latest edition and obtain approval for the president’s contribution before publishing.':'The edition changed. Open the latest copy.');
  const {lastKey,...edition}=row;
  return {edition};
}

export async function newslettersEndpoint(path,request,env,identity,{json,bodyJson,requireDb,HttpError}) {
  const fail=(status,message)=>{throw new HttpError(status,message,'newsletter');};
  const staff=path==='/api/committee/news';
  if(!identity)fail(401,'Sign in to open the club newsletter.');
  if(staff && identity.role!=='committee')fail(403,'Committee access is required.');
  if(!staff && !['committee','member'].includes(identity.role))fail(403,'Current paid membership is required.');
  if(request.method!=='GET' && !(staff && request.method==='POST'))fail(405,'This newsletter action is unavailable.');
  const binding=requireDb(env), db=binding.withSession?binding.withSession('first-primary'):binding;
  const params=new URL(request.url).searchParams;
  const before=params.get('before')??'9999-12';
  if(params.has('before') && !monthPattern.test(before))fail(400,'Choose a valid archive month.');
  const now=new Date(),day=dayInBrisbane(now),rights=officeRights(identity);
  if(request.method==='GET') {
    if(!staff) {
      if(identity.role==='member' && !await db.prepare("SELECT 1 FROM club_accounts WHERE id=? AND role='member' AND disabled=0 AND paid_through>=?").bind(identity.id,day).first())
        fail(403,'Current paid membership is required.');
      return json(await memberArchive(db,identity,before));
    }
    const month=params.get('month')??day.slice(0,7);
    if(!monthPattern.test(month))fail(400,'Choose a valid edition month.');
    if(!identity.readOnly && !env.SHOWCASE_READ_ONLY) await runMemberCycle({...env,DB:db},now);
    return json(await committeeDesk(db,rights,month,before,day));
  }
  const input=await bodyJson(request,48000);
  if(input?.action==='review-birthdays'){
    if(!rights.canReviewBirthdays)fail(403,'The Secretary or Assistant Secretary can review monthly birthdays.');
    if(input.month!==day.slice(0,7))fail(409,'The birthday month has changed. Open the newsletter desk for the current month.');
    const at=now.toISOString();
    const result=await db.batch([
      db.prepare(`INSERT INTO member_newsletter_jobs(month,reviewed_at,reviewed_by) VALUES(?,?,?)
        ON CONFLICT(month) DO UPDATE SET reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by
        WHERE member_newsletter_jobs.reviewed_at IS NULL`).bind(input.month,at,rights.office),
      audit(db,identity,input.action,input.month,at),
      db.prepare('SELECT month,reviewed_at AS reviewedAt,reviewed_by AS reviewedBy FROM member_newsletter_jobs WHERE month=?').bind(input.month)
    ]);
    return json({birthdayReview:result[2].results[0]});
  }
  if(!input || typeof input.month!=='string' || !monthPattern.test(input.month) || !Number.isSafeInteger(input.version) || input.version<0 || input.version>2147483646)fail(400,'Choose a valid edition month and version.');
  if(['save-contribution','submit-contribution','include-contribution','exclude-contribution','return-contribution'].includes(input.action))
    return json(await editContribution(db,identity,rights,input,now.toISOString(),fail));
  if(!['save','submit','approve','return','publish','message'].includes(input.action))fail(400,'Choose a newsletter action.');
  return json(await editEdition(db,identity,rights,input,now.toISOString(),fail));
}
