// Attention badges on the committee workbench. Each count comes from a service the signed-in officer may already use;
// a service the officer cannot use simply shows no badge.
const get=path=>fetch(path,{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
const today=()=>new Date(Date.now()+10*3600000).toISOString().slice(0,10);
function badge(href,count,{urgent=false,label=''}={}){
 if(!count)return;
 for(const link of document.querySelectorAll('.clubhouse-quick-grid a[href="'+href+'"]')){
  link.querySelector('.nav-badge')?.remove();
  link.insertAdjacentHTML('beforeend',' <span class="nav-badge'+(urgent?' urgent':'')+'" aria-label="'+(label||count+' need attention')+'">'+(count>99?'99+':count)+'</span>');
 }
}
async function refresh(){
 const session=await get('/api/session');
 if(!session?.authenticated||['member','webmaster_demo'].includes(session.identity?.role)||session.readOnly)return;
 const role=session.identity.role,week=new Date(Date.now()+10*3600000-7*86400000).toISOString().slice(0,10),month=today().slice(5,7);
 const [notices,todos,requests,verify,profiles,families,wishes,store,sponsors]=await Promise.all([
  get('/api/committee/notices?summary=1'),get('/api/committee/todos'),role==='webmaster'?get('/api/webmaster/requests'):null,
  get('/api/committee/verify-id'),get('/api/committee/member-profiles'),get('/api/committee/families'),get('/api/committee/requests?status=new'),get('/api/committee/store/orders?status=requested'),get('/api/committee/sponsors')]);
 if(notices?.counts)badge('#committee/notices',notices.counts.unread+notices.counts.red,{urgent:notices.counts.red>0,label:notices.counts.unread+' unread, '+notices.counts.red+' overdue'});
 if(todos?.tasks){
  const mine=todos.tasks.filter(t=>!t.done&&!t.archived&&(!t.office||t.office===role||role==='webmaster'));
  badge('#committee/todos',mine.length,{urgent:mine.some(t=>t.dueDate&&t.dueDate<today()),label:mine.length+' open to-dos'});
 }
 if(sponsors?.counts){const c=sponsors.counts;badge('/committee-sponsors.html',c.new+c.overdue+c.approvals,{urgent:c.overdue>0,label:c.new+' new, '+c.overdue+' overdue, '+c.approvals+' approvals'})}
 if(store?.counts&&store.canManage)badge('/store-admin.html',store.counts.requested,{label:store.counts.requested+' new store orders'});
 if(wishes?.counts)badge('/committee-requests.html',wishes.counts.new,{label:wishes.counts.new+' new wishes'});
 if(requests?.counters)badge('#requests',requests.counters.unread,{urgent:true,label:requests.counters.unread+' unread requests'});
 if(verify?.members){const n=verify.members.filter(m=>!m.verified).length;badge('/verify-members.html',n,{label:n+' members without a blue tick'})}
 if(profiles?.members){
  const fresh=profiles.members.filter(m=>(m.joinedOn||'')>=week).length;
  badge('/webmaster-members.html',fresh,{label:fresh+' joined this week'});
  const bdays=[...profiles.members.map(m=>m.profile.dob),...(families?.children||[]).map(c=>c.dob)].filter(d=>d&&d.slice(5,7)===month).length;
  badge('#committee/birthday',bdays,{label:bdays+' birthdays this month'});
 }
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},120000);
