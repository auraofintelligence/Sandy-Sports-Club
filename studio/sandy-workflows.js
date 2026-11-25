import {viewFetch,protectView} from '../club-view-client.js';
// Sandy production desk: D1-backed, authenticated, server-signed. No localStorage fallback.
const form=document.querySelector('#sandy-handoff-form');
const list=document.querySelector('#sandy-handoff-list');
const revisions=document.querySelector('#sandy-handoff-revisions');
const notice=document.querySelector('#sandy-handoff-status');
const safe=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;',">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
let briefs=[],opened=null,enabled=false,role='';
async function api(path,{method='GET',data}={}){
 const response=await viewFetch(path,{method,credentials:'same-origin',cache:'no-store',
  headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 let body={};try{body=await response.json()}catch{}
 if(!response.ok)throw Error(body.error||'Shared service error ('+response.status+')');
 return body;
}
function alert(message,bad=false){if(notice){notice.textContent=message;notice.style.color=bad?'#9f3020':'#176b5c'}}
const labels={draft:'Draft',proposed:'Proposed handoff',prepared:'Prepared',revision:'Changes requested',evidence:'Evidence referenced (unverified)',closed:'Closed',
 assigned:'Assigned (authorised)',delivered:'Delivered',approved:'Approved (server)',rejected:'Rejected (server)',published:'Published link recorded',
 'ready-set':'Ready SET Co-op (proposed)','in-house':'In-house / volunteer',other:'Other proposed provider'};
function blank(){form.reset();form.elements.id.value='';opened=null;alert('New unsaved production brief.')}
function formBody(){
 const b=Object.fromEntries(new FormData(form));return {
 title:b.title||'',date:b.date||'',sourcePostId:b.reference||'',sourceUrl:'',brief:b.brief||'',
 producer:b.producer||'in-house',reviewer:b.reviewer||'founding',status:b.status||'draft',
 due:b.due||'',author:b.author||'',decisionBy:b.decisionBy||'',evidence:b.evidence||'',
 publishedUrl:b.publishedUrl||'',notes:b.notes||''
 }}
function edit(b){
 blank();opened=b;
 const map={reference:'sourcePostId'};
 for(const [k,val] of Object.entries(b)){
  const key=k==='sourcePostId'?'reference':k;
  if(form.elements[key]&&typeof val==='string')form.elements[key].value=val;
 }
 form.elements.id.value=b.id;
 form.elements.status.value=['draft','proposed','prepared','revision','evidence','closed'].includes(b.status)?b.status:'prepared';
 form.scrollIntoView?.({behavior:'smooth'});
 alert('Editing shared revision '+b.version+' of '+b.title+'. All changes require server authentication.');
}
function render(){
 if(!list)return;
 list.innerHTML=briefs.map(b=>'<article class="studio-record"><span class="studio-record-tag">'+safe(labels[b.status]||b.status)+'</span>'+
  '<h4>'+safe(b.title)+'</h4><p>'+safe((b.date||'Unscheduled')+' · '+(labels[b.producer]||b.producer))+'</p>'+
  '<p class="studio-small">Shared revision '+b.version+' · '+safe(b.updatedAt||'')+' · last edited by account '+safe(b.updatedBy)+'</p>'+
  (b.evidence?'<p><a href="'+safe(b.evidence)+'" target="_blank" rel="noopener noreferrer">Decision reference (unverified)</a></p>':'')+
  (b.publishedUrl?'<p><a href="'+safe(b.publishedUrl)+'" target="_blank" rel="noopener noreferrer">Publication link (unverified)</a></p>':'')+
  '<div class="studio-buttons"><button type="button" data-brief-edit="'+b.id+'">Edit</button>'+
  '<button type="button" data-brief-revisions="'+b.id+'">Server history</button>'+
  '<button type="button" data-brief-propose="'+b.id+'">Propose handoff</button></div></article>').join('')||
  '<p>No shared production briefs yet. Select a Studio post to prepare one.</p>';
}
async function reload(){
 const data=await api('/api/studio/briefs');briefs=data.briefs||[];render();
}
form?.addEventListener('submit',async ev=>{
 ev.preventDefault();if(!enabled){alert('Sign in and connect the shared D1 database first.',true);return}
 const b=formBody();
 if(!b.title.trim()){alert('Enter a title.',true);return}
 const button=form.querySelector('button[type=submit]');button.disabled=true;
 try{
  const saved=opened?await api('/api/studio/briefs/'+opened.id,{method:'PATCH',data:{...b,version:opened.version}}):
    await api('/api/studio/briefs',{method:'POST',data:b});
  await reload();const next=briefs.find(x=>x.id===saved.id);
  if(next)edit(next);
  alert('Shared revision '+saved.version+' saved. The server recorded the signed-in account and timestamp. No approval or message was issued.');
 }catch(e){alert('Not saved: '+e.message,true)}
 finally{button.disabled=false}
});
document.querySelector('#sandy-handoff-clear')?.addEventListener('click',blank);
list?.addEventListener('click',async ev=>{
 const button=ev.target.closest('button');if(!button)return;
 const id=button.dataset.briefEdit||button.dataset.briefRevisions||button.dataset.briefPropose,b=briefs.find(x=>x.id===id);
 if(!b)return;
 if(button.dataset.briefEdit){edit(b);return}
 if(button.dataset.briefRevisions){
  try{
   const data=await api('/api/studio/briefs/'+id+'/revisions');
   revisions.innerHTML='<h4>'+safe(b.title)+' · server revisions</h4>'+
    (data.revisions||[]).map(x=>'<article class="studio-revision"><strong>v'+x.version+'</strong> · '+safe(x.at)+' · '+safe(x.office)+' ('+safe(x.role)+')'+
      '<p>'+safe(x.operation)+' · '+safe((x.changes?.changed||[]).join(', '))+'</p></article>').join('');
   document.querySelector('#sandy-handoff-history')?.setAttribute('open','');
  }catch(e){alert(e.message,true)}
  return;
 }
 if(button.dataset.briefPropose){
  const provider=prompt('Proposed producer for this brief (e.g. Ready SET Co-op):',b.producer||'ready-set');
  if(provider===null)return;
  try{
   const result=await api('/api/studio/briefs/'+id+'/handoff',{method:'POST',
     data:{producer:provider,due:b.due||'',authorised:false}});
   alert('Handoff proposal '+result.handoffId+' stored in the shared register. Not commissioned and no message sent.');
  }catch(e){alert('Handoff not recorded: '+e.message,true)}
 }
});
function exportData(csv=false){
 if(!enabled){alert('Shared records are unavailable. Nothing was exported.',true);return}
 let text,name,type;
 if(csv){
  const names=['id','title','date','sourcePostId','producer','reviewer','status','due','evidence','publishedUrl','version','createdBy','updatedBy','createdAt','updatedAt'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""').replace(/\n/g,' ')+'"';
  text='\uFEFF'+[names.join(','),...briefs.map(b=>names.map(k=>q(b[k])).join(','))].join('\r\n');
  name='sandy-shared-production-briefs.csv';type='text/csv;charset=utf-8';
 }else{
  text=JSON.stringify({source:'Authenticated Sandy D1 shared production register',exportedAt:new Date().toISOString(),records:briefs},null,2);
  name='sandy-shared-production-briefs.json';type='application/json;charset=utf-8';
 }
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 alert('Exported the currently loaded authenticated shared production register.');
}
document.querySelector('#sandy-handoff-export')?.addEventListener('click',()=>exportData(false));
document.querySelector('#sandy-handoff-export-csv')?.addEventListener('click',()=>exportData(true));
window.addEventListener('sandy-studio:handoff',ev=>{
 if(!enabled){alert('Connect to shared club records before preparing a handoff.',true);return}
 const d=ev.detail||{};blank();
 form.elements.title.value=String(d.title||'Sandy Sports content').slice(0,160);
 form.elements.date.value=/^20\d\d-\d\d-\d\d$/.test(d.plannedDate||'')?d.plannedDate:'';
 form.elements.reference.value=String(d.postId||'').slice(0,160);
 form.elements.brief.value=[d.body||'',Array.isArray(d.channels)?'Channels: '+d.channels.join(', '):''].join('\n\n').slice(0,5000);
 alert('Studio draft loaded into an UNSAVED production brief. Save to the shared database after checking its details.');
});
(async()=>{
 if(!form)return;
 try{
  const s=await api('/api/session');
  enabled=Boolean(s.authenticated&&s.storageReady&&
   ['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'].includes(s.identity?.role));
  if(!enabled){form.closest('.studio-handoff')?.setAttribute('hidden','');return}
  role=s.identity.role;await reload();if(s.readOnly){protectView('#sandy-handoff-form input,#sandy-handoff-form select,#sandy-handoff-form textarea,#sandy-handoff-form button[type=submit],#sandy-handoff-clear,[data-brief-propose]');alert('Synthetic view only. Example briefs cannot be saved or commissioned.')}else alert('Connected to the shared production register. Server-stamped revisions are enabled.');
 }catch(e){form.closest('.studio-handoff')?.setAttribute('hidden','');alert('Shared production register is not connected: '+e.message,true)}
})();
