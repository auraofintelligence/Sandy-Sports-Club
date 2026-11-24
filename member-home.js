const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;',">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
async function api(path,options={}){
 const response=await fetch(path,{method:options.method||'GET',credentials:'same-origin',cache:'no-store',
  ...(options.method?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Shared club service is unavailable.');
 return data;
}
function setState(t,failed=false){const e=$('member-state');e.textContent=t;e.className='club-status'+(failed?' bad':'')}
(async()=>{
 try{
  const session=await api('/api/session');
  if(!session.storageReady||!session.authReady){setState('The shared member system is not activated yet. No personal data is stored by this page.',true);return}
  if(!session.authenticated){setState('Sign in with an active club account to see your own member record.');return}
  if(session.identity?.role==='webmaster_demo'){setState('The webmaster demo cannot view real memberships. Use the synthetic account preview instead.',true);return}
  if(!['member','webmaster','president','secretary'].includes(session.identity?.role)){setState('This account has no member-space view.',true);return}
  const [person,events]=await Promise.all([api('/api/member/me'),api('/api/member/events')]);
  $('member-panel').hidden=false;
  const profile=person.profile;
  $('member-summary').innerHTML=[
   ['Account',person.identity.name],['Member status',profile?.status||'Not linked'],
   ['Joining date',profile?.joinedOn||'Not recorded'],['Renewal date',profile?.renewalOn||'Not recorded']
  ].map(([name,val])=>'<div class="club-summary-card"><strong>'+esc(val)+'</strong><span>'+esc(name)+'</span></div>').join('');
  $('member-profile').innerHTML=profile?
   '<p><strong>Name:</strong> '+esc(profile.name)+'</p><p><strong>Class:</strong> '+esc(profile.membershipClass)+'</p>'+
   '<p><strong>Town:</strong> '+esc(profile.town||'Unspecified')+'</p>':
   '<p>No membership profile is linked to this account. That is expected while the club remains a proposal.</p>';
  $('member-events').innerHTML=events.events.length?
   events.events.map(e=>'<article class="club-record-card"><strong>'+esc(e.title)+'</strong> · '+esc(e.date)+'</article>').join(''):
   '<p>No formally approved future club events.</p>';
  setState('Signed in securely. Only your own linked member record is displayed.');
 }catch(e){setState('Member records are not available: '+e.message,true)}
})();
$('member-logout')?.addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'})}finally{location.href='/club-login.html'}});
