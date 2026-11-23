// Sandy brainstorm inbox. Browser-local only; never a verified committee record.
const root=document.querySelector("#sandy-ideas");
const form=document.querySelector("#sandy-ideas-form");
const list=document.querySelector("#sandy-ideas-list");
const status=document.querySelector("#sandy-ideas-status");
const filter=document.querySelector("#sandy-ideas-filter");
const KEY="sandy-social-ideas-v1";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>crypto.randomUUID?.()||"idea-"+Date.now()+"-"+Math.random().toString(36).slice(2);
const clone=v=>JSON.parse(JSON.stringify(v));
const safeUrl=x=>!x||(/^https:\/\/[^\s]+$/i.test(x)&&!x.includes('"'));
let state={version:1,items:[]};
try{const saved=JSON.parse(localStorage.getItem(KEY)||"null");if(saved?.version===1&&Array.isArray(saved.items))state=saved}catch{}
let editingId="";
const warn=(s,err=false)=>{if(status){status.textContent=s;status.style.color=err?"#a33421":"#216a59"}};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{return false}}
function read(){
 const d=new FormData(form),txt=(k,n=1000)=>String(d.get(k)||"").trim().slice(0,n);
 return {title:txt("title",180),category:txt("category",40),date:txt("date",10),channel:txt("channel",20),stage:txt("stage",20),
  notes:txt("notes",4500),source:txt("source",700),author:txt("author",100)};
}
function diff(before,after){return Object.keys(after).filter(key=>before?.[key]!==after[key]).map(key=>({field:key,from:String(before?.[key]??"").slice(0,300),to:String(after[key]??"").slice(0,300)}))}
function setForm(item){
 form.reset();editingId=item?.id||"";
 form.elements.id.value=editingId;
 for(const [k,v] of Object.entries(item||{}))if(form.elements[k]&&typeof v==="string")form.elements[k].value=v;
}
function render(){
 if(!list)return;
 const items=state.items.filter(item=>filter.value==="all"||filter.value==="archived"?(filter.value==="all"||item.stage==="archived"):item.stage!=="archived")
  .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 list.innerHTML=items.map(item=>
  '<article class="studio-idea-item"><div class="studio-idea-item-top"><strong>'+esc(item.title)+'</strong><span>'+esc(item.stage)+'</span></div>'+
  '<p>'+esc(item.category+' · '+(item.date||"Unscheduled")+' · '+(item.channel||"Undecided"))+'</p>'+
  (item.notes?'<p>'+esc(item.notes.slice(0,260))+(item.notes.length>260?'…':'')+'</p>':'')+
  '<small>Local revision '+item.revision+' · '+esc(new Date(item.updatedAt).toLocaleString("en-AU",{timeZone:"Australia/Brisbane"}))+' · Self-entered contributor: '+esc(item.author||"Not specified")+'</small>'+
  (item.source?'<p><a href="'+esc(item.source)+'" target="_blank" rel="noopener noreferrer">Source link (unverified)</a></p>':'')+
  '<div class="studio-buttons"><button type="button" data-idea-edit="'+esc(item.id)+'">Edit</button>'+
  '<button type="button" data-idea-handoff="'+esc(item.id)+'">Prepare production brief</button>'+
  (item.stage!=="archived"?'<button type="button" data-idea-archive="'+esc(item.id)+'">Archive</button>':
  '<button type="button" data-idea-restore="'+esc(item.id)+'">Restore</button>')+'</div></article>').join("")||
 '<p>No '+(filter.value==="archived"?"archived":"working")+' ideas yet. Add your own above.</p>';
}
form?.addEventListener("submit",event=>{
 event.preventDefault();const data=read(),previous=state.items.find(x=>x.id===editingId);
 if(!data.title||!data.category){warn("Give the idea a title and topic.",true);return}
 if(!safeUrl(data.source)){warn("Source links need a valid HTTPS URL.",true);return}
 const changed=diff(previous,data);if(previous&&!changed.length){warn("No changes to save.");return}
 const time=new Date().toISOString(),item=previous?{...previous,...data,revision:previous.revision+1,updatedAt:time}:
 {...data,id:uid(),revision:1,createdAt:time,updatedAt:time,history:[]};
 item.history=[...(previous?.history||[]),{revision:item.revision,at:time,by:data.author||"This browser (unverified)",changes:changed}].slice(-80);
 state.items=previous?state.items.map(x=>x.id===previous.id?item:x):[...state.items,item];
 if(!save()){warn("Browser could not save this idea. Export a register before leaving.",true);return}
 setForm(item);render();warn("Saved idea revision "+item.revision+" locally. No approval, publishing or external contact.");
});
document.querySelector("#sandy-idea-new")?.addEventListener("click",()=>{setForm();warn("New blank idea. Your existing saved ideas are unchanged.")});
document.querySelector("#sandy-idea-export")?.addEventListener("click",()=>{
 const data={notice:"Browser-only unverified Sandy Sports brainstorming records",...clone(state)},blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="sandy-social-ideas.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 warn("Exported the ideas register and full local revision history.");
});
filter?.addEventListener("change",render);
list?.addEventListener("click",event=>{
 const button=event.target.closest("button");if(!button)return;
 const id=button.dataset.ideaEdit||button.dataset.ideaHandoff||button.dataset.ideaArchive||button.dataset.ideaRestore;
 const item=state.items.find(x=>x.id===id);if(!item)return;
 if(button.dataset.ideaEdit){
  setForm(item);form.scrollIntoView?.({behavior:"smooth",block:"start"});warn("Editing a browser-local idea. Save to create a new revision.");return;
 }
 if(button.dataset.ideaHandoff){
  window.dispatchEvent(new CustomEvent("sandy-studio:handoff",{detail:{
   title:item.title,plannedDate:item.date||"",postId:item.id,proposalSource:item.category,
   body:(item.notes||"")+" \n\nTopic: "+item.category+"\nSource: "+(item.source||"Not supplied"),
   channels:item.channel==="undecided"||item.channel==="multiple"?[]:[item.channel]
  }}));
  document.querySelector("#sandy-handoffs")?.scrollIntoView?.({behavior:"smooth",block:"start"});
  warn("Idea passed to an UNSAVED production brief. No assignment or message was sent.");return;
 }
 const stage=button.dataset.ideaArchive?"archived":"idea",time=new Date().toISOString();
 const next={...item,stage,revision:item.revision+1,updatedAt:time,
  history:[...item.history,{revision:item.revision+1,at:time,by:"This browser (unverified)",changes:[{field:"stage",from:item.stage,to:stage}]}].slice(-80)};
 state.items=state.items.map(x=>x.id===id?next:x);
 if(!save()){warn("Could not save status change.",true);return}
 render();warn(stage==="archived"?"Idea archived locally.":"Idea restored locally.");
});
(async()=>{
 if(!root||!form)return;
 try{const {CAMPAIGN_LAYERS}=await import("./social-campaign-engine.js");
 const select=document.querySelector("#sandy-idea-category");
 select.innerHTML='<option value="">Select a Sandy topic</option>'+CAMPAIGN_LAYERS.map(x=>'<option value="'+esc(x.id)+'">'+esc((x.emoji||"📌")+" "+x.label)+'</option>').join("");
 }catch(error){warn("Topic selector could not load. Refresh to retry: "+error.message,true)}
 render();
})();
