const here = (location.pathname.split('/').pop() || 'index.html');
const pages = [
  ['index.html','Vision'],['sports.html','Sand sports'],['flag-football.html','Flag football'],
  ['places.html','Three towns'],['programme.html','Events'],['film-club.html','Film club'],
  ['facilities.html','Facilities & assets'],['space-planner.html','Space planner'],
  ['grants.html','Grants & investment'],['donate.html','Donate & screen'],['join.html','Join / nominate'],
  ['clubhouse.html','Clubhouse'],['members.html','Members'],['committee.html','Committee'],
  ['webmaster.html','Webmaster'],['sources.html','Sources']
];
const nav = pages.map(([url,label])=>`<a href="/${url}" ${here===url?'aria-current="page"':''}>${label}</a>`).join('');
document.querySelector('[data-site-header]')?.insertAdjacentHTML('afterbegin',`<a class="skip" href="#main">Skip to content</a><div class="proposal-strip"><strong>CLUB PROPOSAL</strong><span>Facilities, events and membership shown here are proposed, unless explicitly marked otherwise.</span></div><header class="site-header"><a class="brand" href="/index.html"><img class="brand-mark" src="/assets/sandy-mark.svg" alt=""><span>SANDY SPORTS<small>MINJERRIBAH � STRADDIE</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav id="nav" aria-label="Main navigation">${nav}</nav><a class="header-cta" href="/clubhouse.html">Explore the club</a></header>`);
document.querySelector('[data-site-footer]')?.insertAdjacentHTML('afterbegin',`<footer><div class="footer-top"><div><a class="brand" href="/index.html"><img class="brand-mark" src="/assets/sandy-mark.svg" alt=""><span>SANDY SPORTS<small>CLUB PROPOSAL</small></span></a><p>A proposed island-wide club built around mixed sand sport, three towns and shared creative facilities.</p></div><div><strong>Explore</strong><a href="/sports.html">Sports</a><a href="/places.html">Places</a><a href="/facilities.html">Facilities</a><a href="/film-club.html">Film club</a><a href="/grants.html">Funding</a></div><div><strong>Clubhouse</strong><a href="/members.html">Member demo</a><a href="/committee.html">Committee demo</a><a href="/webmaster.html">Webmaster & demo</a><a href="/assets.html">Asset wish list</a><a href="/sources.html">Sources & credits</a></div></div><div class="footer-bottom"><span>Proposal � No incorporated Sandy Sports Club or confirmed site is asserted.</span><span>Quandamooka Country � Minjerribah / North Stradbroke Island</span></div></footer><button class="guide-button" id="guide-button" aria-expanded="false" aria-controls="guide-panel"><img src="/assets/mozzie.webp" alt=""><span>Ask Mozzie</span></button><aside class="guide-panel" id="guide-panel" hidden><button class="guide-close" id="guide-close" aria-label="Close guide">�</button><img src="/assets/mozzie.webp" alt="Mozzie, Sandy Sports mascot"><h2>G'day, I'm Mozzie.</h2><p>Have a look at the sports, all three towns, the film club and the proposed clubhouse desks.</p><a href="/sports.html">Sports catalogue</a><a href="/places.html">Three towns</a><a href="/film-club.html">Film club</a><a href="/clubhouse.html">Clubhouse</a><a href="/grants.html">Grants & investment</a></aside>`);
const menu=document.querySelector('.menu-toggle'), navEl=document.querySelector('#nav');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));navEl.classList.toggle('open',open)});
navEl?.addEventListener('click',e=>{if(e.target.closest('a')){navEl.classList.remove('open');menu.setAttribute('aria-expanded','false')}});
const guide=document.querySelector('#guide-panel'),guideButton=document.querySelector('#guide-button');
function guideOpen(open){guide.hidden=!open;guideButton.setAttribute('aria-expanded',String(open));if(open)document.querySelector('#guide-close').focus();else guideButton.focus()}
guideButton?.addEventListener('click',()=>guideOpen(guide.hidden));document.querySelector('#guide-close')?.addEventListener('click',()=>guideOpen(false));
guide?.addEventListener('click',e=>{if(e.target.closest('a'))guideOpen(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&guide&&!guide.hidden)guideOpen(false)});
document.querySelector('.footer-bottom')?.insertAdjacentHTML('beforeend','<span><a href="/join.html">Nominate to join</a> � <a href="/donate.html">Screen campaign</a> � <a href="/LICENCE.md">Interim licence</a> � <a href="https://auraofintelligence.github.io/strange-but-true/">Strange But True</a></span>');
document.body.insertAdjacentHTML('beforeend','<button class="back-to-top" type="button" aria-label="Back to top" title="Back to top" hidden><span>Top</span></button>');
const backToTop=document.querySelector('.back-to-top');
function updateBackToTop(){backToTop.hidden=window.scrollY<450}
window.addEventListener('scroll',updateBackToTop,{passive:true});updateBackToTop();
backToTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

