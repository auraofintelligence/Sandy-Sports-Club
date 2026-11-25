import {isReadOnlyView,protectView} from './club-view-client.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupSafeguardsDesk(root,api){
 const panel=document.createElement('section');panel.className='club-panel';panel.hidden=true;root.append(panel);
 panel.innerHTML='<h3>Restricted individual participation check</h3><p>Search an exact member username. Record only an age band and verified guardian permission. Do not enter dates of birth, identity documents, guardian names, health information or incident notes. Club formation gates remain in force.</p><form id="safeguard-search"><label>Exact username<input name="q" maxlength="80" required autocomplete="off"></label><button type="submit">Find account</button></form><p id="safeguard-status" role="status"></p><div id="safeguard-result"></div>';
 const search=panel.querySelector('#safeguard-search'),result=panel.querySelector('#safeguard-result'),status=panel.querySelector('#safeguard-status');
 let member=null;
 function render(){
  if(!member){result.textContent='No matching member account. No account is created by this check.';return}
  result.innerHTML='<h4>'+escape(member.username)+'</h4><p>Account: '+escape(member.state)+' | Revision '+member.version+' | Optional consent: '+(member.accepted?'accepted':'not accepted')+'</p><form id="safeguard-verify"><label>Verified age band<select name="ageBand">'+[['unconfirmed','Unconfirmed'],['under16','Under 16'],['16-17','16 to 17'],['adult','18 or older']].map(([v,l])=>'<option value="'+v+'"'+(member.ageBand===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label><label><input name="ageCheckedOffline" type="checkbox"> I checked the age group privately</label><label><input name="guardianPermission" type="checkbox"'+(member.guardianPermission?' checked':'')+'> Guardian authority / permission recorded (minor only)</label><label><input name="guardianCheckedOffline" type="checkbox"> I verified guardian authority privately</label><button type="submit">Save restricted check</button></form>';
  if(isReadOnlyView())protectView('#safeguard-verify input,#safeguard-verify select,#safeguard-verify button',panel);
 }
 search.addEventListener('submit',async e=>{
  e.preventDefault();member=null;result.replaceChildren();
  try{const response=await api('/api/committee/safeguards?q='+encodeURIComponent(search.elements.q.value.trim()));member=response.members[0]||null;render();status.textContent='Restricted search completed.'}catch(e){status.textContent=e.message}
 });
 result.addEventListener('submit',async e=>{
  e.preventDefault();if(!member||isReadOnlyView())return;
  const f=e.target.elements,button=e.target.querySelector('button[type=submit]');button.disabled=true;
  try{const response=await api('/api/committee/safeguards',{method:'POST',data:{action:'verify',accountId:member.accountId,version:member.version,ageBand:f.ageBand.value,guardianPermission:f.guardianPermission.checked,ageCheckedOffline:f.ageCheckedOffline.checked,guardianCheckedOffline:f.guardianCheckedOffline.checked}});member=response.member;render();status.textContent='Private check saved. Changes to verification reset optional consent.'}catch(e){status.textContent=e.message;button.disabled=false}
 });
 return {open(key){panel.hidden=key!=='safety';member=null;search.reset();result.replaceChildren();status.textContent=isReadOnlyView()?'Synthetic view only. No member login or real case exists.':''}};
}
