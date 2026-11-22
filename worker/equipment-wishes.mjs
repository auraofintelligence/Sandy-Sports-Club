import {canManageStock} from './stock.mjs';
import {privateAreaKeys,openPrivateText,sealPrivateText} from './member-network.mjs';

const committeePath='/api/committee/equipment-wishes', memberPath='/api/member/equipment-wishes';
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const headers={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
const office={secretary:'Secretary',assistantsecretary:'Assistant Secretary',president:'President',vicepresident:'Vice President',treasurer:'Treasurer'};
const actions={create:['name','purpose','goalCents','sourceGrantId','sourceGrantVersion'],edit:['name','purpose','goalCents'],publish:[],unpublish:[],fulfil:[],reopen:[],money:['kind','amountCents','onDate','note']};
const fresh='NOT EXISTS(SELECT 1 FROM equipment_wish_activity WHERE mutation_id=?)';
const safeCents=Number.MAX_SAFE_INTEGER;
const privateScope='Sandy private equipment wishlist v1';
const todayBrisbane=()=>new Date(Date.now()+36000000).toISOString().slice(0,10);

// Include the proposed date when checking older entries. A backdated correction
// must leave the running balance valid on every affected day, including its own.
const safeDailyBalance=`NOT EXISTS (
  SELECT 1 FROM (
    SELECT day,SUM(change_cents) OVER (ORDER BY day) AS balance FROM (
      SELECT day,SUM(cents) AS change_cents FROM (
        SELECT on_date AS day,amount_cents AS cents FROM equipment_wish_activity WHERE wish_id=? AND action='money'
        UNION ALL SELECT ? AS day,? AS cents
      ) GROUP BY day
    )
  ) WHERE balance<0 OR balance>?
)`;

async function desk(db,identity,env,committee,keys) {
  const visible=committee?'1':'w.published=1';
  const projection='w.id,w.name,w.purpose,w.goal_cents AS goalCents,w.total_cents AS totalCents,w.status';
  const reads=[
    db.prepare('SELECT '+projection+(committee?',w.published,w.version':'')+' FROM equipment_wishes w WHERE '+visible+
      " ORDER BY CASE w.status WHEN 'active' THEN 0 ELSE 1 END,w.created_at DESC,w.id"),
    db.prepare(`SELECT wish_id AS wishId,day,SUM(day_cents) OVER (PARTITION BY wish_id ORDER BY day) AS totalCents FROM (
      SELECT w.id AS wish_id,a.on_date AS day,SUM(a.amount_cents) AS day_cents FROM equipment_wishes w
      JOIN equipment_wish_activity a ON a.wish_id=w.id AND a.action='money' WHERE `+visible+' GROUP BY w.id,a.on_date) ORDER BY wish_id,day')
  ];
  if(committee)reads.push(db.prepare("SELECT wish_id,mutation_id,kind,amount_cents,on_date,recorded_at,private_entry FROM equipment_wish_activity WHERE action='money' ORDER BY on_date DESC,version DESC"));
  const [items,history,entries]=await db.batch(reads);
  const byId=new Map(items.results.map(w=>[w.id,committee?{...w,published:!!w.published,history:[],ledger:[]}:{...w,history:[]}]));
  for(const {wishId,day,totalCents} of history.results)byId.get(wishId)?.history.push({day,totalCents});
  if(committee) {
    // Preserve the database order when ciphertexts finish opening out of order.
    const ledger=await Promise.all(entries.results.map(async row=>({
      wishId:row.wish_id,id:row.mutation_id,kind:row.kind,amountCents:row.amount_cents,onDate:row.on_date,recordedAt:row.recorded_at,
      ...JSON.parse(await openPrivateText(keys.content,'equipment-wish:'+row.mutation_id,row.private_entry))
    })));
    for(const {wishId,...entry} of ledger)byId.get(wishId)?.ledger.push(entry);
  }
  return {...(committee?{canRecordMoney:canManageStock(identity,env)}:{}),wishes:[...byId.values()]};
}

export async function equipmentWishesEndpoint(request,env,identity,h) {
  const path=new URL(request.url).pathname, committee=path===committeePath;
  const fail=(status,message)=>{throw new h.HttpError(status,message,'equipment_wishes');};
  if(!committee && path!==memberPath)fail(404,'This wishlist could not be found.');
  h.requireRole(identity,committee?['committee']:['member','committee']);
  if(request.method!=='GET' && (request.method!=='POST' || !committee))fail(405,'Open the committee wishlist to record a change.');
  const store=h.requireDb(env),db=store.withSession?.('first-primary')||store;
  if(committee && !env.PRIVATE_AUTH_KEY)fail(503,'The private wishlist ledger is temporarily unavailable.');
  const keys=committee?await privateAreaKeys(env.PRIVATE_AUTH_KEY,privateScope):null;
  const reply=async(status=200)=>h.json(await desk(db,identity,env,committee,keys),status,headers);
  if(request.method==='GET')return reply();
  const body=await h.bodyJson(request,10000),{action}=body;
  if(typeof action!=='string'||!Object.hasOwn(actions,action)||
    Object.keys(body).some(k=>!['action','id','mutationId',...(action==='create'?[]:['version']),...actions[action]].includes(k)))fail(400,'Choose an action from the equipment wishlist.');
  if(![body.id,body.mutationId].every(v=>typeof v==='string'&&uuid.test(v))||
    (action!=='create' && (!Number.isSafeInteger(body.version)||body.version<1)))fail(400,'Reopen this wish before saving.');
  const fromGrant=Object.hasOwn(body,'sourceGrantId')||Object.hasOwn(body,'sourceGrantVersion');
  if(fromGrant&&(typeof body.sourceGrantId!=='string'||!uuid.test(body.sourceGrantId)||!Number.isSafeInteger(body.sourceGrantVersion)||body.sourceGrantVersion<1))fail(400,'Reopen the grant before adding an equipment wish.');
  if(action==='money'&&!canManageStock(identity,env))fail(403,'The Treasurer or Webmaster records money received and corrections.');
  const id=body.id.toLowerCase(),mutation=body.mutationId.toLowerCase(),stamp=new Date().toISOString();
  const bytes=await crypto.subtle.sign('HMAC',keys.receipt,new TextEncoder().encode(JSON.stringify(body,Object.keys(body).sort())));
  const receipt=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const retried=async()=>{
    const row=await db.prepare('SELECT actor_id,receipt FROM equipment_wish_activity WHERE mutation_id=?').bind(mutation).first();
    if(row&&(row.actor_id!==identity.id||row.receipt!==receipt))fail(409,'This action has already been recorded. Reopen the wish.');
    return !!row;
  };
  if(await retried())return reply();
  let change,kind=null,amount=null,onDate=null,entry=null;
  const guardedUpdate=(set,values,guard='1',extra=[])=>db.prepare('UPDATE equipment_wishes SET '+set+',version=version+1 WHERE id=? AND version=? AND '+fresh+' AND '+guard)
    .bind(...values,id,body.version,mutation,...extra);
  if(action==='create'||action==='edit') {
    const name=h.textField(body.name,'the equipment name',100,true),purpose=h.textField(body.purpose,'the short purpose for members',360,true);
    if(/[\r\n]/.test(name)||/<\/?[a-z][^>]*>/i.test(name+' '+purpose))fail(400,'Use plain text for the equipment name and purpose.');
    const goal=body.goalCents;
    if(!Number.isSafeInteger(goal)||goal<0)fail(400,'Enter a valid goal in Australian dollars, or use zero for an in-kind wish.');
    change=action==='create'
      ?db.prepare('INSERT INTO equipment_wishes(id,name,purpose,goal_cents,created_at) SELECT ?,?,?,?,? WHERE '+fresh+
        (fromGrant?' AND EXISTS(SELECT 1 FROM committee_grants WHERE id=? AND version=?)':'')+' ON CONFLICT(id) DO NOTHING')
        .bind(id,name,purpose,goal,stamp,mutation,...(fromGrant?[body.sourceGrantId,body.sourceGrantVersion]:[]))
      :guardedUpdate('name=?,purpose=?,goal_cents=?',[name,purpose,goal],'(? > 0 OR total_cents=0)',[goal]);
  } else if(action==='money') {
    ({kind,amountCents:amount}=body);
    if(!['receipt','adjustment'].includes(kind)||!Number.isSafeInteger(amount)||!amount||(kind==='receipt'&&amount<0))fail(400,'Enter a positive receipt or a signed correction in Australian dollars.');
    onDate=h.dateField(body.onDate);
    if(onDate>todayBrisbane())fail(400,'The date money was recorded cannot be in the future.');
    const note=h.textField(body.note,'the internal ledger note',500,true);
    const actor=identity.administrator?'Webmaster':Object.hasOwn(office,identity.name)?office[identity.name]:identity.name||identity.id;
    entry=await sealPrivateText(keys.content,'equipment-wish:'+mutation,JSON.stringify({note,actor}));
    change=guardedUpdate('total_cents=total_cents+?',[amount],
      'goal_cents>0 AND total_cents+? BETWEEN 0 AND ? AND '+safeDailyBalance,[amount,safeCents,id,onDate,amount,safeCents]);
  } else {
    const transitions={publish:['published',1,0],unpublish:['published',0,1],fulfil:['status','fulfilled','active'],reopen:['status','active','fulfilled']};
    const [field,next,expected]=transitions[action];
    change=guardedUpdate(field+'=?',[next],field+'=?',[expected]);
  }
  const version=action==='create'?1:body.version+1;
  const writes=[change,db.prepare(`INSERT INTO equipment_wish_activity
    (mutation_id,wish_id,version,action,actor_id,receipt,recorded_at,kind,amount_cents,on_date,private_entry)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1`).bind(mutation,id,version,action,identity.id,receipt,stamp,kind,amount,onDate,entry),
    db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,'equipment_wish_'+action,id,stamp)];
  if(fromGrant)writes.push(
    db.prepare('INSERT INTO committee_grant_wishes(grant_id,wish_id) SELECT ?,? WHERE changes()=1').bind(body.sourceGrantId,id),
    db.prepare("UPDATE committee_grants SET version=version+1,updated_by=?,updated_at=?,last_change=? WHERE id=? AND changes()=1")
      .bind(identity.id,stamp,'new-wish:'+mutation,body.sourceGrantId),
    db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,'grant_wish_linked',body.sourceGrantId,stamp)
  );
  const [saved]=await db.batch(writes);
  if(!saved.meta.changes && !await retried()) {
    if(fromGrant) {
      const source=await db.prepare('SELECT version FROM committee_grants WHERE id=?').bind(body.sourceGrantId).first();
      if(source?.version!==body.sourceGrantVersion)fail(409,'The grant has changed. Reopen the grant and add the equipment wish again.');
    }
    const current=await db.prepare('SELECT version,goal_cents,total_cents FROM equipment_wishes WHERE id=?').bind(id).first();
    if(current && current.version===body.version) {
      if(action==='money')fail(400,current.goal_cents===0?'An in-kind wish has no cash goal.':'This entry would put a daily balance outside the available funds.');
      if(action==='edit'&&body.goalCents===0&&current.total_cents)fail(400,'This wish has money recorded. Keep a cash goal until its balance is zero.');
    }
    fail(409,'This wish has changed. Refresh the wishlist and check the latest entry.');
  }
  return reply(action==='create'&&saved.meta.changes?201:200);
}
