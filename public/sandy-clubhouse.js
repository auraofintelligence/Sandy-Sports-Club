import {setupApplicationEntry,setupApplicationReview} from './applications.js';
import {setupMemberLifecycle} from './member-lifecycle.js';
import {setupClubNews} from './club-news.js';
import {setupEquipmentWishes} from './equipment-wishes.js';
import {setupClubEquipment} from './club-equipment.js';
import {setupGrantRegister} from './grant-register.js';
import {setupMeetingWorkflow} from './meeting-workflow.js';
import {setupRecording} from './recording.js';
import {setupOfficerTodos} from './officer-todos.js';
import {setupOfficerHandover} from './officer-handover.js';
import {setupShop} from './shop.js';
import {setupClubPricing} from './club-pricing.js';
import {mountGrantPage,scrollToGrantSection} from './grant-page.js';
import {setupMemberCalendar} from './member-calendar.js';
import {setupMemberRecipes} from './member-recipes.js';
import {setupSharedMeals} from './shared-meals.js';
import {setupSafeguards} from './member-safeguards.js';
import {setupReturningMembers} from './returning-members.js';
import {setupMemberRoom} from './member-room.js';
import {setupMemberNetwork} from './member-network.js';
import {setupSocialPlanner} from './social-planner.js';
import {setupFundraisingEvents} from './fundraising-events.js';
import {setupSponsorRooms} from './sponsor-rooms.js';
import {setupCommitteeNotices} from './committee-notices.js';
import {setupAgmJobs} from './agm-jobs.js';
import {setupOperatingAuthority} from './operating-authority.js';
import {setupHandoffs} from './handoffs.js';
import {setupNoticeEmailProfile} from './notice-email-profile.js';
import {setupTreasurerOrders} from './treasurer-orders.js';
import {setupStockReports} from './stock-reports.js';
import {setupPriceNotices} from './price-notices.js';
import {setupMerchStocktake} from './merch-stocktake.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const offices=[['president','President','Chairs club direction and committee decisions'],['vicepresident','Vice President','Supports the President and agreed projects'],['secretary','Secretary','Records decisions, meetings and correspondence'],['assistantsecretary','Assistant Secretary','Shares member and committee administration'],['treasurer','Treasurer','Manages fees, stock, receipts and approved offers']];
const officeName=key=>offices.find(([id])=>id===key)?.[1]||key;
let session={role:'anonymous',authenticated:false,storageReady:false},invitation=null,invitationToken=null,invitationProblem='',demoToken=null,demoLogin='',rosterRequest=0;
const viewChoices=new Set(['president','vicepresident','secretary','assistantsecretary','treasurer','member']);
let requestedViewAs=sessionStorage.getItem('sandy-view-as')||'',viewAs='';
if(!viewChoices.has(requestedViewAs))requestedViewAs='';
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,options={})=>{
  const request=new Request(input,options);
  if(viewAs&&!['GET','HEAD'].includes(request.method)&&request.url.startsWith(location.origin+'/api/')&&!['/api/auth/logout','/api/showcase/auth/logout'].some(path=>request.url.endsWith(path)))return Promise.reject(Error('This role view is read only. Return to Webmaster view to make changes.'));
  if(viewAs&&['GET','HEAD'].includes(request.method)&&request.url.startsWith(location.origin+'/api/')){
    const headers=new Headers(request.headers);headers.set('X-Sandy-View-As',viewAs);
    return nativeFetch(new Request(request,{headers}));
  }
  return nativeFetch(request);
};
let closeGrants=null;
let handoffs=null;
let memberRoom=null;
let toastTimer;
function toast(message){const node=$('#toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,6000);}
function download(name,content,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function modal(title,body){const dialog=$('#sandy-info-dialog');dialog.querySelector('h2').textContent=title;dialog.querySelector('[data-dialog-body]').innerHTML=body;dialog.showModal();}

async function api(path,options={}){
  const method=(options.method||'GET').toUpperCase();
  if((session.readOnly||session.demo||session.showcase)&&!['GET','HEAD'].includes(method)&&!['/api/auth/logout','/api/showcase/auth/logout'].includes(path))throw Error('This view is read only. Return to the Webmaster view to make changes.');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  let result;
  try{result=await response.json();}catch{throw Error('The clubhouse connection is unavailable. Please try again.');}
  if(!response.ok){const error=Error(typeof result.error==='string'?result.error:result.error?.message||result.message||'Please try again.');error.status=response.status;throw error;}
  return result;
}
const post=(path,data)=>api(path,{method:'POST',body:JSON.stringify(data)});
const allowed=page=>Boolean(session.storageReady&&(page==='webmaster'?session.administrator||session.showcase:page==='stock'?session.canManageStock:page==='committee'?session.role==='committee':['member','committee'].includes(session.role)));

function status(message){const node=$('#connection-status');node.hidden=!message;node.textContent=message||'';}
function destination(){
  let raw;
  try{raw=decodeURIComponent(location.hash.slice(1)||'home');}catch{return {page:'home',slug:'',hash:'#home'};}
  if(raw.startsWith('activate='))return {page:'members',slug:'',hash:'#members'};
  if(raw.startsWith('demo-activate='))return {page:'webmaster',slug:'demo',hash:'#webmaster/demo'};
  const [page,slug='']=raw.split('/');
  const pages=['home','join','members','committee','grants','sponsors','shop','stock','webmaster','preview-member'];
  const member=['membership','profile','friends','notices','news','calendar','conversation','minutes','recipes','meals','safety','equipment-wishes'];
  const officer=['applications','automations','news','grants','todos','handover','access','meetings','equipment','returning','safety','notices','events','social','sponsors','agm-jobs','authority','handoffs'];
  if(!pages.includes(page))return {page:'home',slug:'',hash:'#home'};
  if(slug&&!(page==='members'?member:page==='committee'?officer:page==='grants'?['funding','projects','research','club-details']:page==='stock'?['reports','returning']:page==='webmaster'?['demo']:[]).includes(slug))return {page,slug:'',hash:'#'+page};
  return {page,slug,hash:'#'+page+(slug?'/'+slug:'')};
}

function renderNav(view){
  const active=view.page==='preview-member'?'members':view.page==='stock'?'committee':view.page;
  document.querySelectorAll('#main-nav [data-page]').forEach(link=>{
    if(link.dataset.page===active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
  const menu=$('#main-nav');menu.classList.remove('open');$('.menu-toggle').setAttribute('aria-expanded','false');
  document.querySelectorAll('.section-nav a').forEach(link=>{
    if(link.getAttribute('href')===view.hash)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
  $('#committee-private .section-nav').hidden=Boolean(view.page==='committee'&&view.slug);
}
function renderSessionControl(){
  const node=$('#session-control');
  if(!session.authenticated){node.innerHTML='<a href="#members">Sign in</a>';return;}
  const name=esc(session.identity?.name||'Club account');
  const switcher=(session.administrator||session.realAdministrator||session.showcase)?'<label class="view-switch">View as <select id="view-as" aria-label="Webmaster view">'+
    [['',session.showcase?'Demo Webmaster':'Webmaster'],...offices.map(([key,title])=>[key,title]),['member','Member preview']].map(([key,title])=>'<option value="'+key+'"'+(viewAs===key?' selected':'')+'>'+title+'</option>').join('')+'</select></label>':'';
  node.innerHTML='<span>Signed in: '+name+'</span> '+switcher+' <button type="button" data-signout>Sign out</button>';
}
function renderGate(page){
  const node=$('#'+page+'-gate'),authorised=allowed(page),isRenewal=page==='members'&&session.authenticated&&session.accountRole==='member'&&session.role==='signed_in';
  node.hidden=authorised;
  $('#'+page+'-private').hidden=!authorised;
  if(authorised){node.replaceChildren();return;}
  if(page==='webmaster'&&(location.hash==='#webmaster/demo'||demoToken)){
    node.innerHTML='<div class="access-card"><p class="eyebrow">Separate view-only demonstration</p><h1>'+(demoToken?'Set up demo access':'Demo sign-in')+'</h1><p>This account uses a separate demo store. It cannot edit live Sandy club records.</p><form class="stack-form" data-showcase-form><label>Demo username<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label>'+(demoToken?'Choose password':'Password')+'<input name="password" type="password" autocomplete="'+(demoToken?'new-password':'current-password')+'" minlength="12" required></label>'+(demoToken?'<label>Repeat password<input name="repeat" type="password" autocomplete="new-password" minlength="12" required></label>':'')+'<button class="button" type="submit">'+(demoToken?'Activate demo account':'Sign in to demo')+'</button><p role="status"></p></form><p><a href="#webmaster">Webmaster sign-in</a></p></div>';
    if(demoToken)node.querySelector('[name=login]').value=demoLogin;
    return;
  }
  if(invitationToken){renderInvitation(node);return;}
  if(!session.storageReady){node.innerHTML='<div class="access-card"><h2>Private clubhouse setup is under way</h2><p>Applications and account sign-in open after the Sandy member store is connected. This is a separate member register.</p></div>';return;}
  if(isRenewal){node.innerHTML='<div class="access-card"><h2>Membership renewal</h2><p>Your account is signed in. Ask the Treasurer to confirm your renewal or open a private returning-member invitation if one was issued.</p><div id="renewal-gate-slot"></div></div>';return;}
  if(session.authenticated){node.innerHTML='<div class="access-card"><h2>Access for this account</h2><p>'+(page==='webmaster'&&session.realAdministrator?'Use the view switch to return to Webmaster.':'This account does not have '+(page==='committee'?'committee':page==='webmaster'?'Webmaster':'member')+' access. Ask the Sandy Webmaster or Secretary to check its role.')+'</p></div>';return;}
  node.innerHTML='<div class="access-card"><p class="eyebrow">Private clubhouse</p><h1>'+(page==='committee'?'Officer sign-in':page==='webmaster'?'Webmaster sign-in':'Member sign-in')+'</h1><p>Use the Sandy account created from your private invitation.</p><form class="stack-form" data-login-form><label>Club username<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="80"></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Sign in</button><p role="status"></p></form>'+(page==='members'?'<p><a href="#join">Apply for membership</a> or <a href="#preview-member">see the member preview</a>.</p>':page==='webmaster'?'<p><a href="#webmaster/demo">View-only demo sign-in</a></p>':'')+'</div>';
}
function renderInvitation(node){
  const title=invitation?.resetting?'Reset your club password':'Set up your Sandy account';
  const intro=invitationProblem?'<p role="alert">'+esc(invitationProblem)+'</p>':!invitation?'<p role="status">Checking your invitation.</p>':'';
  node.innerHTML='<div class="access-card"><p class="eyebrow">Private invitation</p><h1>'+title+'</h1>'+intro+(!invitation?'':'<p>Choose the password you will use to sign in to Sandy Sports Club.</p><form class="stack-form" data-activate-form><label>Username<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="80" required></label><label>Choose a password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><label>Repeat password<input name="repeat" type="password" autocomplete="new-password" minlength="12" required></label><button class="button" type="submit">Activate account</button><p role="status"></p></form>')+'</div>';
  const login=node.querySelector('[name=login]');if(login){login.value=invitation.login||invitation.suggestedLogin||'';login.readOnly=Boolean(invitation.login);}
}
async function checkInvitation(){
  if(!invitationToken)return;
  try{invitation=await post('/api/auth/invitation',{token:invitationToken});invitationProblem='';}
  catch(error){invitation=null;invitationProblem=error.message;}
  renderGate('members');renderGate('committee');
}
function route(){
  const view=destination();
  if(location.hash!==view.hash&&(!invitationToken||!location.hash.startsWith('#activate=')))history.replaceState(null,'',view.hash);
  document.querySelectorAll('[data-view]').forEach(node=>node.hidden=node.dataset.view!==view.page);
  const stock=$('[data-view="stock"]');stock.hidden=view.page!=='stock'||!allowed('stock');
  $('#stock-access').hidden=view.page!=='stock'||allowed('stock');
  if(view.page==='stock'&&!allowed('stock'))$('#stock-access').innerHTML=session.storageReady?'<h1>Treasurer access</h1><p>Sign in with the Sandy Treasurer or Webmaster account to open this desk.</p><a href="#committee">Officer sign-in</a>':'<h1>Treasurer desk setup</h1><p>The Sandy member store is not connected yet.</p>';
  document.querySelectorAll('[data-member-pane]').forEach(node=>node.hidden=view.page!=='members'||node.dataset.memberPane!==(view.slug||'overview'));
  document.querySelectorAll('[data-committee-pane]').forEach(node=>node.hidden=view.page!=='committee'||node.dataset.committeePane!==(view.slug||'overview'));
  renderNav(view);renderGate('members');renderGate('committee');renderGate('webmaster');
  $('#webmaster-management').hidden=!(session.administrator&&!session.readOnly&&!session.showcase);
  $('#webmaster-preview-note').hidden=!session.showcase;
  const lapsed=view.page==='members'&&session.authenticated&&session.role==='signed_in'&&session.accountRole==='member';
  $('#member-renewal-inbox').hidden=!lapsed;$('#lapsed-returning').hidden=!lapsed;
  if(view.page==='grants'&&!closeGrants)closeGrants=mountGrantPage($('#public-grants'));
  if(view.page!=='grants'&&closeGrants){closeGrants();closeGrants=null;}
  if(view.page==='grants'&&view.slug)scrollToGrantSection($('#public-grants'),view.slug);
  document.title=({home:'Clubhouse',join:'Join',members:'Members',committee:'Committee',grants:'Grants',sponsors:'Partners',shop:'Merch',stock:'Treasurer',webmaster:'Webmaster', 'preview-member':'Member preview'})[view.page]+' | Sandy Sports Club';
  window.dispatchEvent(new CustomEvent('plfc:navigated',{detail:view}));
  if(view.page==='committee'&&!view.slug)loadRoster();
  if(view.page==='committee'&&view.slug==='access')loadAccess();
  if(view.page==='webmaster'&&session.administrator&&!session.readOnly){loadRoster($('#webmaster-office-roster'));loadAccounts();}
  window.scrollTo({top:0,behavior:'instant'});
}

function memberDates(){
  $('#member-mode').textContent=session.identity?.name?'Signed in as '+session.identity.name+'.':'Your private member area.';
  $('#paid-until').textContent=session.paidThrough?'Membership valid through '+new Date(session.paidThrough+'T12:00:00+10:00').toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'}):'Ask the Treasurer to confirm your membership term.';
  $('#committee-mode').textContent=session.identity?.name?'Signed in as '+session.identity.name+'.':'Committee workspace.';
}
async function refreshSession(){
  const selection=viewAs||requestedViewAs;
  viewAs='';
  try{
    const base=await api('/api/session');
    if(base.authenticated&&(base.administrator||base.showcase)&&selection){viewAs=selection;session=await api('/api/session');}
    else{session=base;requestedViewAs='';sessionStorage.removeItem('sandy-view-as');}
    status(session.storageReady?'':'The Sandy clubhouse member store is not connected yet.');
  }catch(error){viewAs='';requestedViewAs='';sessionStorage.removeItem('sandy-view-as');session={role:'anonymous',authenticated:false,storageReady:false};status(error.message);}
  document.body.toggleAttribute('data-demo',Boolean(session.demo||session.readOnly||session.showcase));
  document.body.dataset.sandyViewAs=viewAs;
  document.body.toggleAttribute('data-club-member',allowed('members'));
  document.body.toggleAttribute('data-club-committee',allowed('committee'));
  document.body.toggleAttribute('data-role-treasurer',allowed('stock'));
  $('#demo-banner').hidden=!(session.demo||session.readOnly||session.showcase);
  $('#demo-banner').textContent=session.viewAs==='member'?'Member profile preview. No member account or data has been created.':session.readOnly&&session.viewAs?(session.showcase?'Demo role view: ':'Webmaster role view: ')+officeName(session.viewAs)+'. This view is read only.':'View-only demonstration. Club records and actions cannot be changed here.';
  document.querySelectorAll('[data-admin-link]').forEach(node=>node.hidden=!session.administrator||session.demo||session.readOnly||session.showcase);
  renderSessionControl();memberDates();
  setupApplicationReview($('#committee-applications'),session);
  window.dispatchEvent(new CustomEvent('plfc:session-changed',{detail:session}));
  handoffs?.setSession(session);
  memberRoom?.setSession(session);
  await meetingDesk.setSession(session);
  const button=$('#apply-button');button.disabled=!session.storageReady||Boolean(session.readOnly||session.demo||session.showcase);
  button.textContent=session.readOnly||session.demo||session.showcase?'Leave preview to apply':session.storageReady?'Start membership application':'Applications open after setup';
  $('#apply-status').textContent=session.storageReady?'The committee confirms the current fee before any payment is arranged.':'Sandy applications are paused until its private member store is ready.';
  route();
}

async function loadRoster(mount=$('#office-roster')){
  if(!allowed('committee'))return;
  const ticket=++rosterRequest;
  let accounts=[],invites=[],error='';
  if(session.administrator){
    try{
      const [a,i]=await Promise.all([api('/api/accounts'),api('/api/accounts/invitations')]);
      accounts=a.accounts||[];invites=i.invitations||[];
    }catch(e){error=e.message;}
  }
  if(ticket!==rosterRequest)return;
  mount.innerHTML=offices.map(([key,title,duty])=>{
    const active=accounts.find(a=>a.login===key&&!a.disabled);
    const pending=invites.find(i=>i.login===key);
    const state=error?'Status unavailable':session.administrator?(active?'Account issued':pending?'Invitation pending':'Reserved, not activated'):'Appointment status held by Webmaster';
    return '<article class="office-card"><h3>'+title+'</h3><p>'+duty+'</p><span class="office-status">'+state+'</span>'+(session.administrator&&!session.demo&&!session.readOnly?'<p><a href="#committee/access">Manage '+title+' access</a></p>':'')+'</article>';
  }).join('');
  if(error)mount.insertAdjacentHTML('beforeend','<p role="alert">'+esc(error)+'</p>');
}
async function loadAccess(){
  const mount=$('#office-access');
  if(!allowed('committee')||!session.administrator||session.demo||session.readOnly||session.showcase){mount.innerHTML='<p>Only the Sandy Webmaster can issue office invitations.</p>';return;}
  mount.innerHTML='<p role="status">Checking office accounts and pending invitations.</p>';
  try{
    const [a,i]=await Promise.all([api('/api/accounts'),api('/api/accounts/invitations')]);
    const accounts=a.accounts||[],invites=i.invitations||[];
    mount.innerHTML='<div class="office-grid">'+offices.map(([key,title])=>{
      const account=accounts.find(row=>row.login===key&&!row.disabled);
      const pending=invites.find(row=>row.login===key);
      return '<article class="office-card"><h3>'+title+'</h3><p>'+(account?'Account issued':pending?'Invitation pending':'Reserved, not activated')+'</p>'+
        (account?'':pending?'<button type="button" class="button outline small" data-copy-invite="'+key+'">Copy pending invitation</button>':'<button type="button" class="button small" data-invite-office="'+key+'">Create private invitation</button>')+'</article>';
    }).join('')+'</div><p id="office-access-status" role="status"></p><div id="office-issued-link"></div>';
    mount._invites=invites;
  }catch(error){mount.innerHTML='<p role="alert">'+esc(error.message)+'</p><button type="button" class="button outline" data-retry-access>Try again</button>';}
}
function showInvite(result){
  const url=new URL('/clubhouse.html',location.origin);url.hash='activate='+encodeURIComponent(result.token);
  $('#office-issued-link').innerHTML='<label>Private one-use link for '+esc(officeName(result.login))+'<input class="private-link" readonly autocomplete="off" spellcheck="false"></label><button type="button" class="button outline small" data-copy-shown>Copy link</button>';
  $('#office-issued-link input').value=url.href;
  $('#office-access-status').textContent='Give this invitation privately to the intended office holder. It expires after 24 hours.';
}
async function loadAccounts(){
  const mount=$('#webmaster-accounts');
  if(!session.administrator||session.readOnly||session.showcase)return;
  mount.innerHTML='<p role="status">Loading club accounts.</p>';
  try{
    const {accounts=[]}=await api('/api/accounts');
    mount.innerHTML='<div class="account-list">'+accounts.map(account=>{
      const active=!account.disabled,login=esc(account.login),role=offices.some(([key])=>key===account.login)?officeName(account.login):account.role==='administrator'?'Webmaster':account.role||'Member';
      return '<article class="office-access-row"><strong>'+login+'</strong> <span>'+esc(role)+'</span> <span class="office-status">'+(active?'Active':'Reserved or closed')+'</span>'+
        (session.administrator&&account.role!=='administrator'&&active?'<div class="button-row"><button type="button" class="button outline small" data-reset-login="'+login+'">Reset password</button><button type="button" class="button outline small" data-disable-id="'+esc(account.id)+'" data-disable-login="'+login+'">Close access</button></div>':'')+'</article>';
    }).join('')+'</div><p id="account-action-status" role="status"></p><div id="account-private-link"></div>';
    if(!accounts.length)mount.insertAdjacentHTML('afterbegin','<p>No club accounts are active.</p>');
  }catch(error){mount.innerHTML='<p role="alert">'+esc(error.message)+'</p><button type="button" class="button outline" data-retry-accounts>Try again</button>';}
}
function showAccountLink(result){
  const url=new URL('/clubhouse.html',location.origin);url.hash='activate='+encodeURIComponent(result.token);
  $('#account-private-link').innerHTML='<label>Private reset link for '+esc(result.login)+'<input readonly autocomplete="off" spellcheck="false"></label><button class="button outline small" type="button" data-copy-field="#account-private-link input">Copy link</button>';
  $('#account-private-link input').value=url.href;
  $('#account-action-status').textContent='Give this single-use link privately to the account holder.';
}
function showDemoLink(result){
  const url=new URL('/clubhouse.html',location.origin);url.hash=new URLSearchParams({'demo-activate':result.token,login:result.login}).toString();
  $('#demo-issued-link').innerHTML='<label>Private view-only demo invitation for '+esc(result.login)+'<input readonly autocomplete="off" spellcheck="false"></label><button class="button outline small" type="button" data-copy-field="#demo-issued-link input">Copy link</button>';
  $('#demo-issued-link input').value=url.href;
  $('#demo-issue-status').textContent='Give this single-use link privately. The demo uses its own account and data store.';
}

document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.matches('[data-login-form],[data-activate-form],[data-showcase-form]'))return;
  event.preventDefault();const submit=form.querySelector('[type=submit]'),note=form.querySelector('[role=status]');
  submit.disabled=true;note.textContent='Checking your account.';
  try{
    if(form.matches('[data-showcase-form]')){
      const login=form.elements.login.value.trim(),password=form.elements.password.value;
      if(demoToken){
        if(password!==form.elements.repeat.value)throw Error('The two passwords need to match.');
        await post('/api/showcase/auth/activate',{login,password,token:demoToken});demoToken=null;demoLogin='';
      }else await post('/api/showcase/auth/login',{login,password});
      history.replaceState(null,'','#webmaster');
    }else if(form.matches('[data-activate-form]')){
      if(form.elements.password.value!==form.elements.repeat.value)throw Error('The two passwords need to match.');
      await post('/api/auth/activate',{login:form.elements.login.value.trim(),password:form.elements.password.value,token:invitationToken});
      const landing=invitation?.destination||'members';
      invitationToken=null;invitation=null;history.replaceState(null,'','#'+landing);
    }else await post('/api/auth/login',{login:form.elements.login.value.trim(),password:form.elements.password.value});
    await refreshSession();
  }catch(error){note.textContent=error.message;submit.disabled=false;}
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.id==='apply-button'){if(session.storageReady)window.dispatchEvent(new Event('plfc:apply'));return;}
  if(target.dataset.signout!==undefined){
    target.disabled=true;try{viewAs='';requestedViewAs='';sessionStorage.removeItem('sandy-view-as');await post(session.showcase?'/api/showcase/auth/logout':'/api/auth/logout',{});await refreshSession();location.hash='#home';}catch(error){status(error.message);target.disabled=false;}return;
  }
  if(target.dataset.retryAccess!==undefined){loadAccess();return;}
  if(target.dataset.retryAccounts!==undefined){loadAccounts();return;}
  if(target.dataset.copyField){
    const input=$(target.dataset.copyField);if(!input)return;
    try{await navigator.clipboard.writeText(input.value);toast('Link copied. Share it privately.');}catch{input.focus();input.select();toast('Copy the selected link.');}return;
  }
  if(target.id==='issue-demo'){
    if(!session.administrator||session.readOnly||session.showcase)return;
    target.disabled=true;$('#demo-issued-link').replaceChildren();$('#demo-issue-status').textContent='Creating a separate demo invitation.';
    try{showDemoLink(await post('/api/showcase/invite',{keyword:'sandy'}));}catch(error){$('#demo-issue-status').textContent=error.message;}finally{target.disabled=false;}return;
  }
  if(target.dataset.resetLogin){
    if(!session.administrator||session.readOnly)return;
    target.disabled=true;try{showAccountLink(await post('/api/accounts/invite',{login:target.dataset.resetLogin,reset:true}));}catch(error){$('#account-action-status').textContent=error.message;}finally{target.disabled=false;}return;
  }
  if(target.dataset.disableId){
    if(!session.administrator||session.readOnly||!window.confirm('Close access for '+target.dataset.disableLogin+' and sign out that account?'))return;
    target.disabled=true;try{await post('/api/accounts/disable',{id:target.dataset.disableId});await loadAccounts();toast('Account access closed.');}catch(error){$('#account-action-status').textContent=error.message;target.disabled=false;}return;
  }
  const key=target.dataset.inviteOffice,copy=target.dataset.copyInvite;
  if(!key&&!copy&&target.dataset.copyShown===undefined)return;
  if(target.dataset.copyShown!==undefined){
    const input=$('#office-issued-link input');try{await navigator.clipboard.writeText(input.value);$('#office-access-status').textContent='Copied. Give this private link only to its intended recipient.';}catch{input.focus();input.select();$('#office-access-status').textContent='Copy the selected link.';}return;
  }
  if(!session.administrator||session.demo||session.readOnly||session.showcase)return;
  target.disabled=true;
  try{
    const result=key?await post('/api/accounts/invite',{login:key,role:key==='treasurer'?'treasurer':'committee'}):await post('/api/accounts/invitations',{action:'copy',id:$('#office-access')._invites.find(row=>row.login===copy)?.id});
    showInvite(result);await loadRoster();
  }catch(error){$('#office-access-status').textContent=error.message;}
  finally{target.disabled=false;}
});

$('.menu-toggle').onclick=()=>{const menu=$('#main-nav'),open=menu.classList.toggle('open');$('.menu-toggle').setAttribute('aria-expanded',String(open));};
document.querySelectorAll('[data-committee-pane]').forEach(pane=>{if(pane.dataset.committeePane!=='overview')pane.insertAdjacentHTML('afterbegin','<a class="back-link" href="#committee">Back to committee overview</a>');});
document.body.insertAdjacentHTML('afterbegin','<div id="demo-banner" class="demo-banner" role="status" hidden>View-only Webmaster demonstration. Club records and actions cannot be changed here.</div>');
document.body.insertAdjacentHTML('beforeend','<div id="toast" class="toast" role="status" hidden></div><dialog id="sandy-info-dialog"><h2></h2><div data-dialog-body></div><button type="button" class="button outline" data-close-dialog>Close</button></dialog>');
$('#sandy-info-dialog [data-close-dialog]').onclick=()=>$('#sandy-info-dialog').close();
$('#main').insertAdjacentHTML('beforeend','<section id="stock-access" class="page" hidden></section>');
document.addEventListener('change',async event=>{
  if(event.target.id!=='view-as')return;
  const next=event.target.value;
  if(next&&!viewChoices.has(next))return;
  viewAs=next;
  requestedViewAs=next;
  if(next)sessionStorage.setItem('sandy-view-as',next);else sessionStorage.removeItem('sandy-view-as');
  await refreshSession();
  location.hash=next==='member'?'#preview-member':next==='treasurer'?'#stock':'#committee';
});
setupApplicationEntry();
setupMemberLifecycle();
setupClubNews({api,esc});
setupSocialPlanner({api,esc});
setupFundraisingEvents({api,esc});
setupSponsorRooms({api,esc});
setupCommitteeNotices({api});
setupNoticeEmailProfile({api});
setupOperatingAuthority({api,esc});
setupMemberCalendar({api,esc});
setupMemberNetwork({api,esc});
setupMemberRecipes({api,esc});
setupSharedMeals({api,esc});
setupSafeguards({api,esc});
setupEquipmentWishes({api,esc});
setupClubEquipment({api,esc});
setupGrantRegister({api});
setupOfficerTodos({api,esc});
setupOfficerHandover();
setupShop();
$('[data-view="stock"] [data-stock-overview]').insertAdjacentHTML('beforeend','<button type="button" class="button outline small" data-print-merch-stocktake>Print merch stocktake</button>');
$('[data-view="shop"]').insertAdjacentHTML('beforeend','<div id="event-entry-fees"></div>');
setupClubPricing({api,esc});
setupTreasurerOrders({api,esc});
setupStockReports({api,esc});
setupPriceNotices({api,esc});
setupMerchStocktake({api,esc,toast});
setupReturningMembers({api,esc});
memberRoom=setupMemberRoom({api,esc,toast});
const meetingDesk=setupMeetingWorkflow({api,toast,download,esc,modal,setupRecording});
setupAgmJobs({api,esc,navigate:hash=>new Promise(resolve=>{if(location.hash===hash){route();resolve(true);}else{window.addEventListener('plfc:navigated',event=>resolve(event.detail.hash===hash),{once:true});location.hash=hash;}})});
handoffs=setupHandoffs({api,esc});
window.addEventListener('hashchange',()=>{
  if(location.hash.startsWith('#activate=')){
    viewAs='';requestedViewAs='';sessionStorage.removeItem('sandy-view-as');
    invitationToken=new URLSearchParams(location.hash.slice(1)).get('activate');
    history.replaceState(null,'','#members');checkInvitation();
  }else if(location.hash.startsWith('#demo-activate=')){
    viewAs='';requestedViewAs='';sessionStorage.removeItem('sandy-view-as');
    const values=new URLSearchParams(location.hash.slice(1));demoToken=values.get('demo-activate');demoLogin=values.get('login')||'';
    history.replaceState(null,'','#webmaster/demo');route();
  }else route();
});
if(location.hash.startsWith('#activate=')){
  viewAs='';requestedViewAs='';sessionStorage.removeItem('sandy-view-as');
  invitationToken=new URLSearchParams(location.hash.slice(1)).get('activate');
  history.replaceState(null,'','#members');checkInvitation();
}
if(location.hash.startsWith('#demo-activate=')){
  viewAs='';requestedViewAs='';sessionStorage.removeItem('sandy-view-as');
  const values=new URLSearchParams(location.hash.slice(1));demoToken=values.get('demo-activate');demoLogin=values.get('login')||'';
  history.replaceState(null,'','#webmaster/demo');
}
refreshSession();
