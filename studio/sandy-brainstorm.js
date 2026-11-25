import {viewFetch,protectView} from '../club-view-client.js';
// Sandy ideas inbox backed by authenticated club records. No local-only saves.
const root=document.querySelector('#sandy-ideas'),form=document.querySelector('#sandy-ideas-form');
const list=document.querySelector('#sandy-ideas-list'),statusBox=document.querySelector('#sandy-ideas-status'),filter=document.querySelector('#sandy-ideas-filter');
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;',">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
let items=[],selected=null,enabled=false;
async function api(path,{method='GET',data}={}){
 const r=await viewFetch(path,{method,credentials:'same-origin',cache:'no-store',
  headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 let d={};try{d=await r.json()}catch{}
 if(!r.ok)throw Error(d.error||'Shared records unavailable ('+r.status+')');
 return d;
}
function note(t,bad=false){if(statusBox){statusBox.textContent=t;statusBox.style.color=bad?'#9f3020':'#176b5c'}}
const states={idea:'proposal',developing:'draft',review:'review',archived:'archived'};
const reverse=Object.fromEntries(Object.entries(states).map(([k,v])=>[v,k]));
function payload(){
 const d=Object.fromEntries(new FormData(form)),url=d.source?.trim()||'';
 if(url&&!url.startsWith('https://'))throw Error('Use a secure HTTPS source link.');
 return {kind:'social_idea',title:d.title?.trim()||'',eventDate:d.date||'',status:states[d.stage]||'proposal',
  body:{category:d.category||'',channel:d.channel||'undecided',notes:d.notes||'',source:url,authorNote:d.author||''}};
}
function setForm(r){
 form.reset();selected=r||null;form.elements.id.value=r?.id||'';
 if(!r)return;
 form.elements.title.value=r.title;form.elements.category.value=r.body.category||'';
 form.elements.date.value=r.eventDate||'';form.elements.channel.value=r.body.channel||'undecided';
 form.elements.stage.value=reverse[r.status]||'idea';form.elements.notes.value=r.body.notes||'';
 form.elements.source.value=r.body.source||'';form.elements.author.value=r.body.authorNote||'';
}
async function load(){
 const d=await api('/api/records?kind=social_idea');items=d.records||[];
 render();
}
function render(){
 if(!list)return;
 const shown=items.filter(x=>filter.value==='all'||filter.value==='archived'?filter.value==='all'||x.status==='archived':x.status!=='archived');
 list.innerHTML=shown.map(item=>
  '<article class="studio-idea-item"><div class="studio-idea-item-top"><strong>'+esc(item.title)+'</strong><span>'+esc(reverse[item.status]||item.status)+'</span></div>'+
  '<p>'+esc((item.body.category||'')+' · '+(item.eventDate||'Unscheduled')+' · '+(item.body.channel||''))+'</p>'+
  (item.body.notes?'<p>'+esc(item.body.notes.slice(0,260))+'</p>':'')+
  '<small>Shared revision '+item.version+' · '+esc(item.updatedAt)+' · server account '+esc(item.updatedBy)+'</small>'+
  (item.body.source?'<p><a href="'+esc(item.body.source)+'" target="_blank" rel="noopener noreferrer">Reference link</a></p>':'')+
  '<div class="studio-buttons"><button type="button" data-idea-edit="'+item.id+'">Edit</button>'+
  '<button type="button" data-idea-handoff="'+item.id+'">Prepare production brief</button>'+
  (item.status==='archived'?'<button type="button" data-idea-restore="'+item.id+'">Restore</button>':
   '<button type="button" data-idea-archive="'+item.id+'">Archive</button>')+'</div></article>'
 ).join('')||'<p>No shared '+(filter.value==='archived'?'archived':'working')+' ideas yet. Add one above.</p>';
}
form?.addEventListener('submit',async event=>{
 event.preventDefault();if(!enabled){note('The shared club system is not connected. No idea was saved.',true);return}
 let value;try{value=payload()}catch(e){note(e.message,true);return}
 if(!value.title||!value.body.category){note('Enter a title and topic.',true);return}
 try{
  const result=selected?await api('/api/records/'+selected.id,{method:'PATCH',data:{...value,version:selected.version}}):
   await api('/api/records',{method:'POST',data:value});
  await load();setForm(items.find(x=>x.id===result.id));
  note('Idea saved as server revision '+result.version+' under your authenticated account. No publication or handoff was sent.');
 }catch(e){note('Not saved: '+e.message,true)}
});
document.querySelector('#sandy-idea-new')?.addEventListener('click',()=>{setForm();note('New blank idea. Existing shared records are unchanged.')});
document.querySelector('#sandy-idea-export')?.addEventListener('click',()=>{
 if(!enabled){note('Shared idea records are unavailable.',true);return}
 const file=new Blob([JSON.stringify({source:'Sandy D1 shared register',exportedAt:new Date().toISOString(),items},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(file),a=document.createElement('a');a.download='sandy-shared-ideas.json';a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 note('Exported the currently loaded shared idea records.');
});
filter?.addEventListener('change',render);
list?.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 const recordId=b.dataset.ideaEdit||b.dataset.ideaHandoff||b.dataset.ideaArchive||b.dataset.ideaRestore;
 const item=items.find(x=>x.id===recordId);if(!item)return;
 if(b.dataset.ideaEdit){setForm(item);form.scrollIntoView({behavior:'smooth'});return}
 if(b.dataset.ideaHandoff){
  window.dispatchEvent(new CustomEvent('sandy-studio:handoff',{detail:{title:item.title,
   plannedDate:item.eventDate||'',postId:item.id,body:(item.body.notes||'')+'\n\nSource: '+(item.body.source||''),
   channels:item.body.channel==='multiple'||item.body.channel==='undecided'?[]:[item.body.channel]}}));
  document.querySelector('#sandy-handoffs')?.scrollIntoView?.({behavior:'smooth'});
  note('Idea copied into an unsaved production brief. No assignment was issued.');return;
 }
 const newStatus=b.dataset.ideaArchive?'archived':'proposal';
 try{
  await api('/api/records/'+item.id,{method:'PATCH',data:{kind:'social_idea',title:item.title,
   status:newStatus,eventDate:item.eventDate,body:item.body,version:item.version}});
  await load();note('Idea '+(newStatus==='archived'?'archived':'restored')+' as a new server revision.');
 }catch(e){note('Not saved: '+e.message,true)}
});
async function legacyImport(){
 let legacy;try{legacy=JSON.parse(localStorage.getItem('sandy-social-ideas-v1')||'null')}catch{}
 if(!Array.isArray(legacy?.items)||!legacy.items.length)return;
 const panel=document.createElement('div');panel.className='studio-legacy-import';
 panel.innerHTML='<p><strong>Previous browser-only ideas found.</strong> They have not been copied into the shared club register.</p>'+
  '<button type="button">Review and import my older ideas</button>';
 root.querySelector('.studio-ideas-inner')?.prepend(panel);
 panel.querySelector('button').addEventListener('click',async()=>{
  if(!window.confirm('Create '+legacy.items.length+' NEW shared ideas from the old browser-only register? Duplicates may need review. The original local records will remain untouched.'))return;
  let saved=0;
  for(const old of legacy.items.slice(0,80)){
   try{
    await api('/api/records',{method:'POST',data:{kind:'social_idea',title:old.title,status:states[old.stage]||'proposal',
     eventDate:old.date||'',body:{category:old.category||'voice',channel:old.channel||'undecided',notes:old.notes||'',source:old.source||'',authorNote:old.author||''}}});saved++;
   }catch(e){note('Stopped importing after '+saved+' records: '+e.message,true);break}
  }
  await load();note('Imported '+saved+' older ideas as new shared proposals. The browser copy was not deleted.');
 });
}
(async()=>{
 if(!root||!form)return;
 try{
  const session=await api('/api/session');
  enabled=Boolean(session.authenticated&&session.storageReady&&['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'].includes(session.identity?.role));
  if(!enabled){root.hidden=true;return}
  const {CAMPAIGN_LAYERS}=await import('./social-campaign-engine.js');
  form.elements.category.innerHTML='<option value="">Select a Sandy topic</option>'+
   CAMPAIGN_LAYERS.map(x=>'<option value="'+esc(x.id)+'">'+esc((x.emoji||'📌')+' '+x.label)+'</option>').join('');
  await load();if(!session.readOnly){await legacyImport();note('Connected to shared Sandy ideas. Every save has an authenticated server revision.')}else{protectView('#sandy-ideas-form input,#sandy-ideas-form textarea,#sandy-ideas-form select,#sandy-ideas-form button[type=submit],#sandy-idea-new,[data-idea-archive],[data-idea-restore],[data-idea-handoff]',root);note('Synthetic view only. Example ideas cannot be saved or transferred.');}
 }catch(e){root.hidden=true;note('Shared ideas are unavailable: '+e.message,true)}
})();
