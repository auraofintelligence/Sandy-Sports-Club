import { privateAreaKeys, sealPrivateText, openPrivateText } from './member-network.mjs';

export const mealKeyArea = 'Sandy Sports Club private shared meals v1';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const encoder = new TextEncoder();
const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const memberOK = id => `EXISTS(SELECT 1 FROM member_safeguard_flags s WHERE s.accountId=${id} AND s.socialAccess=1)`;
const notBlocked = (first,second) => `NOT EXISTS(SELECT 1 FROM shared_meal_blocked b WHERE (b.first_id=${first} AND b.second_id=${second}) OR (b.first_id=${second} AND b.second_id=${first}))`;
const live = `m.cancelled=0 AND m.ends_at>${now} AND ${memberOK('m.host_id')}`;
const actor = 'WITH actor(id) AS (VALUES(?)) ';
const validInvite = i => `${i}.revoked=0 AND (${i}.member_id IS NULL OR ${memberOK(i+'.member_id')})`;
const connectedPeople = `FROM network_eligible me JOIN network_eligible p ON p.account_id<>me.account_id
 LEFT JOIN network_pairs f ON f.low_id=min(me.id,p.id) AND f.high_id=max(me.id,p.id)
 WHERE me.account_id=? AND COALESCE(f.low_block,0)=0 AND COALESCE(f.high_block,0)=0`;
const privateHeaders = {'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'};
const hex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
const mac = async (key,value) => hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
const inviteToken = async (key,id) => id+'.'+await mac(key,'guest invitation:'+id);
const digestCookie = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const unpack = (key,purpose,id,value) => value ? openPrivateText(key,'meal-'+purpose+':'+id,value) : null;
const seal = (key,purpose,id,value) => sealPrivateText(key,'meal-'+purpose+':'+id,value);
const parseArray = value => JSON.parse(value || '[]');
const places = `m.guest_limit AS guestLimit,
  m.guest_limit - COALESCE((SELECT h.guests FROM shared_meal_headcounts h WHERE h.meal_id=m.id),0) AS placesLeft`;

function guestCookieName(id){return '__Host-sandymeal-'+id;}
function guestCookie(request,id){
  const prefix=guestCookieName(id)+'=';
  const value=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(prefix))?.slice(prefix.length);
  return /^[0-9a-f]{64}$/.test(value||'') ? value : null;
}
function validStart(date,time){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
  const millis=Date.parse(date+'T'+time+':00+10:00');
  return Number.isFinite(millis)&&new Date(millis+36e6).toISOString().slice(0,16)===date+'T'+time?millis:null;
}

async function presentMeals(db,key,viewer,guest=null){
  const memberSee = `m.host_id=a.id OR ((i.id IS NOT NULL OR (m.visibility='members' AND m.cancelled=0)) AND COALESCE(i.revoked,0)=0 AND ${notBlocked('m.host_id','a.id')})`;
  const known = guest ? '0' : 'm.host_id=a.id';
  const guestCanSee = `i.id=? AND i.member_id IS NULL AND i.revoked=0 AND (i.browser_hash IS NULL OR i.browser_hash=?) AND ${live} AND ${notBlocked('m.host_id','a.id')}`;
  const exact = `m.cancelled=0 AND ((${known}) OR i.response='going')`;
  const people = `SELECT json_group_array(json_object('id',r.id,'kind',CASE WHEN r.member_id IS NULL THEN 'guest' ELSE 'member' END,
    'name',p.display_name,'guestName',r.guest_name,'response',r.response,'partySize',r.party_size,'dietary',r.dietary,
    'contribution',r.contribution,'revoked',r.revoked)) FROM shared_meal_invites r LEFT JOIN network_profiles p ON p.account_id=r.member_id
    WHERE r.meal_id=m.id`;
  const offerings = `SELECT json_group_array(json_object('id',r.id,'box',r.contribution)) FROM shared_meal_invites r
    WHERE r.meal_id=m.id AND r.response='going' AND r.contribution IS NOT NULL AND ${validInvite('r')}`;
  const jobs = `SELECT json_group_array(json_object('slot',j.slot,'claimant',CASE WHEN ${known} THEN j.invite_id END,
    'mine',CASE WHEN j.invite_id IS NULL THEN (${known}) ELSE j.invite_id=i.id END))
    FROM shared_meal_jobs j LEFT JOIN shared_meal_invites r ON r.id=j.invite_id
    WHERE j.meal_id=m.id AND (j.invite_id IS NULL OR (${validInvite('r')} AND r.response='going'))`;
  const statement = `${actor}SELECT m.id,m.contents,m.starts_at,m.venue_type,m.visibility,m.cancelled,${places},(${known}) AS own,
    i.id AS invite,i.response,i.party_size,i.dietary,i.contribution,
    CASE WHEN ${exact} THEN m.location END AS location,
    CASE WHEN ${known} THEN (${people}) END AS invites,
    CASE WHEN ${exact} THEN (${offerings}) END AS shared,(${jobs}) AS jobs
    FROM shared_meals m CROSS JOIN actor a LEFT JOIN shared_meal_invites i ON i.meal_id=m.id AND ${guest?'i.id=?':'i.member_id=a.id'}
    WHERE ${guest?guestCanSee:`${memberOK('a.id')} AND ${memberOK('m.host_id')} AND m.ends_at>${now} AND (${memberSee})`}
    ORDER BY m.starts_at,m.id`;
  const rows=(await db.prepare(statement).bind(...(guest?[viewer||'',guest.id,guest.id,guest.cookieHash]:[viewer])).all()).results;
  const reply=async(id,box)=>box?JSON.parse(await unpack(key,'contribution',id,box)):{sideDish:'',contribution:''};
  return Promise.all(rows.map(async r=>{
    const details=JSON.parse(await unpack(key,'details',r.id,r.contents));
    const slots=parseArray(r.jobs),local=new Date(Date.parse(r.starts_at)+36e6).toISOString();
    const meal={id:r.id,title:details.title,hostName:details.hostName,menu:details.menu,area:details.area,byo:details.byo,recipe:details.recipe,
      venueType:r.venue_type,visibility:r.visibility,date:local.slice(0,10),time:local.slice(11,16),own:!!r.own,guestLimit:r.guestLimit,placesLeft:r.placesLeft,
      status:r.cancelled?'cancelled':'upcoming',location:await unpack(key,'location',r.id,r.location),
      jobs:details.jobs.map((label,index)=>({index,label,taken:slots.some(s=>s.slot===index),mine:slots.some(s=>s.slot===index&&s.mine)})),
      shared:await Promise.all(parseArray(r.shared).map(s=>reply(s.id,s.box))),invitation:null};
    if(r.invite)meal.invitation={id:r.invite,response:r.response,partySize:r.party_size,dietary:await unpack(key,'dietary',r.invite,r.dietary)||'',...await reply(r.invite,r.contribution)};
    if(r.own){
      meal.invites=await Promise.all(parseArray(r.invites).map(async s=>({id:s.id,kind:s.kind,name:s.name||await unpack(key,'guest',s.id,s.guestName)||'Club member',
        response:s.response,partySize:s.partySize,revoked:!!s.revoked,dietary:await unpack(key,'dietary',s.id,s.dietary)||'',...await reply(s.id,s.contribution)})));
      const names=new Map(meal.invites.map(s=>[s.id,s.name]));
      for(const slot of slots)meal.jobs[slot.slot].claimedBy=slot.claimant?names.get(slot.claimant):meal.hostName;
    }
    return meal;
  }));
}

async function openMealListings(db,key){
  const {results}=await db.prepare(`SELECT m.id,m.contents,m.venue_type,m.starts_at,${places} FROM shared_meals m
    WHERE m.visibility='members' AND ${live} ORDER BY m.starts_at,m.id`).all();
  return Promise.all(results.map(async row=>{
    const {title,menu,recipe,byo,area,jobs}=JSON.parse(await unpack(key,'details',row.id,row.contents));
    const local=new Date(Date.parse(row.starts_at)+36e6).toISOString();
    return {id:row.id,title,menu,recipe,byo,area,venueType:row.venue_type,date:local.slice(0,10),time:local.slice(11,16),
      guestLimit:row.guestLimit,placesLeft:row.placesLeft,jobs:jobs.map((label,index)=>({index,label}))};
  }));
}

export async function sharedMealsEndpoint(request,env,identity,h){
  const url=new URL(request.url),isGuest=url.pathname==='/api/meal-guest';
  const fail=(status,message)=>{throw new h.HttpError(status,message,'shared_meals');};
  const missing=()=>fail(404,'This meal or invitation is unavailable. Ask the host for a new invitation.');
  const refresh=()=>fail(409,'This invitation or job has changed. Refresh the meal and try again.');
  const webmaster=!isGuest && identity?.accountRole==='administrator' && identity.administrator===true && identity.role==='committee';
  if(webmaster && (request.method!=='GET'||url.search))fail(403,'The Webmaster can read open member meal listings here.');
  if(!isGuest && !webmaster)h.requireRole(identity,['member']);
  const storage=h.requireDb(env),db=storage.withSession?.('first-primary')||storage;
  const viewer=identity?.id||'';
  if(!webmaster && (!isGuest||identity?.accountRole==='member')&&!await db.prepare('SELECT 1 FROM member_safeguard_flags WHERE accountId=? AND socialAccess=1').bind(viewer).first())
    fail(403,'Shared meals open to current members aged 16 or over who have accepted the sharing agreement. Children can attend with a guardian.');
  if(!env.PRIVATE_AUTH_KEY)fail(503,'Private meal storage is temporarily unavailable.');
  const {content:key,receipt}=await privateAreaKeys(env.PRIVATE_AUTH_KEY,mealKeyArea);
  const send=(data,headers={})=>h.json(data,200,{...privateHeaders,...headers});
  if(webmaster)return send({mode:'webmaster',meals:await openMealListings(db,key)});
  if(!isGuest&&request.method==='GET'){
    if(!url.searchParams.has('q'))return send({meals:await presentMeals(db,key,viewer)});
    const q=url.searchParams.get('q').trim();
    if(q.length>60||q.length===1)fail(400,'Enter at least two letters or leave the search empty for friends.');
    const rows=(await db.prepare(`SELECT p.id,p.display_name AS displayName,(COALESCE(f.state,'none')='friend') AS friend ${connectedPeople}
      AND ((?='' AND f.state='friend') OR (?<>'' AND (p.listed=1 OR f.state='friend') AND instr(lower(p.display_name),lower(?))>0))
      ORDER BY friend DESC,p.display_name,p.id LIMIT 50`).bind(viewer,q,q,q).all()).results;
    return send({people:rows.map(r=>({...r,friend:!!r.friend}))});
  }
  if(request.method!=='POST')fail(405,'Use the meal invitation form.');
  const body=await h.bodyJson(request,8000);
  const text=(k,max,required=false)=>{
    const val=body[k]??'';
    if(typeof val!=='string'||val.trim().length>max||(required&&!val.trim()))fail(400,'Check the '+k+' field and try again.');
    return val.trim();
  };
  const id=k=>{if(typeof body[k]!=='string'||!uuid.test(body[k]))fail(400,'Reopen the meal form and try again.');return body[k].toLowerCase();};
  const guestLimit=()=>{
    const value=body.guestLimit;
    if(value==null || value==='')return null;
    if(!Number.isSafeInteger(value)||value<1)fail(400,'Enter a whole number of guest places, or leave it blank for no limit.');
    return value;
  };
  async function savePlaces(statement,editing=false){
    try{return await statement.run();}
    catch(error){
      if(![error?.message,error?.cause?.message].some(message=>message?.includes('shared_meal_places_full')))throw error;
      fail(409,editing?'More guests are already coming than this limit allows. Keep a place for everyone who has accepted.':'There are too few places left for this group. Choose a smaller number if fewer people will come, or check back later.');
    }
  }
  const action=body.action;
  const ok=()=>send({ok:true});
  let gid=null,cookieHash=null;
  if(isGuest){
    if(typeof body.token!=='string'||!/^([a-f0-9-]{36})\.([a-f0-9]{64})$/.test(body.token))missing();
    const [inv,signature]=body.token.split('.');
    if(!uuid.test(inv)||!await crypto.subtle.verify('HMAC',receipt,Uint8Array.from(signature.match(/../g),x=>parseInt(x,16)),encoder.encode('guest invitation:'+inv)))missing();
    gid=inv;
    const existing=guestCookie(request,gid),cookie=existing||hex(crypto.getRandomValues(new Uint8Array(32)));
    cookieHash=await digestCookie(cookie);
    if(action==='view'){
      const [meal]=await presentMeals(db,key,viewer,{id:gid,cookieHash});if(!meal)missing();
      return send({meal},existing?{}:{'Set-Cookie':guestCookieName(gid)+'='+cookie+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=31536000'});
    }
    if(!['rsvp','job'].includes(action))missing();
    if(!existing)fail(409,'Open your original private invitation in this browser first.');
  }
  const guestRead=async()=>{const [meal]=await presentMeals(db,key,viewer,{id:gid,cookieHash});if(!meal)missing();return send({meal});};
  const hostGate=`m.host_id=? AND ${live}`;
  if(!isGuest&&action==='create'){
    const meal=id('id'),date=text('date',10,true),time=text('time',5,true),start=validStart(date,time);
    if(!start)fail(400,'Choose a Queensland date and time.');
    const venue=body.venueType,visibility=body.visibility??'invited';
    if(!['home','bbq'].includes(venue)||!['invited','members'].includes(visibility))fail(400,'Choose the venue and who may see this meal.');
    const jobs=body.jobs??[];
    if(!Array.isArray(jobs)||jobs.length>8||jobs.some(s=>typeof s!=='string'||!s.trim()||s.trim().length>50)||new Set(jobs.map(s=>s.trim().toLowerCase())).size!==jobs.length)fail(400,'Choose up to eight different shared jobs.');
    const details={title:text('title',80,true),hostName:text('hostName',60,true),menu:text('menu',500,true),area:text('area',80,true),
      recipe:text('recipe',250),byo:text('byo',250),jobs:jobs.map(s=>s.trim())};
    const location=text('location',200,true),stamp=new Date(start).toISOString();
    const limit=guestLimit();
    const fingerprint=await mac(receipt,JSON.stringify([viewer,details,venue,visibility,stamp,location,...(limit===null?[]:[limit])]));
    const result=await db.prepare(`INSERT INTO shared_meals(id,host_id,venue_type,visibility,starts_at,ends_at,contents,location,job_count,receipt,guest_limit)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${memberOK('?')} AND ?>${now} ON CONFLICT(id) DO NOTHING`)
      .bind(meal,viewer,venue,visibility,stamp,new Date(start+12*36e5).toISOString(),await seal(key,'details',meal,JSON.stringify(details)),await seal(key,'location',meal,location),jobs.length,fingerprint,limit,viewer,stamp).run();
    if(!result.meta.changes&&!(await db.prepare('SELECT 1 FROM shared_meals WHERE id=? AND host_id=? AND receipt=?').bind(meal,viewer,fingerprint).first()))
      fail(409,'Choose a future time or reopen the meal form.');
    return ok();
  }
  if(!isGuest&&action==='updatePlaces'){
    if(!Object.hasOwn(body,'guestLimit'))fail(400,'Enter your guest limit or leave the box blank.');
    const changed=await savePlaces(db.prepare(`UPDATE shared_meals AS m SET guest_limit=? WHERE m.id=? AND ${hostGate}`).bind(guestLimit(),id('mealId'),viewer),true);
    if(!changed.meta.changes)missing();
    return ok();
  }
  if(!isGuest&&action==='updateMenu'){
    const meal=id('mealId'),menu=text('menu',500,true),recipe=text('recipe',250),byo=text('byo',250);
    const current=await db.prepare(`SELECT contents FROM shared_meals m WHERE m.id=? AND ${hostGate}`).bind(meal,viewer).first();
    if(!current)missing();
    const details=JSON.parse(await unpack(key,'details',meal,current.contents));
    const contents=await seal(key,'details',meal,JSON.stringify({...details,menu,recipe,byo}));
    const changed=await db.prepare(`UPDATE shared_meals AS m SET contents=? WHERE m.id=? AND ${hostGate}`).bind(contents,meal,viewer).run();
    if(!changed.meta.changes)refresh();
    return ok();
  }
  if(!isGuest&&['inviteMember','inviteGuest'].includes(action)){
    const mi=id('mealId'),inv=id('id'),external=action==='inviteGuest',peer=external?null:id('peerId'),name=external?text('name',60,true):null;
    const target=external?'NULL':`(SELECT p.account_id ${connectedPeople} AND p.id=? AND (p.listed=1 OR f.state='friend'))`;
    const q=`WITH target(member) AS (SELECT ${target}) INSERT INTO shared_meal_invites(id,meal_id,member_id,guest_name)
      SELECT ?,m.id,t.member,? FROM shared_meals m CROSS JOIN target t WHERE m.id=? AND ${hostGate}
      AND (?=1 OR t.member IS NOT NULL)
      ON CONFLICT(meal_id,member_id) DO UPDATE SET id=excluded.id,revoked=0,response='pending',party_size=1,dietary=NULL,contribution=NULL
        WHERE shared_meal_invites.revoked=1 AND shared_meal_invites.id<>excluded.id
      ON CONFLICT DO NOTHING`;
    const out=await db.prepare(q).bind(...(external?[]:[viewer,peer]),inv,external?await seal(key,'guest',inv,name):null,mi,viewer,+external).run();
    if(!out.meta.changes){
      const old=await db.prepare(`SELECT i.guest_name,i.member_id,p.id AS peer FROM shared_meal_invites i JOIN shared_meals m ON m.id=i.meal_id
        LEFT JOIN network_profiles p ON p.account_id=i.member_id WHERE i.id=? AND i.meal_id=? AND i.revoked=0 AND ${hostGate}`).bind(inv,mi,viewer).first();
      if(!old||(external?(old.member_id!==null||await unpack(key,'guest',inv,old.guest_name)!==name):old.peer!==peer))refresh();
    }
    return external?send({ok:true,token:await inviteToken(receipt,inv)}):ok();
  }
  if(!isGuest&&action==='cancel'){
    const out=await db.prepare(`UPDATE shared_meals AS m SET cancelled=1 WHERE id=? AND host_id=? AND ${memberOK('m.host_id')}`).bind(id('mealId'),viewer).run();
    if(!out.meta.changes)missing();return ok();
  }
  if(!isGuest&&action==='revoke'){
    const out=await db.prepare(`UPDATE shared_meal_invites SET revoked=1,dietary=NULL,contribution=NULL WHERE id=? AND meal_id=?
      AND EXISTS(SELECT 1 FROM shared_meals m WHERE m.id=meal_id AND ${hostGate})`).bind(id('inviteId'),id('mealId'),viewer).run();
    if(!out.meta.changes)missing();return ok();
  }
  const memberReader=`${memberOK('a.id')} AND ${notBlocked('m.host_id','a.id')}`;
  if(action==='rsvp'||(!isGuest&&action==='join')){
    const join=action==='join';
    const invite=isGuest?gid:id(join?'id':'inviteId'),answer=join?'going':body.response;
    if(!['going','declined'].includes(answer)||(!Number.isInteger(body.partySize)||body.partySize<1||body.partySize>8))fail(400,'Choose your response and a party size from one to eight.');
    if(isGuest&&body.ageConfirmed!==true)fail(400,'Confirm that you are 16 or older and responding for your party.');
    const dietary=text('dietary',200),extras={sideDish:text('sideDish',100),contribution:text('contribution',100)};
    const note=answer==='going'&&dietary?await seal(key,'dietary',invite,dietary):null;
    const sharing=answer==='going'&&(extras.sideDish||extras.contribution)?await seal(key,'contribution',invite,JSON.stringify(extras)):null;
    const size=answer==='going'?body.partySize:1;
    if(join){
      const meal=id('mealId');
      const out=await savePlaces(db.prepare(`${actor} INSERT INTO shared_meal_invites(id,meal_id,member_id,response,party_size,dietary,contribution)
        SELECT ?,m.id,a.id,'going',?,?,? FROM shared_meals m CROSS JOIN actor a WHERE m.id=? AND m.visibility='members' AND m.host_id<>a.id AND ${live} AND ${memberReader}
        ON CONFLICT DO NOTHING`).bind(viewer,invite,size,note,sharing,meal));
      if(!out.meta.changes&&!(await db.prepare(`SELECT 1 FROM shared_meal_invites i JOIN shared_meals m ON m.id=i.meal_id WHERE i.id=? AND m.id=? AND i.member_id=? AND i.revoked=0 AND ${live}`).bind(invite,meal,viewer).first()))refresh();
    }else{
      const auth=isGuest?`i.member_id IS NULL AND (i.browser_hash IS NULL OR i.browser_hash=?) AND ${notBlocked('m.host_id','a.id')}`:`i.member_id=a.id AND ${memberReader}`;
      const out=await savePlaces(db.prepare(`${actor} UPDATE shared_meal_invites AS i SET response=?,party_size=?,dietary=?,contribution=?${isGuest?',browser_hash=?':''}
        WHERE i.id=? AND i.revoked=0 AND EXISTS(SELECT 1 FROM shared_meals m CROSS JOIN actor a WHERE m.id=i.meal_id AND ${live} AND ${auth})`)
        .bind(viewer,answer,size,note,sharing,...(isGuest?[cookieHash]:[]),invite,...(isGuest?[cookieHash]:[])));
      if(!out.meta.changes)missing();
    }
    return isGuest?guestRead():ok();
  }
  if(action==='job'){
    const slot=body.jobIndex;
    if(!Number.isInteger(slot)||slot<0||slot>=8||typeof body.claim!=='boolean')fail(400,'Choose a listed meal job.');
    const filter=isGuest?`i.id=? AND i.member_id IS NULL AND i.browser_hash=? AND ${notBlocked('m.host_id','a.id')}`:`m.id=? AND ${memberReader} AND (m.host_id=a.id OR i.member_id=a.id)`;
    const attending=isGuest?"i.response='going' AND i.revoked=0":"(m.host_id=a.id OR (i.response='going' AND i.revoked=0))";
    const scope=`${actor}, who AS (SELECT m.id AS meal,i.id AS invite FROM shared_meals m CROSS JOIN actor a
      LEFT JOIN shared_meal_invites i ON i.meal_id=m.id AND ${isGuest?'i.id=?':'i.member_id=a.id'}
      WHERE ${filter} AND ${attending} AND ${live} AND ?<m.job_count)`;
    const args=[viewer,...(isGuest?[gid,gid,cookieHash]:[id('mealId')]),slot];
    const sql=body.claim?`INSERT INTO shared_meal_jobs(meal_id,slot,invite_id) SELECT meal,?,invite FROM who WHERE 1
      ON CONFLICT(meal_id,slot) DO UPDATE SET invite_id=excluded.invite_id WHERE shared_meal_jobs.invite_id IS excluded.invite_id
      OR (shared_meal_jobs.invite_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shared_meal_invites r WHERE r.id=shared_meal_jobs.invite_id AND r.response='going' AND ${validInvite('r')}))`:
      'DELETE FROM shared_meal_jobs WHERE slot=? AND EXISTS(SELECT 1 FROM who WHERE meal=meal_id AND invite IS invite_id)';
    const out=await db.prepare(scope+' '+sql).bind(...args,slot).run();
    if(!out.meta.changes)refresh();return isGuest?guestRead():ok();
  }
  fail(400,'Choose an action from the meal page.');
}
