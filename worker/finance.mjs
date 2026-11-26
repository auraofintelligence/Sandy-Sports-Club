// Stock ledger and reports (FIN-01, FIN-05), treasurer price control (FIN-04) and
// equipment custody and loans (FIN-06). Record keeping only: no sale, payment, invoice
// or refund is processed, and nothing is sent to anyone.
import {fail,json,now,dbFor,payload,field,dateField,version,requireRole,ensureApprover,https} from './shared.mjs';
import {SUITE_BY_KEY} from '../studio/sandy-suite-spec.js';
import {suiteBody,suiteAllowed,visibleRecords} from './record-policy.mjs';
import {stableId,writeRecord,commit} from './meetings.mjs';
const stock=SUITE_BY_KEY.stock,equipment=SUITE_BY_KEY.equipment;
// Stock follows its desk boundary (Webmaster and Treasurer); price approval therefore
// falls to the Webmaster as the only approver with stock access, never the proposer.
const READ=stock.roles,WRITE=['webmaster','treasurer'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const CONDITIONS=equipment.fields.find(f=>f.key==='condition').options;
const brisbane=iso=>new Date(Date.parse(iso)+36e6).toISOString().slice(0,10);
const today=()=>brisbane(new Date().toISOString());
const money=n=>Math.round(n*100)/100;
// Owner policy default: an Australian 1 July to 30 June financial year unless configured.
export const fiscalStartMonth=env=>{const n=Number(env.SANDY_FISCAL_YEAR_START_MONTH);return Number.isInteger(n)&&n>=1&&n<=12?n:7};
export function periodFor(kind,date,startMonth){
 const [y,m]=date.split('-').map(Number),pad=n=>String(n).padStart(2,'0'),iso=(yy,mm)=>yy+'-'+pad(mm)+'-01';
 const add=(yy,mm,n)=>{const t=yy*12+mm-1+n;return [Math.floor(t/12),t%12+1]};
 let from;
 if(kind==='month')from=[y,m];
 else if(kind==='quarter'){const off=((m-startMonth)%12+12)%12;from=add(y,m,-(off%3))}
 else if(kind==='year'){const off=((m-startMonth)%12+12)%12;from=add(y,m,-off)}
 else fail(400,'Choose a month, quarter or year report.','invalid_period');
 const len={month:1,quarter:3,year:12}[kind],to=add(from[0],from[1],len);
 return {from:iso(...from),to:iso(...to),label:kind};
}
async function loadDesk(db,desk,recordId,actor){
 if(!uuid.test(recordId||''))fail(404,'That record does not exist.','record_not_found');
 const row=await db.prepare('SELECT * FROM club_records WHERE id=?').bind(recordId).first(),body=suiteBody(row,desk);
 if(!body||!suiteAllowed(row,desk,actor))fail(404,'That record is not in this working area.','record_not_found');
 return {row,body};
}
const MOVES=['stock_receive','stock_issue','stock_count','stock_adjust'];
async function ledger(db,row){
 const q=await db.prepare("SELECT resource_version AS version,operation,actor_office AS office,at_utc AS at,changes_json FROM club_revisions WHERE resource_kind='record' AND resource_id=? AND operation IN ('stock_receive','stock_issue','stock_count','stock_adjust') ORDER BY resource_version").bind(row.id).all();
 return (q.results||[]).map(r=>{const c=JSON.parse(r.changes_json);
  const delta=Number.isInteger(c.delta)?c.delta:c.direction==='issue'?-c.quantity:c.quantity;
  return {version:r.version,direction:c.direction,quantity:c.quantity,delta,date:c.movementDate||brisbane(r.at),unitCost:c.unitCost??null,supplier:c.supplier||'',note:c.note||'',balanceAfter:c.balanceAfter,office:r.office,at:r.at}});
}
function itemReport(row,body,moves,from,to){
 const opening=Number(body.fields.opening||0);let before=opening,rq=0,rc=0,missing=0,iq=0,aq=0,costQ=0,costV=0;
 for(const m of moves){
  if(m.date<from){before+=m.delta}
  else if(m.date<to){
   if(m.direction==='receive'){rq+=m.quantity;if(m.unitCost===null)missing++;else rc+=m.quantity*m.unitCost}
   else if(m.direction==='issue')iq+=m.quantity;else aq+=m.delta;
  }
  if(m.date<to&&m.direction==='receive'&&m.unitCost!==null){costQ+=m.quantity;costV+=m.quantity*m.unitCost}
 }
 const closing=before+rq-iq+aq,known=costQ>0?costV/costQ:null,estimate=known===null&&body.fields.unitCost!==null&&body.fields.unitCost!==''&&body.fields.unitCost!==undefined?Number(body.fields.unitCost):null;
 const unit=known??estimate;
 return {id:row.id,title:row.title,sku:body.fields.sku||'',category:body.fields.category||'',openingBalance:before,received:rq,receivedCost:money(rc),issued:iq,adjusted:aq,closingBalance:closing,
  averageUnitCost:unit===null?null:money(unit),costBasis:known!==null?'recorded deliveries':estimate!==null?'estimate only':'missing',valuation:unit===null?null:money(closing*unit),missingCostReceipts:missing,
  reconciles:closing===before+rq-iq+aq};
}
async function stockReport(req,env,db,actor){
 const url=new URL(req.url),kind=url.searchParams.get('period')||'month',date=dateField(url.searchParams.get('date')||today(),false);
 const p=periodFor(kind,date,fiscalStartMonth(env));
 const rows=await visibleRecords(db,"WHERE kind='asset' AND json_extract(body_json,'$.domain')='stock'",[],'title,id',300,r=>suiteAllowed(r,stock,actor));
 const items=[];for(const r of rows)items.push(itemReport(r,JSON.parse(r.body_json),await ledger(db,r),p.from,p.to));
 const totals={received:items.reduce((n,i)=>n+i.received,0),issued:items.reduce((n,i)=>n+i.issued,0),receivedCost:money(items.reduce((n,i)=>n+i.receivedCost,0)),
  valuation:money(items.reduce((n,i)=>n+(i.valuation||0),0)),itemsMissingCost:items.filter(i=>i.costBasis==='missing').length,receiptsMissingCost:items.reduce((n,i)=>n+i.missingCostReceipts,0)};
 const csv=['title,sku,opening,received,received_cost,issued,adjusted,closing,unit_cost,cost_basis,valuation',...items.map(i=>[i.title,i.sku,i.openingBalance,i.received,i.receivedCost,i.issued,i.adjusted,i.closingBalance,i.averageUnitCost??'',i.costBasis,i.valuation??''].map(v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':v).join(','))].join('\n');
 if(url.searchParams.get('format')==='csv')return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 return json({period:{...p,toExclusive:true,fiscalYearStartMonth:fiscalStartMonth(env)},items,totals,
  notice:'Stock records only. Event tickets, donations and payments are not part of stock valuation, and no sale was processed.'});
}
async function priceControl(req,env,db,actor,row,body){
 const b=await payload(req,4000),ops={changes:[],...(body.priceOps||{})};
 if(b.action==='approve'){
  ensureApprover(actor,env);
  if(version(b.version)!==row.version)fail(409,'This price changed. Reload it.','conflict');
  const c=ops.changes.find(x=>x.id===b.changeId);if(!c)fail(404,'That price change does not exist.','change_not_found');
  if(c.state!=='proposed')fail(409,'That price change is already '+c.state+'.','change_closed');
  if(c.byId===actor.id)fail(403,'A different officer must approve a price change.','self_approval');
  const evidence=https(b.evidence);if(!evidence)fail(400,'Link the committee decision for this price.','evidence_required');
  const changes=ops.changes.map(x=>x.id===c.id?{...x,state:'approved',approvedBy:actor.office_label||actor.role,approvedAt:now(),evidence}:x.state==='proposed'?{...x,state:'superseded'}:x);
  const w=writeRecord(db,actor,row,{...body,fields:{...body.fields,price:c.new},priceOps:{...ops,changes}},'price_approved',{changes:{changeId:c.id,from:c.old,to:c.new,effective:c.effective}});
  await commit(db,w,'This price changed. Reload it.');return json({ok:true,version:w.next,price:c.new});
 }
 if(b.action!=='propose')fail(400,'Propose or approve a price change.','invalid_action');
 requireRole(actor,WRITE);
 const price=Number(b.price);if(!Number.isFinite(price)||price<0||price>100000)fail(400,'Use a valid price in AUD.','invalid_price');
 const effective=dateField(b.effectiveDate,false),reason=field(b.reason,300);if(!reason)fail(400,'Record why the price is changing.','reason_required');
 const request=uuid.test(b.mutationId||'')?b.mutationId:crypto.randomUUID(),changeId=await stableId('price/'+row.id+'/'+request);
 if(ops.changes.some(x=>x.id===changeId))return json({ok:true,id:changeId,version:row.version,replayed:true});
 if(version(b.version)!==row.version)fail(409,'This price changed. Reload it.','conflict');
 const old=body.fields.price===''||body.fields.price===undefined?null:body.fields.price;
 if(old!==null&&Number(old)===money(price))fail(400,'The new price is the same as the current price.','unchanged_price');
 const change={id:changeId,old,new:money(price),effective,reason,state:'proposed',by:actor.office_label||actor.role,byId:actor.id,at:now()};
 const w=writeRecord(db,actor,row,{...body,priceOps:{...ops,changes:[...ops.changes,change].slice(-50)}},'price_proposed',{changes:{changeId,from:old,to:change.new,effective}});
 await commit(db,w,'This price changed. Reload it.');return json({ok:true,id:changeId,version:w.next,state:'proposed'},201);
}
async function priceAlerts(db,actor){
 const rows=await visibleRecords(db,"WHERE kind='asset' AND json_extract(body_json,'$.domain')='stock' AND json_extract(body_json,'$.priceOps') IS NOT NULL",[],'updated_utc DESC,id',300,r=>suiteAllowed(r,stock,actor));
 const alerts=[];
 for(const r of rows)for(const c of JSON.parse(r.body_json).priceOps.changes)alerts.push({id:c.id,itemId:r.id,item:r.title,old:c.old,new:c.new,effective:c.effective,state:c.state,reason:c.reason,by:c.by,at:c.at,approvedBy:c.approvedBy||null});
 return alerts.sort((a,b)=>b.at.localeCompare(a.at));
}
function loanView(row,body,d=today()){
 const o=body.loanOps||{onLoan:null,history:[]},l=o.onLoan;
 return {id:row.id,version:row.version,title:row.title,tag:body.fields.tag||'',type:body.fields.assetType||'',condition:body.fields.condition||'',location:body.fields.location||'',
  onLoan:l?{holder:l.holder,out:l.out,due:l.due,conditionOut:l.conditionOut,overdue:Boolean(l.due&&l.due<d),daysOverdue:l.due&&l.due<d?Math.round((Date.parse(d)-Date.parse(l.due))/864e5):0}:null,
  history:o.history||[]};
}
async function loanAction(req,db,actor,row,body){
 const b=await payload(req,6000);if(version(b.version)!==row.version)fail(409,'This equipment record changed. Reload it.','conflict');
 const o={onLoan:null,history:[],...(body.loanOps||{})},fields={...body.fields},at=now(),by=actor.office_label||actor.role;
 const condition=b.condition===undefined?fields.condition:field(b.condition,30);
 if(condition&&!CONDITIONS.includes(condition))fail(400,'Choose a valid condition.','invalid_condition');
 let op,entry;
 if(b.action==='issue'){
  if(o.onLoan)fail(409,'This item is already on loan. Record its return first.','already_on_loan');
  if(['Retired','Repair'].includes(fields.condition))fail(409,'This item is not available for loan.','not_available');
  const holder=field(b.holder,120);if(!holder)fail(400,'Record who holds the item.','holder_required');
  const due=dateField(b.dueDate,false);if(due<today())fail(400,'The return date cannot be in the past.','invalid_due');
  o.onLoan={holder,out:today(),due,conditionOut:condition,by};
  Object.assign(fields,{holder,outDate:today(),returnDate:due,returned:false,condition});
  op='equipment_loaned';entry={event:'issued',holder,due,condition,at,by};
 }else if(b.action==='return'){
  if(!o.onLoan)fail(409,'This item is not on loan.','not_on_loan');
  entry={event:'returned',holder:o.onLoan.holder,out:o.onLoan.out,due:o.onLoan.due,late:o.onLoan.due<today(),conditionOut:o.onLoan.conditionOut,condition,note:field(b.note,500),at,by};
  o.onLoan=null;Object.assign(fields,{holder:'',returned:true,condition});op='equipment_returned';
 }else if(b.action==='maintenance'){
  const note=field(b.note,1000);if(!note)fail(400,'Describe the maintenance or inspection.','note_required');
  fields.condition=condition;fields.maintenance=(fields.maintenance?fields.maintenance+'\n':'')+today()+' '+note;
  op='equipment_maintained';entry={event:'maintenance',condition,note,at,by};
 }else fail(400,'Choose issue, return or maintenance.','invalid_action');
 o.history=[...o.history,entry].slice(-200);
 const w=writeRecord(db,actor,row,{...body,fields,loanOps:o},op,{changes:{event:entry.event,condition}});
 await commit(db,w,'This equipment record changed. Reload it.');
 return json({ok:true,version:w.next,item:loanView({...row,version:w.next},{...body,fields,loanOps:o})});
}
export async function financeEndpoint(req,env,path,actor){
 const db=dbFor(env);
 if(path==='/api/committee/equipment/loans'&&req.method==='GET'){
  requireRole(actor,equipment.roles);
  const rows=await visibleRecords(db,"WHERE kind='equipment' AND json_extract(body_json,'$.domain')='equipment'",[],'title,id',300,r=>suiteAllowed(r,equipment,actor));
  const items=rows.map(r=>loanView(r,JSON.parse(r.body_json)));
  return json({items,onLoan:items.filter(i=>i.onLoan).length,overdue:items.filter(i=>i.onLoan?.overdue).length,notice:'Overdue items are shown here only. No borrower is messaged.'});
 }
 const eq=path.match(/^\/api\/committee\/equipment\/([a-f0-9-]{36})\/loan$/);
 if(eq){
  requireRole(actor,equipment.roles);const {row,body}=await loadDesk(db,equipment,eq[1],actor);
  if(req.method==='GET')return json({item:loanView(row,body)});
  if(req.method==='POST')return loanAction(req,db,actor,row,body);
  fail(405,'Unsupported loan operation.','method_not_allowed');
 }
 const pm=path.match(/^\/api\/committee\/finance\/stock\/([a-f0-9-]{36})\/price$/);
 if(pm&&req.method==='POST'){requireRole(actor,READ);const {row,body}=await loadDesk(db,stock,pm[1],actor);return priceControl(req,env,db,actor,row,body)}
 requireRole(actor,READ);
 if(path==='/api/committee/finance/stock-report'&&req.method==='GET')return stockReport(req,env,db,actor);
 if(path==='/api/committee/finance/price-alerts'&&req.method==='GET')return json({alerts:await priceAlerts(db,actor)});
 const m=path.match(/^\/api\/committee\/finance\/stock\/([a-f0-9-]{36})\/(ledger|price)$/);
 if(!m)fail(404,'Unknown finance service.','not_found');
 const {row,body}=await loadDesk(db,stock,m[1],actor);
 if(m[2]==='ledger'&&req.method==='GET'){
  const moves=await ledger(db,row),opening=Number(body.fields.opening||0),balance=opening+moves.reduce((n,x)=>n+x.delta,0);
  const recorded=opening+Number(body.fields.inward||0)-Number(body.fields.outward||0)+Number(body.stockOps?.adjust||0);
  return json({item:{id:row.id,title:row.title,version:row.version,opening},movements:moves,balance,recordedBalance:recorded,reconciles:balance===recorded,priceChanges:body.priceOps?.changes||[]});
 }
 fail(405,'Unsupported finance operation.','method_not_allowed');
}
