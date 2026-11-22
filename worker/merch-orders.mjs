import {manageListings} from './shop-listings.mjs';
const productId=/^[a-z0-9-]{1,80}$/;
const sellableVariant="EXISTS(SELECT 1 FROM shop_variants v JOIN merch_stock_items i ON i.id=v.stock_item_id WHERE v.product_id=p.id AND v.active=1 AND (i.on_hand IS NULL OR i.on_hand>COALESCE((SELECT SUM(quantity) FROM merch_shop_requests WHERE stock_item_id=i.id AND status='confirmed'),0)))";
const productQuery="SELECT p.id AS productId,p.name,l.kind,l.mode,l.variable_amount AS variableAmount,l.published,EXISTS(SELECT 1 FROM shop_variants v WHERE v.product_id=p.id) AS hasVariants,"+sellableVariant+" AS sellableVariant,o.price_cents AS priceCents,COALESCE(o.sizes_json,'[]') AS sizesJson,o.checkout_url AS checkoutUrl,COALESCE(o.version,0) AS version,o.last_key AS lastKey FROM merch_products p JOIN shop_listings l ON l.product_id=p.id LEFT JOIN merch_shop_offers o ON o.product_id=p.id WHERE 1";
const requestQuery="SELECT r.reference,r.kind,r.product_id AS productId,p.name AS productName,l.kind AS offeringKind,l.mode AS offeringMode,l.event_date AS eventDate,r.requested_variant_id AS variantId,i.label AS variantLabel,r.requested_amount_cents AS requestedAmountCents,r.name,r.email,r.mobile,r.quantity,r.size,r.message,r.status,r.staff_note AS staffNote,r.quote_cents AS quoteCents,r.pickup_details AS pickupDetails,r.pickup_at AS pickupAt,r.listed_unit_cents AS listedUnitCents,r.stock_item_id AS itemId,r.payment_method AS paymentMethod,r.amount_cents AS amountCents,r.version,r.created_at AS createdAt,r.updated_at AS updatedAt FROM merch_shop_requests r JOIN merch_products p ON p.id=r.product_id LEFT JOIN shop_listings l ON l.product_id=p.id LEFT JOIN merch_stock_items i ON i.id=r.requested_variant_id";
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const within=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const now=()=>new Date().toISOString();
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const has=(o,key)=>Object.hasOwn(o,key);

function keys(body,allowed,fail) {
  if(Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Use the fields shown on this form.');
}
function clean(value,max,label,fail,required=false) {
  if(value==null&&!required)return '';
  if(typeof value!=='string')fail(400,'Check '+label+'.');
  const s=value.trim();
  if(s.length>max||(required&&!s)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s))fail(400,'Check '+label+'.');
  return s;
}
function checkout(value,fail) {
  if(value===null||value==='')return null;
  const invalid=()=>fail(400,'Copy the direct HTTPS payment link from the club’s Square dashboard.');
  if(typeof value!=='string'||value.length>300||!/^[\x21-\x7e]+$/.test(value)||/[\\#%@]/.test(value))return invalid();
  // Rebuild from the approved host and checkout path, dropping only Square's optional source tag.
  const match=/^https:\/\/(square\.link|checkout\.square\.site)(\/[A-Za-z0-9_/-]+)(?:\?src=[A-Za-z0-9_-]{1,32})?$/.exec(value);
  if(!match)return invalid();
  const [,host,path]=match;
  const valid=host==='square.link'?/^\/u\/[A-Za-z0-9_-]{6,128}$/.test(path):
    /^\/(?:[A-Za-z0-9_-]{6,128}|buy\/[A-Za-z0-9_-]{6,128}|merchant\/[A-Za-z0-9_-]{6,64}\/checkout\/[A-Za-z0-9_-]{6,128})$/.test(path);
  return valid?'https://'+host+path:invalid();
}
function offer(row,staff) {
  const sizes=JSON.parse(row.sizesJson);
  const hasRequiredSize=row.productId!=='shirt'||sizes.length>0||row.hasVariants;
  let safeLink=null;
  if(row.checkoutUrl&&(row.priceCents>0||row.variableAmount)&&hasRequiredSize&&!['places','enquiry'].includes(row.mode)&&(staff||!row.hasVariants||row.sellableVariant)) {
    try {safeLink=checkout(row.checkoutUrl,()=>{throw Error();});}catch{/* Suppress invalid legacy or manually edited links. */}
  }
  const data={productId:row.productId,priceCents:row.priceCents,sizes,checkoutUrl:safeLink};
  return staff?{...data,name:row.name,version:row.version,offeringKind:row.kind,offeringMode:row.mode,variableAmount:!!row.variableAmount,published:!!row.published,hasVariants:!!row.hasVariants}:data;
}
export async function requireTreasurer(db,identity,fail) {
  if(!identity)fail(401,'Sign in with your treasurer account.');
  if(!['treasurer','administrator'].includes(identity.accountRole)||!identity.canManageStock)fail(403,'Treasurer access is required.');
  const record=await db.prepare("SELECT id FROM club_accounts WHERE id=? AND disabled=0 AND role IN ('treasurer','administrator')").bind(identity.id).first();
  if(!record)fail(403,'An active Treasurer or Webmaster account is required.');
}
function intake(body,fail) {
  keys(body,['requestId','kind','productId','name','email','mobile','quantity','size','message','consent','variantId','requestedAmountCents'],fail);
  if(typeof body.requestId!=='string'||!uuid.test(body.requestId)||!['enquiry','pickup'].includes(body.kind)||typeof body.productId!=='string'||!productId.test(body.productId))
    fail(400,'Choose a listed club item and reopen the request form.');
  if(body.consent!==true)fail(400,'Confirm the club may contact you about this request.');
  if(!within(body.quantity,1,99))fail(400,'Choose a quantity from 1 to 99.');
  const name=clean(body.name,100,'your name',fail,true),email=clean(body.email,150,'your email',fail).toLowerCase(),mobile=clean(body.mobile,25,'your phone number',fail);
  const size=clean(body.size,40,'the size',fail),message=clean(body.message,1000,'your message',fail,body.kind==='enquiry');
  if(name.length<2||/[\r\n]/.test(name)||(!email&&!mobile)||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||
    (mobile&&(!/^\+?[0-9 ()-]+$/.test(mobile)||mobile.replace(/\D/g,'').length<7)))fail(400,'Enter your name and a valid email address or phone number.');
  const variantId=body.variantId??null,requestedAmountCents=body.requestedAmountCents??null;
  if((variantId!==null && (typeof variantId!=='string'||!uuid.test(variantId)))||(requestedAmountCents!==null&&!within(requestedAmountCents,1,100000000)))fail(400,'Check the selected option or the contribution amount.');
  return {requestId:body.requestId.toLowerCase(),kind:body.kind,productId:body.productId,name,email,mobile,quantity:body.quantity,size,message,variantId,requestedAmountCents};
}
const savedIntake='SELECT reference,kind,product_id AS productId,name,email,mobile,quantity,size,message,requested_variant_id AS variantId,requested_amount_cents AS requestedAmountCents FROM merch_shop_requests WHERE request_id=?';
async function submit(request,db,body,fail,json) {
  const form=intake(body,fail);
  function receipt(row,created) {
    if(!Object.keys(form).filter(k=>k!=='requestId').every(k=>form[k]===row[k]))fail(409,'That reference already belongs to another request. Start a fresh form.');
    return json({reference:row.reference,kind:row.kind,status:'new'},created?201:200);
  }
  const previous=await db.prepare(savedIntake).bind(form.requestId).first();
  if(previous)return receipt(previous,false);
  const config=await db.prepare('SELECT throttle_salt AS salt FROM merch_shop_policy WHERE id=1').first();
  const clock=Math.floor(Date.now()/1000),window=Math.floor(clock/900);
  const address=request.headers.get('CF-Connecting-IP')||'local';
  const bucket=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode([config.salt,window,address].join('/'))));
  const ref='SANDY-'+hex(crypto.getRandomValues(new Uint8Array(6))).toUpperCase(),stamp=now();
  const [,,insert,,found,limit]=await db.batch([
    db.prepare('DELETE FROM merch_shop_throttle WHERE expires_at<?').bind(clock),
    db.prepare('INSERT OR IGNORE INTO merch_shop_throttle(bucket_key,count,expires_at) VALUES(?,0,?)').bind(bucket,(window+1)*900),
    db.prepare(`INSERT INTO merch_shop_requests(request_id,reference,kind,product_id,name,email,mobile,quantity,size,message,consent_version,listed_unit_cents,created_at,updated_at,requested_variant_id,requested_amount_cents)
      SELECT ?,?,?,?,?,?,?,?,?,?,'shop-contact-v1',o.price_cents,?,?,?,? FROM merch_products p JOIN shop_listings l ON l.product_id=p.id LEFT JOIN merch_shop_offers o ON o.product_id=p.id
      WHERE p.id=? AND l.published=1 AND (l.kind<>'merchandise' OR o.price_cents>0)
        AND (SELECT count FROM merch_shop_throttle WHERE bucket_key=?)<10
        AND (COALESCE(o.sizes_json,'[]')='[]' OR (?='enquiry' AND ?='') OR EXISTS(SELECT 1 FROM json_each(o.sizes_json) WHERE value=?))
        AND (?='enquiry' OR (l.mode IN ('stock','places') AND (l.event_date='' OR l.event_date>=date('now','+10 hours'))))
        AND (? IS NULL OR (?='enquiry' AND l.kind='donation' AND l.variable_amount=1 AND ?=1))
        AND ((? IS NULL AND (?='enquiry' OR NOT EXISTS(SELECT 1 FROM shop_variants WHERE product_id=p.id))) OR
          EXISTS(SELECT 1 FROM shop_variants v JOIN merch_stock_items i ON i.id=v.stock_item_id WHERE v.product_id=p.id AND v.active=1 AND i.id=?
            AND (?='enquiry' OR (l.mode='stock' AND i.on_hand IS NULL) OR i.on_hand-COALESCE((SELECT SUM(quantity) FROM merch_shop_requests WHERE stock_item_id=i.id AND status='confirmed'),0)>=?)))
      ON CONFLICT(request_id) DO NOTHING`).bind(form.requestId,ref,form.kind,form.productId,form.name,form.email,form.mobile,form.quantity,form.size,form.message,
        stamp,stamp,form.variantId,form.requestedAmountCents,form.productId,bucket,form.kind,form.size,form.size,form.kind,form.requestedAmountCents,form.kind,form.quantity,form.variantId,form.kind,form.variantId,form.kind,form.quantity),
    db.prepare('UPDATE merch_shop_throttle SET count=count+1 WHERE bucket_key=? AND changes()=1').bind(bucket),
    db.prepare(savedIntake).bind(form.requestId),
    db.prepare('SELECT count FROM merch_shop_throttle WHERE bucket_key=?').bind(bucket),
  ]);
  if(found.results.length)return receipt(found.results[0],Boolean(insert.meta.changes));
  if(limit.results[0]?.count>=10)fail(429,'Too many shop requests in a short time. Try again in 15 minutes.');
  fail(409,'This item or size changed. Refresh the shop and check your choice.');
}

async function inbox(db,url,fail,json) {
  const before=url.searchParams.get('before');
  if(before!==null&&(!/^[1-9]\d{0,15}$/.test(before)||!Number.isSafeInteger(Number(before))))fail(400,'Open the previous page from the request list.');
  const [offers,rows,items]=await db.batch([
    db.prepare(productQuery+' ORDER BY p.display_order,p.id'),
    db.prepare(requestQuery.replace('SELECT r.reference','SELECT r.seq,r.reference')+' WHERE (? IS NULL OR r.seq<?) ORDER BY r.seq DESC LIMIT 61').bind(before===null?null:Number(before),before===null?null:Number(before)),
    db.prepare("SELECT i.id,i.product_id AS productId,i.label,i.on_hand AS onHand,i.revision,l.kind AS offeringKind,l.mode AS offeringMode,v.stock_item_id AS variantId,COALESCE(h.units,0) AS reservedUnits,i.on_hand-COALESCE(h.units,0) AS availableUnits FROM merch_stock_items i LEFT JOIN shop_listings l ON l.product_id=i.product_id LEFT JOIN shop_variants v ON v.stock_item_id=i.id LEFT JOIN (SELECT stock_item_id,SUM(quantity) AS units FROM merch_shop_requests WHERE status='confirmed' GROUP BY stock_item_id) h ON h.stock_item_id=i.id ORDER BY i.product_id,i.label"),
  ]);
  const page=rows.results.slice(0,60);
  return json({offers:offers.results.map(r=>offer(r,true)),requests:page.map(({seq,...r})=>r),items:items.results,nextBefore:rows.results.length>60?page.at(-1).seq:null});
}

function checkedRow(id,body,current,fail) {
  if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Check the selected product.');
  keys(body,['productId','confirmed','version','priceCents','sizes','checkoutUrl','checkoutReconfirmed'],fail);
  if(!current||body.confirmed!==true||!within(body.version,0,2147483646)||!has(body,'checkoutUrl')||
     (body.priceCents!==null&&!within(body.priceCents,1,1000000))||!Array.isArray(body.sizes)||body.sizes.length>24)
    fail(400,'Check the current price, sizes and product link before confirming.');
  const sizes=body.sizes.map(s=>clean(s,40,'each size',fail,true));
  if((current.hasVariants||current.mode!=='stock')&&sizes.length)fail(400,'Manage stock combinations from the offering instead of entering a separate size list.');
  if(sizes.some(s=>/[\r\n]/.test(s))||new Set(sizes.map(s=>s.toLowerCase())).size!==sizes.length)fail(400,'Enter each size once.');
  const requested=checkout(body.checkoutUrl,fail), sizeJson=JSON.stringify(sizes);
  const key=JSON.stringify([body.version,body.priceCents,sizes,requested,body.checkoutReconfirmed===true]);
  if(current.version===body.version+1&&current.lastKey===key)
    return {id,version:body.version,price:current.priceCents,sizes:current.sizesJson,link:current.checkoutUrl,key};
  const changed=current.priceCents!==body.priceCents||current.sizesJson!==sizeJson;
  let link=requested;
  if(requested&&requested!==current.checkoutUrl&&body.checkoutReconfirmed!==true)
    fail(400,'Confirm that this link opens the club’s Square item with the current Australian price and options.');
  if(requested && requested===current.checkoutUrl && changed && body.checkoutReconfirmed!==true)link=null;
  if(link&&(['places','enquiry'].includes(current.mode)||(!body.priceCents&&!current.variableAmount)||(id==='shirt'&&!sizes.length&&!current.hasVariants)))fail(400,'Check the price and available options. Limited places and enquiry-only services use committee confirmation.');
  return {id,version:body.version,price:body.priceCents,sizes:sizeJson,link,key};
}
async function saveOffers(db,id,body,actor,fail,json) {
  if(!id){
    keys(body,['offers','confirmed'],fail);
    if(body.confirmed!==true||!Array.isArray(body.offers)||!within(body.offers.length,1,50))fail(400,'Confirm up to 50 selected product updates.');
  }
  const entries=id?[body]:body.offers, ids=entries.map(r=>id||r?.productId);
  if(ids.some(n=>typeof n!=='string'||!productId.test(n))||new Set(ids).size!==ids.length)fail(400,'Choose each listed product once.');
  const current=(await db.prepare(productQuery).all()).results;
  const rows=entries.map((input,i)=>checkedRow(ids[i],input,current.find(r=>r.productId===ids[i]),fail));
  const stamp=now(),mutation=crypto.randomUUID();
  const [,,found]=await db.batch([
    db.prepare(`WITH proposed AS (
      SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.version') AS version,json_extract(value,'$.price') AS price,
        json_extract(value,'$.sizes') AS sizes,json_extract(value,'$.link') AS link,json_extract(value,'$.key') AS key FROM json_each(?)
      ), eligible AS (
      SELECT q.* FROM proposed q WHERE NOT EXISTS(SELECT 1 FROM proposed checkrow LEFT JOIN merch_shop_offers old ON old.product_id=checkrow.id
        WHERE COALESCE(old.version,0)<>checkrow.version)
      )
      INSERT INTO merch_shop_offers(product_id,price_cents,sizes_json,checkout_url,version,updated_by,updated_at,last_key,mutation)
      SELECT id,price,sizes,link,version+1,?,?,key,? FROM eligible WHERE 1
      ON CONFLICT(product_id) DO UPDATE SET price_cents=excluded.price_cents,sizes_json=excluded.sizes_json,checkout_url=excluded.checkout_url,
      version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at,last_key=excluded.last_key,mutation=excluded.mutation`)
      .bind(JSON.stringify(rows),actor,stamp,mutation),
    db.prepare("INSERT INTO audit_log SELECT lower(hex(randomblob(16))),?,'treasurer','shop_offer_confirmed',product_id,? FROM merch_shop_offers WHERE mutation=?").bind(actor,stamp,mutation),
    db.prepare(productQuery+' ORDER BY p.display_order,p.id'),
  ]);
  const saved=found.results.filter(r=>ids.includes(r.productId));
  if(!rows.every(r=>saved.some(s=>s.productId===r.id&&s.version===r.version+1&&s.lastKey===r.key)))
    fail(409,'One or more offers changed. Refresh the products before publishing.');
  const output=saved.map(r=>offer(r,true));
  return json(id?{offer:output[0]}:{offers:output});
}

function validatePickupDate(value,fail,row) {
  const booking=row.offeringMode==='places',publishedDay=booking&&row.eventDate;
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))fail(400,booking?'Choose a Brisbane booking date and time.':'Choose a Brisbane pickup date and time.');
  const local=new Date(value+':00Z'),brisbaneNow=Date.now()+36000000;
  if(publishedDay && value.slice(0,10)!==publishedDay)fail(400,'Choose a time on the published date for this booking.');
  if(!Number.isFinite(+local)||local.toISOString().slice(0,16)!==value||+local<Math.floor(brisbaneNow/60000)*60000||(!publishedDay&&+local>brisbaneNow+366*86400000))
    fail(400,booking?'Choose a valid upcoming booking date and time.':'Choose a valid pickup date from today through the next year.');
}

async function updateRequest(db,ref,b,actor,fail,json) {
  keys(b,['version','action','staffNote','quoteCents','pickupDetails','pickupAt','itemId','stockRevision','amountCents','paymentMethod','received'],fail);
  if(!within(b.version,1,2147483646)||!['contacted','confirmed','closed','collected'].includes(b.action))fail(400,'Choose an action on the current request.');
  const gather=()=>db.prepare(requestQuery+' WHERE r.reference=?').bind(ref).first();
  const key=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(Object.keys(b).sort().map(k=>[k,b[k]])))));
  const row=await db.prepare(requestQuery.replace('SELECT r.reference','SELECT r.last_update_key AS updateKey,r.reference')+' WHERE r.reference=?').bind(ref).first();
  if(!row)fail(404,'Shop request unavailable.');
  if(row.version===b.version+1&&row.updateKey===key){delete row.updateKey;return json({request:row});}
  if(row.version!==b.version||['closed','collected'].includes(row.status))fail(409,'Refresh this request to check its latest status.');
  const collecting=b.action==='collected';
  if((collecting||b.action==='confirmed')&&row.kind!=='pickup')fail(400,'Only a pickup request can be confirmed or collected.');
  if((collecting&&row.status!=='confirmed')||(row.status==='confirmed'&&b.action==='contacted'))fail(409,'Use the current pickup stage before recording this change.');
  if(!collecting&&['amountCents','paymentMethod','received'].some(k=>has(b,k)))fail(400,'Payment is recorded upon collection.');
  const holding=b.action==='confirmed'||collecting;
  if(holding&&(!within(b.stockRevision,0,2147483646)||typeof b.itemId!=='string'||!/^[a-z0-9-]{1,80}$/.test(b.itemId)))
    fail(400,'Choose the exact stock item and check its current count.');
  if(!holding&&['itemId','stockRevision'].some(k=>has(b,k)))fail(400,'Choose a stock item when confirming pickup.');
  if(collecting&&['quoteCents','pickupAt','pickupDetails'].some(k=>has(b,k)))fail(400,'Confirm any revised quote or pickup details before recording payment.');
  const note=has(b,'staffNote')?clean(b.staffNote,1000,'the staff note',fail):row.staffNote;
  const quote=has(b,'quoteCents')?b.quoteCents:row.quoteCents;
  const details=has(b,'pickupDetails')?clean(b.pickupDetails,500,'the pickup details',fail):row.pickupDetails;
  const pickupAt=has(b,'pickupAt')?clean(b.pickupAt,16,'the pickup date and time',fail):row.pickupAt;
  if(quote!==null&&!within(quote,0,100000000))fail(400,'Enter a valid total quote in Australian cents.');
  if(b.action==='confirmed'&&(quote===null||!details||!pickupAt))fail(400,'Confirm the total price, pickup place and Brisbane date and time.');
  if((b.action==='confirmed'||pickupAt!==row.pickupAt)&&pickupAt)validatePickupDate(pickupAt,fail,row);
  if(collecting&&(b.received!==true||!within(b.amountCents,0,100000000)||b.amountCents!==row.quoteCents||b.itemId!==row.itemId||!['cash','square'].includes(b.paymentMethod)))
    fail(400,'Check the matching stock item and confirm the total actually received matches the agreed quote.');
  const stamp=now();
  try {
    await db.batch([
      db.prepare(`UPDATE merch_shop_requests SET status=?,staff_note=?,quote_cents=?,pickup_details=?,pickup_at=?,updated_by=?,updated_at=?,version=version+1,
        last_update_key=?,stock_item_id=?,stock_revision=?,amount_cents=?,payment_method=? WHERE reference=? AND version=?`)
        .bind(b.action,note,quote,details,pickupAt,actor,stamp,key,holding?b.itemId:null,holding?b.stockRevision:null,collecting?b.amountCents:null,collecting?b.paymentMethod:null,ref,b.version),
      db.prepare("INSERT INTO audit_log SELECT ?,?,'treasurer',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),actor,'shop_request_'+b.action,ref,stamp),
    ]);
  } catch(error) {
    if(/pickup_stock_conflict|merch_units_reserved/.test(String(error)))fail(409,'Check the matching item, available units and current shelf count before recording the pickup.');
    throw error;
  }
  const change=await db.prepare('SELECT last_update_key AS key FROM merch_shop_requests WHERE reference=?').bind(ref).first();
  const updated=await gather();
  if(updated.version!==b.version+1||change.key!==key)fail(409,'This request changed during review. Refresh before trying again.');
  return json({request:updated});
}

export async function merchOrdersEndpoint(request,env,identity,helpers) {
  const {json,HttpError,bodyJson,requireDb}=helpers,url=new URL(request.url),path=url.pathname,method=request.method;
  const fail=(status,message)=>{throw new HttpError(status,message,'shop_'+status);};
  if(path.startsWith('/api/stock/')&&!identity)fail(401,'Sign in with your treasurer account.');
  const initial=requireDb(env);
  const db=typeof initial.withSession==='function'?initial.withSession('first-primary'):initial;
  if(path==='/api/shop/offers') {
    if(method!=='GET')fail(405,'Browse the current merchandise offers.');
    const listing=await db.prepare(productQuery+' AND l.published=1 ORDER BY p.display_order,p.id').all();
    return json({offers:listing.results.map(row=>offer(row,false))});
  }
  if(path==='/api/shop/requests') {
    if(method!=='POST')fail(405,'Use a product form to submit a shop request.');
    return submit(request,db,await bodyJson(request,6000),fail,json);
  }
  await requireTreasurer(db,identity,fail);
  if(path==='/api/stock/shop/listings')return manageListings(request,db,identity,helpers,fail);
  if(path==='/api/stock/shop/offers'&&method==='GET'){
    const result=await db.prepare(productQuery+' ORDER BY p.display_order,p.id').all();
    return json({offers:result.results.map(row=>offer(row,true))});
  }
  if(path==='/api/stock/shop'&&method==='GET')return inbox(db,url,fail,json);
  if(path==='/api/stock/shop'&&method==='PUT')return saveOffers(db,null,await bodyJson(request,16000),identity.id,fail,json);
  const edit=path.match(/^\/api\/stock\/shop\/([a-z0-9-]{1,80})$/);
  if(edit&&method==='PUT')return saveOffers(db,edit[1],await bodyJson(request,8000),identity.id,fail,json);
  const requestId=path.match(/^\/api\/stock\/requests\/(SANDY-[0-9A-F]{12})$/);
  if(requestId&&method==='POST')return updateRequest(db,requestId[1],await bodyJson(request,8000),identity.id,fail,json);
  fail(404,'This shop action is unavailable.');
}
