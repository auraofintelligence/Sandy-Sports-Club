// How the club works: site map, access table and processes, all drawn from the site's own data:
// the menus in site.js, the committee desks, studio/sandy-access.js and studio/sandy-processes.js.
import {OFFICES,ACCESS_GROUPS,ACCESS_SCHEDULE} from './studio/sandy-access.js';
import {ACTORS,MEMBER_TABS,WORKFLOWS} from './studio/sandy-processes.js';
import {DESKS} from './committee-desks.js';
import {accessTableHtml} from './access-schedule.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const KIND={member:'Member, guardian or the public',officer:'Any officer',group:'A named office group',auto:'The site does it',outside:'Outside the club'};
const offices=g=>{const list=ACCESS_GROUPS[g];return list.filter(r=>r!=='vice_president'&&r!=='assistant_secretary').map(r=>OFFICES[r]+(r==='president'?' or VP':r==='secretary'?' or Asst Sec':'')).join(', ')};
export function actor(who){
 if(ACTORS[who])return {...ACTORS[who],detail:''};
 const s=ACCESS_SCHEDULE.find(x=>x.group===who);if(!s)throw Error('Unknown actor '+who);
 return who==='officers'?{label:'Any officer',kind:'officer',detail:''}:{label:s.title,kind:'group',detail:offices(who)};
}
function siteMap(){
 const map=window.SANDY_SITE_MAP,primary=(map?.primary||[]).filter(([u])=>!['club-admin.html','club-login.html'].includes(u));
 const groups=[...new Set(DESKS.map(d=>d.group))];
 return '<div class="hw-door hw-member-kind"><h3>Public site</h3><p>Anyone, no sign-in</p><ul>'+primary.map(([u,l])=>'<li><a href="/'+esc(u)+'">'+esc(l)+'</a></li>').join('')+'</ul></div>'+
  '<div class="hw-door hw-member-kind"><h3>My Membership</h3><p>Signed-in members</p><ul>'+MEMBER_TABS.map(([k,l,h])=>'<li><strong>'+esc(l)+'</strong> <span>'+esc(h)+'</span></li>').join('')+'</ul></div>'+
  '<div class="hw-door hw-officer-kind"><h3>Committee room</h3><p>Officers see the desks their office opens</p><ul>'+groups.map(g=>'<li><strong>'+esc(g)+'</strong> <span>'+esc(DESKS.filter(d=>d.group===g).map(d=>d.label).join(' · '))+'</span></li>').join('')+'</ul></div>';
}
function flows(){
 return WORKFLOWS.map(w=>'<article class="hw-flow" id="flow-'+esc(w.key)+'"><h3>'+esc(w.title)+'</h3><ol>'+w.steps.map(([t,who])=>{const a=actor(who);
  return '<li class="hw-step hw-'+a.kind+'"><strong>'+esc(t)+'</strong><span>'+esc(a.label)+'</span>'+(a.detail?'<small>'+esc(a.detail)+'</small>':'')+'</li>'}).join('')+'</ol></article>').join('');
}
if($('[data-hw-map]')){
 $('[data-hw-map]').innerHTML=siteMap();
 $('[data-hw-access]').innerHTML=accessTableHtml();
 $('[data-hw-legend]').innerHTML=Object.entries(KIND).map(([k,l])=>'<span class="hw-key hw-'+k+'">'+esc(l)+'</span>').join('');
 $('[data-hw-flows]').innerHTML=flows();
}
