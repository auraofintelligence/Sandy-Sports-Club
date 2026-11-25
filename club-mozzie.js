// Mozzie's guided, page-aware clubhouse tour.
(()=>{
 const panel=document.getElementById('guide-panel'),button=document.getElementById('guide-button');
 if(!panel||!button)return;
 const page=(location.pathname.split('/').pop()||'index').replace(/\.html$/,'');
 const topics=[
  {key:'home',title:'Your Clubhouse',href:'/club-admin.html#overview',
   steps:[
    ['Find your working home','The yellow My Clubhouse button at the top opens your private workplace. Club proposal is a different public page.'],
    ['Choose one section','Open the Clubhouse menu and select Overview, Committee room, People, Social Media Hub, Constitution or Office holders.'],
    ['Keep proposals separate','Sandy is still a proposed club. Its draft records do not create legal approvals or memberships.'],
    ['Check what changed','The Audit history section records server-stamped changes by signed-in accounts.']
   ]},
  {key:'committee',title:'Committee room',href:'/club-admin.html#committee/notices',
   steps:[
    ['Open the committee room','Choose Committee room from the Clubhouse menu to find the spaces for your shared responsibilities.'],
    ['Pick one desk','Find Committee notices, To-do lists, Newsletters, Meetings, Grants, Assets, AGM jobs and more, grouped by activity.'],
    ['Save your real working record','Open a desk and use its tools to create a notice, allocate a job, plan a meeting or save your other committee work.'],
    ['Find edits and owners','Open an existing record, choose Edit or History. You can inspect the real officer office and revision timestamps.'],
    ['Know what is not live','Formal club approvals, payments and external publishing need separate authorisation.']
   ]},
  {key:'social',title:'Social Media Hub',href:'/club-admin.html#social',
   steps:[
    ['Open Social Media Hub','In My Clubhouse choose Social Media Hub, not the old public concept gallery.'],
    ['Choose your time scale','Review Day, Week or Month, then open a specific date to plan posts and activities.'],
    ['Adjust pattern controls','Use the topic icons, video share, min/max posting patterns and event/holiday signals.'],
    ['Prepare for review','Save a shared draft or prepare a production handoff. Automatic posting and advertising spend remain off.']
   ]},
  {key:'constitution',title:'Constitution builder',href:'/club-admin.html#constitution',
   steps:[
    ['Open Constitution builder','It is a working area inside My Clubhouse.'],
    ['Review Queensland requirements','Use the current Queensland rules guide as you consider the proposed club rules.'],
    ['Shape the rules','Set objects, membership classes, committee, finances, film and safeguards for Sandy.'],
    ['Save the working draft','Choose Save to shared club records for an attributed revision, or export the Markdown draft. This is not adoption.']
   ]},
  {key:'accounts',title:'Officer invitations',href:'/club-admin.html#accounts',
   steps:[
    ['Open Office holders & invitations','Only the real Webmaster can reserve prospective officer accounts.'],
    ['Reserve a username','Choose President, Vice President, Secretary, Assistant Secretary, Treasurer or Committee. No invite is sent yet.'],
    ['Prepare an invitation','Select Prepare invite for a reserved officer. One private link is shown and expires in 48 hours.'],
    ['Send privately','Choose Copy link or Prepare email. Your officer chooses their own password; nothing is sent automatically.']
   ]},
  {key:'projects',title:'Connected island projects',href:'/club-admin.html#overview',
   steps:[
    ['Find the project icons','Below the Clubhouse menu are Ready SET Co-op, Straddie Noticeboards, Minjerribah Media Network and Strange But True.'],
    ['Open the related site','Choose its icon and name. You will open the correct live project in a separate tab.'],
    ['Keep boundaries clear','Links are not integrations or permissions to post on behalf of other organisations.']
   ]}
 ];
 const heading=panel.querySelector('h2'),intro=panel.querySelector('p');
 if(heading)heading.textContent='Mozzie, your clubhouse mate';
 if(intro)intro.textContent='G’day! I can walk you through the real Sandy tools, one small step at a time.';
 panel.querySelectorAll('a').forEach(link=>link.remove());
 const section=document.createElement('section');section.className='mozzie-club-guide';section.setAttribute('aria-label','Guided clubhouse help');
 section.innerHTML='<label class="mozzie-topic-label" for="mozzie-topic">Show me</label>'+
  '<select id="mozzie-topic" aria-label="Choose a clubhouse tour"></select>'+
  '<div class="mozzie-tour-card"><p id="mozzie-progress" class="mozzie-progress"></p>'+
  '<h3 id="mozzie-step-title"></h3><p id="mozzie-step-text"></p>'+
  '<div class="mozzie-tour-actions"><button type="button" id="mozzie-step-back">Previous</button>'+
  '<button type="button" id="mozzie-step-next">Next step</button></div>'+
  '<a id="mozzie-open-area" href="/club-admin.html">Open this working area</a></div>'+
  '<p class="mozzie-guide-footnote">Step-by-step site guide; no live AI conversation or unapproved publishing.</p>';
 panel.append(section);
 const selector=section.querySelector('#mozzie-topic'),
 progress=section.querySelector('#mozzie-progress'),title=section.querySelector('#mozzie-step-title'),
 copy=section.querySelector('#mozzie-step-text'),back=section.querySelector('#mozzie-step-back'),
 next=section.querySelector('#mozzie-step-next'),go=section.querySelector('#mozzie-open-area');
 for(const topic of topics){const opt=document.createElement('option');opt.value=topic.key;opt.textContent=topic.title;selector.append(opt)}
 let active=topics[0],step=0;
 function draw(){
  progress.textContent='Step '+(step+1)+' of '+active.steps.length;
  title.textContent=active.steps[step][0];copy.textContent=active.steps[step][1];
  back.disabled=step===0;next.disabled=step===active.steps.length-1;
  next.textContent=step===active.steps.length-1?'Tour complete':'Next step';
  go.href=active.href;go.textContent='Open '+active.title;
 }
 function choose(key){
  active=topics.find(x=>x.key===key)||topics[0];selector.value=active.key;step=0;draw();
 }
 selector.addEventListener('change',()=>choose(selector.value));
 back.addEventListener('click',()=>{if(step>0){step--;draw()}});
 next.addEventListener('click',()=>{if(step<active.steps.length-1){step++;draw()}});
 button.setAttribute('aria-label','Ask Mozzie for a guided tour of the Sandy Clubhouse');
 if(page==='social-studio')choose('social');
 else if(page==='constitution')choose('constitution');
 else if(page==='club-login')choose('accounts');
 else choose(location.hash.startsWith('#committee/')?'committee':location.hash==='#social'?'social':location.hash==='#constitution'?'constitution':location.hash==='#accounts'?'accounts':'home');
 window.addEventListener('sandy:clubhouse-section-change',e=>{
  const route=e.detail?.tab;
  if(route==='committee')choose('committee');
  else if(['social','constitution','accounts'].includes(route))choose(route);
 });
})();
