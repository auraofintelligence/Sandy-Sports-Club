// Sandy's private Webmaster support desk. No automatic messages are sent.
const root=document.querySelector('#club-requests');
if(root){
 const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const form=root.querySelector('#webmaster-help-form'),list=root.querySelector('#webmaster-help-list');
 const count=root.querySelector('#webmaster-help-count'),notice=root.querySelector('#webmaster-help-status');
 let identity=null;
 async function request(path,method='GET',data){
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
   ...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
  const reply=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(reply.error||'Shared service error ('+response.status+').');
  return reply;
 }
 async function load(){
  try{
   const session=await request('/api/session');
   if(!session.authenticated)return;
   identity=session.identity;
   const result=await request('/api/webmaster/requests');
   const webmaster=identity.role==='webmaster';
   count.textContent=webmaster?result.counters.unread+' unread · '+result.counters.open+' open':'Your private requests';
   list.innerHTML=(result.requests||[]).map(row=>{
    const action=webmaster?
     '<form data-help-review="'+esc(row.id)+'"><input type="hidden" name="version" value="'+row.version+'">'+
     '<label>State<select name="stage">'+[['draft','Open'],['review','Reviewing'],['completed','Resolved'],['archived','Archived']].map(pair=>
      '<option value="'+pair[0]+'"'+(row.stage===pair[0]?' selected':'')+'>'+pair[1]+'</option>').join('')+'</select></label>'+
     '<label>Internal response<textarea name="reply" rows="3" maxlength="4000">'+esc(row.reply||'')+'</textarea></label>'+
     '<button type="submit">Save internal response</button></form>':
     '<p>'+esc(row.reply||'No Webmaster response recorded yet.')+'</p>';
    return '<details class="webmaster-help-item"><summary><strong>'+esc(row.subject)+'</strong> · '+esc(row.stage)+
     ' · '+esc(row.category)+(webmaster&&!row.readAt?' · Unread':'')+'</summary>'+
     '<p>'+esc(row.message)+'</p><small>Logged '+esc(row.createdAt)+' · account '+esc(row.createdBy)+'</small>'+action+'</details>';
   }).join('')||'<p>No private Webmaster requests have been recorded yet.</p>';
  }catch(error){list.textContent='Could not load requests: '+error.message}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]'),data=Object.fromEntries(new FormData(form));
  button.disabled=true;
  try{
   await request('/api/webmaster/requests','POST',data);
   form.reset();notice.textContent='Request saved privately. Nothing was emailed or published.';
   await load();
  }catch(error){notice.textContent='Not saved: '+error.message}
  finally{button.disabled=false}
 });
 list.addEventListener('submit',async event=>{
  const f=event.target.closest('[data-help-review]');if(!f)return;
  event.preventDefault();if(identity?.role!=='webmaster')return;
  const button=f.querySelector('[type=submit]'),data=Object.fromEntries(new FormData(f));
  button.disabled=true;
  try{
   await request('/api/webmaster/requests/'+f.dataset.helpReview,'PATCH',{
    version:Number(data.version),stage:data.stage,reply:data.reply});
   notice.textContent='Internal reply saved with a server audit. No email sent.';
   await load();
  }catch(error){notice.textContent='Not saved: '+error.message;button.disabled=false}
 });
 window.SandyHelp={load};
 window.addEventListener('sandy:clubhouse-section-change',e=>{if(e.detail?.tab==='requests')void load()});
 if(location.hash==='#requests')void load();
}
