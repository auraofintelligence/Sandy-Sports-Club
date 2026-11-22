import {setupApplicationEntry} from './applications.js';
import {passwordField,setupPasswordEyes} from './password-field.js';

const host=document.getElementById('return-invitation');
setupPasswordEyes(host);
let token=location.hash.slice(1),state=null,setupToken='',busy=false,revision=0;
if(token)history.replaceState(null,'',location.pathname);
const date=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-AU',{dateStyle:'long',timeZone:'Australia/Brisbane'}).format(new Date(value)):'';
const note=message=>{const el=host.querySelector('[data-notice]');if(el)el.textContent=message;};
function paint(contents){
  host.innerHTML=contents+'<p role="status" data-notice></p>';
}
async function request(path,body){
  const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({error:'The club connection is unavailable. Please try again.'}));
  if(!response.ok){const err=new Error(typeof result.error==='string'?result.error:result.error?.message||'Please try again.');err.status=response.status;throw err;}return result;
}
function show(){
  const help='<p>Speak to the Secretary or Assistant Secretary if you need a hand.</p>';
  if(state.status==='cancelled'){paint('<h2>This invitation is closed</h2>'+help);return;}
  if(state.signOutRequired){
    paint('<h2>A club account is already signed in</h2><p>This invitation sets up a separate member account. On a shared device, sign out of the current account before continuing.</p><button type="button" class="button" data-sign-out>Sign out and return to this invitation</button>');return;
  }
  if(state.signInRequired||state.wrongAccount){
    paint('<h2>Sign in to open your offer</h2><p>'+(state.wrongAccount?'This link belongs to a different member. Enter the username and password of the person who received it.':'Use your existing club username and password, even if your membership has lapsed.')+'</p>'+
      '<form class="return-form" data-sign-in><label>Club username<input name="login" maxlength="80" required autocomplete="username" autocorrect="off" autocapitalize="none" spellcheck="false"></label>'+passwordField('password','Club password')+'<button class="button">Sign in to my invitation</button></form>'+help);return;
  }
  if(state.status==='granted'){paint('<h2>Welcome back!</h2><p>Your membership is active'+(date(state.paidThrough)?' through <strong>'+date(state.paidThrough)+'</strong>':'')+'.</p><a href="/clubhouse.html#members" class="button">Open member home</a>');return;}
  if(state.needsApplication){
    paint('<h2>Bring your club details up to date</h2><p>The club has offered you a complimentary year. Complete the short membership application so the committee can confirm your details. A parent or guardian completes a junior or cadet application.</p><button class="button" data-open-application type="button">Complete my membership details</button>');return;
  }
  if(state.targetType==='paper'&&state.applicationStatus&&!state.canAccept&&state.status!=='activation'){
    const headings={pending:'Your application is with the committee',followup:'The committee would like to speak with you',declined:'The committee has reviewed your application'};
    paint('<h2>'+(headings[state.applicationStatus]||'Application under review')+'</h2><p>'+(state.applicationStatus==='declined'?'Contact the Secretary to discuss the outcome.':'Keep the invitation the Secretary gave you. Open it again when the committee has confirmed your membership application.')+'</p><button class="button outline" type="button" data-refresh>Check the status</button>');return;
  }
  if(!state.canAccept&&state.status!=='activation'){paint('<h2>Your invitation is being reviewed</h2>'+help+'<button class="button outline" type="button" data-refresh>Check the status</button>');return;}
  const newAccount=state.targetType!=='account',resuming=state.status==='activation';
  const terms=newAccount?'Your complimentary year starts when you set up your club account.':'Your current membership keeps its full term. If your membership has lapsed, the complimentary year starts when you accept.';
  paint('<h2>'+(resuming?'Finish setting up your account':'One year with the club, on us')+'</h2><p>'+(resuming?'You have already accepted your membership. Continue to choose your club password.':'The Treasurer has approved your welcome-back membership. '+terms)+'</p>'+
    '<form class="return-form" data-accept-invitation>'+
    (newAccount?'<label>'+(resuming?'Club username':'Choose your club username')+'<input name="login" minlength="3" maxlength="80" required autocomplete="username" autocapitalize="none" spellcheck="false"></label><small>'+(resuming?'Use the username you chose when you accepted.':'Use 3 to 80 letters, numbers or email characters. You will use this name to sign in.')+'</small>':'')+
    (!resuming?'<label class="return-check"><input type="checkbox" name="confirm" required><span>Yes, I accept this complimentary 12-month club membership.</span></label>':'')+
    '<button class="button">'+(resuming?'Continue to password setup':'Accept my welcome-back membership')+'</button></form>');
}
async function refresh(){
  const rev=++revision;
  if(!token){paint('<h2>Open the private link from the club</h2><p>Use the complete welcome-back invitation the Secretary gave you. Ask for it again if you no longer have it.</p>');return;}
  try{const result=await request('/api/returning-offer',{action:'check',token});if(rev!==revision)return;state=result;show();}
  catch(err){if(rev!==revision)return;paint('<h2>We could not open this invitation</h2><p data-problem></p><p>Use the complete link from the Secretary. If you have already set your password, you can <a href="/clubhouse.html#members">sign in to member home</a>.</p><button class="button outline" data-refresh>Check again</button>');host.querySelector('[data-problem]').textContent=err.message;}
}
setupApplicationEntry({returningApplication:async application=>{
  const result=await request('/api/returning-offer',{action:'apply',token,application});state=result;show();
}});
host.addEventListener('click',async e=>{
  if(e.target.closest('[data-open-application]'))window.dispatchEvent(new Event('plfc:apply'));
  if(e.target.closest('[data-refresh]')&&!busy)refresh();
  if(e.target.closest('[data-set-password]')&&setupToken)location.replace('/clubhouse.html#activate='+encodeURIComponent(setupToken));
  const signout=e.target.closest('[data-sign-out]');
  if(signout&&!busy){signout.disabled=true;busy=true;try{await request('/api/auth/logout',{});await refresh();}catch(error){note(error.message);}finally{busy=false;signout.disabled=false;}}
});
host.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const f=e.target,fields=f.elements,b=f.querySelector('button:not([type="button"])');busy=true;b.disabled=true;note('Checking with the club…');
  const rev=++revision;
  try{
    if(f.matches('[data-sign-in]')){
      await request('/api/auth/login',{login:fields.login.value.trim(),password:fields.password.value});
      if(rev===revision){fields.password.value='';await refresh();}return;
    }
    if(!f.matches('[data-accept-invitation]')||(!fields.confirm?.checked&&state.status!=='activation'))return;
    const body={action:'accept',token,confirm:true};if(fields.login)body.login=fields.login.value.trim();
    const result=await request('/api/returning-offer',body);if(rev!==revision)return;
    if(result.activation){setupToken=result.activation.token;paint('<h2>Choose your club password</h2><p>Your welcome-back offer has been accepted. Choose a password to finish setting up your membership.</p><button type="button" class="button" data-set-password>Set my club password</button>');}
    else{state={...state,...result.offer};show();}
  }catch(err){if(rev===revision)note(err.message);}
  finally{busy=false;if(b.isConnected)b.disabled=false;}
});
window.addEventListener('pagehide',()=>{revision++;token='';setupToken='';state=null;host.replaceChildren();});
window.addEventListener('pageshow',e=>{if(e.persisted)refresh();});
refresh();
