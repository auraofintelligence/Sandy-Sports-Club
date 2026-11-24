// Sandy Sports server-only utilities. Not a public-browser module.
export const STAFF=['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'];
export const APPROVERS=['webmaster','president','secretary'];
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export class ApiError extends Error{
 constructor(status,message,code='request_failed'){super(message);this.status=status;this.code=code}
}
export const fail=(status,message,code)=>{throw new ApiError(status,message,code)};
export const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
export const now=()=>new Date().toISOString();
export const epoch=()=>Math.floor(Date.now()/1000);
export const id=()=>crypto.randomUUID();
export const dbFor=env=>{
 if(!env.DB?.prepare)fail(503,'Shared Sandy database is not configured. No committee data was saved.','database_unavailable');
 return env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
};
export const staff=identity=>Boolean(identity&&STAFF.includes(identity.role));
export function requireRole(identity,roles=STAFF){
 if(!identity)fail(401,'Sign in to access shared club records.','login_required');
 if(identity.role==='webmaster'&&roles.includes('webmaster'))return identity;
 if(!roles.includes(identity.role))fail(403,'Your account cannot access this record.','forbidden');
 return identity;
}
export function ensureMemberData(identity){
 requireRole(identity,['webmaster','president','secretary','assistant_secretary','treasurer']);
}
export function ensureWriter(identity){
 requireRole(identity,STAFF);
}
export function ensureApprover(identity,env){
 requireRole(identity,APPROVERS);
 if(env.SANDY_CLUB_APPROVALS!=='enabled')fail(409,'Formal club approval is disabled until the club has lawful governing authority. Record a proposal instead.','club_not_established');
}
export async function payload(req,max=65536){
 const size=Number(req.headers.get('content-length')||0);
 if(size>max)fail(413,'The submission is too large.','too_large');
 const type=req.headers.get('content-type')||'';
 if(!type.toLowerCase().includes('application/json'))fail(415,'Send a JSON request.','invalid_content_type');
 const raw=await req.text();
 if(raw.length>max)fail(413,'The submission is too large.','too_large');
 try{
  const obj=JSON.parse(raw);
  if(obj===null||typeof obj!=='object'||Array.isArray(obj))throw Error('invalid JSON');
  return obj;
 }catch{fail(400,'The request body must be a JSON object.','invalid_json')}
}
export const field=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
export function dateField(value,nullable=true){
 const s=field(value,10);
 if(!s&&nullable)return null;
 if(!/^20\d\d-(0[1-9]|1[0-2])-[0-3]\d$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z'))||
   new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)
  fail(400,'Enter a valid YYYY-MM-DD date.','invalid_date');
 return s;
}
export const bool=x=>x===true||x===1;
export const https=x=>{
 const s=field(x,700);
 if(!s)return '';
 try{const url=new URL(s);if(url.protocol!=='https:')throw Error('insecure');return url.href}catch{fail(400,'Use a valid HTTPS link.','invalid_url')}
};
export function version(value){
 if(!Number.isInteger(value)||value<0||value>2147483000)fail(400,'Refresh the record before saving its current version.','invalid_version');
 return value;
}
export function verifySameOrigin(req){
 const origin=req.headers.get('origin'),url=new URL(req.url);
 if(origin!==url.origin)fail(403,'This change must come from the Sandy Sports website.','origin_required');
}
export function changeSummary(before,after){
 const changes=[];for(const k of new Set([...Object.keys(before||{}),...Object.keys(after||{})]))
  if(JSON.stringify(before?.[k])!==JSON.stringify(after?.[k]))changes.push(k);
 return {fields:changes.slice(0,40),count:changes.length};
}
export function revision(db,{kind,resourceId,resourceVersion,action,actor,at,snapshot,changes={},guarded=false}){
 const sql='INSERT INTO club_revisions(id,resource_kind,resource_id,resource_version,operation,actor_id,actor_role,actor_office,at_utc,changes_json,snapshot_json) '+
  'SELECT ?,?,?,?,?,?,?,?,?,?,?'+(guarded?' WHERE changes()=1':'');
 return db.prepare(sql).bind(id(),kind,resourceId,resourceVersion,action,actor.id,actor.role,actor.office_label||actor.role,at,
  JSON.stringify(changes),JSON.stringify(snapshot));
}
export function audit(db,identity,action,kind,resourceId,at,guarded=false){
 const sql='INSERT INTO club_audit(id,actor_id,actor_role,action,resource_kind,resource_id,occurred_utc,context_json) '+
   "SELECT ?,?,?,?,?,?,?,'{}'"+(guarded?' WHERE changes()=1':'');
 return db.prepare(sql).bind(id(),identity.id,identity.role,action,kind,resourceId,at);
}
