import {privateAreaKeys,sealPrivateText,openPrivateText} from './member-network.mjs';
import {equipmentForSponsorOffer} from './club-equipment.mjs';

const publicPath='/api/sponsor-offers', officePath='/api/committee/sponsors';
const headers={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
const consentText='I agree that the Sandy Sports Club committee may store this offer and use my contact details to discuss it with me.';
const offices=['president','vicepresident','secretary','assistantsecretary','treasurer'];
const statuses=['new','reviewing','agreed','declined'];
const types=['gift','clubSale','loan','share','service','funding','other'];
const attendance=['speaker','workshop','stand','observer','volunteer','none','other'];
const introductionTemplates=[];
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const columns='id,source,offer_cipher AS cipher,status,owner,follow_up_on AS followUpOn,loan_eligible AS loanEligible,version,created_at AS createdAt,updated_at AS updatedAt';
const encode=new TextEncoder();
const stamp=()=>new Date().toISOString();
async function digest(key,parts) {
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,encode.encode(JSON.stringify(parts))));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function wording(value,limit,invalid,required=false){
  if(value!==undefined && typeof value!=='string')invalid();
  const s=(value||'').trim();
  if(s.length>limit || (required&&!s))invalid();
  return s;
}
function options(value,list,invalid){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>list.length||value.some(v=>!list.includes(v)))invalid();
  return [...new Set(value)].sort();
}
function followDate(value,invalid){
  const day=wording(value,10,invalid);
  if(day && (!/^\d{4}-\d\d-\d\d$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day))invalid();
  return day;
}
function flag(value,invalid){
  if(value!==undefined && typeof value!=='boolean')invalid();
  return value===true;
}
function readSubmission(data,lead,fail){
  const invalid=()=>fail(400,'Check the contact and offer fields, then try again.');
  if(!uuid.test(data.requestId))fail(400,'Reopen the form to start this offer.');
  const organisation=wording(data.organisation,120,invalid,lead), contactName=wording(data.contactName,100,invalid,!lead);
  const email=wording(data.email,150,invalid).toLowerCase(),phone=wording(data.phone,25,invalid);
  if((!lead&&!email&&!phone)||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||(phone&&(!/^[+0-9 ()-]+$/.test(phone)||phone.replace(/\D/g,'').length<7)))fail(400,'Enter a contact email address or phone number.');
  const offerTypes=options(data.offerTypes,types,invalid),participation=options(data.participation,attendance,invalid);
  if(!lead&&!offerTypes.length)fail(400,'Choose at least one kind of support.');
  if(participation.includes('none')&&participation.length>1)fail(400,'Choose no attendance on its own, or choose how you might take part.');
  if(!lead && data.consent!==true)fail(400,'Confirm you agree to the committee storing this offer and contacting you.');
  return {organisation,contactName,email,phone,offerTypes,offer:wording(data.offer,1500,invalid,!lead),
    requestedReturn:wording(data.requestedReturn,900,invalid),eventName:wording(data.eventName,140,invalid),participation,
    participationNote:wording(data.participationNote,600,invalid),contactRoute:lead?wording(data.contactRoute,500,invalid,true):'',
    adultAreaRequested:flag(data.adultAreaRequested,invalid),alcoholSupplyProposed:flag(data.alcoholSupplyProposed,invalid),
    consentText:lead?'':consentText};
}

export async function sponsorOffersEndpoint(request,env,identity,h){
  const url=new URL(request.url),publicForm=url.pathname===publicPath;
  const fail=(status,msg)=>{throw new h.HttpError(status,msg,'sponsor_offers');};
  if(!publicForm&&url.pathname!==officePath)fail(404,'Page unavailable.');
  if(publicForm&&request.method!=='POST')fail(405,'Send an offer using the supporter form.');
  if(!publicForm&&identity?.role!=='committee')fail(identity?403:401,'Sign in as a committee officer to review sponsorships.');
  if(!env.DB||!env.PRIVATE_AUTH_KEY)fail(503,'Private sponsorship records are temporarily unavailable.');
  const db=env.DB.withSession?.('first-primary')||env.DB;
  const keys=await privateAreaKeys(env.PRIVATE_AUTH_KEY,'Sandy Sports sponsor offers v1');
  const json=(body,status=200)=>h.json(body,status,headers);
  const seal=(scope,value)=>sealPrivateText(keys.content,scope,JSON.stringify(value));
  const open=async(scope,cipher)=>JSON.parse(await openPrivateText(keys.content,scope,cipher));
  const officer=identity?.administrator?'Webmaster':identity?.name||'Committee';
  const invalidDate=()=>fail(400,'Choose a valid follow-up date or leave it blank.');
  const invalidNote=()=>fail(400,'Keep the committee note within 1,200 characters.');
  async function readRow(id){
    if(!uuid.test(id))fail(400,'Choose an offer from the committee list.');
    const row=await db.prepare('SELECT '+columns+' FROM sponsor_offers WHERE id=?').bind(id).first();
    if(!row)fail(404,'This sponsorship record is unavailable.');
    return row;
  }
  async function view(row,detailed=false){
    const {cipher,...summary}=row, offer=await open('sponsor/'+row.id,cipher);
    summary.loanEligible=Boolean(row.loanEligible);
    if(!detailed) {
      const {organisation,contactName,eventName,offerTypes,adultAreaRequested,alcoholSupplyProposed}=offer;
      const words=(offer.offer||'').replace(/\s+/g,' ').trim();
      const offerSummary=words.length>140?words.slice(0,139).trimEnd()+'…':words;
      return {...summary,organisation,contactName,eventName,offerTypes,adultAreaRequested,alcoholSupplyProposed,offerSummary};
    }
    const [revisions,assets]=await Promise.all([
      db.prepare('SELECT version,review_cipher AS cipher,occurred_at AS at FROM sponsor_offer_reviews WHERE offer_id=? ORDER BY version DESC').bind(row.id).all(),
      equipmentForSponsorOffer(db,env.PRIVATE_AUTH_KEY,row.id)
    ]);
    const history=await Promise.all(revisions.results.map(async v=>({...await open('sponsor-review/'+row.id+'/'+v.version,v.cipher),at:v.at})));
    return {...summary,...offer,consentAt:row.source==='lead'?null:row.createdAt,consent:row.source==='nomination',
      agreedShopProducts:row.status==='agreed'&&(history[0]?.agreedShopProducts??offer.offerTypes.includes('clubSale')),
      reviewNote:history[0]?.reviewNote||'',assetId:assets[0]?.id||null,assets,history};
  }
  function validOwner(value,required=false){
    if((required||value!=='') && !offices.includes(value))fail(400,'Choose the officer responsible for follow-up.');
    return value;
  }
  if(!publicForm&&request.method==='GET'){
    if(url.searchParams.has('id'))return json({offer:await view(await readRow(url.searchParams.get('id')),true)});
    const status=url.searchParams.get('status')||'all',cursor=url.searchParams.get('cursor');
    if(status!=='all'&&!statuses.includes(status))fail(400,'Choose a valid review status.');
    let tail=[];
    if(cursor){
      try{tail=JSON.parse(atob(cursor));}catch{fail(400,'Reopen the committee list.');}
      if(!Array.isArray(tail)||tail.length!==2||typeof tail[0]!=='string'||tail[0].length!==24||!uuid.test(tail[1]))fail(400,'Reopen the committee list.');
    }
    const filters=[],params=[];
    if(status!=='all'){filters.push('status=?');params.push(status);}
    if(cursor){filters.push('(created_at,id)<(?,?)');params.push(...tail);}
    const rows=(await db.prepare('SELECT '+columns+' FROM sponsor_offers'+(filters.length?' WHERE '+filters.join(' AND '):'')+' ORDER BY created_at DESC,id DESC LIMIT 21').bind(...params).all()).results;
    const page=rows.slice(0,20),last=page.at(-1);
    return json({offers:await Promise.all(page.map(r=>view(r))),introductionTemplates,
      nextCursor:rows.length>20?btoa(JSON.stringify([last.createdAt,last.id])):null});
  }
  if(request.method!=='POST')fail(405,'Use the sponsorship form.');
  const data=await h.bodyJson(request,18000);
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Check the sponsorship form.');
  if(publicForm||data.action==='lead'){
    const lead=!publicForm, offer=readSubmission(data,lead,fail),id=crypto.randomUUID(),at=stamp();
    const owner=lead?validOwner(data.owner,true):'',due=lead?followDate(data.followUpOn,invalidDate):'';
    const note=lead?wording(data.reviewNote,1200,invalidNote):'';
    const key=await digest(keys.receipt,[lead?'lead':'nomination',lead?identity.id:'',data.requestId.toLowerCase()]);
    const response=async stored=>lead?json({offer:await view(stored,true)},201):json({received:true},202);
    const previous=await db.prepare('SELECT '+columns+' FROM sponsor_offers WHERE request_key=?').bind(key).first();
    if(previous)return response(previous);
    const cipher=await seal('sponsor/'+id,offer);
    const fields=[id,key,lead?'lead':'nomination',cipher,owner,due,at];
    const insert='INSERT INTO sponsor_offers(id,request_key,source,offer_cipher,status,owner,follow_up_on,created_at,updated_at) SELECT ?1,?2,?3,?4,\'new\',?5,?6,?7,?7 WHERE ';
    if(lead){
      const reviewCipher=await seal('sponsor-review/'+id+'/1',{status:'new',owner,followUpOn:due,reviewNote:note,actor:officer,supporterConfirmed:false});
      await db.batch([
        db.prepare(insert+'1 ON CONFLICT(request_key) DO NOTHING').bind(...fields),
        db.prepare('INSERT INTO sponsor_offer_reviews SELECT ?,1,?,?,?,? WHERE changes()=1').bind(id,key,reviewCipher,identity.id,at),
      ]);
    }else{
      const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/900);
      const throttle=await digest(keys.receipt,['public-throttle',bucket,request.headers.get('cf-connecting-ip')||'local']);
      await db.batch([
        db.prepare('DELETE FROM club_auth_attempts WHERE expires<?').bind(now),
        db.prepare('INSERT OR IGNORE INTO club_auth_attempts(key,count,expires) VALUES(?,0,?)').bind(throttle,(bucket+1)*900),
        db.prepare(insert+'(SELECT count FROM club_auth_attempts WHERE key=?8)<12 ON CONFLICT(request_key) DO NOTHING').bind(...fields,throttle),
        db.prepare('UPDATE club_auth_attempts SET count=count+1 WHERE key=? AND changes()=1').bind(throttle),
      ]);
    }
    const stored=await db.prepare('SELECT '+columns+' FROM sponsor_offers WHERE request_key=?').bind(key).first();
    if(!stored)fail(429,'Please try again in 15 minutes.');
    return response(stored);
  }
  if(data.action!=='review')fail(400,'Choose a sponsorship review action.');
  const row=await readRow(data.id);
  const owner=validOwner(data.owner??''),followUpOn=followDate(data.followUpOn,invalidDate),status=data.status;
  const reviewNote=wording(data.reviewNote,1200,invalidNote),supporterConfirmed=data.supporterConfirmed===true;
  if(!Number.isSafeInteger(data.version)||data.version<1||!statuses.includes(status))fail(400,'Open the current offer and choose a review status.');
  if(['agreed','declined'].includes(status)&&!reviewNote)fail(400,'Record the agreed terms or reason for declining.');
  if(status==='agreed'&&!supporterConfirmed)fail(400,'Confirm that the supporter agreed to the terms you have recorded.');
  const choice=flag(data.agreedLoan,()=>fail(400,'Check the agreed equipment loan option.'));
  const shopChoice=flag(data.agreedShopProducts,()=>fail(400,'Check the agreed club shop products option.'));
  const reviewKey=['review',row.id,identity.id,data.version,status,owner,followUpOn,reviewNote,supporterConfirmed,data.agreedLoan??null];
  if(data.agreedShopProducts!==undefined)reviewKey.push(shopChoice);
  const retry=await digest(keys.receipt,reviewKey);
  const replay=await db.prepare('SELECT 1 FROM sponsor_offer_reviews WHERE offer_id=? AND version=? AND retry_key=?').bind(row.id,data.version+1,retry).first();
  if(replay)return json({offer:await view(await readRow(row.id),true)});
  if(row.version!==data.version)fail(409,'Another officer updated this record. Reopen it before making changes.');
  const checked=await open('sponsor/'+row.id,row.cipher);
  const loan=status==='agreed'&&(data.agreedLoan===undefined?(row.status==='agreed'?Boolean(row.loanEligible):checked.offerTypes.includes('loan')):choice);
  let shopProducts=checked.offerTypes.includes('clubSale');
  if(data.agreedShopProducts!==undefined)shopProducts=shopChoice;
  else if(row.status==='agreed'&&status==='agreed'){
    const old=await db.prepare('SELECT review_cipher AS cipher FROM sponsor_offer_reviews WHERE offer_id=? AND version=?').bind(row.id,row.version).first();
    if(old)shopProducts=(await open('sponsor-review/'+row.id+'/'+row.version,old.cipher)).agreedShopProducts??shopProducts;
  }
  const at=stamp(),version=row.version+1;
  const reviewCipher=await seal('sponsor-review/'+row.id+'/'+version,{status,owner,followUpOn,reviewNote,actor:officer,supporterConfirmed:status==='agreed'&&supporterConfirmed,agreedLoan:loan,agreedShopProducts:status==='agreed'&&shopProducts});
  const result=await db.batch([
    db.prepare('UPDATE sponsor_offers SET version=version+1,status=?,owner=?,follow_up_on=?,loan_eligible=?,updated_at=? WHERE id=? AND version=?')
      .bind(status,owner,followUpOn,Number(loan),at,row.id,row.version),
    db.prepare('INSERT INTO sponsor_offer_reviews SELECT ?,?,?,?,?,? WHERE changes()=1').bind(row.id,version,retry,reviewCipher,identity.id,at),
  ]);
  if(!result[0].meta.changes&&!await db.prepare('SELECT 1 FROM sponsor_offer_reviews WHERE offer_id=? AND version=? AND retry_key=?').bind(row.id,version,retry).first())fail(409,'Another officer updated this record. Reopen it before making changes.');
  return json({offer:await view(await readRow(row.id),true)});
}
