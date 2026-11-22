const here = (location.pathname.split('/').pop() || 'index.html');
const pages = [
  ['index.html','Vision'],['sport-mixed-beach-volleyball.html','Beach volleyball'],['sports.html','All sand sports'],['flag-football.html','Flag football'],
  ['places.html','Three towns'],['programme.html','Events'],['film-club.html','Film club'],
  ['facilities.html','Facilities & assets'],['space-planner.html','Space planner'],
  ['grants.html','Grants & investment'],['donate.html','Donate & screen'],['join.html','Join / nominate'],
  ['clubhouse.html','Clubhouse'],['members.html','Members'],['committee.html','Committee'],
  ['webmaster.html','Webmaster'],['constitution.html','Constitution'],['sources.html','Sources']
];
const primaryPages = [pages[0],pages[1],pages[2],pages[3],pages[4],pages[5],pages[6],pages[9],pages[11],pages[12]];
const nav = primaryPages.map(([url,label])=>`<a href="/${url}" ${here===url?'aria-current="page"':''}>${label}</a>`).join('');
document.querySelector('[data-site-header]')?.insertAdjacentHTML('afterbegin',`<a class="skip" href="#main">Skip to content</a><div class="proposal-strip"><strong>CLUB PROPOSAL</strong><span>Facilities, events and membership shown here are proposed, unless explicitly marked otherwise.</span></div><header class="site-header"><a class="brand" href="/index.html"><img class="brand-mark" src="/assets/sandy-original-logo.png" alt=""><span>SANDY SPORTS<small>MINJERRIBAH · STRADDIE</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav id="nav" aria-label="Main navigation">${nav}</nav><a class="header-cta" href="/clubhouse.html">Explore the club</a></header>`);
document.querySelector('[data-site-footer]')?.insertAdjacentHTML('afterbegin',`<footer><div class="footer-top"><div><a class="brand" href="/index.html"><img class="brand-mark" src="/assets/sandy-original-logo.png" alt=""><span>SANDY SPORTS<small>CLUB PROPOSAL</small></span></a><p>A proposed island-wide club built around mixed sand sport, three towns and shared creative facilities.</p></div><div><strong>Explore</strong><a href="/sports.html">Sports</a><a href="/places.html">Places</a><a href="/facilities.html">Facilities</a><a href="/film-club.html">Film club</a><a href="/grants.html">Funding</a></div><div><strong>Clubhouse</strong><a href="/members.html">Member demo</a><a href="/committee.html">Committee demo</a><a href="/webmaster.html">Webmaster & demo</a><a href="/assets.html">Asset wish list</a><a href="/sources.html">Sources & credits</a></div></div><div class="footer-bottom"><span>Proposal · No incorporated Sandy Sports Club or confirmed site is asserted.</span><span>Quandamooka Country · Minjerribah / North Stradbroke Island</span></div></footer><button class="guide-button" id="guide-button" aria-expanded="false" aria-controls="guide-panel"><img src="/assets/mozzie.webp" alt=""><span>Ask Mozzie</span></button><aside class="guide-panel" id="guide-panel" hidden><button class="guide-close" id="guide-close" aria-label="Close guide">×</button><img src="/assets/mozzie.webp" alt="Mozzie, Sandy Sports mascot"><h2>G'day, I'm Mozzie.</h2><p>Have a look at the sports, all three towns, the film club and the proposed clubhouse desks.</p><a href="/sports.html">Sports catalogue</a><a href="/places.html">Three towns</a><a href="/film-club.html">Film club</a><a href="/clubhouse.html">Clubhouse</a><a href="/grants.html">Grants & investment</a></aside>`);
const route=(name,label)=>[name+'.html',label];
const sportGuide=[
  route('sport-beach-cricket','Beach cricket'),route('sport-beach-football','Beach football'),
  route('sport-beach-rugby-league','Beach rugby league'),route('sport-beach-5s-rugby','Beach 5s rugby'),
  route('sport-airbadminton','AirBadminton'),route('sport-beach-tennis-and-net-games','Beach tennis and net games'),
  route('sport-ultimate-and-flying-disc','Ultimate and flying disc'),route('sport-beach-handball','Beach handball'),
  route('sport-netball-crossover','Netball crossover'),route('sport-afl-crossover','AFL crossover'),
  route('sport-fitness-and-movement','Fitness and movement'),route('sport-island-made-formats','Island-made formats'),
  route('sport-flag-football','Flag football field guide')
];
const memberGuide=[
  route('member-sports','My sports'),route('member-training','Skills training'),route('member-calendar','Calendar'),
  route('member-equipment','Equipment'),route('member-film','Film membership'),route('member-crew','Event crew')
];
const committeeGuide=[
  route('committee-governance','Governance'),route('committee-sport','Sport operations'),
  route('committee-events','Events desk'),route('committee-film','Film governance'),
  route('committee-funding','Funding desk'),route('committee-assets','Asset desk'),
  route('committee-members','Membership'),route('committee-publishing','Publishing')
];
const pageGroups=[
  ['Sports',[pages[0],pages[1],pages[2],pages[3],...sportGuide]],
  ['Places and facilities',[pages[4],pages[8],pages[7],route('assets','Asset wish list')]],
  ['Events and backing',[pages[5],pages[6],pages[9],pages[10],pages[11]]],
  ['Member clubhouse',[pages[12],pages[13],...memberGuide]],
  ['Committee and governance',[pages[14],...committeeGuide,pages[15],pages[16],pages[17]]]
];
const allPages=pageGroups.flatMap(([,items])=>items);
const pageLink=([url,label])=>`<a href="/${url}" ${here===url?'aria-current="page"':''}>${label}</a>`;
const currentIndex=Math.max(0,allPages.findIndex(([url])=>url===here));
const previous=allPages[(currentIndex-1+allPages.length)%allPages.length];
const next=allPages[(currentIndex+1)%allPages.length];
const footer=document.querySelector('footer');
footer?.querySelector('.footer-top>div:nth-child(2)>a')?.insertAdjacentHTML('beforebegin','<a href="/sport-mixed-beach-volleyball.html">Mixed beach volleyball</a>');
footer?.querySelector('.footer-top')?.insertAdjacentHTML('beforebegin',`<nav class="page-cycle" aria-label="Previous and next page"><a href="/${previous[0]}" rel="prev"><span>← Previous page</span><strong>${previous[1]}</strong></a><span class="cycle-count">Page ${currentIndex+1} of ${allPages.length}</span><a href="/${next[0]}" rel="next"><span>Next page →</span><strong>${next[1]}</strong></a></nav>`);
const directory=pageGroups.map(([title,items])=>`<details><summary>${title} <small>${items.length} pages</small></summary><div class="directory-links">${items.map(pageLink).join('')}</div></details>`).join('');
footer?.querySelector('.footer-bottom')?.insertAdjacentHTML('beforebegin',`<section class="page-directory" aria-label="All Sandy Sports pages"><h2>All ${allPages.length} pages</h2><p>Open a group to jump directly to any sport, club desk or proposal page.</p><div class="directory-groups">${directory}</div></section>`);
document.querySelectorAll('.card > img').forEach(img=>{
  const label=document.createElement('small');
  label.className='image-kind';
  label.textContent=img.getAttribute('src')==='/assets/site-ballow-aerial.webp'?'Actual Ballow Road photo':'Concept image';
  img.insertAdjacentElement('afterend',label);
});
const menu=document.querySelector('.menu-toggle'), navEl=document.querySelector('#nav');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));navEl.classList.toggle('open',open)});
navEl?.addEventListener('click',e=>{if(e.target.closest('a')){navEl.classList.remove('open');menu.setAttribute('aria-expanded','false')}});
const guide=document.querySelector('#guide-panel'),guideButton=document.querySelector('#guide-button');
function guideOpen(open){guide.hidden=!open;guideButton.setAttribute('aria-expanded',String(open));if(open)document.querySelector('#guide-close').focus();else guideButton.focus()}
guideButton?.addEventListener('click',()=>guideOpen(guide.hidden));document.querySelector('#guide-close')?.addEventListener('click',()=>guideOpen(false));
guide?.addEventListener('click',e=>{if(e.target.closest('a'))guideOpen(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&guide&&!guide.hidden)guideOpen(false)});
document.querySelector('.footer-bottom')?.insertAdjacentHTML('beforeend','<span><a href="/join.html">Nominate to join</a> · <a href="/donate.html">Screen campaign</a> · <a href="/LICENCE.md">Interim licence</a> · <a href="https://auraofintelligence.github.io/strange-but-true/">Strange But True</a></span>');
document.body.insertAdjacentHTML('beforeend','<button class="back-to-top" type="button" aria-label="Back to top" title="Back to top" hidden>↑<span>Top</span></button>');
const backToTop=document.querySelector('.back-to-top');
function updateBackToTop(){backToTop.hidden=window.scrollY<450}
window.addEventListener('scroll',updateBackToTop,{passive:true});updateBackToTop();
backToTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
