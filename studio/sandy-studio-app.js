// Browser-local Sandy Social Studio adapter, using the current PLFC workbench modules.
// No club account, identity verification, publishing or shared database is connected.
const mount=document.querySelector("#social-planner-desk");
const key="sandy-social-studio-local-revisions-v1";
const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
let currentDraft=null;
function copyFallback(text){const box=document.createElement("textarea");box.value=text;document.body.appendChild(box);box.select();try{document.execCommand("copy");return true}catch{return false}finally{box.remove()}}
async function init(){
 try{
  if(!mount)throw Error("Missing Studio workbench");
  const {setupAnnualCampaigns}=await import("./social-campaigns.js");
  let record=null;
  try{record=JSON.parse(localStorage.getItem(key)||"null")}catch{}
  let settings=record?.settings||null,version=record?.version||0,history=Array.isArray(record?.history)?record.history:[];
  const storageStamp=()=>history[0]?.savedAt||null;
  const api=async(path,options={})=>{
   const url=new URL(path,location.origin);
   if(url.pathname!=="/api/committee/social-campaign-settings")
    throw Error("This isolated Sandy Studio has no connected committee API.");
   if(options.method==="POST"){
    const sent=JSON.parse(options.body||"{}");
    if(sent.version!==version)throw Object.assign(Error("Another local revision was saved. Reopen the latest version."),{status:409});
    const next=structuredClone(sent.settings),time=new Date().toISOString(),v=version+1;
    const changes=[];
    for(const field of new Set([...Object.keys(settings||{}),...Object.keys(next||{})])){
     if(JSON.stringify(settings?.[field])!==JSON.stringify(next?.[field]))changes.push({field,before:"Earlier browser version",after:"Updated browser version"});
    }
    const entry={version:v,actorId:"browser-local",actorName:"This browser (unverified)",
     actorOffice:"Sandy local planning",actorRole:"local-only",savedAt:time,
     changes:{count:changes.length,changes,note:"Unverified local revision, not committee sign-off"},settings:next};
    const nextHistory=[entry,...history].slice(0,100);
    localStorage.setItem(key,JSON.stringify({version:v,settings:next,history:nextHistory}));
    version=v;settings=next;history=nextHistory;
    return {version,settings:structuredClone(settings),updatedAt:time,
     updatedByName:"This browser (unverified)",updatedOffice:"Local planning"};
   }
   if(url.searchParams.has("history"))return {version,history:history.map(({settings,...rest})=>rest)};
   if(url.searchParams.has("version")){
    const item=history.find(h=>h.version===Number(url.searchParams.get("version")));
    if(!item)throw Object.assign(Error("This local revision is not available."),{status:404});
    return {revision:structuredClone(item)};
   }
   return {version,settings:settings?structuredClone(settings):null,updatedAt:storageStamp(),
    updatedByName:version?"This browser (unverified)":null,updatedOffice:"Local planning"};
  };
  const planner=setupAnnualCampaigns({
   mount,api,esc:safe,isActive:()=>true,reviewOnly:true,
   onUse(draft){
    currentDraft=structuredClone(draft);
    const output=document.querySelector("#trial-draft-body");if(output)output.textContent=JSON.stringify(draft,null,2);
    document.querySelector("#trial-draft")?.showModal();
   }
  });
  mount.innerHTML=planner.markup();
  await planner.open();
  document.querySelector("#trial-draft-close")?.addEventListener("click",()=>document.querySelector("#trial-draft")?.close());
  document.querySelector("#trial-draft-copy")?.addEventListener("click",async event=>{
   if(!currentDraft)return;
   const value=JSON.stringify(currentDraft,null,2);
   let copied=false;try{await navigator.clipboard.writeText(value);copied=true}catch{copied=copyFallback(value)}
   event.currentTarget.textContent=copied?"Copied draft":"Select the draft text and copy";
  });
  document.querySelector("#trial-draft-handoff")?.addEventListener("click",()=>{
   if(!currentDraft)return;
   window.dispatchEvent(new CustomEvent("sandy-studio:handoff",{detail:structuredClone(currentDraft)}));
   document.querySelector("#trial-draft")?.close();
   document.querySelector("#sandy-handoffs")?.scrollIntoView({behavior:"smooth"});
  });
 }catch(error){
  if(mount)mount.innerHTML='<p role="alert" class="studio-error">Social Studio could not start: '+safe(error?.message||error)+'. The existing simpler planner remains available.</p>';
  console.error("Sandy Social Studio loading failed",error);
 }
}
void init();