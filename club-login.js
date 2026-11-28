import {viewFetch,isReadOnlyView,protectView,installExitControl} from './club-view-client.js';
const $=id=>document.getElementById(id);
const message=(txt,bad=false)=>{$('auth-state').textContent=txt;$('auth-state').className='club-status'+(bad?' bad':'')};
async function request(path,body){
 const response=await viewFetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},
  credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined});
 let result={};try{result=await response.json()}catch{}
 if(!response.ok)throw Error(result.error||'The shared club service is unavailable ('+response.status+').');
 return result;
}
function data(form){return Object.fromEntries(new FormData(form))}
async function check(){
 try{
  const session=await request('/api/session');
  if(!session.storageReady||!session.authReady){
   message('The shared Cloudflare/D1 backend has not been activated. No login or membership data will be stored by this page.',true);
   return;
  }
  $('club-password-panel').hidden=!session.authenticated||session.readOnly||session.identity?.role==='webmaster_demo';
  if(session.readOnly){message('View-only synthetic session is open. Continue to My Clubhouse or explicitly exit the view.');return}
  if(session.authenticated){
   message('Signed in as '+session.identity.name+' ('+session.identity.role+'). Open shared administration.');
  }else message('Shared club storage is connected. Sign in with an activated account.');
 }catch{message('The shared Worker API is not deployed yet. These forms do not save into browser storage. No account has been created.',true)}
}
async function submit(formId,path,redirect=false){
 const form=$(formId);form.addEventListener('submit',async ev=>{
  ev.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;
  const input=data(form);
  try{
   const result=await request(path,input);form.reset();
   message(path.endsWith('/bootstrap')?'First webmaster reserved and activated. Remove the bootstrap Cloudflare secret. Then sign in.':
     path.endsWith('/activate')?'Account activated. You may now sign in.':path.endsWith('/recover')||path.endsWith('/change-password')?'Password changed. All previous sessions have been signed out. Sign in with your new password.':'Signed in. Opening shared club administration.');
   if(path.endsWith('/recover')||path.endsWith('/change-password'))$('club-password-panel').hidden=true;
   if(redirect){if(path==='/api/view/login'){location.href='/club-admin.html';return}const session=await request('/api/session');const next=new URLSearchParams(location.search).get('next');
    location.href=next&&/^\/[a-z0-9-]+\.html(#[a-z0-9-]*)?$/i.test(next)?next:session.identity?.role==='member'?'/member-home.html':'/club-admin.html'}
  }catch(error){message(error.message,true)}
  finally{button.disabled=false}
 });
}
// One-time invitation links carry their token in a URL fragment (never sent in HTTP requests).
// Read it into the activation field, then remove the fragment from the address bar.
function openPrivateInvitation(){
 const params=new URLSearchParams(location.hash.slice(1)),recovery=params.has('recover'),token=params.get(recovery?'recover':'invite');
 if(!token||!/^[a-f0-9]{64}$/i.test(token))return;
 const panel=$(recovery?'club-recovery-panel':'club-invite-panel'),form=$(recovery?'club-recover':'club-activate');
 if(!panel||!form)return;
 panel.open=true;form.elements.token.value=token.toLowerCase();
 history.replaceState(null,'',location.pathname+location.search);
 message(recovery?'Private recovery link loaded. Choose a new password.':'Private officer invitation loaded. Choose your own strong password to activate your account.');
 panel.scrollIntoView({block:'start'});
}
openPrivateInvitation();
submit('club-login','/api/auth/login',true);
submit('club-activate','/api/auth/activate');
submit('club-recover','/api/auth/recover');
submit('club-change-password','/api/auth/change-password');
submit('club-bootstrap','/api/auth/bootstrap');
submit('club-showcase-login','/api/view/login',true);
installExitControl('club-exit-view');
check();
