import {MemberArchive} from './member-export-archive.js';

const button=document.getElementById('prepare-export'),status=document.getElementById('export-status'),files=document.getElementById('export-files');
const urls=[];
let job=null;
function reset(){
  job?.abort();job=null;
  for(const url of urls)URL.revokeObjectURL(url);
  urls.length=0;files.replaceChildren();button.hidden=true;button.disabled=false;
}
function signInHelp(){
  const login=document.createElement('a');login.href='/clubhouse.html#members/safety';login.className='button outline';login.textContent='Sign in to member home';files.append(login);
}
async function read(path,signal,account){
  const res=await fetch(path,{signal,credentials:'same-origin',cache:'no-store',headers:account?{'X-Sandy-Export-Account':account}:{}});
  const data=await res.json();
  if(!res.ok){const error=new Error(data.error?.message||data.error||'Your download could not be prepared. Try again.');error.status=res.status;throw error;}
  return data;
}
function problem(error){
  if(error.name==='AbortError')return;
  status.textContent=error.message||'Your download could not be prepared. Check your connection and try again.';
  if([401,403].includes(error.status)){button.hidden=true;signInHelp();}
  else{button.hidden=false;button.disabled=false;button.textContent='Try my download again';}
}
async function check(){
  reset();job=new AbortController();const {signal}=job;
  try{
    const overview=await read('/api/member/export',signal);
    const total=overview.groups.reduce((n,g)=>n+g.total,0);
    status.textContent=total?total+' saved '+(total===1?'record is':'records are')+' available for your copy.':'Your account currently has no saved contributions. You can still download a record of this.';
    button.textContent='Prepare my download';button.hidden=false;
  }catch(error){if(!signal.aborted)problem(error);}
}
button.addEventListener('click',async()=>{
  reset();button.hidden=false;button.disabled=true;job=new AbortController();const {signal}=job;
  status.textContent='Collecting your contributions…';
  try{
    const overview=await read('/api/member/export',signal),archive=new MemberArchive(overview.groups,overview.createdAt);
    let total=0;
    for(const group of overview.groups){
      if(!group.total)continue;
      let after=0;
      do{
        status.textContent='Collecting '+group.title.toLowerCase()+'… '+total+' records copied.';
        const query=new URLSearchParams({after,through:group.through});
        const page=await read('/api/member/export/'+group.id+'?'+query,signal,overview.account);
        for(const row of page.rows){archive.add(group.id,row);total++;}
        after=page.next;
      }while(after!==null);
    }
    const parts=archive.finish(),date=overview.createdAt.slice(0,10);
    for(const [i,blob] of parts.entries()){
      const url=URL.createObjectURL(blob),link=document.createElement('a');urls.push(url);
      link.className='button';link.href=url;
      link.download='Sandy-my-contributions-'+date+(parts.length>1?'-part-'+(i+1):'')+'.zip';
      link.textContent=parts.length>1?'Save ZIP part '+(i+1)+' of '+parts.length:'Save my ZIP file';
      files.append(link);
    }
    status.textContent='Ready to save. '+total+' '+(total===1?'record':'records')+' and '+archive.photoCount+' '+(archive.photoCount===1?'photo.':'photos.')+' '+
      (parts.length>1?'Save each part and extract them into the same folder. ':'')+'Open Start here.html in the extracted folder.';
    button.hidden=true;files.querySelector('a')?.focus();
  }catch(error){if(!signal.aborted)problem(error);}
});
const changes='BroadcastChannel' in window?new BroadcastChannel('sandy-access'):null;
if(changes)changes.onmessage=check;
window.addEventListener('pagehide',()=>{reset();status.textContent='Checking your sign-in…';});
window.addEventListener('pageshow',e=>{if(e.persisted)check();});
check();
