// Keep a document bound to its original server-confirmed mode. A stale preview
// must never turn into live administration when a different tab exits a view.
let context=null,readOnly=false;
export function isReadOnlyView(){return readOnly}
export async function viewFetch(path,options={}){
 const url=new URL(path,location.href),headers=new Headers(options.headers||{});
 if(url.origin===location.origin&&url.pathname.startsWith('/api/')&&context&&!url.pathname.startsWith('/api/view/'))headers.set('X-Sandy-View',context);
 const response=await fetch(path,{...options,headers});
 if(url.origin===location.origin&&url.pathname==='/api/session'&&response.ok){
  const session=await response.clone().json();
  if(session.authenticated){
   context=session.viewContext||'live';readOnly=session.readOnly===true;
   if(readOnly)document.documentElement.dataset.sandyReadOnly='true';
  }
 }
 return response;
}
const protections=new Map();
export function protectView(selector,root=document){
 if(!readOnly)return;
 let entry=protections.get(root);
 if(!entry){entry={selectors:new Set()};protections.set(root,entry)}
 entry.selectors.add(selector);
 const protect=()=>{
  root.querySelectorAll([...entry.selectors].join(',')).forEach(el=>{
   if(!el.disabled)el.disabled=true;
   if(el.dataset.viewBlocked!=='1'){el.dataset.viewBlocked='1';el.title='Synthetic view only. Return to live administration to save.'}
  });
 };
 protect();
 if(!entry.observer){
  entry.observer=new MutationObserver(protect);
  entry.observer.observe(root===document?document.documentElement:root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
 }
}
export async function exitView(){
 const res=await viewFetch('/api/view/exit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 const result=await res.json();
 if(!res.ok)throw Error(result.error||'Could not exit the view.');
 location.href=result.realRestored?'/club-admin.html':'/club-login.html';
}
export function installExitControl(id){
 const button=document.getElementById(id);if(!button)return;
 button.addEventListener('click',()=>exitView().catch(e=>window.alert(e.message)));
}
