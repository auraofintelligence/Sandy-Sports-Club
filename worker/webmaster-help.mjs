import {privateAreaKeys,sealPrivateText,openPrivateText} from './member-network.mjs';

const scope='Sandy private webmaster help v1';
const topics=new Set(['invitation','password','workspace','email','website']);
const sources=new Set(['signin','invitation','access','email','website']);
const privateHeaders={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const emailAddress=/^[a-z0-9.!#$%&'*+=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const roleFor=actor=>actor?.accountRole==='administrator'?'webmaster':
  actor?.accountRole==='committee' && actor.name==='secretary'?'secretary':null;
const reference=id=>'SANDY-'+id.slice(0,12).toUpperCase();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const sign=async(key,value)=>hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));

export async function webmasterHelpEndpoint(request,env,actor,{HttpError,requireDb,bodyJson,json}){
  const fail=(status,message,code='webmaster_help')=>{throw new HttpError(status,message,code);};
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  if(!env.PRIVATE_AUTH_KEY)fail(503,'The private help inbox is being set up. Please try again later.');
  const url=new URL(request.url),path=url.pathname,publicForm=path==='/api/access-help',statusCheck=path==='/api/access-help/status';
  const reply=(value,status=200)=>json(value,status,privateHeaders);
  const stamp=new Date().toISOString();
  if(publicForm||statusCheck) {
    if(request.method!=='POST')fail(405,'Use the Ask the Webmaster form.');
    const data=await bodyJson(request,2048);
    const allowed=statusCheck?['key']:['key','topic','source','contactType','contact','question'];
    if(Object.keys(data).some(key=>!allowed.includes(key)) || typeof data.key!=='string' || !/^[a-f0-9]{64}$/.test(data.key))
      fail(400,'Open the help form and choose a reason.','invalid_help_request');
    const keys=await privateAreaKeys(env.PRIVATE_AUTH_KEY,scope);
    const id=await sign(keys.receipt,'case:'+data.key);
    if(statusCheck){
      const record=await db.prepare('SELECT state,created_at AS createdAt,updated_at AS updatedAt FROM webmaster_help_requests WHERE id=?').bind(id).first();
      if(!record)fail(404,'This private status link could not be found.');
      return reply({...record,reference:reference(id)});
    }
    if(!topics.has(data.topic)||!sources.has(data.source)||!['email','phone'].includes(data.contactType)||typeof data.contact!=='string')
      fail(400,'Choose a reason and how the club can contact you.');
    const contact=data.contactType==='email'?data.contact.trim().toLowerCase():data.contact.trim();
    const validContact=data.contactType==='email' ? contact.length<=254 && emailAddress.test(contact)
      : /^[+\d ()-]{8,24}$/.test(contact) && /^\d{8,15}$/.test(contact.replace(/\D/g,''));
    if(!validContact)fail(400,'Enter a contact email or phone number the club can use.');
    if(data.question!==undefined && typeof data.question!=='string')fail(400,'Write a short description of what you see on screen.');
    const question=(data.question||'').trim();
    if(question.length>350)fail(400,'Keep your question to 350 characters.');
    if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(question)||
      /(?:[?#&](?:activate|invite|token|reset|receipt|code)=|\b[a-f0-9]{64}\b|\b(?:my (?:password|passcode|pin) is|(?:password|passcode|pin|verification code|login code)\s*[:=])\s*\S|\b\d{6}\b)/i.test(question))
      fail(400,'Remove any password, sign-in code or private link. Tell us the screen or button you need help with.');
    const fields=[data.topic,data.source,data.contactType,contact];if(question)fields.push(question);
    const hash=await sign(keys.receipt,JSON.stringify(fields));
    const box=await sealPrivateText(keys.content,id,'v1\n'+JSON.stringify({contact,question}));
    const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/900);
    const throttle=await sign(keys.receipt,'limit:'+bucket+':'+(request.headers.get('CF-Connecting-IP')||'local'));
    const [,,,,found]=await db.batch([
      db.prepare('DELETE FROM club_auth_attempts WHERE expires<?').bind(now),
      db.prepare('INSERT OR IGNORE INTO club_auth_attempts(key,count,expires) VALUES(?,0,?)').bind(throttle,(bucket+1)*900),
      db.prepare(`INSERT INTO webmaster_help_requests(id,topic,source,contact_type,contact_box,submitted_hash,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count FROM club_auth_attempts WHERE key=?)<12 ON CONFLICT(id) DO NOTHING`)
        .bind(id,data.topic,data.source,data.contactType,box,hash,stamp,stamp,throttle),
      db.prepare('UPDATE club_auth_attempts SET count=count+1 WHERE key=? AND changes()=1').bind(throttle),
      db.prepare('SELECT state,submitted_hash,created_at AS createdAt,updated_at AS updatedAt FROM webmaster_help_requests WHERE id=?').bind(id)
    ]);
    const record=found.results[0];
    if(!record)fail(429,'Several requests have just been received. Try again in 15 minutes.');
    if(record.submitted_hash!==hash)fail(409,'This request was already received. Open its status or start a new one.');
    return reply({reference:reference(id),state:record.state,createdAt:record.createdAt,updatedAt:record.updatedAt},201);
  }
  const role=roleFor(actor);
  if(!role)fail(actor?403:401,'Sign in as the Secretary or Webmaster to open this private inbox.','help_access');
  if(request.method==='POST'){
    const data=await bodyJson(request,1024);
    if(Object.keys(data).some(k=>!['id','version','action'].includes(k)) || typeof data.id!=='string'||!/^[a-f0-9]{64}$/.test(data.id)||
      !Number.isSafeInteger(data.version)||data.version<1||!['seen','claim','resolve','reopen'].includes(data.action))fail(400,'Open the current request before updating it.');
    const row=await db.prepare('SELECT state,version,assigned_to FROM webmaster_help_requests WHERE id=?').bind(data.id).first();
    if(!row)fail(404,'This request could not be found.');
    const markSeen=version=>db.prepare(`INSERT INTO webmaster_help_reads(request_id,account_id,seen_version) VALUES(?,?,?)
      ON CONFLICT(request_id,account_id) DO UPDATE SET seen_version=max(seen_version,excluded.seen_version)`).bind(data.id,actor.id,version);
    if(data.action==='seen'){
      if(data.version>row.version)fail(409,'Refresh this request and try again.');
      await markSeen(data.version).run();return reply({saved:true});
    }
    const target={claim:'in_progress',resolve:'resolved',reopen:'new'}[data.action];
    if(row.state===target && row.version===data.version+1 && row.assigned_to===actor.id)return reply({saved:true});
    if(row.version!==data.version || (data.action==='claim'&&row.state!=='new') ||
      (data.action==='resolve'&&row.state==='resolved') || (data.action==='reopen'&&row.state!=='resolved'))
      fail(409,'The other officer may have updated this request. Refresh the inbox.');
    const [saved]=await db.batch([
      db.prepare('UPDATE webmaster_help_requests SET state=?,assigned_to=?,assigned_role=?,updated_at=?,version=version+1 WHERE id=? AND version=?')
        .bind(target,actor.id,role,stamp,data.id,data.version),
      db.prepare("INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1")
        .bind(crypto.randomUUID(),actor.id,actor.accountRole,'webmaster_help_'+data.action,data.id,stamp),
      db.prepare(`INSERT INTO webmaster_help_reads(request_id,account_id,seen_version) SELECT ?,?,? WHERE changes()=1
        ON CONFLICT(request_id,account_id) DO UPDATE SET seen_version=max(seen_version,excluded.seen_version)`).bind(data.id,actor.id,data.version+1)
    ]);
    if(!saved.meta.changes)fail(409,'This request changed. Refresh the inbox.');
    return reply({saved:true});
  }
  if(request.method!=='GET')fail(405,'Open the private help inbox.');
  const q=url.searchParams;
  const unread='coalesce(r.seen_version,0)<h.version';
  const from='FROM webmaster_help_requests h LEFT JOIN webmaster_help_reads r ON r.request_id=h.id AND r.account_id=?';
  const counts=await db.prepare(`SELECT count(*) FILTER(WHERE ${unread}) AS unread,count(*) FILTER(WHERE h.state<>'resolved') AS open,
    count(*) FILTER(WHERE h.state='resolved' AND ${unread}) AS unreadResolved ${from}`).bind(actor.id).first();
  if(q.get('summary')==='1')return reply({role,counts});
  const folder=q.get('folder')||'open',before=q.get('before');
  if(!['open','resolved'].includes(folder)||(before!==null&&(!/^[1-9]\d*$/.test(before)||!Number.isSafeInteger(Number(before)))))fail(400,'Choose open or resolved requests.');
  const {results}=await db.prepare(`SELECT h.seq,h.id,h.topic,h.source,h.contact_type AS contactType,h.contact_box,
    h.created_at AS createdAt,h.updated_at AS updatedAt,h.state,h.assigned_role AS assignedRole,h.version,${unread} AS unread
    ${from} WHERE h.state${folder==='open'?'<>':'='}'resolved' AND h.seq<? ORDER BY h.seq DESC LIMIT 26`)
    .bind(actor.id,before?Number(before):Number.MAX_SAFE_INTEGER).all();
  const rows=results.slice(0,25),keys=await privateAreaKeys(env.PRIVATE_AUTH_KEY,scope);
  const requests=await Promise.all(rows.map(async({contact_box,seq,unread,...item})=>{
    const plain=await openPrivateText(keys.content,item.id,contact_box);
    const details=plain.startsWith('v1\n')?JSON.parse(plain.slice(3)):{contact:plain,question:''};
    return {...item,reference:reference(item.id),unread:Boolean(unread),contact:details.contact,question:details.question};
  }));
  return reply({role,counts,next:results.length>25?rows.at(-1).seq:null,requests});
}
