import {recipeBody,readRecipe,recipeExample} from './newsletter-recipe.mjs';

const officePath='/api/committee/news', memberPath='/api/member/news';
const zone='Australia/Brisbane';
const dayFormat=new Intl.DateTimeFormat('en-AU',{timeZone:zone,day:'numeric',month:'short',year:'numeric'});
const fullDayFormat=new Intl.DateTimeFormat('en-AU',{timeZone:zone,day:'numeric',month:'long',year:'numeric'});
const monthFormat=new Intl.DateTimeFormat('en-AU',{timeZone:zone,month:'long',year:'numeric'});
const monthFields=new Intl.DateTimeFormat('en-AU',{timeZone:zone,month:'2-digit',year:'numeric'});
const templates=[
  ['Club story','Tell a short story from a club activity or community event.'],
  ['Sports tip','Share one practical tip for training, play or supporting a team.'],
  ['Member highlight','With their permission, share a member achievement and what made it memorable.'],
  ['Upcoming competitions','Give the next competition or event date, meeting place and how to join.'],
  ['Volunteer shout-out','With their permission, thank someone and say what they did.'],
  ['Call for volunteers','Say what help is needed, where, how long it takes and who to contact.'],
  ['Sponsor thanks','Thank an approved club supporter and describe their contribution.'],
  ['Seeking a sponsor','Describe the local activity, what support the club needs and how a business can express interest.'],
  ['Joke of the month','Keep it all ages. Why did the ball bring a suitcase? It was ready for the next round!'],
];
const hintByHeading=new Map(templates);
const statuses={draft:'Draft',review:'In review',approved:'Approved',published:'Published'};
const officeNames={president:'President',vicepresident:'Vice President',secretary:'Secretary',assistantsecretary:'Assistant Secretary',treasurer:'Treasurer'};
const examples={
  president:['Around the club','Thanks to everyone who helped at our recent club activity. Share an update about what happened and what comes next.'],
  vicepresident:['An interclub event','We are planning a friendly event with a neighbouring club. I will share a date when both clubs agree.'],
  secretary:['From the meeting','The latest approved minutes are in the member room. Send me any items you’d like added to the next agenda.'],
  assistantsecretary:['A welcome at the next meet','Could you spare ten minutes to welcome new members at our next club activity? Let the Secretary know if you can join us.'],
  treasurer:['Merchandise stocktake','We’re preparing for our next stocktake. Please pass any outstanding merchandise receipts to the treasurer.'],
};
const contributionStates={draft:'Private draft',submitted:'Sent to newsletter',included:'Selected for the edition'};
const date=(value,format=dayFormat)=>format.format(new Date(value.length===10?value+'T12:00:00+10:00':value));
const monthLabel=month=>monthFormat.format(new Date(month+'-15T12:00:00+10:00'));
const currentMonth=()=>{const d=Object.fromEntries(monthFields.formatToParts(new Date()).map(p=>[p.type,p.value]));return d.year+'-'+d.month;};

function textSections(body){
  // Only recognise original template headings at a paragraph boundary. All other prose stays in its original section.
  const names=templates.map(t=>t[0]).join('|');
  const markers=[...body.matchAll(new RegExp('(?:^|\\n\\n)('+names+')\\n','g'))];
  const sections=markers.map((m,i)=>({heading:m[1],text:body.slice(m.index+m[0].length,markers[i+1]?.index??body.length)}));
  return {intro:body.slice(0,markers[0]?.index??body.length),sections};
}
function draftFor(edition){return {title:edition.title||'',presidentMessage:edition.presidentMessage||'',...textSections(edition.body||'')};}
function draftFields(draft){
  const pieces=draft.sections.filter(s=>s.text.trim()).map(s=>s.heading+'\n'+s.text.trim());
  const body=[draft.intro.trim(),...pieces].filter(Boolean).join('\n\n');
  return {title:draft.title.trim(),presidentMessage:draft.presidentMessage.trim(),body};
}

function recipeCopy(body,esc){
  const recipe=readRecipe(body);
  const list=(text,tag)=>'<'+tag+'>'+text.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>'<li>'+esc(s)+'</li>').join('')+'</'+tag+'>';
  return '<div class="news-recipe-copy">'+(recipe.ingredients?'<h5>Ingredients</h5>'+list(recipe.ingredients,'ul'):'')+
    (recipe.method?'<h5>Method</h5>'+list(recipe.method,'ol'):'')+'</div>';
}

function readingCopy(edition,esc){
  const content=textSections(edition.body||'');
  return '<article class="news-copy"><header><span class="news-club-mark" aria-hidden="true">SSC</span><div><p>Sandy Sports Club · '+esc(monthLabel(edition.month))+'</p><h3>'+esc(edition.title||'Untitled edition')+'</h3></div></header>'+
    (edition.presidentMessage?'<section><h4>President’s message</h4><p>'+esc(edition.presidentMessage)+'</p></section>':'')+
    (content.intro?'<section><p>'+esc(content.intro)+'</p></section>':'')+
    content.sections.map(s=>'<section><h4>'+esc(s.heading)+'</h4><p>'+esc(s.text)+'</p></section>').join('')+
    (edition.contributions||[]).map(c=>'<section><small>'+(c.kind==='recipe'?'Club kitchen · ':'')+esc(officeNames[c.office]||c.office)+'</small><h4>'+esc(c.title)+'</h4>'+
      (c.kind==='recipe'?recipeCopy(c.body,esc):'<p>'+esc(c.body)+'</p>')+'</section>').join('')+'</article>';
}

export function setupClubNews({api,esc}) {
  const office=document.getElementById('committee-news'),members=document.getElementById('member-news');
  if(!office||!members)return;
  let session=null,route=null,owner=null,sequence=0,controller=null,busy=false;
  let chosenMonth=currentMonth(),desk=null,draft=null,dirty=false,memberEditions=[],nextMember=null;
  let contributionDraft=null,contributionDirty=false,recipeDraft=null,recipeDirty=false,recipeOpen=false;

  function currentRoute(){
    if(!session?.authenticated)return null;
    if(location.hash==='#committee/news' && session.role==='committee')return 'office';
    if(location.hash==='#members/news' && ['member','committee'].includes(session.role))return 'members';
    return null;
  }
  function clear(){
    sequence++;controller?.abort();controller=null;
    busy=false;dirty=false;desk=null;draft=null;memberEditions=[];nextMember=null;contributionDraft=null;contributionDirty=false;recipeDraft=null;recipeDirty=false;recipeOpen=false;
    office.replaceChildren();members.replaceChildren();
  }
  function staffNotice(message,alert=false){
    const output=office.querySelector('[data-news-status]');
    if(output){output.setAttribute('role',alert?'alert':'status');output.textContent=message;}
  }
  function contributionNotice(message,kind='article'){
    const output=office.querySelector(kind==='recipe'?'[data-recipe-status]':'[data-contribution-status]');
    if(output)output.textContent=message;else staffNotice(message);
  }
  function personal(kind='article'){
    return desk.contributions?.find(c=>c.office===desk.rights.office && (c.kind||'article')===kind);
  }
  function resetContribution(){
    const c=personal();
    contributionDraft={title:c?.title||'',body:c?.body||''};contributionDirty=false;
  }
  function resetRecipe(){
    const c=personal('recipe');
    recipeDraft={title:c?.title||'',...readRecipe(c?.body)};recipeDirty=false;
  }
  function kitchen(){
    const c=personal('recipe'),editable=desk.edition.status==='draft'&&(!c||c.status==='draft');
    if(!desk.rights.office)return '';
    return '<details class="news-kitchen" data-kitchen '+(recipeOpen?'open':'')+'><summary>Club kitchen · '+(c?'Your recipe':'Send a recipe')+'</summary>'+
      (editable?'<p>Send a favourite dish for this edition. You can also send your regular office update.</p>'+
        '<details class="news-example"><summary>See a recipe example</summary><h4>'+esc(recipeExample.title)+'</h4>'+recipeCopy(recipeBody(recipeExample),esc)+
        '<p>Contains molluscs. <a href="https://www.healthdirect.gov.au/healthy-living/food-and-nutrition/food-safety-infographic">Healthdirect seafood cooking guide</a></p></details>'+
        '<label>Dish name<input name="recipeTitle" maxlength="120" value="'+esc(recipeDraft.title)+'"></label>'+
        '<label>Ingredients <small>One per line, with quantities.</small><textarea rows="4" name="recipeIngredients" maxlength="1200">'+esc(recipeDraft.ingredients)+'</textarea></label>'+
        '<label>Cooking steps <small>One step per line. Include how to tell when it is ready to eat.</small><textarea rows="5" name="recipeMethod" maxlength="2300">'+esc(recipeDraft.method)+'</textarea></label>'+
        '<div class="button-row"><button type="button" class="button outline" data-contrib="save-contribution" data-contrib-kind="recipe">Save recipe draft</button>'+
        '<button type="button" class="button" data-contrib="submit-contribution" data-contrib-kind="recipe">Send recipe to newsletter</button></div>':
        c?'<p>'+esc(contributionStates[c.status])+'</p><h4>'+esc(c.title)+'</h4>'+recipeCopy(c.body,esc):'<p>This edition is closed for writing. Select a month in draft to send a recipe.</p>')+
      '<p data-recipe-status role="status"></p></details>';
  }
  function contributionPanel(){
    const own=desk.rights.office;
    if(!Object.hasOwn(officeNames,own))return '';
    const mine=personal(),editable=desk.edition.status==='draft'&&(!mine||mine.status==='draft');
    const history=(desk.contributionHistory||[]).filter(c=>c.office===own);
    const [title,example]=examples[own];
    return '<section class="news-contribution"><h3>Your '+esc(officeNames[own])+' contribution</h3><p>'+esc(monthLabel(desk.edition.month))+
      (mine?' · '+esc(contributionStates[mine.status]||mine.status):'')+'</p>'+
      (editable?'<details><summary>See an example for this office</summary><div class="news-example"><strong>'+esc(title)+'</strong><p>'+esc(example)+'</p><small>This example stays here. Write your contribution below.</small></div></details>'+
      '<label>Your headline<input name="contribTitle" maxlength="120" value="'+esc(contributionDraft.title)+'"></label>'+
      '<label>Your contribution<textarea name="contribBody" maxlength="1800" rows="4">'+esc(contributionDraft.body)+'</textarea></label>'+
      '<div class="button-row"><button type="button" class="button outline" data-contrib="save-contribution">Save my draft</button>'+
      '<button type="button" class="button" data-contrib="submit-contribution">Send to newsletter</button></div>':
      (mine?'<div class="news-submission"><strong>'+esc(mine.title)+'</strong><p class="news-contribution-text">'+esc(mine.body)+'</p></div>':'<p>This edition is past the writing stage. Choose a month in draft to send a contribution.</p>'))+
      '<p data-contribution-status role="status"></p>'+kitchen()+'<details><summary>My contribution history</summary>'+
      (history.length?history.map(c=>'<article class="news-submission"><small>'+esc(monthLabel(c.month))+' · '+esc(c.editionStatus==='published'&&c.status==='included'?'Published in member edition':contributionStates[c.status]||c.status)+'</small>'+
        '<h4>'+(c.kind==='recipe'?'Recipe · ':'')+esc(c.title||'Untitled contribution')+'</h4>'+(c.kind==='recipe'?recipeCopy(c.body,esc):'<p class="news-contribution-text">'+esc(c.body)+'</p>')+'</article>').join(''):'<p>Your saved and sent contributions will appear here.</p>')+'</details></section>';
  }
  function assembly(){
    if(!desk.rights.canEdit)return '';
    const list=(desk.contributions||[]).filter(c=>c.status==='submitted'||c.status==='included');
    if(!list.length)return '<p class="news-channel">Officer contributions will appear here when they arrive.</p>';
    return '<details class="news-submissions" open><summary>Officer contributions ('+list.length+')</summary><p>Choose the items that will appear in the member edition.</p>'+
      list.map(c=>'<article class="news-submission"><small>'+(c.kind==='recipe'?'Recipe · ':'')+esc(officeNames[c.office]||c.office)+' · '+esc(contributionStates[c.status])+'</small><h4>'+esc(c.title)+'</h4>'+
      (c.kind==='recipe'?recipeCopy(c.body,esc):'<p class="news-contribution-text">'+esc(c.body)+'</p>')+
      '<div class="button-row"><button type="button" class="text-link" data-contrib="'+(c.status==='included'?'exclude-contribution':'include-contribution')+'" data-contrib-office="'+esc(c.office)+'" data-contrib-kind="'+esc(c.kind||'article')+'">'+(c.status==='included'?'Remove from edition':'Include in edition')+'</button>'+
      '<button type="button" class="text-link" data-contrib="return-contribution" data-contrib-office="'+esc(c.office)+'" data-contrib-kind="'+esc(c.kind||'article')+'">Return to author for changes</button></div></article>').join('')+'</details>';
  }

  function birthdays(){
    const review=desk.birthdayReview;
    if(!review||!desk.rights.canReviewBirthdays)return '';
    const days=desk.birthdays||[],total=days.reduce((sum,d)=>sum+Number(d.due),0),greeted=days.reduce((sum,d)=>sum+Number(d.greeted),0);
    return '<section class="news-birthdays" aria-label="Monthly birthday review"><h3>Birthdays in '+esc(monthLabel(review.month))+'</h3>'+
      '<p>'+(total?total+(total===1?' birthday':' birthdays')+' among members who opted in. '+greeted+' already greeted this year.':'No opted-in member birthdays this month.')+
      ' Greetings appear privately in each member’s clubhouse on their birthday.</p>'+
      (total?'<details><summary>See dates and counts</summary><ul>'+days.map(d=>'<li>'+esc(date(d.day))+' · '+Number(d.due)+(Number(d.due)===1?' birthday':' birthdays')+'</li>').join('')+'</ul></details>':'')+
      '<p data-birthday-status role="status">'+esc(birthdayStatus(review))+'</p><p>Next monthly check on '+esc(date(desk.monthlyPrompt.nextDueDay,fullDayFormat))+'.</p>'+
      (review.reviewedAt||session?.demo||session?.readOnly?'':'<button type="button" class="button outline small" data-review-birthdays>Mark month reviewed</button>')+'</section>';
  }
  function birthdayStatus(review){
    return review.reviewedAt?'Reviewed by the '+(officeNames[review.reviewedBy]||'Secretary')+' on '+date(review.reviewedAt)+'.':'Either secretary can record the monthly check for both offices.';
  }
  async function reviewBirthdays(button){
    if(session?.demo||session?.readOnly)return;
    const stamp=sequence,month=desk.birthdayReview.month;
    button.disabled=true;
    const output=office.querySelector('[data-birthday-status]');
    try{
      const {birthdayReview}=await api(officePath,{method:'POST',body:JSON.stringify({action:'review-birthdays',month})});
      if(stamp!==sequence)return;
      desk.birthdayReview=birthdayReview;
      const current=office.querySelector('[data-birthday-status]');
      if(current){current.setAttribute('role','status');current.textContent=birthdayStatus(birthdayReview);}
      office.querySelector('[data-review-birthdays]')?.remove();
    }catch(error){
      if(stamp!==sequence)return;
      if(error.status===409){
        try{
          const latest=await api(officePath+'?month='+encodeURIComponent(chosenMonth),{cache:'no-store'});
          if(stamp!==sequence)return;
          desk.birthdays=latest.birthdays;desk.birthdayReview=latest.birthdayReview;desk.monthlyPrompt=latest.monthlyPrompt;
          const card=office.querySelector('.news-birthdays');
          if(card)card.outerHTML=birthdays();
          return;
        }catch{ /* Keep the draft and allow the officer to retry the monthly check. */ }
      }
      if(stamp!==sequence)return;
      if(output){output.setAttribute('role','alert');output.textContent=error.message;}
      button.disabled=false;
    }
  }

  function editor(){
    const current=desk.edition;
    const extras=draft.sections.map((s,index)=>'<fieldset class="news-block" data-section="'+index+'"><legend>'+esc(s.heading)+'</legend>'+
      '<label class="sr-only" for="news-section-'+index+'">'+esc(s.heading)+'</label><textarea id="news-section-'+index+'" rows="3" maxlength="6000" data-section-text placeholder="'+esc(hintByHeading.get(s.heading)||'')+'">'+esc(s.text)+'</textarea>'+
      '<div class="news-section-controls"><button type="button" class="text-link" data-move="-1" aria-label="Move '+esc(s.heading)+' up" '+(index===0?'disabled':'')+'>Move up</button>'+
      '<button type="button" class="text-link" data-move="1" aria-label="Move '+esc(s.heading)+' down" '+(index===draft.sections.length-1?'disabled':'')+'>Move down</button>'+
      '<button type="button" class="text-link" data-remove-section aria-label="Remove '+esc(s.heading)+'">Remove</button></div></fieldset>').join('');
    const available=templates.filter(([name])=>!draft.sections.some(s=>s.heading===name));
    return '<div class="news-editor"><h3>Write the edition</h3><p>Give the edition a title. You can write your own news, choose officer contributions, or use both.</p>'+
      (desk.rights.office?'<button type="button" class="text-link" data-open-recipe>'+ (personal('recipe')?'Open your recipe':'Add a recipe')+'</button>':'')+
      '<label>Edition title<input name="newsTitle" maxlength="120" placeholder="'+esc(monthLabel(current.month))+' club news" value="'+esc(draft.title)+'"></label>'+
      '<label>Opening news (optional)<textarea rows="4" name="newsIntro" maxlength="6000" placeholder="What should members know this month?">'+esc(draft.intro)+'</textarea></label>'+
      extras+(available.length?'<div class="news-add"><label>Optional section<select name="sectionType">'+available.map(([s])=>'<option>'+esc(s)+'</option>').join('')+'</select></label>'+
      '<button class="button outline small" type="button" data-add-section>Add section</button></div>':'')+
      '<details class="news-president" '+(draft.presidentMessage?'open':'')+'><summary>President’s message (optional)</summary><label>Message from the president<textarea name="newsPresident" rows="4" maxlength="1800">'+esc(draft.presidentMessage)+'</textarea></label><p>The president or Webmaster approves an edition that includes this message.</p></details>'+
      '<div class="button-row"><button type="button" class="button outline" data-news-action="save">Save draft</button>'+
      '<button type="button" class="button" data-news-action="submit">Save and review</button></div></div>';
  }

  function review(){
    const e=desk.edition,r=desk.rights;
    const included=(desk.contributions||[]).filter(c=>c.status==='included');
    const presidentContent=Boolean(e.presidentMessage)||included.some(c=>c.office==='president'&&c.kind!=='recipe');
    const canRelease=r.canEdit && (e.status==='approved'||(e.status==='review'&&!presidentContent));
    let action='';
    if(e.status==='draft'&&r.canApprove&&!r.canEdit){
      action='<label>President’s message<textarea name="newsPresident" maxlength="1800" rows="4">'+esc(draft.presidentMessage)+'</textarea></label>'+
        '<button type="button" class="button" data-news-action="message">Save president’s message</button>';
    }
    if(e.status==='review'||e.status==='approved'){
      if(e.status==='review'&&presidentContent)action+='<p>The president or Webmaster needs to approve this edition before it goes to members.</p>';
      if(canRelease)action+='<p>Publishing puts this edition in the member archive and adds a notice to the inbox of members who opted in.</p>';
      action+='<div class="button-row">'+
        (e.status==='review'&&r.canApprove&&presidentContent?'<button type="button" class="button" data-news-action="approve">Approve edition</button>':'')+
        (canRelease?'<button type="button" class="button" data-news-action="publish">Publish to members</button>':'')+
        (r.canEdit||r.canApprove?'<button type="button" class="button outline" data-news-action="return">Return to draft</button>':'')+'</div>';
    }
    if(e.status==='published')action='<a class="text-link" href="#members/news">Open member newsletters</a>';
    return '<div class="news-review"><h3>'+(e.status==='published'?'Published edition':'Read the edition')+'</h3>'+readingCopy({...e,contributions:included},esc)+action+'</div>';
  }

  function drawOffice(){
    const e=desk.edition,p=desk.monthlyPrompt,due=p.status==='published'?'This month’s edition is published.':'Prepare the '+monthLabel(p.month)+' edition.';
    const earlier=desk.editions?.filter(x=>x.month!==e.month)||[];
    office.innerHTML='<h1 class="page-title">Newsletter desk</h1>'+(session?.demo||session?.readOnly?'<p>Preview only. Drafts, approvals and publication are unavailable in this view.</p>':'')+'<div class="news-reminders"><section class="panel news-next"><h3>Monthly newsletter reminder</h3><p>'+esc(due)+'</p>'+
      '<small>Next monthly reminder · '+esc(date(p.nextDueDay))+'</small></section>'+birthdays()+'</div>'+
      '<section class="panel news-issue"><div class="news-select"><label>Edition month<input name="issueMonth" type="month" value="'+esc(e.month)+'" required></label>'+
      '<button type="button" class="button outline small" data-open-edition>Open edition</button></div>'+
      '<div class="news-issue-heading"><h3>'+esc(monthLabel(e.month))+' newsletter</h3><span class="pill">'+esc(statuses[e.status]||e.status)+'</span></div>'+
      contributionPanel()+(e.status==='draft'?assembly():'')+
      '<div data-edition-content>'+(e.status==='draft'&&desk.rights.canEdit?editor():review())+'</div>'+
      '<p role="status" data-news-status></p><p class="news-channel">Members read published editions in the clubhouse. Automatic email delivery needs a club email service.</p></section>'+
      (earlier.length||desk.nextBefore?'<details class="news-archive"><summary>Other editions</summary><ul>'+earlier.map(x=>'<li><button type="button" class="text-link" data-open-month="'+esc(x.month)+'">'+esc(monthLabel(x.month))+' · '+esc(x.title||'Untitled edition')+'</button> · '+esc(statuses[x.status]||x.status)+'</li>').join('')+'</ul>'+
        (desk.nextBefore?'<button type="button" class="text-link" data-old-staff>Show earlier editions</button>':'')+'</details>':'');
  }

  function drawMembers(){
    const [latest,...older]=memberEditions;
    const entry=(e,open=false)=>'<details class="panel news-member-edition" '+(open?'open':'')+'><summary>'+esc(monthLabel(e.month))+' · '+esc(e.title)+'</summary>'+readingCopy(e,esc)+'</details>';
    members.innerHTML='<h2 class="page-title">Club newsletters</h2><p>All paid members can read the club archive, including editions from before they joined. Your newsletter preference controls inbox notices.</p>'+
      '<h2>Latest newsletter</h2>'+(latest?entry(latest,true):'<p>The first club edition will appear here as soon as the secretary publishes it.</p>')+
      '<h2>Past editions</h2>'+(older.length?older.map(e=>entry(e)).join(''):'<p>Earlier editions will be kept here as the club publishes more news.</p>')+
      (nextMember?'<button type="button" class="text-link" data-old-member>Show earlier editions</button>':'')+
      '<p data-member-news-status role="status"></p><a href="#members/membership" class="text-link">My membership &amp; benefits</a>';
  }

  async function load(page,older=false){
    const current=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal;
    const mount=page==='members'?members:office;
    if(!older)mount.innerHTML='<p role="status">Opening '+(page==='members'?'member newsletters':'the secretary’s desk')+'…</p>';
    busy=true;
    try{
      if(page==='members'){
        const data=await api(memberPath+(older?'?before='+encodeURIComponent(nextMember):''),{cache:'no-store',signal});
        if(current!==sequence)return;
        memberEditions=older?memberEditions.concat(data.editions):data.editions;nextMember=data.nextBefore;drawMembers();
      }else{
        const params=new URLSearchParams({month:chosenMonth});
        if(older)params.set('before',desk.nextBefore);
        const data=await api(officePath+'?'+params,{cache:'no-store',signal});
        if(current!==sequence)return;
        if(older){
          desk.editions=desk.editions.concat(data.editions);desk.nextBefore=data.nextBefore;
        }else{
          desk=data;
          if(session?.demo||session?.readOnly)desk.rights={...desk.rights,office:'',canEdit:false,canApprove:false};
          draft=draftFor(desk.edition);dirty=false;recipeOpen=false;resetContribution();resetRecipe();
        }
        drawOffice();if(older)office.querySelector('.news-archive').open=true;
      }
    }catch(error){
      if(current!==sequence)return;
      if(older){const node=mount.querySelector('[data-news-status],[data-member-news-status]');if(node)node.textContent=error.message;}
      else mount.innerHTML='<p role="alert">'+esc(error.message)+'</p><button type="button" class="button outline" data-news-retry>Try again</button>';
    }finally{if(current===sequence)busy=false;}
  }

  function navigate(force=false){
    const nextRoute=currentRoute(),nextOwner=session?.identity?.id??null;
    if(nextRoute===route&&nextOwner===owner&&!force)return;
    clear();route=nextRoute;owner=nextOwner;
    if(route){chosenMonth=currentMonth();load(route);}
  }
  function switchEdition(month){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){staffNotice('Choose a month first.',true);return;}
    if((dirty||contributionDirty||recipeDirty)&&!window.confirm('Leave these unsaved changes and open another edition?'))return;
    chosenMonth=month;load('office');
  }
  async function action(name){
    if(session?.demo||session?.readOnly)return;
    if(busy||!desk)return;
    const e=desk.edition, model=draftFields(draft),checking=name==='submit';
    if((contributionDirty||recipeDirty)&&name!=='save'&&name!=='message'){staffNotice('Save or send your contribution and recipe drafts first. Your newsletter edits are still here.',true);return;}
    if((name==='save'||checking)&&model.body.length>6000){staffNotice('Shorten the newsletter to 6,000 characters, including section headings.',true);return;}
    const includesArticle=desk.contributions.some(c=>c.status==='included');
    if(checking&&(!model.title||!(model.body||model.presidentMessage||includesArticle))){staffNotice('Add a title and at least one story, officer contribution or president’s message.',true);return;}
    const stamp=sequence;
    function post(actionName,version,content={}){
      return api(officePath,{method:'POST',body:JSON.stringify({month:e.month,version,action:actionName,...content})});
    }
    busy=true;
    const inputs=office.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)');
    inputs.forEach(x=>x.disabled=true);
    staffNotice(name==='publish'?'Publishing the edition…':'Saving the edition…');
    try{
      let version=e.version;
      if(checking&&(dirty||!e.version)){
        const saved=await post('save',version,model);
        if(stamp!==sequence)return;
        version=saved.edition.version;desk.edition=saved.edition;dirty=false;
      }
      const extra=name==='save'?model:name==='message'?{presidentMessage:draft.presidentMessage.trim()}:{};
      const data=await post(name,version,extra);
      if(stamp!==sequence)return;
      desk.edition=data.edition;draft=draftFor(data.edition);dirty=false;
      if(data.edition.status==='published'&&data.edition.month===desk.monthlyPrompt.month)desk.monthlyPrompt.status='published';
      drawOffice();
      const messages={save:'Draft saved. Both secretaries can pick up here.',message:'President’s message saved.',submit:'Draft saved for review.',approve:'Edition approved.',return:'The edition is back in draft.',publish:'Published. The edition is in the member archive.'};
      staffNotice(messages[name]);
      if(name==='publish')window.dispatchEvent(new Event('plfc:newsletter-published'));
    }catch(error){
      if(stamp!==sequence)return;
      staffNotice(error.message,true);
      if(error.status===409)office.querySelector('[data-news-status]').insertAdjacentHTML('beforeend',' <button type="button" class="text-link" data-reload-edition>Load latest edition</button>');
    }finally{if(stamp===sequence){busy=false;inputs.forEach(x=>x.disabled=false);}}
  }

  async function actOnContribution(button){
    if(busy||!desk)return;
    const actionName=button.dataset.contrib,seat=button.dataset.contribOffice||desk.rights.office;
    const kind=button.dataset.contribKind||'article';
    const row=desk.contributions.find(c=>c.office===seat&&(c.kind||'article')===kind);
    const mine=actionName==='save-contribution'||actionName==='submit-contribution';
    const base=desk.edition;
    const fields={action:actionName,month:desk.edition.month,kind,version:row?.version||0};
    if(mine){
      fields.title=(kind==='recipe'?recipeDraft.title:contributionDraft.title).trim();
      fields.body=kind==='recipe'?recipeBody(recipeDraft):contributionDraft.body.trim();
      if(kind==='recipe'&&actionName==='submit-contribution'&&(!fields.title||!recipeDraft.ingredients.trim()||!recipeDraft.method.trim())){
        contributionNotice('Add the dish name, ingredients and cooking steps before sending.','recipe');return;
      }
      if(actionName==='submit-contribution'&&(!fields.title||!fields.body)){contributionNotice('Add your headline and contribution before sending.',kind);return;}
    }else fields.office=seat;
    const stamp=sequence;
    const inputs=office.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)');
    inputs.forEach(x=>x.disabled=true);busy=true;
    try{
      await api(officePath,{method:'POST',body:JSON.stringify(fields)});
      if(stamp!==sequence)return;
      const data=await api(officePath+'?month='+encodeURIComponent(chosenMonth),{cache:'no-store'});
      if(stamp!==sequence)return;
      // A selection advances the edition version. Keep the secretary's unsaved wording.
      // If another editor also changed the copy, retain the original version for the conflict check on save.
      const concurrentCopy=dirty&&['title','body','presidentMessage','status'].some(key=>base[key]!==data.edition[key]);
      desk=data;
      if(concurrentCopy)desk.edition=base;
      if(!dirty)draft=draftFor(desk.edition);
      if((mine&&kind==='article')||!contributionDirty)resetContribution();
      if((mine&&kind==='recipe')||!recipeDirty)resetRecipe();
      drawOffice();
      const messages={'save-contribution':'Your private draft is saved.','submit-contribution':'Sent to the secretaries for this edition.','include-contribution':'Contribution included in the edition.','exclude-contribution':'Contribution taken out of this edition.','return-contribution':'Returned to the author’s private drafts for changes.'};
      if(mine)contributionNotice(messages[actionName],kind);else staffNotice(messages[actionName]);
      if(concurrentCopy){
        staffNotice('Another officer changed this edition while you were writing. Copy the wording you want to keep, then open the latest edition.',true);
        office.querySelector('[data-news-status]').insertAdjacentHTML('beforeend',' <button type="button" class="text-link" data-reload-edition>Load latest edition</button>');
      }
    }catch(error){
      if(stamp!==sequence)return;
      if(mine)contributionNotice(error.message,kind);else staffNotice(error.message,true);
      if(error.status===409)(office.querySelector(mine?(kind==='recipe'?'[data-recipe-status]':'[data-contribution-status]'):'[data-news-status]')).insertAdjacentHTML('beforeend',' <button type="button" class="text-link" data-reload-edition>Load latest edition</button>');
    }finally{
      if(stamp===sequence){busy=false;inputs.forEach(x=>x.disabled=false);}
    }
  }

  office.addEventListener('input',e=>{
    if(!draft||busy)return;
    const el=e.target;
    if(el.name==='newsTitle')draft.title=el.value;
    else if(el.name==='newsIntro')draft.intro=el.value;
    else if(el.name==='newsPresident')draft.presidentMessage=el.value;
    else if(el.name==='contribTitle'||el.name==='contribBody'){
      contributionDraft[el.name==='contribTitle'?'title':'body']=el.value;contributionDirty=true;contributionNotice('Your contribution has unsaved changes.');return;
    }
    else if(['recipeTitle','recipeIngredients','recipeMethod'].includes(el.name)){
      const key={recipeTitle:'title',recipeIngredients:'ingredients',recipeMethod:'method'}[el.name];
      recipeDraft[key]=el.value;recipeDirty=true;contributionNotice('Your recipe has unsaved changes.','recipe');return;
    }
    else if(el.hasAttribute('data-section-text'))draft.sections[Number(el.closest('[data-section]').dataset.section)].text=el.value;
    else return;
    dirty=true;staffNotice('Draft has unsaved changes.');
  });

  office.addEventListener('toggle',e=>{if(e.target.matches('[data-kitchen]'))recipeOpen=e.target.open;},true);
  office.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b||busy)return;
    if(b.hasAttribute('data-review-birthdays')){reviewBirthdays(b);return;}
    if(b.hasAttribute('data-news-retry')){load('office');return;}
    if(b.hasAttribute('data-open-edition')){switchEdition(office.querySelector('[name=issueMonth]').value);return;}
    if(b.dataset.openMonth){switchEdition(b.dataset.openMonth);return;}
    if(b.hasAttribute('data-reload-edition')){switchEdition(chosenMonth);return;}
    if(b.hasAttribute('data-old-staff')){load('office',true);return;}
    if(b.hasAttribute('data-open-recipe')){
      const box=office.querySelector('[data-kitchen]');box.open=true;recipeOpen=true;
      (box.querySelector('[name=recipeTitle]')||box.querySelector('summary')).focus();return;
    }
    if(b.dataset.contrib){actOnContribution(b);return;}
    if(b.dataset.newsAction){action(b.dataset.newsAction);return;}
    const index=Number(b.closest('[data-section]')?.dataset.section);
    let focus;
    if(b.hasAttribute('data-add-section')){
      const heading=office.querySelector('[name=sectionType]').value;
      draft.sections.push({heading,text:''});focus=draft.sections.length-1;
    }else if(b.hasAttribute('data-remove-section')){
      if(draft.sections[index].text.trim()&&!window.confirm('Remove this section from the draft?'))return;
      draft.sections.splice(index,1);focus=Math.min(index,draft.sections.length-1);
    }else if(b.hasAttribute('data-move')){
      focus=index+Number(b.dataset.move);
      if(focus<0||focus>=draft.sections.length)return;
      const moved=draft.sections.splice(index,1)[0];draft.sections.splice(focus,0,moved);
    }else return;
    dirty=true;office.querySelector('[data-edition-content]').innerHTML=editor();
    (office.querySelector('#news-section-'+focus)||office.querySelector('[data-add-section]'))?.focus();
  });
  members.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(b?.hasAttribute('data-news-retry'))load('members');
    if(b?.hasAttribute('data-old-member')&&!busy&&nextMember)load('members',true);
  });
  window.addEventListener('plfc:navigated',()=>navigate());
  window.addEventListener('plfc:session-changed',e=>{session=e.detail;navigate();});
  window.addEventListener('pagehide',()=>{clear();route=null;});
  window.addEventListener('pageshow',()=>navigate());
}

