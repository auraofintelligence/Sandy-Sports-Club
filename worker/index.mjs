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
import {committeeOpsEndpoint} from './committee-ops.mjs';
import {meetingsEndpoint} from './meetings.mjs';
import {runSheetEndpoint} from './run-sheets.mjs';
import {applicationsEndpoint} from './applications.mjs';
import {financeEndpoint} from './finance.mjs';
import {nominationsEndpoint,dailyDigest} from './nominations.mjs';
import {surveyEndpoint} from './survey.mjs';
import {joinEndpoint,joinOpen} from './join.mjs';
import {familyEndpoint} from './family.mjs';
import {profilesEndpoint} from './profiles.mjs';
import {announcementsEndpoint} from './announcements.mjs';
import {calendarEndpoint} from './calendar.mjs';
import {requestsEndpoint} from './requests.mjs';
import {storeEndpoint} from './store.mjs';
import {sponsorsEndpoint} from './sponsors.mjs';
import {publicPath,privateShell} from './public-assets.mjs';

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
 if(path==='/api')throw new ApiError(404,'No club service exists at this address.','not_found');
 if(!path.startsWith('/api/')){
  const asset=publicPath(path);
  if(!asset||!['GET','HEAD'].includes(req.method))throw new ApiError(404,'No public file exists at this address.','not_found');
  if(!env.ASSETS?.fetch)return new Response('Static assets not configured.',{status:503,headers:defaults});
  const response=await env.ASSETS.fetch(req);
  if(!privateShell(asset))return response;
  const headers=new Headers(response.headers);
  for(const [name,value] of Object.entries(defaults))headers.set(name,value);
  // These shells are deliberately embedded by the same-origin clubhouse.
  headers.set('X-Frame-Options','SAMEORIGIN');headers.set('Content-Security-Policy',"frame-ancestors 'self'");
  return new Response(response.body,{status:response.status,headers});
 }
 if(!['GET','POST','PATCH','HEAD'].includes(req.method))throw new ApiError(405,'That method is not supported.','method_not_allowed');
 // The public nomination form and sports survey record cross-origin posts in the spam quarantine themselves.
 if(!['GET','HEAD'].includes(req.method)&&path!=='/api/nominate'&&path!=='/api/survey')verifySameOrigin(req);
 return viewMode(req,env,path,route);
}
async function route(req,env,path,effectiveIdentity){
 if(path==='/api/public-config'&&req.method==='GET')
  return respond({clubEstablished:env.SANDY_CLUB_APPROVALS==='enabled',
   publicInterestReady:Boolean(env.DB?.prepare),joinReady:joinOpen(env),foundingMembers:env.SANDY_FOUNDING_MEMBERS==='enabled',
   publicNominationsReady:Boolean(env.DB?.prepare&&env.SANDY_NOMINATIONS_ENABLED==='enabled'&&env.SANDY_TURNSTILE_SECRET&&env.SANDY_TURNSTILE_SITE_KEY),
   publicSurveyReady:Boolean(env.DB?.prepare&&env.SANDY_SURVEY_ENABLED==='enabled'&&env.SANDY_TURNSTILE_SECRET&&env.SANDY_TURNSTILE_SITE_KEY),
   publicApplicationsReady:Boolean(env.DB?.prepare&&env.SANDY_APPLICATIONS_ENABLED==='enabled'&&env.SANDY_TURNSTILE_SECRET&&env.SANDY_TURNSTILE_SITE_KEY),
   turnstileSiteKey:env.SANDY_TURNSTILE_SITE_KEY||null,invitationSendingEnabled:false});
 if(path==='/api/health'&&req.method==='GET')
  return respond({service:'sandy-club',storageConfigured:Boolean(env.DB?.prepare),
   authConfigured:Boolean(env.SANDY_AUTH_PEPPER?.length>=32),operationalApprovals:env.SANDY_CLUB_APPROVALS==='enabled',
   livePublishing:false,smsEnabled:false,paymentsEnabled:false});
 const identity=effectiveIdentity===undefined?await identityFor(req,env):effectiveIdentity;
 if(path==='/api/session'||path.startsWith('/api/auth/')||path==='/api/accounts'||
  path.startsWith('/api/accounts/')||path==='/api/demo')
  return authEndpoint(req,env,path,identity);
 if(path==='/api/join')return joinEndpoint(req,env,path,identity);
 if(path==='/api/sponsors'||path.startsWith('/api/sponsors/')||path==='/api/sponsor-portal'||path==='/api/committee/sponsors')return sponsorsEndpoint(req,env,path,identity);
 if(path==='/api/store'||path.startsWith('/api/store/')||path.startsWith('/api/committee/store/'))return storeEndpoint(req,env,path,identity);
 if(path==='/api/requests'||path==='/api/committee/requests')return requestsEndpoint(req,env,path,identity);
 if(path==='/api/member/announcements'||path==='/api/committee/announcements')return announcementsEndpoint(req,env,path,identity);
 if(['/api/calendar','/api/calendar.ics','/api/member/calendar','/api/member/club-calendar.ics'].includes(path))return calendarEndpoint(req,env,path,identity);
 if(path==='/api/member/family'||path==='/api/committee/families')return familyEndpoint(req,env,path,identity);
 if(['/api/member/profile','/api/member/details','/api/member/picture','/api/member/directory','/api/member/connections','/api/committee/member-profiles','/api/committee/verify-id'].includes(path)||path.startsWith('/api/member/photo/'))return profilesEndpoint(req,env,path,identity);
 if(path==='/api/library'||path.startsWith('/api/library/'))return libraryEndpoint(req,env,path,identity);
 if(path==='/api/member/safeguards'||path==='/api/committee/safeguards')return safeguardsEndpoint(req,env,path,identity);
 if(['/api/member/preview','/api/member/workspace','/api/member/preferences','/api/member/interest','/api/member/data-export','/api/member/rsvp','/api/member/calendar.ics'].includes(path))
  return memberWorkspaceEndpoint(req,env,path,identity);
 if(path==='/api/member/me'||path==='/api/member/events')
  return memberEndpoint(req,env,path,identity);
 if(path==='/api/interest'||path.startsWith('/api/interest/'))
  return interestEndpoint(req,env,path,identity);
 if(path==='/api/committee/notices'||path==='/api/committee/todos')return committeeOpsEndpoint(req,env,path,identity);
 if(path==='/api/committee/meetings'||path.startsWith('/api/committee/meetings/')||path.startsWith('/api/committee/minutes/')||path.startsWith('/api/committee/agm/')||path==='/api/committee/reminders')
  return meetingsEndpoint(req,env,path,identity);
 if(path==='/api/nominate'||path==='/api/committee/nominations'||path==='/api/committee/spam'||path.startsWith('/api/committee/spam/'))return nominationsEndpoint(req,env,path,identity);
 if(path==='/api/survey'||path==='/api/committee/survey'||path==='/api/committee/survey.csv')return surveyEndpoint(req,env,path,identity);
 if(path==='/api/apply'||path==='/api/committee/applications'||path.startsWith('/api/committee/applications/'))return applicationsEndpoint(req,env,path,identity);
 if(path.startsWith('/api/committee/finance/')||path.startsWith('/api/committee/equipment/'))return financeEndpoint(req,env,path,identity);
 if(path.startsWith('/api/committee/events/'))return runSheetEndpoint(req,env,path,identity);
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
 // Daily 10:00 AM Australia/Brisbane alert digest (cron "0 0 * * *" UTC). It does
 // nothing unless nominations and a mail provider are switched on by the owner.
 async scheduled(event,env,ctx){
  const run=dailyDigest(env,event?.scheduledTime||Date.now()).catch(()=>({state:'failed'}));
  if(ctx?.waitUntil)ctx.waitUntil(run);else await run;
 },
 async fetch(req,env,ctx){
  try{
   const response=await handle(req,env);
   if(!new URL(req.url).pathname.startsWith('/api/'))return response;
   const headers=new Headers(response.headers);
   for(const [name,value] of Object.entries(defaults))headers.set(name,value);
   return new Response(response.body,{status:response.status,headers});
  }catch(error){
   if(!(error instanceof ApiError))console.error('Sandy API failure: unexpected server error');
   const status=error instanceof ApiError?error.status:500;
   return respond({error:error instanceof ApiError?error.message:'The shared club service could not complete this request.',
    code:error instanceof ApiError?error.code:'server_error'},status);
  }
 }
};
