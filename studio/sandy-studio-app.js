import {viewFetch,protectView} from '../club-view-client.js';
// Sandy Social Studio: authenticated shared API only. No browser-local fallback.
const mount=document.querySelector('#social-planner-desk');
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;',">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
let currentDraft=null,planner=null;
async function api(path,options={}){
 const response=await viewFetch(path,{method:options.method||'GET',credentials:'same-origin',cache:'no-store',
  headers:options.method==='POST'?{'Content-Type':'application/json'}:undefined,body:options.body});
 let data={};try{data=await response.json()}catch{}
 if(!response.ok){const error=new Error(data.error||'Shared club API unavailable ('+response.status+').');error.status=response.status;throw error}
 return data;
}
function notice(message,bad=false){
 const n=document.querySelector('#studio-shared-status');if(n){n.textContent=message;n.classList.toggle('bad',bad)}
}
function copyFallback(text){
 const field=document.createElement('textarea');field.value=text;document.body.appendChild(field);field.select();
 try{return document.execCommand('copy')}finally{field.remove()}
}
function showUnavailable(message){
 if(mount)mount.innerHTML='<div class="studio-security"><strong>Shared Social Studio is not active.</strong><span>'+
  esc(message)+' No official club data is being stored in this browser. <a href="/club-login.html">Secure sign-in and webmaster setup</a> · <a href="/club-admin.html">Shared administration</a> · <a href="/social-studio-preview.html">Earlier browser drafts</a></span></div>';
 notice(message,true);
 document.querySelector('#sandy-handoffs')?.setAttribute('hidden','');
 document.querySelector('#sandy-ideas')?.setAttribute('hidden','');
}
async function maybeImportLegacy(){
 const holder=document.querySelector('#studio-legacy-import');if(!holder)return;
 let old=null;try{old=JSON.parse(localStorage.getItem('sandy-social-studio-local-revisions-v1')||'null')}catch{}
 if(!old?.settings||!old.version)return;
 holder.hidden=false;
 holder.innerHTML='<p><strong>Older browser-only draft found.</strong> This has not been copied into the shared club database.</p>'+
  '<button type="button" id="studio-legacy-transfer">Review and import the old settings into shared records</button>'+
  '<small>No automatic import, overwrite or deletion. The existing local copy is preserved.</small>';
 holder.querySelector('#studio-legacy-transfer')?.addEventListener('click',async()=>{
  try{
   const server=await api('/api/committee/social-campaign-settings');
   if(!window.confirm('Import this older local draft as a NEW shared revision? '+(server.version?'It will replace the current shared setting version '+server.version+'. ':'This will create the first shared plan. ')+'The old browser draft remains unchanged.'))return;
   const result=await api('/api/committee/social-campaign-settings',{method:'POST',
    body:JSON.stringify({version:server.version,settings:old.settings})});
   notice('Imported the old pattern settings into shared D1 as server revision '+result.version+'. Reload the Studio to view them.');
   if(planner){planner.reset();await planner.open()}
  }catch(e){notice('Import failed without changing the browser copy: '+e.message,true)}
 });
}
async function launch(){
 try{
  if(!mount)throw Error('Social Studio workbench missing');
  const session=await api('/api/session');
  if(!session.storageReady||!session.authReady){showUnavailable('The new Sandy D1 database and authentication are not yet activated.');return}
  if(!session.authenticated){showUnavailable('Sign in with a real activated club account to review or save committee plans.');return}
  const role=session.identity?.role;
  if(!['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'].includes(role)){
   showUnavailable('This account is read-only and cannot use live committee Social Studio records.');return;
  }
  notice(session.readOnly?'SYNTHETIC VIEW ONLY: calendar, settings and post layouts are fictional. No changes are saved.':'Signed in as '+session.identity.name+' ('+role+'). Studio settings, day plans and edited posts use the shared database and server-stamped audit history.');
  const {setupAnnualCampaigns}=await import('./social-campaigns.js?v=20261124-shared-club-v1');
  planner=setupAnnualCampaigns({
   mount,api,esc,isActive:()=>true,reviewOnly:false,strictShared:true,viewOnly:session.readOnly===true,
   onUse(draft){
    currentDraft=structuredClone(draft);
    document.querySelector('#trial-draft-body').textContent=JSON.stringify(currentDraft,null,2);
    document.querySelector('#trial-draft')?.showModal();
   }
  });
  mount.innerHTML=planner.markup();
  await planner.open();
  if(!session.readOnly)await maybeImportLegacy();
  else protectView('[data-annual-save],[data-month-apply],[data-month-copy-next],[data-month-reset],[data-day-save],[data-day-save-pattern],[data-day-update-pattern],[data-day-delete-pattern],[data-week-save],[data-calendar-save],[data-signal-save],[data-metric-import],[data-metric-link],[data-events-apply],[data-calendar-restore],[data-annual-use],#trial-draft-handoff');
  document.querySelector('#trial-draft-close')?.addEventListener('click',()=>document.querySelector('#trial-draft')?.close());
  document.querySelector('#trial-draft-copy')?.addEventListener('click',async event=>{
   if(!currentDraft)return;
   const value=JSON.stringify(currentDraft,null,2);
   let success=false;try{await navigator.clipboard.writeText(value);success=true}catch{success=copyFallback(value)}
   event.currentTarget.textContent=success?'Copied draft':'Select text and copy';
  });
  document.querySelector('#trial-draft-handoff')?.addEventListener('click',()=>{
   if(!currentDraft)return;
   window.dispatchEvent(new CustomEvent('sandy-studio:handoff',{detail:structuredClone(currentDraft)}));
   document.querySelector('#trial-draft')?.close();
   document.querySelector('#sandy-handoffs')?.scrollIntoView?.({behavior:'smooth'});
  });
 }catch(e){showUnavailable('Could not load authenticated Social Studio: '+e.message)}
}
void launch();
