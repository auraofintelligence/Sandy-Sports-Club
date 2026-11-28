// Ask Mozzie: search the site's own map, processes, access rules, member tabs and committee desks.
// Loaded only when someone opens Mozzie. Plain keyword matching on the site's own data; no AI, nothing sent anywhere.
import {ACCESS_SCHEDULE} from './studio/sandy-access.js';
import {MEMBER_TABS,WORKFLOWS} from './studio/sandy-processes.js';
import {DESKS} from './committee-desks.js';
import {actor} from './how-it-works.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STOP=new Set('a an the to do i we how who what where can could is are of for in on my our it be does with at by and or me you your get'.split(' '));
// Everyday words people use, mapped to the words the site uses.
const SYN={approve:'publish',approves:'publish',approval:'publish',borrow:'kit loan ask dates',lend:'kit loan',gear:'kit',camera:'kit film',story:'news story',stories:'news story',stream:'live broadcast',streaming:'live broadcast',livestream:'live broadcast',
 kids:'child children safeguarding',kid:'child safeguarding',child:'children safeguarding',password:'access account sign',login:'sign access account',invite:'account access',minutes:'meetings',agm:'meetings agm',
 ad:'newsletter sponsor',ads:'newsletter sponsor',advertise:'newsletter sponsor',email:'newsletter notifications notice',emails:'newsletter notifications notice',buy:'store order',shop:'store',merch:'store',tickets:'store event',
 money:'store finance money',pay:'store finance',join:'joining join member',signup:'join joining',verified:'blue tick',verify:'blue tick',id:'blue tick',badge:'badges',rsvp:'event rsvp',calendar:'calendar event',
 roles:'access officers',permissions:'access who',committee:'committee officers',president:'president officers',secretary:'secretary officers',treasurer:'treasurer money',webmaster:'webmaster accounts',film:'film club',screen:'film screen noticeboard'};
const words=q=>q.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w&&!STOP.has(w));
const expand=ws=>[...new Set(ws.flatMap(w=>[w,...(SYN[w]||'').split(' ').filter(Boolean)]))];
// Phrases that carry meaning even though their words are too common to search on alone.
const PHRASES=[[/who (can|is allowed|gets to)|permission|allowed to/,'access resolution schedule'],[/sign (in|up)/,'join account access']];
function buildIndex(){
 const out=[];
 for(const w of WORKFLOWS){
  const steps=w.steps.map(([t,who],i)=>{const a=actor(who);return {n:i+1,text:t,who:a.label,detail:a.detail}});
  out.push({kind:'How it works',title:w.title,href:'/how-it-works.html#flow-'+w.key,steps,hay:(w.title+' '+steps.map(s=>s.text+' '+s.who+' '+s.detail).join(' ')).toLowerCase()});
 }
 for(const s of ACCESS_SCHEDULE){const a=actor(s.group);out.push({kind:'Who can',title:s.title,href:'/how-it-works.html#processes',text:(a.detail?a.detail+'. ':'')+s.does,hay:(s.title+' '+s.does+' '+a.detail+' access who can').toLowerCase()})}
 for(const [k,l,h] of MEMBER_TABS)out.push({kind:'My Membership',title:l,href:'/member-home.html#'+k,text:h,hay:(l+' '+h+' member membership').toLowerCase()});
 for(const d of DESKS)out.push({kind:'Committee room',title:d.label,href:'/club-admin.html#committee/'+d.key,text:(d.description||'')+' Officers only.',hay:(d.label+' '+(d.description||'')+' '+d.group+' committee officers desk').toLowerCase()});
 const seen=new Set();
 for(const [,items] of (window.SANDY_SITE_MAP?.groups||[]))for(const [u,l] of items){if(seen.has(u))continue;seen.add(u);out.push({kind:'Page',title:l,href:'/'+u,text:'',hay:(l+' '+u.replace(/[-.]/g,' ')).toLowerCase()})}
 return out;
}
let INDEX=null;
export function search(q,limit=5){
 INDEX||=buildIndex();
 const extra=PHRASES.filter(([re])=>re.test(q.toLowerCase())).flatMap(([,w])=>w.split(' '));
 const ws=[...new Set([...expand(words(q)),...extra])];if(!ws.length)return [];
 const score=e=>ws.reduce((n,w)=>n+(e.title.toLowerCase().includes(w)?4:0)+(e.hay.includes(w)?1:0),0)+(e.kind==='How it works'?0.5:0);
 return INDEX.map(e=>({e,s:score(e)})).filter(x=>x.s>=1).sort((a,b)=>b.s-a.s).slice(0,limit).map(({e})=>{
  if(!e.steps)return e;
  // Pick the step the question is really about: ignore words that only name the process itself.
  const pick=list=>e.steps.map(s=>({s,n:list.filter(w=>(s.text+' '+s.who).toLowerCase().includes(w)).length})).sort((a,b)=>b.n-a.n)[0];
  let best=pick(ws.filter(w=>!e.title.toLowerCase().includes(w)));
  if(!best.n)best=pick(ws);
  const st=best.n?best.s:null;
  return {...e,text:st?'Step '+st.n+' of '+e.steps.length+': '+st.text+'. '+st.who+(st.detail?' ('+st.detail+')':'')+'.':e.steps.map(s=>s.text).join(' → ')};
 });
}
export function mount(panel){
 if(!panel||panel.querySelector('.mozzie-search'))return;
 const form=document.createElement('form');form.className='mozzie-search';form.setAttribute('role','search');
 form.innerHTML='<label for="mozzie-q">Ask Mozzie</label><div><input id="mozzie-q" type="search" placeholder="e.g. who approves a news story?" autocomplete="off"><button type="submit">Ask</button></div><div class="mozzie-results" aria-live="polite"></div>';
 const style=document.createElement('style');
 style.textContent='.mozzie-search{display:grid;gap:.35rem;margin:.6rem 0}.mozzie-search label{font-weight:800}.mozzie-search>div:first-of-type{display:flex;gap:.35rem}.mozzie-search input{flex:1;min-width:0;padding:.5rem .6rem;border:1px solid #c9dcd8;border-radius:10px;font:inherit}.mozzie-search button{padding:.5rem .8rem;border:0;border-radius:10px;background:#0d7a88;color:#fff;font-weight:800;cursor:pointer}.mozzie-results{display:grid;gap:.4rem}.mozzie-hit{display:block;padding:.5rem .6rem;border:1px solid #dbe9e5;border-radius:10px;background:#fff;color:inherit;text-decoration:none}.mozzie-hit small{display:block;font-size:.7rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:#c2410c}.mozzie-hit strong{display:block}.mozzie-hit span{font-size:.86rem;color:#3f5a5f}';
 form.prepend(style);
 const intro=panel.querySelector('p');(intro||panel.querySelector('h2'))?.after(form);
 const out=form.querySelector('.mozzie-results'),input=form.querySelector('input');
 const run=()=>{const q=input.value.trim();if(!q){out.innerHTML='';return}const hits=search(q);
  out.innerHTML=hits.length?hits.map(h=>'<a class="mozzie-hit" href="'+esc(h.href)+'"><small>'+esc(h.kind)+'</small><strong>'+esc(h.title)+'</strong>'+(h.text?'<span>'+esc(h.text)+'</span>':'')+'</a>').join(''):'<p>I couldn’t find that. Try a simpler word, or see <a href="/how-it-works.html">How the club works</a>.</p>'};
 form.addEventListener('submit',e=>{e.preventDefault();run()});
 let t=0;input.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(run,200)});
 input.focus();
}
mount(document.getElementById('guide-panel'));
