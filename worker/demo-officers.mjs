const demoCookie='__Host-sandy_demo', sessionCookie='__Host-sandy_session';
const publicReads=new Set(['/api/club','/api/fishing','/api/conditions','/api/tides','/api/shop/catalogue','/api/shop/offers','/api/fees']);
const expiration=name=>name+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const gone=()=>json({error:'Officer practice sign-in has closed. Use your own club username and password.',code:'officer_demo_retired'},410);

function expireCookies(response,clearReal) {
  const headers=new Headers(response.headers);
  headers.append('Set-Cookie',expiration(demoCookie));
  if(clearReal) headers.append('Set-Cookie',expiration(sessionCookie));
  return new Response(response.body,{status:response.status,headers});
}

// A previous rehearsal could be open over a private session on a shared computer.
// Require fresh credentials before showing an officer or member workspace in that browser.
export async function retireOfficerDemo(request,env,serve) {
  const path=new URL(request.url).pathname;
  const cookies=(request.headers.get('Cookie')||'').split(';').map(field=>field.trim().split('=')[0]);
  const legacy=cookies.includes(demoCookie), real=cookies.includes(sessionCookie);
  if(path==='/api/demo/login') return legacy?expireCookies(gone(),real):gone();
  if(path==='/api/demo/logout') return legacy?expireCookies(json({ok:true}),real):json({ok:true});
  if(!legacy || !path.startsWith('/api/')) return serve(request,env);
  if((request.method==='GET'||request.method==='HEAD') && publicReads.has(path)) return serve(request,env);
  if(request.method==='POST' && (path==='/api/auth/login'||path==='/api/auth/activate'||path==='/api/auth/invitation')) {
    const headers=new Headers(request.headers);
    headers.delete('Cookie');
    const result=await serve(new Request(request,{headers}),env);
    return expireCookies(result,real && !result.headers.has('Set-Cookie'));
  }
  if(path==='/api/session' && request.method==='GET') {
    return expireCookies(json({authenticated:false,identity:null,role:'anonymous',accountRole:null,storageReady:false,administrator:false,canManageStock:false,paidThrough:null}),real);
  }
  if(path==='/api/auth/logout' && request.method==='POST') return expireCookies(json({ok:true}),real);
  return expireCookies(json({error:'Please sign in with your club account.',code:'sign_in_required'},401),real);
}

// Retain the deployed class name and the original expiry callback for existing rooms.
export class OfficerDemoRoom {
  constructor(ctx){this.storage=ctx.storage;}
  fetch(){return gone();}
  async alarm(){await this.storage.deleteAll();}
}
