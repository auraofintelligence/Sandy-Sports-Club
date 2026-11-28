// Participation badges. Earned automatically from what members do; nothing to apply for.
// Shared by the worker (which works them out) and the pages (which draw them).
export const BADGES={
 founding:{label:'Founding member',icon:'🌅',how:'Joined while the club was being founded.'},
 tick:{label:'Blue tick',icon:'✔',how:'Photo ID sighted in person by the committee.'},
 profile:{label:'All set up',icon:'🪪',how:'Picture, a bit about you, sports and when you’re free.'},
 first:{label:'First RSVP',icon:'🎟',how:'Said you’re going to a club event.'},
 regular:{label:'Regular',icon:'🔥',how:'Said you’re going to 5 club events.'},
 film:{label:'Film Club',icon:'🎬',how:'Joined the Film Club.'},
 crew:{label:'Film crew',icon:'🎥',how:'Added a crew skill like camera, sound or editing.'},
 helper:{label:'Helping hand',icon:'🤝',how:'Offered to help out.'},
 connector:{label:'Connector',icon:'🔗',how:'Connected with 3 other members.'}
};
export const BADGE_ORDER=Object.keys(BADGES);
export function earnedBadges(f){
 const out=[];
 if(f.joinedOn&&f.joinedOn<=f.foundingUntil)out.push('founding');
 if(f.verified)out.push('tick');
 if(f.picture&&f.bio&&f.sports>0&&f.availability>0)out.push('profile');
 if(f.going>=1)out.push('first');
 if(f.going>=5)out.push('regular');
 if(f.film)out.push('film');
 if(f.crew>0)out.push('crew');
 if(f.helping>0)out.push('helper');
 if(f.connections>=3)out.push('connector');
 return out;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function badgeRow(keys=[],{small=false}={}){
 if(!keys.length)return '';
 return '<ul class="badge-row'+(small?' small':'')+'" aria-label="Badges">'+keys.filter(k=>BADGES[k]).map(k=>'<li class="badge badge-'+k+'" title="'+esc(BADGES[k].how)+'"><span aria-hidden="true">'+BADGES[k].icon+'</span>'+esc(BADGES[k].label)+'</li>').join('')+'</ul>';
}
// Own profile: earned badges plus the ones still to get, so there is something to aim for.
export function badgeBoard(keys=[]){
 return '<section class="badge-board"><h3>My badges</h3>'+(keys.length?badgeRow(keys):'<p>No badges yet. Here’s how to earn them.</p>')+
  (BADGE_ORDER.some(k=>!keys.includes(k))?'<details><summary>Still to earn</summary><ul class="badge-todo">'+BADGE_ORDER.filter(k=>!keys.includes(k)).map(k=>'<li><span aria-hidden="true">'+BADGES[k].icon+'</span><strong>'+esc(BADGES[k].label)+'</strong> '+esc(BADGES[k].how)+'</li>').join('')+'</ul></details>':'')+'</section>';
}
