import {sanitiseClubJpeg} from './member-network.mjs';
import {requireTreasurer} from './merch-orders.mjs';

const publicPath='/api/shop/photos';
const deskPath='/api/stock/shop-photos';
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const key=/^[a-z\d-]{1,80}$/;
const headers={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
const activeSlot=`(f.variant_key='' OR EXISTS(SELECT 1 FROM shop_variants v JOIN merch_stock_items i
  ON i.id=v.stock_item_id AND i.product_id=v.product_id WHERE v.stock_item_id=f.variant_key AND v.product_id=f.product_id AND v.active=1))`;
const slotQuery=`SELECT l.product_id AS productId,'' AS variantId,p.name AS label,p.name AS defaultAlt
  FROM shop_listings l JOIN merch_products p ON p.id=l.product_id WHERE l.product_id=?
  UNION ALL SELECT l.product_id,i.id,i.label,p.name || ' · ' || i.label
  FROM shop_listings l JOIN merch_products p ON p.id=l.product_id JOIN shop_variants v ON v.product_id=l.product_id
  JOIN merch_stock_items i ON i.id=v.stock_item_id AND i.product_id=l.product_id WHERE l.product_id=? AND v.active=1`;
const receipt=`SELECT version,mutation_id AS mutationId,mutation_key AS mutationKey,updated_by AS actor
  FROM shop_photos WHERE product_id=? AND variant_key=?`;

export async function attachShopPhotos(db,products){
  if(!products.length)return products;
  const installed=await db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='shop_photos'").first();
  if(!installed)return products;
  const photos=new Map();
  for(let i=0;i<products.length;i+=80){
    const ids=products.slice(i,i+80).map(product=>product.id);
    const rows=await db.prepare(`SELECT f.product_id,f.variant_key,f.version,f.alt FROM shop_photos f
      JOIN shop_listings l ON l.product_id=f.product_id WHERE l.published=1 AND f.jpeg IS NOT NULL AND ${activeSlot}
      AND f.product_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();
    for(const row of rows.results)photos.set(row.product_id+'/'+row.variant_key,row);
  }
  function image(product,variant){
    const row=photos.get(product.id+'/'+(variant?.id||''));
    if(!row)return null;
    return {url:publicPath+'/'+row.version,alt:row.alt||(variant?product.name+' · '+variant.label:product.name)};
  }
  return products.map(product=>({...product,photo:image(product),variants:product.variants.map(v=>({...v,photo:image(product,v)}))}));
}

async function editor(db,productId,fail){
  const rows=await db.prepare(`SELECT s.variantId,s.label,s.defaultAlt,f.version,f.alt,(f.jpeg IS NOT NULL) AS hasPhoto
    FROM (${slotQuery}) s LEFT JOIN shop_photos f ON f.product_id=s.productId AND f.variant_key=s.variantId
    ORDER BY (s.variantId<>''),s.label`).bind(productId,productId).all();
  if(!rows.results.length)fail(404,'This listing is unavailable.');
  return {productId,slots:rows.results.map(s=>({variantId:s.variantId||null,label:s.label,defaultAlt:s.defaultAlt,
    version:s.version,alt:s.alt||'',photo:s.hasPhoto?{url:deskPath+'/'+s.version,alt:s.alt||s.defaultAlt}:null}))};
}

async function getImage(db,version,staff,h,fail){
  if(!uuid.test(version))fail(404,'This photo is unavailable.');
  const row=await db.prepare(`SELECT f.jpeg FROM shop_photos f JOIN shop_listings l ON l.product_id=f.product_id
    WHERE f.version=? AND f.jpeg IS NOT NULL AND ${activeSlot}`+(staff?'':' AND l.published=1')).bind(version).first();
  if(!row)fail(404,'This photo is unavailable.');
  return h.response(Uint8Array.from(atob(row.jpeg),c=>c.charCodeAt(0)),200,{...headers,'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff'});
}

async function mutate(db,b,identity,fail){
  if(!['save','remove'].includes(b.action)||typeof b.productId!=='string'||!key.test(b.productId)||
     !(b.variantId===null||(typeof b.variantId==='string'&&key.test(b.variantId)))||
     !(b.version===null||(typeof b.version==='string'&&uuid.test(b.version)))||
     typeof b.mutationId!=='string'||!uuid.test(b.mutationId)||
     Object.keys(b).some(k=>!['action','productId','variantId','version','mutationId',...(b.action==='save'?['photo','alt']:[])].includes(k)))
    fail(400,'Open the listing and choose a current photo.');
  const variant=b.variantId||'';
  const alt=b.action==='save'?b.alt??'':'';
  if(typeof alt!=='string'||alt.length>220||/[\u0000-\u001f\u007f]/.test(alt))
    fail(400,'Write a short photo description of up to 220 characters.');
  const clean=b.photo===undefined?null:sanitiseClubJpeg(b.photo,fail);
  if(b.photo!==undefined&&!clean)fail(400,'Choose a photo before saving.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([b.action,b.productId,variant,b.version,clean,alt.trim()])));
  const requestKey=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const previous=()=>db.prepare(receipt).bind(b.productId,variant).first();
  const conflict=()=>fail(409,'This photo changed. Reload the photos and check the latest version.');
  function same(row){
    if(row?.mutationId!==b.mutationId)return false;
    if(row.actor!==identity.id||row.mutationKey!==requestKey)conflict();
    return true;
  }
  const available=await db.prepare('SELECT 1 FROM ('+slotQuery+') WHERE variantId=?').bind(b.productId,b.productId,variant).first();
  if(!available)fail(404,'This listing or option is unavailable.');
  const old=await previous();
  if(same(old))return;
  if((old?.version??null)!==b.version)conflict();
  if(!old&&!clean)fail(400,'Select an image to add to this listing.');
  const version=crypto.randomUUID(),now=new Date().toISOString();
  let write;
  if(!old){
    write=db.prepare(`INSERT INTO shop_photos(product_id,variant_key,version,jpeg,alt,mutation_id,mutation_key,updated_by,updated_at)
      SELECT productId,variantId,?,?,?,?,?,?,? FROM (${slotQuery}) WHERE variantId=? ON CONFLICT(product_id,variant_key) DO NOTHING`)
      .bind(version,clean,alt.trim(),b.mutationId,requestKey,identity.id,now,b.productId,b.productId,variant);
  }else{
    write=db.prepare(`UPDATE shop_photos SET version=?,jpeg=CASE WHEN ?='remove' THEN NULL ELSE COALESCE(?,jpeg) END,alt=?,
      mutation_id=?,mutation_key=?,updated_by=?,updated_at=? WHERE product_id=? AND variant_key=? AND version=?
      AND (jpeg IS NOT NULL OR ? IS NOT NULL) AND EXISTS(SELECT 1 FROM (${slotQuery}) WHERE variantId=?)`)
      .bind(version,b.action,clean,alt.trim(),b.mutationId,requestKey,identity.id,now,b.productId,variant,b.version,clean,b.productId,b.productId,variant);
  }
  const saved=await write.run();
  if(saved.meta.changes!==1&&!same(await previous()))conflict();
}

export async function shopPhotosEndpoint(request,env,identity,h){
  const url=new URL(request.url),path=url.pathname,db=h.requireDb(env);
  const fail=(status,message)=>{throw new h.HttpError(status,message,'shop_photo');};
  const staff=path===deskPath||path.startsWith(deskPath+'/');
  if(staff)await requireTreasurer(db,identity,fail);
  if(path===deskPath){
    if(request.method==='GET'){
      const productId=url.searchParams.get('productId');
      if(!productId||!key.test(productId))fail(400,'Open photos from a saved listing.');
      return h.json(await editor(db,productId,fail),200,headers);
    }
    if(request.method==='POST'){
      const b=await h.bodyJson(request,260000);
      await mutate(db,b,identity,fail);
      return h.json(await editor(db,b.productId,fail),200,headers);
    }
  }else if(request.method==='GET'&&(staff||path.startsWith(publicPath+'/'))){
    return getImage(db,path.slice((staff?deskPath:publicPath).length+1),staff,h,fail);
  }
  fail(405,'Use the photo controls on this listing.');
}
