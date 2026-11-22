const examples={
  member:{
    overview:['My clubhouse','A sample member dashboard for three towns, sport and screen.','Mixed volleyball sign-on • Flag clinic interest • Summer film crew invitation'],
    calendar:['My calendar','Plan prospective sessions and invitations.','Volleyball social night • Three-town sports expo • Outdoor cinema'],
    teams:['Sports and teams','Keep the whole sports catalogue within reach.','Volleyball • Flag football • Cricket • Football • Rugby • Netball • AFL crossover • Handball • Tennis • Ultimate'],
    learning:['Coaching and skills','Record training interests and opportunities.','Coaching • Officiating • Camera • Editing • Event production'],
    film:['Film club','Join a separate creative desk within the sports club.','Local shorts • Festivals • Live sport broadcast • Skills transfer'],
    notices:['Notices','A local draft noticeboard.','Partner club conversations • Proposed venues • Founding meeting'],
    profile:['Profile and family','A future private account would hold verified member data and consent.','This public demo stores example notes only in this browser.'],
    equipment:['Equipment wishes','Suggest equipment for a shared three-town system.','Balls • nets • goals • modular LED panels • transport']
  },
  committee:{
    overview:['Committee home','A working desk for a proposed founding committee.','Founding constitution • Town working groups • Summer programme'],
    meetings:['Meetings and minutes','Draft an agenda, decision or action for review.','Inaugural meeting proposal • Site criteria • Membership and safeguarding'],
    jobs:['Officer jobs','Assign proposed tasks without implying appointments.','Chair • Secretary • Treasurer • Sport leads • Film club lead • Facilities • Grants'],
    events:['Events and run sheets','Connect venues, sport, markets, film and logistics.','Summer play days • Club crossover expo • Screen festival'],
    grants:['Grants register','Track lead, applicant, deadline and evidence.','Council • Queensland sport • GCBF • First Nations-led arts • Federal • Foundations'],
    assets:['Assets and facilities','Plan owner, custodian, transport, maintenance and replacement.','Courts • lighting • amenities • LED panels • broadcast kit'],
    members:['Membership review','Invite applicants and steward consent when a secure system exists.','Do not enter real personal data in this public demo.'],
    film:['Film club desk','Keep programming, creator rights and production decisions visible.','Festivals • screening rights • media crew • live broadcasts']
  },
  webmaster:{
    overview:['Demo overview','A sample publishing and access dashboard.','No live users or content are connected.'],
    pages:['Pages and publication','Draft a proposed update and check it before publishing.','Sports • venues • grants • film • clubhouse'],
    accounts:['Demo access','Illustrate role invitations and approvals.','Webmaster • Committee • Member • Film club'],
    audit:['Audit trail','Review changes saved in this local demonstration.','Changes are local to your browser, not a server audit.'],
    handover:['Handover','Document access, backups and a successor process.','Domain • repository • Cloudflare • account recovery • permissions']
  },
  assets:{overview:['Asset wish list','Prioritise shared equipment across sport, screen and events.','Volleyball systems • LED panels • lighting • clubhouse modules']},
  grants:{overview:['Grant opportunity desk','Keep lead, applicant, closing date and evidence together.','Council • state • federal • First Nations • foundations • private']}
};
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function initWorkspace(el,role){
  const key='sandy-demo-'+role,config=examples[role]||examples.assets;
  const load=()=>{try{return JSON.parse(localStorage.getItem(key))||[]}catch{return[]}};
  const save=items=>localStorage.setItem(key,JSON.stringify(items));
  let pane=Object.keys(config)[0];
  const nav=el.closest('.workspace-layout')?.querySelector('.workspace-nav');
  function render(){
    const [title,description,seed]=config[pane]||config[Object.keys(config)[0]],items=load().filter(x=>x.pane===pane);
    nav?.querySelectorAll('[data-pane-link]').forEach(a=>a.classList.toggle('active',a.dataset.paneLink===pane));
    el.innerHTML=`<div class="workspace-panel"><p class="eyebrow">FICTIONAL DEMO</p><h3>${safe(title)}</h3><p>${safe(description)}</p><p class="callout">${safe(seed)}</p></div><div class="workspace-panel"><h3>Add a local working note</h3><form class="workspace-form"><label>Title<input name="title" required maxlength="120" placeholder="A proposed activity or action"></label><label>Owner or town<input name="owner" maxlength="80" placeholder="Working group / town"></label><label class="wide">Details<textarea name="details" rows="3" maxlength="1200" placeholder="Next step, evidence or question"></textarea></label><button class="button coral" type="submit">Save in this browser</button></form><p class="status" role="status"></p></div><div class="workspace-panel"><h3>My local notes (${items.length})</h3><ul class="record-list">${items.map(x=>`<li><strong>${safe(x.title)}</strong><small>${safe(x.owner||'Unassigned')} · ${safe(x.date)}</small><p>${safe(x.details||'')}</p><button type="button" class="delete-note" data-id="${safe(x.id)}">Remove</button></li>`).join('')||'<li>No local notes yet.</li>'}</ul></div>`;
    el.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(e.currentTarget);save([...load(),{id:crypto.randomUUID?.()||String(Date.now()),pane,title:String(d.get('title')).trim(),owner:String(d.get('owner')).trim(),details:String(d.get('details')).trim(),date:new Date().toLocaleDateString('en-AU')}]);render()});
    el.querySelectorAll('.delete-note').forEach(b=>b.addEventListener('click',()=>{save(load().filter(x=>x.id!==b.dataset.id));render()}));
  }
  nav?.addEventListener('click',e=>{const a=e.target.closest('[data-pane-link]');if(a){e.preventDefault();pane=a.dataset.paneLink;history.replaceState(null,'','#'+pane);render()}});
  if(config[location.hash.slice(1)])pane=location.hash.slice(1);
  render();
}
document.querySelectorAll('#workspace[data-role]').forEach(el=>initWorkspace(el,el.dataset.role));
document.querySelectorAll('[data-workspace]').forEach(el=>initWorkspace(el,el.dataset.workspace));
