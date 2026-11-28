// My Membership > Notices: the meeting archive. Rule 4B: every meeting is recorded on video and audio,
// archived permanently, and every member can watch it.
const box=document.getElementById('member-meetings');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=d=>d?new Date(d+'T12:00:00+10:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'}):'';
const link=(u,l)=>u?'<a class="button outline" href="'+esc(u)+'" target="_blank" rel="noopener">'+l+'</a>':'';
if(box)fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{
 if(!s?.authenticated||s.identity?.role!=='member')return;
 return fetch('/api/member/meetings',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{
  if(!d)return;
  box.innerHTML='<h3>Meeting archive</h3><p class="club-note">Every committee and general meeting is recorded on video and audio and kept here permanently (draft constitution rule 4B).</p>'+
   (d.meetings.length?'<ul class="fc-list">'+d.meetings.map(m=>'<li class="fc-req"><div><strong>'+esc(m.title)+'</strong><span>'+esc([m.type,day(m.date)].filter(Boolean).join(' · '))+'</span>'+(m.minutesApproved?'<em>Minutes approved</em>':'<em>Minutes not yet approved</em>')+'</div><div class="fc-actions">'+
    link(m.archive.video,'Watch')+link(m.archive.audio,'Listen')+link(m.archive.transcript,'Transcript')+'</div></li>').join('')+'</ul>':'<p>No meetings archived yet.</p>');
 });
}).catch(()=>{});
