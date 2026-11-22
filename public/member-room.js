import {preparePhoto} from './member-photo.js';

export function setupMemberRoom({api,esc,toast=()=>{}}) {
  const chat=document.getElementById('member-conversation');
  const minutes=document.getElementById('shared-minutes');
  if(!chat||!minutes)return {setSession(){}};
  const form=chat.querySelector('form'),list=chat.querySelector('[data-posts]');
  const status=chat.querySelector('[role="status"]'),gate=chat.querySelector('[data-conversation-gate]');
  let session=null,socialAccess=false,replyTo=null,requestId=crypto.randomUUID(),generation=0;
  const canRead=()=>session?.authenticated&&session.storageReady&&['member','committee'].includes(session.role);
  const canWrite=()=>canRead()&&socialAccess&&!session?.readOnly&&!session?.showcase&&!session?.demo;
  const stamp=value=>new Date(value).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'});
  function clearReply(){replyTo=null;form.querySelector('[data-reply-label]').textContent='';form.querySelector('[data-cancel-reply]').hidden=true;}
  function card(post){
    if(post.removed)return '<article class="community-card"><p>Message removed.</p></article>';
    const photo=post.hasPhoto?'<a href="/api/community/'+encodeURIComponent(post.id)+'/photo" target="_blank" rel="noopener"><img class="member-photo" src="/api/community/'+encodeURIComponent(post.id)+'/photo" alt="Photo shared by '+esc(post.author)+'" loading="lazy"></a>':'';
    return '<article class="community-card"><header><strong>'+esc(post.author)+'</strong><time>'+esc(stamp(post.createdAt))+'</time></header>'+
      (post.message?'<p class="community-text">'+esc(post.message)+'</p>':'')+photo+
      '<footer>'+(canWrite()&&!post.parentId?'<button type="button" data-reply="'+esc(post.id)+'">Reply</button>':'')+
      (canWrite()&&post.canRemove?'<button type="button" data-remove="'+esc(post.id)+'">Remove message</button>':'')+'</footer></article>';
  }
  async function loadPosts(){
    if(!canRead()||location.hash!=='#members/conversation'||document.hidden)return;
    const ticket=++generation;
    try{
      const {posts}=await api('/api/community');
      if(ticket!==generation)return;
      const threads=posts.filter(p=>!p.parentId).map(p=>card(p)+'<div class="community-replies">'+posts.filter(r=>r.parentId===p.id).reverse().map(card).join('')+'</div>');
      list.innerHTML=threads.join('')||'<p>There are no club conversations yet.</p>';
      gate.textContent=socialAccess?'':'Posting opens after your age group and optional sharing choice are checked.';
      form.hidden=!canWrite();
      status.textContent='';
    }catch(error){if(ticket===generation){form.hidden=true;list.replaceChildren();gate.textContent=error.message;}}
  }
  async function loadMinutes(){
    if(!canRead()||location.hash!=='#members/minutes')return;
    try{
      const {minutes:rows}=await api('/api/member/minutes');
      minutes.innerHTML=rows.length?rows.map(row=>'<details class="panel"><summary>'+esc(row.date)+' · '+esc(row.title)+'</summary><p class="community-text">'+esc(row.text)+'</p></details>').join(''):'<p>No committee minutes have been released to members yet.</p>';
    }catch(error){minutes.textContent=error.message;}
  }
  function navigate(){
    if(!canRead()){generation++;form.hidden=true;list.replaceChildren();minutes.replaceChildren();return;}
    if(location.hash==='#members/conversation')loadPosts();
    if(location.hash==='#members/minutes')loadMinutes();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!canWrite())return;
    const button=form.querySelector('[type="submit"]');button.disabled=true;status.textContent='Sharing with club members.';
    try{
      const photo=await preparePhoto(form.elements.photo.files[0]);
      await api('/api/community',{method:'POST',body:JSON.stringify({id:requestId,parentId:replyTo,author:form.elements.author.value,message:form.elements.message.value,photo})});
      form.elements.message.value='';form.elements.photo.value='';clearReply();requestId=crypto.randomUUID();
      status.textContent='Shared with club members.';await loadPosts();
    }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  });
  form.querySelector('[data-cancel-reply]').onclick=clearReply;
  list.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||!canWrite())return;
    if(button.dataset.reply){replyTo=button.dataset.reply;requestId=crypto.randomUUID();form.querySelector('[data-reply-label]').textContent='Replying to '+button.closest('article').querySelector('strong').textContent;form.querySelector('[data-cancel-reply]').hidden=false;form.elements.message.focus();}
    if(button.dataset.remove&&confirm('Remove this message and its photo from the club room?')){
      try{await api('/api/community',{method:'DELETE',body:JSON.stringify({id:button.dataset.remove})});await loadPosts();}catch(error){toast(error.message);}
    }
  });
  window.addEventListener('plfc:safeguards',event=>{socialAccess=Boolean(event.detail?.socialAccess);navigate();});
  window.addEventListener('plfc:navigated',navigate);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)navigate();});
  setInterval(()=>{if(!document.hidden&&location.hash==='#members/conversation')loadPosts();},25000);
  return {setSession(next){session=next;socialAccess=next?.role==='committee';clearReply();navigate();}};
}
