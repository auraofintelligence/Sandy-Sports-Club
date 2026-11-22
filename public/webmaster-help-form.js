const form=document.querySelector('#help-form'),start=document.querySelector('#help-start'),receipt=document.querySelector('#help-receipt');
const feedback=document.querySelector('#help-feedback'),result=document.querySelector('#help-result');
const source=new URLSearchParams(location.search).get('from');
const from=['signin','invitation','access','email','website'].includes(source)?source:'website';
const freshKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const savedKey=new URLSearchParams(location.hash.slice(1)).get('receipt');
let key=savedKey&&/^[a-f0-9]{64}$/.test(savedKey)?savedKey:freshKey();
const initialTopic={signin:'password',invitation:'invitation',access:'workspace',email:'email'}[from]||'';
form.elements.topic.value=initialTopic;
form.elements.contactType.onchange=()=>{
  const phone=form.elements.contactType.value==='phone',field=form.elements.contact;
  field.type=phone?'tel':'email';field.autocomplete=phone?'tel':'email';field.maxLength=phone?24:254;field.value='';
  document.querySelector('#help-contact-label').textContent=phone?'Your phone number':'Your email address';
};
async function post(path,data){
  const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
  const body=await res.json();
  if(!res.ok)throw Error(body.error||'The request could not be saved. Please try again.');
  return body;
}
function show(data){
  start.hidden=true;receipt.hidden=false;
  result.textContent={new:'Received. Your request is in the shared Webmaster and Secretary inbox.',
    in_progress:'An officer is following up on your request.',resolved:'The officers have marked your request resolved.'}[data.state];
  document.querySelector('#help-reference').textContent='Your reference is '+data.reference+'.';
  receipt.querySelector('h2').focus();
}
async function refresh(){
  start.hidden=true;receipt.hidden=false;result.textContent='Checking your request…';
  try{show(await post('/api/access-help/status',{key}));}catch(err){result.textContent=err.message;}
}
document.querySelector('#help-refresh').onclick=refresh;
document.querySelector('#help-new').onclick=()=>{
  history.replaceState(null,'',location.pathname+location.search);key=freshKey();form.reset();
  form.elements.contactType.onchange();form.elements.topic.value=initialTopic;start.hidden=false;receipt.hidden=true;
  document.querySelector('#help-copy-status').textContent='';document.querySelector('#help-copy-manual').hidden=true;
  document.querySelector('#help-copy-manual input').value='';form.elements.topic.focus();
};
document.querySelector('#help-copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(location.href);document.querySelector('#help-copy-status').textContent='Private status link copied.';}
  catch{const label=document.querySelector('#help-copy-manual');label.hidden=false;const input=label.querySelector('input');input.value=location.href;input.select();document.querySelector('#help-copy-status').textContent='Copy the selected link to keep it.';}
};
form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;feedback.textContent='Sending your request…';
  try{
    const data=await post('/api/access-help',{key,source:from,...Object.fromEntries(new FormData(form))});
    history.replaceState(null,'',location.pathname+location.search+'#receipt='+key);
    form.reset();feedback.textContent='';show(data);
  }catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
};
if(savedKey===key)refresh();
