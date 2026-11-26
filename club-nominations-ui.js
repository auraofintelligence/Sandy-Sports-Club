// Officer-only (Webmaster, Secretary) view of join form nominations and the spam quarantine.
export const mayReviewNominations=role=>['webmaster','secretary'].includes(role);
const $=id=>document.getElementById(id);
const when=s=>s?new Date(s).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'})+' AEST':'';
const ALERT={sent:'Alert sent',failed:'Alert failed',not_configured:'Mail not set up',pending:'Pending'};
let bound=false;
export async function loadNominations({api,esc,status,readOnly=false}){
 const [n,q]=await Promise.all([api('/api/committee/nominations'),api('/api/committee/spam')]);
 $('nominations-state').textContent=n.open?'Online nominations are on. '+(n.mailConfigured?'Owner alerts are set up.':'Owner alerts are not set up yet.'):'Online nominations are switched off. The join form prepares an email instead.';
 const focus=(location.hash.match(/^#nominations\/(nomination|spam)\/([a-f0-9-]{36})$/)||[]);
 $('nomination-rows').innerHTML=n.nominations.map(x=>'<tr id="nomination-'+esc(x.id)+'"'+(focus[2]===x.id?' class="is-focus"':'')+'><td>'+esc(when(x.createdAt))+(x.origin==='released_from_spam'?'<br><small>Released from spam</small>':'')+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.email)+'</td><td>'+esc(x.pathway)+'</td><td>'+esc(x.town)+'</td><td>'+esc([x.interests,x.offer].filter(Boolean).join(' | '))+'</td><td>'+esc(ALERT[x.alertState]||x.alertState)+'</td></tr>').join('')||'<tr><td colspan="7">No nominations received yet.</td></tr>';
 $('spam-summary').textContent='Everything spam protection catches is kept here, separate from the register, and deleted automatically after '+q.retentionDays+' days. Storage is capped at '+q.hourlyCap+' items an hour'+(q.droppedOverflow?'; '+q.droppedOverflow+' more were counted but not stored':'')+'. No instant alert is sent for these; they appear in the daily 10:00 AM digest.';
 $('spam-rows').innerHTML=q.items.map(x=>'<tr id="spam-'+esc(x.id)+'"'+(focus[2]===x.id?' class="is-focus"':'')+'><td>'+esc(when(x.createdAt))+'</td><td>'+esc(x.reasonLabel)+(x.detail?'<br><small>'+esc(x.detail)+'</small>':'')+'</td><td>'+esc([x.name,x.email,x.pathway,x.town,x.interests,x.offer].filter(Boolean).join(' | ')||'No readable content')+'</td><td><small>'+esc(x.userAgent)+'</small></td><td>'+
  (readOnly?'View only':'<button type="button" class="button small" data-spam="genuine" data-id="'+esc(x.id)+'">Mark as genuine</button> <button type="button" class="button small outline" data-spam="delete" data-id="'+esc(x.id)+'">Delete</button>')+'</td></tr>').join('')||'<tr><td colspan="5">Nothing caught.</td></tr>';
 if(focus[2])document.getElementById((focus[1]==='spam'?'spam-':'nomination-')+focus[2])?.scrollIntoView({block:'center'});
 if(bound)return;bound=true;
 $('spam-rows').addEventListener('click',async e=>{
  const b=e.target.closest('[data-spam]');if(!b)return;
  const genuine=b.dataset.spam==='genuine';
  if(!confirm(genuine?'Move this item into the people register and send the usual owner alert?':'Delete this caught item permanently?'))return;
  b.disabled=true;
  try{await api('/api/committee/spam/'+b.dataset.id,{method:'POST',data:{action:b.dataset.spam}});status(genuine?'Moved to the register as a genuine nomination.':'Caught item deleted.');await loadNominations({api,esc,status,readOnly})}
  catch(err){status(err.message,true);b.disabled=false}
 });
}
