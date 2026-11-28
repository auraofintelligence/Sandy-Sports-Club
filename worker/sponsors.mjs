// Sponsors and supporters (PLFC pattern, Sandy backend): public offer form, sponsor wall, committee sponsorship desk,
// private revocable sponsor links, benefits checklist, and partner stockist products shown in the store as link-outs.
import {fail,json,now,id,dbFor,payload,field,requireRole,audit,STAFF,MEMBER_ADMIN} from './shared.mjs';
import {publicFormAllowed,verifyTurnstile} from './people.mjs';
import {cleanPhoto,photoResponse} from './profiles.mjs';
export const OFFER_TYPES={gift:'A gift for the club',clubSale:'Goods the club could sell',stockist:'Stock our partner store listing',loan:'Equipment on loan',share:'Shared use of a space or gear',service:'A service or skills',funding:'Funding',other:'Something else'};
export const PARTICIPATION={speaker:'Speak at an event',workshop:'Run a workshop or clinic',stand:'Have a stand at an event',observer:'Come and watch',volunteer:'Volunteer',none:'Stay in the background',other:'Other'};
export const TIERS={founding:{label:'Founding partner',benefits:['Logo on the website sponsor wall','Thank-you post on club socials','Logo on the outdoor screen at events','Named in the founding member pack','Invitation to the first club AGM']},
 court:{label:'Court partner',benefits:['Logo on the website sponsor wall','Signage at the court you support','Thank-you post on club socials','Two event tickets each season']},
 screen:{label:'Screen partner',benefits:['Logo on the website sponsor wall','Logo before every outdoor cinema screening','Thank-you post on club socials']},
 event:{label:'Event partner',benefits:['Logo on the website sponsor wall','Named as event partner in the event listing','Stand space at the event']},
 inkind:{label:'In-kind supporter',benefits:['Name on the website sponsor wall','Thank-you post on club socials']},
 stockist:{label:'Partner stockist',benefits:['Name on the website sponsor wall','Products listed under Partner stockists in the club store','Members pointed to your shop for sports gear']}};
const STATUSES={new:'New',reviewing:'In conversation',agreed:'Agreed',active:'Active partner',declined:'Declined',ended:'Ended'};
const OFFICES=['president','vice_president','secretary','assistant_secretary','treasurer','webmaster'];
const DDL=[`CREATE TABLE IF NOT EXISTS club_sponsors(id TEXT PRIMARY KEY,organisation TEXT NOT NULL,contact_name TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',website TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'offer',status TEXT NOT NULL DEFAULT 'new',tier TEXT NOT NULL DEFAULT '',offer_types_json TEXT NOT NULL DEFAULT '[]',participation_json TEXT NOT NULL DEFAULT '[]',offer_text TEXT NOT NULL DEFAULT '',value_cents INTEGER,owner TEXT NOT NULL DEFAULT '',follow_up_on TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',benefits_json TEXT NOT NULL DEFAULT '[]',listing_live INTEGER NOT NULL DEFAULT 0,listing_name TEXT NOT NULL DEFAULT '',listing_blurb TEXT NOT NULL DEFAULT '',listing_url TEXT NOT NULL DEFAULT '',logo TEXT,pending_json TEXT NOT NULL DEFAULT '{}',portal_digest TEXT,portal_issued TEXT,version INTEGER NOT NULL DEFAULT 1,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS club_sponsor_products(id TEXT PRIMARY KEY,sponsor_id TEXT NOT NULL REFERENCES club_sponsors(id),name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',price_cents INTEGER,url TEXT NOT NULL DEFAULT '',photo TEXT,status TEXT NOT NULL DEFAULT 'pending',created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL)`];
const ready=new WeakSet();
async function ensure(env,db){if(ready.has(env))return;for(const s of DDL)await db.prepare(s).run();ready.add(env)}
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async v=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sandy-sponsor-portal/'+v)));
const list=(v,allowed)=>Array.isArray(v)?[...new Set(v.filter(x=>allowed.includes(x)))]:[];
const parse=(s,d)=>{try{return JSON.parse(s)}catch{return d}};
const url=v=>{const s=field(v,300);if(!s)return '';try{const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);if(!['http:','https:'].includes(u.protocol))throw 0;return u.href}catch{fail(400,'Check the website address.','invalid_url')}};
const today=()=>new Date(Date.now()+10*3600000).toISOString().slice(0,10);
const logoUrl=r=>r.logo?'/api/sponsors/logo/'+r.id+'?v='+r.version:null;
function deskShape(r,products=[]){
 return {id:r.id,organisation:r.organisation,contactName:r.contact_name,email:r.email,phone:r.phone,website:r.website,source:r.source,status:r.status,statusLabel:STATUSES[r.status]||r.status,
  tier:r.tier,tierLabel:TIERS[r.tier]?.label||'',offerTypes:parse(r.offer_types_json,[]),participation:parse(r.participation_json,[]),offer:r.offer_text,value:r.value_cents,
  owner:r.owner,followUpOn:r.follow_up_on,overdue:!!r.follow_up_on&&r.follow_up_on<today()&&!['declined','ended'].includes(r.status),notes:r.notes,benefits:parse(r.benefits_json,[]),
  listing:{live:!!r.listing_live,name:r.listing_name,blurb:r.listing_blurb,url:r.listing_url,logoUrl:logoUrl(r)},pending:parse(r.pending_json,{}),
  portal:{issued:!!r.portal_digest,issuedAt:r.portal_issued||null},products:products.map(productShape),version:r.version,createdAt:r.created_utc,updatedAt:r.updated_utc};
}
const productShape=p=>({id:p.id,name:p.name,description:p.description,price:p.price_cents,url:p.url,status:p.status,photoUrl:p.photo?'/api/sponsors/product-photo/'+p.id+'?v='+encodeURIComponent(p.updated_utc):null});
async function productsFor(db,sponsorId,status){
 const {results=[]}=await db.prepare('SELECT * FROM club_sponsor_products WHERE sponsor_id=?'+(status?' AND status=?':'')+' ORDER BY created_utc').bind(...(status?[sponsorId,status]:[sponsorId])).all();return results;
}
async function bySponsorToken(db,req){
 const token=field(req.headers.get('x-sponsor-key'),100);
 if(!/^[a-f0-9]{64}$/.test(token))fail(401,'This sponsor link is not valid. Ask the club for a new one.','invalid_link');
 const r=await db.prepare("SELECT * FROM club_sponsors WHERE portal_digest=? AND status IN ('agreed','active','reviewing')").bind(await sha(token)).first();
 if(!r)fail(401,'This sponsor link is not valid. Ask the club for a new one.','invalid_link');
 return r;
}
export async function sponsorsEndpoint(req,env,path,identity){
 const db=dbFor(env);await ensure(env,db);
 // ---------- Public ----------
 const logo=path.match(/^\/api\/sponsors\/logo\/([a-f0-9-]{36})$/);
 if(logo&&req.method==='GET'){const r=await db.prepare('SELECT logo FROM club_sponsors WHERE id=? AND logo IS NOT NULL').bind(logo[1]).first();if(!r)fail(404,'Logo unavailable.','not_found');return photoResponse(r.logo)}
 const pphoto=path.match(/^\/api\/sponsors\/product-photo\/([a-f0-9-]{36})$/);
 if(pphoto&&req.method==='GET'){const r=await db.prepare('SELECT photo FROM club_sponsor_products WHERE id=? AND photo IS NOT NULL').bind(pphoto[1]).first();if(!r)fail(404,'Photo unavailable.','not_found');return photoResponse(r.photo)}
 if(path==='/api/sponsors'&&req.method==='GET'){
  const {results=[]}=await db.prepare("SELECT * FROM club_sponsors WHERE status='active' AND listing_live=1 ORDER BY CASE tier WHEN 'founding' THEN 0 WHEN 'court' THEN 1 WHEN 'screen' THEN 2 WHEN 'event' THEN 3 WHEN 'stockist' THEN 4 ELSE 5 END,listing_name").all();
  return json({sponsors:results.map(r=>({name:r.listing_name||r.organisation,blurb:r.listing_blurb,url:r.listing_url,tier:TIERS[r.tier]?.label||'',logoUrl:logoUrl(r)})),
   offerTypes:OFFER_TYPES,participation:PARTICIPATION,tiers:Object.fromEntries(Object.entries(TIERS).map(([k,v])=>[k,v.label])),turnstileSiteKey:env.SANDY_TURNSTILE_SITE_KEY||null});
 }
 if(path==='/api/sponsors/stockists'&&req.method==='GET'){
  const {results=[]}=await db.prepare("SELECT p.*,s.listing_name,s.organisation,s.listing_url FROM club_sponsor_products p JOIN club_sponsors s ON s.id=p.sponsor_id WHERE p.status='approved' AND s.status='active' ORDER BY s.listing_name,p.name").all();
  return json({products:results.map(p=>({...productShape(p),stockist:p.listing_name||p.organisation,stockistUrl:p.listing_url}))});
 }
 if(path==='/api/sponsors/offer'&&req.method==='POST'){
  const b=await payload(req,8000);
  if(field(b.website_hp,200))return json({ok:true},201);
  if(env.SANDY_TURNSTILE_SECRET&&env.SANDY_TURNSTILE_SITE_KEY&&!await verifyTurnstile(field(b.turnstileToken,2000),req,env.SANDY_TURNSTILE_SECRET))fail(403,'Complete the verification before sending.','verification_required');
  if(!await publicFormAllowed(env,req,'sponsor',5))fail(429,'Too many offers from this connection. Please try again in 15 minutes.','rate_limited');
  const organisation=field(b.organisation,120),contact=field(b.contactName,100),email=field(b.email,254).toLowerCase(),phone=field(b.phone,25),offer=field(b.offer,2000);
  if(organisation.length<2&&contact.length<2)fail(400,'Tell us your name or business.','invalid_offer');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)&&!/^[+0-9 ()-]{7,25}$/.test(phone))fail(400,'Add an email address or phone number so we can reply.','invalid_offer');
  if(offer.length<5)fail(400,'Tell us a little about what you would like to offer.','invalid_offer');
  if(b.consent!==true)fail(400,'Tick to let the committee store your offer and contact you about it.','consent_required');
  const sid=id(),at=now();
  await db.prepare("INSERT INTO club_sponsors(id,organisation,contact_name,email,phone,website,source,status,offer_types_json,participation_json,offer_text,created_utc,updated_utc) VALUES(?,?,?,?,?,?,'offer','new',?,?,?,?,?)")
   .bind(sid,organisation||contact,contact,email,phone,url(b.website),JSON.stringify(list(b.offerTypes,Object.keys(OFFER_TYPES))),JSON.stringify(list(b.participation,Object.keys(PARTICIPATION))),offer,at,at).run();
  return json({ok:true,notice:'Thank you. The committee will be in touch.'},201);
 }
 // ---------- Sponsor portal (private link) ----------
 if(path==='/api/sponsor-portal'){
  const s=await bySponsorToken(db,req);
  if(req.method==='GET'){const products=await productsFor(db,s.id);const d=deskShape(s,products);
   return json({organisation:d.organisation,status:d.statusLabel,tier:d.tierLabel,benefits:d.benefits,listing:d.listing,pending:d.pending,products:d.products,contact:{name:d.contactName,email:d.email,phone:d.phone,website:d.website}})}
  if(req.method!=='POST')fail(405,'Use the portal forms.','method_not_allowed');
  const b=await payload(req,250000),at=now();
  if(b.action==='listing'){
   const pending={...parse(s.pending_json,{}),name:field(b.name,120),blurb:field(b.blurb,400),url:url(b.url),...(b.logo?{logo:cleanPhoto(b.logo,fail)}:{}),submittedAt:at};
   await db.prepare('UPDATE club_sponsors SET pending_json=?,version=version+1,updated_utc=? WHERE id=?').bind(JSON.stringify(pending),at,s.id).run();
   return json({ok:true,notice:'Sent to the committee for approval.'});
  }
  if(b.action==='product'){
   const name=field(b.name,120);if(name.length<2)fail(400,'Name the product.','invalid_product');
   const price=String(b.price??'').trim()?Math.round(Number(String(b.price).replace(/^\$/,''))*100):null;if(price!=null&&!(price>=0))fail(400,'Price must be an amount like 29.95.','invalid_product');
   const count=await db.prepare("SELECT COUNT(*) AS n FROM club_sponsor_products WHERE sponsor_id=? AND status<>'hidden'").bind(s.id).first();
   if(Number(count?.n||0)>=60)fail(429,'Up to 60 products per stockist.','too_many_products');
   await db.prepare("INSERT INTO club_sponsor_products(id,sponsor_id,name,description,price_cents,url,photo,status,created_utc,updated_utc) VALUES(?,?,?,?,?,?,?,'pending',?,?)")
    .bind(id(),s.id,name,field(b.description,400),price,url(b.url),b.photo?cleanPhoto(b.photo,fail):null,at,at).run();
   return json({ok:true,notice:'Sent to the committee for approval.'},201);
  }
  if(b.action==='remove-product'){
   await db.prepare("UPDATE club_sponsor_products SET status='hidden',updated_utc=? WHERE id=? AND sponsor_id=?").bind(at,field(b.id,40),s.id).run();return json({ok:true});
  }
  fail(400,'Choose an action.','invalid_action');
 }
 // ---------- Committee sponsorship desk ----------
 if(path==='/api/committee/sponsors'){
  requireRole(identity,STAFF);const canManage=MEMBER_ADMIN.includes(identity.role);
  if(req.method==='GET'){
   const {results=[]}=await db.prepare("SELECT * FROM club_sponsors ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 WHEN 'agreed' THEN 2 WHEN 'active' THEN 3 ELSE 4 END,follow_up_on='',follow_up_on,updated_utc DESC LIMIT 500").all();
   const {results:prods=[]}=await db.prepare("SELECT * FROM club_sponsor_products WHERE status<>'hidden'").all();
   const rows=results.map(r=>deskShape(r,prods.filter(p=>p.sponsor_id===r.id)));
   const counts={new:rows.filter(r=>r.status==='new').length,overdue:rows.filter(r=>r.overdue).length,approvals:rows.filter(r=>Object.keys(r.pending).length||r.products.some(p=>p.status==='pending')).length};
   return json({sponsors:rows,counts,canManage,statuses:STATUSES,tiers:Object.fromEntries(Object.entries(TIERS).map(([k,v])=>[k,v.label])),offerTypes:OFFER_TYPES,participation:PARTICIPATION,offices:OFFICES});
  }
  if(req.method!=='POST')fail(405,'Use the desk.','method_not_allowed');
  if(!canManage)fail(403,'Membership officers manage sponsors; you can view.','forbidden');
  const b=await payload(req,250000),at=now(),sid=field(b.id,40);
  if(b.action==='create'){
   const organisation=field(b.organisation,120);if(organisation.length<2)fail(400,'Name the business or person.','invalid_sponsor');
   const newId=id();
   await db.prepare("INSERT INTO club_sponsors(id,organisation,contact_name,email,phone,website,source,status,offer_text,owner,created_utc,updated_utc) VALUES(?,?,?,?,?,?,'committee','reviewing',?,?,?,?)")
    .bind(newId,organisation,field(b.contactName,100),field(b.email,254),field(b.phone,25),url(b.website),field(b.offer,2000),OFFICES.includes(b.owner)?b.owner:identity.role,at,at).run();
   await audit(db,identity,'sponsor_created','sponsor',newId,at).run();return json({ok:true,id:newId},201);
  }
  const s=await db.prepare('SELECT * FROM club_sponsors WHERE id=?').bind(sid).first();if(!s)fail(404,'Sponsor not found.','not_found');
  if(b.action==='update'){
   if(Number(b.version)!==s.version)fail(409,'This sponsor changed. Reload before saving.','conflict');
   const status=Object.keys(STATUSES).includes(b.status)?b.status:s.status,tier=TIERS[b.tier]?b.tier:(b.tier===''?'':s.tier);
   const follow=field(b.followUpOn,10);if(follow&&!/^20\d\d-\d\d-\d\d$/.test(follow))fail(400,'Follow-up date must be a date.','invalid_date');
   let benefits=Array.isArray(b.benefits)?b.benefits.slice(0,40).map(x=>({label:field(x.label,160),done:x.done===true})).filter(x=>x.label):parse(s.benefits_json,[]);
   if(tier&&tier!==s.tier&&!benefits.length)benefits=TIERS[tier].benefits.map(label=>({label,done:false}));
   const value=String(b.value??'').trim()?Math.round(Number(String(b.value).replace(/^\$/,''))*100):null;
   await db.prepare('UPDATE club_sponsors SET organisation=?,contact_name=?,email=?,phone=?,website=?,status=?,tier=?,owner=?,follow_up_on=?,notes=?,benefits_json=?,value_cents=?,listing_live=CASE WHEN ? IN (\'declined\',\'ended\') THEN 0 ELSE listing_live END,version=version+1,updated_utc=? WHERE id=? AND version=?')
    .bind(field(b.organisation,120)||s.organisation,field(b.contactName,100),field(b.email,254),field(b.phone,25),url(b.website),status,tier,OFFICES.includes(b.owner)?b.owner:'',follow,field(b.notes,4000),JSON.stringify(benefits),Number.isFinite(value)?value:null,status,at,s.id,s.version).run();
   await audit(db,identity,'sponsor_updated','sponsor',s.id,at).run();return json({ok:true});
  }
  if(b.action==='portal-link'){
   const token=hex(crypto.getRandomValues(new Uint8Array(32)));
   await db.prepare('UPDATE club_sponsors SET portal_digest=?,portal_issued=?,version=version+1,updated_utc=? WHERE id=?').bind(await sha(token),at,at,s.id).run();
   await audit(db,identity,'sponsor_portal_link_issued','sponsor',s.id,at).run();
   return json({ok:true,link:'/sponsor.html#key='+token,notice:'Copy this link now. It is shown once; making a new one cancels the old one.'});
  }
  if(b.action==='revoke-link'){await db.prepare('UPDATE club_sponsors SET portal_digest=NULL,version=version+1,updated_utc=? WHERE id=?').bind(at,s.id).run();await audit(db,identity,'sponsor_portal_link_revoked','sponsor',s.id,at).run();return json({ok:true})}
  if(b.action==='approve-listing'||b.action==='reject-listing'){
   const p=parse(s.pending_json,{});
   if(b.action==='approve-listing')await db.prepare('UPDATE club_sponsors SET listing_name=?,listing_blurb=?,listing_url=?,logo=COALESCE(?,logo),pending_json=\'{}\',version=version+1,updated_utc=? WHERE id=?').bind(p.name??s.listing_name,p.blurb??s.listing_blurb,p.url??s.listing_url,p.logo||null,at,s.id).run();
   else await db.prepare("UPDATE club_sponsors SET pending_json='{}',version=version+1,updated_utc=? WHERE id=?").bind(at,s.id).run();
   await audit(db,identity,'sponsor_'+b.action.replace('-','_'),'sponsor',s.id,at).run();return json({ok:true});
  }
  if(b.action==='listing'){
   const live=b.live===true;if(live&&s.status!=='active')fail(409,'Only active partners can be shown on the sponsor wall.','not_active');
   await db.prepare('UPDATE club_sponsors SET listing_live=?,listing_name=?,listing_blurb=?,listing_url=?,logo=CASE WHEN ? THEN ? ELSE logo END,version=version+1,updated_utc=? WHERE id=?')
    .bind(live?1:0,field(b.name,120)||s.listing_name||s.organisation,field(b.blurb,400),url(b.url),b.logo!==undefined?1:0,b.logo?cleanPhoto(b.logo,fail):null,at,s.id).run();
   return json({ok:true});
  }
  if(b.action==='product'){
   const status=['approved','pending','hidden'].includes(b.status)?b.status:fail(400,'Choose approve, pending or hide.','invalid_status');
   const r=await db.prepare('UPDATE club_sponsor_products SET status=?,updated_utc=? WHERE id=? AND sponsor_id=?').bind(status,at,field(b.productId,40),s.id).run();
   if(!r.meta.changes)fail(404,'Product not found.','not_found');return json({ok:true});
  }
  fail(400,'Choose an action.','invalid_action');
 }
 fail(404,'That sponsor service does not exist.','not_found');
}
