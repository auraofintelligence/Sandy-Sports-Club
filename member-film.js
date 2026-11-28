// My Membership > Film club: join by lane, list your own kit, borrow from the shared shelf.
const box=document.getElementById('film-club');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const icon=(n,cls='fc-icon')=>'<svg class="'+cls+'" aria-hidden="true" focusable="false"><use href="/assets/film-icons.svg#fc-'+n+'"></use></svg>';
const LANE_ICON={watch:'watch',make:'camera',crew:'live',learn:'learn'};
const STATE={asked:'Waiting for an answer',yes:'Yes, it’s yours for those days',no:'Not this time',returned:'Returned. Thanks!',withdrawn:'Withdrawn'};
let data=null,editing=null,asking=null,msg='';
async function call(body){
 const r=await fetch('/api/member/film',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Film Club is not available right now.');return d;
}
const nice=d=>{const t=Date.parse(d+'T12:00:00+10:00');return isNaN(t)?d:new Date(t).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'Australia/Brisbane'})};
const today=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
function lanesPicker(chosen=[]){
 return '<div class="fc-lanes">'+Object.entries(data.options.lanes).map(([k,l])=>{const [t,h]=l.split(': ');return '<label class="fc-lane"><input type="checkbox" name="lane" value="'+k+'"'+(chosen.includes(k)?' checked':'')+'>'+icon(LANE_ICON[k],'fc-icon fc-icon-lg')+'<span><strong>'+esc(t)+'</strong><small>'+esc(h)+'</small></span></label>'}).join('')+'</div>';
}
function kitForm(item={}){
 const o=data.options;
 return '<form class="fc-kit-form" data-fc-kit'+(item.id?' data-id="'+esc(item.id)+'"':'')+'>'+
  '<label>What is it?<input name="name" maxlength="80" required value="'+esc(item.name||'')+'" placeholder="e.g. Rode Wireless GO mic"></label>'+
  '<label>Type<select name="kind">'+Object.entries(o.kinds).map(([k,l])=>'<option value="'+k+'"'+(item.kind===k?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>'+
  '<fieldset class="fc-share"><legend>Who can use it?</legend>'+Object.entries(o.share).map(([k,l])=>'<label class="ops-check"><input type="radio" name="share" value="'+k+'"'+((item.share||'private')===k?' checked':'')+(k!=='private'&&!data.film?' disabled':'')+'> '+esc(l)+'</label>').join('')+'</fieldset>'+
  '<label>Care notes (optional)<input name="care" maxlength="300" value="'+esc(item.care||'')+'" placeholder="e.g. Charge before you return it. Keep it out of the sand."></label>'+
  '<p class="club-note">Never list where you keep it. Other members only see your first name, the item and your care notes.</p>'+
  '<button type="submit">'+(item.id?'Save':'Add to my kit')+'</button>'+(item.id?' <button type="button" class="outline" data-fc-cancel>Cancel</button>':'')+'</form>';
}
function kitRow(k,mine){
 const share=data.options.share[k.share]||'';
 return '<li class="fc-kit-item">'+icon(k.kind,'fc-icon fc-icon-lg')+'<div><strong>'+esc(k.name)+'</strong><span>'+esc(mine?share:(k.share==='with_me'?'Comes with '+k.owner:'Lent by '+k.owner))+'</span>'+(k.care?'<small>'+esc(k.care)+'</small>':'')+
  (mine?'':k.myRequest?'<em>'+esc(STATE[k.myRequest]||k.myRequest)+'</em>':'')+'</div><div class="fc-actions">'+
  (mine?'<button type="button" data-fc-edit="'+esc(k.id)+'">Edit</button><button type="button" class="outline" data-fc-remove="'+esc(k.id)+'">Remove</button>':
   (k.myRequest==='asked'?'':'<button type="button" data-fc-ask="'+esc(k.id)+'">'+(k.share==='with_me'?'Ask them to come along':'Ask to borrow')+'</button>'))+'</div>'+
  (asking===k.id?'<form class="fc-ask" data-fc-ask-form="'+esc(k.id)+'"><label>From<input type="date" name="from" min="'+today()+'" value="'+today()+'" required></label><label>Back by<input type="date" name="to" min="'+today()+'" value="'+today()+'"></label><label>What it’s for (optional)<input name="note" maxlength="300" placeholder="e.g. filming Saturday’s social volleyball"></label><button type="submit">Send request</button> <button type="button" class="outline" data-fc-cancel>Cancel</button></form>':'')+'</li>';
}
function reqRow(r,incoming){
 const btns=incoming?(r.state==='asked'?'<button type="button" data-fc-answer="yes" data-id="'+esc(r.id)+'">Yes</button><button type="button" class="outline" data-fc-answer="no" data-id="'+esc(r.id)+'">Not this time</button>':r.state==='yes'?'<button type="button" data-fc-answer="returned" data-id="'+esc(r.id)+'">It’s back</button>':'')
  :(['asked','yes'].includes(r.state)?'<button type="button" class="outline" data-fc-answer="withdraw" data-id="'+esc(r.id)+'">Withdraw</button>':'');
 return '<li class="fc-req"><div><strong>'+esc(r.kitName)+'</strong><span>'+esc((incoming?r.who+' would like it ':'From '+r.who+', ')+nice(r.from)+(r.to&&r.to!==r.from?' to '+nice(r.to):''))+'</span>'+(r.note?'<small>'+esc(r.note)+'</small>':'')+'<em>'+esc(STATE[r.state]||r.state)+'</em></div><div class="fc-actions">'+btns+'</div></li>';
}
function render(){
 if(!data){box.innerHTML='';return}
 const d=data,waiting=d.incoming.filter(r=>r.state==='asked');
 const kinds=[...new Set(d.shelf.map(k=>k.kind))];
 box.innerHTML='<p role="status" class="fc-msg">'+esc(msg)+'</p>'+
  (d.film?'<div class="fc-joined">'+icon('clapper','fc-icon fc-icon-lg')+'<div><strong>You’re in the Film Club</strong><span>'+d.members+' member'+(d.members===1?'':'s')+' so far · '+d.lanes.map(l=>esc(d.options.lanes[l].split(':')[0])).join(', ')+'</span></div><details class="fc-change"><summary>Change</summary><form data-fc-join>'+lanesPicker(d.lanes)+'<button type="submit">Save</button> <button type="button" class="outline" data-fc-leave>Leave Film Club</button></form></details></div>':
   '<form class="fc-join" data-fc-join><h3>Join the Film Club</h3><p>Free for members. Bring a phone: that’s enough to start. Pick how you’d like to take part (you can change it any time).</p>'+lanesPicker(['watch'])+'<button type="submit">Join the Film Club</button></form>')+
  (waiting.length||d.incoming.length?'<h3>'+icon('share')+' Requests for your kit'+(waiting.length?' <span class="nav-badge urgent">'+waiting.length+'</span>':'')+'</h3><ul class="fc-list">'+d.incoming.map(r=>reqRow(r,true)).join('')+'</ul>':'')+
  (d.film?'<h3>'+icon('kit')+' Kit shelf</h3><p class="club-note">Gear other Film Club members are happy to lend or bring along. Ask, agree the days, look after it, give it back charged.</p>'+
   (d.shelf.length?(kinds.length>1?'<div class="fc-filter" role="group" aria-label="Show kit">'+['all',...kinds].map(k=>'<button type="button" data-fc-filter="'+k+'"'+(k==='all'?' aria-pressed="true"':'')+'>'+(k==='all'?'All':icon(k)+esc(d.options.kinds[k].split(' or ')[0]))+'</button>').join('')+'</div>':'')+'<ul class="fc-list" data-fc-shelf>'+d.shelf.map(k=>kitRow(k,false).replace('<li class="fc-kit-item">','<li class="fc-kit-item" data-kind="'+esc(k.kind)+'">')).join('')+'</ul>':'<p>No kit on the shelf yet. Add yours below and choose “Lend to Film Club members”.</p>'):'')+
  (d.outgoing.length?'<h3>'+icon('calendar')+' Kit I’ve asked for</h3><ul class="fc-list">'+d.outgoing.map(r=>reqRow(r,false)).join('')+'</ul>':'')+
  '<h3>'+icon('camera')+' My kit</h3>'+(d.myKit.length?'<ul class="fc-list">'+d.myKit.map(k=>editing===k.id?'<li class="fc-kit-item editing">'+kitForm(k)+'</li>':kitRow(k,true)).join('')+'</ul>':'<p>List what you’ve got, even just a phone. It helps plan shoots. Items stay private unless you choose to lend them.</p>')+
  (editing?'':'<details class="fc-add"'+(d.myKit.length?'':' open')+'><summary>Add kit</summary>'+kitForm()+'</details>');
}
async function load(m=''){try{data=await call();msg=m;render()}catch(e){box.innerHTML='<p>'+esc(e.message)+'</p>'}}
async function act(body,done){try{data=await call(body);msg=done;editing=null;asking=null;render();document.dispatchEvent(new CustomEvent('film-club-changed'))}catch(e){msg=e.message;render()}}
box?.addEventListener('submit',e=>{
 e.preventDefault();const f=e.target;
 if(f.matches('[data-fc-join]'))return act({action:'join',lanes:[...f.querySelectorAll('[name=lane]:checked')].map(i=>i.value)},data.film?'Saved.':'Welcome to the Film Club!');
 if(f.matches('[data-fc-kit]'))return act({action:'kit-save',id:f.dataset.id||'',name:f.elements.name.value,kind:f.elements.kind.value,share:f.elements.share.value,care:f.elements.care.value},'Kit saved.');
 if(f.matches('[data-fc-ask-form]'))return act({action:'ask',kitId:f.dataset.fcAskForm,from:f.elements.from.value,to:f.elements.to.value,note:f.elements.note.value},'Request sent. They’ll see it in their Film club tab.');
});
box?.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.fcEdit){editing=b.dataset.fcEdit;asking=null;render()}
 else if(b.hasAttribute('data-fc-cancel')){editing=null;asking=null;render()}
 else if(b.dataset.fcAsk){asking=b.dataset.fcAsk;render();box.querySelector('[data-fc-ask-form] input')?.focus()}
 else if(b.dataset.fcRemove){if(confirm('Remove this from your kit list?'))act({action:'kit-remove',id:b.dataset.fcRemove},'Removed.')}
 else if(b.dataset.fcAnswer)act({action:b.dataset.fcAnswer,id:b.dataset.id},{yes:'Thanks for lending it.',no:'Done. They’ll be told.',returned:'Marked as returned.',withdraw:'Request withdrawn.'}[b.dataset.fcAnswer]);
 else if(b.hasAttribute('data-fc-leave')){if(confirm('Leave the Film Club? Kit you were lending goes back to just yours.'))act({action:'leave'},'You’ve left the Film Club. You can rejoin any time.')}
 else if(b.dataset.fcFilter){box.querySelectorAll('[data-fc-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));box.querySelectorAll('[data-fc-shelf] [data-kind]').forEach(li=>li.hidden=b.dataset.fcFilter!=='all'&&li.dataset.kind!==b.dataset.fcFilter)}
});
if(box)fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(s?.authenticated&&s.identity?.role==='member'&&!s.readOnly)load()}).catch(()=>{});
