// Sports interest survey on sports.html. While the survey is switched off (the default),
// the questions are shown but the form stays disabled with a "Survey opening soon" note.
// When the owner switches it on, answers go to /api/survey with a Turnstile check.
// No names, emails or contact details are collected.
const form=document.querySelector('#survey-form'),fields=document.querySelector('#survey-fields'),status=document.querySelector('#survey-status'),state=document.querySelector('#survey-state');
let widget=null,sports=[];
function uuid(){return crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16))}
const submissionId=uuid();
function choices(){
 const d=new FormData(form),rows=[];
 form.querySelectorAll('tbody tr').forEach((tr,i)=>{const goal=d.get('goal-'+i);if(!goal)return;rows.push({sport:tr.querySelector('th').textContent,goal,rank:Number(d.get('rank-'+i))||99,order:i})});
 rows.sort((a,b)=>a.rank-b.rank||a.order-b.order);
 return rows.map(({sport,goal})=>({sport,goal}));
}
async function open(siteKey){
 const box=document.querySelector('#survey-verify');
 await new Promise((ok,bad)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=ok;s.onerror=bad;document.head.append(s)});
 box.hidden=false;widget=window.turnstile.render(box,{sitekey:siteKey});
 fields.disabled=false;state.hidden=true;
 document.querySelector('#survey-submit').textContent='Send my answers';
 status.textContent='Your answers go to the club organisers as anonymous totals. We do not ask for your name, email or contact details.';
}
async function send(){
 const list=choices();
 if(!list.length){status.textContent='Choose what you want for at least one sport.';return}
 const token=window.turnstile?.getResponse(widget)||'';
 if(!token){status.textContent='Complete the verification check, then send.';return}
 const d=new FormData(form),button=document.querySelector('#survey-submit');button.disabled=true;status.textContent='Sending...';
 try{
  const r=await fetch('/api/survey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId,choices:list,ageGroup:d.get('ageGroup')||'',town:d.get('town')||'',frequency:d.get('frequency')||'',website:d.get('website')||'',turnstileToken:token})});
  const body=await r.json().catch(()=>({}));
  if(r.ok){form.outerHTML='<div class="nomination-done" role="status" tabindex="-1" id="survey-done"><h3>Thanks, your answers are in.</h3><p>They help the organisers plan which sports to start with. They are not a booking or a membership.</p></div>';document.querySelector('#survey-done')?.focus();return}
  status.textContent=body.error||'Your answers could not be sent. Please try again.';
  window.turnstile?.reset(widget);
 }catch{status.textContent='Your answers could not be sent. Check your connection and try again.'}
 button.disabled=false;
}
form?.addEventListener('submit',e=>{e.preventDefault();if(fields.disabled){status.textContent='The survey is opening soon. Answers can be sent once it opens.';return}send()});
if(form)fetch('/api/survey',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(c=>{if(c?.open&&c.siteKey)return open(c.siteKey)}).catch(()=>{});
