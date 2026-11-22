import {isPinStyle} from '../public/catch-pin-styles.mjs';
const utf=new TextEncoder(),decode=new TextDecoder();
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const durations={day:1,week:7,month:30,'until-revoked':null};
const relationships=['request','accept','remove','block','unblock'];
const fields={profile:['version','displayName','avatarId','listed','photo'],create:['id','title','message','catchId','photo','pin','recipients','duration'],
  grant:['id','version','recipients','duration'],revoke:['id','version','peerId'],pinStyle:['id','version','style']};
for(const name of relationships)fields[name]=['version','peerId'];
const privateHeaders={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
const current="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const activeGrant=`SELECT 1 FROM network_recipients r JOIN network_eligible recipient ON recipient.id=r.peer_id
  JOIN network_eligible sender ON sender.id=i.owner_id JOIN network_pairs f ON f.low_id=min(r.peer_id,i.owner_id) AND f.high_id=max(r.peer_id,i.owner_id)
  WHERE r.item_id=i.id AND r.peer_id=? AND f.state='friend' AND f.low_block=0 AND f.high_block=0 AND r.revoked_at IS NULL
  AND (r.expires_at IS NULL OR r.expires_at>${current})`;
const base64=bytes=>{
  let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));
  return btoa(binary);
};
const bytes=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function networkKeys(secret,area='Sandy Sports Club private member network v1'){
  const master=await crypto.subtle.importKey('raw',utf.encode(secret),'HKDF',false,['deriveKey']);
  const params=info=>({name:'HKDF',hash:'SHA-256',salt:utf.encode(area),info:utf.encode(info)});
  return {
    content:await crypto.subtle.deriveKey(params('content'),master,{name:'AES-GCM',length:256},false,['encrypt','decrypt']),
    receipt:await crypto.subtle.deriveKey(params('retry receipt'),master,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify'])
  };
}
async function seal(key,scope,text){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf.encode(scope)},key,utf.encode(text));
  return base64(iv)+'.'+base64(new Uint8Array(encrypted));
}
async function open(key,scope,value){
  const [iv,cipher]=value.split('.');
  return decode.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:utf.encode(scope)},key,bytes(cipher)));
}

// Remove application segments and comments throughout the image, including
// those between scans in a progressive JPEG. A GPS tag never becomes a pin.
function jpeg(input,fail){
  if(input==null||input==='')return null;
  const invalid=()=>fail(400,'Choose a smaller JPEG photo, up to 2,000 pixels on each side.');
  if(typeof input!=='string'||input.length>250000||!/^data:image\/jpeg;base64,[A-Za-z\d+/]+={0,2}$/.test(input))invalid();
  let src;try{src=atob(input.slice(23));}catch{invalid();}
  if(src.slice(0,2)!=='\xff\xd8')invalid();
  const byte=i=>src.charCodeAt(i),parts=[src.slice(0,2)];
  let pos=2,frame=false,scans=0;
  while(pos<src.length){
    if(byte(pos)!==255)invalid();
    const start=pos++;
    while(byte(pos)===255)pos++;
    const marker=byte(pos++);
    if(marker===217){
      if(!scans||pos!==src.length)invalid();
      parts.push('\xff\xd9');return btoa(parts.join(''));
    }
    const len=byte(pos)*256+byte(pos+1),end=pos+len;
    if(!Number.isInteger(len)||len<2||end>src.length)invalid();
    if(marker===192||marker===194){
      const height=byte(pos+3)*256+byte(pos+4),width=byte(pos+5)*256+byte(pos+6);
      if(len<11||!width||!height||height>2000||width>2000||frame)invalid();
      frame=true;
    }
    if(marker===218){
      if(!frame||len<6)invalid();
      const components=byte(pos+2);if(components<1||components>4||len!==6+2*components)invalid();
      let scan=end;
      while(scan<src.length){
        if(byte(scan)!==255){scan++;continue;}
        let next=scan+1;while(byte(next)===255)next++;
        const code=byte(next);
        if(code===0||(code>=208&&code<=215)){scan=next+1;continue;}
        break;
      }
      if(scan===end)invalid();
      parts.push(src.slice(start,scan));pos=scan;scans++;continue;
    }
    if([192,194,196,219,221].includes(marker))parts.push(src.slice(start,end));
    else if(!(marker>=224&&marker<=239)&&marker!==254)invalid();
    pos=end;
  }
  invalid();
}

export {jpeg as sanitiseClubJpeg,networkKeys as privateAreaKeys,seal as sealPrivateText,open as openPrivateText};
const base64url=input=>base64(input).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const urlBytes=input=>bytes(input.replaceAll('-','+').replaceAll('_','/'));
async function pageCursor(key,viewer,mode,row){
  const encoded=base64url(utf.encode(JSON.stringify([row.created_at,row.id])));
  return encoded+'.'+base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,utf.encode('page:'+viewer+':'+mode+':'+encoded))));
}
async function readCursor(key,viewer,mode,value,fail){
  if(!value)return null;
  if(typeof value!=='string'||!/^[-\w]{1,140}\.[-\w]{43}$/.test(value))fail(400,'Open the earlier entries from your own list.');
  const [encoded,tag]=value.split('.');
  if(!await crypto.subtle.verify('HMAC',key,urlBytes(tag),utf.encode('page:'+viewer+':'+mode+':'+encoded)))fail(400,'Open the earlier entries from your own list.');
  return JSON.parse(decode.decode(urlBytes(encoded)));
}

const profilePhoto=id=>'/api/member/network/profiles/'+id+'/photo';
const itemPhoto=id=>'/api/member/network/items/'+id+'/photo';
const person=(id,displayName,avatarId,showPhoto)=>({id,displayName,avatarId,photoUrl:showPhoto?profilePhoto(id):null});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

async function membership(db,identity){
  return db.prepare(`SELECT a.id,f.socialAccess AS eligible,
    n.id AS profileId,n.display_name AS displayName,n.avatar AS avatarId,n.listed,n.version,n.photo IS NOT NULL AS hasPhoto
    FROM club_accounts a JOIN member_safeguard_flags f ON f.accountId=a.id AND f.canUseJournal=1 LEFT JOIN network_profiles n ON n.account_id=a.id
    WHERE a.id=? AND a.role='member' AND a.disabled=0 AND a.paid_through>=date('now','+10 hours')`).bind(identity.id).first();
}
async function connections(db,id){
  const rows=await db.prepare(`SELECT p.id,p.display_name,p.avatar,p.has_photo,f.state,f.requester,f.version,
    CASE WHEN f.low_id=? THEN f.low_block ELSE f.high_block END AS myBlock,
    CASE WHEN f.low_id=? THEN f.high_block ELSE f.low_block END AS theirBlock FROM network_pairs f
    JOIN network_eligible p ON p.id=CASE WHEN f.low_id=? THEN f.high_id ELSE f.low_id END WHERE f.low_id=? OR f.high_id=?
    ORDER BY p.display_name,p.id`).bind(id,id,id,id,id).all();
  return rows.results.filter(r=>r.myBlock||(!r.theirBlock&&r.state!=='none')).map(r=>({
    peer:person(r.id,r.display_name,r.avatar,r.state==='friend'&&!r.myBlock&&!r.theirBlock&&r.has_photo),
    state:r.myBlock?'blocked':r.state==='pending'?(r.requester===id?'outgoing':'incoming'):'friend',version:r.version
  }));
}
async function itemList(db,keys,viewer,mode,target,before=null){
  const scope=mode==='mine'?'i.owner_id=?':mode==='inbox'?`EXISTS(${activeGrant})`:`(i.owner_id=? OR EXISTS(${activeGrant})) AND i.id=?`;
  const args=mode==='one'?[viewer,viewer,target]:[viewer];
  const rows=await db.prepare(`SELECT i.id,i.owner_id,i.content,i.photo IS NOT NULL AS hasPhoto,i.created_at,i.version,
    p.display_name,p.avatar,p.photo IS NOT NULL AS senderPhoto,EXISTS(SELECT 1 FROM network_eligible WHERE id=?) AS canSeePins,
    (SELECT expires_at FROM network_recipients WHERE item_id=i.id AND peer_id=?) AS expiresAt
    FROM network_items i JOIN network_profiles p ON p.id=i.owner_id WHERE (${scope}) AND (? IS NULL OR (i.created_at,i.id)<(?,?))
    ORDER BY i.created_at DESC,i.id DESC LIMIT 61`).bind(viewer,viewer,...args,before?.[0]??null,before?.[0]??null,before?.[1]??null).all();
  const page=rows.results.slice(0,60);
  const nextCursor=rows.results.length>60?await pageCursor(keys.receipt,viewer,mode,page.at(-1)):null;
  const ownIds=page.filter(r=>r.owner_id===viewer).map(r=>r.id);
  const recipients=new Map();
  if(ownIds.length){
    const recipientsQuery=await db.prepare(`SELECT r.item_id,r.peer_id,r.expires_at,
      CASE WHEN f.state='friend' AND f.low_block=0 AND f.high_block=0 THEN p.display_name END AS name,
      (EXISTS(SELECT 1 FROM network_eligible WHERE id=?) AND p.id IS NOT NULL AND f.state='friend' AND f.low_block=0 AND f.high_block=0 AND r.revoked_at IS NULL
      AND (r.expires_at IS NULL OR r.expires_at>${current})) AS active
      FROM network_recipients r LEFT JOIN network_eligible p ON p.id=r.peer_id
      LEFT JOIN network_pairs f ON f.low_id=min(?,r.peer_id) AND f.high_id=max(?,r.peer_id)
      WHERE r.item_id IN (SELECT value FROM json_each(?)) ORDER BY r.rowid`).bind(viewer,viewer,viewer,JSON.stringify(ownIds)).all();
    for(const r of recipientsQuery.results){
      if(!recipients.has(r.item_id))recipients.set(r.item_id,[]);
      recipients.get(r.item_id).push({id:r.peer_id,displayName:r.name||'Former recipient',expiresAt:r.expires_at,active:Boolean(r.active)});
    }
  }
  const items=await Promise.all(page.map(async r=>({...JSON.parse(await open(keys.content,'item:'+r.id,r.content)),
    ...(!r.canSeePins?{pin:null}:{}),id:r.id,photoUrl:r.hasPhoto?itemPhoto(r.id):null,createdAt:r.created_at,version:r.version,
    sender:r.owner_id===viewer?null:person(r.owner_id,r.display_name,r.avatar,r.senderPhoto),
    expiresAt:r.expiresAt??null,recipients:recipients.get(r.id)||[]})));
  return {items,nextCursor};
}

export async function memberNetworkEndpoint(request,env,identity,helpers){
  const {requireRole,requireDb,json,response,bodyJson,textField,HttpError}=helpers;
  const fail=(status,message)=>{throw new HttpError(status,message,'member_network');};
  const unavailable=()=>fail(404,'This part of the member network is unavailable.');
  const conflict=()=>fail(409,'This has changed. Refresh your private area and check the latest details.');
  requireRole(identity,['member']);
  const base='/api/member/network',url=new URL(request.url),path=url.pathname;
  if(identity.accountRole!=='member')fail(403,'Use your current paid membership to open this private area.');
  const storage=requireDb(env),db=storage.withSession?storage.withSession('first-primary'):storage;
  let me=await membership(db,identity);
  if(!me)fail(403,'Ask the committee to confirm your age group and any guardian permission before using your private member profile.');
  if(!env.PRIVATE_AUTH_KEY)fail(503,'Private member storage is unavailable.');
  const keys=await networkKeys(env.PRIVATE_AUTH_KEY);
  const desk=async()=>{
    me=await membership(db,identity);if(!me)fail(403,'A current paid membership is needed for the private member area.');
    const {profileId:id,eligible}=me;
    const socialId=me.version>0?id:null;
    const profile={...person(socialId,me.displayName||'',me.avatarId||'angler-01',socialId&&me.hasPhoto),listed:Boolean(me.listed&&eligible),version:me.version||0};
    const empty={items:[],nextCursor:null};
    const canShare=Boolean(eligible&&socialId);
    const [friends,mine,inbox]=id?await Promise.all([canShare?connections(db,id):[],itemList(db,keys,id,'mine'),canShare?itemList(db,keys,id,'inbox'):empty]):[[],empty,empty];
    return {profile,eligibleToShare:Boolean(eligible),canShare,connections:friends,mine:mine.items,inbox:inbox.items,nextMine:mine.nextCursor,nextInbox:inbox.nextCursor};
  };
  const send=(record,status=200)=>json(record,status,privateHeaders);
  const profileId=me.profileId;
  const asset=path.slice(base.length).match(/^\/(profiles|items)\/([a-f\d-]{36})\/photo$/i);
  if(asset && ['GET','HEAD'].includes(request.method)){
    if(!profileId||!uuid.test(asset[2]))unavailable();
    const id=asset[2].toLowerCase(),isProfile=asset[1]==='profiles';
    const row=isProfile?await db.prepare(`SELECT p.photo FROM network_profiles p WHERE p.id=? AND p.photo IS NOT NULL
      AND (p.account_id=? OR (EXISTS(SELECT 1 FROM network_eligible WHERE id=p.id) AND EXISTS(SELECT 1 FROM network_eligible WHERE id=?)
      AND EXISTS(SELECT 1 FROM network_pairs f WHERE low_id=min(p.id,?) AND high_id=max(p.id,?) AND state='friend' AND low_block=0 AND high_block=0)))`)
      .bind(id,identity.id,profileId,profileId,profileId).first():
      await db.prepare(`SELECT i.photo FROM network_items i WHERE i.id=? AND i.photo IS NOT NULL AND (i.owner_id=? OR EXISTS(${activeGrant}))`).bind(id,profileId,profileId).first();
    if(!row)unavailable();
    const photo=request.method==='HEAD'?null:bytes(await open(keys.content,(isProfile?'profile:':'photo:')+id,row.photo));
    return response(photo,200,{...privateHeaders,'Content-Type':'image/jpeg'});
  }
  if(path!==base)unavailable();
  if(request.method==='GET'){
    if(url.searchParams.has('list')){
      const mode=url.searchParams.get('list');
      if(!['mine','inbox'].includes(mode)||[...url.searchParams.keys()].some(k=>!['before','list'].includes(k))||
        url.searchParams.getAll('list').length!==1||url.searchParams.getAll('before').length>1)unavailable();
      if(!profileId||(!me.eligible&&mode==='inbox'))return send({items:[],nextCursor:null});
      const before=await readCursor(keys.receipt,profileId,mode,url.searchParams.get('before'),fail);
      return send(await itemList(db,keys,profileId,mode,null,before));
    }
    if([...url.searchParams.keys()].some(k=>!['q','item'].includes(k))||[...url.searchParams].length>1)unavailable();
    if(url.searchParams.has('q')){
      if(!me.eligible||!me.version)fail(403,'Friend search is available to eligible members with a saved profile.');
      const q=textField(url.searchParams.get('q'),'a display name',48,true);if(q.length<2)fail(400,'Enter at least two letters of a display name.');
      const rows=await db.prepare(`SELECT p.id,p.display_name,p.avatar,COALESCE(f.version,0) AS version FROM network_eligible p
        LEFT JOIN network_pairs f ON f.low_id=min(p.id,?) AND f.high_id=max(p.id,?) WHERE p.listed=1 AND p.id<>?
        AND instr(lower(p.display_name),lower(?))>0 AND COALESCE(f.low_block,0)=0 AND COALESCE(f.high_block,0)=0 AND COALESCE(f.state,'none')='none'
        ORDER BY p.display_name,p.id LIMIT 25`).bind(profileId,profileId,profileId,q).all();
      return send({people:rows.results.map(p=>({...person(p.id,p.display_name,p.avatar,false),version:p.version}))});
    }
    if(url.searchParams.has('item')){
      const id=url.searchParams.get('item');
      if(!uuid.test(id)||!profileId)unavailable();
      const {items:[item]}=await itemList(db,keys,profileId,'one',id.toLowerCase());if(!item)unavailable();
      return send({item});
    }
    return send(await desk());
  }
  if(request.method!=='POST')fail(405,'Open your private member area to make a change.');
  const b=await bodyJson(request,270000),{action,version}=b;
  if(typeof action!=='string'||!Object.hasOwn(fields,action)||Object.keys(b).some(k=>!['action','mutationId',...fields[action]].includes(k)))
    fail(400,'Use the fields shown in your private member area.');
  const asId=value=>{if(typeof value!=='string'||!uuid.test(value))fail(400,'Open the current member form and try again.');return value.toLowerCase();};
  const mutation=asId(b.mutationId),attempt=crypto.randomUUID(),stamp=new Date().toISOString();
  if(action!=='create'&&(!Number.isSafeInteger(version)||version<0))fail(400,'Refresh the member area before saving.');
  const digest=base64(new Uint8Array(await crypto.subtle.sign('HMAC',keys.receipt,utf.encode(JSON.stringify(canonical(b))))));
  const receipt=()=>db.prepare('SELECT actor,digest FROM network_mutations WHERE id=?').bind(mutation).first();
  const same=r=>r&&r.actor===identity.id&&r.digest===digest;
  const prior=await receipt();if(prior){if(!same(prior))conflict();return send(await desk());}
  const privateSpot=action==='create'&&b.pin!=null&&Array.isArray(b.recipients)&&b.recipients.length===0;
  if(action!=='profile'&&action!=='pinStyle'&&!me.version&&!privateSpot)fail(403,'Set up a member profile to use friend sharing.');
  const fresh=`NOT EXISTS(SELECT 1 FROM network_mutations WHERE id=?) AND EXISTS(SELECT 1 FROM member_safeguard_flags WHERE accountId=? AND canUseJournal=1 AND (?=0 OR socialAccess=1))`;
  const access=[mutation,identity.id,Number(action==='pinStyle'||(action==='profile' && b.listed===true))];
  const writes=[];
  let changedTable,created=false,mutationIndex=0;
  if(action==='profile'){
    const name=textField(b.displayName,'your display name',48,true);
    if(name.length<2||/[\r\n@]/.test(name))fail(400,'Use a display name of at least two characters without an email address.');
    if(typeof b.avatarId!=='string'||!/^angler-(?:0[1-9]|[12]\d|3[0-6])$/.test(b.avatarId)||typeof b.listed!=='boolean')fail(400,'Choose an avatar and directory preference.');
    if(b.listed&&!me.eligible)fail(403,'This membership can keep its profile private.');
    const id=profileId||crypto.randomUUID(),replace=Object.hasOwn(b,'photo'),clean=replace?jpeg(b.photo,fail):null;
    const photo=clean?await seal(keys.content,'profile:'+id,clean):null;
    if(!profileId && version!==0)conflict();
    changedTable='network_profiles';created=!me.version;
    writes.push(!profileId?db.prepare(`INSERT INTO network_profiles(id,account_id,display_name,avatar,listed,photo,version,mutation)
      SELECT ?,?,?,?,?,?,1,? WHERE ${fresh} ON CONFLICT(account_id) DO NOTHING`).bind(id,identity.id,name,b.avatarId,+b.listed,photo,attempt,...access):
      db.prepare(`UPDATE network_profiles SET display_name=?,avatar=?,listed=?,photo=CASE WHEN ? THEN ? ELSE photo END,version=version+1,mutation=?
        WHERE id=? AND version=? AND ${fresh}`).bind(name,b.avatarId,+b.listed,+replace,photo,attempt,id,version,...access));
  }else if(action==='pinStyle'){
    if(!me.eligible)fail(403,'Check your exact map pin access before changing a symbol.');
    if(!isPinStyle(b.style))fail(400,'Choose a symbol from the pin list.');
    const id=asId(b.id);
    const owned=await db.prepare('SELECT content,version FROM network_items WHERE id=? AND owner_id=?').bind(id,profileId).first();
    if(!owned)unavailable();
    if(owned.version!==version)conflict();
    const item=JSON.parse(await open(keys.content,'item:'+id,owned.content));
    if(!item.pin)fail(400,'Choose a saved spot with a map pin.');
    item.pin.style=b.style;
    const cipher=await seal(keys.content,'item:'+id,JSON.stringify(item));
    changedTable='network_items';
    writes.push(db.prepare(`UPDATE network_items SET content=?,version=version+1,mutation=? WHERE id=? AND owner_id=? AND version=? AND ${fresh}`)
      .bind(cipher,attempt,id,profileId,version,...access));
  }else if(relationships.includes(action)){
    if(!me.eligible)fail(403,'Private friend connections are unavailable for this membership.');
    const peer=asId(b.peerId);if(peer===profileId)fail(400,'Choose another member.');
    const [low,high]=[profileId,peer].sort(),mine=low===profileId?'low_block':'high_block',theirs=low===profileId?'high_block':'low_block';
    const pair=await db.prepare(`SELECT n.listed,f.state,f.requester,f.version,f.low_block,f.high_block FROM network_eligible n
      LEFT JOIN network_pairs f ON f.low_id=? AND f.high_id=? WHERE n.id=?`).bind(low,high,peer).first();
    if(!pair||(!pair.listed&&(!pair.version||pair.state==='none')&&!pair[mine])|| (pair[theirs]&&!pair[mine]))unavailable();
    if((pair.version||0)!==version)conflict();
    let state=pair.state||'none',requester=pair.requester,blocked=pair[mine]||0;
    if(action==='request'){
      if(!pair.listed||state!=='none'||blocked||pair[theirs])conflict();state='pending';requester=profileId;
    }else if(action==='accept'){
      if(state!=='pending'||requester!==peer||blocked||pair[theirs])conflict();state='friend';requester=null;
    }else if(action==='remove'){
      if(state==='none'||blocked||pair[theirs])conflict();state='none';requester=null;
    }else if(action==='block'){
      if(blocked)conflict();blocked=1;state='none';requester=null;
    }else{
      if(!blocked)conflict();blocked=0;state='none';requester=null;
    }
    changedTable='network_pairs';
    writes.push(db.prepare(`INSERT INTO network_pairs(low_id,high_id,state,requester,${mine},version,mutation)
      SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM network_eligible WHERE id IN (?,?))=2
      AND (?=0 OR EXISTS(SELECT 1 FROM network_eligible WHERE id=? AND listed=1)) AND ${fresh}
      ON CONFLICT(low_id,high_id) DO UPDATE SET state=excluded.state,requester=excluded.requester,${mine}=excluded.${mine},
      version=excluded.version,mutation=excluded.mutation WHERE network_pairs.version=?`)
      .bind(low,high,state,requester,blocked,version+1,attempt,low,high,+(action==='request'),peer,...access,version));
    if(action==='remove'||action==='block')writes.push(db.prepare(`UPDATE network_recipients SET revoked_at=?
      WHERE revoked_at IS NULL AND EXISTS(SELECT 1 FROM network_pairs WHERE mutation=?) AND EXISTS (
        SELECT 1 FROM network_items i WHERE i.id=network_recipients.item_id AND
        ((i.owner_id=? AND peer_id=?) OR (i.owner_id=? AND peer_id=?)))`).bind(stamp,attempt,profileId,peer,peer,profileId));
  }else{
    const id=asId(b.id);
    const requested=action==='revoke'?[]:b.recipients;
    if(!Array.isArray(requested)||requested.length>20)fail(400,'Choose up to twenty friends.');
    const selected=[...new Set(requested.map(asId))];
    if(selected.length!==requested.length||selected.includes(profileId))fail(400,'Choose each friend once.');
    if(action==='grant'&&!selected.length)fail(400,'Choose at least one friend for this share.');
    if(selected.length&&!me.eligible)fail(403,'This membership can save privately.');
    if(action!=='revoke'&&(typeof b.duration!=='string'||!Object.hasOwn(durations,b.duration)))fail(400,'Choose how long friends can see this share.');
    const encoded=JSON.stringify(selected),expires=durations[b.duration]?new Date(Date.now()+durations[b.duration]*86400000).toISOString():null;
    const friends=`(SELECT count(*) FROM json_each(?) j JOIN network_eligible n ON n.id=j.value JOIN network_pairs f
      ON f.low_id=min(?,n.id) AND f.high_id=max(?,n.id) WHERE f.state='friend' AND f.low_block=0 AND f.high_block=0
      AND EXISTS(SELECT 1 FROM network_eligible WHERE id=?))=?`;
    const audience=[encoded,profileId,profileId,profileId,selected.length];
    changedTable='network_items';
    if(action==='create'){
      const title=textField(b.title,'the name of this entry',120,true),message=textField(b.message,'your note',2000);
      let pin=null,catchData=null;
      if(b.pin!=null){
        if(!me.eligible)fail(403,'Precise pins are unavailable for this membership.');
        const {latitude,longitude,label}=b.pin;
        if(typeof b.pin!=='object'||Array.isArray(b.pin)||Object.keys(b.pin).some(k=>!['latitude','longitude','label','style'].includes(k))||
          (Object.hasOwn(b.pin,'style')&&!isPinStyle(b.pin.style))||
          !Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)fail(400,'Check both map coordinates.');
        pin={latitude,longitude,label:textField(label,'the pin name',100),...(b.pin.style?{style:b.pin.style}:{})};
      }
      if(b.catchId){
        catchData=await db.prepare('SELECT species,length_cm AS lengthCm,caught_on AS date FROM catches WHERE id=? AND owner_id=?').bind(asId(b.catchId),identity.id).first();
        if(!catchData)unavailable();
      }
      const clean=jpeg(b.photo,fail),photo=clean?await seal(keys.content,'photo:'+id,clean):null;
      const content=await seal(keys.content,'item:'+id,JSON.stringify({title,message,pin,catch:catchData}));
      // A first private pin needs an owner for its encrypted contents. The unnamed,
      // unlisted owner is never advertised and gains no friend capabilities.
      if(!profileId){
        writes.push(db.prepare(`INSERT INTO network_profiles(id,account_id,display_name,avatar,listed,version,mutation)
          SELECT ?,?,'','angler-01',0,0,? WHERE ${fresh} AND NOT EXISTS(SELECT 1 FROM network_items WHERE id=?)
          ON CONFLICT(account_id) DO NOTHING`).bind(crypto.randomUUID(),identity.id,attempt,mutation,identity.id,1,id));
        mutationIndex=writes.length;
      }
      writes.push(db.prepare(`INSERT INTO network_items(id,owner_id,content,photo,created_at,mutation)
        SELECT ?,p.id,?,?,?,? FROM network_profiles p WHERE p.account_id=? AND ${fresh} AND ${friends}
        AND (?=0 OR EXISTS(SELECT 1 FROM network_eligible WHERE id=p.id)) ON CONFLICT(id) DO NOTHING`)
        .bind(id,content,photo,stamp,attempt,identity.id,...access,...audience,+Boolean(pin)));
      created=true;
    }else{
      const owned=await db.prepare('SELECT version FROM network_items WHERE id=? AND owner_id=?').bind(id,profileId).first();
      if(!owned)unavailable();
      writes.push(db.prepare(`UPDATE network_items SET version=version+1,mutation=? WHERE id=? AND owner_id=? AND version=? AND ${fresh} AND ${friends}`)
        .bind(attempt,id,profileId,version,...access,...audience));
    }
    if(action==='revoke'){
      const peer=b.peerId==null?null:asId(b.peerId);
      writes.push(db.prepare(`UPDATE network_recipients SET revoked_at=? WHERE item_id=? AND revoked_at IS NULL AND (? IS NULL OR peer_id=?)
        AND EXISTS(SELECT 1 FROM network_items WHERE id=? AND mutation=?)`).bind(stamp,id,peer,peer,id,attempt));
    }else if(selected.length){
      writes.push(db.prepare(`INSERT INTO network_recipients(item_id,peer_id,expires_at,revoked_at) SELECT ?,value,?,NULL FROM json_each(?)
        WHERE EXISTS(SELECT 1 FROM network_items WHERE id=? AND mutation=?) ON CONFLICT(item_id,peer_id)
        DO UPDATE SET expires_at=excluded.expires_at,revoked_at=NULL`).bind(id,expires,encoded,id,attempt));
    }
  }
  writes.push(db.prepare(`INSERT INTO network_mutations SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM ${changedTable} WHERE mutation=?)`)
    .bind(mutation,identity.id,digest,stamp,attempt));
  const saved=await db.batch(writes);
  if(!saved[mutationIndex].meta.changes && !same(await receipt()))conflict();
  return send(await desk(),created&&saved[mutationIndex].meta.changes?201:200);
}
