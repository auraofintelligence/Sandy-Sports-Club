// Island news and live: published stories and broadcasts from /api/news.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(n,c='fc-icon')=>'<svg class="'+c+'" aria-hidden="true" focusable="false"><use href="/assets/film-icons.svg#fc-'+n+'"></use></svg>';
const when=iso=>new Date(iso).toLocaleString('en-AU',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Brisbane'});
const day=d=>new Date(d+'T12:00:00+10:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const q=s=>document.querySelector(s);
const watch=(url,host,label)=>url?'<a class="button coral" href="'+esc(url)+'" target="_blank" rel="noopener">'+icon('play')+' '+esc(label)+(host?' <small>on '+esc(host)+'</small>':'')+'</a>':'';
function story(s){
 return '<div class="news-item">'+icon(s.videoUrl?'camera':'news','fc-icon fc-icon-lg')+'<div><span class="news-meta">'+esc(s.place)+' · '+esc(day(s.happenedOn))+'</span><h3>'+esc(s.title)+'</h3><p>'+esc(s.summary)+'</p>'+
  (s.body?'<details><summary>Read more</summary>'+s.body.split(/\n+/).map(p=>'<p>'+esc(p)+'</p>').join('')+'</details>':'')+
  '<span class="news-by">'+esc(s.byline)+'</span>'+(s.videoUrl?watch(s.videoUrl,s.videoHost,'Watch'):'')+'</div></div>';
}
const cast=(b,label)=>'<div class="news-row">'+icon(label==='Replay'?'play':'live','fc-icon fc-icon-lg')+'<div><strong>'+esc(b.title)+'</strong><span>'+esc(when(b.startsAt)+' · '+b.place)+'</span>'+(b.about?'<small>'+esc(b.about)+'</small>':'')+'</div>'+(label==='Replay'?watch(b.replayUrl,b.streamHost,'Replay'):b.streamUrl?'<a class="button outline" href="'+esc(b.streamUrl)+'" target="_blank" rel="noopener">Stream link</a>':'')+'</div>';
fetch('/api/news',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{
 if(d.live.length){q('#live').hidden=false;q('[data-news-live]').innerHTML=d.live.map(b=>'<div class="news-live-card"><span class="live-dot" aria-hidden="true"></span><div><h2>'+esc(b.title)+'</h2><p>'+esc(b.place)+(b.about?' · '+esc(b.about):'')+'</p></div>'+watch(b.streamUrl,b.streamHost,'Watch live')+'</div>').join('')}
 q('[data-news-stories]').innerHTML=d.stories.length?d.stories.map(story).join(''):'<p>No stories yet. The first ones arrive with the summer season, and yours could be one of them.</p>';
 q('[data-news-upcoming]').innerHTML=d.upcoming.length?d.upcoming.map(b=>cast(b,'Upcoming')).join(''):'<p>No broadcasts scheduled yet. Check back during the summer season.</p>';
 q('[data-news-replays]').innerHTML=d.replays.length?d.replays.map(b=>cast(b,'Replay')).join(''):'<p>Replays will show here after each broadcast.</p>';
}).catch(()=>{q('[data-news-stories]').innerHTML='<p>News is not available right now.</p>'});
