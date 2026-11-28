const form=document.querySelector('#join-form'),state=document.querySelector('#join-state'),button=document.querySelector('#join-submit');
let termsVersion='',challengeToken='',challengeId=null,useTurnstile=false;
function message(text,bad=false){state.textContent=text;state.className='club-status'+(bad?' bad':'')}
async function initialise(){
 try{
  const session=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(session?.authenticated){message('You are already signed in.');state.insertAdjacentHTML('beforeend',' <a href="/member-home.html">Go to My Membership</a>');return}
  const res=await fetch('/api/join',{cache:'no-store',credentials:'same-origin'});
  const config=res.ok?await res.json():null;
  if(!config?.open){message('Online joining is not open yet. You can register your interest in the meantime.',true);state.insertAdjacentHTML('beforeend',' <a href="/interest.html">Register interest</a>');return}
  termsVersion=config.termsVersion;document.querySelector('#join-terms').textContent=config.terms;
  form.hidden=false;message('Free. Takes a minute.');
  const pub=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
  if(pub.turnstileSiteKey&&window.turnstile?.render){useTurnstile=true;button.disabled=true;
   challengeId=window.turnstile.render('#join-challenge',{sitekey:pub.turnstileSiteKey,callback:t=>{challengeToken=t;button.disabled=false},'expired-callback':()=>{challengeToken='';button.disabled=true},'error-callback':()=>{challengeToken='';button.disabled=true}});}
 }catch{message('The club service could not be reached. Please try again shortly.',true)}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const d=new FormData(form);
 const body={fullName:d.get('fullName'),preferredName:d.get('preferredName'),email:d.get('email'),mobile:d.get('mobile'),town:d.get('town'),
  audienceRegion:d.get('audienceRegion'),gender:d.get('gender'),dob:d.get('dob'),username:d.get('username'),password:d.get('password'),website:d.get('website')||'',
  contactConsent:form.elements.contactConsent.checked,termsAccepted:form.elements.termsAccepted.checked,termsVersion,turnstileToken:challengeToken};
 button.disabled=true;message('Creating your membership…');
 try{
  const response=await fetch('/api/join',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||'Joining could not be completed.');
  message('Welcome to Sandy Sports! Next, pick your avatar or add a photo…');
  location.assign(result.next||'/member-home.html');
 }catch(error){message(error.message,true);if(useTurnstile&&challengeId!==null){challengeToken='';window.turnstile.reset(challengeId)}button.disabled=useTurnstile}
});
initialise();
