// Committee room > Island news and live: check members' stories before they go public, and
// schedule and run live broadcasts. Copies go to the Minjerribah Screen Media Network (Markdown)
// and the Straddie Noticeboard Network (notice-feed.v1) for their own stewards.
import {isReadOnlyView} from './club-view-client.js';
const icon=(n,c='fc-icon')=>'<svg class="'+c+'" aria-hidden="true" focusable="false"><use href="/assets/film-icons.svg#fc-'+n+'"></use></svg>';
const STORY={sent:'Waiting',published:'On Island news',declined:'Not published',unpublished:'Taken down'};
const CAST={scheduled:'Scheduled',live:'LIVE NOW',ended:'Ended',cancelled:'Cancelled'};
const when=iso=>new Date(iso).toLocaleString('en-AU',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Brisbane'});
const localInput=iso=>{if(!iso)return '';const d=new Date(Date.parse(iso)+36e6);return d.toISOString().slice(0,16)};
export function setupNewsDesk({api,esc:e,status}){
 const root=document.getElementById('committee-news-desk');
 if(!root)return {open(){},close(){}};
 let data=null,epoch=0,editing=null,tab='stories';
 const ro=()=>isReadOnlyView()||!data?.canPublish;
 const say=(m,bad=false)=>{const n=root.querySelector('[data-nd-message]');if(n){n.textContent=m;n.classList.toggle('bad',bad)}if(bad)status?.(m,true)};
 function storyMarkdown(s){
  return ['---','title: "'+s.title.replace(/"/g,"'")+'"','place: '+s.place,'date: '+s.happenedOn,'source: Sandy Sports Film Club','credit: '+s.byline,s.videoUrl?'video: '+s.videoUrl:'','link: '+location.origin+'/news.html','---','',s.summary,'',s.body||''].filter((l,i,a)=>l!==''||a[i-1]!=='').join('\n').trim()+'\n';
 }
 function castNotice(b){
  const start=new Date(Date.parse(b.startsAt)-5*864e5),slug=b.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
  return {id:'sandy-live-'+slug+'-'+b.startsAt.slice(0,10),status:'approved',title:('Live: '+b.title).slice(0,90),publisher:'Sandy Sports Film Club',place:b.place,category:'Clubs & sport',
   summary:('Streamed live '+when(b.startsAt)+(b.about?'. '+b.about:'')).slice(0,200),sourceUrl:location.origin+'/news.html',reviewedBy:'',reviewedAt:'',
   startsAt:start.toISOString().slice(0,10)+'T08:00:00+10:00',expiresAt:new Date(Date.parse(b.startsAt)+4*36e5).toISOString().replace(/\.\d+Z$/,'Z'),outlets:['web','tv','kiosk']};
 }
 function stories(){
  const s=data.stories,waiting=s.filter(x=>x.state==='sent');
  if(!s.length)return '<p class="ops-empty">No stories yet. Film Club members send them in from the Film club tab in My Membership.</p>';
  return (waiting.length?'<p class="mt-help">'+waiting.length+' waiting. Check everyone shown is OK with it, tidy the headline if needed, then publish.</p>':'')+'<ul class="fc-list">'+s.map(x=>
   '<li class="fc-req" data-nd-story="'+e(x.id)+'">'+icon(x.videoUrl?'camera':'news','fc-icon fc-icon-lg')+'<div><strong>'+e(x.title)+'</strong><span>'+e(x.place+' · '+x.happenedOn+' · from '+x.author)+'</span><em>'+e(STORY[x.state]||x.state)+'</em><small>'+e(x.summary)+'</small>'+
   (x.videoUrl?'<a href="'+e(x.videoUrl)+'" target="_blank" rel="noopener">Watch the video ('+e(x.videoHost)+')</a>':'')+
   (x.body?'<details><summary>Full story</summary><p>'+e(x.body)+'</p></details>':'')+
   (x.state==='sent'&&!ro()?'<form class="fc-kit-form" data-nd-review><label>Headline<input name="title" maxlength="90" value="'+e(x.title)+'"></label><label>Summary<textarea name="summary" rows="2" maxlength="300">'+e(x.summary)+'</textarea></label><label>Note to the maker (optional)<input name="note" maxlength="300"></label><div class="fc-actions"><button type="submit" name="go" value="publish">Publish to Island news</button><button type="submit" name="go" value="decline" class="outline">Not this time</button></div></form>':'')+
   '</div><div class="fc-actions">'+(x.state==='published'&&!ro()?'<button type="button" class="outline" data-nd-unpublish>Take down</button>':'')+(x.state==='published'?'<button type="button" data-nd-md>Copy for the Screen Media Network</button>':'')+'</div></li>').join('')+'</ul><textarea data-nd-out rows="8" readonly hidden aria-label="Copied text"></textarea>';
 }
 function castForm(b={}){
  return '<form class="fc-kit-form" data-nd-cast'+(b.id?' data-id="'+e(b.id)+'"':'')+'><label>What’s being streamed<input name="title" maxlength="90" required value="'+e(b.title||'')+'" placeholder="e.g. Saturday social volleyball finals"></label>'+
   '<label>Where<select name="place">'+data.places.map(p=>'<option'+(b.place===p?' selected':'')+'>'+e(p)+'</option>').join('')+'</select></label>'+
   '<label>Starts<input type="datetime-local" name="startsAt" required value="'+e(localInput(b.startsAt))+'"></label>'+
   '<label>About (optional)<input name="about" maxlength="600" value="'+e(b.about||'')+'"></label>'+
   '<label>Stream link (any platform)<input type="url" name="streamUrl" placeholder="https://" value="'+e(b.stream||'')+'"></label>'+
   '<label>Replay link (after it ends)<input type="url" name="replayUrl" placeholder="https://" value="'+e(b.replayUrl||'')+'"></label>'+
   '<label>Crew (names and jobs, private)<textarea name="crew" rows="2" maxlength="600">'+e(b.crew||'')+'</textarea></label>'+
   '<div class="fc-actions"><button type="submit">'+(b.id?'Save':'Schedule broadcast')+'</button>'+(b.id?'<button type="button" class="outline" data-nd-cancel-edit>Cancel</button>':'')+'</div></form>';
 }
 function broadcasts(){
  const list=data.broadcasts;
  return (ro()?'':'<details class="fc-add"'+(list.length?'':' open')+'><summary>Schedule a live broadcast</summary>'+castForm()+'</details>')+
   '<p class="mt-help">Stream on any platform you like. The public page and a red “Live now” bar across the site link to it while it’s on.</p>'+
   (list.length?'<ul class="fc-list">'+list.map(b=>editing===b.id?'<li class="fc-req">'+castForm(b)+'</li>':
    '<li class="fc-req" data-nd-castid="'+e(b.id)+'">'+icon(b.state==='ended'?'play':'live','fc-icon fc-icon-lg')+'<div><strong>'+e(b.title)+'</strong><span>'+e(when(b.startsAt)+' · '+b.place)+'</span><em'+(b.state==='live'?' class="nd-live"':'')+'>'+e(CAST[b.state])+'</em>'+(b.crew?'<small>Crew: '+e(b.crew)+'</small>':'')+(b.stream?'<small>'+e(b.stream)+'</small>':'<small>No stream link yet</small>')+'</div><div class="fc-actions">'+
    (ro()?'':(b.state==='scheduled'?'<button type="button" data-nd-go="live">Go live</button><button type="button" class="outline" data-nd-edit>Edit</button><button type="button" class="outline" data-nd-go="cancelled">Cancel</button>':'')+
     (b.state==='live'?'<button type="button" data-nd-go="ended">End broadcast</button>':'')+(b.state==='ended'?'<button type="button" class="outline" data-nd-edit>Add replay link</button>':''))+
    (b.state==='scheduled'?'<button type="button" data-nd-board>Copy for the noticeboard</button>':'')+'</div></li>').join('')+'</ul>':'<p class="ops-empty">No broadcasts yet.</p>')+'<textarea data-nd-out rows="8" readonly hidden aria-label="Copied text"></textarea>';
 }
 function render(){
  const waiting=data.stories.filter(x=>x.state==='sent').length,live=data.broadcasts.filter(b=>b.state==='live').length;
  root.innerHTML='<header class="ops-header"><div><h3 id="nd-desk-title" tabindex="-1">'+icon('news')+' Island news and live</h3><p>Check Film Club stories before they go public, and run live broadcasts. Part of the Minjerribah Screen Media Network.</p></div><button type="button" data-nd-refresh>Check now</button></header>'+
   (isReadOnlyView()?'<p class="ops-boundary">View-only preview. Nothing can be changed.</p>':!data.canPublish?'<p class="ops-boundary">Publishing is done by the Webmaster, President or Vice President, Secretary or Assistant Secretary, or Treasurer. You can see what is waiting.</p>':'')+
   '<p data-nd-message role="status"></p><div class="fc-filter" role="tablist"><button type="button" data-nd-tab="stories" aria-pressed="'+(tab==='stories')+'">'+icon('news')+'Stories'+(waiting?' ('+waiting+')':'')+'</button><button type="button" data-nd-tab="live" aria-pressed="'+(tab==='live')+'">'+icon('live')+'Broadcasts'+(live?' (live)':'')+'</button><a class="md-btn ghost" href="/news.html" target="_blank" rel="noopener">Open Island news</a></div>'+
   (tab==='stories'?stories():broadcasts());
 }
 async function load(){const my=++epoch;root.hidden=false;root.textContent='Loading…';try{const d=await api('/api/committee/news');if(my!==epoch)return;data=d;render()}catch(err){if(my===epoch){root.innerHTML='<p class="ops-empty">Could not load this desk: '+e(err.message)+'</p>';status?.(err.message,true)}}}
 async function post(body,done){try{data=await api('/api/committee/news',{method:'POST',data:body});editing=null;render();say(done)}catch(err){say(err.message,true)}}
 async function copy(text,done){const out=root.querySelector('[data-nd-out]');out.value=text;out.hidden=false;try{await navigator.clipboard.writeText(text);say(done)}catch{out.select();say('Select the text and copy it.')}}
 root.addEventListener('submit',ev=>{
  ev.preventDefault();const f=ev.target;
  if(f.matches('[data-nd-review]')){const go=ev.submitter?.value||'publish';return post({action:go,id:f.closest('[data-nd-story]').dataset.ndStory,title:f.elements.title.value,summary:f.elements.summary.value,note:f.elements.note.value},go==='publish'?'Published to Island news. The maker has been told.':'Done. The maker has been told.')}
  if(f.matches('[data-nd-cast]')){const v=f.elements,local=v.startsAt.value;return post({action:'broadcast-save',id:f.dataset.id||'',title:v.title.value,place:v.place.value,startsAt:local?local+':00+10:00':'',about:v.about.value,streamUrl:v.streamUrl.value,replayUrl:v.replayUrl.value,crew:v.crew.value},'Saved.')}
 });
 root.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.ndTab){tab=b.dataset.ndTab;editing=null;render();return}
  if(b.hasAttribute('data-nd-refresh'))return load();
  const sid=b.closest('[data-nd-story]')?.dataset.ndStory,cid=b.closest('[data-nd-castid]')?.dataset.ndCastid;
  if(b.hasAttribute('data-nd-unpublish')){if(confirm('Take this story off Island news?'))post({action:'unpublish',id:sid},'Taken down.');return}
  if(b.hasAttribute('data-nd-md'))return copy(storyMarkdown(data.stories.find(x=>x.id===sid)),'Copied as Markdown for the Screen Media Network.');
  if(b.hasAttribute('data-nd-board'))return copy(JSON.stringify(castNotice(data.broadcasts.find(x=>x.id===cid)),null,1),'Copied for the noticeboard steward.');
  if(b.hasAttribute('data-nd-edit')){editing=cid;render();return}
  if(b.hasAttribute('data-nd-cancel-edit')){editing=null;render();return}
  if(b.dataset.ndGo){const go=b.dataset.ndGo;if(go==='cancelled'&&!confirm('Cancel this broadcast?'))return;post({action:go,id:cid},{live:'You’re live. The red bar is up across the site.',ended:'Ended. Add the replay link when it’s ready.',cancelled:'Cancelled.'}[go])}
 });
 return {async open(){tab='stories';editing=null;await load();root.querySelector('#nd-desk-title')?.focus({preventScroll:true})},close(){epoch++;root.hidden=true}};
}
