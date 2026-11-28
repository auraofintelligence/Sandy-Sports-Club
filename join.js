// Join form. While online nominations are switched off (the default), it prepares an
// email in the visitor's own mail app or copies the text. When the owner switches
// nominations on, it sends to the Sandy Worker with a Turnstile check instead.
const form=document.querySelector('#join-form'), status=document.querySelector('#nomination-status');
let online=false,widget=null;
const OWNER='sbt4183@gmail.com';
function nomination(){const d=new FormData(form);return ['Sandy Sports Club proposal: expression of interest','',`Name: ${d.get('name')}`,`Email: ${d.get('email')}`,`Town: ${d.get('town')}`,`Path: ${d.get('path')}`,`Sports and activities: ${d.get('interests')||'Not specified'}`,'',`What I can bring: ${d.get('offer')||'Not specified'}`,'',...(d.get('path')==='Committee nomination'?['If elected, I agree to every meeting I attend being recorded on video and audio, archived permanently and available to all members (draft constitution rule 4B).','']:[]),'I understand this is an expression of interest, not paid membership or an appointment.'].join('\n')}
// Standing for office: agreeing to meeting recording (draft constitution rule 4B) is part of the nomination.
const recBox=document.querySelector('#recording-consent'),recInput=recBox?.querySelector('input');
function syncRecording(){const on=form?.elements.path?.value==='Committee nomination';if(recBox){recBox.hidden=!on;recInput.required=on;if(!on)recInput.checked=false}}
form?.elements.path?.addEventListener('change',syncRecording);syncRecording();
function uuid(){return crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16))}
const submissionId=uuid();
async function goOnline(siteKey){
 const box=document.querySelector('#nomination-verify');
 await new Promise((ok,bad)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=ok;s.onerror=bad;document.head.append(s)});
 box.hidden=false;widget=window.turnstile.render(box,{sitekey:siteKey});
 online=true;
 document.querySelector('#nomination-submit').textContent='Send nomination';
 const copy=document.querySelector('#copy-nomination');if(copy)copy.hidden=true;
 status.textContent='Your nomination goes straight to the club organisers. Nothing is published.';
}
async function sendOnline(){
 const d=new FormData(form),token=window.turnstile?.getResponse(widget)||'';
 if(!token){status.textContent='Complete the verification check, then send.';return}
 const button=document.querySelector('#nomination-submit');button.disabled=true;status.textContent='Sending...';
 try{
  const r=await fetch('/api/nominate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId,name:d.get('name'),email:d.get('email'),town:d.get('town'),pathway:d.get('path'),interests:d.get('interests'),offer:d.get('offer'),consent:d.get('consent')==='on',recordingConsent:d.get('recording')==='on',website:d.get('website')||'',turnstileToken:token})});
  const body=await r.json().catch(()=>({}));
  if(r.ok){form.outerHTML='<div class="nomination-done" role="status" tabindex="-1" id="nomination-done"><h3>Thanks, we\'ve got it.</h3><p>Your expression of interest has reached the Sandy Sports organisers. It is not membership or an appointment; someone will be in touch if there is a next step.</p></div>';document.querySelector('#nomination-done')?.focus();return}
  status.textContent=body.error||'Your nomination could not be sent. Please try again.';
  window.turnstile?.reset(widget);
 }catch{status.textContent='Your nomination could not be sent. Check your connection and try again.'}
 button.disabled=false;
}
form?.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;
 if(online){sendOnline();return}
 const d=new FormData(form);const subject='Sandy Sports nomination: '+d.get('path');location.href=`mailto:${OWNER}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(nomination())}`;status.textContent='Your email app should open. Press Send there to deliver your nomination.'});
document.querySelector('#copy-nomination')?.addEventListener('click',async()=>{if(!form.reportValidity())return;try{await navigator.clipboard.writeText(nomination());status.textContent='Copied. Email it to '+OWNER+'.'}catch{status.textContent='Copy unavailable; use Prepare email nomination.'}});
if(form)fetch('/api/nominate',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(c=>{if(c?.open&&c.siteKey)return goOnline(c.siteKey)}).catch(()=>{});
