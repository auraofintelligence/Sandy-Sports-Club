import {canJoinConversation} from './applications.mjs';

function cleanPhoto(value,HttpError) {
  if(value==null || value==='')return null;
  const bad=()=>{throw new HttpError(400,'Choose a smaller photo that the club can read.','invalid_photo');};
  if(typeof value!=='string'||value.length>250000||!/^data:image\/jpeg;base64,[a-zA-Z0-9+/]+={0,2}$/.test(value))bad();
  let raw;try{raw=atob(value.slice(23));}catch{bad();}
  if(raw.slice(0,2)!=='\xff\xd8'||raw.slice(-2)!=='\xff\xd9')bad();
  // Keep image segments and remove application metadata, comments and GPS tags.
  let i=2,parts=[raw.slice(0,2)],dimensions=false;
  while(i+4<=raw.length && raw.charCodeAt(i)===255){
    const marker=raw.charCodeAt(i+1);
    if(marker===218 && dimensions){parts.push(raw.slice(i));return btoa(parts.join(''));}
    const len=raw.charCodeAt(i+2)*256+raw.charCodeAt(i+3);
    if(len<2||i+2+len>raw.length)bad();
    if(marker===192||marker===194){
      const h=raw.charCodeAt(i+5)*256+raw.charCodeAt(i+6),w=raw.charCodeAt(i+7)*256+raw.charCodeAt(i+8);
      if(!h||!w||h>2000||w>2000)bad();dimensions=true;
    }
    if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(raw.slice(i,i+len+2));
    i+=len+2;
  }
  bad();
}

export async function communityEndpoint(request,env,identity,{requireRole,requireDb,HttpError,bodyJson,textField,json,response}) {
  requireRole(identity,['member','committee']);
  const db=requireDb(env),url=new URL(request.url),path=url.pathname;
  if(!await canJoinConversation(db,identity)) throw new HttpError(403,'Club conversation is available to members in the verified 16+ group who have accepted the social terms. Club notices are in your calendar.','conversation_review');
  const photo=path.match(/^\/api\/community\/([\w-]{36})\/photo$/);
  if(photo && ['GET','HEAD'].includes(request.method)){
    const result=await db.prepare('SELECT photo FROM community_posts WHERE id=? AND removed=0 AND photo IS NOT NULL').bind(photo[1]).first();
    if(!result)throw new HttpError(404,'This photo is unavailable.','not_found');
    const headers={'Content-Type':'image/jpeg','Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
    return response(request.method==='HEAD'?null:Uint8Array.from(atob(result.photo),c=>c.charCodeAt(0)),200,headers);
  }
  if (path!=='/api/community')throw new HttpError(404,'Conversation unavailable.','not_found');
  if(request.method==='GET'){
    const posts=await db.prepare(`WITH recent AS (SELECT id FROM community_posts WHERE parent_id IS NULL ORDER BY created_at DESC LIMIT 40)
      SELECT id,parent_id AS parentId,CASE WHEN removed=0 THEN author_name ELSE '' END AS author,
      CASE WHEN removed=0 THEN message ELSE '' END AS message,(photo IS NOT NULL AND removed=0) AS hasPhoto,
      created_at AS createdAt,removed,(author_id=? OR ?=1) AS canRemove FROM community_posts
      WHERE id IN recent OR parent_id IN recent ORDER BY created_at DESC LIMIT 400`).bind(identity.id,identity.role==='committee'?1:0).all();
    return json({posts:posts.results});
  }
  if(!['POST','DELETE'].includes(request.method))throw new HttpError(405,'Action unavailable.','method_not_allowed');
  const data=await bodyJson(request,270000);
  const id=String(data.id||'');
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw new HttpError(400,'Reopen the message form.','invalid_id');
  if(request.method==='DELETE'){
    const result=await db.batch([db.prepare("UPDATE community_posts SET removed=1,photo=NULL,message='',author_name='' WHERE id=? AND removed=0 AND (author_id=? OR ?=1)").bind(id,identity.id,identity.role==='committee'?1:0),
      db.prepare("INSERT INTO audit_log SELECT ?,?,?,'community_post_removed',?,? WHERE changes()=1").bind(crypto.randomUUID(),identity.id,identity.role,id,new Date().toISOString())]);
    if(!result[0].meta.changes)throw new HttpError(404,'This message is unavailable.','not_found');
    return json({ok:true});
  }
  const text=textField(data.message,'your message',1200);
  const author=textField(data.author,'a display name',48,true);
  const parent=data.parentId?String(data.parentId):null, image=cleanPhoto(data.photo,HttpError);
  if(!text && !image)throw new HttpError(400,'Write a message or add a photo.','empty_post');
  const incoming=[id,parent,identity.id,author,text,image,new Date().toISOString()];
  const authorGate=identity.role==='committee'?'1':`EXISTS(SELECT 1 FROM member_safeguard_flags WHERE accountId=? AND socialAccess=1)`;
  const authorArgs=identity.role==='committee'?[]:[identity.id];
  const result=await db.prepare(`INSERT INTO community_posts(id,parent_id,author_id,author_name,message,photo,created_at)
    SELECT ?,?,?,?,?,?,? WHERE (? IS NULL OR EXISTS(SELECT 1 FROM community_posts WHERE id=? AND parent_id IS NULL AND removed=0))
    AND ${authorGate} AND (SELECT COUNT(*) FROM community_posts WHERE author_id=? AND created_at>?)<60 ON CONFLICT(id) DO NOTHING`).bind(...incoming,parent,parent,...authorArgs,identity.id,new Date(Date.now()-3600000).toISOString()).run();
  if(!result.meta.changes){
    const existing=await db.prepare('SELECT author_id,parent_id,message FROM community_posts WHERE id=?').bind(id).first();
    if(existing?.author_id===identity.id && existing.parent_id===parent && existing.message===text)return json({id});
    throw new HttpError(409,'This conversation changed, or your posting limit was reached. Refresh before trying again.','post_unavailable');
  }
  return json({id},201);
}
