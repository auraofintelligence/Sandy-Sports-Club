export function setupEventMemberNotice(node,id,{api,esc}) {
  if(!node)return;
  const address='/api/committee/events/'+encodeURIComponent(id)+'/member-notice';
  let record,loading=false,attempt=null,proposed=null;
  const content=node.querySelector('[data-notice-content]');
  const status=(message,error=false)=>{const out=node.querySelector('[data-notice-status]');out.setAttribute('role',error?'alert':'status');out.textContent=message;};
  function noticeText(value){
    return '<article class="panel"><h3>'+esc(value.title)+'</h3><p>'+esc(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'full'}).format(new Date(value.date+'T12:00:00+10:00'))) +
      ' · '+(value.time?esc(value.time)+' AEST':'Time to be advised')+'</p>'+(value.place?'<p>'+esc(value.place)+'</p>':'')+
      (value.details?'<p class="event-notes">'+esc(value.details)+'</p>':'')+'</article>';
  }
  function form(value) {
    return '<form data-notice-edit class="event-form"><label>Title members will see<input name="title" maxlength="140" required value="'+esc(value.title)+'"></label><div class="event-pair"><label>Confirmed date<input name="date" type="date" min="1900-01-01" max="2100-12-31" required value="'+esc(value.date)+'"></label>'+
      '<label>Start time in Brisbane (optional)<input name="time" type="time" value="'+esc(value.time)+'"></label></div><label>Where to meet (optional)<input name="place" maxlength="240" value="'+esc(value.place)+'"></label><label>Details for members (optional)<textarea rows="3" maxlength="2000" name="details">'+esc(value.details)+'</textarea></label><button type="submit" class="button outline small">Preview member notice</button></form>';
  }
  function render() {
    const n=record.notice;
    content.innerHTML='<p>'+ (n.published?'Members can see this notice in their calendar.':'Write the notice you want members to see. The event run sheet stays in the committee room.')+'</p>'+
      (n.published?noticeText(n)+'<div class="event-tools"><a class="text-link" href="#members/calendar">Open member calendar</a><button type="button" class="text-link" data-notice-withdraw>Withdraw from member calendar</button></div>':'')+
      (record.canPublish?(n.published?'<details><summary>Edit the member notice</summary>'+form(n)+'</details>':form(n)):'');
  }
  async function load(){
    if(loading)return;loading=true;status('Opening the notice…');
    try{const next=await api(address,{cache:'no-store'});if(!node.isConnected)return;record=next;proposed=null;attempt=null;render();status('');}
    catch(e){if(node.isConnected){status(e.message,true);content.innerHTML='<button type="button" data-notice-reload class="text-link">Open current notice</button>';}}
    finally{loading=false;}
  }
  async function save(action){
    if(loading||!record)return;
    const body={action,version:record.notice.version,...(action==='publish'?proposed:{})};
    const key=JSON.stringify(body);if(attempt?.key!==key)attempt={key,id:crypto.randomUUID()};
    loading=true;content.inert=true;
    try{const next=await api(address,{method:'POST',body:JSON.stringify({...body,mutationId:attempt.id})});
      if(!node.isConnected)return;
      record=next;proposed=null;attempt=null;render();status(action==='publish'?'Notice published in the members’ calendar.':'Notice withdrawn from the members’ calendar.');
    }catch(e){if(node.isConnected){status(e.message,true);if(e.status===409&&!content.querySelector('[data-notice-reload]'))content.insertAdjacentHTML('beforeend','<button type="button" data-notice-reload class="text-link">Open current notice</button>');}}
    finally{loading=false;content.inert=false;}
  }
  node.addEventListener('toggle',()=>{if(node.open&&!record&&!loading)load();});
  node.addEventListener('submit',e=>{
    if(!e.target.matches('[data-notice-edit]'))return;
    e.preventDefault();e.stopPropagation();
    const formEl=e.target;proposed=Object.fromEntries(new FormData(formEl));
    if(!proposed.title.trim()){formEl.elements.title.focus();status('Give the member notice a title.',true);return;}
    content.innerHTML='<h3>What members will see</h3>'+noticeText(proposed)+'<div class="event-tools"><button type="button" class="button" data-notice-publish>Publish to member calendar</button><button type="button" class="text-link" data-notice-back>Change wording</button></div>';
    content.querySelector('[data-notice-publish]').focus();
  });
  node.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||loading)return;
    if(b.hasAttribute('data-notice-back')&&proposed){content.innerHTML=form(proposed);content.querySelector('input').focus();}
    if(b.hasAttribute('data-notice-publish')&&proposed)save('publish');
    if(b.hasAttribute('data-notice-withdraw')&&confirm('Withdraw this notice from the member calendar? Members who already saved a copy may still have it in their own calendar.'))save('withdraw');
    if(b.hasAttribute('data-notice-reload')&&(!proposed||confirm('Replace this unsaved wording with the current notice?')))load();
  });
}
