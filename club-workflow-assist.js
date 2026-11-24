// Practical PLFC-derived outputs adapted for Sandy Sports.
// This assistant reads unsaved form values only when a user asks. Nothing is transmitted or published.
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const text=x=>String(x??'').trim();
const lines=x=>text(x).split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
function save(name,content,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([content],{type}));
 const a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function formatMeeting(f,title){
 const type=f.meetingType||'Committee planning', date=f.date||'To be set',at=f.startTime||'Time not set';
 return ['# '+title,'','Sandy Sports Club proposal','Meeting type: '+type,'Date: '+date+' · Brisbane time: '+at,
 'Place: '+(f.location||'To be confirmed'),'Chair: '+(f.chair||'Not assigned'),
 'Minute taker: '+(f.minuteTaker||'Not assigned'),'','## Attendance and apologies',
 f.attendees||'To be recorded','Quorum note: '+(f.quorum||'To be checked'),'','## Agenda',
 ...(lines(f.agenda).map((v,i)=>(i+1)+'. '+v)),'','## Meeting notes to verify',
 f.transcript||'No meeting notes supplied.','',
 '## Proposed decisions, subject to review',...(lines(f.decisions).map(v=>'- '+v)),'',
 '## Follow-up actions',...(lines(f.followUps).map(v=>'- '+v)),'',
 'Record status: working draft, not approved minutes. Verify details with those present.'].join('\n')+'\n';
}
function newsletterMarkup(f,title){
 const articleList=lines(f.articles).map(v=>'<li>'+safe(v)+'</li>').join('')||'<li>Articles to be prepared</li>';
 return '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>'+safe(title)+'</title>'+
 '<style>body{font:16px/1.6 Arial,sans-serif;max-width:800px;margin:auto;padding:3rem;color:#173d42}header{border-bottom:5px solid #008c98;padding-bottom:1rem}h1{line-height:1.2}section{margin-top:2rem}footer{margin-top:3rem;padding:1rem 0;border-top:1px solid #ddd;font-size:.85rem}@media print{body{padding:1rem}}</style></head><body>'+
 '<header><p>SANDY SPORTS · NEWSLETTER DRAFT · '+safe(f.editionMonth||'Unscheduled')+'</p><h1>'+safe(f.headline||title)+'</h1><p>For editorial review only</p></header>'+
 '<section><h2>Welcome</h2><p>'+safe(f.lead||'Opening editorial to prepare').replace(/\n/g,'<br>')+'</p></section>'+
 '<section><h2>Stories and sections</h2><ul>'+articleList+'</ul></section>'+
 '<section><h2>Sport and community round-up</h2><p>'+safe(f.eventRoundup||'To be prepared').replace(/\n/g,'<br>')+'</p></section>'+
 '<section><h2>Thanks and acknowledgements</h2><p>'+safe(f.acknowledgements||'To be agreed').replace(/\n/g,'<br>')+'</p></section>'+
 '<footer>Unapproved Sandy Sports proposal. Verify people’s consent, licences and event details. No recipient messaging is attached to this file.</footer></body></html>';
}
function listChecklist(f,title){
 const name=title||'Checklist';
 const pairs=Object.entries(f).filter(([,v])=>v!==null&&v!==''&&v!==false);
 return '# '+name+'\n\n'+pairs.map(([key,value])=>'**'+key+'**\n'+(value===true?'Yes':String(value))+'\n').join('\n')+
  '\nWorking notes only. No official approval, invoice or external notification is implied.\n';
}
const special={
 meetings:{heading:'Agenda, minutes and meeting follow-up',description:'Use the actual agenda, notes and decisions to prepare a reviewable minutes draft. Never assume a recorded vote or quorum.',
  buttons:[['minutes','Prepare draft minutes'],['agenda','Download agenda'],['print','Print meeting summary']]},
 news:{heading:'Newsletter issue production',description:'Preview an A4 newsletter from your own editorial notes. Download HTML for committee review. No mailing list or delivery service is connected.',
  buttons:[['newsletter','Preview newsletter'],['newsletter-export','Download newsletter HTML']]},
 equipment:{heading:'Equipment loan and condition sheet',description:'Produce a printable equipment checkout/return checklist, including holder, expected return date and condition.',
  buttons:[['equipment','Download equipment record']]},
 stock:{heading:'Stock and price reconciliation',description:'Check quantities, physical stocktake and a proposed margin before saving. This records no money or sales.',
  buttons:[['stock','Calculate stock available'],['stock-export','Export stocktake sheet']]},
 grants:{heading:'Grant application preparation',description:'Check the original funding URL, closing date, eligibility and missing documents before preparing a submission.',
  buttons:[['grant','Prepare grant checklist']]},
 events:{heading:'Event safety and debrief checklist',description:'Prepare a practical Tick, Flick & Debrief sheet for a sand sport, film or community activation.',
  buttons:[['event','Download event run sheet']]},
 'member-packs':{heading:'Member onboarding pack',description:'Build a welcome pack without creating, charging or approving an actual membership.',
  buttons:[['memberpack','Download member pack']]},
 'member-types':{heading:'Constitution and fee review',description:'Review proposed classes and rights. These are not live fee settings.',
  buttons:[['checklist','Export class proposal']]},
 'email-queue':{heading:'Message dispatch review',description:'Prepare a handoff sheet for the authorised human sender. Nothing is emailed automatically.',
  buttons:[['checklist','Download review sheet']]},
 'member-notice':{heading:'Member notice proof',description:'Export a proof of the draft notice. It is not delivered or published.',
  buttons:[['checklist','Download notice proof']]},
 sponsors:{heading:'Supporter offer review',description:'Print the scope of a proposed contribution, contact consent, promises and follow-up responsibilities.',
  buttons:[['checklist','Download offer sheet']]},
 handover:{heading:'Officer handover checklist',description:'Export tasks, sources, custodians and date for the incoming officer to acknowledge.',
  buttons:[['checklist','Download handover sheet']]},
 agm:{heading:'AGM task pack',description:'Export the required notices, agenda, nomination and report preparations as a human-review draft.',
  buttons:[['checklist','Download AGM preparation']]},
 safety:{heading:'Safeguarding procedure review',description:'Export process-level requirements only. Do not place a minor’s private identity or health records here.',
  buttons:[['checklist','Download safeguards checklist']]},
 film:{heading:'Film screening and production run sheet',description:'Prepare crew, screen equipment, copyright and cultural-permission requirements.',
  buttons:[['checklist','Download production sheet']]},
 venues:{heading:'Venue and site readiness',description:'Prepare a proposed facility use sheet. This does not reserve a real venue.',
  buttons:[['checklist','Download venue plan']]},
 'ready-setco':{heading:'Potential partner handover',description:'Prepare scope and conditions for a separate written agreement; no data-sharing or service request is sent.',
  buttons:[['checklist','Download draft handover']]},
 'connections':{heading:'Technology and service connections',description:'Review permissions, data minimisation and human authority before any connection is activated.',
  buttons:[['checklist','Download connection proposal']]}
};
export function setupWorkflowAssist({root,getDesk,getValues,getTitle}){
 const panel=document.createElement('section');panel.id='suite-special';panel.className='suite-special';
 const forms=root.querySelector('#suite-form');
 const actions=root.querySelector('.suite-actions');
 forms.insertBefore(panel,actions);
 const notify=msg=>{const node=panel.querySelector('[data-special-status]');if(node)node.textContent=msg};
 function render(){
  const d=getDesk(),entry=special[d?.key];
  panel.hidden=!entry;if(!entry){panel.replaceChildren();return}
  panel.innerHTML='<header><h4>'+safe(entry.heading)+'</h4><p>'+safe(entry.description)+'</p></header>'+
   '<div class="suite-special-actions">'+entry.buttons.map(([act,label])=>
    '<button type="button" data-special="'+act+'">'+safe(label)+'</button>').join('')+'</div>'+
   '<div id="suite-special-preview" hidden></div><p data-special-status role="status"></p>';
 }
 panel.addEventListener('click',event=>{
  const b=event.target.closest('button[data-special]');if(!b)return;
  const action=b.dataset.special,d=getDesk(),f=getValues(),title=getTitle()||d.title;
  const slug=String(d.key||'working-record').replace(/[^a-z0-9-]/g,'-');
  try{
   if(action==='minutes'){
    const minutes=formatMeeting(f,title);
    const field=forms.elements.namedItem('draftMinutes');
    if(!field)throw Error('Minutes field is missing.');
    if(field.value.trim()&&!confirm('Replace the current minutes draft with the new preview? Unsaved text will be replaced.'))return;
    field.value=minutes;
    const stage=d.steps.indexOf('Review');
    const button=root.querySelector('[data-suite-step="'+stage+'"]');if(button)button.click();
    notify('Draft minutes prepared in the review stage. Check accuracy and save the record deliberately.');
   }else if(action==='agenda'){
    save('sandy-meeting-agenda.md',formatMeeting({...f,transcript:'',decisions:'',followUps:''},title),'text/markdown;charset=utf-8');
    notify('Proposed agenda downloaded.');
   }else if(action==='print'){
    save('sandy-meeting-working-minutes.md',f.draftMinutes||formatMeeting(f,title),'text/markdown;charset=utf-8');
    notify('Working minutes saved for review and printing.');
   }else if(action==='newsletter'||action==='newsletter-export'){
    const html=newsletterMarkup(f,title);
    if(action==='newsletter-export'){save('sandy-newsletter-working-draft.html',html,'text/html;charset=utf-8');notify('Newsletter HTML downloaded for editorial review.')}
    else{const p=panel.querySelector('#suite-special-preview');p.hidden=false;p.innerHTML='<iframe title="Newsletter preview, not distributed" sandbox="" srcdoc="'+safe(html)+'"></iframe>';notify('Preview generated from the unsaved working fields.')}
   }else if(action==='stock'){
    const open=Number(f.opening||0),added=Number(f.inward||0),issued=Number(f.outward||0),available=open+added-issued;
    const p=panel.querySelector('#suite-special-preview');p.hidden=false;
    p.textContent='Opening '+open+' + received '+added+' − issued '+issued+' = '+available+' units. '+
     (available<0?'WARNING: issued quantity exceeds available stock. Correct before saving.':'Reconcile this with the physical stock count.');
    notify('Stock calculation made from your current form values.');
   }else if(action==='stock-export'){
    const onHand=Number(f.opening||0)+Number(f.inward||0)-Number(f.outward||0);
    save('sandy-stocktake-working-sheet.md',listChecklist({...f,calculatedOnHand:onHand},title),'text/markdown;charset=utf-8');
    notify('Working stocktake sheet downloaded.');
   }else{
    save('sandy-'+slug+'-working-pack.md',listChecklist(f,title),'text/markdown;charset=utf-8');
    notify('Working checklist downloaded. It is not an approval or distribution.');
   }
  }catch(error){notify(error.message)}
 });
 return {render};
}
