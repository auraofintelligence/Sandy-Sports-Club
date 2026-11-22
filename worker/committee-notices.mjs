import {accountOffice, officerSeats} from './officer-todos.mjs';

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const dayMs = 86_400_000;
const dayAfter = (day, days) => new Date(Date.parse(day+'T00:00:00Z') + days*dayMs).toISOString().slice(0,10);
const secretaryOffice = office => office === 'secretary' || office === 'assistantsecretary';
const lights = {current:'green',dueSoon:'amber',dueToday:'amber',overdue:'red',reviewSoon:'amber',stale:'amber',done:'grey',archived:'grey'};

async function officeDirectory(db, identity) {
  const {results} = await db.prepare("SELECT id,login,role FROM club_accounts WHERE disabled=0 AND role IN ('committee','treasurer','administrator') ORDER BY created_at,id").all();
  const offices = new Map(Object.entries(officerSeats));
  const webmasters = results.filter(row => row.role === 'administrator');
  for (const row of results) {
    const key = accountOffice(row.id,row.login,row.role);
    const label = row.role === 'administrator'
      ? (webmasters.length === 1 ? 'Webmaster' : 'Webmaster '+(webmasters.indexOf(row)+1))
      : officerSeats[key] || row.login;
    offices.set(key,label);
  }
  const own = accountOffice(identity.id,identity.name,identity.accountRole);
  if (!offices.has(own)) offices.set(own,identity.name || 'Committee officer');
  return offices;
}

// The same dated rows drive both the home alerts and the noticeboard itself.
const statusColumns = `(n.archived_at IS NULL AND n.updated_by<>?1 AND coalesce(r.seen_version,0)<n.version) AS unread,
  CASE WHEN n.archived_at IS NOT NULL THEN 'archived'
       WHEN t.done_at IS NOT NULL THEN 'done'
       WHEN n.kind='info' THEN CASE WHEN n.review_date<=?2 THEN 'stale'
         WHEN n.review_date<=?3 THEN 'reviewSoon' ELSE 'current' END
       WHEN t.due_date<?2 THEN 'overdue' WHEN t.due_date=?2 THEN 'dueToday'
       WHEN t.due_date<=?3 THEN 'dueSoon' ELSE 'current' END AS status`;
const joins = `FROM committee_notices n
  LEFT JOIN officer_todo_items t ON t.id=n.task_id
  LEFT JOIN committee_notice_reads r ON r.notice_id=n.id AND r.account_id=?1`;
const fields = `n.id,n.kind,n.important,n.title,n.details,n.author_label AS author,n.author_id AS authorId,
  n.created_at AS createdAt,n.review_date AS reviewDate,n.task_id AS taskId,n.version,
  coalesce(t.office,'') AS office,coalesce(t.due_date,'') AS dueDate,t.done_at AS doneAt,n.archived_at AS archivedAt`;

function summaryQuery(db, args) {
  return db.prepare(`WITH items AS (SELECT ${statusColumns} ${joins} WHERE n.archived_at IS NULL)
    SELECT count(*) FILTER (WHERE unread) AS unread,
      count(*) FILTER (WHERE status IN ('dueToday','dueSoon','stale','reviewSoon')) AS amber,
      count(*) FILTER (WHERE status='overdue') AS red FROM items`).bind(...args);
}

async function board(db, identity, today, offices, archived = false) {
  const viewerOffice = accountOffice(identity.id,identity.name,identity.accountRole);
  const args = [identity.id,today,dayAfter(today,7)];
  const [totals, rows] = await db.batch([summaryQuery(db,args), db.prepare(
    `SELECT ${fields},${statusColumns} ${joins} WHERE n.archived_at IS ${archived ? 'NOT ' : ''}NULL ORDER BY n.created_at DESC,n.id DESC`).bind(...args)]);
  return {today,viewerOffice,counts:totals.results[0],
    offices:[...offices].filter(([key]) => secretaryOffice(viewerOffice) || key === viewerOffice).map(([key,label]) => ({key,label})),
    notices:rows.results.map(({authorId,...row}) => {
      const manages = authorId === identity.id || secretaryOffice(viewerOffice) || row.office === viewerOffice;
      return {...row,important:Boolean(row.important),officeLabel:row.office ? offices.get(row.office) || 'Committee officer' : '',unread:Boolean(row.unread),
        light:lights[row.status],canReview:manages && !row.archivedAt && row.kind === 'info',
        canArchive:manages && !row.archivedAt && (row.kind === 'info' || Boolean(row.doneAt))};
    })};
}

function audit(db, identity, action, id, stamp) {
  return db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1')
    .bind(crypto.randomUUID(),identity.id,identity.accountRole || identity.role,'committee_notice_'+action,id,stamp);
}

async function post(db, identity, data, offices, today, stamp, helpers) {
  const {textField,dateField,HttpError} = helpers;
  const {id,kind} = data;
  if (data.important !== undefined && typeof data.important !== 'boolean') throw new HttpError(400,'Choose whether to flag this post as important.','invalid_notice');
  const important = data.important === true ? 1 : 0;
  if (!['info','action'].includes(kind)) throw new HttpError(400,'Choose an update or a job.','invalid_notice');
  const title = textField(data.title,'the notice title',120,true);
  const details = textField(data.details,'the notice details',1000);
  const asTask = kind === 'action';
  const office = textField(data.office,'the responsible office',180,asTask);
  const due = dateField(data.dueDate,asTask);
  const review = dateField(data.reviewDate,false);
  const viewer = accountOffice(identity.id,identity.name,identity.accountRole);
  if ((asTask && review) || (!asTask && (office || due))) throw new HttpError(400,'Use a due date for a job or a review date for an update.','invalid_notice');
  if (asTask && (!offices.has(office) || (office!==viewer && !secretaryOffice(viewer)))) {
    throw new HttpError(403,'Choose an office you can assign a job to.','notice_office');
  }
  // Only the transaction that first creates this task may attach it to a new notice.
  // A pre-existing unrelated manual task with the same ID must never be attached.
  const [,created] = await db.batch([
    db.prepare(`INSERT INTO officer_todo_items(id,office,title,details,due_date,created_at,created_by)
      SELECT ?,?,?,?,?,?,? WHERE ? AND NOT EXISTS (SELECT 1 FROM committee_notices WHERE id=?)
      ON CONFLICT(id) DO NOTHING`).bind(id,office,title,details,due,stamp,identity.id,+asTask,id),
    db.prepare(`INSERT INTO committee_notices(id,kind,title,details,created_at,author_id,author_label,updated_by,requested_review,review_date,task_id,important)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ? OR changes()=1 ON CONFLICT(id) DO NOTHING`)
      .bind(id,kind,title,details,stamp,identity.id,offices.get(viewer),identity.id,review,
        asTask ? '' : review || dayAfter(today,30),asTask ? id : null,important,+!asTask),
    audit(db,identity,'posted',id,stamp)
  ]);
  if (created.meta.changes) return;
  const previous = await db.prepare(`SELECT n.kind,n.important,n.title,n.details,n.author_id AS author,n.requested_review AS review,
    coalesce(t.office,'') AS office,coalesce(t.due_date,'') AS due FROM committee_notices n
    LEFT JOIN officer_todo_items t ON t.id=n.task_id WHERE n.id=?`).bind(id).first();
  if (!previous || previous.author!==identity.id || previous.kind!==kind || previous.title!==title ||
    previous.details!==details || previous.review!==review || previous.office!==office || previous.due!==due || previous.important!==important) {
    throw new HttpError(409,'This post is different from the one already saved. Open the board and check it.','notice_conflict');
  }
}

async function update(db, identity, data, today, stamp, helpers) {
  const {HttpError,dateField} = helpers;
  const {action,id,version} = data;
  if (!Number.isSafeInteger(version) || version<1) throw new HttpError(400,'Open the latest copy of the notice.','notice_version');
  const row = await db.prepare(`SELECT n.kind,n.author_id AS author,n.archived_at AS archivedAt,n.version,t.office,t.done_at AS doneAt
    FROM committee_notices n LEFT JOIN officer_todo_items t ON n.task_id=t.id WHERE n.id=?`).bind(id).first();
  if (!row) throw new HttpError(404,'This notice could not be found.','notice_missing');
  if (action === 'seen') {
    if (version>row.version) throw new HttpError(409,'Open the latest copy of the notice.','notice_version');
    await db.prepare(`INSERT INTO committee_notice_reads(notice_id,account_id,seen_version,seen_at) VALUES(?,?,?,?)
      ON CONFLICT(notice_id,account_id) DO UPDATE SET seen_version=excluded.seen_version,seen_at=excluded.seen_at
      WHERE excluded.seen_version>committee_notice_reads.seen_version`).bind(id,identity.id,version,stamp).run();
    return;
  }
  const viewer = accountOffice(identity.id,identity.name,identity.accountRole);
  if (row.author!==identity.id && !secretaryOffice(viewer) && viewer!==row.office) {
    throw new HttpError(403,'Ask the officer who posted this or one of the secretaries to update it.','notice_office');
  }
  const review = action==='review' ? dateField(data.reviewDate,false) : '';
  if (action==='review' && row.kind!=='info') throw new HttpError(400,'Complete this job on the responsible officer’s to-do list.','notice_task');
  if (action==='archive' && row.kind==='action' && !row.doneAt) throw new HttpError(409,'Complete the job on its to-do list before filing this notice.','notice_open_job');
  if (row.version===version && !row.archivedAt && review && review<=today) throw new HttpError(400,'Choose a future day to check this update again.','notice_review_date');
  const change = action==='archive'
    ? db.prepare('UPDATE committee_notices SET archived_at=?,updated_by=?,version=version+1 WHERE id=? AND version=? AND archived_at IS NULL').bind(stamp,identity.id,id,version)
    : db.prepare("UPDATE committee_notices SET review_date=?,updated_by=?,version=version+1 WHERE id=? AND version=? AND archived_at IS NULL AND kind='info'").bind(review||dayAfter(today,30),identity.id,id,version);
  const [saved] = await db.batch([change,
    db.prepare('INSERT INTO committee_notice_changes SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id,version+1,action,identity.id,review,stamp),
    audit(db,identity,action,id,stamp)
  ]);
  if (saved.meta.changes) return;
  const retried = await db.prepare(`SELECT 1 AS ok FROM committee_notice_changes WHERE notice_id=? AND version=?
    AND action=? AND actor_id=? AND requested_review=?`).bind(id,version+1,action,identity.id,review).first();
  if (!retried) throw new HttpError(409,'Another officer updated this notice. Open the board again before changing it.','notice_version');
}

export async function committeeNoticesEndpoint(request, env, identity, helpers) {
  const {requireRole,requireDb,HttpError,json,bodyJson} = helpers;
  requireRole(identity,['committee']);
  if (!['GET','POST'].includes(request.method)) throw new HttpError(405,'Open the committee noticeboard.','notice_method');
  const storage = requireDb(env);
  const db = storage.withSession ? storage.withSession('first-primary') : storage;
  const stamp = new Date().toISOString();
  const today = new Date(Date.parse(stamp)+10*3_600_000).toISOString().slice(0,10);
  const params = new URL(request.url).searchParams;
  if ([...params].some(([key,value])=>request.method!=='GET' || !['archive','summary'].includes(key) || value!=='1') || params.size>1) {
    throw new HttpError(400,'Choose the current noticeboard or its archive.','notice_filter');
  }
  if (params.has('summary')) return json({today,counts:await summaryQuery(db,[identity.id,today,dayAfter(today,7)]).first()});
  const offices = await officeDirectory(db,identity);
  if (request.method==='POST') {
    const data = await bodyJson(request);
    if (typeof data.id!=='string' || !uuid.test(data.id)) throw new HttpError(400,'Choose a notice or start a new post.','notice_id');
    if (data.action==='post') await post(db,identity,data,offices,today,stamp,helpers);
    else if (['seen','review','archive'].includes(data.action)) await update(db,identity,data,today,stamp,helpers);
    else throw new HttpError(400,'Choose what to do with this notice.','notice_action');
  }
  return json(await board(db,identity,today,offices,params.has('archive')));
}
