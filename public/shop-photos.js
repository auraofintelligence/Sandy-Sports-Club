import {preparePhoto} from './member-photo.js';

export function mountShopPhotos(host,{api,esc,productId,signal}){
  const controller=new AbortController();
  if(signal?.aborted)return;
  signal?.addEventListener('abort',()=>controller.abort(),{once:true,signal:controller.signal});
  const live=()=>host.isConnected&&!controller.signal.aborted;
  const path='/api/stock/shop-photos';
  let slots=[],selected='',photo=null,mutationId='',reading=0,saving=false;
  const current=()=>slots.find(s=>(s.variantId||'')===selected);
  function note(message){
    const status=host.querySelector('[data-photo-status]');
    if(status)status.textContent=message;
  }
  function setDirty(){
    mutationId=crypto.randomUUID();
    host.querySelector('[data-photo-slot]').disabled=true;
    host.querySelector('[data-photo-discard]').hidden=false;
  }
  function render(message=''){
    if(!live())return;
    reading++;photo=null;mutationId=crypto.randomUUID();
    if(!current())selected='';
    const slot=current();
    host.innerHTML='<form class="shop-photo-editor"><label>Which photo?<select data-photo-slot>'+
      slots.map(s=>'<option value="'+esc(s.variantId||'')+'"'+((s.variantId||'')===selected?' selected':'')+'>'+esc(s.variantId?s.label:'Main listing photo')+'</option>').join('')+'</select></label>'+
      '<p>'+esc(slot.variantId?'This photo appears when someone chooses this option.':'This is the first photo visitors see for '+slot.label+'.')+'</p>'+
      '<img data-photo-preview'+(slot.photo?' src="'+esc(slot.photo.url)+'" alt="'+esc(slot.photo.alt)+'"':' hidden alt=""')+'>'+
      '<label>'+ (slot.photo?'Choose a replacement photo':'Choose a photo')+'<input type="file" name="file" accept="image/jpeg,image/png,image/webp"></label>'+
      '<small>Choose a JPG, PNG or WebP from your camera or files, up to 12 MB.</small>'+
      '<label>What can you see in the photo?<input name="alt" maxlength="220" value="'+esc(slot.alt)+'" placeholder="'+esc(slot.defaultAlt)+'"></label>'+
      '<small>You can leave this blank to use the item name and option.</small>'+
      '<div class="shop-photo-actions"><button type="submit" class="button small">Save photo</button><button type="button" class="text-link" data-photo-discard hidden>Discard changes</button></div>'+
      (slot.photo?'<details><summary>Remove this photo</summary><p>The shop will use the next available product image.</p><button type="button" class="button outline small" data-photo-remove>Confirm removal</button></details>':'')+
      '<p role="status" data-photo-status></p></form>';
    note(message);
  }
  async function load(message=''){
    host.innerHTML='<p role="status">Opening listing photos…</p>';
    try{
      const data=await api(path+'?productId='+encodeURIComponent(productId),{signal:controller.signal});
      slots=data.slots;
      render(message);
    }catch(error){
      if(!live())return;
      host.innerHTML='<p role="status"></p><button type="button" data-reload-photos class="text-link">Reload photos</button>';
      host.querySelector('p').textContent=error.message;
    }
  }
  async function write(action){
    const form=host.querySelector('form'),slot=current();
    if(saving||!slot||!form||form.querySelector('[type=submit]').disabled)return;
    if(action==='save'&&!slot.photo&&!photo){note('Choose a photo from your device first.');form.elements.file.focus();return;}
    const payload={action,productId,variantId:slot.variantId,version:slot.version,mutationId};
    if(action==='save'){
      payload.alt=form.elements.alt.value.trim();
      if(photo)payload.photo=photo;
    }
    saving=true;form.inert=true;note(action==='save'?'Saving the photo…':'Removing the photo…');
    try{
      const data=await api(path,{method:'POST',body:JSON.stringify(payload),signal:controller.signal});
      if(!live())return;
      slots=data.slots;render(action==='save'?'Photo saved.':'Photo removed.');
      window.dispatchEvent(new Event('plfc:shop-listings-changed'));
    }catch(error){
      if(!live())return;
      note(error.message);
      if(error.status===409&&!form.querySelector('[data-reload-photos]')){
        const reload=document.createElement('button');reload.type='button';reload.dataset.reloadPhotos='';reload.className='text-link';
        reload.textContent='Reload current photos';form.append(reload);
      }
    }finally{saving=false;if(live())form.inert=false;}
  }
  host.addEventListener('submit',event=>{
    if(!event.target.matches('.shop-photo-editor'))return;
    event.preventDefault();write('save');
  },{signal:controller.signal});
  host.addEventListener('input',event=>{
    if(event.target.name!=='alt'||saving)return;
    setDirty();
    host.querySelector('[data-photo-preview]').alt=event.target.value.trim()||current().defaultAlt;
  },{signal:controller.signal});
  host.addEventListener('change',async event=>{
    const field=event.target;
    if(saving)return;
    if(field.hasAttribute('data-photo-slot')){selected=field.value;render();return;}
    if(field.name!=='file'||!field.files?.[0])return;
    const form=field.form,submit=form.querySelector('[type=submit]');
    const attempt=++reading;
    setDirty();submit.disabled=true;photo=null;note('Preparing your photo…');
    try{
      const data=await preparePhoto(field.files[0]);
      if(!live()||attempt!==reading)return;
      const image=form.querySelector('[data-photo-preview]');image.src=data;image.alt=form.elements.alt.value.trim()||current().defaultAlt;image.hidden=false;
      photo=data;note('Check the preview, then choose Save photo.');
    }catch(error){
      if(!live()||attempt!==reading)return;
      field.value='';const image=form.querySelector('[data-photo-preview]'),original=current().photo;
      if(original){image.src=original.url;image.alt=original.alt;}else{image.removeAttribute('src');image.hidden=true;}
      note(error.message);
    }finally{if(live()&&attempt===reading)submit.disabled=false;}
  },{signal:controller.signal});
  host.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||saving)return;
    if(button.hasAttribute('data-photo-discard'))render('Unsaved changes discarded.');
    if(button.hasAttribute('data-photo-remove'))write('remove');
    if(button.hasAttribute('data-reload-photos'))load();
  },{signal:controller.signal});
  load();
  return ()=>controller.abort();
}
