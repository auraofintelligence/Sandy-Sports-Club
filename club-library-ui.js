import {viewFetch,isReadOnlyView,protectView} from './club-view-client.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={owner:'My own private files',governance:'Governance documents',finance:'Finance documents',safety:'Restricted safety documents'};
const extensions={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'};
const paths={documents:'governance',stock:'finance',safety:'safety',owner:'owner'};
async function call(path,method='GET',data){
 const response=await viewFetch(path,{method,credentials:'same-origin',cache:'no-store',...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
 const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||'Private library request failed.');return result;
}
async function fileBody(input,source,consent){
 const f=input.files[0];if(!f||f.size>1048576||!extensions[f.type])throw Error('Choose a PDF, PNG or JPEG no larger than 1 MiB.');
 const bytes=new Uint8Array(await f.arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {mediaType:f.type,content:btoa(binary),source:source.trim(),consent};
}
const selectedRoles=f=>[...f.querySelectorAll('input[name="libraryRole"]:checked')].map(x=>x.value);
const roleControls=(roles,selected)=>roles.map(r=>'<label><input type="checkbox" name="libraryRole" value="'+esc(r)+'"'+(selected.includes(r)?' checked':'')+'> '+esc(r.replaceAll('_',' '))+'</label>').join('');
const fieldset=(legend,body)=>'<fieldset><legend>'+legend+'</legend>'+body+'</fieldset>';
const fileControls='<label>File<input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required></label><label>Source or provenance note<input name="source" maxlength="240" required></label><label><input type="checkbox" name="consent" required> I have permission to store this private file and have checked it contains no unnecessary personal or sensitive data.</label>';
export function setupPrivateLibrary(root){
 if(!root)return {open(){}};
 const panel=document.createElement('section');panel.className='club-panel';panel.id='private-library';panel.hidden=true;root.append(panel);
 panel.innerHTML='<h3>Protected file library</h3><p>Files are private, encrypted and versioned. Downloads expire and are bound to the signed-in account. Nothing is published or released to members here. File types are limited to PDF, PNG and JPEG up to 1 MiB. Files are not malware-scanned. Do not upload identity documents, child records, health records or other unnecessary sensitive material.</p><label>Private classification<select id="library-scope"></select></label><p id="library-state" role="status"></p><form id="library-upload"><fieldset><legend>Add a private file</legend><label>Title<input name="title" maxlength="160" required></label><label>Retention review date<input type="date" name="reviewDate" required></label><div id="library-upload-roles"></div>'+fileControls+'<button type="submit">Upload private file</button></fieldset></form><div id="library-list"></div><div class="club-toolbar"><button id="library-prev" type="button">Previous</button><button id="library-next" type="button">Next</button><button id="library-refresh" type="button">Refresh private files</button></div><div id="library-detail" hidden></div>';
 const find=s=>panel.querySelector(s),state=find('#library-state'),list=find('#library-list'),upload=find('#library-upload'),scopeSelect=find('#library-scope'),detail=find('#library-detail');
 let scope=null,deskScope=null,rows=[],info=null,page=0,serial=0;
 function resetDetail(){detail.hidden=true;detail.replaceChildren()}
 function tell(msg){state.textContent=msg}
 function showControls(){
  upload.querySelector('fieldset').disabled=!info?.writeEnabled||isReadOnlyView();
  find('#library-upload-roles').innerHTML=fieldset('Additional authorised roles',roleControls(info?.scopeRoles?.[scope]||[],[]));
  if(isReadOnlyView())protectView('#library-upload input,#library-upload button[type="submit"],#library-change input,#library-change button,#library-replace input,#library-replace button,#library-withdraw input,#library-withdraw button',panel);
 }
 function draw(){
  rows=info.documents||[];
  list.innerHTML=rows.map(d=>'<article class="club-record-card" data-library-id="'+esc(d.id)+'"><div><strong>'+esc(d.title)+'</strong><p>'+esc(d.scope)+' | '+esc(d.state)+' | version '+d.version+' | '+esc(d.bytes)+' bytes | Review '+esc(d.reviewDate)+'</p><p>Content version '+d.contentVersion+' | '+esc(d.mediaType)+' | '+esc(d.source)+'</p></div><div class="suite-record-buttons"><button type="button" data-library-action="open">Open details</button>'+(d.state==='private'?'<button type="button" data-library-action="download">Download private file</button>':'')+'</div></article>').join('')||'<p>No private files in this classification.</p>';
  find('#library-prev').disabled=page===0;find('#library-next').disabled=!info.hasMore;
  showControls();
 }
 async function refresh(){
  if(!scope)return;
  const own=++serial;
  try{
   tell('Checking private file permissions…');const next=await call('/api/library?scope='+encodeURIComponent(scope)+'&page='+page);
   if(own!==serial)return;info=next;
   if(!info.available){list.replaceChildren();showControls();tell(info.notice||'Private storage is not provisioned.');find('#library-prev').disabled=true;find('#library-next').disabled=true;return}
   draw();tell(info.synthetic?'Synthetic example files only. Upload and changes are disabled.':info.writeEnabled?'Private file storage available. Nothing is published.':'Private file upload is disabled. Existing permitted files can be viewed or withdrawn.');
  }catch(e){if(own===serial){list.replaceChildren();upload.querySelector('fieldset').disabled=true;tell(e.message)}}
 }
 async function open(key){
  const s=paths[key];deskScope=s||null;panel.hidden=!s;serial++;resetDetail();upload.reset();list.replaceChildren();
  if(!s)return;
  scope=s;page=0;scopeSelect.innerHTML=[s,...(s==='owner'?[]:['owner'])].map(v=>'<option value="'+v+'">'+names[v]+'</option>').join('');
  scopeSelect.value=scope;upload.querySelector('fieldset').disabled=true;await refresh();
 }
 async function openDoc(doc){
  const d=(await call('/api/library/'+doc.id)).document;
  if(!d||scope!==d.scope||panel.hidden)return;
  detail.hidden=false;detail.innerHTML='<h4>'+esc(d.title)+'</h4><p>Current version '+d.version+' | content version '+d.contentVersion+' | '+esc(d.state)+' | SHA-256: <code>'+esc(d.digest)+'</code></p><p>Additional roles: '+esc(d.roles.join(', ')||'None')+' | Retention review: '+esc(d.reviewDate)+'</p><button type="button" id="library-close-detail">Close details</button>';
  if(d.canManage){
   const history=await call('/api/library/'+d.id+'/history');
   detail.insertAdjacentHTML('beforeend','<h5>Attributed history</h5><ul>'+history.history.map(h=>'<li>Version '+h.version+' | '+esc(h.operation)+' | '+esc(h.office)+' | '+esc(h.at)+'</li>').join('')+'</ul>');
   if(d.state==='private'){
    detail.insertAdjacentHTML('beforeend','<form id="library-change">'+fieldset('Update allowed roles and retention review',roleControls(info.scopeRoles[d.scope]||[],d.roles)+'<label>Review date<input name="reviewDate" type="date" required value="'+esc(d.reviewDate)+'"></label><label>Reason<input name="reason" maxlength="240" required></label><button type="submit">Save access change</button>')+'</form><form id="library-replace">'+fieldset('Replace with new encrypted content version',fileControls+'<button type="submit">Save new file version</button>')+'</form><form id="library-withdraw">'+fieldset('Withdraw file and invalidate all tickets','<label>Reason<input name="reason" maxlength="240" required></label><button type="submit">Withdraw private file</button>')+'</form>');
    for(const id of ['#library-change','#library-replace'])find(id).querySelector('fieldset').disabled=!info.writeEnabled||isReadOnlyView();
    find('#library-withdraw').querySelector('fieldset').disabled=isReadOnlyView();
    for(const [id,action] of [['#library-change','access'],['#library-replace','replace'],['#library-withdraw','withdraw']])find(id).addEventListener('submit',async e=>{
     e.preventDefault();if(isReadOnlyView())return;const f=e.target,button=f.querySelector('button[type="submit"]');button.disabled=true;
     try{
      if(action==='replace')await call('/api/library/'+d.id+'/replace','POST',{version:d.version,...await fileBody(f.elements.file,f.elements.source.value,f.elements.consent.checked)});
      else await call('/api/library/'+d.id,'PATCH',{action,version:d.version,reason:f.elements.reason.value,...(action==='access'?{roles:selectedRoles(f),reviewDate:f.elements.reviewDate.value}:{})});
      resetDetail();await refresh();tell(action==='withdraw'?'Private file withdrawn. Previous tickets no longer work.':'Saved attributed private file revision.');
     }catch(e){tell(e.message);button.disabled=false}
    });
   }
  }
  find('#library-close-detail').addEventListener('click',resetDetail);
 }
 async function download(d){
  const {ticket}=await call('/api/library/'+d.id+'/ticket');
  const res=await viewFetch('/api/library/'+d.id+'/download',{credentials:'same-origin',cache:'no-store',headers:{'X-Sandy-Download':ticket}});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw Error(e.error||'Download denied.')}
  const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download='sandy-document-'+d.id+'.'+extensions[d.mediaType];document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 upload.addEventListener('submit',async e=>{
  e.preventDefault();if(isReadOnlyView()||!info?.writeEnabled)return;
  const f=upload.elements,button=upload.querySelector('button[type="submit"]');button.disabled=true;
  try{await call('/api/library','POST',{title:f.title.value,scope,roles:selectedRoles(upload),reviewDate:f.reviewDate.value,...await fileBody(f.file,f.source.value,f.consent.checked)});upload.reset();await refresh();tell('Private file saved and versioned. No publication or external transfer.')}catch(e){tell(e.message)}finally{button.disabled=!info?.writeEnabled}
 });
 list.addEventListener('click',async e=>{
  const button=e.target.closest('[data-library-action]'),d=rows.find(x=>x.id===button?.closest('[data-library-id]')?.dataset.libraryId);
  if(!d)return;button.disabled=true;try{if(button.dataset.libraryAction==='download')await download(d);else await openDoc(d)}catch(e){tell(e.message)}finally{button.disabled=false}
 });
 scopeSelect.addEventListener('change',()=>{scope=scopeSelect.value;page=0;resetDetail();upload.reset();void refresh()});
 find('#library-prev').addEventListener('click',()=>{page=Math.max(0,page-1);resetDetail();void refresh()});
 find('#library-next').addEventListener('click',()=>{if(info?.hasMore){page++;resetDetail();void refresh()}});
 find('#library-refresh').addEventListener('click',()=>void refresh());
 return {open,refresh};
}
