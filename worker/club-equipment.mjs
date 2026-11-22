import {privateAreaKeys, openPrivateText, sealPrivateText} from './member-network.mjs';

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const owners = ['club', 'member', 'officer', 'sponsor', 'supporter'];
const offices = {secretary:'Secretary', assistantsecretary:'Assistant Secretary', president:'President', vicepresident:'Vice President', treasurer:'Treasurer'};
const size = 30;
const identityFields = ['name','lender','lenderContact','lenderDue'];
const custodyFields = ['custodian','location','onDate','notes'];
const inputs = {
  create:[...identityFields,...custodyFields,'ownerType','sourceOfferId'],
  edit:[...identityFields,...custodyFields,'loanDue'],
  lend:[...custodyFields,'loanDue'], checkIn:custodyFields, returnOwner:custodyFields
};
const overdue = "(status<>'returned' AND ((lender_due<>'' AND lender_due<?) OR (loan_due<>'' AND loan_due<?)))";
const headers = {'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
const todayBrisbane = () => new Date(Date.now()+10*3600000).toISOString().slice(0,10);
const scope = (id, version) => 'club-equipment:'+id+':'+version;
const fresh = 'NOT EXISTS(SELECT 1 FROM club_equipment_history WHERE mutation_id=?)';
const selectItem='SELECT e.*,COALESCE(link.source_offer_id,e.source_offer_id) AS source_id FROM club_equipment e LEFT JOIN club_equipment_offer_items link ON link.item_id=e.id';
const equipmentKeys=secret=>privateAreaKeys(secret,'Sandy private equipment register v1');
const labelKey=name=>name.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
async function signed(key,text) {
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function equipmentForSponsorOffer(db,secret,offerId) {
  const rows=await db.prepare(selectItem+' WHERE link.source_offer_id=? ORDER BY e.updated_at DESC,e.id').bind(offerId).all();
  if (!rows.results.length) return [];
  const keys=await equipmentKeys(secret);
  return Promise.all(rows.results.map(async row=>{
    const {name}=JSON.parse(await openPrivateText(keys.content,scope(row.id,row.version),row.private_details));
    return {id:row.id,name,status:row.status,onDate:row.on_date,lenderDue:row.lender_due,loanDue:row.loan_due};
  }));
}

export async function clubEquipmentEndpoint(request, env, identity, h) {
  h.requireRole(identity, ['committee']);
  const fail = (status, message) => { throw new h.HttpError(status, message, 'club_equipment'); };
  if (new URL(request.url).pathname!=='/api/committee/equipment') fail(404,'This equipment page could not be found.');
  if (!['GET','POST'].includes(request.method)) fail(405,'Open the equipment register to make this change.');
  if (!env.PRIVATE_AUTH_KEY) fail(503,'Private equipment records are unavailable. Please try again later.');
  const storage = h.requireDb(env), db = storage.withSession?.('first-primary') || storage;
  const keys = await equipmentKeys(env.PRIVATE_AUTH_KEY);
  const today = todayBrisbane();
  const reply = (value,status=200) => h.json(value,status,headers);
  const checkedId = value => {
    if (typeof value!=='string' || !uuid.test(value)) fail(400,'Reopen the equipment record and try again.');
    return value.toLowerCase();
  };
  const read = id => db.prepare(selectItem+' WHERE e.id=?').bind(id).first();
  async function item(row) {
    const fields = JSON.parse(await openPrivateText(keys.content,scope(row.id,row.version),row.private_details));
    return {id:row.id,ownerType:row.owner_type,status:row.status,onDate:row.on_date,loanDue:row.loan_due,lenderDue:row.lender_due,
      version:row.version,sourceOfferId:row.source_id,...fields,
      overdue:row.status!=='returned' && [row.loan_due,row.lender_due].some(day=>day && day<today)};
  }
  async function detail(row) {
    if (!row) fail(404,'This equipment record could not be found.');
    const history = await db.prepare('SELECT version,action,on_date,private_snapshot,recorded_at FROM club_equipment_history WHERE item_id=? ORDER BY version DESC')
      .bind(row.id).all();
    return {today,item:await item(row),history:await Promise.all(history.results.map(async event=>({
      version:event.version,action:event.action,onDate:event.on_date,recordedAt:event.recorded_at,
      ...JSON.parse(await openPrivateText(keys.content,scope(row.id,event.version)+':history',event.private_snapshot))
    })))};
  }
  if (request.method==='GET') {
    const q = new URL(request.url).searchParams;
    if (q.has('id')) return reply(await detail(await read(checkedId(q.get('id')))));
    if (q.has('offer')) {
      return reply({today,items:await equipmentForSponsorOffer(db,env.PRIVATE_AUTH_KEY,checkedId(q.get('offer')))});
    }
    const filter=q.get('filter')||'all', page=Number(q.get('page')||1);
    if (!['all','available','out','returned','overdue'].includes(filter) || !Number.isSafeInteger(page) || page<1 || page>100000) fail(400,'Choose an equipment list from the register.');
    const clause = filter==='all'?'1':filter==='overdue'?overdue:'status=?';
    const binds = filter==='all'?[]:filter==='overdue'?[today,today]:[filter];
    const [total,rows] = await db.batch([db.prepare('SELECT COUNT(*) AS total FROM club_equipment WHERE '+clause).bind(...binds),
      db.prepare(selectItem+' WHERE '+clause+' ORDER BY '+overdue+" DESC, CASE status WHEN 'returned' THEN 1 ELSE 0 END,updated_at DESC,e.id LIMIT ? OFFSET ?")
        .bind(...binds,today,today,size,(page-1)*size)]);
    return reply({today,page,pageSize:size,total:total.results[0].total,items:await Promise.all(rows.results.map(item))});
  }
  const b = await h.bodyJson(request,16000), {action} = b;
  if (typeof action!=='string'||!Object.hasOwn(inputs,action)||Object.keys(b).some(k=>!['action','id','mutationId',...(action==='create'?[]:['version']),...inputs[action]].includes(k))) fail(400,'Choose an action in the equipment register.');
  const id=checkedId(b.id), mutation=checkedId(b.mutationId);
  if (action!=='create' && (!Number.isSafeInteger(b.version)||b.version<1)) fail(400,'Reopen this equipment record before saving.');
  const receipt = await signed(keys.receipt,JSON.stringify(b,Object.keys(b).sort()));
  const retry = async () => {
    const saved = await db.prepare('SELECT actor_id,receipt FROM club_equipment_history WHERE mutation_id=?').bind(mutation).first();
    if (saved && (saved.actor_id!==identity.id || saved.receipt!==receipt)) fail(409,'This action was already used. Reopen the equipment record.');
    return !!saved;
  };
  if (await retry()) return reply(await detail(await read(id)));
  const conflict = () => fail(409,'Another officer has updated this record. Refresh it to see the latest handover.');
  const old = await read(id);
  if (action==='create' ? !!old : !old||old.version!==b.version) {
    if (await retry()) return reply(await detail(await read(id)));
    conflict();
  }
  const previous = old?await item(old):null;
  if (previous?.status==='returned') fail(409,'This item has already gone back to its owner. Its history is still available.');
  const owner=action==='create'?b.ownerType:previous.ownerType;
  if (!owners.includes(owner)) fail(400,'Choose who owns the equipment.');
  const onDate=h.dateField(b.onDate);
  if (onDate>today || (previous && onDate<previous.onDate)) fail(400,'Choose a date between the last entry and today.');
  const text = (key,label,max,required=false) => h.textField(b[key],label,max,required);
  const fields = {name:previous?.name||'',lender:previous?.lender||'',lenderContact:previous?.lenderContact||'',
    custodian:text('custodian','the person holding the equipment',120,true),location:text('location','the equipment location',180,true),
    notes:text('notes','the handover note',600)};
  let status=previous?.status||'available', lenderDue=previous?.lenderDue||'', loanDue=previous?.loanDue||'';
  if (['create','edit'].includes(action)) {
    fields.name=text('name','the equipment name',140,true);
    fields.lender=text('lender','the owner’s name',160,owner!=='club');
    fields.lenderContact=text('lenderContact','the owner’s contact details',180);
    lenderDue=h.dateField(b.lenderDue,false);
    if (owner==='club' && (fields.lender || fields.lenderContact || lenderDue)) fail(400,'Owner contact and owner return dates apply to borrowed gear.');
    if (lenderDue && lenderDue<onDate && lenderDue!==previous?.lenderDue) fail(400,'Choose an owner return date on or after this entry.');
  }
  if (action==='lend' || (action==='edit' && status==='out')) {
    if (action==='lend' && status!=='available') fail(409,'This equipment is already on loan.');
    loanDue=h.dateField(b.loanDue);
    if ((loanDue<onDate && loanDue!==previous?.loanDue) || (lenderDue && loanDue>lenderDue)) fail(400,'Choose a check-in date within the time the club has the equipment.');
    status='out';
  } else if (action==='checkIn') {
    if (status!=='out') fail(409,'Only equipment on loan can be checked back in.');
    status='available'; loanDue='';
  } else if (action==='returnOwner') {
    if (owner==='club') fail(400,'Club-owned gear stays in the club register. Check it in when it comes back.');
    status='returned'; loanDue='';
  } else if (b.loanDue) fail(400,'Set the check-in date when you lend the equipment.');
  const source=b.sourceOfferId?checkedId(b.sourceOfferId):previous?.sourceOfferId||null;
  if (source && owner!=='sponsor') fail(400,'A sponsorship equipment loan belongs to the sponsor.');
  const linkChange=source && (action==='create' || (action==='edit' && labelKey(fields.name)!==labelKey(previous.name)));
  let itemKey=null;
  if(linkChange) {
    itemKey=await signed(keys.receipt,source+'\n'+labelKey(fields.name));
    // Earlier single-item offers have encrypted names but no comparison key.
    const legacy=await db.prepare(selectItem+' WHERE link.source_offer_id=? AND link.item_key IS NULL AND e.id<>?').bind(source,id).all();
    for(const row of legacy.results) if(labelKey((await item(row)).name)===labelKey(fields.name)) fail(409,'This offer already has equipment with that name. Give each physical item its own name, such as Esky 1 or Esky 2.');
  }
  const uniqueLabel='NOT EXISTS(SELECT 1 FROM club_equipment_offer_items WHERE source_offer_id=? AND item_key=? AND item_id<>?)';
  const version=(previous?.version||0)+1, stamp=new Date().toISOString(), s=scope(id,version);
  const officer=identity.administrator?'Webmaster':Object.hasOwn(offices,identity.name)?offices[identity.name]:identity.name||identity.id;
  const [privateDetails,history]=await Promise.all([
    sealPrivateText(keys.content,s,JSON.stringify(fields)),
    sealPrivateText(keys.content,s+':history',JSON.stringify({...fields,officer,status,lenderDue,loanDue}))
  ]);
  let write;
  if (action==='create') {
    const offerGuard=source?" AND EXISTS(SELECT 1 FROM sponsor_offers WHERE id=? AND status='agreed' AND loan_eligible=1) AND "+uniqueLabel:'';
    write=db.prepare('INSERT INTO club_equipment(id,owner_type,status,on_date,loan_due,lender_due,private_details,source_offer_id,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE '+fresh+offerGuard+' ON CONFLICT DO NOTHING')
      .bind(id,owner,status,onDate,loanDue,lenderDue,privateDetails,null,stamp,mutation,...(source?[source,source,itemKey,id]:[]));
  } else {
    write=db.prepare('UPDATE club_equipment SET status=?,on_date=?,loan_due=?,lender_due=?,private_details=?,version=?,updated_at=? WHERE id=? AND version=? AND '+fresh+(linkChange?' AND '+uniqueLabel:''))
      .bind(status,onDate,loanDue,lenderDue,privateDetails,version,stamp,id,b.version,mutation,...(linkChange?[source,itemKey,id]:[]));
  }
  const linkWrites=linkChange?[db.prepare('INSERT INTO club_equipment_offer_items(item_id,source_offer_id,item_key) SELECT ?,?,? WHERE changes()=1 ON CONFLICT(item_id) DO UPDATE SET item_key=excluded.item_key').bind(id,source,itemKey)]:[];
  const [change]=await db.batch([write,...linkWrites,db.prepare('INSERT INTO club_equipment_history(mutation_id,item_id,version,action,on_date,actor_id,private_snapshot,receipt,recorded_at) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1')
    .bind(mutation,id,version,action,onDate,identity.id,history,receipt,stamp),
    db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,'equipment_'+action,id,stamp)]);
  if (!change.meta.changes && !await retry()) {
    if (linkChange) fail(409,'Check the agreed offer and equipment names. Each physical item needs its own name, such as Esky 1 or Esky 2.');
    conflict();
  }
  return reply(await detail(await read(id)),action==='create'&&change.meta.changes?201:200);
}
