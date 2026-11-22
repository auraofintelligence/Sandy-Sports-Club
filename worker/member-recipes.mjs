import {privateAreaKeys,sealPrivateText,openPrivateText,sanitiseClubJpeg} from './member-network.mjs';
import {memberSafeguardFlags} from './member-safeguards.mjs';

const base='/api/member/recipes';
const privateHeaders={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const allowed='EXISTS(SELECT 1 FROM member_safeguard_flags WHERE accountId=? AND socialAccess=1)';
const visible='(r.owner_id=? OR (r.published=1 AND EXISTS(SELECT 1 FROM member_safeguard_flags WHERE accountId=r.owner_id AND socialAccess=1)))';
export const recipeKeyArea='Sandy Sports Club members recipe book v1';

export async function memberRecipesEndpoint(request,env,identity,h){
  h.requireRole(identity,['member','committee']);
  const store=h.requireDb(env),db=store.withSession?.('first-primary')||store;
  const fail=(status,msg)=>{throw new h.HttpError(status,msg,'recipe_book');};
  const officer=identity.role==='committee',owner=identity.id;
  if(!officer && !(await memberSafeguardFlags(db,owner)).socialAccess)
    fail(403,'Member recipe sharing opens once your 16+ age group and current sharing agreement are confirmed.');
  if(!env.PRIVATE_AUTH_KEY)fail(503,'Private recipe storage is temporarily unavailable.');
  const {content:key,receipt}=await privateAreaKeys(env.PRIVATE_AUTH_KEY,recipeKeyArea);
  const url=new URL(request.url),part=url.pathname.slice(base.length);
  const reader='(?=1 OR '+allowed+')',viewer=[+officer,owner];
  if(part){
    const photoId=part.slice(1);if(!uuid.test(photoId)||!['GET','HEAD'].includes(request.method))fail(404,'Photo unavailable.');
    const result=await db.prepare('SELECT '+(request.method==='GET'?'p.content':'1 AS present')+' FROM member_recipe_photos p JOIN member_recipes r ON r.id=p.recipe_id WHERE p.id=? AND '+visible+' AND '+reader)
      .bind(photoId,owner,...viewer).first();
    if(!result)fail(404,'Photo unavailable.');
    const photo=request.method==='GET'?Uint8Array.from(atob(await openPrivateText(key,'recipe-photo:'+photoId,result.content)),c=>c.charCodeAt(0)):null;
    return h.response(photo,200,{...privateHeaders,'Content-Type':'image/jpeg'});
  }
  if(request.method==='GET'){
    const before=url.searchParams.get('before');
    if(before&&!uuid.test(before))fail(400,'Open the next page from the recipe book.');
    const where=before?' AND (r.created,r.id)<(SELECT created,id FROM member_recipes WHERE id=?)':'';
    const rows=(await db.prepare('SELECT r.id,r.content,r.created,r.version,r.published,(r.owner_id=?) AS own FROM member_recipes r WHERE '+visible+' AND '+reader+where+' ORDER BY r.created DESC,r.id DESC LIMIT 13')
      .bind(owner,owner,...viewer,...(before?[before]:[])).all()).results;
    const page=rows.slice(0,12);
    const photos=page.length?(await db.prepare('SELECT p.id,p.recipe_id,p.slot FROM member_recipe_photos p JOIN member_recipes r ON r.id=p.recipe_id WHERE '+visible+' AND '+reader+' AND r.id IN ('+page.map(()=>'?').join(',')+') ORDER BY p.slot').bind(owner,...viewer,...page.map(r=>r.id)).all()).results:[];
    const recipes=await Promise.all(page.map(async({content,own,published,...r})=>({...JSON.parse(await openPrivateText(key,'recipe:'+r.id,content)),...r,own:!!own,published:!!published,
      photos:photos.filter(p=>p.recipe_id===r.id).map(p=>({slot:p.slot,url:base+'/'+p.id}))})));
    return h.json({recipes,next:rows.length>12?page.at(-1).id:null,canShare:!officer},200,privateHeaders);
  }
  if(request.method!=='POST')fail(405,'Use the recipe form to make a change.');
  const body=await h.bodyJson(request,1025000);
  const {id,version,action}=body;
  if(typeof id!=='string'||!uuid.test(id)||!Number.isSafeInteger(version)||version<0)fail(400,'Reopen this recipe and try again.');
  if(action==='remove'){
    const permitted='id=? AND version=? AND (owner_id=? OR ?=1) AND '+reader;
    const args=[id,version,owner,+officer,...viewer];
    const [,deleted]=await db.batch([
      db.prepare('DELETE FROM member_recipe_photos WHERE recipe_id IN (SELECT id FROM member_recipes WHERE '+permitted+')').bind(...args),
      db.prepare('DELETE FROM member_recipes WHERE '+permitted).bind(...args)
    ]);
    if(!deleted.meta.changes)fail(409,'This recipe has changed or is unavailable.');
    return h.json({removed:true},200,privateHeaders);
  }
  if(officer)fail(403,'Use your individual member sign-in to share a recipe.');
  if(action!=='save'||!Array.isArray(body.photos)||body.photos.length>4)fail(400,'Choose up to four photos for this recipe.');
  const details={};
  for(const [field,max] of [['title',100],['ingredients',2500],['method',4500],['byline',65]]){
    const value=body[field]??'';
    if(typeof value!=='string'||value.trim().length>max||(!value.trim()&&field!=='byline'))fail(400,'Check the recipe title, ingredients, method and name.');
    details[field]=value.trim();
  }
  details.byline||='Club member';
  const bytes=new TextEncoder().encode(JSON.stringify([owner,id,version,details,body.photos]));
  const digest=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',receipt,bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const own=()=>db.prepare('SELECT version,request_digest FROM member_recipes WHERE id=? AND owner_id=?').bind(id,owner).first();
  const current=await own();
  if(current?.request_digest===digest&&current.version===version+1)return h.json({id,version:current.version},200,privateHeaders);
  if((current?.version??0)!==version)fail(409,'This recipe has changed. Reopen it before editing.');
  const old=current?(await db.prepare('SELECT id,slot,content FROM member_recipe_photos WHERE recipe_id=? ORDER BY slot').bind(id).all()).results:[];
  const retained=new Set(),photos=[];
  for(const input of body.photos){
    if(Number.isInteger(input)){
      const existing=old.find(p=>p.slot===input);
      if(!existing||retained.has(input))fail(400,'Choose each saved photo only once.');
      retained.add(input);photos.push(existing);continue;
    }
    if(typeof input!=='string'||!input)fail(400,'Choose a valid photo.');
    const jpeg=sanitiseClubJpeg(input,fail);
    if(!jpeg)fail(400,'Choose a valid JPEG photo.');
    const photoId=crypto.randomUUID();
    photos.push({id:photoId,content:await sealPrivateText(key,'recipe-photo:'+photoId,jpeg)});
  }
  const token=crypto.randomUUID(),content=await sealPrivateText(key,'recipe:'+id,JSON.stringify(details));
  const write=version===0?db.prepare('INSERT INTO member_recipes(id,owner_id,content,version,write_token,request_digest,created) SELECT ?,?,?,1,?,?,? WHERE '+allowed+' ON CONFLICT(id) DO NOTHING')
    .bind(id,owner,content,token,digest,new Date().toISOString(),owner):db.prepare('UPDATE member_recipes SET content=?,version=version+1,published=1,write_token=?,request_digest=? WHERE id=? AND owner_id=? AND version=? AND '+allowed)
    .bind(content,token,digest,id,owner,version,owner);
  const guard='EXISTS(SELECT 1 FROM member_recipes WHERE id=? AND owner_id=? AND write_token=?)';
  const batch=[write,db.prepare('DELETE FROM member_recipe_photos WHERE recipe_id=? AND '+guard).bind(id,id,owner,token)];
  for(const [slot,p] of photos.entries())batch.push(db.prepare('INSERT INTO member_recipe_photos(id,recipe_id,slot,content) SELECT ?,?,?,? WHERE '+guard).bind(p.id,id,slot,p.content,id,owner,token));
  const [result]=await db.batch(batch);
  if(!result.meta.changes && (await own())?.request_digest!==digest)fail(409,'Your recipe or sharing permission changed. Reopen the page.');
  return h.json({id,version:version+1},version===0?201:200,privateHeaders);
}
