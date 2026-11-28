const form=document.querySelector('#interest-form'),state=document.querySelector('#interest-state'),button=document.querySelector('#interest-submit');
let challengeToken='',challengeId=null,ready=false,useTurnstile=false;
function message(text,bad=false){state.textContent=text;state.className='club-status'+(bad?' bad':'')}
async function initialise(){
 try{
  const res=await fetch('/api/public-config',{cache:'no-store',credentials:'same-origin'});
  if(!res.ok)throw Error('Shared registration service not deployed');
  const config=await res.json();
  if(!config.publicInterestReady){
   message('Interest registration is not available right now. Please try again soon.',true);
   return;
  }
  form.hidden=false;ready=true;
  if(config.turnstileSiteKey){
   if(!window.turnstile?.render){message('Human verification did not load. Please reload the page.',true);return}
   useTurnstile=true;
   challengeId=window.turnstile.render('#interest-challenge',{
    sitekey:config.turnstileSiteKey,
    callback:token=>{challengeToken=token;button.disabled=false},
    'expired-callback':()=>{challengeToken='';button.disabled=true},
    'error-callback':()=>{challengeToken='';button.disabled=true;message('Verification was interrupted. Please retry.',true)}
   });
  }else button.disabled=false;
  message('Ready when you are. Registering interest is free and does not sign you up to anything.');
 }catch{message('The secure shared club service is not yet connected. No personal data will be sent or saved by this page.',true)}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!ready||(useTurnstile&&!challengeToken)){message('Complete verification before submitting.',true);return}
 const data=new FormData(form);
 const body={firstName:data.get('firstName'),email:data.get('email'),town:data.get('town'),
  audienceRegion:data.get('audienceRegion'),interests:data.getAll('interest'),
  comments:data.get('comments'),contactConsent:form.elements.contactConsent.checked,
  source:'sandy-sports-interest-form',turnstileToken:challengeToken,website:data.get('website')||''};
 button.disabled=true;
 try{
  const response=await fetch('/api/interest',{method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||'Shared registration could not be completed.');
  form.reset();challengeToken='';
  if(window.turnstile&&challengeId!==null)window.turnstile.reset(challengeId);
  message('Thanks, you are on the list. We will be in touch about the summer come-and-try days.');
 }catch(error){
  message('Your information has not been confirmed as saved: '+error.message,true);
  challengeToken='';if(window.turnstile&&challengeId!==null)window.turnstile.reset(challengeId);
 }finally{button.disabled=useTurnstile}
});
initialise();
