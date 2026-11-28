const slug = (location.pathname.split('/').pop() || 'index.html');
const here = slug.includes('.') ? slug : slug + '.html';
const pages = [
  ['index.html','Vision'],['sport-mixed-beach-volleyball.html','Beach volleyball'],['sports.html','All sand sports'],['flag-football.html','Flag football'],
  ['places.html','Three towns'],['programme.html','Events'],['film-club.html','Film club'],['news.html','Island news and live'],
  ['facilities.html','Facilities & assets'],['space-planner.html','Space planner'],
  ['grants.html','Grants & investment'],['store.html','Store'],['sponsors.html','Sponsors'],['donate.html','Donate & screen'],['join.html','Join / nominate'],
  ['clubhouse.html','Clubhouse'],['member-home.html','My membership'],['club-admin.html','My Clubhouse'],
  ['webmaster-members.html','Members & onboarding'],['constitution.html','Constitution'],['sources.html','Sources']
];
// The full page directory stays in the footer; the top navigation remains compact.
const primaryPages = [
  ['index.html','Vision'],['sports.html','Sports'],['places.html','Three towns'],
  ['facilities.html','Facilities'],['programme.html','Events'],['film-club.html','Film Club'],['news.html','News & live'],
  ['calendar.html','What’s on'],['grants.html','Funding'],['store.html','Store'],['image-gallery.html','Gallery'],['clubhouse.html','Club proposal'],['club-admin.html','My Clubhouse'],['club-login.html','Sign in']
];
// Sports menu: every sport page, with a direct link to its rules and equipment.
const sportMenu=[
  ['sport-mixed-beach-volleyball.html','Mixed beach volleyball'],['sport-flag-football.html','Flag football'],
  ['sport-beach-cricket.html','Beach cricket'],['sport-beach-football.html','Beach football'],
  ['sport-beach-rugby-league.html','Beach rugby league'],['sport-beach-5s-rugby.html','Beach 5s rugby'],
  ['sport-airbadminton.html','AirBadminton'],['sport-beach-tennis-and-net-games.html','Beach tennis and net games'],
  ['sport-ultimate-and-flying-disc.html','Ultimate and flying disc'],['sport-beach-handball.html','Beach handball'],
  ['sport-netball-crossover.html','Netball crossover'],['sport-afl-crossover.html','AFL crossover'],
  ['sport-fitness-and-movement.html','Fitness and movement'],['sport-island-made-formats.html','Island-made formats']
];
const sportsSub=`<div class="nav-sub" id="nav-sports" hidden><div class="nav-sub-head"><a href="/sports.html" ${here==='sports.html'?'aria-current="page"':''}>All sports</a><a href="/sports.html#survey">Sports survey</a><a href="/flag-football.html" ${here==='flag-football.html'?'aria-current="page"':''}>Flag football pathway</a></div><p class="nav-sub-title">Each sport: about, rules and equipment</p><ul class="nav-sport-list">${sportMenu.map(([url,label])=>`<li><a href="/${url}" ${here===url?'aria-current="page"':''}>${label}</a><a class="nav-rules" href="/${url}#how-its-played" aria-label="${label}: rules and equipment">Rules and equipment</a></li>`).join('')}</ul></div>`;
const mainSectionFor = page => {
  if(page==='index.html')return 'index.html';
  if(page==='sports.html'||page==='flag-football.html'||page.startsWith('sport-'))return 'sports.html';
  if(page==='places.html')return 'places.html';
  if(page==='image-gallery.html')return 'image-gallery.html';
  if(['facilities.html','space-planner.html','assets.html'].includes(page))return 'facilities.html';
  if(page==='film-club.html')return 'film-club.html';
  if(page==='news.html')return 'news.html';
  if(page==='programme.html')return 'programme.html';
  if(['grants.html','donate.html'].includes(page))return 'grants.html';
  if(page==='join.html')return 'join.html';
  if(['club-admin.html','club-login.html','member-home.html','social-studio.html'].includes(page))return 'club-admin.html';
  return 'clubhouse.html';
};
const navLink=(url,label)=>`<a href="/${url}" ${here===url?'aria-current="page"':mainSectionFor(here)===url?'data-section-active="true"':''}>${label}</a>`;
const nav = primaryPages.map(([url,label])=>url==='sports.html'?`<div class="nav-group">${navLink(url,label)}<button type="button" class="nav-sub-toggle" aria-expanded="false" aria-controls="nav-sports" aria-label="Show the sports menu"></button>${sportsSub}</div>`:navLink(url,label)).join('');
document.querySelector('[data-site-header]')?.insertAdjacentHTML('afterbegin',`<a class="skip" href="#main">Skip to content</a><div class="proposal-strip"><strong>CLUB PROPOSAL</strong><span>Facilities, events and membership shown here are proposed, unless explicitly marked otherwise.</span></div><header class="site-header"><a class="brand" href="/index.html"><img class="brand-mark" src="/assets/sandy-original-logo.png" alt=""><span>SANDY SPORTS<small>MINJERRIBAH · STRADDIE</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav id="nav" aria-label="Main navigation">${nav}</nav><a class="header-signin" id="club-header-account" href="/club-login.html" ${here==='club-login.html'?'aria-current="page"':''}>Sign in</a><a class="header-cta" href="/member-join.html" ${here==='member-join.html'?'aria-current="page"':''}>Join free</a></header>`);
// PLFC-style private clubhouse entry: show the actual dashboard when a real session exists.
// The endpoint checks the HttpOnly session cookie; nothing about the role is cached locally.
fetch('/api/session',{credentials:'same-origin',cache:'no-store'})
 .then(response=>response.ok?response.json():null)
 .then(session=>{
  const entry=document.getElementById('club-header-account');
  if(!entry||!session?.authenticated)return;
  document.querySelector('.header-cta')?.setAttribute('hidden','');
  if(session.identity?.role==='member'){
   entry.href='/member-home.html';entry.textContent='My Membership';
   // A count of new notices on the header button, so members see there is something waiting.
   fetch('/api/member/announcements?unread=1',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{
    if(!d?.unread)return;const b=document.createElement('span');b.className='hdr-badge';b.textContent=d.unread>9?'9+':String(d.unread);b.setAttribute('aria-label',d.unread+' new');
    b.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-width:1.4em;height:1.4em;margin-left:.35em;padding:0 .35em;border-radius:999px;background:#c62828;color:#fff;font-size:.75em;font-weight:900';
    entry.append(b);entry.setAttribute('aria-label','Open My Membership, '+d.unread+' new');
   }).catch(()=>{});
  }else{
   entry.href='/club-admin.html';entry.textContent='My Clubhouse';
  }
  entry.setAttribute('aria-label','Open your signed-in clubhouse workspace');
  if(here==='club-admin.html')entry.setAttribute('aria-current','page');
  else entry.removeAttribute('aria-current');
 })
 .catch(()=>{});
// Shared navigation is assembled once for every page.
const footerSections = [
  ['Explore',[['sports.html','Sports catalogue'],['sports.html#survey','Sports survey'],['places.html','Three towns'],['facilities.html','Facilities & sites'],['calendar.html','What’s on'],['programme.html','Events & programme'],['film-club.html','Film club'],['image-gallery.html','Image gallery']]],
  ['Build & back',[['member-join.html','Join free'],['join.html','Get involved'],['interest.html','Express interest'],['grants.html','Grants & funding'],['assets.html','Equipment wish list'],['donate.html','Screen funding concept'],['constitution.html','Draft constitution']]],
  ['Clubhouse & tools',[['clubhouse.html','Club proposal (illustrated)'],['member-home.html','My membership'],['club-admin.html','My Clubhouse (working dashboard)'],['club-login.html','Secure sign-in'],['social-studio.html','Social Studio']]]
];
const footerNav = footerSections.map(([title,items])=>`<nav aria-label="${title}"><strong>${title}</strong>${items.map(([url,label])=>`<a href="/${url}" ${here===url?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`).join('');
document.querySelector('[data-site-footer]')?.insertAdjacentHTML('afterbegin',`<footer><div class="footer-top"><div><a class="brand" href="/index.html"><img class="brand-mark" src="/assets/sandy-original-logo.png" alt=""><span>SANDY SPORTS<small>CLUB PROPOSAL</small></span></a><p>A proposal for island-wide sand sport, shared facilities, film and community life. No club or venue is yet established.</p></div>${footerNav}</div><div class="footer-bottom"><span>Proposal · No incorporated Sandy Sports Club or confirmed site is asserted.</span><span>Quandamooka Country · Minjerribah / North Stradbroke Island</span></div></footer><button class="guide-button" id="guide-button" aria-expanded="false" aria-controls="guide-panel"><img src="/assets/mozzie.webp" alt=""><span>Ask Mozzie</span></button><aside class="guide-panel" id="guide-panel" hidden><button class="guide-close" id="guide-close" aria-label="Close guide">×</button><img src="/assets/mozzie.webp" alt="Mozzie, Sandy Sports mascot"><h2>G'day, I'm Mozzie.</h2><p>Start with the sport ideas, explore three towns, or have your say on the proposal.</p><a href="/sports.html">Sports catalogue</a><a href="/places.html">Three towns</a><a href="/film-club.html">Film club</a><a href="/clubhouse.html">Clubhouse</a><a href="/join.html">Get involved</a></aside>`);
const route=(name,label)=>[name+'.html',label];
const sportGuide=[
  route('sport-flag-football','Flag football field guide'),
  route('sport-beach-cricket','Beach cricket'),route('sport-beach-football','Beach football'),
  route('sport-beach-rugby-league','Beach rugby league'),route('sport-beach-5s-rugby','Beach 5s rugby'),
  route('sport-airbadminton','AirBadminton'),route('sport-beach-tennis-and-net-games','Beach tennis and net games'),
  route('sport-ultimate-and-flying-disc','Ultimate and flying disc'),route('sport-beach-handball','Beach handball'),
  route('sport-netball-crossover','Netball crossover'),route('sport-afl-crossover','AFL crossover'),
  route('sport-fitness-and-movement','Fitness and movement'),route('sport-island-made-formats','Island-made formats')
];
const memberGuide=[
  route('member-sports','My sports'),route('member-training','Skills training'),route('member-calendar','Calendar'),
  route('member-equipment','Equipment'),route('member-film','Film membership'),route('member-crew','Event crew')
];
const committeeGuide=[
  route('committee-governance','Governance'),route('committee-sport','Sport operations'),
  route('committee-events','Events desk'),route('committee-film','Film governance'),
  route('committee-funding','Funding desk'),route('committee-assets','Asset desk'),
  route('committee-members','Membership'),route('committee-publishing','Publishing'),route('social-studio','Social Studio')
];
// Reading order follows a visitor's journey and includes each actual HTML page once.
const pageGroups = [
  ['Vision and sports',[pages[0],pages[2],pages[1],pages[3],...sportGuide]],
  ['Places and facilities',[pages[4],pages[8],pages[9],route('assets','Asset wish list')]],
  ['Events, film and backing',[route('calendar','What’s on'),pages[5],pages[6],pages[7],pages[10],pages[11],pages[12],route('interest','Express interest')]],
  ['Member clubhouse',[pages[13],route('member-home','My membership (future)'),pages[14],...memberGuide]],
  ['Committee and governance',[route('club-login','Secure sign-in'),route('club-admin','Shared administration'),pages[15],route('committee-governance','Governance'),pages[17],...committeeGuide.filter(([url])=>url!=='committee-governance.html'),pages[16],pages[18],route('image-gallery','Image gallery')]]
];
const allPages = pageGroups.flatMap(([,items])=>items);
const pageLink = ([url,label])=>`<a href="/${url}" ${here===url?'aria-current="page"':''}>${label}</a>`;
const pageGroupFor = url => pageGroups.find(([,items])=>items.some(([candidate])=>candidate===url))?.[0]||'Other pages';
const currentIndex = allPages.findIndex(([url])=>url===here);
const previous = currentIndex>0?allPages[currentIndex-1]:null;
const next = currentIndex>=0&&currentIndex<allPages.length-1?allPages[currentIndex+1]:null;
const footer=document.querySelector('footer');
if(currentIndex>=0&&!['club-admin.html','club-login.html','member-home.html','social-studio.html'].includes(here)){
  const cycleSide = (page,direction)=>{
    const group=pageGroupFor(page[0]);
    const sameGroup=group===pageGroupFor(here);
    const cue=direction==='prev'?'← Previous page':'Next page →';
    return `<a href="/${page[0]}" rel="${direction}"><span>${cue}${sameGroup?'':` · ${group}`}</span><strong>${page[1]}</strong></a>`;
  };
  const previousHtml=previous?cycleSide(previous,'prev'):'<span class="cycle-edge">Start of the guide</span>';
  const nextHtml=next?cycleSide(next,'next'):'<a class="cycle-end-link" href="/index.html#page-directory"><span>End of the guide</span><strong>Browse all topics</strong></a>';
  footer?.querySelector('.footer-top')?.insertAdjacentHTML('beforebegin',`<nav class="page-cycle" aria-label="Previous and next in the site guide">${previousHtml}<span class="cycle-count">${pageGroupFor(here)} · ${currentIndex+1} of ${allPages.length}</span>${nextHtml}</nav>`);
}
const directory=pageGroups.map(([title,items])=>`<details><summary>${title} <small>${items.length} pages</small></summary><div class="directory-links">${items.map(pageLink).join('')}</div></details>`).join('');
if(here==='index.html')footer?.querySelector('.footer-bottom')?.insertAdjacentHTML('beforebegin',`<section class="page-directory" id="page-directory" aria-label="All Sandy Sports pages"><h2>Explore all ${allPages.length} pages</h2><p>Open a section to find a sport, venue proposal, member area, committee tool or supporting document.</p><div class="directory-groups">${directory}</div></section>`);
document.querySelectorAll('.card > img').forEach(img=>{
  const label=document.createElement('small');
  label.className='image-kind';
  label.textContent=img.dataset.kind||((img.getAttribute('src')||'').startsWith('/assets/site-ballow-')?'Actual Ballow Road photo':'Concept image');
  img.insertAdjacentElement('afterend',label);
});
const menu=document.querySelector('.menu-toggle'), navEl=document.querySelector('#nav');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));navEl.classList.toggle('open',open)});
navEl?.addEventListener('click',e=>{if(e.target.closest('a')){navEl.classList.remove('open');menu.setAttribute('aria-expanded','false')}});
const subToggle=document.querySelector('.nav-sub-toggle'),subMenu=document.querySelector('#nav-sports');
function sportsMenu(open,focusToggle){if(!subToggle)return;subToggle.setAttribute('aria-expanded',String(open));subMenu.hidden=!open;subToggle.setAttribute('aria-label',open?'Hide the sports menu':'Show the sports menu');if(!open&&focusToggle)subToggle.focus()}
subToggle?.addEventListener('click',()=>sportsMenu(subMenu.hidden));
subMenu?.addEventListener('click',e=>{if(e.target.closest('a'))sportsMenu(false)});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(subMenu&&!subMenu.hidden){sportsMenu(false,true);return}if(navEl?.classList.contains('open')){navEl.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.focus()}});
document.addEventListener('click',e=>{if(subMenu&&!subMenu.hidden&&!e.target.closest('.nav-group'))sportsMenu(false)});
const guide=document.querySelector('#guide-panel'),guideButton=document.querySelector('#guide-button');
function guideOpen(open){guide.hidden=!open;guideButton.setAttribute('aria-expanded',String(open));if(open)document.querySelector('#guide-close').focus();else guideButton.focus()}
guideButton?.addEventListener('click',()=>guideOpen(guide.hidden));document.querySelector('#guide-close')?.addEventListener('click',()=>guideOpen(false));
guide?.addEventListener('click',e=>{if(e.target.closest('a'))guideOpen(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&guide&&!guide.hidden)guideOpen(false)});
document.querySelector('.footer-bottom')?.insertAdjacentHTML('beforeend','<span><a href="/index.html#page-directory">All pages</a> · <a href="/image-gallery.html">Image gallery</a> · <a href="/sources.html">Sources & credits</a> · <a href="/LICENCE.md">Interim licence</a> · <a href="https://auraofintelligence.github.io/strange-but-true/">Strange But True</a></span>');
document.body.insertAdjacentHTML('beforeend','<button class="back-to-top" type="button" aria-label="Back to top" title="Back to top" hidden>↑<span>Top</span></button>');
const backToTop=document.querySelector('.back-to-top');
function updateBackToTop(){backToTop.hidden=window.scrollY<450}
window.addEventListener('scroll',updateBackToTop,{passive:true});updateBackToTop();
backToTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
if(['club-admin.html','club-login.html','member-home.html','social-studio.html','constitution.html'].includes(here)){
 const helper=document.createElement('script');helper.src='/club-mozzie.js?v=20261124';helper.defer=true;
 document.body.append(helper);
}
// Show or hide the password in every password box, including forms drawn after the page loads.
(()=>{
 const eye='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
 const style=document.createElement('style');
 style.textContent='.password-wrap{position:relative;display:block;width:100%}.password-wrap input{padding-right:2.8rem!important}.password-eye{position:absolute;right:.35rem;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:2.2rem;height:2.2rem;min-height:0;padding:0;margin:0;border:0!important;border-radius:6px;background:transparent!important;color:#102d40!important;box-shadow:none!important;cursor:pointer}.password-eye[aria-pressed="true"]{color:#0a7481!important}.password-eye:focus-visible{outline:3px solid #0a7481}';
 document.head.append(style);
 const enhance=()=>{for(const input of document.querySelectorAll('input[type="password"]:not([data-eye])')){
  input.dataset.eye='1';const wrap=document.createElement('span');wrap.className='password-wrap';
  const button=document.createElement('button');button.type='button';button.className='password-eye';button.innerHTML=eye;
  button.setAttribute('aria-label','Show password');button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',show?'Hide password':'Show password')});
  input.replaceWith(wrap);wrap.append(input,button);
 }};
 enhance();new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
})();

// Live broadcast banner: one small cached check per page; shows only while the Film Club is streaming.
if(!/^(club-admin|club-login)\.html$/.test(here))fetch('/api/news?live=1',{credentials:'omit'}).then(r=>r.ok?r.json():null).then(d=>{
 const b=d?.live?.[0];if(!b||!b.streamUrl)return;
 const bar=document.createElement('div');bar.className='live-banner';bar.setAttribute('role','status');
 bar.style.cssText='display:flex;gap:.6rem;align-items:center;justify-content:center;flex-wrap:wrap;background:#c62828;color:#fff;padding:.45rem 1rem;font-weight:800;font-size:.92rem;text-align:center';
 const txt=document.createElement('span');txt.textContent='● LIVE NOW: '+b.title+(b.place?' · '+b.place:'');
 const a=document.createElement('a');a.href='/news.html#live';a.textContent='Watch';a.style.cssText='color:#fff;text-decoration:underline';
 bar.append(txt,a);document.querySelector('[data-site-header]')?.prepend(bar);
}).catch(()=>{});
