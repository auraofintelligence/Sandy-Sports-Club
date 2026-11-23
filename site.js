const here = (location.pathname.split('/').pop() || 'index.html');
const pages = [
  ['index.html','Vision'],['sport-mixed-beach-volleyball.html','Beach volleyball'],['sports.html','All sand sports'],['flag-football.html','Flag football'],
  ['places.html','Three towns'],['programme.html','Events'],['film-club.html','Film club'],
  ['facilities.html','Facilities & assets'],['space-planner.html','Space planner'],
  ['grants.html','Grants & investment'],['donate.html','Donate & screen'],['join.html','Join / nominate'],
  ['clubhouse.html','Clubhouse'],['members.html','Members'],['committee.html','Committee'],
  ['webmaster.html','Webmaster'],['constitution.html','Constitution'],['sources.html','Sources']
];
// The full 47-page directory stays in the footer, not the top menu.
const primaryPages = [
  ['index.html','Vision'],['sports.html','Sports'],['places.html','Three towns'],
  ['facilities.html','Facilities'],['programme.html','Events & film'],
  ['grants.html','Funding'],['clubhouse.html','Clubhouse']
];
const mainSectionFor = page => {
  if(page==='index.html')return 'index.html';
  if(page==='sports.html'||page==='flag-football.html'||page.startsWith('sport-'))return 'sports.html';
  if(page==='places.html')return 'places.html';
  if(['facilities.html','space-planner.html','assets.html'].includes(page))return 'facilities.html';
  if(['programme.html','film-club.html'].includes(page))return 'programme.html';
  if(['grants.html','donate.html'].includes(page))return 'grants.html';
  if(page==='join.html')return 'join.html';
  return 'clubhouse.html';
};
const nav = primaryPages.map(([url,label])=>`<a href="/${url}" ${here===url?'aria-current="page"':mainSectionFor(here)===url?'data-section-active="true"':''}>${label}</a>`).join('');
document.querySelector('[data-site-header]')?.insertAdjacentHTML('afterbegin',`<a class="skip" href="#main">Skip to content</a><div class="proposal-strip"><strong>CLUB PROPOSAL</strong><span>Facilities, events and membership shown here are proposed, unless explicitly marked otherwise.</span></div><header class="site-header"><a class="brand" href="/index.html"><img class="brand-mark" src="/assets/sandy-original-logo.png" alt=""><span>SANDY SPORTS<small>MINJERRIBAH · STRADDIE</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav id="nav" aria-label="Main navigation">${nav}</nav><a class="header-cta" href="/join.html" ${here==='join.html'?'aria-current="page"':''}>Help build it</a></header>`);
// Shared navigation is assembled once for every page.
const footerSections = [
  ['Explore',[['sports.html','Sports catalogue'],['places.html','Three towns'],['facilities.html','Facilities & sites'],['programme.html','Events & programme'],['film-club.html','Film club']]],
  ['Build & back',[['join.html','Get involved'],['grants.html','Grants & funding'],['assets.html','Equipment wish list'],['donate.html','Screen funding concept'],['constitution.html','Draft constitution']]],
  ['Clubhouse & tools',[['clubhouse.html','Clubhouse overview'],['members.html','Member demo'],['committee.html','Committee demo'],['social-planner.html','Social planner'],['webmaster.html','Webmaster demo']]]
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
  route('committee-members','Membership'),route('committee-publishing','Publishing'),route('social-planner','365-day social planner')
];
// Reading order follows a visitor's journey and includes each actual HTML page once.
const pageGroups = [
  ['Vision and sports',[pages[0],pages[2],pages[1],pages[3],...sportGuide]],
  ['Places and facilities',[pages[4],pages[7],pages[8],route('assets','Asset wish list')]],
  ['Events, film and backing',[pages[5],pages[6],pages[9],pages[10],pages[11]]],
  ['Member clubhouse',[pages[12],pages[13],...memberGuide]],
  ['Committee and governance',[pages[14],route('committee-governance','Governance'),pages[16],...committeeGuide.filter(([url])=>url!=='committee-governance.html'),pages[15],pages[17]]]
];
const allPages = pageGroups.flatMap(([,items])=>items);
const pageLink = ([url,label])=>`<a href="/${url}" ${here===url?'aria-current="page"':''}>${label}</a>`;
const pageGroupFor = url => pageGroups.find(([,items])=>items.some(([candidate])=>candidate===url))?.[0]||'Other pages';
const currentIndex = allPages.findIndex(([url])=>url===here);
const previous = currentIndex>0?allPages[currentIndex-1]:null;
const next = currentIndex>=0&&currentIndex<allPages.length-1?allPages[currentIndex+1]:null;
const footer=document.querySelector('footer');
if(currentIndex>=0){
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
document.querySelector('.footer-bottom')?.insertAdjacentHTML('beforeend','<span><a href="/index.html#page-directory">All pages</a> · <a href="/sources.html">Sources & credits</a> · <a href="/LICENCE.md">Interim licence</a> · <a href="https://auraofintelligence.github.io/strange-but-true/">Strange But True</a></span>');
document.body.insertAdjacentHTML('beforeend','<button class="back-to-top" type="button" aria-label="Back to top" title="Back to top" hidden>↑<span>Top</span></button>');
const backToTop=document.querySelector('.back-to-top');
function updateBackToTop(){backToTop.hidden=window.scrollY<450}
window.addEventListener('scroll',updateBackToTop,{passive:true});updateBackToTop();
backToTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
