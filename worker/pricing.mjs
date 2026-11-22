import {EVENTS} from './data.mjs';

const tiers=new Set(['adult','junior','cadet','social','casual','lifetime']);
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const feeFields='id,kind,category,event_id AS eventId,title,price_cents AS priceCents';
const publicEvents=EVENTS.map(({id,title})=>({id,title}));
const officer=user=>user?.role==='committee' && ['committee','treasurer','administrator'].includes(user.accountRole);
const finance=user=>officer(user) && ['treasurer','administrator'].includes(user.accountRole);
const cleanup=s=>typeof s==='string'?s.trim():'';

function input(data,stored,HttpError){
  const bad=message=>{throw new HttpError(400,message,'invalid_fee');};
  const {id,kind,version,mutation,priceCents,active}=data;
  if(typeof id!=='string' || !(uuid.test(id)||/^membership-(?:adult|junior|cadet|social|casual|lifetime)$/.test(id)) || !uuid.test(mutation)) bad('Choose a fee and try saving it again.');
  if(!['membership','event'].includes(kind) || !Number.isSafeInteger(version)||version<0) bad('Refresh the fee before saving.');
  if(typeof active!=='boolean' || (priceCents!==null && (!Number.isSafeInteger(priceCents)||priceCents<0)) || (active&&priceCents===null)) bad('Enter an amount in Australian dollars before publishing. Zero means free.');
  const category=kind==='membership'?cleanup(data.category):null, eventId=kind==='event'?(cleanup(data.eventId)||null):null;
  const linkedEvent=eventId?publicEvents.find(event=>event.id===eventId):null;
  if(kind==='membership' && !tiers.has(category)) bad('Choose an existing membership category.');
  if(eventId&&!linkedEvent) bad('Choose a listed club event, or enter a separate event entry fee.');
  if(id.startsWith('membership-') && (kind!=='membership' || id!=='membership-'+category)) bad('Choose the matching membership category.');
  if(stored && (stored.kind!==kind || stored.category!==category)) bad('This fee belongs to a different category.');
  const title=cleanup(data.title)||stored?.title||linkedEvent?.title;
  if(!title||title.length>130||/[\x00-\x1f\x7f]/.test(title)) bad('Give this fee a short public name.');
  return {id,kind,category,eventId,title,priceCents,active,version,mutation};
}

async function saveFees(db,data,identity,{json,HttpError}){
  const conflict=()=>{throw new HttpError(409,'This fee has changed. Refresh the list before saving.','fee_conflict');};
  const bulk=Array.isArray(data.fees), rows=bulk?data.fees:[data];
  if(!rows.length||rows.length>20||rows.some(row=>!row||typeof row.id!=='string')||
      new Set(rows.map(row=>row.id)).size!==rows.length||new Set(rows.map(row=>row.mutation)).size!==rows.length)
    throw new HttpError(400,'Choose up to 20 distinct fees to save together.','invalid_batch');
  const marks=rows.map(()=>'?').join(',');
  const snapshots=await db.prepare('SELECT '+feeFields+',active,version FROM club_fees WHERE id IN ('+marks+')').bind(...rows.map(row=>row.id)).all();
  const existing=new Map(snapshots.results.map(row=>[row.id,row]));
  const guards=[],writes=[];
  const stamp=new Date().toISOString();
  for(const row of rows){
    const stored=existing.get(row.id);
    const f=input(row,stored,HttpError);
    if(!stored&&(f.version!==0||f.id.startsWith('membership-')))conflict();
    const requestKey=JSON.stringify([f.id,f.kind,f.category,f.eventId,cleanup(row.title),f.priceCents,f.active,f.version]);
    const expected=stored?'EXISTS(SELECT 1 FROM club_fees WHERE id=? AND version=?)':'NOT EXISTS(SELECT 1 FROM club_fees WHERE id=?)';
    guards.push({sql:`(NOT EXISTS(SELECT 1 FROM club_fee_mutations WHERE mutation=? AND actor_id=? AND request_key=?)
       AND (EXISTS(SELECT 1 FROM club_fee_mutations WHERE mutation=?) OR NOT (`+expected+')))',
      args:[f.mutation,identity.id,requestKey,f.mutation,...(stored?[f.id,f.version]:[f.id])]});
    const live=Number(f.active);
    const update=stored?db.prepare(`UPDATE club_fees SET
      version=version+CASE WHEN title IS NOT ? OR price_cents IS NOT ? OR active IS NOT ? OR event_id IS NOT ? THEN 1 ELSE 0 END,
      title=?,price_cents=?,active=?,event_id=?,updated_by=?,updated_at=?,last_mutation=?
      WHERE id=? AND version=? AND NOT EXISTS(SELECT 1 FROM club_fee_mutations WHERE mutation=?)`)
    .bind(f.title,f.priceCents,live,f.eventId,f.title,f.priceCents,live,f.eventId,identity.id,stamp,f.mutation,f.id,f.version,f.mutation)
    :db.prepare(`INSERT INTO club_fees(id,kind,category,event_id,title,price_cents,active,version,updated_by,updated_at,last_mutation)
       SELECT ?,?,?,?,?,?,?,1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM club_fee_mutations WHERE mutation=?)
       ON CONFLICT(id) DO NOTHING`)
      .bind(f.id,f.kind,f.category,f.eventId,f.title,f.priceCents,live,identity.id,stamp,f.mutation,f.mutation);
    writes.push(update,db.prepare(`INSERT OR IGNORE INTO club_fee_mutations(mutation,actor_id,request_key,fee_id,saved_version)
      SELECT ?,?,?,id,version FROM club_fees WHERE id=? AND last_mutation=?`)
      .bind(f.mutation,identity.id,requestKey,f.id,f.mutation));
  }
  const checks=[];
  for(let offset=0;offset<guards.length;offset+=10){
    const block=guards.slice(offset,offset+10);
    checks.push(db.prepare('INSERT INTO club_fee_write_checks(ok) SELECT 0 WHERE '+block.map(g=>g.sql).join(' OR ')).bind(...block.flatMap(g=>g.args)));
  }
  const receipts=db.prepare('SELECT mutation,fee_id AS id,saved_version AS version FROM club_fee_mutations WHERE actor_id=? AND mutation IN ('+marks+')')
    .bind(identity.id,...rows.map(row=>row.mutation));
  let results;
  try { results=await db.batch([...checks,...writes,receipts]); }
  catch(error){ if(/fee_batch_version/.test(String(error.message)+' '+String(error.cause?.message)))conflict(); throw error; }
  const indexed=new Map(results.at(-1).results.map(({mutation,id,version})=>[mutation,{id,version}]));
  const saved=rows.map(row=>indexed.get(row.mutation));
  if(saved.some(row=>!row))conflict();
  return bulk?json({fees:saved}):json(saved[0],!existing.has(rows[0].id)&&results[checks.length].meta.changes?201:200);
}

async function inbox(db,request,identity,{json,bodyJson,HttpError}){
  const key='account:'+identity.id;
  if(request.method==='POST'){
    const {through}=await bodyJson(request);
    if(!Number.isSafeInteger(through)||through<1) throw new HttpError(400,'Choose the alerts you have seen.','invalid_alert');
    await db.prepare('UPDATE officer_price_recipients SET read_at=? WHERE recipient=? AND seq<=? AND read_at IS NULL')
      .bind(new Date().toISOString(),key,through).run();
    return json({ok:true});
  }
  if(request.method!=='GET')throw new HttpError(405,'Open the officer price alerts to continue.','method_not_allowed');
  const before=Number(new URL(request.url).searchParams.get('before')||Number.MAX_SAFE_INTEGER);
  if(!Number.isSafeInteger(before)||before<1)throw new HttpError(400,'Choose a page of alerts.','invalid_alert');
  const [total,page]=await db.batch([
    db.prepare('SELECT count(*) AS n FROM officer_price_recipients WHERE recipient=? AND read_at IS NULL').bind(key),
    db.prepare(`SELECT c.seq,c.kind,c.title,c.old_cents AS oldCents,c.new_cents AS newCents,
      c.actor_login AS actor,c.changed_at AS changedAt,r.read_at AS readAt FROM officer_price_recipients r
      JOIN officer_price_changes c ON c.seq=r.seq WHERE r.recipient=? AND r.seq<? ORDER BY r.seq DESC LIMIT 26`).bind(key,before)]);
  return json({unread:total.results[0].n,alerts:page.results.slice(0,25),next:page.results.length>25?page.results[24].seq:null});
}

export async function pricingEndpoint(path,request,env,identity,helpers){
  const {json,HttpError,requireDb,bodyJson}=helpers;
  if(path==='/api/fees' && request.method==='GET'){
    const result=await requireDb(env).prepare('SELECT '+feeFields+' FROM club_fees WHERE active=1 AND price_cents IS NOT NULL ORDER BY kind,title COLLATE NOCASE,id').all();
    return json({fees:result.results});
  }
  if(path==='/api/fees')throw new HttpError(405,'Public fees are read only.','method_not_allowed');
  if(path!=='/api/committee/price-alerts'&&path!=='/api/treasurer/fees')throw new HttpError(404,'Fee service unavailable.','not_found');
  if(!(path==='/api/treasurer/fees'?finance(identity):officer(identity)))throw new HttpError(identity?403:401,'Sign in with an authorised club officer account.','not_authorised');
  const db=requireDb(env);
  if(path==='/api/committee/price-alerts')return inbox(db,request,identity,helpers);
  if(request.method==='GET'){
    const result=await db.prepare('SELECT '+feeFields+',active,version FROM club_fees ORDER BY kind,title COLLATE NOCASE,id').all();
    return json({fees:result.results.map(row=>({...row,active:Boolean(row.active)})),events:publicEvents});
  }
  if(request.method==='POST')return saveFees(db,await bodyJson(request),identity,helpers);
  throw new HttpError(405,'Use the treasurer fee form.','method_not_allowed');
}
