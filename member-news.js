// My Membership > Film club > Send in a local story for Island news.
const box=document.getElementById('film-news');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(n,c='fc-icon')=>'<svg class="'+c+'" aria-hidden="true" focusable="false"><use href="/assets/film-icons.svg#fc-'+n+'"></use></svg>';
const STATE={sent:'With the editors',published:'On Island news',declined:'Not published',withdrawn:'Withdrawn',unpublished:'Taken down'};
let data=null,msg='';
async function call(body){
 const r=await fetch('/api/member/news',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Island news is not available right now.');return d;
}
const today=()=>new Date(Date.now()+36e6).toISOString().slice(0,10);
function render(){
 if(!data){box.innerHTML='';return}
 if(!data.film){box.innerHTML='';return}
 box.innerHTML='<h3>'+icon('news')+' Send in a local story</h3><p class="club-note">Stories go to <a href="/news.html">Island news</a> once an officer has checked them. Host the video wherever you like (YouTube, Vimeo, PeerTube, your own site) and paste the link.</p>'+
  '<p role="status" class="fc-msg">'+esc(msg)+'</p>'+
  '<details class="fc-add"'+(data.stories.length?'':' open')+'><summary>New story</summary><form class="fc-kit-form" data-news-form>'+
  '<label>Headline<input name="title" maxlength="90" required placeholder="e.g. Sunset volleyball draws a crowd at Cylinder"></label>'+
  '<label>Short summary<textarea name="summary" rows="2" maxlength="300" required placeholder="Two or three lines: who, what, why it matters."></textarea></label>'+
  '<label>The full story (optional)<textarea name="body" rows="4" maxlength="4000"></textarea></label>'+
  '<label>Where<select name="place">'+data.places.map(p=>'<option>'+esc(p)+'</option>').join('')+'</select></label>'+
  '<label>When it happened<input type="date" name="happenedOn" max="'+today()+'" value="'+today()+'" required></label>'+
  '<label>Video link (optional)<input type="url" name="videoUrl" inputmode="url" placeholder="https://"></label>'+
  '<fieldset class="fc-share"><legend>Credit</legend><label class="ops-check"><input type="radio" name="credit" value="first" checked> My first name and Film Club</label><label class="ops-check"><input type="radio" name="credit" value="club"> Just “Sandy Sports Film Club”</label></fieldset>'+
  '<label class="club-consent"><input type="checkbox" name="peopleOk" required> Everyone shown is happy to be in it, and any under 18s have a parent or carer’s OK</label>'+
  '<button type="submit">Send to the editors</button></form></details>'+
  (data.stories.length?'<ul class="fc-list">'+data.stories.map(s=>'<li class="fc-req">'+icon(s.videoUrl?'camera':'news','fc-icon fc-icon-lg')+'<div><strong>'+esc(s.title)+'</strong><span>'+esc(s.place+' · '+s.happenedOn)+'</span><em>'+esc(STATE[s.state]||s.state)+'</em>'+(s.reviewNote?'<small>'+esc(s.reviewNote)+'</small>':'')+'</div><div class="fc-actions">'+(['sent','published'].includes(s.state)?'<button type="button" class="outline" data-news-withdraw="'+esc(s.id)+'">Withdraw</button>':'')+'</div></li>').join('')+'</ul>':'');
}
async function load(m=''){try{data=await call();msg=m;render()}catch(e){box.innerHTML=''}}
box?.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;
 try{data=await call({title:f.elements.title.value,summary:f.elements.summary.value,body:f.elements.body.value,place:f.elements.place.value,happenedOn:f.elements.happenedOn.value,videoUrl:f.elements.videoUrl.value,credit:f.elements.credit.value,peopleOk:f.elements.peopleOk.checked});msg='Sent. You’ll get a note when it’s on Island news.';render()}
 catch(err){msg=err.message;render()}
});
box?.addEventListener('click',async e=>{
 const id=e.target.closest('[data-news-withdraw]')?.dataset.newsWithdraw;if(!id||!confirm('Withdraw this story? It comes off Island news if it is up.'))return;
 try{data=await call({action:'withdraw',id});msg='Withdrawn.';render()}catch(err){msg=err.message;render()}
});
document.addEventListener('film-club-changed',()=>load());
if(box)fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(s?.authenticated&&s.identity?.role==='member'&&!s.readOnly)load()}).catch(()=>{});
