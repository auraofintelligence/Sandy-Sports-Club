import {stockCostFields} from './stock-costs.mjs';

const productId=/^[a-z0-9-]{1,80}$/,uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const fields=['name','description','eventDate','variableAmount'];
const actions={create:['kind','mode','priceCents','variants',...fields],edit:fields,publish:[],unpublish:[],
  addVariant:['variant'],addVariants:['variants'],retireVariant:['variantId'],restoreVariant:['variantId']};
const modes={merchandise:['stock'],ticket:['places'],service:['places','enquiry'],donation:['donation']};
const holds="(SELECT COALESCE(SUM(quantity),0) FROM merch_shop_requests r WHERE r.stock_item_id=i.id AND r.status='confirmed')";
const noMutation='NOT EXISTS(SELECT 1 FROM shop_listing_mutations WHERE id=?)';
const ownsWrite='EXISTS(SELECT 1 FROM shop_listing_mutations WHERE id=? AND request_key=?)';

export async function listings(db,staff=false) {
  const visibility=staff?'1':'l.published=1';
  const [headers,variants]=await db.batch([
    db.prepare(`SELECT p.id,p.name,l.kind,l.mode,l.published,l.description,l.variable_amount AS variableAmount,l.event_date AS eventDate,l.version,o.price_cents AS priceCents,
      EXISTS(SELECT 1 FROM shop_variants v WHERE v.product_id=p.id) AS hasVariants
      FROM shop_listings l JOIN merch_products p ON p.id=l.product_id LEFT JOIN merch_shop_offers o ON o.product_id=p.id WHERE `+visibility+' ORDER BY p.display_order,p.id'),
    db.prepare('SELECT v.product_id AS productId,i.id,i.label,v.style,v.colour,v.size,v.active,i.on_hand AS onHand,'+holds+` AS reserved
      FROM shop_variants v JOIN merch_stock_items i ON i.id=v.stock_item_id JOIN shop_listings l ON l.product_id=v.product_id WHERE `+visibility+(staff?'':' AND v.active=1')+' ORDER BY i.rowid'),
  ]);
  const byId=new Map(headers.results.map(({published,version,priceCents,hasVariants,...p})=>[p.id,{...p,hasVariants:!!hasVariants,variableAmount:!!p.variableAmount,
    ...(staff?{published:!!published,version,priceCents}:{}),variants:[]}]));
  for(const {productId,active,onHand,reserved,...v} of variants.results){
    const available=onHand===null?null:onHand-reserved;
    byId.get(productId).variants.push(staff?{...v,active:!!active,onHand,reserved,available}:{...v,available:available===null?null:available>0});
  }
  return [...byId.values()];
}

function options(values,mode,h,fail) {
  if(!Array.isArray(values)||values.length>24)fail(400,'Add between one and 24 options at a time.');
  if(mode==='places' && values.length!==1)fail(400,'Set the number of places for this offering.');
  if(mode==='stock' && !values.length)fail(400,'Add the item or its first stock option.');
  if(!['places','stock'].includes(mode) && values.length)fail(400,'This offering does not use stock or places.');
  const unique=new Set(), labels=new Set();
  return values.map(v=>{
    if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['style','colour','size','label','units','unitCostCents','costSource'].includes(k)))fail(400,'Check the information for each stock option.');
    const [style,colour,size]=['style','colour','size'].map(k=>h.textField(v[k],k,35));
    const label=h.textField(v.label,'the option label',100)||[style,colour,size].filter(Boolean).join(' / ')||(mode==='places'?'Places':'Standard');
    const units=v.units??null;
    if([style,colour,size,label].some(s=>/[\r\n]/.test(s))||label.length>120||
      (units!==null&&(!Number.isSafeInteger(units)||units<0||units>999999))||(mode==='places'&&units===null))fail(400,'Enter a short option label and a valid opening count.');
    if(v.costSource!=null && typeof v.costSource!=='string')fail(400,'Check the supplier reference.');
    if((units===null||mode==='places') && (v.unitCostCents!=null || v.costSource?.trim()))fail(400,'Supplier costs apply only to counted physical stock.');
    const {unit,source}=stockCostFields({kind:'count',unitCostCents:v.unitCostCents,costSource:v.costSource},h.HttpError);
    const signature=JSON.stringify((style||colour||size?[style,colour,size]:[label]).map(s=>s.normalize('NFKC').trim().toLowerCase()));
    const normLabel=label.normalize('NFKC').toLowerCase();
    if(unique.has(signature)||labels.has(normLabel))fail(400,'Give each option a distinct combination and label.');
    unique.add(signature);labels.add(normLabel);
    return {id:crypto.randomUUID(),opening:crypto.randomUUID(),label,style,colour,size,signature,units,unit,source};
  });
}

export async function manageListings(request,db,identity,h,fail) {
  const reply=async(status=200)=>h.json({listings:await listings(db,true)},status,{'Cache-Control':'private, no-store'});
  if(request.method==='GET')return reply();
  if(request.method!=='POST')fail(405,'Open the shop offerings to manage a listing.');
  const b=await h.bodyJson(request,60000),{action,id,mutationId,version}=b;
  const create=action==='create';
  if(typeof action!=='string'||!Object.hasOwn(actions,action)||typeof id!=='string'||!productId.test(id)||(create&&!uuid.test(id))||
    typeof mutationId!=='string'||!uuid.test(mutationId)||(!create&&(!Number.isSafeInteger(version)||version<1))||
    Object.keys(b).some(k=>!['id','action','mutationId',...(create?[]:['version']),...actions[action]].includes(k)))fail(400,'Choose a current shop offering and try again.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(b,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)));
  const key=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''),attempt=key+'/'+crypto.randomUUID();
  const retry=async()=>{
    const prior=await db.prepare('SELECT actor,request_key FROM shop_listing_mutations WHERE id=?').bind(mutationId).first();
    if(prior && (prior.actor!==identity.id||!prior.request_key.startsWith(key+'/')))fail(409,'This action has already been used for a different change.');
    return !!prior;
  };
  if(await retry())return reply();
  const existing=await db.prepare('SELECT * FROM shop_listings WHERE product_id=?').bind(id).first();
  const conflict=()=>fail(409,'This listing or one of its options has changed. Refresh the offerings before saving.');
  if(create?existing:!existing||existing.version!==version){if(await retry())return reply();conflict();}
  const kind=create?b.kind:existing.kind, mode=create?b.mode:existing.mode, stamp=new Date().toISOString(),actor=identity.id;
  if(!Object.hasOwn(modes,kind)||!modes[kind].includes(mode))fail(400,'Choose a matching kind of offering and booking option.');
  const creatingOptions=create||action==='addVariant'||action==='addVariants';
  if(!create && creatingOptions && mode!=='stock')fail(400,'Additional options belong to physical merchandise.');
  const variants=creatingOptions?options(action==='addVariant'?[b.variant]:(b.variants??[]),mode,h,fail):[];
  if(!create && variants.length){
    const prior=await db.prepare('SELECT label FROM merch_stock_items WHERE product_id=?').bind(id).all();
    const labels=new Set(prior.results.map(v=>v.label.normalize('NFKC').trim().toLowerCase()));
    if(variants.some(v=>labels.has(v.label.normalize('NFKC').trim().toLowerCase()))){
      if(await retry())return reply();
      fail(409,'An existing stock item already uses that label. Give the new option its own label.');
    }
  }
  let title,description,eventDate,variable,price=null;
  if(create||action==='edit'){
    title=h.textField(b.name,'the public offering name',120,true);description=h.textField(b.description,'the short public description',600);
    eventDate=h.dateField(b.eventDate,false);variable=b.variableAmount??false;
    if(/[\r\n]/.test(title)||typeof variable!=='boolean'||(variable&&kind!=='donation')||(eventDate&&!['ticket','service'].includes(kind)))
      fail(400,'Check the public name, date and donation settings.');
    if(create){
      price=b.priceCents??null;
      if(price!==null&&(!Number.isSafeInteger(price)||price<1||price>1000000))fail(400,'Enter a positive price in Australian dollars, or leave it to confirm later.');
    }
  }
  const writes=[],scoped=(sql,args=[])=>db.prepare(sql).bind(...args,mutationId,attempt);
  const gate=(sql,args=[])=>db.prepare('UPDATE shop_listings SET '+sql+',version=version+1,updated_at=?,updated_by=? WHERE product_id=? AND version=? AND '+noMutation)
    .bind(...args,stamp,actor,id,version,mutationId);
  if(create) {
    writes.push(db.prepare(`INSERT INTO merch_products(id,name,public_note,display_order) SELECT ?,?,'',COALESCE((SELECT MAX(display_order)+1 FROM merch_products),1) WHERE `+noMutation+' ON CONFLICT(id) DO NOTHING').bind(id,title,mutationId),
      db.prepare('INSERT INTO shop_listings(product_id,kind,mode,description,event_date,variable_amount,updated_by,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1')
      .bind(id,kind,mode,description,eventDate,Number(variable),actor,stamp));
  } else if(action==='edit')writes.push(gate('description=?,event_date=?,variable_amount=?',[description,eventDate,Number(variable)]));
  else if(action==='publish'||action==='unpublish'){
    const publish=action==='publish';
    if(!!existing.published===publish)conflict();
    writes.push(gate('published=?',[+publish]));
  } else {
    const changeVariant=action==='retireVariant'||action==='restoreVariant';
    if(changeVariant && (mode!=='stock'||typeof b.variantId!=='string'||!uuid.test(b.variantId)))fail(400,'Choose a stock combination from the listing.');
    if(changeVariant){
      writes.push(db.prepare(`UPDATE shop_listings SET version=version+1,updated_at=?,updated_by=? WHERE product_id=? AND version=? AND `+noMutation+
        ` AND EXISTS(SELECT 1 FROM shop_variants v WHERE v.product_id=? AND v.stock_item_id=? AND v.active=?)
        AND (?=1 OR NOT EXISTS(SELECT 1 FROM merch_shop_requests WHERE status='confirmed' AND stock_item_id=?))`)
        .bind(stamp,actor,id,version,mutationId,id,b.variantId,Number(action==='retireVariant'),Number(action==='restoreVariant'),b.variantId));
    }else writes.push(gate('published=published'));
  }
  writes.push(db.prepare('INSERT INTO shop_listing_mutations SELECT ?,?,?,? WHERE changes()=1').bind(mutationId,id,actor,attempt));
  if(create) writes.push(scoped(`INSERT INTO merch_shop_offers(product_id,price_cents,sizes_json,version,updated_by,updated_at,last_key,mutation)
    SELECT ?,?,'[]',1,?,?,'',? WHERE `+ownsWrite,[id,price,actor,stamp,mutationId]));
  if(action==='edit')writes.push(scoped('UPDATE merch_products SET name=? WHERE id=? AND '+ownsWrite,[title,id]));
  if(action==='retireVariant'||action==='restoreVariant')writes.push(scoped('UPDATE shop_variants SET active=? WHERE stock_item_id=? AND '+ownsWrite,[Number(action==='restoreVariant'),b.variantId]));
  if(variants.length){
    const data=JSON.stringify(variants);
    writes.push(scoped(`INSERT INTO merch_stock_items(id,product_id,label) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.label') FROM json_each(?) WHERE `+ownsWrite,[id,data]),
      scoped(`INSERT INTO shop_variants(stock_item_id,product_id,style,colour,size,combination)
        SELECT json_extract(value,'$.id'),?,json_extract(value,'$.style'),json_extract(value,'$.colour'),json_extract(value,'$.size'),json_extract(value,'$.signature') FROM json_each(?) WHERE `+ownsWrite,[id,data]),
      scoped(`INSERT INTO merch_movements(id,item_id,kind,units,after_units,item_revision,actor_id,occurred_at,unit_cost_cents,initial_cost_source)
        SELECT json_extract(value,'$.opening'),json_extract(value,'$.id'),'count',json_extract(value,'$.units'),json_extract(value,'$.units'),1,?,?,json_extract(value,'$.unit'),json_extract(value,'$.source')
        FROM json_each(?) WHERE json_extract(value,'$.units') IS NOT NULL AND `+ownsWrite,[actor,stamp,data]));
  }
  const changedOptions=!create&&(creatingOptions||action==='retireVariant'||action==='restoreVariant');
  if(changedOptions||(action==='edit'&&!!existing.variable_amount!==variable))writes.push(scoped(`INSERT INTO merch_shop_offers(product_id,price_cents,sizes_json,version,updated_by,updated_at,last_key,mutation)
    SELECT ?,NULL,'[]',1,?,?,'',? WHERE `+ownsWrite+` ON CONFLICT(product_id) DO UPDATE SET checkout_url=NULL,sizes_json='[]',version=version+1,last_key='',mutation=excluded.mutation,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,[id,actor,stamp,mutationId]));
  writes.push(scoped('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE '+ownsWrite,[crypto.randomUUID(),actor,identity.accountRole,'shop_listing_'+action,id,stamp]));
  let result;
  try {result=await db.batch(writes);}
  catch(e){if(/UNIQUE constraint failed/.test(String(e.cause||e)))fail(409,'This option label or combination is already in the stock book. Choose a distinct option.');throw e;}
  if(!await retry())conflict();
  return reply(create&&result[0].meta.changes?201:200);
}
