// Sandy Sports production/handoff ledger. Browser-local and explicitly unauthenticated.
const KEY="sandy-social-studio-handoffs-v1";
const form=document.getElementById("sandy-handoff-form");
const statusBox=document.getElementById("sandy-handoff-status");
const list=document.getElementById("sandy-handoff-list");
const historyBox=document.getElementById("sandy-handoff-revisions");
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isHttps=v=>!v||/^https:\/\/[^\s]+$/i.test(v);
const now=()=>new Date().toISOString();
const guid=()=>crypto.randomUUID?.()||"draft-"+Date.now()+"-"+Math.random().toString(36).slice(2);
let state={version:1,records:[]};
try{const previous=JSON.parse(localStorage.getItem(KEY)||"null");if(previous?.version===1&&Array.isArray(previous.records))state=previous}catch{}
let currentId="";
function note(message,bad=false){if(!statusBox)return;statusBox.textContent=message;statusBox.style.color=bad?"#9f3020":"#176b5c"}
function snapshot(){return JSON.parse(JSON.stringify(state))}
function persist(){
 try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{return false}
}
function cleanData(raw){
 const trim=(x,max=150)=>String(raw.get(x)||"").trim().slice(0,max);
 return {
 title:trim("title",160),date:trim("date",10),reference:trim("reference",160),
 brief:trim("brief",5000),producer:trim("producer",32),reviewer:trim("reviewer",32),
 status:trim("status",24),due:trim("due",10),author:trim("author",100),
 decisionBy:trim("decisionBy",100),evidence:trim("evidence",700),
 publishedUrl:trim("publishedUrl",700),notes:trim("notes",5000)
 };
}
const labels={
 draft:"Draft brief",proposed:"Handoff proposed, not sent",prepared:"Prepared for committee review",
 revision:"Changes requested (self-reported)",evidence:"Decision evidence supplied, not verified",closed:"Closed / withdrawn",
 "ready-set":"Ready SET Co-op (proposed)","in-house":"In-house / volunteer idea",
 other:"Other contractor (proposed)",founding:"Prospective founding group",
 committee:"Committee (when established)",secretary:"Secretary (when appointed)",webmaster:"Webmaster (when activated)"
};
function uniqueDiff(a,b){
 const rows=[];for(const field of Object.keys(b)){if(JSON.stringify(a?.[field])!==JSON.stringify(b[field])){
  rows.push({field,from:String(a?.[field]??"").slice(0,400),to:String(b[field]??"").slice(0,400)});
 }}return rows;
}
function setFields(record){
 form.reset();for(const [field,value] of Object.entries(record||{})){
  if(form.elements[field]&&typeof value==="string")form.elements[field].value=value;
 }
 currentId=record?.id||"";
 const idInput=document.getElementById("sandy-handoff-id");if(idInput)idInput.value=currentId;
}
function render(){
 if(!list)return;
 const records=[...state.records].sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
 list.innerHTML=records.map(item=>'<article class="studio-record"><span class="studio-record-tag">'+escapeHTML(labels[item.status]||item.status)+'</span>'+
 '<h4>'+escapeHTML(item.title||"Untitled brief")+'</h4>'+
 '<p>'+escapeHTML((item.date||"Unscheduled")+(item.producer?" · "+(labels[item.producer]||item.producer):""))+'</p>'+
 '<p class="studio-small">Revision '+item.revision+' · Last local save '+escapeHTML(new Date(item.modifiedAt).toLocaleString("en-AU",{timeZone:"Australia/Brisbane"}))+'</p>'+
 '<p class="studio-small">'+escapeHTML(item.reviewer?("Review: "+(labels[item.reviewer]||item.reviewer)):"")+'</p>'+
 (item.evidence?'<p><a href="'+escapeHTML(item.evidence)+'" target="_blank" rel="noopener noreferrer">Decision reference (unverified)</a></p>':"")+
 (item.publishedUrl?'<p><a href="'+escapeHTML(item.publishedUrl)+'" target="_blank" rel="noopener noreferrer">Recorded post link (unverified)</a></p>':"")+
 '<div class="studio-buttons"><button type="button" data-edit="'+escapeHTML(item.id)+'">Edit</button><button type="button" data-copy="'+escapeHTML(item.id)+'">Copy production brief</button><button type="button" data-revisions="'+escapeHTML(item.id)+'">Revisions</button></div></article>').join("")||'<p>No production briefs yet. Select an item from the Studio or create one in the form.</p>';
}
function showHistory(id){
 const item=state.records.find(x=>x.id===id);if(!item)return;
 historyBox.innerHTML='<h4>'+escapeHTML(item.title)+'</h4>'+
 item.revisions.slice().reverse().map(rev=>'<section class="studio-revision"><strong>Local revision '+rev.version+'</strong> · '+escapeHTML(new Date(rev.at).toLocaleString("en-AU",{timeZone:"Australia/Brisbane"}))+
 '<p>Entered by: '+escapeHTML(rev.actor||"Not specified")+' (self-entered, unverified)</p>'+
 '<p>'+escapeHTML(rev.changes.map(c=>c.field).join(", ")||"No field changes")+'</p>'+
 '<details><summary>Before and after</summary><ul>'+
 rev.changes.map(c=>'<li><strong>'+escapeHTML(c.field)+'</strong><p>Before: '+escapeHTML(c.from)+'</p><p>After: '+escapeHTML(c.to)+'</p></li>').join("")+
 '</ul></details></section>').join("");
 document.getElementById("sandy-handoff-history")?.setAttribute("open","");
}
function briefText(item){
 return [
 "SANDY SPORTS / PROPOSED PRODUCTION BRIEF",
 "DRAFT FOR REVIEW ONLY: no real club permission, contract or commission is implied.",
 "Title: "+item.title,
 "Reference: "+(item.reference||"Pending"),
 "Suggested date: "+(item.date||"To determine"),
 "Proposed producer: "+(labels[item.producer]||item.producer),
 "Review route: "+(labels[item.reviewer]||item.reviewer),
 "Planning state: "+(labels[item.status]||item.status),
 "Brief:\n"+(item.brief||"Not yet written"),
 "Questions/feedback:\n"+(item.notes||"None"),
 "Source / decision reference: "+(item.evidence||"None; approval not verified"),
 "Prepared by (self-entered): "+(item.author||"Not supplied"),
 "Requires formal committee approval, production rights, asset permissions, publishing review and an agreed commissioning process."
 ].join("\n\n");
}
function download(filename,content,type){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
const csvQuote=v=>'"'+String(v??"").replace(/"/g,'""').replace(/\r?\n/g," ")+'"';
form?.addEventListener("submit",e=>{
 e.preventDefault();
 const data=cleanData(new FormData(form));
 if(!data.title){note("Add a working title.",true);return}
 if(!isHttps(data.evidence)||!isHttps(data.publishedUrl)){note("Decision and publication links must use HTTPS.",true);return}
 if(data.status==="evidence"&&(!data.evidence||!data.decisionBy)){
  note("To record a proposed decision, add who reportedly made it and the supporting HTTPS reference. It remains unverified.",true);return;
 }
 const previous=state.records.find(x=>x.id===currentId);
 const changes=uniqueDiff(previous||{},data);
 if(previous&&!changes.length){note("No changes since the last local save.");return}
 const when=now(),updated=previous?{...previous,...data,modifiedAt:when,revision:previous.revision+1}:
  {...data,id:guid(),createdAt:when,modifiedAt:when,revision:1,revisions:[]};
 updated.revisions=[...(previous?.revisions||[]),{version:updated.revision,at:when,actor:data.author||"Not supplied",changes:changes.slice(0,30)}].slice(-70);
 if(previous)state.records=state.records.map(item=>item.id===previous.id?updated:item);
 else state.records.push(updated);
 if(!persist()){note("Browser storage is full or unavailable. Export JSON before leaving.",true);return}
 currentId=updated.id;form.elements.id.value=currentId;
 render();showHistory(currentId);
 note("Saved locally as revision "+updated.revision+". This is not a signed committee approval.");
});
document.getElementById("sandy-handoff-clear")?.addEventListener("click",()=>{setFields();note("New blank brief. No record changed.")});
document.getElementById("sandy-handoff-export")?.addEventListener("click",()=>{
 download("sandy-social-handoff-drafts.json",JSON.stringify({notice:"Unauthenticated browser-local planning records, not certified approvals.",...snapshot()},null,2),"application/json;charset=utf-8");
 note("Exported all local briefs and revisions as JSON.");
});
document.getElementById("sandy-handoff-export-csv")?.addEventListener("click",()=>{
 const fields=["id","title","date","producer","reviewer","status","due","author","decisionBy","evidence","publishedUrl","reference","brief","notes","revision","createdAt","modifiedAt"];
 download("sandy-social-handoff-briefs.csv","\uFEFF"+[fields.join(","),...state.records.map(record=>fields.map(f=>csvQuote(record[f])).join(","))].join("\r\n"),"text/csv;charset=utf-8");
 note("Exported a CSV of the local handoff register. Full revision history is in JSON.");
});
list?.addEventListener("click",async e=>{
 const b=e.target.closest("button[data-edit],button[data-copy],button[data-revisions]");if(!b)return;
 const id=b.dataset.edit||b.dataset.copy||b.dataset.revisions,item=state.records.find(x=>x.id===id);if(!item)return;
 if(b.dataset.edit){setFields(item);form.scrollIntoView({behavior:"smooth"});note("Editing local brief "+item.revision+". No record is changed until you save.");}
 if(b.dataset.revisions){showHistory(id);document.getElementById("sandy-handoff-history")?.scrollIntoView({behavior:"smooth"});}
 if(b.dataset.copy){
  try{await navigator.clipboard.writeText(briefText(item));note("Copied proposal brief. No message or commission was sent.");}
  catch{note("Clipboard unavailable; export the CSV or JSON instead.",true);}
 }
});
window.addEventListener("sandy-studio:handoff",event=>{
 const draft=event.detail||{};
 setFields();
 form.elements.title.value=String(draft.title||"Sandy Sports content idea").slice(0,160);
 form.elements.date.value=/^20\d\d-\d\d-\d\d$/.test(draft.plannedDate||"")?draft.plannedDate:"";
 form.elements.reference.value=String(draft.postId||"Studio preview draft").slice(0,160);
 form.elements.brief.value=[draft.body||"",Array.isArray(draft.channels)?"Suggested channels: "+draft.channels.join(", "):""].filter(Boolean).join("\n\n").slice(0,5000);
 form.elements.status.value="draft";
 note("Loaded selected Studio content into an unsaved brief. Choose the proposed producer and reviewer, then save locally.");
});
render();
