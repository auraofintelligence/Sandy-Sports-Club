// Shared picture picker: cartoon avatar (suggested by age and gender) or an uploaded photo, shrunk to a small JPEG in the browser.
import {orderAvatars,avatarUrl} from './avatars.js';
export async function preparePhoto(file){
 if(!file?.size)return null;
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)||file.size>15*1024*1024)throw Error('Choose a JPG, PNG or WebP photo under 15 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const side=Math.min(bitmap.width,bitmap.height),size=Math.min(512,side),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  canvas.getContext('2d',{alpha:false}).drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,size,size);
  for(const quality of [.82,.7,.55,.4]){const encoded=canvas.toDataURL('image/jpeg',quality);if(encoded.length<=180000)return encoded}
  throw Error('This photo is still too large. Choose a smaller copy.');
 }finally{bitmap.close()}
}
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Renders into `mount`; calls onChange({avatarId}|{photo}) when the choice changes.
export function picturePicker(mount,{who={},current=null,name='picture',onChange=()=>{}}={}){
 const {suggested,others}=orderAvatars(who);
 const tile=a=>'<label class="avatar-tile"><input type="radio" name="'+name+'" value="'+a.id+'"'+(current?.avatarId===a.id?' checked':'')+'><img src="'+avatarUrl(a.id)+'" alt="Cartoon avatar '+a.id.slice(7)+'" width="96" height="96" loading="lazy"></label>';
 mount.innerHTML='<div class="avatar-picker"><p><strong>Suggested for you</strong></p><div class="avatar-grid">'+(suggested.map(tile).join('')||'<p>Pick any avatar below.</p>')+'</div>'+
  '<details'+(suggested.length?'':' open')+'><summary>Show all avatars</summary><div class="avatar-grid">'+others.map(tile).join('')+'</div></details>'+
  '<p><strong>Or use a photo</strong></p><label>Upload a photo <input type="file" accept="image/jpeg,image/png,image/webp" data-photo></label><p class="club-note" data-photo-note>'+safe(current?.type==='photo'?'You are using a photo. Pick an avatar above to switch back.':'Photos are only shown to members you connect with. Everyone else sees an avatar.')+'</p></div>';
 mount.addEventListener('change',async e=>{
  if(e.target.name===name){onChange({avatarId:e.target.value});return}
  if(e.target.matches('[data-photo]')){
   const note=mount.querySelector('[data-photo-note]');
   try{note.textContent='Preparing photo…';const photo=await preparePhoto(e.target.files[0]);if(photo){mount.querySelectorAll('input[name="'+name+'"]').forEach(r=>r.checked=false);note.textContent='Photo ready.';onChange({photo})}}
   catch(error){note.textContent=error.message;e.target.value=''}
  }
 });
}
export const verifiedBadge=on=>on?'<span class="verified-tick" role="img" title="ID verified in person" aria-label="ID verified in person">✓</span>':'';
export const pictureSrc=(p,photoUrl)=>p?.type==='photo'&&photoUrl?photoUrl:p?.avatarId?avatarUrl(p.avatarId):'/favicon.png';
