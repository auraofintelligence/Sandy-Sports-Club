import {viewFetch,isReadOnlyView,protectView,installExitControl} from './club-view-client.js';
const form=document.querySelector('#constitution-form'),preview=document.querySelector('#constitution-preview'),output=document.querySelector('#constitution-text'),status=document.querySelector('#constitution-status');
const topics=['Interpretation','Name','Objects','Powers','Classes of members','Transition from an unincorporated group','New membership','Membership fees','Admission and rejection','Membership suspension','Membership ends','Appeals and general meeting','Register of members','Use of register information','Secretary appointment','Secretary removal','Secretary functions','Management committee composition','Committee election','Resignation and removal','Vacancies','Committee functions','Committee meetings','Quorum and adjournment','Special committee meeting','Committee minutes','Subcommittees','Validity of acts','Decisions without a meeting','First AGM','Subsequent AGMs','AGM business and financial reporting','Notice of general meeting','General meeting quorum','Meeting procedure','Voting','Special general meeting','Proxies','General meeting minutes','By-laws','Rule alterations','Funds and accounts','Financial matters','Documents','Financial year','Surplus assets','Grievance procedure','Conflicts, safeguarding and digital stewardship'];
// Disabled view-only fields still contain the fictional draft and must render in previews.
const val=name=>String(form.elements.namedItem(name)?.value||'').trim();
function build(){
 const voting={review:'Founding decision: assess whether the PLFC v1.2 island resident / non-resident weighted vote design is appropriate for this new club. No formula is adopted by this draft.',one:'Proposed: one vote for each eligible adult member, subject to the membership and voting clauses agreed by the founding members.',classes:'Founding decision: define each class and its voting rights explicitly.'}[val('voting')];
 const balance={
  'women-led':'Proposed women-led composition: women should hold a majority of filled elected management committee positions. Invite women to shape the founding purpose and nominate for chair, treasurer, sport, facilities and media leadership. All genders remain eligible to nominate. Gender is self-described and private; no one is required to disclose it publicly. Define a fair election and vacancy process in the final rules, including documented recruitment and a timely review if a suitable candidate is not available. A temporary vacancy should not by itself invalidate committee decisions.',
  equity:'Proposed equity target: at least half of filled elected management committee positions should be held by women and/or gender diverse people. For an odd number, aim for at least one fewer than half, consistent with the Australian Sports Commission example. Invite women into substantial officer and programme roles. All genders remain eligible; use self-description, privacy and a documented recruitment response to vacancies.',
  balanced:'Proposed balance policy: actively recruit women and gender diverse people, avoid an all-male founding committee, aim for a gender-balanced management committee and review representation each year. Set a measurable target and vacancy response with the founding group.'
 }[val('balance')]||'Founding decision: settle a leadership composition policy.';
 return `# ${val('name')}: constitution working draft

Generated ${new Date().toLocaleDateString('en-AU')}. Drafting aid based on the owner’s PLFC v1.2 custom constitution structure. This is not the adopted or registered rules of Sandy Sports.

## 1. Name and objects

Proposed name: ${val('name')}

${val('objects')}

## 2. Powers and AI-first operating approach

The club may carry out activities and hold or manage assets in support of its objects, subject to its final rules and applicable law.

${val('ai')}

Human officers remain responsible for admission, votes, finances, cultural permissions and decisions. Define the review and audit process in the final text.

## 3. Members and voting

Proposed classes: ${val('classes')}

${voting}

Membership application, approval, suspension, termination, appeal, register access, guardian consent and fees need complete clauses in the final rules.

## 4. Committee and delegated groups

Proposed roles: ${val('roles')}

${balance}

Where suitable nominees are available, consider a chair and deputy chair with different gender identities. Share finance, sport, technical, safety and creative responsibility rather than placing women only in care or administration roles. Require a safe conduct and grievance process, conflicts disclosure and two-person oversight of money, membership and digital accounts. These are proposed clauses for founding review, not adopted rules. Review any binding gender-based election rule with current Queensland requirements before adoption.

Working quorum: ${val('quorum')}

Film club: ${val('film')}. Specify its mandate, reporting, budgets, editorial authority and appointment process in the final text.

## 5. Facilities, media and cultural authority

${val('assets')}

${val('culture')}

## 6. Finance

Expenditure review threshold for discussion: AUD ${Number(val('threshold')||0).toLocaleString('en-AU')}. This does not itself authorise spending. Set banking, signatories, conflicts, accounts, reporting, grants, donations, investment and asset disposal rules.

Financial year end proposal: ${val('year')}.

## 7. Other changes for the founding group

${val('additional')||'No additional notes entered.'}

## PLFC v1.2 topic map for clause-by-clause review

${topics.map((topic,i)=>`${i+1}. ${topic}: [draft or review clause against current Queensland requirements]`).join('\n')}

## Review points

- Decide whether to adopt the entire current Queensland model rules with permitted details, or draft complete own rules.
- Check all required matters, including grievance procedure, member rights, meetings, finance and surplus assets, against current Office of Fair Trading materials.
- Resolve any PLFC-specific fishing wording, classes, weighting, historic entity transition and the duplicate rule 11 numbering.
- Check the elected committee composition clause, voluntary self-description, fair nominations, vacancies and interim measures with appropriate Queensland governance advice before making it binding.
- Record founding resolutions and use the final adopted text for incorporation. This export is a working document only.
`;
}
function render(){output.textContent=build();preview.hidden=false;status.textContent='Draft generated in this browser.'}
let localDraftReady=false;
function enableLocalDraft(){
 if(localDraftReady)return;localDraftReady=true;
 try{const saved=JSON.parse(localStorage.getItem('sandy-constitution-draft')||'{}');for(const [name,value] of Object.entries(saved)){const field=form.elements.namedItem(name);if(field)field.value=value}}catch{}
}
form?.addEventListener('input',()=>{if(!localDraftReady||isReadOnlyView())return;const d=Object.fromEntries(new FormData(form));localStorage.setItem('sandy-constitution-draft',JSON.stringify(d))});
form?.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())render()});
document.querySelector('#download-constitution')?.addEventListener('click',()=>{if(!form.reportValidity())return;render();const blob=new Blob([output.textContent],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sandy-sports-constitution-working-draft.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Working draft downloaded.'});
document.querySelector('#print-constitution')?.addEventListener('click',()=>{if(!form.reportValidity())return;render();window.print()});


/* Authenticated Sandy constitution drafts: same D1 record/revision/audit system as committee records.
   Keep the old browser draft and export tools, but require an explicit button for server writes. */
async function constitutionApi(path,method='GET',data){
 const response=await viewFetch(path,{method,credentials:'same-origin',cache:'no-store',
  ...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
 let result={};try{result=await response.json()}catch{}
 if(!response.ok)throw Error(result.error||'Shared club API error ('+response.status+')');
 return result;
}
async function setupSharedConstitution(){
 if(!form)return;
 let session;
 try{session=await constitutionApi('/api/session')}catch{
  // Static GitHub Pages has no session service and retains the original local builder.
  // A failed Worker session must not reveal a previous local draft to a stale view.
  if(location.hostname.endsWith('.github.io')&&!new URLSearchParams(location.search).has('workspace'))enableLocalDraft();
  else status.textContent='Session unavailable. Reload or explicitly exit the view before opening a saved draft.';
  return;
 }
 if(!session?.readOnly)enableLocalDraft();
 if(!session?.authenticated||!['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'].includes(session.identity?.role))return;
 const box=document.createElement('section');
 box.className='club-shared-constitution';
 box.innerHTML='<h3>Shared Sandy constitution draft</h3><p>Your changes remain local until you deliberately save them here. D1 records each edit with your authenticated account and revision number. This does not approve or register a constitution.</p>'+
 '<div class="shared-actions"><button type="button" data-shared-constitution="save">Save to shared club records</button>'+
 '<button type="button" data-shared-constitution="load">Load latest shared draft</button></div>'+
 '<p data-shared-constitution-state role="status">Checking the shared constitution register…</p>';
 form.insertAdjacentElement('afterend',box);
 if(session.readOnly){box.querySelector('p').textContent='Synthetic view only. Load the example draft without accessing or changing local or live drafts.';protectView('#constitution-form input,#constitution-form select,#constitution-form textarea,[data-shared-constitution="save"]');}
 const notice=box.querySelector('[data-shared-constitution-state]');
 let saved=null;
 async function refresh(){
  const data=await constitutionApi('/api/records?kind=governance');
  const rows=(data.records||[]).filter(row=>row.body?.source==='sandy-constitution-builder');
  saved=rows[0]||null;
  notice.textContent=saved?'Shared draft: revision '+saved.version+', edited '+new Date(saved.updatedAt).toLocaleString('en-AU')+
   '. Loading it is optional and replaces the current form contents.':'No shared constitution draft exists yet. The current browser draft is untouched.';
 }
 try{await refresh();if(session.readOnly&&saved){form.reset();for(const [name,value] of Object.entries(saved.body?.fields||{})){const input=form.elements.namedItem(name);if(input&&typeof value==='string')input.value=value}render();notice.textContent='Loaded fictional draft revision '+saved.version+'. No browser or live record was changed.'}}catch(e){notice.textContent='Could not check shared draft: '+e.message}
 box.addEventListener('click',async ev=>{
  const button=ev.target.closest('button[data-shared-constitution]');
  if(!button)return;
  const operation=button.dataset.sharedConstitution;
  button.disabled=true;
  try{
   if(operation==='load'){
    await refresh();
    if(!saved){notice.textContent='There is no shared constitution draft to load.';return}
    if(!session.readOnly&&!window.confirm('Load the latest shared constitution draft? This will replace the fields currently on screen.'))return;
    const latest=(await constitutionApi('/api/records/'+saved.id)).record;
    const fields=latest.body?.fields||{};
    form.reset();
    for(const [name,value] of Object.entries(fields)){
     const input=form.elements.namedItem(name);
     if(input&&typeof value==='string')input.value=value;
    }
    saved=latest;
    if(!session.readOnly)localStorage.setItem('sandy-constitution-draft',JSON.stringify(fields));
    render();
    notice.textContent='Loaded shared revision '+latest.version+' into the editor. No new server revision was saved.';
   }else if(operation==='save'){
    if(session.readOnly||!form.reportValidity())return;
    render();
    const fields=Object.fromEntries(new FormData(form));
    const body={source:'sandy-constitution-builder',fields,markdown:output.textContent};
    const request={kind:'governance',title:(val('name')+' constitution working draft').slice(0,180),
     status:'draft',eventDate:null,body};
    let result;
    if(saved){
     result=await constitutionApi('/api/records/'+saved.id,'PATCH',{...request,version:saved.version});
    }else{
     result=await constitutionApi('/api/records','POST',request);
    }
    const fresh=(await constitutionApi('/api/records/'+result.id)).record;
    saved=fresh;
    notice.textContent='Saved to Sandy D1 as working constitution revision '+fresh.version+
     '. The server recorded your account and update time. No adoption or publication occurred.';
    status.textContent='Shared constitution working draft saved. Revision '+fresh.version+'.';
   }
  }catch(e){notice.textContent='Shared '+operation+' failed without changing the saved draft: '+e.message}
  finally{button.disabled=false}
 });
}
void setupSharedConstitution();
