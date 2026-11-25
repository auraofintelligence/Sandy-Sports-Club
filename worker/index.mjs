// Sandy Sports shared club backend. Deploy only after NEW D1 binding and auth
// secrets have been provisioned; this is separate from PLFC's live database.
import {ApiError,json,verifySameOrigin} from './shared.mjs';
import {identityFor,authEndpoint} from './auth.mjs';
import {peopleEndpoint,interestEndpoint} from './people.mjs';
import {recordsEndpoint} from './records.mjs';
import {socialEndpoint} from './social.mjs';
import {briefsEndpoint,auditEndpoint} from './briefs.mjs';
import {memberEndpoint} from './member.mjs';
import {suiteEndpoint} from './suite.mjs';
import {memberWorkspaceEndpoint} from './member-workspace.mjs';
import {helpEndpoint} from './help.mjs';
import {viewMode} from './view-mode.mjs';
import {safeguardsEndpoint} from './member-safeguards.mjs';
import {libraryEndpoint} from './library.mjs';

const defaults={
 'Cache-Control':'no-store, private',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Cross-Origin-Resource-Policy':'same-origin',
 'X-Frame-Options':'DENY'
};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{...defaults,'Content-Type':'application/json; charset=utf-8'}
});
function safePath(req){
 const url=new URL(req.url);
 if(url.pathname.length>300)throw new ApiError(414,'This endpoint path is too long.','invalid_path');
 return url.pathname;
}
async function handle(req,env){
 const path=safePath(req);
 if(!path.startsWith('/api/'))return env.ASSETS?.fetch(req)||new Response('Static assets not configured.',{status:503});
 if(!['GET','POST','PATCH','HEAD'].includes(req.method))throw new ApiError(405,'That method is not supported.','method_not_allowed');
 if(!['GET','HEAD'].includes(req.method))verifySameOrigin(req);
 return viewMode(req,env,path,route);
}
async function route(req,env,path,effectiveIdentity){
 if(path==='/api/public-config'&&req.method==='GET')
  return respond({clubEstablished:env.SANDY_CLUB_APPROVALS==='enabled',
   publicInterestReady:Boolean(env.DB?.prepare&&env.SANDY_TURNSTILE_SECRET&&env.SANDY_TURNSTILE_SITE_KEY),
   turnstileSiteKey:env.SANDY_TURNSTILE_SITE_KEY||null,invitationSendingEnabled:false});
 if(path==='/api/health'&&req.method==='GET')
  return respond({service:'sandy-club',storageConfigured:Boolean(env.DB?.prepare),
   authConfigured:Boolean(env.SANDY_AUTH_PEPPER?.length>=32),operationalApprovals:env.SANDY_CLUB_APPROVALS==='enabled',
   livePublishing:false,smsEnabled:false,paymentsEnabled:false});
 const identity=effectiveIdentity===undefined?await identityFor(req,env):effectiveIdentity;
 if(path==='/api/session'||path.startsWith('/api/auth/')||path==='/api/accounts'||
  path.startsWith('/api/accounts/')||path==='/api/demo')
  return authEndpoint(req,env,path,identity);
 if(path==='/api/library'||path.startsWith('/api/library/'))return libraryEndpoint(req,env,path,identity);
 if(path==='/api/member/safeguards'||path==='/api/committee/safeguards')return safeguardsEndpoint(req,env,path,identity);
 if(['/api/member/preview','/api/member/workspace','/api/member/preferences','/api/member/interest','/api/member/data-export'].includes(path))
  return memberWorkspaceEndpoint(req,env,path,identity);
 if(path==='/api/member/me'||path==='/api/member/events')
  return memberEndpoint(req,env,path,identity);
 if(path==='/api/interest'||path.startsWith('/api/interest/'))
  return interestEndpoint(req,env,path,identity);
 if(path.startsWith('/api/suite/'))return suiteEndpoint(req,env,path,identity);
 if(path==='/api/webmaster/requests'||path.startsWith('/api/webmaster/requests/'))
  return helpEndpoint(req,env,path,identity);
 if(path==='/api/people'||path.startsWith('/api/people/'))
  return peopleEndpoint(req,env,path,identity);
 if(path==='/api/records'||path.startsWith('/api/records/')||path==='/api/committee/events'||path==='/api/meetings')
  return recordsEndpoint(req,env,path,identity);
 if(path==='/api/committee/social-campaign-settings'||path==='/api/committee/social-post-edits'||path==='/api/committee/social-metrics')
  return socialEndpoint(req,env,path,identity);
 if(path==='/api/studio/briefs'||path.startsWith('/api/studio/briefs/'))
  return briefsEndpoint(req,env,path,identity);
 if(path==='/api/audit')return auditEndpoint(req,env,identity);
 throw new ApiError(404,'No club service exists at this address.','not_found');
}
export default {
 async fetch(req,env,ctx){
  try{
   const response=await handle(req,env);
   if(!new URL(req.url).pathname.startsWith('/api/'))return response;
   const headers=new Headers(response.headers);
   for(const [name,value] of Object.entries(defaults))headers.set(name,value);
   return new Response(response.body,{status:response.status,headers});
  }catch(error){
   if(!(error instanceof ApiError))console.error('Sandy API failure:',String(error?.message||error).slice(0,240));
   const status=error instanceof ApiError?error.status:500;
   return respond({error:error instanceof ApiError?error.message:'The shared club service could not complete this request.',
    code:error instanceof ApiError?error.code:'server_error'},status);
  }
 }
};
