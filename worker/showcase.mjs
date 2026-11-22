import {passwordIdentity,accountEndpoint} from './accounts.mjs';

// Showcase accounts and their sessions live in a separate database. Never fall
// back to the real database when a showcase session is present.
const realCookie='__Host-sandy_session', demoCookie='__Host-sandy_showcase';
const encoder=new TextEncoder();
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const cookieValue=(req,name)=>(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
function demoRequest(req) {
  const headers=new Headers(req.headers), value=cookieValue(req,demoCookie);
  headers.delete('cookie');
  if(value) headers.set('cookie',realCookie+'='+value);
  return new Request(req,{headers});
}
function demoResponse(res) {
  const headers=new Headers(res.headers), value=headers.get('set-cookie');
  if(value) headers.set('set-cookie',value.replace(realCookie+'=',demoCookie+'='));
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
}
function demoEnvironment(env,HttpError) {
  if (!env.SHOWCASE_DB || !env.SHOWCASE_AUTH_KEY)
    throw new HttpError(503,'The view-only demonstration space is not ready yet.','setup_required');
  return {...env,DB:env.SHOWCASE_DB,PRIVATE_AUTH_KEY:env.SHOWCASE_AUTH_KEY,SHOWCASE_READ_ONLY:true};
}
export async function showcase(request,env,serve,helpers) {
  const path=new URL(request.url).pathname;
  const {json,bodyJson,HttpError}=helpers;
  const fail=(status,message,code)=>{throw new HttpError(status,message,code);};
  if(path==='/api/showcase/invite') {
    const identity=await passwordIdentity(request,env);
    if(cookieValue(request,demoCookie)||!identity?.administrator) fail(403,'Only the Webmaster can create demonstration invitations.','not_authorised');
    if(request.method!=='POST') fail(405,'Use the invitation form.','method_not_allowed');
    demoEnvironment(env,HttpError);
    const data=await bodyJson(request), keyword=String(data.keyword||'').trim().toLowerCase();
    if(!/^[a-z0-9][a-z0-9-]{1,30}$/.test(keyword)) fail(400,'Use 2 to 31 letters, numbers or hyphens for the club keyword.','invalid_input');
    const login='webmaster-demo-'+keyword, secret=token(), hash=await digest(secret), now=Math.floor(Date.now()/1000);
    const existing=await env.SHOWCASE_DB.prepare('SELECT id FROM club_accounts WHERE login=?').bind(login).first();
    if(existing) fail(409,'That demonstration login already exists. Choose another keyword.','login_taken');
    await env.SHOWCASE_DB.batch([
      env.SHOWCASE_DB.prepare('DELETE FROM club_invites WHERE login=? AND used_by IS NULL').bind(login),
      env.SHOWCASE_DB.prepare("INSERT INTO club_invites(digest,login,role,created_by,expires) VALUES(?,?,'administrator','showcase',?)").bind(hash,login,now+7*86400)
    ]);
    return json({login,token:secret,expires:now+7*86400},201);
  }
  if(path.startsWith('/api/showcase/auth/')) {
    const demoEnv=demoEnvironment(env,HttpError);
    const action=path.slice('/api/showcase/auth/'.length);
    if(!['invitation','activate','login','logout'].includes(action)) fail(404,'This service was not found.','not_found');
    const result=await accountEndpoint('/api/auth/'+action,demoRequest(request),demoEnv,helpers);
    const response=demoResponse(result);
    if(response.ok && ['login','activate'].includes(action)) response.headers.append('Set-Cookie',realCookie+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
    return response;
  }
  if(!cookieValue(request,demoCookie)) return serve(request,env);
  if(!env.SHOWCASE_DB || !env.SHOWCASE_AUTH_KEY) return json({error:'The demonstration space is unavailable.',code:'setup_required'},503);
  const demoEnv=demoEnvironment(env,HttpError);
  const req=demoRequest(request), identity=await passwordIdentity(req,demoEnv);
  if(!identity) return json({error:'Your demonstration session has expired. Please sign in again.',code:'sign_in_required'},401,{'Set-Cookie':demoCookie+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'});
  if(path==='/api/auth/logout'&&request.method==='POST') return demoResponse(await accountEndpoint(path,req,demoEnv,helpers));
  if(!['GET','HEAD'].includes(request.method)) return json({error:'This is a view-only demonstration. Changes are not available here.',code:'showcase_read_only'},403);
  // Do not allow a showcase viewer to access the invitation or account list.
  if(path.startsWith('/api/accounts')||path.startsWith('/api/auth/')||path.startsWith('/api/showcase/')) return json({error:'This is a view-only demonstration.',code:'showcase_read_only'},403);
  const result=await serve(req,demoEnv);
  if(path==='/api/session' && result.ok) {
    const body=await result.json();
    return json({...body,showcase:true,readOnly:true});
  }
  return result;
}
