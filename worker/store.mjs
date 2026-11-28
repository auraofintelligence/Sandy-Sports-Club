// Sandy Sports working demo store. The club has no bank account: no payment is taken, orders are requests only.
// Treasurer and Webmaster manage products, stock, orders, CSV import and export; other officers can read reports.
import {fail,json,now,id,dbFor,payload,field,requireRole,audit,STAFF,MEMBER_ADMIN} from './shared.mjs';
import {DEMO_PRODUCTS,RETIRED_DEMO_SKUS} from './store-catalogue.mjs';
import {cleanPhoto,photoResponse} from './profiles.mjs';
export const STORE_MANAGERS=['webmaster','treasurer'];
export const STORE_NOTICE='Working demo store. Sandy Sports has no bank account yet, so no payment is taken and orders are requests only until further notice.';
const KINDS=['merch','ticket','donation'],STATUSES=['draft','active','archived'],ORDER_STATUSES=['requested','confirmed','ready','collected','cancelled'];
const BIRTHDAY_PERCENT=10,LOW_STOCK=3;
export const COLLECTION_POINTS=['Dunwich','Amity Point','Point Lookout','At the next club event'];
const APPLIES=['all','merch','tickets'],DEMO_CODES=[
 {code:'FOUNDING10',kind:'percent',value:10,applies:'merch',minSpend:0,maxUses:null,once:1,membersOnly:1,note:'Founding members: 10% off merch, once each.'},
 {code:'SUMMER5',kind:'amount',value:500,applies:'all',minSpend:4000,maxUses:200,once:0,membersOnly:0,note:'$5 off orders of $40 or more over summer.'},
 {code:'FILMCLUB15',kind:'percent',value:15,applies:'category:Film Club',minSpend:0,maxUses:null,once:0,membersOnly:1,note:'15% off Film Club merch for members.'}];
const DDL=[
 `CREATE TABLE IF NOT EXISTS store_products(id TEXT PRIMARY KEY,sku TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL DEFAULT 'merch' CHECK(kind IN ('merch','ticket','donation')),description TEXT NOT NULL DEFAULT '',price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents>=0),member_price_cents INTEGER CHECK(member_price_cents IS NULL OR member_price_cents>=0),cost_cents INTEGER CHECK(cost_cents IS NULL OR cost_cents>=0),variants_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(variants_json)),event_date TEXT,event_time TEXT NOT NULL DEFAULT '',venue TEXT NOT NULL DEFAULT '',photo TEXT,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),sort INTEGER NOT NULL DEFAULT 100,demo INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS store_orders(id TEXT PRIMARY KEY,number INTEGER NOT NULL UNIQUE,collection TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',discount_code TEXT NOT NULL DEFAULT '',account_id TEXT REFERENCES club_accounts(id),name TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','ready','collected','cancelled')),lines_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(lines_json)),subtotal_cents INTEGER NOT NULL DEFAULT 0,discount_cents INTEGER NOT NULL DEFAULT 0,discount_label TEXT NOT NULL DEFAULT '',donation_cents INTEGER NOT NULL DEFAULT 0,total_cents INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',stock_applied INTEGER NOT NULL DEFAULT 0,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`,
 'CREATE TABLE IF NOT EXISTS store_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)',
 `CREATE TABLE IF NOT EXISTS store_discounts(code TEXT PRIMARY KEY COLLATE NOCASE,kind TEXT NOT NULL CHECK(kind IN ('percent','amount')),value INTEGER NOT NULL CHECK(value>0),applies TEXT NOT NULL DEFAULT 'all',min_spend_cents INTEGER NOT NULL DEFAULT 0,max_uses INTEGER,uses INTEGER NOT NULL DEFAULT 0,once_per_member INTEGER NOT NULL DEFAULT 0,members_only INTEGER NOT NULL DEFAULT 0,starts TEXT,ends TEXT,active INTEGER NOT NULL DEFAULT 1,note TEXT NOT NULL DEFAULT '',created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`];
const ready=new WeakSet();
const cents=d=>Math.round(Number(d)*100);
async function ensure(env,db){
 if(ready.has(env))return;
 for(const s of DDL)await db.prepare(s).run();
 // Orders created before checkout existed gain the checkout columns.
 const cols=new Set(((await db.prepare('PRAGMA table_info(store_orders)').all()).results||[]).map(c=>c.name));
 for(const c of ['collection','phone','discount_code'])if(!cols.has(c))await db.prepare("ALTER TABLE store_orders ADD COLUMN "+c+" TEXT NOT NULL DEFAULT ''").run();
 if(!await db.prepare("SELECT 1 AS x FROM store_settings WHERE key='codes_seeded'").first()){
  const at=now();
  await db.batch([...DEMO_CODES.map(c=>db.prepare('INSERT OR IGNORE INTO store_discounts(code,kind,value,applies,min_spend_cents,max_uses,once_per_member,members_only,note,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(c.code,c.kind,c.value,c.applies,c.minSpend,c.maxUses,c.once,c.membersOnly,c.note,at,at)),
   db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('codes_seeded',?)").bind(at)]);
 }
 // Retire demo sports equipment already seeded (left to local stockists) and move branded lifestyle items to Club gear.
 if(!await db.prepare("SELECT 1 AS x FROM store_settings WHERE key='demo_v2'").first()){
  const at=now();
  await db.batch([...RETIRED_DEMO_SKUS.map(sku=>db.prepare("UPDATE store_products SET status='archived',version=version+1,updated_utc=? WHERE sku=? AND demo=1").bind(at,sku)),
   db.prepare("UPDATE store_products SET category='Club gear',version=version+1,updated_utc=? WHERE sku IN ('GEAR-BOTTLE','GEAR-TOWEL') AND demo=1 AND category='Beach gear'").bind(at),
   db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('demo_v2',?)").bind(at)]);
 }
 // Rename the demo hoodie to the I ❤ Sandy Sports design (retired slogan).
 if(!await db.prepare("SELECT 1 AS x FROM store_settings WHERE key='demo_v3'").first()){
  const at=now();
  await db.batch([db.prepare("UPDATE store_products SET name=?,description=?,version=version+1,updated_utc=? WHERE sku='APP-HOODIE' AND demo=1 AND name LIKE '%One island%'").bind('"I ❤ Sandy Sports" hoodie','Heavyweight hoodie for winter sunset sessions. Say it loud.',at),
   db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('demo_v3',?)").bind(at)]);
 }
 if(!await db.prepare("SELECT 1 AS x FROM store_settings WHERE key='seeded'").first()){
  const at=now(),stmts=DEMO_PRODUCTS.map((p,i)=>db.prepare("INSERT OR IGNORE INTO store_products(id,sku,name,category,kind,description,price_cents,member_price_cents,cost_cents,variants_json,event_date,event_time,venue,status,sort,demo,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,1,?,?)")
   .bind(id(),p.sku,p.name,p.category,p.kind,p.description,cents(p.price),p.member==null?null:cents(p.member),p.cost==null?null:cents(p.cost),JSON.stringify(p.variants.map(x=>({label:x.label,stock:x.stock??null,...(x.price!=null?{price:cents(x.price)}:{})}))),p.eventDate||null,p.eventTime||'',p.venue||'',(i+1)*10,at,at));
  await db.batch([...stmts,db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('seeded',?)").bind(at)]);
 }
 ready.add(env);
}
const variantsOf=r=>{try{return JSON.parse(r.variants_json||'[]')}catch{return []}};
const unitPrice=(p,variant,member)=>variant?.price!=null?variant.price:(member&&p.member_price_cents!=null?p.member_price_cents:p.price_cents);
const availability=s=>s==null?'in':s<=0?'out':s<=LOW_STOCK?'low':'in';
function publicShape(r){
 return {id:r.id,sku:r.sku,name:r.name,category:r.category,kind:r.kind,description:r.description,price:r.price_cents,memberPrice:r.member_price_cents,
  eventDate:r.event_date,eventTime:r.event_time,venue:r.venue,demo:!!r.demo,photoUrl:r.photo?'/api/store/photo/'+r.id+'?v='+r.version:null,
  variants:variantsOf(r).map(x=>({label:x.label,price:x.price??null,availability:availability(x.stock),...(r.kind==='ticket'&&x.stock!=null&&x.stock<=20?{left:Math.max(0,x.stock)}:{})}))};
}
function adminShape(r){
 return {...publicShape(r),status:r.status,cost:r.cost_cents,sort:r.sort,version:r.version,updatedAt:r.updated_utc,variants:variantsOf(r).map(x=>({label:x.label,stock:x.stock??null,price:x.price??null}))};
}
async function buyer(db,identity){
 if(!identity)return null;
 const p=await db.prepare('SELECT full_name,preferred_name,email,status FROM club_people WHERE account_id=? LIMIT 1').bind(identity.id).first();
 let dob='';try{dob=(await db.prepare('SELECT dob FROM club_member_profiles WHERE account_id=?').bind(identity.id).first())?.dob||''}catch{}
 const member=identity.role==='member'&&p?.status==='active';
 const month=new Date(Date.now()+10*3600000).toISOString().slice(5,7);
 return {member,name:p?.preferred_name||p?.full_name||identity.name,email:p?.email||'',birthday:member&&dob.slice(5,7)===month};
}
// ---------- CSV ----------
export function parseCsv(text){
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c;continue}
  if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c;
 }
 if(cell!==''||row.length){row.push(cell);rows.push(row)}
 return rows.filter(r=>r.some(x=>x.trim()!==''));
}
const csvCell=v=>{let s=v==null?'':String(v);if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const csv=rows=>rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
export const PRODUCT_COLUMNS=['sku','name','category','kind','status','price','member_price','cost','variants','event_date','event_time','venue','description','sort'];
const dollars=c=>c==null?'':(c/100).toFixed(2);
const variantsText=list=>list.map(x=>x.label+(x.price!=null?'@'+dollars(x.price):'')+':'+(x.stock==null?'':x.stock)).join('|');
// Sizes or options: "S:5|M:10", "Adult@15:80|Child@5:60" (own price), "One size:" (blank stock = unlimited).
function parseVariants(text){
 const out=[];
 for(const part of String(text||'').split('|').map(s=>s.trim()).filter(Boolean)){
  const m=part.match(/^(.+?)(?:@(\d+(?:\.\d{1,2})?))?:(\d*)$/);if(!m)throw Error('Sizes must look like S:5|M:10 or Adult@15:80');
  out.push({label:m[1].trim().slice(0,40),stock:m[3]===''?null:Number(m[3]),...(m[2]!=null?{price:cents(m[2])}:{})});
 }
 if(!out.length)throw Error('Add at least one size or option, for example One size:10');
 if(out.length>30)throw Error('Use 30 options or fewer');
 return out;
}
function cleanProduct(src){
 const money=(v,label,optional)=>{const s=String(v??'').trim().replace(/^\$/,'');if(!s){if(optional)return null;fail(400,label+' is needed.','invalid_product')}if(!/^\d+(\.\d{1,2})?$/.test(s))fail(400,label+' must be an amount like 29.95.','invalid_product');return cents(s)};
 const sku=field(src.sku,40).toUpperCase(),name=field(src.name,120),kind=field(src.kind,20)||'merch',status=field(src.status,20)||'draft';
 if(!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(sku))fail(400,'SKU must be letters, numbers and dashes, for example APP-TEE-01.','invalid_product');
 if(name.length<2)fail(400,'Give the product a name.','invalid_product');
 if(!KINDS.includes(kind))fail(400,'Type must be merch, ticket or donation.','invalid_product');
 if(!STATUSES.includes(status))fail(400,'Status must be draft, active or archived.','invalid_product');
 let variants;
 try{variants=Array.isArray(src.variants)?src.variants.map(x=>({label:field(x.label,40),stock:x.stock===''||x.stock==null?null:Math.max(0,Math.floor(Number(x.stock))),...(x.price!==''&&x.price!=null?{price:Math.round(Number(x.price))}:{})})):parseVariants(src.variants)}
 catch(e){fail(400,e.message,'invalid_product')}
 if(!variants.length||variants.length>30||variants.some(x=>!x.label||Number.isNaN(x.stock)||(x.price!=null&&!(x.price>=0))))fail(400,'Check the sizes or options.','invalid_product');
 const eventDate=field(src.event_date??src.eventDate,10);if(eventDate&&!/^20\d\d-\d\d-\d\d$/.test(eventDate))fail(400,'Event date must be YYYY-MM-DD.','invalid_product');
 if(kind==='ticket'&&!eventDate)fail(400,'Tickets need an event date.','invalid_product');
 const sort=String(src.sort??'').trim();
 return {sku,name,kind,status,category:field(src.category,40)||(kind==='ticket'?'Event tickets':kind==='donation'?'Donations':'Merch'),
  description:field(src.description,600),price:money(src.price,'Price'),member:money(src.member_price??src.memberPrice,'Member price',true),cost:money(src.cost,'Cost',true),
  variants,eventDate:eventDate||null,eventTime:field(src.event_time??src.eventTime,40),venue:field(src.venue,120),sort:sort&&Number.isFinite(Number(sort))?Math.floor(Number(sort)):100};
}
async function upsert(db,p,at,existingId=null){
 const existing=existingId?{id:existingId}:await db.prepare('SELECT id FROM store_products WHERE sku=?').bind(p.sku).first();
 const vals=[p.name,p.category,p.kind,p.description,p.price,p.member,p.cost,JSON.stringify(p.variants),p.eventDate,p.eventTime,p.venue,p.status,p.sort];
 if(existing){
  await db.prepare('UPDATE store_products SET sku=?,name=?,category=?,kind=?,description=?,price_cents=?,member_price_cents=?,cost_cents=?,variants_json=?,event_date=?,event_time=?,venue=?,status=?,sort=?,version=version+1,updated_utc=? WHERE id=?').bind(p.sku,...vals,at,existing.id).run();
  return {id:existing.id,created:false};
 }
 const pid=id();
 await db.prepare('INSERT INTO store_products(id,sku,name,category,kind,description,price_cents,member_price_cents,cost_cents,variants_json,event_date,event_time,venue,status,sort,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid,p.sku,...vals,at,at).run();
 return {id:pid,created:true};
}
const orderShape=o=>({id:o.id,number:o.number,name:o.name,email:o.email,phone:o.phone||'',collection:o.collection||'',code:o.discount_code||'',status:o.status,lines:JSON.parse(o.lines_json||'[]'),subtotal:o.subtotal_cents,discount:o.discount_cents,
 discountLabel:o.discount_label,donation:o.donation_cents,total:o.total_cents,note:o.note,createdAt:o.created_utc,updatedAt:o.updated_utc,...(o.username!==undefined?{username:o.username}:{})});
// Stock comes off when an order is confirmed, and goes back if a confirmed order is cancelled.
async function moveStock(db,lines,direction){
 const byProduct=new Map();
 for(const l of lines)if(l.kind!=='donation'){const list=byProduct.get(l.productId)||[];list.push(l);byProduct.set(l.productId,list)}
 const writes=[];
 for(const [pid,ls] of byProduct){
  const p=await db.prepare('SELECT * FROM store_products WHERE id=?').bind(pid).first();if(!p)continue;
  const variants=variantsOf(p);let changed=false;
  for(const l of ls){
   const v=variants.find(x=>x.label===l.variant);if(!v||v.stock==null)continue;
   if(direction<0&&v.stock<l.qty)fail(409,'Not enough stock for '+l.name+' ('+l.variant+'): '+v.stock+' left.','insufficient_stock');
   v.stock+=direction*l.qty;changed=true;
  }
  if(changed)writes.push(db.prepare('UPDATE store_products SET variants_json=?,version=version+1,updated_utc=? WHERE id=? AND version=?').bind(JSON.stringify(variants),now(),pid,p.version));
 }
 if(!writes.length)return;
 const results=await db.batch(writes);
 if(results.some(r=>!r.meta.changes))fail(409,'Stock changed at the same time. Try again.','stock_conflict');
}
const today=()=>new Date(Date.now()+10*3600000).toISOString().slice(0,10);
const codeShape=c=>({code:c.code,kind:c.kind,value:c.value,applies:c.applies,minSpend:c.min_spend_cents,maxUses:c.max_uses,uses:c.uses,oncePerMember:!!c.once_per_member,membersOnly:!!c.members_only,starts:c.starts||'',ends:c.ends||'',active:!!c.active,note:c.note});
const describe=c=>(c.kind==='percent'?c.value+'% off':'$'+(c.value/100).toFixed(c.value%100?2:0)+' off')+(c.applies==='all'?'':c.applies==='merch'?' merch':c.applies==='tickets'?' tickets':' '+c.applies.slice(9));
// Prices a cart for a signed-in buyer: member prices, then the better of the birthday discount or a valid code.
async function price(db,identity,me,items,rawCode){
 const lines=[];let subtotal=0,donation=0;
 for(const it of (Array.isArray(items)?items.slice(0,40):[])){
  const p=await db.prepare("SELECT * FROM store_products WHERE id=? AND status='active'").bind(field(it.productId,40)).first();
  if(!p)fail(409,'An item in your cart is no longer available. Remove it and try again.','product_unavailable');
  const variant=variantsOf(p).find(x=>x.label===field(it.variant,40));if(!variant)fail(400,'Choose a size or option for '+p.name+'.','invalid_variant');
  if(p.kind==='donation'){
   const amount=Math.round(Number(it.amount)*100);if(!(amount>=100&&amount<=1000000))fail(400,'Donations can be $1 to $10,000.','invalid_donation');
   donation+=amount;lines.push({productId:p.id,sku:p.sku,name:p.name,kind:p.kind,category:p.category,variant:variant.label,qty:1,unit:amount,line:amount});continue;
  }
  const qty=Math.floor(Number(it.qty));if(!(qty>=1&&qty<=20))fail(400,'Quantities can be 1 to 20.','invalid_qty');
  if(variant.stock!=null&&variant.stock<qty)fail(409,'Only '+Math.max(0,variant.stock)+' left of '+p.name+' ('+variant.label+').','insufficient_stock');
  const unit=unitPrice(p,variant,me?.member),line=unit*qty;subtotal+=line;
  lines.push({productId:p.id,sku:p.sku,name:p.name,kind:p.kind,category:p.category,variant:variant.label,qty,unit,line,...(p.kind==='ticket'?{eventDate:p.event_date}:{})});
 }
 if(!lines.length)fail(400,'Your cart is empty.','empty_cart');
 const birthday=me?.birthday?Math.round(subtotal*BIRTHDAY_PERCENT/100):0;
 let codeDiscount=0,codeMessage='',applied=null;
 const code=field(rawCode,30).toUpperCase();
 if(code){
  const c=await db.prepare('SELECT * FROM store_discounts WHERE code=?').bind(code).first(),d=today();
  const eligible=c?lines.filter(l=>l.kind!=='donation'&&(c.applies==='all'||(c.applies==='merch'&&l.kind==='merch')||(c.applies==='tickets'&&l.kind==='ticket')||(c.applies.startsWith('category:')&&l.category===c.applies.slice(9)))).reduce((a,l)=>a+l.line,0):0;
  if(!c||!c.active)codeMessage='That code is not valid.';
  else if((c.starts&&d<c.starts)||(c.ends&&d>c.ends))codeMessage='That code is not running right now.';
  else if(c.members_only&&!me?.member)codeMessage='That code is for members.';
  else if(c.max_uses!=null&&c.uses>=c.max_uses)codeMessage='That code has been used up.';
  else if(c.once_per_member&&identity&&await db.prepare("SELECT 1 AS x FROM store_orders WHERE account_id=? AND discount_code=? AND status<>'cancelled'").bind(identity.id,c.code).first())codeMessage='You have already used that code.';
  else if(!eligible)codeMessage='That code does not apply to anything in your cart ('+describe(c)+').';
  else if(eligible<c.min_spend_cents)codeMessage='Spend $'+(c.min_spend_cents/100).toFixed(0)+' or more on eligible items to use that code.';
  else{codeDiscount=c.kind==='percent'?Math.round(eligible*c.value/100):Math.min(c.value,eligible);applied=c}
 }
 let discount=0,label='',usedCode='';
 if(applied&&codeDiscount>=birthday){discount=codeDiscount;label=applied.code+': '+describe(applied);usedCode=applied.code;codeMessage='Code applied: '+describe(applied)+'.'}
 else if(birthday){discount=birthday;label='Birthday month '+BIRTHDAY_PERCENT+'% off';if(applied)codeMessage='Your birthday discount is bigger, so it applies instead.'}
 return {lines,subtotal,donation,discount,label,code:usedCode,codeMessage,total:subtotal-discount+donation};
}
async function createOrder(req,db,identity){
 const b=await payload(req,20000),me=await buyer(db,identity);
 const open=await db.prepare("SELECT COUNT(*) AS n FROM store_orders WHERE account_id=? AND status='requested'").bind(identity.id).first();
 if(Number(open?.n||0)>=10)fail(429,'You have 10 order requests waiting. Please wait for the Treasurer to catch up.','too_many_orders');
 const collection=field(b.collection,40);if(!COLLECTION_POINTS.includes(collection))fail(400,'Choose where you will collect your order.','invalid_collection');
 const phone=field(b.phone,25);if(phone&&!/^[+0-9 ()-]{7,25}$/.test(phone))fail(400,'Check the phone number or leave it blank.','invalid_phone');
 if(b.acknowledge!==true)fail(400,'Tick to confirm you understand no payment is taken yet.','acknowledge_required');
 const q=await price(db,identity,me,b.items,b.code);
 if(field(b.code,30)&&!q.code&&!q.codeMessage.startsWith('Your birthday discount'))fail(400,q.codeMessage||'That code is not valid.','invalid_code');
 if(q.code){const r=await db.prepare('UPDATE store_discounts SET uses=uses+1,updated_utc=? WHERE code=? AND (max_uses IS NULL OR uses<max_uses)').bind(now(),q.code).run();if(!r.meta.changes)fail(409,'That code has just been used up.','code_used_up')}
 const at=now(),oid=id();
 for(let attempt=0;attempt<3;attempt++){
  try{
   await db.prepare("INSERT INTO store_orders(id,number,account_id,name,email,phone,collection,discount_code,status,lines_json,subtotal_cents,discount_cents,discount_label,donation_cents,total_cents,note,created_utc,updated_utc) SELECT ?,COALESCE(MAX(number),1000)+1,?,?,?,?,?,?,'requested',?,?,?,?,?,?,?,?,? FROM store_orders")
    .bind(oid,identity.id,me?.name||identity.name,me?.email||'',phone,collection,q.code,JSON.stringify(q.lines),q.subtotal,q.discount,q.label,q.donation,q.total,field(b.note,500),at,at).run();
   break;
  }catch(e){if(!String(e?.message).includes('UNIQUE')||attempt===2)throw e}
 }
 await audit(db,identity,'store_order_requested','store_order',oid,at).run();
 return json({ok:true,order:orderShape(await db.prepare('SELECT * FROM store_orders WHERE id=?').bind(oid).first()),notice:STORE_NOTICE},201);
}
async function report(db){
 const {results:orders=[]}=await db.prepare('SELECT * FROM store_orders').all(),{results:products=[]}=await db.prepare('SELECT * FROM store_products').all();
 const live=orders.filter(o=>o.status!=='cancelled'),byStatus=Object.fromEntries(ORDER_STATUSES.map(s=>[s,orders.filter(o=>o.status===s).length]));
 const units=new Map(),tickets=new Map(),funds=new Map();let cost=0;
 for(const o of live)for(const l of JSON.parse(o.lines_json)){
  if(l.kind==='donation'){funds.set(l.variant,(funds.get(l.variant)||0)+l.line);continue}
  const u=units.get(l.sku)||{sku:l.sku,name:l.name,units:0,value:0};u.units+=l.qty;u.value+=l.line;units.set(l.sku,u);
  const p=products.find(x=>x.id===l.productId);if(l.kind==='merch'&&p?.cost_cents)cost+=p.cost_cents*l.qty;
  if(l.kind==='ticket'){const k=l.name+'|'+(l.eventDate||'');const t=tickets.get(k)||{event:l.name,date:l.eventDate||'',byType:{},total:0};t.byType[l.variant]=(t.byType[l.variant]||0)+l.qty;t.total+=l.qty;tickets.set(k,t)}
 }
 const low=[],stock={units:0,retail:0,cost:0};
 for(const p of products.filter(p=>p.status==='active'&&p.kind==='merch'))for(const v of variantsOf(p)){
  if(v.stock==null)continue;
  stock.units+=v.stock;stock.retail+=v.stock*(v.price??p.price_cents);stock.cost+=v.stock*(p.cost_cents||0);
  if(v.stock<=LOW_STOCK)low.push({sku:p.sku,name:p.name,variant:v.label,stock:v.stock});
 }
 const sales=live.reduce((s,o)=>s+o.subtotal_cents-o.discount_cents,0),codes=new Map();
 for(const o of live)if(o.discount_code){const c=codes.get(o.discount_code)||{code:o.discount_code,orders:0,discount:0};c.orders++;c.discount+=o.discount_cents;codes.set(o.discount_code,c)}
 return {notice:STORE_NOTICE,orders:{total:orders.length,byStatus},sales:{value:sales,discounts:live.reduce((s,o)=>s+o.discount_cents,0),cost,margin:sales-cost},
  donations:{total:live.reduce((s,o)=>s+o.donation_cents,0),byFund:[...funds].map(([fund,value])=>({fund,value}))},
  codes:[...codes.values()],top:[...units.values()].sort((a,b)=>b.units-a.units).slice(0,10),tickets:[...tickets.values()],lowStock:low,stock,
  products:{active:products.filter(p=>p.status==='active').length,draft:products.filter(p=>p.status==='draft').length,archived:products.filter(p=>p.status==='archived').length}};
}
export async function storeEndpoint(req,env,path,identity){
 const db=dbFor(env);await ensure(env,db);
 const photo=path.match(/^\/api\/store\/photo\/([a-f0-9-]{36})$/);
 if(photo&&req.method==='GET'){
  const r=await db.prepare("SELECT photo FROM store_products WHERE id=? AND photo IS NOT NULL AND (status='active' OR ?=1)").bind(photo[1],identity&&STAFF.includes(identity.role)?1:0).first();
  if(!r)fail(404,'Photo unavailable.','not_found');
  return photoResponse(r.photo);
 }
 if(path==='/api/store'&&req.method==='GET'){
  const {results=[]}=await db.prepare("SELECT * FROM store_products WHERE status='active' AND (kind<>'ticket' OR event_date IS NULL OR event_date>=date('now','+10 hours')) ORDER BY sort,name").all();
  const me=await buyer(db,identity);
  return json({notice:STORE_NOTICE,bankAccount:false,paymentsEnabled:false,birthdayPercent:BIRTHDAY_PERCENT,collectionPoints:COLLECTION_POINTS,products:results.map(publicShape),
   me:me?{signedIn:true,member:me.member,birthdayMonth:me.birthday}:{signedIn:false}});
 }
 if(path==='/api/store/quote'&&req.method==='POST'){
  requireRole(identity,['member',...STAFF]);const b=await payload(req,20000);
  const q=await price(db,identity,await buyer(db,identity),b.items,b.code);
  return json({...q,collectionPoints:COLLECTION_POINTS,notice:STORE_NOTICE});
 }
 if(path==='/api/store/orders'){
  requireRole(identity,['member',...STAFF]);
  if(req.method==='GET'){const {results=[]}=await db.prepare('SELECT * FROM store_orders WHERE account_id=? ORDER BY number DESC LIMIT 50').bind(identity.id).all();return json({orders:results.map(orderShape)})}
  if(req.method!=='POST')fail(405,'Use the store.','method_not_allowed');
  return createOrder(req,db,identity);
 }
 // ---------- Treasurer back end ----------
 if(!path.startsWith('/api/committee/store/'))fail(404,'That store service does not exist.','not_found');
 const sub=path.slice('/api/committee/store/'.length),manager=()=>requireRole(identity,STORE_MANAGERS);
 requireRole(identity,MEMBER_ADMIN);
 if(sub==='products'&&req.method==='GET'){
  const {results=[]}=await db.prepare("SELECT * FROM store_products ORDER BY status='archived',sort,name").all();
  return json({products:results.map(adminShape),canManage:STORE_MANAGERS.includes(identity.role),notice:STORE_NOTICE});
 }
 if(sub==='products'&&req.method==='POST'){
  manager();const b=await payload(req,250000),at=now(),pid=field(b.id,40);
  if(b.action==='photo'){
   const p=b.photo?cleanPhoto(b.photo,fail):null;
   const r=await db.prepare('UPDATE store_products SET photo=?,version=version+1,updated_utc=? WHERE id=?').bind(p,at,pid).run();if(!r.meta.changes)fail(404,'Product not found.','not_found');
   return json({ok:true});
  }
  if(b.action==='status'){
   const status=field(b.status,20);if(!STATUSES.includes(status))fail(400,'Choose draft, active or archived.','invalid_status');
   const r=await db.prepare('UPDATE store_products SET status=?,version=version+1,updated_utc=? WHERE id=?').bind(status,at,pid).run();if(!r.meta.changes)fail(404,'Product not found.','not_found');
   await audit(db,identity,'store_product_'+status,'store_product',pid,at).run();return json({ok:true});
  }
  const p=cleanProduct(b.product||{});
  const clash=await db.prepare('SELECT id FROM store_products WHERE sku=?').bind(p.sku).first();
  if(pid){
   const cur=await db.prepare('SELECT version FROM store_products WHERE id=?').bind(pid).first();if(!cur)fail(404,'Product not found.','not_found');
   if(Number(b.version)!==cur.version)fail(409,'This product changed. Reload before saving.','conflict');
   if(clash&&clash.id!==pid)fail(409,'That SKU is already used.','sku_taken');
  }else if(clash)fail(409,'That SKU is already used. Edit the existing product instead.','sku_taken');
  const r=await upsert(db,p,at,pid||null);
  await audit(db,identity,r.created?'store_product_created':'store_product_updated','store_product',r.id,at).run();
  return json({ok:true,id:r.id,created:r.created},r.created?201:200);
 }
 if(sub==='import'&&req.method==='POST'){
  manager();const b=await payload(req,600000),rows=parseCsv(String(b.csv||''));
  if(rows.length<2)fail(400,'Paste or upload a CSV with a header row and at least one product.','empty_import');
  const head=rows[0].map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
  for(const need of ['sku','name','price','variants'])if(!head.includes(need))fail(400,'The CSV needs a "'+need+'" column. Download the product export to see the format.','missing_column');
  if(rows.length>501)fail(400,'Import up to 500 products at a time.','too_many_rows');
  const plan=[],errors=[],seen=new Set();
  for(let i=1;i<rows.length;i++){
   const src=Object.fromEntries(head.map((h,j)=>[h,rows[i][j]??'']));
   try{
    const p=cleanProduct(src);if(seen.has(p.sku))throw Error('SKU appears twice in this file.');seen.add(p.sku);
    const exists=!!await db.prepare('SELECT 1 AS x FROM store_products WHERE sku=?').bind(p.sku).first();
    plan.push({row:i+1,sku:p.sku,name:p.name,action:exists?'update':'create',p});
   }catch(e){errors.push({row:i+1,sku:src.sku||'',message:e.message})}
  }
  const summary={creates:plan.filter(x=>x.action==='create').length,updates:plan.filter(x=>x.action==='update').length,errors};
  if(b.apply!==true)return json({preview:true,...summary,rows:plan.map(({p,...x})=>x)});
  if(errors.length)fail(400,'Fix the '+errors.length+' row error(s) before importing.','import_errors');
  const at=now();for(const x of plan)await upsert(db,x.p,at);
  await audit(db,identity,'store_import','store_import',id(),at).run();
  return json({applied:true,...summary});
 }
 if(sub==='export'&&req.method==='GET'){
  const type=new URL(req.url).searchParams.get('type')||'products';
  const headers={'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="sandy-store-'+type+'-'+now().slice(0,10)+'.csv"','Cache-Control':'no-store, private'};
  if(type==='products'){
   const {results=[]}=await db.prepare('SELECT * FROM store_products ORDER BY sort,name').all();
   return new Response(csv([PRODUCT_COLUMNS,...results.map(r=>[r.sku,r.name,r.category,r.kind,r.status,dollars(r.price_cents),dollars(r.member_price_cents),dollars(r.cost_cents),variantsText(variantsOf(r)),r.event_date||'',r.event_time,r.venue,r.description,r.sort])]),{headers});
  }
  if(type==='orders'){
   const {results=[]}=await db.prepare('SELECT o.*,a.username FROM store_orders o LEFT JOIN club_accounts a ON a.id=o.account_id ORDER BY number').all();
   return new Response(csv([['order','date','name','username','email','phone','collection','status','items','subtotal','discount_code','discount','donation','total'],...results.map(o=>[o.number,o.created_utc.slice(0,10),o.name,o.username||'',o.email,o.phone||'',o.collection||'',o.status,
    JSON.parse(o.lines_json).map(l=>l.qty+' x '+l.name+' ('+l.variant+')').join('; '),dollars(o.subtotal_cents),o.discount_code||'',dollars(o.discount_cents),dollars(o.donation_cents),dollars(o.total_cents)])]),{headers});
  }
  fail(400,'Export products or orders.','invalid_export');
 }
 if(sub==='orders'&&req.method==='GET'){
  const status=new URL(req.url).searchParams.get('status')||'';
  if(status&&status!=='open'&&!ORDER_STATUSES.includes(status))fail(400,'Choose a status.','invalid_filter');
  const where=status==='open'?"WHERE o.status IN ('requested','confirmed','ready')":status?'WHERE o.status=?':'';
  const {results=[]}=await db.prepare('SELECT o.*,a.username FROM store_orders o LEFT JOIN club_accounts a ON a.id=o.account_id '+where+' ORDER BY o.number DESC LIMIT 300').bind(...(status&&status!=='open'?[status]:[])).all();
  const counts=await db.prepare("SELECT SUM(status='requested') AS requested,SUM(status IN ('requested','confirmed','ready')) AS open FROM store_orders").first();
  return json({orders:results.map(orderShape),counts:{requested:Number(counts?.requested||0),open:Number(counts?.open||0)},canManage:STORE_MANAGERS.includes(identity.role)});
 }
 if(sub==='orders'&&req.method==='POST'){
  manager();const b=await payload(req,2000),status=field(b.status,20),at=now();
  if(!ORDER_STATUSES.includes(status))fail(400,'Choose a status.','invalid_status');
  const o=await db.prepare('SELECT * FROM store_orders WHERE id=?').bind(field(b.id,40)).first();if(!o)fail(404,'Order not found.','not_found');
  if(o.status==='cancelled'||o.status==='collected')fail(409,'This order is closed.','order_closed');
  const lines=JSON.parse(o.lines_json);let applied=o.stock_applied;
  if(['confirmed','ready','collected'].includes(status)&&!applied){await moveStock(db,lines,-1);applied=1}
  if(status==='cancelled'&&applied){await moveStock(db,lines,1);applied=0}
  if(status==='cancelled'&&o.discount_code)await db.prepare('UPDATE store_discounts SET uses=MAX(0,uses-1) WHERE code=?').bind(o.discount_code).run();
  const r=await db.prepare('UPDATE store_orders SET status=?,stock_applied=?,updated_utc=? WHERE id=? AND status=?').bind(status,applied,at,o.id,o.status).run();
  if(!r.meta.changes)fail(409,'This order changed. Reload.','conflict');
  await audit(db,identity,'store_order_'+status,'store_order',o.id,at).run();
  return json({ok:true});
 }
 if(sub==='discounts'&&req.method==='GET'){
  const {results=[]}=await db.prepare('SELECT * FROM store_discounts ORDER BY active DESC,code').all();
  return json({codes:results.map(codeShape),canManage:STORE_MANAGERS.includes(identity.role)});
 }
 if(sub==='discounts'&&req.method==='POST'){
  manager();const b=await payload(req,4000),at=now(),code=field(b.code,30).toUpperCase(),kind=field(b.kind,10),applies=field(b.applies,60)||'all';
  if(!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(code))fail(400,'Codes are 3 to 30 letters, numbers or dashes.','invalid_code');
  if(!['percent','amount'].includes(kind))fail(400,'Choose percent or dollar amount.','invalid_code');
  const value=kind==='percent'?Math.floor(Number(b.value)):Math.round(Number(b.value)*100);
  if(!(value>0)||(kind==='percent'&&value>100))fail(400,kind==='percent'?'Percent must be 1 to 100.':'Enter a dollar amount.','invalid_code');
  if(!APPLIES.includes(applies)&&!/^category:.{1,40}$/.test(applies))fail(400,'Choose what the code applies to.','invalid_code');
  const date=v=>{const s=field(v,10);if(s&&!/^20\d\d-\d\d-\d\d$/.test(s))fail(400,'Dates must be YYYY-MM-DD.','invalid_code');return s||null};
  const minSpend=Math.max(0,Math.round(Number(b.minSpend||0)*100)),maxUses=b.maxUses===''||b.maxUses==null?null:Math.max(1,Math.floor(Number(b.maxUses)));
  const vals=[kind,value,applies,minSpend,maxUses,b.oncePerMember===true?1:0,b.membersOnly===true?1:0,date(b.starts),date(b.ends),b.active===false?0:1,field(b.note,200)];
  await db.prepare('INSERT INTO store_discounts(code,kind,value,applies,min_spend_cents,max_uses,once_per_member,members_only,starts,ends,active,note,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,applies=excluded.applies,min_spend_cents=excluded.min_spend_cents,max_uses=excluded.max_uses,once_per_member=excluded.once_per_member,members_only=excluded.members_only,starts=excluded.starts,ends=excluded.ends,active=excluded.active,note=excluded.note,updated_utc=excluded.updated_utc')
   .bind(code,...vals,at,at).run();
  await audit(db,identity,'store_code_saved','store_discount',code,at).run();
  return json({ok:true,code});
 }
 if(sub==='report'&&req.method==='GET')return json(await report(db));
 fail(404,'That store service does not exist.','not_found');
}
