const $=id=>document.getElementById(id);
const message=(txt,bad=false)=>{$('auth-state').textContent=txt;$('auth-state').className='club-status'+(bad?' bad':'')};
async function request(path,body){
 const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},
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
     path.endsWith('/activate')?'Account activated. You may now sign in.':'Signed in. Opening shared club administration.');
   if(redirect){const session=await request('/api/session');location.href=session.identity?.role==='member'?'/member-home.html':'/club-admin.html'}
  }catch(error){message(error.message,true)}
  finally{button.disabled=false}
 });
}
submit('club-login','/api/auth/login',true);
submit('club-activate','/api/auth/activate');
submit('club-bootstrap','/api/auth/bootstrap');
check();
