// My profile > Email notifications: how often a member hears about new things in My Clubhouse.
const box=document.getElementById('member-notify');
const OPTIONS=[['instant','As they arrive','At most one email an hour, never between 9pm and 7am.'],['daily','Daily','One email at 7am if there is anything new.'],['weekly','Weekly','Monday at 7am. Most people pick this.'],['monthly','Monthly','On the 1st of the month.'],['never','Never','Just show me in My Clubhouse.']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(method='GET',body){
 const r=await fetch('/api/member/notifications',{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Could not load your settings.');return d;
}
function render(s,msg=''){
 box.innerHTML='<details class="member-workspace-form" open><summary>Email notifications</summary><form id="notify-form"><fieldset class="notify-options"><legend>Email me when there’s something new in My Clubhouse</legend>'+
  OPTIONS.map(([v,l,h])=>'<label class="notify-option"><input type="radio" name="frequency" value="'+v+'"'+(s.frequency===v?' checked':'')+'><span><strong>'+l+'</strong><small>'+h+'</small></span></label>').join('')+'</fieldset>'+
  '<label class="club-consent"><input type="checkbox" name="urgent"'+(s.urgent?' checked':'')+'> Always tell me straight away if an event I said I’m going to is changed or cancelled</label>'+
  '<p class="club-note">'+(s.emailEnabled?'Emails list what’s new with a link to sign in. They never include other members’ details.':'Club emails aren’t switched on yet. Until they are, new things show here with a red badge.')+(s.waiting?' '+s.waiting+' waiting for your next email.':'')+'</p>'+
  '<button type="submit">Save</button> <span role="status" id="notify-status">'+esc(msg)+'</span></form></details>';
}
box?.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;
 try{render(await call('POST',{frequency:f.elements.frequency.value,urgent:f.elements.urgent.checked}),'Saved.')}catch(err){document.getElementById('notify-status').textContent=err.message}
});
if(box)fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(s?.authenticated&&s.identity?.role==='member'&&!s.readOnly)call().then(d=>render(d)).catch(()=>{})}).catch(()=>{});
