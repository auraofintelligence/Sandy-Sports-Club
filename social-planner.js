(function(){
"use strict";
const $=id=>document.getElementById(id), list=s=>s.split("|").map(x=>x.trim()).filter(Boolean);
const categories=[
{id:"volleyball",name:"Beach volleyball",n:38,emoji:"🏐",url:"/sport-mixed-beach-volleyball.html",cta:"Which volleyball format would you enjoy?",topics:list("Why mixed beach volleyball leads Sandy Sports|Serving for absolute beginners|How a beach volleyball rally works|Mixed doubles and communication|The difference between beach and indoor volleyball|A beginner-friendly passing drill|Beach volleyball footwork on sand|Setting the ball in windy conditions|Court dimensions and boundaries|Doubles versus four-a-side social play|A fun cooperative rally challenge|Volleyball warm-ups and gradual progression|How teams rotate and score|What would a friendly mixed league look like?|Choosing a volleyball for outdoor play|Net height and age-appropriate formats|Beach volleyball as an Olympic sport|Why courts need safe run-off space|How to welcome first-time players|Local versus visiting team possibilities|What coaches and officials contribute|What equipment could be shared across towns|A visitor-friendly volleyball introduction|Imagining an island-wide volleyball festival")},
{id:"other",name:"Other sand sports",n:62,emoji:"🏉",url:"/sports.html",cta:"Which sport should Sandy Sports explore next?",topics:list("Flag football in 30 seconds|What makes flag football non-contact?|Learning to throw a spiral pass|Five-on-five flag football basics|Flag pulling without contact|Why LA 2028 matters to flag football|An island flag-football introduction concept|Beach cricket with a small group|Beach cricket batting basics|A beach cricket catching challenge|Safe boundaries for beach cricket|A family-friendly beach cricket variation|Beach football and ball control|Beach football dribbling challenge|Small-sided beach soccer concepts|Footwork differences between grass and sand|Beach rugby league skills without full contact|How a rugby club could use a sand session|A beach rugby league skills relay|Beach 5s explained|Adapting rugby formats to different ages|AirBadminton explained|Outdoor shuttle skills in a breeze|Would you try AirBadminton?|Beach tennis rally challenge|Other portable net games for a shared space|Ultimate frisbee in a nutshell|A flying-disc passing challenge|Ultimate and spirit of the game|Beach handball quick introduction|A beach handball passing challenge|Netball crossover footwork|A modified netball skills relay|AFL marking practice on soft surfaces|AFL handpassing challenge|Sand-based fitness with qualified supervision|Movement games for different ability levels|Roundnet as an island-made possibility|Design your own island sport|Which sport needs the biggest field?|How equipment can switch from one sport to another|What could a three-town sport sampler include?|How junior sport can share facilities|Why rules vary between beach and field formats|Two-person versus team-based sports|A beginner's guide to modified games|Planning a sports try-out without promising an event")},
{id:"vision",name:"Why establish the club?",n:30,emoji:"💡",url:"/index.html",cta:"What would make a new club worthwhile to you?",topics:list("One island three towns many arenas|Why a new club could complement existing clubs|A proposal rather than an operating club|What should happen before a founding meeting?|Why start with shared spaces and equipment?|How could sport and culture support each other?|What is the case for island-wide coordination?|From an idea to a community decision|Why flexibility matters on an island|Should a club be local first and welcoming to visitors?|What is a sporting legacy beyond a big event?|What would success look like after one year?|Could shared sport facilities reduce duplication?|What would make Sandy Sports different?|A proposed pathway from interest to participation|How can a new club respect existing organisations?|What might the club need before its first programme?|What needs local agreement rather than assumptions?")},
{id:"voice",name:"Community voice and polls",n:28,emoji:"🗳️",url:"/join.html",cta:"Share your preference through the proposal site.",topics:list("Vote for your first sport to try|Which town needs more recreation opportunities?|What is missing from local sport?|Choose a family-friendly activity|What time of day suits community sport?|Would you join a beginner skills session?|What should come first: shade courts or changing rooms?|Choose a new island-made game idea|Would you volunteer one day a month?|Which facilities should be movable?|What should a family weekend include?|What should future participation leaderboards reward?|Would a film night complement sports?|What matters most to inclusive facilities?|What makes an event worth attending?|Tell us your top three priorities|Suggest a practical way to help build a club")},
{id:"visitors",name:"Holidaymakers and visitors",n:25,emoji:"🧳",url:"/join.html",cta:"Visiting Straddie? Tell us what you would love to play.",topics:list("A 20-second introduction to Sandy Sports|Beach games for a family holiday|What sport would you try on holiday?|A visiting team's dream island itinerary concept|The value of QR expressions of interest|How to stay involved after your holiday|A simple movement game with no equipment|Weekend sports inspiration for visitors|Visitors versus locals friendly challenge idea|Would a sports and cinema day appeal?|What makes a memorable island holiday?|A beginner-friendly sand game to share|A packing checklist for outdoor recreation|Camping and holiday planning: verify official bookings and local rules|What could holiday sports look like across three towns?|Share your favourite sport memory|School-holiday countdown: choose an activity|What to do when it is too windy for a beach game|A summer visitor survey|An island sports sampler concept|Why visiting families' ideas matter")},
{id:"places",name:"Three towns and site options",n:22,emoji:"🏝️",url:"/places.html",cta:"Which location or feature should be studied?",topics:list("Why a three-town network?|Goompi and its potential sport spaces|Pulan and neighbourhood recreation|Mulumba and visitor-facing sport|The 10-12 Ballow Road site concept|Why Ballow Road's slope matters|Cunningham Street as a separate flat option|How existing users shape a site decision|Why land approval cannot be assumed|Linking venues across towns|Would portable courts be more resilient?|Transport considerations for a future club|Safe access and accessible pathways|How site choices affect outdoor cinema|Shade wind and water at proposed sites|What should a future site assessment include")},
{id:"facilities",name:"Facilities and equipment",n:18,emoji:"🏗️",url:"/facilities.html",cta:"Which facility should be researched first?",topics:list("What goes into a safe sand court?|Shade and seating for spectators|Net posts and portable boundaries|Why different sports need different footprints|A modular clubhouse concept|Inclusive toilets showers and changing rooms|Storage and equipment custody|Lighting and neighbour considerations|Water stations and hydration|Drainage and sand maintenance|How a portable court could be packed|A shared field conversion kit|Keeping assets working across three towns|An accessible path through a sports precinct|What belongs on the equipment wish list")},
{id:"film",name:"Film, screens and media",n:18,emoji:"🎬",url:"/film-club.html",cta:"What would you like an island film club to create?",topics:list("A film club inside a sports club?|What could an outdoor screen show?|Filming a short sport technique lesson|How to caption videos for everyone|Who owns the rights to community footage?|Why consent matters for filming children|Mobile versus permanent LED screens|How one screen might serve several venues|Could a short-film showcase support local talent?|Beginner camera and editing skills|Behind the scenes of a 30-second sports video|A proposed local interview series|A sound and microphone basics tip|A film crew volunteer opportunity|Why screen hire needs a real operating plan")},
{id:"events",name:"Events and cultural programmes",n:18,emoji:"🎪",url:"/programme.html",cta:"Which event concept would you want explored?",topics:list("What makes a good community sports day?|A proposed cross-sport festival|Outdoor movie night concept|A sports market and makers day concept|Sport and cultural exchange possibilities|How to plan for weather cancellations|The value of clear event run sheets|What must be approved before a public event?|Designing accessible family events|A short-game tournament format|Could local clubs share a demonstration day?|A sports plus film afternoon idea|What should an island visitor programme feature?|An event countdown only after approval|Keeping events enjoyable for volunteers")},
{id:"skills",name:"Skills, youth and inclusion",n:16,emoji:"🏅",url:"/member-training.html",cta:"What could you teach or learn through the proposed club?",topics:list("Coaching basics and qualified supervision|How to welcome shy beginners|Inclusive team selection ideas|Junior sport and family participation|Learning to referee a game|A camera skills pathway for young people|Volunteering as practical learning|Intergenerational sports formats|What accessible coaching can look like|Peer-to-peer skills sharing|Helping someone try a new sport|How to make rules easy to understand|Sports leadership without exclusion|A beginners-first activity proposal")},
{id:"funding",name:"Funding and partnerships",n:15,emoji:"🤝",url:"/grants.html",cta:"Can you suggest a partner, asset or practical contribution?",topics:list("What should a grant application prove?|The equipment wish list explained|Could a business sponsor a court concept?|In-kind support versus a cash contribution|What does an auspice arrangement mean?|A funding idea is not an awarded grant|How quotes and approvals protect supporters|Could a portable screen help fund shared equipment?|A proposed raffles policy needs legal checks|Why a capital asset needs maintenance funding|Potential partner clubs without claimed agreements|Transparent fundraising before asking for money|Why local business interests matter|A volunteer's skills as practical support")},
{id:"safety",name:"Weather, safety and environment",n:17,emoji:"🛟",url:"/facilities.html",cta:"Check official conditions and plan safely.",topics:list("Forecast slot: verify weekend weather before publishing|Forecast slot: Thursday weekend outlook|Forecast slot: Friday activity conditions|Forecast slot: Saturday conditions update|UV protection for outdoor sport|Shade breaks and hydration|Warm-up ideas for movement on sand|Recognising changing wind conditions|Thunderstorms and the need to stop play|First-aid planning for recreation|Respecting dunes and wildlife|Keeping pathways accessible and safe|What to include in a venue risk review|Why emergency information must come from authorities|Planning a wet-weather alternative")},
{id:"volunteers",name:"Volunteers and governance",n:12,emoji:"🙌",url:"/committee.html",cta:"Would you consider helping develop the proposal?",topics:list("What might a founding volunteer do?|A proposed women-led committee option|Why governance starts before membership opens|What a secretary actually helps organise|What a treasurer needs to protect|Proposed sport and film leadership roles|Writing a constitution for community review|Making decisions transparently|Volunteer workloads and realistic expectations|Why officer appointments cannot be assumed|A proposed founding meeting checklist|How a webmaster can support safe publishing")},
{id:"news",name:"Newsletters and progress",n:9,emoji:"✉️",url:"/clubhouse.html",cta:"What progress or decision would you like an update on?",topics:list("Monthly proposal roundup: verify actual progress|Three questions we're exploring next|How to report consultation feedback accurately|What's new on the Sandy Sports website?|Newsletter signup and permission choices|A seasonal ideas digest|The latest questions from potential supporters|A proposed next-steps update|What should the first real newsletter cover?")},
{id:"health",name:"Health and wellbeing",n:37,emoji:"❤️",url:"/sports.html",cta:"How could inclusive sport support wellbeing on Straddie?",topics:list("Enjoyable movement as part of a healthy week|Social sport and a sense of belonging|Outdoor recreation and stress management|Movement and mood: what evidence suggests|Beach volleyball and coordination|Agility and gradual fitness progression|Healthy ageing through adaptable activity|Balance practice with appropriate supervision|Friendships formed around shared interests|How team sport can help social connection|Welcoming people who have never joined a club|Family play and intergenerational connection|Movement games for children|Confidence through learning a new skill|Beginner-friendly exercise and realistic goals|Why recovery days matter|Rest and hydration for outdoor athletes|Sun safety while staying active|How to avoid overstating health benefits|Supporting inclusion for different abilities|Social connection for people new to the island|Low-pressure activities for casual participants|Teamwork and positive communication|Fun and play as legitimate outcomes|Choosing the right level of challenge|Modified sport and accessibility|Coordination as a learnable skill|Movement breaks during holidays|How outdoor environments can support enjoyment|When to seek individual medical advice|Why sports safety matters as much as fitness|Could a weekly activity help community connection?|What does a welcoming recreation space feel like?|Why the club should celebrate participation too")}
];
const holidayRanges=[
["QLD","2026-12-12","2027-01-26"],["QLD","2027-03-26","2027-04-11"],["QLD","2027-06-26","2027-07-11"],["QLD","2027-09-18","2027-10-04"],["QLD","2027-12-11","2028-01-23"],
["NSW","2026-12-18","2027-01-27"],["NSW-W","2027-01-28","2027-02-03"],["NSW","2027-04-12","2027-04-23"],["NSW","2027-07-05","2027-07-16"],["NSW","2027-09-27","2027-10-08"],["NSW","2027-12-21","2028-01-28"],["NSW-W","2028-01-29","2028-02-04"]
];
const $esc=s=>String(s==null?"":s).replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const pad=n=>String(n).padStart(2,"0"), add=(s,n)=>new Date(Date.parse(s+"T00:00:00Z")+86400000*n).toISOString().slice(0,10);
const weekday=s=>(new Date(s+"T00:00:00Z").getUTCDay()+6)%7;
const rand=(seed)=>{let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}};
const shuffle=(a,r)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function holidays(date){const active=holidayRanges.filter(h=>h[1]<=date&&h[2]>=date).map(h=>h[0]);return {q:active.includes("QLD"),n:active.includes("NSW")||active.includes("NSW-W"),w:active.includes("NSW-W"),both:active.includes("QLD")&&active.some(x=>x.startsWith("NSW"))}};
function toBrisbaneToday(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Australia/Brisbane",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const f=k=>p.find(x=>x.type===k).value;return f("year")+"-"+f("month")+"-"+f("day")}
const startInput=$("sp-start");if(!startInput)return;
const platformIds=["youtube","facebook","instagram","tiktok","noticeboard"],defaultSettings=()=>({start:toBrisbaneToday(),volume:"empty",audience:"all",video:67,qld:"off",nsw:"off",ads:false,channels:platformIds.slice(),topics:{},mix:0});
function loadSettings(){try{return Object.assign(defaultSettings(),JSON.parse(localStorage.getItem("sandy-planner-settings-v3"))||{})}catch{return defaultSettings()}}
function saveSettings(cfg){try{localStorage.setItem("sandy-planner-settings-v3",JSON.stringify(cfg))}catch{}}
let strategy=loadSettings(),start=strategy.start,plan=[],days=new Map(),selected="",viewMonth="",edits={},generated=false;
let monthSettings={},undoStack=[],selectedIds=new Set(),monthPreview=null,liveLayerVisibility={};
const storageKey=()=>["sandy-blank-planner-v3",start].join("-");
function getEdits(){try{return JSON.parse(localStorage.getItem(storageKey()))||{}}catch{return{}}}
function saveEdits(){try{localStorage.setItem(storageKey(),JSON.stringify(edits));return true}catch{return false}}
const monthStoreKey=()=>"sandy-pattern-schedule-v3-"+storageKey();
function loadMonthData(){try{const value=JSON.parse(localStorage.getItem(monthStoreKey())||"null");return value&&Array.isArray(value.plan)?value:null}catch{return null}}
function saveMonthData(){
 const data={plan,monthSettings,undoStack:undoStack.slice(-3)};
 try{localStorage.setItem(monthStoreKey(),JSON.stringify(data));saveEdits();return true}catch{return false}
}
function snapshot(){return {plan:JSON.parse(JSON.stringify(plan)),edits:JSON.parse(JSON.stringify(edits)),monthSettings:JSON.parse(JSON.stringify(monthSettings))}}
function checkpoint(){undoStack.push(snapshot());if(undoStack.length>3)undoStack.shift()}
function restoreLast(){
 const prev=undoStack.pop();if(!prev)return false;
 plan=prev.plan;edits=prev.edits;monthSettings=prev.monthSettings;saveMonthData();
 monthPreview=null;selectedIds.clear();hydrateMonthControls();render();updateUndoButtons();return true;
}
function updateUndoButtons(){
 for(const id of ["sp-undo","sp-m-undo"]){const element=$(id);if(element)element.disabled=!undoStack.length}
}
function editedOrApproved(post){
 const record=edits[post.id]||{};
 return !!post.manual || !!Object.keys(record).length || ["Approved","Scheduled","Published"].includes(record.status||"");
}
function monthFor(p){return (edits[p.id]?.date||p.date).slice(0,7)}
function stateFor(p){return edits[p.id]?.status||"Idea"}
function monthPosts(month){return plan.filter(p=>monthFor(p)===month)}

const MEDIA_PROFILE_VERSION="2026-11-23 / PLFC-informed Sandy production presets";
const mediaProfiles={
 youtube:{video:"Shorts 1080×1920 (9:16), ~30s; standard video 1920×1080 (16:9), thumbnail 3840×2160",ad:"Video ads 1080×1920 (Shorts) or 1920×1080 (in-stream); placement preview required"},
 facebook:{video:"Organic Reels 1080×1920 (9:16), Feed 1080×1350 (4:5)",image:"Organic Feed 1080×1350 (4:5), carousel 1080×1080 (1:1)",ad:"Feed 1440×1800 (4:5); Reels/Stories premium 1440×2560 (9:16); safe-zone check"},
 instagram:{video:"Organic Reels/Stories 1080×1920 (9:16)",image:"Organic Feed 1080×1440 (3:4) or 1080×1350 (4:5); carousel 1080×1080",ad:"Feed image 1440×1800 (4:5); Reels/Stories premium 1440×2560 (9:16); verify Feed video placement"},
 tiktok:{video:"Vertical 1080×1920 (9:16), 30s combination",image:"Photo post 1080×1920 (9:16)",ad:"In-feed 1080×1920 (9:16); 21–34s typical creative; carousel placement varies"},
 noticeboard:{video:"Proposed static adaptation only: TV 1920×1080, kiosk 1080×1920",image:"Proposed TV 1920×1080 (16:9), kiosk 1080×1920 (9:16), responsive web notice",ad:"Not available: no live noticeboard ad service or expenditure"}
};
function specsForPost(p){
 const fmt=p.format==="video"?"video":"image";
 return "Spec "+MEDIA_PROFILE_VERSION+" · "+p.channels.map(ch=>{
 const name=ch==="youtube-standard"?"YouTube standard":ch[0].toUpperCase()+ch.slice(1),key=ch==="youtube-standard"?"youtube":ch,profile=mediaProfiles[key];
 return name+": "+(profile?.[fmt]||platformText[p.format]||"Preview placement")+(p.paid?"; PAID: "+profile?.ad:"");
 }).join(" | ");
}
const platformText={video:"YouTube Shorts 1080×1920 (9:16); Facebook/Instagram Reels 1080×1920 organic, 1440×2560 premium ad export; TikTok 1080×1920. Add subtitles, safe zones and a 30-second sequence. Standard YouTube variant (when selected): 1920×1080 (16:9), with a 3840×2160 thumbnail. For a longer sequence, overlap the final/first 2 seconds.",image:"Facebook Feed 1080×1350 organic or 1440×1800 paid (4:5); Instagram Feed 1080×1440 (3:4) or 1080×1350 (4:5).",carousel:"Facebook/Instagram carousel 1080×1080 (1:1), or custom 4:5 feed cards when placement allows.",poll:"Facebook poll or Instagram Story poll: 1080×1920 (9:16). An interactive poll needs a native platform action.",link:"Facebook link preview, source thumbnail 1200×630 (1.91:1); adapt a static notice for the planned Noticeboard web channel."};
const channelFormats={video:["youtube","facebook","instagram","tiktok"],image:["facebook","instagram"],carousel:["facebook","instagram"],poll:["facebook","instagram"],link:["facebook","noticeboard"]};
function channelNames(post){let out=post.channels.map(id=>({youtube:"YouTube Shorts","youtube-standard":"YouTube standard (16:9)",facebook:post.format==="video"?"Facebook Reels":"Facebook Feed",instagram:post.format==="video"?"Instagram Reels":"Instagram Feed/Story",tiktok:"TikTok",noticeboard:"Straddie Noticeboard (proposed)"}[id]));return out.join(" · ")}
function brief(post){
 if(!post.topic)return post.format==="video"
  ?"Blank video slot. Choose a subject and make a 30-second brief with a hook, two related ideas and a call to action. Check rights and captions."
  :"Blank content slot. Add your subject, copy, image or link and review notes before publishing.";
 const cat=categories[post.cat],style=post.format;
 const open=["Show the concept, then invite a response.","Begin with a question or demonstration.","Use one clear example before explaining the proposal.","Offer a useful takeaway; do not promise an event."][post.seq%4];
 let action="Ask: "+cat.cta;
 let related=post.relatedTopic||cat.topics[(cat.topics.indexOf(post.topic)+1+cat.topics.length)%cat.topics.length];
 let format=style==="video"?"30-second two-topic sequence: 0–3s hook; 3–14s "+post.topic+"; 14–25s "+related+"; 25–30s CTA. Overlap 2 seconds if extended into adjacent clips.":style==="poll"?"Use one specific answerable question and a small set of choices.":"Use concise text and one clear illustrative visual.";
 let caveat=cat.id==="safety"?" WEATHER/SAFETY HOLD: obtain and date-stamp verified Bureau of Meteorology or official guidance shortly before publication; never invent a future forecast.":cat.id==="events"?" EVENTS HOLD: mention actual dates or countdowns only after the organiser confirms permissions and the event.":cat.id==="funding"?" FUNDRAISING HOLD: no raffle, donation or grant claim without eligible entity, review and approval.":cat.id==="news"?" PROGRESS HOLD: describe only work actually completed.":" Clearly identify Sandy Sports as a proposal, not an operating club.";
 return open+" Creative approach: "+post.angle+". "+format+" "+action+caveat;
}
const monthsList=()=>{const end=add(start,364),out=[];let curr=start.slice(0,7);while(curr<=end.slice(0,7)){out.push(curr);let [y,m]=curr.split("-").map(Number);m++;if(m>12){y++;m=1}curr=y+"-"+pad(m)}return out};
const labelDate=s=>new Date(s+"T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long",year:"numeric"});
function regenerate(){
 const saved=loadMonthData();
 plan=saved?.plan||[];
 days=new Map(Array.from({length:365},(_,i)=>{const date=add(start,i);return [date,{date,posts:[],holiday:holidays(date)}]}));
 edits=getEdits();monthSettings=saved?.monthSettings||{};undoStack=saved?.undoStack||[];
 selectedIds.clear();monthPreview=null;
 const months=monthsList();$("sp-month").innerHTML=months.map(x=>'<option value="'+x+'">'+new Date(x+"-01T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",month:"long",year:"numeric"})+'</option>').join("");
 if(!months.includes(viewMonth))viewMonth=months[0];$("sp-month").value=viewMonth;
 if(!days.has(selected))selected=start;
 refreshStats();render();updateUndoButtons();
}
function refreshStats(){
 const video=plan.filter(p=>effectivePost(p).format==="video").length;
 const total=plan.length,daysUsed=new Set(plan.map(p=>(edits[p.id]?.date||p.date))).size;
 $("sp-results").hidden=false;
 $("sp-stats").innerHTML='<div class="sp-stat"><strong>365</strong><small>Dates available</small></div><div class="sp-stat"><strong>'+total+'</strong><small>Draft slots you selected</small></div><div class="sp-stat"><strong>'+daysUsed+'</strong><small>Dates with planned slots</small></div><div class="sp-stat"><strong>'+(total?Math.round(video*100/total)+"%":"—")+'</strong><small>Video share of scheduled slots</small></div>';
}
const matches=p=>{
 const category=$("sp-cat").value,channel=$("sp-channel").value,paid=$("sp-paid").value;
 const vis=liveLayerVisibility[viewMonth]||monthSettings[viewMonth]?.layers||{};
 const visible=(vis[categories[p.cat].id]?.visible!==false);
 return visible&&(category==="all"||categories[p.cat].id===category)&&(channel==="all"||p.channels.includes(channel))&&(paid==="all"||(paid==="paid"?p.paid:!p.paid));
};
function postsOn(date){return plan.filter(p=>(edits[p.id]?.date||p.date)===date)}
function effectivePost(p){
 const ov=edits[p.id]||{},fmt=ov.format||p.format;
 const channels=Array.isArray(ov.channels)?ov.channels.slice():Array.isArray(p.channels)?p.channels.slice():channelFormats[fmt].filter(ch=>strategy.channels.includes(ch));
 return {...p,format:fmt,channels,title:ov.title||p.title,date:ov.date||p.date,time:ov.time||p.time,audienceRegion:ov.audienceRegion??p.audienceRegion??"all",audienceMember:ov.audienceMember??p.audienceMember??"all",audienceGender:ov.audienceGender??p.audienceGender??"all"};
}
function suggestedCaption(p){if(!p.topic)return "";const cat=categories[p.cat];return "Could Sandy Sports explore "+p.topic.charAt(0).toLowerCase()+p.topic.slice(1)+"? Sandy Sports is still a community proposal. Your ideas can help shape what comes next. "+cat.cta}
function render(){
 const m=viewMonth,[y,mm]=m.split("-").map(Number),nd=new Date(Date.UTC(y,mm,0)).getUTCDate(),offset=weekday(m+"-01");
 $("sp-month-label").textContent=new Date(m+"-01T00:00:00Z").toLocaleDateString("en-AU",{month:"long",year:"numeric",timeZone:"UTC"});
 const showingPreview=!!monthPreview&&monthPreview.month===m&&JSON.stringify(monthPreview.cfg)===JSON.stringify(readMonthControls());
 const previewPosts=showingPreview?monthPreview.keep.concat(monthPreview.newPosts).map(effectivePost):[];
 let out="";for(let k=0;k<offset;k++)out+='<div aria-hidden="true"></div>';
 let monthItems=0;
 for(let d=1;d<=nd;d++){
  const date=m+"-"+pad(d),row=days.get(date);
  if(!row){out+='<div class="sp-day outside" aria-label="'+date+' outside selected 365-day range"><span class="date">'+d+"</span></div>";continue}
  const shown=(showingPreview?previewPosts.filter(p=>p.date===date):postsOn(date).map(effectivePost)).filter(matches);
  monthItems+=shown.length;
  const flags=row.holiday;
  out+='<button type="button" class="sp-day'+(shown.length?"":" empty")+(showingPreview?" preview":"")+(date===selected?" selected":"")+'" data-date="'+date+'" aria-label="'+labelDate(date)+", "+shown.length+(showingPreview?' proposed blank slots':' planned posts')+'" aria-pressed="'+(date===selected?"true":"false")+'"><span class="date">'+d+'</span><span class="count">'+(shown.length?shown.length+(showingPreview?" preview":shown.length===1?" post":" posts"):"")+'</span><span class="markers">'+(flags.q?'<span class="q"></span>':'')+(flags.n?'<span class="n"></span>':'')+(weekday(date)>=4?'<span class="w"></span>':'')+"</span></button>";
 }
 $("sp-grid").innerHTML=out;$("sp-month-count").textContent=monthItems+(showingPreview?" preview slots (not applied)":" planned slots");
 renderDetail();renderMonthRoster();
}
function renderDetail(){
 const row=days.get(selected),host=$("sp-detail");if(!row){host.innerHTML="<h3>Choose a date</h3>";return}
 const match=postsOn(selected).map(effectivePost).filter(matches),h=row.holiday,labels=[];
 if(h.q)labels.push("QLD holidays");if(h.n)labels.push(h.w?"NSW Western Division":"NSW holidays");if(weekday(selected)>=4)labels.push("Weekend lead-in / peak");
 let html='<h3>'+labelDate(selected)+'</h3><p class="sp-hint">'+$esc(labels.join(" · ")||"Normal seven-day schedule")+'</p><p class="sp-hint">'+match.length+" planned post slot(s). No publishing or spending is connected.</p>";
 if(!match.length)html+='<p>This date is empty. Turn on a repeating pattern or add a blank post below.</p>';
 if(monthPreview?.month===viewMonth){
  const pending=monthPreview.newPosts.filter(p=>p.date===selected).length;
  if(pending)html+='<p class="sp-hint"><strong>'+pending+' blank slots previewed for this date.</strong> Press Apply to keep them.</p>';
 }
 html+='<div class="sp-add-slot"><label>New blank post<select id="sp-new-category">'+categories.map(c=>'<option value="'+c.id+'">'+$esc(c.emoji+" "+c.name)+'</option>').join("")+'</select></label><button type="button" data-add-post>+ Add blank post</button></div>';
 for(const p of match){
  const cat=categories[p.cat],override=edits[p.id]||{},status=override.status||"Idea",note=override.note||"",caption=override.caption||suggestedCaption(p),spec=specsForPost(p);
  const special=p.sourceHold?'<span class="sp-tag warn">Verify before publishing</span>':'';
  html+='<article class="sp-item" data-item="'+$esc(p.id)+'"><div class="sp-meta">'+$esc(override.time||p.time)+' AEST · '+$esc(p.dayExtra)+' · '+$esc(cat.name)+'</div><h4>'+$esc(override.title||p.title)+'</h4><span class="sp-tag">'+$esc(p.format.toUpperCase())+'</span>'+special+(p.paid?'<span class="sp-tag ad">Paid ad idea (not authorised)</span>':"")+
   '<p><strong>Channels:</strong> '+$esc(channelNames(p))+'</p><p><strong>Asset specs:</strong> '+$esc(spec)+'</p><p><strong>Production brief:</strong> '+$esc(brief(p))+'</p><p><strong>Audience:</strong> '+$esc(p.group)+(p.paid?"; <strong>ad spend:</strong> not set":"")+'</p><p><strong>Source:</strong> <a href="'+p.page+'">'+$esc(cat.name)+" page</a></p>"+
   '<label>Title <input class="sp-edit-title" type="text" maxlength="220" value="'+$esc(override.title||p.title)+'"></label>'+
   '<label>Caption <textarea class="sp-edit-caption" rows="4" maxlength="1800">'+$esc(caption)+'</textarea></label>'+
   '<label>Format <select class="sp-edit-format">'+["video","image","carousel","poll","link"].map(x=>'<option value="'+x+'"'+(x===p.format?' selected':'')+'>'+x+'</option>').join("")+'</select></label>'+
   '<div class="sp-edit-timing"><label>Date <input type="date" class="sp-edit-date" min="'+start+'" max="'+add(start,364)+'" value="'+$esc(override.date||p.date)+'"></label><label>Time (Brisbane) <input type="time" class="sp-edit-time" value="'+$esc(override.time||p.time)+'"></label></div>'+
   '<label>Audience area <select class="sp-edit-audience">'+Object.entries(areaLabels).map(([key,name])=>'<option value="'+key+'"'+(key===p.audienceRegion?" selected":"")+'>'+$esc(name)+'</option>').join("")+'</select></label>'+ 
   '<label>Membership audience <select class="sp-edit-member">'+Object.entries(classLabels).map(([key,name])=>'<option value="'+key+'"'+(key===p.audienceMember?" selected":"")+'>'+$esc(name)+'</option>').join("")+'</select></label>'+
   '<label>Gender (voluntary, no inference) <select class="sp-edit-gender">'+Object.entries(genderLabels).map(([key,name])=>'<option value="'+key+'"'+(key===p.audienceGender?" selected":"")+'>'+$esc(name)+'</option>').join("")+'</select></label>'+
   '<label><input type="checkbox" class="sp-edit-locked" '+(override.locked?'checked':'')+'> Keep this post unchanged during monthly regeneration</label>'+
   '<label>Status <select class="sp-status" data-id="'+$esc(p.id)+'">'+["Idea","Draft","For review","Approved","Scheduled","Published","Rejected"].map(x=>'<option'+(x===status?" selected":"")+">"+x+"</option>").join("")+'</select></label>'+
   '<label>Working notes <textarea class="sp-note" data-id="'+$esc(p.id)+'" placeholder="Source checks, visual assets, review notes...">'+$esc(note)+'</textarea></label>'+
   '<div class="sp-actions"><button type="button" data-save="'+$esc(p.id)+'">Save changes</button><button type="button" class="secondary" data-copy="'+$esc(p.id)+'">Copy brief</button><button type="button" class="secondary" data-remove-post="'+$esc(p.id)+'">Remove slot</button></div></article>';
 }
 host.innerHTML=html;
}
function exportCsv(){
 const header=["date","time_AEST","category","title","format","channels","spec_profile_version","dimensions_and_duration","source_page","audience_area","membership_audience","voluntary_gender_audience","paid_candidate","spend_authorised","status","caption","production_brief","working_notes"];
 const quoted=x=>'"'+String(x==null?"":x).replace(/"/g,'""').replace(/\r?\n/g," ")+'"';
 const arr=[header.join(",")];
 for(const original of plan.slice().sort((a,b)=>monthFor(a).localeCompare(monthFor(b))||(edits[a.id]?.date||a.date).localeCompare(edits[b.id]?.date||b.date)||(edits[a.id]?.time||a.time).localeCompare(edits[b.id]?.time||b.time))){const p=effectivePost(original),ov=edits[p.id]||{};arr.push([ov.date||p.date,ov.time||p.time,categories[p.cat].name,ov.title||p.title,p.format,channelNames(p),MEDIA_PROFILE_VERSION,specsForPost(p),p.page,areaLabels[p.audienceRegion]||p.group,classLabels[p.audienceMember]||"Everyone",genderLabels[p.audienceGender]||"Everyone",p.paid?"Yes":"No","No",ov.status||"Idea",ov.caption||suggestedCaption(p),brief(p),ov.note||""].map(quoted).join(","))}
 const blob=new Blob(["\ufeff"+arr.join("\r\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sandy-sports-social-"+start+"-365-days.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function copyBrief(id){const original=plan.find(x=>x.id===id);if(!original)return;const p=effectivePost(original),ov=edits[id]||{},content=[(ov.date||p.date)+" "+(ov.time||p.time)+" AEST",ov.title||p.title,categories[p.cat].name,p.format,channelNames(p),specsForPost(p),ov.caption||suggestedCaption(p),brief(p),p.page,"Audience: "+(areaLabels[p.audienceRegion]||p.group)+" · "+(classLabels[p.audienceMember]||"Everyone")+" · "+(genderLabels[p.audienceGender]||"Everyone"),p.paid?"Paid candidate: budget not set or approved":"Organic","Status: "+(ov.status||"Idea"),ov.note||""].join("\n\n");if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(content).catch(()=>window.prompt("Copy brief:",content))}else window.prompt("Copy brief:",content)}


$("sp-cat").innerHTML+=categories.map(c=>'<option value="'+c.id+'">'+$esc(c.emoji+" "+c.name)+'</option>').join("");
$("sp-topic-choices").innerHTML=categories.map(c=>'<label><span>'+$esc(c.emoji+" "+c.name)+'</span><select id="sp-weight-'+c.id+'" aria-label="'+$esc(c.name)+' topic priority">'+["off","less","normal","more"].map(x=>'<option value="'+x+'">'+({off:"Off",less:"Less",normal:"Normal",more:"More"}[x])+'</option>').join("")+'</select></label>').join("");
const areaLabels={all:"Local, regional and tourist audiences",local:"Local residents",regional:"Regional visitors",tourist:"Holidaymakers and tourists"};
const classLabels={all:"Everyone",supporters:"Interested supporters",founders:"Potential founding members","future-members":"Prospective members",families:"Families",volunteers:"Prospective volunteers",clubs:"Partner clubs and organisations"};
const genderLabels={all:"Everyone / unspecified",women:"Women (opt-in)",men:"Men (opt-in)","self-described":"Self-described (opt-in)"};
const patternRules=[
 {id:"weekend",name:"Weekend & Friday lead-in",cat:"visitors",defaultRate:2,max:7,unit:"/wk"},
 {id:"qld",name:"QLD school holiday posts",cat:"visitors",defaultRate:3,max:7,unit:"/wk"},
 {id:"nsw",name:"NSW school holiday posts",cat:"visitors",defaultRate:1,max:7,unit:"/wk"},
 {id:"weather",name:"Thu / Fri / Sat weather checks",cat:"safety",defaultRate:3,max:3,unit:"/wk"},
 {id:"newsletter",name:"Monthly newsletter",cat:"news",defaultRate:1,max:2,unit:"/month"},
 {id:"countdown",name:"Day-before holiday reminders",cat:"visitors",defaultRate:1,max:2,unit:"/start"}
];
function defaultMonthSettings(){
 return {limit:5,video:67,audience:"all",member:"all",gender:"all",ads:false,platforms:platformIds.slice(),
 layers:Object.fromEntries(categories.map(c=>[c.id,{enabled:false,rate:2,visible:true}])),
 rules:Object.fromEntries(patternRules.map(x=>[x.id,{enabled:false,rate:x.defaultRate}]))};
}
function monthConfig(month){
 const saved=monthSettings[month]||{},def=defaultMonthSettings();
 return {...def,...saved,platforms:saved.platforms?.slice()||def.platforms,
 layers:Object.fromEntries(categories.map(c=>[c.id,{...def.layers[c.id],...(saved.layers?.[c.id]||{})}])),
 rules:Object.fromEntries(patternRules.map(x=>[x.id,{...def.rules[x.id],...(saved.rules?.[x.id]||{})}]))};
}
function layerRow(c){
 return '<div class="sp-pattern-row off" data-category="'+c.id+'"><label><input type="checkbox" id="sp-m-on-'+c.id+'"> '+$esc(c.emoji+" "+c.name)+'</label>'+
 '<div class="sp-frequency"><input type="range" min="1" max="7" step="1" id="sp-m-rate-'+c.id+'" value="2" disabled aria-label="'+$esc(c.name)+' posts per week"><output id="sp-m-rate-out-'+c.id+'">2/wk</output></div>'+
 '<label class="sp-visibility"><input type="checkbox" class="sp-layer-show" id="sp-m-show-'+c.id+'" checked> Show</label></div>';
}
function ruleRow(rule){
 return '<div class="sp-pattern-row off" data-rule="'+rule.id+'"><label><input type="checkbox" id="sp-r-on-'+rule.id+'"> '+$esc(rule.name)+'</label>'+
 '<div class="sp-frequency"><input type="range" min="1" max="'+rule.max+'" step="1" id="sp-r-rate-'+rule.id+'" value="'+rule.defaultRate+'" disabled aria-label="'+$esc(rule.name)+' frequency"><output id="sp-r-rate-out-'+rule.id+'">'+rule.defaultRate+rule.unit+'</output></div><small>Optional</small></div>';
}
function updateSliderLabels(){
 $("sp-m-video-out").textContent=$("sp-m-video").value+"%";
 for(const c of categories){
  const on=$("sp-m-on-"+c.id).checked,range=$("sp-m-rate-"+c.id);
  range.disabled=!on;$("sp-m-rate-out-"+c.id).textContent=on?range.value+"/wk":"off";
  const row=range.closest?.(".sp-pattern-row");if(row)row.classList.toggle("off",!on);
 }
 for(const rule of patternRules){
  const on=$("sp-r-on-"+rule.id).checked,range=$("sp-r-rate-"+rule.id);
  range.disabled=!on;$("sp-r-rate-out-"+rule.id).textContent=on?range.value+rule.unit:"off";
  const row=range.closest?.(".sp-pattern-row");if(row)row.classList.toggle("off",!on);
 }
}
function setupMonthControls(){
 $("sp-layer-choices").innerHTML=categories.map(layerRow).join("");
 $("sp-rule-choices").innerHTML=patternRules.map(ruleRow).join("");
 $("sp-month-form").addEventListener("input",e=>{
  if(e.target.matches?.('input[type="range"]'))updateSliderLabels();
  previewMonth();
 });
 $("sp-month-form").addEventListener("change",e=>{
  updateSliderLabels();
  if(e.target.classList.contains("sp-layer-show")){
   checkpoint();
   const cfg=monthConfig(viewMonth);
   for(const c of categories)cfg.layers[c.id].visible=$("sp-m-show-"+c.id).checked;
   monthSettings[viewMonth]=cfg;saveMonthData();updateUndoButtons();
  }
  previewMonth();
 });
}
function hydrateMonthControls(){
 const cfg=monthConfig(viewMonth),label=new Date(viewMonth+"-01T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",month:"long",year:"numeric"});
 $("sp-config-month-label").textContent=label;
 $("sp-m-limit").value=cfg.limit;$("sp-m-video").value=cfg.video;
 $("sp-m-audience").value=cfg.audience;$("sp-m-member").value=cfg.member;$("sp-m-gender").value=cfg.gender;$("sp-m-ads").checked=cfg.ads;
 for(const p of platformIds)$("sp-m-"+p).checked=cfg.platforms.includes(p);
 for(const c of categories){const lay=cfg.layers[c.id];$("sp-m-on-"+c.id).checked=lay.enabled;$("sp-m-rate-"+c.id).value=lay.rate;$("sp-m-show-"+c.id).checked=lay.visible!==false}
 for(const rule of patternRules){const cfgRule=cfg.rules[rule.id];$("sp-r-on-"+rule.id).checked=cfgRule.enabled;$("sp-r-rate-"+rule.id).value=cfgRule.rate}
 updateSliderLabels();
 monthPreview=null;$("sp-m-apply").disabled=true;$("sp-month-preview").hidden=true;
 liveLayerVisibility[viewMonth]=cfg.layers;
 $("sp-copy-month-choices").innerHTML=monthsList().filter(m=>m!==viewMonth).map(m=>'<label><input type="checkbox" data-copy-month="'+m+'"> '+$esc(new Date(m+"-01T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",month:"short",year:"numeric"}))+'</label>').join("");
 monthMessage("All patterns are off until you turn them on. Edited or approved posts stay protected.");
 updateUndoButtons();
}
function readMonthControls(){
 const cfg={limit:Number($("sp-m-limit").value),video:Number($("sp-m-video").value),audience:$("sp-m-audience").value,member:$("sp-m-member").value,gender:$("sp-m-gender").value,ads:$("sp-m-ads").checked,platforms:platformIds.filter(p=>$("sp-m-"+p).checked),layers:{},rules:{}};
 for(const c of categories)cfg.layers[c.id]={enabled:$("sp-m-on-"+c.id).checked,rate:Number($("sp-m-rate-"+c.id).value),visible:$("sp-m-show-"+c.id).checked};
 for(const rule of patternRules)cfg.rules[rule.id]={enabled:$("sp-r-on-"+rule.id).checked,rate:Number($("sp-r-rate-"+rule.id).value)};
 return cfg;
}
function monthMessage(t){$("sp-month-feedback").textContent=t}
function anyEnabled(cfg){return categories.some(c=>cfg.layers[c.id].enabled)||patternRules.some(x=>cfg.rules[x.id].enabled)}
function validateMonth(cfg){
 if(!cfg.platforms.length&&anyEnabled(cfg))return "Choose at least one publishing platform.";
 if(cfg.video<100&&anyEnabled(cfg)&&!cfg.platforms.some(x=>["facebook","instagram","noticeboard"].includes(x)))return "With only YouTube/TikTok selected, choose 100% video or add an image-friendly channel.";
 if(!Number.isInteger(cfg.limit)||cfg.limit<1||cfg.limit>8)return "Choose a daily limit from 1 to 8.";
 return "";
}
function monthDates(month){return Array.from(days.keys()).filter(date=>date.startsWith(month))}
function emptySlot(date,catIndex,pattern,cfg,seq,id){
 const category=categories[catIndex],h=holidays(date);
 return {id,date,time:["08:30","11:30","14:30","17:30","19:30","20:30","21:30","22:00"][seq%8],cat:catIndex,
 title:pattern==="Category"?category.name+" · blank post":pattern+" · blank post",topic:"",angle:"",relatedTopic:"",pattern,format:"video",
 channels:[],paid:false,group:areaLabels[cfg.audience],page:category.url,dayExtra:"User-selected pattern",
 seq,sourceHold:["safety","funding","events","news"].includes(category.id),
 audienceRegion:cfg.audience,audienceMember:cfg.member,audienceGender:cfg.gender};
}
function proposalForMonth(month,cfg){
 const dates=monthDates(month),old=monthPosts(month),protectedPosts=old.filter(editedOrApproved),replaceable=old.filter(p=>!editedOrApproved(p));
 const countByDate=new Map(dates.map(date=>[date,protectedPosts.filter(p=>(edits[p.id]?.date||p.date)===date).length]));
 const proposed=[], skipped=[],patternCounts=new Map(),nonce=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
 const weekdayOf=weekday;
 const categoryIndex=id=>categories.findIndex(c=>c.id===id);
 const addTo=(date,cat,label)=>{
  if(cat<0||!countByDate.has(date))return false;
  const n=countByDate.get(date);if(n>=cfg.limit){skipped.push(label+" "+date);return false}
  const post=emptySlot(date,cat,label,cfg,n,"slot-"+nonce+"-"+proposed.length);
  proposed.push(post);countByDate.set(date,n+1);patternCounts.set(label,(patternCounts.get(label)||0)+1);return true;
 };
 const evenly=(eligible,n,cat,label)=>{
  if(!eligible.length||!n)return;
  for(let j=0;j<n;j++){
   const preferred=Math.min(eligible.length-1,Math.floor((j+.5)*eligible.length/n));
   let placed=false;
   for(let scan=0;scan<eligible.length;scan++){
    const k=(preferred+scan)%eligible.length;
    if(countByDate.get(eligible[k])<cfg.limit){placed=addTo(eligible[k],cat,label);if(placed)break}
   }
   if(!placed)skipped.push(label+" (daily capacity full)");
  }
 };
 // Explicit date patterns are placed before general categories, so weather and countdowns do not get lost to the daily cap.
 for(const rule of patternRules){
  const config=cfg.rules[rule.id];if(!config.enabled)continue;
  let eligible=dates.filter(d=>{
   const wd=weekdayOf(d),h=holidays(d),next=holidays(add(d,1));
   if(rule.id==="weekend")return wd>=4;
   if(rule.id==="qld")return h.q;
   if(rule.id==="nsw")return h.n;
   if(rule.id==="weather")return wd>=3&&wd<=5;
   if(rule.id==="newsletter")return true;
   return (next.q&&!h.q)||(next.n&&!h.n);
  });
  let count=0;
  if(rule.id==="newsletter")count=Math.min(config.rate,dates.length);
  else if(rule.id==="countdown")count=eligible.length*config.rate;
  else count=Math.round(config.rate*(rule.id==="weather"||rule.id==="weekend"?dates.length:eligible.length)/7);
  if(rule.id==="weather")count=Math.min(count,eligible.length);
  if(!count)continue;
  let label={weekend:"Weekend lead-in",qld:"QLD school holiday",nsw:"NSW school holiday",weather:"Weather check · Thu/Fri/Sat",newsletter:"Monthly newsletter",countdown:"Holiday countdown · day before"}[rule.id];
  if(rule.id==="newsletter"&&eligible.length>1)eligible=count===1?[eligible[0]]:[eligible[0],eligible[Math.floor(eligible.length/2)]];
  evenly(eligible,count,categoryIndex(rule.cat),label);
 }
 // Only the category patterns that the user explicitly switched on produce slots.
 for(const c of categories){
  const layer=cfg.layers[c.id];if(!layer.enabled||layer.rate<1)continue;
  evenly(dates,Math.round(layer.rate*dates.length/7),categoryIndex(c.id),"Category");
 }
 const desired=Math.round((protectedPosts.length+proposed.length)*cfg.video/100);
 const fixedVideo=protectedPosts.filter(p=>effectivePost(p).format==="video").length;
 const needVideo=Math.max(0,Math.min(proposed.length,desired-fixedVideo));
 const formatOptions=["image","carousel","poll","link"];
 const videoSlots=new Set(shuffle(proposed.map((_,i)=>i),rand(Number(month.replace("-",""))+cfg.video*47)).slice(0,needVideo));
 proposed.forEach((p,i)=>{
  p.format=videoSlots.has(i)?"video":formatOptions[i%4];
  p.channels=channelFormats[p.format].filter(x=>cfg.platforms.includes(x));
  if(p.format==="video"&&cfg.platforms.includes("youtube")&&i%12===0)p.channels.push("youtube-standard");
  if(!p.channels.length){
   if(cfg.platforms.some(x=>["youtube","tiktok"].includes(x))){p.format="video";p.channels=channelFormats.video.filter(x=>cfg.platforms.includes(x))}
   else if(cfg.platforms.includes("noticeboard")){p.format="image";p.channels=["noticeboard"]}
  }
  p.paid=!!cfg.ads&&i%9===0&&p.channels.some(x=>["youtube","facebook","instagram","tiktok"].includes(x));
 });
 return {month,cfg,keep:protectedPosts,replaceable,newPosts:proposed,skipped,patternCounts,current:old.length,planned:protectedPosts.length+proposed.length};
}
function previewMonth(){
 const cfg=readMonthControls(),error=validateMonth(cfg);
 if(error){monthMessage(error);return}
 const preview=proposalForMonth(viewMonth,cfg);monthPreview=preview;
 const video=preview.newPosts.filter(p=>p.format==="video").length+preview.keep.filter(p=>effectivePost(p).format==="video").length;
 const breakdown=[...preview.patternCounts.entries()].map(([name,count])=>'<li>'+$esc(name)+": "+count+" blank slots</li>").join("");
 const datesUsed=new Set(preview.keep.map(x=>effectivePost(x).date).concat(preview.newPosts.map(x=>x.date))).size;
 $("sp-month-preview").innerHTML='<strong>Preview · no changes made</strong><p>'+preview.current+' existing slots → '+preview.planned+' planned slots across '+datesUsed+' dates. '+Math.round(video*100/Math.max(1,preview.planned))+'% video; '+preview.keep.length+' protected; '+preview.replaceable.length+' replaceable.</p>'+
 (breakdown?'<ul>'+breakdown+'</ul>':'<p>No patterns enabled: this month will be blank except for any manually edited or approved posts.</p>')+
 (preview.skipped.length?'<p class="sp-hint">'+preview.skipped.length+' slots could not fit within your daily limit.</p>':'')+
 '<p class="sp-hint">These are empty content slots. You decide the titles, ideas and captions.</p>';
 $("sp-month-preview").hidden=false;$("sp-m-apply").disabled=false;
 liveLayerVisibility[viewMonth]=cfg.layers;render();
 monthMessage("This calendar preview reflects your sliders. Press Apply only when you want to keep the blank slots.");
}
function applyMonth(){
 if(!monthPreview||monthPreview.month!==viewMonth||JSON.stringify(monthPreview.cfg)!==JSON.stringify(readMonthControls())){monthMessage("Preview the current settings before applying.");return}
 checkpoint();
 const oldIds=new Set(monthPreview.replaceable.map(p=>p.id));
 plan=plan.filter(p=>!oldIds.has(p.id)).concat(monthPreview.newPosts);
 monthSettings[viewMonth]=monthPreview.cfg;
 liveLayerVisibility[viewMonth]=monthPreview.cfg.layers;
 const retained=monthPreview.keep.length,created=monthPreview.newPosts.length;
 const ok=saveMonthData();
 selectedIds.clear();monthPreview=null;
 $("sp-m-apply").disabled=true;$("sp-month-preview").hidden=true;
 refreshStats();render();updateUndoButtons();
 monthMessage("Month applied: "+created+" blank slots, "+retained+" edited/approved posts preserved. "+(ok?"Saved in this browser.":"Local saving failed: export CSV to preserve this plan."));
}
function applyAllMonths(){
 const cfg=readMonthControls(),error=validateMonth(cfg);
 if(error){monthMessage(error);return}
 if(!window.confirm("Apply these switched-on patterns to all 365 days? Existing edited and approved posts will be kept. This action can be undone."))return;
 checkpoint();
 let created=0,protectedCount=0,skipped=0;
 for(const month of monthsList()){
  const outcome=proposalForMonth(month,cfg);
  const oldIds=new Set(outcome.replaceable.map(x=>x.id));
  plan=plan.filter(p=>!oldIds.has(p.id)).concat(outcome.newPosts);
  monthSettings[month]=JSON.parse(JSON.stringify(cfg));
  created+=outcome.newPosts.length;protectedCount+=outcome.keep.length;skipped+=outcome.skipped.length;
 }
 monthPreview=null;selectedIds.clear();liveLayerVisibility[viewMonth]=cfg.layers;
 const ok=saveMonthData();refreshStats();render();updateUndoButtons();
 $("sp-month-preview").hidden=true;$("sp-m-apply").disabled=true;
 monthMessage("Applied "+created+" blank slots across the 365-day period. "+protectedCount+" edited/approved posts preserved."+(skipped?" "+skipped+" could not fit the daily limits.":"")+(ok?" Saved locally; Undo is available.":" Storage failed; export CSV."));
}
function copyMonthSettings(){
 const targets=[...$("sp-copy-month-choices").querySelectorAll("[data-copy-month]:checked")].map(x=>x.dataset.copyMonth);
 if(!targets.length){monthMessage("Choose one or more months to copy settings to.");return}
 const cfg=readMonthControls(),error=validateMonth(cfg);
 if(error){monthMessage(error);return}
 checkpoint();for(const t of targets)monthSettings[t]=JSON.parse(JSON.stringify(cfg));
 const ok=saveMonthData();updateUndoButtons();
 monthMessage("Settings copied to "+targets.length+" month(s). No posts were changed; preview each target month before applying. "+(ok?"":"Export CSV if storage is full."));
}
function renderMonthRoster(){
 const root=$("sp-month-rows");if(!root)return;
 const items=monthPosts(viewMonth).map(effectivePost).filter(matches).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
 const visibleIds=new Set(items.map(x=>x.id));
 for(const id of [...selectedIds])if(!visibleIds.has(id))selectedIds.delete(id);
 root.innerHTML=items.map(p=>{
  const status=stateFor(p),protect=editedOrApproved(p)?" · kept":"";
  return '<div class="sp-roster-row"><label><input type="checkbox" data-bulk-id="'+$esc(p.id)+'" aria-label="Select '+$esc(p.title)+'" '+(selectedIds.has(p.id)?"checked":"")+'></label><span class="sp-roster-date">'+$esc(p.date.slice(5))+'</span><button type="button" class="sp-roster-name" data-roster-day="'+p.date+'">'+$esc(p.title)+'</button><span class="sp-roster-status">'+$esc(status+protect)+'</span></div>';
 }).join("")||'<p class="sp-hint">No posts match the current month and filters.</p>';
 $("sp-roster-count").textContent=items.length+" shown; "+monthPosts(viewMonth).length+" total";
 $("sp-selected-count").textContent=selectedIds.size+" selected";
}
function applyBulk(){
 const ids=[...selectedIds].filter(id=>plan.some(p=>p.id===id&&monthFor(p)===viewMonth));
 if(!ids.length){$("sp-b-feedback").textContent="Select posts from this month first.";return}
 const format=$("sp-b-format").value,platform=$("sp-b-platform").value,region=$("sp-b-audience").value,member=$("sp-b-member").value,gender=$("sp-b-gender").value,status=$("sp-b-status").value,time=$("sp-b-time").value,daysShift=Number($("sp-b-shift").value||0);
 if(!Number.isInteger(daysShift)||daysShift<-14||daysShift>14){$("sp-b-feedback").textContent="Date shift must be within 14 days.";return}
 if(![format,platform,region,member,gender,status,time].some(Boolean)&&!daysShift){$("sp-b-feedback").textContent="Choose at least one change.";return}
 const actions=[];
 for(const id of ids){
  const p=plan.find(x=>x.id===id),ov=edits[id]||{},patch={};
  if(format)patch.format=format;
  if(platform){
   const fmt=format||ov.format||p.format;
   if(["youtube","tiktok"].includes(platform)&&fmt!=="video")patch.format="video";
   if(platform==="all"){
    const chosen=monthSettings[viewMonth]?.platforms||readMonthControls().platforms;
    const allowed=channelFormats[patch.format||fmt]||[];
    patch.channels=chosen.filter(x=>allowed.includes(x));
    if(!patch.channels.length&&chosen.some(x=>["youtube","tiktok"].includes(x))){
      patch.format="video";
      patch.channels=chosen.filter(x=>channelFormats.video.includes(x));
    }
    if(!patch.channels.length)patch.channels=chosen.filter(x=>x==="noticeboard");
   }else patch.channels=[platform];
  }
  if(region)patch.audienceRegion=region;if(member)patch.audienceMember=member;if(gender)patch.audienceGender=gender;
  if(status)patch.status=status;if(time)patch.time=time;
  if(daysShift){
   const target=add(ov.date||p.date,daysShift);
   if(target<start||target>add(start,364)){$("sp-b-feedback").textContent="A date shift would move a post outside the 365-day plan. No changes applied.";return}
   patch.date=target;
  }
  actions.push([id,patch]);
 }
 checkpoint();for(const [id,patch] of actions)edits[id]={...(edits[id]||{}),...patch};
 const ok=saveMonthData();selectedIds.clear();refreshStats();render();updateUndoButtons();
 $("sp-b-feedback").textContent="Updated "+ids.length+" selected post(s), preserving their other fields. "+(ok?"Saved locally.":"Storage failed; export CSV.");
 monthMessage("Bulk edit applied to "+ids.length+" posts. Undo is available.");
}
setupMonthControls();
startInput.value=start;
startInput.addEventListener("change",()=>{
 const next=startInput.value;if(!next||next===start)return;
 if(plan.length&&!window.confirm("Open a new 365-day period? Your current plan is saved separately in this browser.")){startInput.value=start;return}
 strategy.start=next;saveSettings(strategy);start=next;selected=start;viewMonth=start.slice(0,7);
 regenerate();hydrateMonthControls();monthMessage("This period is ready. Its dates are empty until you turn on patterns.");
});
$("sp-month").addEventListener("change",e=>{viewMonth=e.target.value;selectedIds.clear();const available=Array.from(days.keys()).find(x=>x.slice(0,7)===viewMonth);if(available)selected=available;hydrateMonthControls();render()});
["sp-cat","sp-channel","sp-paid"].forEach(id=>$(id).addEventListener("change",()=>{render()}));
$("sp-grid").addEventListener("click",e=>{const b=e.target.closest("[data-date]");if(b){selected=b.dataset.date;render()}});
$("sp-detail").addEventListener("change",e=>{
 if(e.target.classList.contains("sp-status")){
  const id=e.target.dataset.id;checkpoint();edits[id]=Object.assign({},edits[id]||{},{status:e.target.value});saveMonthData();updateUndoButtons();
 }
});
$("sp-detail").addEventListener("click",e=>{
 const addButton=e.target.closest("[data-add-post]"),removeButton=e.target.closest("[data-remove-post]");
 const saveBtn=e.target.closest("[data-save]"),copyBtn=e.target.closest("[data-copy]");
 if(addButton){
  const catIndex=categories.findIndex(c=>c.id===$("sp-new-category").value);
  if(catIndex<0)return;
  const cfg=monthConfig(selected.slice(0,7)),id="manual-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9);
  const p=emptySlot(selected,catIndex,"Manual",cfg,postsOn(selected).length,id);
  p.title="Untitled post";p.manual=true;p.dayExtra="Added manually";
  p.format=cfg.video>=50?"video":"image";
  p.channels=channelFormats[p.format].filter(ch=>cfg.platforms.includes(ch));
  if(!p.channels.length&&cfg.platforms.includes("noticeboard"))p.channels=["noticeboard"];
  if(!p.channels.length){p.format="video";p.channels=cfg.platforms.filter(ch=>channelFormats.video.includes(ch))}
  checkpoint();plan.push(p);saveMonthData();refreshStats();
  $("sp-cat").value="all";$("sp-channel").value="all";$("sp-paid").value="all";
  render();updateUndoButtons();monthMessage("Blank post added. You choose its subject and caption.");return;
 }
 if(removeButton){
  const id=removeButton.dataset.removePost,p=plan.find(x=>x.id===id);
  if(!p||!window.confirm("Remove this planned post? You can undo it afterwards."))return;
  checkpoint();plan=plan.filter(x=>x.id!==id);delete edits[id];saveMonthData();
  refreshStats();render();updateUndoButtons();monthMessage("Post removed. Undo is available.");return;
 }
 if(copyBtn)copyBrief(copyBtn.dataset.copy);
 if(saveBtn){
  const id=saveBtn.dataset.save,card=saveBtn.closest("[data-item]"),original=plan.find(p=>p.id===id);
  const val=x=>card.querySelector(x).value;
  const changed={title:val(".sp-edit-title").trim()||original.title,caption:val(".sp-edit-caption").trim(),format:val(".sp-edit-format"),date:val(".sp-edit-date")||original.date,time:val(".sp-edit-time")||original.time,status:val(".sp-status"),note:val(".sp-note"),audienceRegion:val(".sp-edit-audience"),audienceMember:val(".sp-edit-member"),audienceGender:val(".sp-edit-gender"),locked:card.querySelector(".sp-edit-locked").checked};
  if(changed.date<start||changed.date>add(start,364)){monthMessage("Choose a date inside this 365-day calendar.");return}
  checkpoint();edits[id]=Object.assign({},edits[id]||{},changed);const okay=saveMonthData();updateUndoButtons();
  monthMessage(okay?"Post changes saved privately in this browser. Export CSV for a separate copy.":"Could not save in browser storage. Export CSV to keep a copy.");
  refreshStats();render();
 }
});
$("sp-m-preview").addEventListener("click",previewMonth);
$("sp-m-apply").addEventListener("click",applyMonth);
$("sp-y-apply").addEventListener("click",applyAllMonths);
for(const id of ["sp-undo","sp-m-undo"])$(id).addEventListener("click",()=>{if(restoreLast())monthMessage("Last change undone; posts and settings restored.")});
$("sp-copy-months").addEventListener("click",copyMonthSettings);
$("sp-b-apply").addEventListener("click",applyBulk);
$("sp-month-rows").addEventListener("change",e=>{
 const b=e.target.closest("[data-bulk-id]");if(!b)return;
 if(b.checked)selectedIds.add(b.dataset.bulkId);else selectedIds.delete(b.dataset.bulkId);
 $("sp-selected-count").textContent=selectedIds.size+" selected";
});
$("sp-month-rows").addEventListener("click",e=>{
 const b=e.target.closest("[data-roster-day]");if(!b)return;
 selected=b.dataset.rosterDay;render();
});
$("sp-select-all").addEventListener("click",()=>{
 const visible=monthPosts(viewMonth).map(effectivePost).filter(matches);
 for(const p of visible)selectedIds.add(p.id);
 renderMonthRoster();
});
$("sp-clear-selected").addEventListener("click",()=>{selectedIds.clear();renderMonthRoster()});
$("sp-csv").addEventListener("click",exportCsv);
$("sp-reset").addEventListener("click",()=>{
 if(!window.confirm("Start a fresh blank calendar for this period? Drafts and pattern settings can be restored with Undo."))return;
 checkpoint();plan=[];edits={};monthSettings={};liveLayerVisibility={};selectedIds.clear();
 saveMonthData();hydrateMonthControls();refreshStats();render();updateUndoButtons();
 monthMessage("Empty calendar ready. Turn on the patterns you want and set their frequency sliders.");
});
regenerate();hydrateMonthControls();
monthMessage("Your 365-day calendar is empty. Switch on patterns, set their frequency sliders, then preview and apply a month.");

})();