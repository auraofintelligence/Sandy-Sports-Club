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
const formatCycle=["video","video","carousel","video","video","image","video","video","poll","video","video","link"];
const angleCycle=["Quick explainer","Beginner viewpoint","Family-friendly idea","Visitor perspective","Local community angle","Practical demonstration","Fun challenge","One-minute discussion","Facilities perspective","Three-town idea","What would it take?","Community choice","Behind the scenes","Simple checklist","Myth versus fact","Follow-up question"];
const $esc=s=>String(s==null?"":s).replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const pad=n=>String(n).padStart(2,"0"), add=(s,n)=>new Date(Date.parse(s+"T00:00:00Z")+86400000*n).toISOString().slice(0,10);
const weekday=s=>(new Date(s+"T00:00:00Z").getUTCDay()+6)%7;
const rand=(seed)=>{let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}};
const shuffle=(a,r)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function holidays(date){const active=holidayRanges.filter(h=>h[1]<=date&&h[2]>=date).map(h=>h[0]);return {q:active.includes("QLD"),n:active.includes("NSW")||active.includes("NSW-W"),w:active.includes("NSW-W"),both:active.includes("QLD")&&active.some(x=>x.startsWith("NSW"))}};
function toBrisbaneToday(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Australia/Brisbane",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const f=k=>p.find(x=>x.type===k).value;return f("year")+"-"+f("month")+"-"+f("day")}
const startInput=$("sp-start");if(!startInput)return;
const platformIds=["youtube","facebook","instagram","tiktok","noticeboard"],defaultSettings=()=>({start:toBrisbaneToday(),volume:"balanced",audience:"all",video:67,qld:"high",nsw:"light",ads:false,channels:platformIds.slice(),topics:{},mix:0});
function loadSettings(){try{return Object.assign(defaultSettings(),JSON.parse(localStorage.getItem("sandy-planner-settings-v2"))||{})}catch{return defaultSettings()}}
function saveSettings(cfg){try{localStorage.setItem("sandy-planner-settings-v2",JSON.stringify(cfg))}catch{}}
let strategy=loadSettings(),start=strategy.start,plan=[],days=new Map(),selected="",viewMonth="",edits={},generated=false,mixSeed=strategy.mix||0;
let monthSettings={},undoStack=[],selectedIds=new Set(),monthPreview=null,monthSalt=0,liveLayerVisibility={};
const storageKey=()=>["sandy-planner-edits-v2",start,strategy.volume,strategy.video,strategy.qld,strategy.nsw,strategy.ads?"ads":"organic",strategy.audience,strategy.mix,strategy.channels.join("."),categories.map(c=>(strategy.topics||{})[c.id]||"normal").join(".")].join("-");
function getEdits(){try{return JSON.parse(localStorage.getItem(storageKey()))||{}}catch{return{}}}
function saveEdits(){try{localStorage.setItem(storageKey(),JSON.stringify(edits));return true}catch{return false}}
const monthStoreKey=()=>"sandy-monthly-batches-v1-"+storageKey();
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
 return !!Object.keys(record).length || ["Approved","Scheduled","Published"].includes(record.status||"");
}
function monthFor(p){return (edits[p.id]?.date||p.date).slice(0,7)}
function stateFor(p){return edits[p.id]?.status||"Idea"}
function monthPosts(month){return plan.filter(p=>monthFor(p)===month)}

function readStrategy(){
 const obj={start:startInput.value||toBrisbaneToday(),volume:$("sp-volume").value,audience:$("sp-audience").value,video:Number($("sp-video").value),qld:$("sp-qld").value,nsw:$("sp-nsw").value,ads:$("sp-ads").checked,channels:platformIds.filter(p=>$("sp-platform-"+p).checked),topics:{},mix:mixSeed};
 for(const c of categories)obj.topics[c.id]=$("sp-weight-"+c.id).value;
 return obj;
}
function validateStrategy(c){
 if(!c.channels.length)return "Choose at least one publishing channel.";
 if(!categories.some(x=>c.topics[x.id]!=="off"))return "Choose at least one topic.";
 if(c.video<100&&!c.channels.some(x=>["facebook","instagram","noticeboard"].includes(x)))return "With only YouTube or TikTok selected, choose 100% video or add a channel that supports images and polls.";
 return "";
}
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
 const cat=categories[post.cat],style=post.format;
 const open=["Show the concept, then invite a response.","Begin with a question or demonstration.","Use one clear example before explaining the proposal.","Offer a useful takeaway; do not promise an event."][post.seq%4];
 let action="Ask: "+cat.cta;
 let related=post.relatedTopic||cat.topics[(cat.topics.indexOf(post.topic)+1+cat.topics.length)%cat.topics.length];
 let format=style==="video"?"30-second two-topic sequence: 0–3s hook; 3–14s "+post.topic+"; 14–25s "+related+"; 25–30s CTA. Overlap 2 seconds if extended into adjacent clips.":style==="poll"?"Use one specific answerable question and a small set of choices.":"Use concise text and one clear illustrative visual.";
 let caveat=cat.id==="safety"?" WEATHER/SAFETY HOLD: obtain and date-stamp verified Bureau of Meteorology or official guidance shortly before publication; never invent a future forecast.":cat.id==="events"?" EVENTS HOLD: mention actual dates or countdowns only after the organiser confirms permissions and the event.":cat.id==="funding"?" FUNDRAISING HOLD: no raffle, donation or grant claim without eligible entity, review and approval.":cat.id==="news"?" PROGRESS HOLD: describe only work actually completed.":" Clearly identify Sandy Sports as a proposal, not an operating club.";
 return open+" Creative approach: "+post.angle+". "+format+" "+action+caveat;
}
function makePost(date,seq,catIndex,serial,extra){
 const cat=categories[catIndex],topic=cat.topics[(serial*7+seq*3)%cat.topics.length],fmt=formatCycle[serial%formatCycle.length],h=holidays(date),angle=angleCycle[(serial+catIndex*3)%angleCycle.length];
 const addBoard=["visitors","vision","places","events","volunteers","funding","news"].includes(cat.id)&&serial%4===0;
 let channels=channelFormats[fmt].slice();if(fmt==="video"&&serial%11===0)channels.push("youtube-standard");if(addBoard&&!channels.includes("noticeboard"))channels.push("noticeboard");
 const paid=(seq===0 && serial%7===0)||(h.q&&serial%11===0)||(h.n&&!h.q&&serial%19===0);
 const group=h.both?"QLD/NSW family visitors":h.q?"Queensland school-holiday visitors":h.n?"NSW visitors":cat.id==="funding"?"Potential local partners":"Local residents and interested visitors";
 return {id:date+"-"+seq,date,time:["07:30","09:30","11:30","13:30","15:30","17:30","19:30","20:30"][seq]||"21:00",cat:catIndex,title:topic+" · "+angle,topic,angle,format:fmt,channels,paid,group,brief:"",page:cat.url,dayExtra:extra||"",seq,sourceHold:["safety","events","funding","news"].includes(cat.id)};
}
function build(s,cfg){
 const r=rand(Number(s.replace(/-/g,""))+18403+(cfg.mix||0)*131),pool=[],weights=categories.map(c=>({off:0,less:0.5,normal:1,more:2.5}[cfg.topics[c.id]||"normal"]||0)*c.n);
 const enabled=id=>categories.some((c,i)=>c.id===id&&weights[i]>0);
 const choose=(items,avoid)=>{let possible=items.filter(i=>i>=0&&weights[i]>0&&i!==avoid);if(!possible.length)possible=items.filter(i=>i>=0&&weights[i]>0);if(!possible.length)possible=weights.map((x,i)=>x>0?i:-1).filter(x=>x>=0);let sum=possible.reduce((a,i)=>a+weights[i],0),roll=r()*sum;for(const i of possible){roll-=weights[i];if(roll<=0)return i}return possible[possible.length-1]};
 const allIndices=categories.map((_,i)=>i);
 for(let i=0;i<365;i++)pool.push(choose(allIndices,i>0?pool[i-1]:-1));
 let serial=0,all=[],dayMap=new Map();
 for(let i=0;i<365;i++){
  const date=add(s,i),wd=weekday(date),h=holidays(date),tom=holidays(add(s,i+1)),entry=[];
  const create=(cat,extra,customTitle)=>{if(cat<0||weights[cat]===0)return;const post=makePost(date,entry.length,cat,serial++,extra);if(customTitle){post.topic=customTitle;post.title=customTitle+" · "+post.angle}entry.push(post)};
  create(pool[i],"Daily anchor");
  if(cfg.volume!=="one"){
   let extras=wd===4?1:wd===5?2:wd===6?1:0;
   if(cfg.volume==="busy")extras+=wd===4?1:wd===5?2:wd===6?2:0;
   if([3,4,5].includes(wd)&&enabled("safety"))extras+=1;
   if(h.q)extras+=cfg.qld==="high"?2:cfg.qld==="light"?1:0;
   if(h.n)extras+=cfg.nsw==="high"?2:cfg.nsw==="light"&&i%2===0?1:0;
   const q=h.q&&cfg.qld!=="off",n=h.n&&cfg.nsw!=="off";
   const candidateKeys=q?["visitors","health","voice","safety","other","volleyball"]:n?["visitors","voice","other","health"]:wd>=4?["visitors","other","health","voice","safety"]:["vision","volunteers","film","skills","funding","places"];
   const allowed=candidateKeys.map(k=>categories.findIndex(x=>x.id===k)).filter(idx=>idx>=0&&weights[idx]>0);
   for(let k=0;k<extras;k++){
    if(k===0&&[3,4,5].includes(wd)&&enabled("safety")){
     const word=wd===3?"Thursday weekend outlook":wd===4?"Friday forecast update":"Saturday conditions update";
     create(categories.findIndex(x=>x.id==="safety"),"Verified weather placeholder",word+" (verify official forecast before posting)");
    }else{
     const ci=choose(allowed.length?allowed:allIndices,entry.length?entry[entry.length-1].cat:-1);
     create(ci,wd>=4?"Weekend bonus":q?"QLD holiday boost":n?"NSW holiday boost":"Working idea");
    }
   }
   if(tom.q&&!h.q&&cfg.qld!=="off")create(categories.findIndex(x=>x.id==="visitors"),"One-day holiday countdown","Queensland school holidays start tomorrow: help shape Sandy Sports");
   if(tom.n&&!h.n&&cfg.nsw!=="off")create(categories.findIndex(x=>x.id==="visitors"),"One-day holiday countdown","NSW school holidays start tomorrow: what would you like to play on Straddie?");
   if(date.endsWith("-01"))create(categories.findIndex(x=>x.id==="news"),"Monthly newsletter draft","Month-start newsletter ideas: confirm progress and invite feedback");
  }
  dayMap.set(date,{date,posts:entry,holiday:h});all.push(...entry);
 }
 const target=Math.round(all.length*cfg.video/100),order=shuffle(all.map((_,i)=>i),rand(Number(s.replace(/-/g,""))+92342+(cfg.mix||0)*563)),videoIndices=new Set(order.slice(0,target));
 const otherFormats=["image","carousel","poll","link"];
 all.forEach((p,i)=>{
  p.format=videoIndices.has(i)?"video":otherFormats[(i+Math.floor(i/13))%otherFormats.length];
  const base=channelFormats[p.format].filter(x=>cfg.channels.includes(x));
  if(p.format==="video"&&cfg.channels.includes("youtube")&&i%9===0)base.push("youtube-standard");
  if(cfg.channels.includes("noticeboard")&&["visitors","vision","places","events","volunteers","funding","news"].includes(categories[p.cat].id)&&i%3===0&&!base.includes("noticeboard"))base.push("noticeboard");
  p.channels=base;
  p.paid=cfg.ads&&p.paid&&p.channels.some(x=>["youtube","facebook","instagram","tiktok"].includes(x));
  p.group=cfg.audience==="local"?"Local residents":cfg.audience==="visitors"?"Holidaymakers and visiting families":p.group;
 });
 return {all,dayMap};
}
const monthsList=()=>{const end=add(start,364),out=[];let curr=start.slice(0,7);while(curr<=end.slice(0,7)){out.push(curr);let [y,m]=curr.split("-").map(Number);m++;if(m>12){y++;m=1}curr=y+"-"+pad(m)}return out};
const labelDate=s=>new Date(s+"T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long",year:"numeric"});
function regenerate(){
 const data=build(start,strategy),saved=loadMonthData();plan=saved?.plan||data.all;days=data.dayMap;edits=getEdits();monthSettings=saved?.monthSettings||{};undoStack=saved?.undoStack||[];selectedIds.clear();monthPreview=null;
 const months=monthsList();$("sp-month").innerHTML=months.map(x=>'<option value="'+x+'">'+new Date(x+"-01T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",month:"long",year:"numeric"})+"</option>").join("");
 if(!months.includes(viewMonth))viewMonth=months[0];$("sp-month").value=viewMonth;
 if(!days.has(selected))selected=start;const video=plan.filter(x=>x.format==="video").length,ads=plan.filter(x=>x.paid).length;
 $("sp-results").hidden=false;
 $("sp-stats").innerHTML='<div class="sp-stat"><strong>365</strong><small>Days with a primary post</small></div><div class="sp-stat"><strong>'+plan.length+'</strong><small>Content packages incl. peak extras</small></div><div class="sp-stat"><strong>'+Math.round(100*video/plan.length)+'%</strong><small>Video content (your target: '+strategy.video+'%)</small></div><div class="sp-stat"><strong>'+ads+'</strong><small>Paid candidates; $0 authorised</small></div>';
 render();updateUndoButtons();
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
function suggestedCaption(p){const cat=categories[p.cat];return "Could Sandy Sports explore "+p.topic.charAt(0).toLowerCase()+p.topic.slice(1)+"? Sandy Sports is still a community proposal. Your ideas can help shape what comes next. "+cat.cta}
function render(){
 const m=viewMonth,[y,mm]=m.split("-").map(Number),nd=new Date(Date.UTC(y,mm,0)).getUTCDate(),offset=weekday(m+"-01");
 $("sp-month-label").textContent=new Date(m+"-01T00:00:00Z").toLocaleDateString("en-AU",{month:"long",year:"numeric",timeZone:"UTC"});
 let out="";for(let k=0;k<offset;k++)out+='<div aria-hidden="true"></div>';
 let monthItems=0;
 for(let d=1;d<=nd;d++){
  const date=m+"-"+pad(d),row=days.get(date);
  if(!row){out+='<div class="sp-day outside" aria-label="'+date+' outside selected 365-day range"><span class="date">'+d+"</span></div>";continue}
  const shown=postsOn(date).map(effectivePost).filter(matches);monthItems+=shown.length;
  const flags=row.holiday;
  out+='<button type="button" class="sp-day'+(date===selected?" selected":"")+'" data-date="'+date+'" aria-label="'+labelDate(date)+", "+shown.length+' matching content packages" aria-pressed="'+(date===selected?"true":"false")+'"><span class="date">'+d+'</span><span class="count">'+shown.length+" idea"+(shown.length===1?"":"s")+'</span><span class="markers">'+(flags.q?'<span class="q"></span>':'')+(flags.n?'<span class="n"></span>':'')+(weekday(date)>=4?'<span class="w"></span>':'')+"</span></button>";
 }
 $("sp-grid").innerHTML=out;$("sp-month-count").textContent=monthItems+" matching ideas this month";renderDetail();renderMonthRoster();
}
function renderDetail(){
 const row=days.get(selected),host=$("sp-detail");if(!row){host.innerHTML="<h3>Choose a date</h3>";return}
 const match=postsOn(selected).map(effectivePost).filter(matches),h=row.holiday,labels=[];
 if(h.q)labels.push("QLD holidays");if(h.n)labels.push(h.w?"NSW Western Division":"NSW holidays");if(weekday(selected)>=4)labels.push("Weekend lead-in / peak");
 let html='<h3>'+labelDate(selected)+'</h3><p class="sp-hint">'+$esc(labels.join(" · ")||"Normal seven-day schedule")+'</p><p class="sp-hint">'+match.length+" draft idea(s). Nothing gets published or paid for here.</p>";
 if(!match.length)html+='<p>No content matches these filters. Adjust the filters or choose another date.</p>';
 for(const p of match){
  const cat=categories[p.cat],override=edits[p.id]||{},status=override.status||"Idea",note=override.note||"",caption=override.caption||suggestedCaption(p),spec=specsForPost(p);
  const special=p.sourceHold?'<span class="sp-tag warn">Verify before publishing</span>':'';
  html+='<article class="sp-item" data-item="'+$esc(p.id)+'"><div class="sp-meta">'+$esc(override.time||p.time)+' AEST · '+$esc(p.dayExtra)+' · '+$esc(cat.name)+'</div><h4>'+$esc(override.title||p.title)+'</h4><span class="sp-tag">'+$esc(p.format.toUpperCase())+'</span>'+special+(p.paid?'<span class="sp-tag ad">Paid ad idea (not authorised)</span>':"")+
   '<p><strong>Channels:</strong> '+$esc(channelNames(p))+'</p><p><strong>Asset specs:</strong> '+$esc(spec)+'</p><p><strong>Production brief:</strong> '+$esc(brief(p))+'</p><p><strong>Audience:</strong> '+$esc(p.group)+(p.paid?"; <strong>ad spend:</strong> not set":"")+'</p><p><strong>Source:</strong> <a href="'+p.page+'">'+$esc(cat.name)+" page</a></p>"+
   '<label>Title <input class="sp-edit-title" type="text" maxlength="220" value="'+$esc(override.title||p.title)+'"></label>'+
   '<label>Caption <textarea class="sp-edit-caption" rows="4" maxlength="1800">'+$esc(caption)+'</textarea></label>'+
   '<label>Format <select class="sp-edit-format">'+["video","image","carousel","poll","link"].map(x=>'<option value="'+x+'"'+(x===p.format?' selected':'')+'>'+x+'</option>').join("")+'</select></label>'+
   '<div class="sp-edit-timing"><label>Date <input type="date" class="sp-edit-date" min="'+start+'" max="'+add(start,364)+'" value="'+$esc(override.date||p.date)+'"></label><label>Time (Brisbane) <input type="time" class="sp-edit-time" value="'+$esc(override.time||p.time)+'"></label></div>'+
   '<label>Status <select class="sp-status" data-id="'+$esc(p.id)+'">'+["Idea","Draft","For review","Approved","Scheduled","Published","Rejected"].map(x=>'<option'+(x===status?" selected":"")+">"+x+"</option>").join("")+'</select></label>'+
   '<label>Working notes <textarea class="sp-note" data-id="'+$esc(p.id)+'" placeholder="Source checks, visual assets, review notes...">'+$esc(note)+'</textarea></label>'+
   '<div class="sp-actions"><button type="button" data-save="'+$esc(p.id)+'">Save changes</button><button type="button" class="secondary" data-alt="'+$esc(p.id)+'">Try another idea</button><button type="button" class="secondary" data-copy="'+$esc(p.id)+'">Copy brief</button></div></article>';
 }
 host.innerHTML=html;
}
function exportCsv(){
 const header=["date","time_AEST","category","title","format","channels","dimensions_and_duration","source_page","audience","paid_candidate","spend_authorised","status","caption","production_brief","working_notes"];
 const quoted=x=>'"'+String(x==null?"":x).replace(/"/g,'""').replace(/\r?\n/g," ")+'"';
 const arr=[header.join(",")];
 for(const original of plan){const p=effectivePost(original),ov=edits[p.id]||{};arr.push([ov.date||p.date,ov.time||p.time,categories[p.cat].name,ov.title||p.title,p.format,channelNames(p),specsForPost(p),p.page,p.group,p.paid?"Yes":"No","No",ov.status||"Idea",ov.caption||suggestedCaption(p),brief(p),ov.note||""].map(quoted).join(","))}
 const blob=new Blob(["\ufeff"+arr.join("\r\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sandy-sports-social-"+start+"-365-days.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function copyBrief(id){const original=plan.find(x=>x.id===id);if(!original)return;const p=effectivePost(original),ov=edits[id]||{},content=[(ov.date||p.date)+" "+(ov.time||p.time)+" AEST",ov.title||p.title,categories[p.cat].name,p.format,channelNames(p),specsForPost(p),ov.caption||suggestedCaption(p),brief(p),p.page,"Audience: "+p.group,p.paid?"Paid candidate: budget not set or approved":"Organic","Status: "+(ov.status||"Idea"),ov.note||""].join("\n\n");if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(content).catch(()=>window.prompt("Copy brief:",content))}else window.prompt("Copy brief:",content)}


$("sp-cat").innerHTML+=categories.map(c=>'<option value="'+c.id+'">'+$esc(c.emoji+" "+c.name)+'</option>').join("");
$("sp-topic-choices").innerHTML=categories.map(c=>'<label><span>'+$esc(c.emoji+" "+c.name)+'</span><select id="sp-weight-'+c.id+'" aria-label="'+$esc(c.name)+' topic priority">'+["off","less","normal","more"].map(x=>'<option value="'+x+'">'+({off:"Off",less:"Less",normal:"Normal",more:"More"}[x])+'</option>').join("")+'</select></label>').join("");
function applySettings(cfg){
 startInput.value=cfg.start;$("sp-volume").value=cfg.volume;$("sp-audience").value=cfg.audience;
 $("sp-video").value=cfg.video;$("sp-video-out").textContent=cfg.video+"%";
 $("sp-qld").value=cfg.qld;$("sp-nsw").value=cfg.nsw;$("sp-ads").checked=!!cfg.ads;
 for(const id of platformIds)$("sp-platform-"+id).checked=cfg.channels.includes(id);
 for(const c of categories)$("sp-weight-"+c.id).value=(cfg.topics||{})[c.id]||"normal";
}
function message(s){$("sp-strategy-message").textContent=s}

const areaLabels={all:"Local, regional and tourist audiences",local:"Local residents",regional:"Regional visitors",tourist:"Holidaymakers and tourists"};
const classLabels={all:"Everyone",supporters:"Interested supporters",founders:"Potential founding members","future-members":"Prospective members",families:"Families",volunteers:"Prospective volunteers",clubs:"Partner clubs and organisations"};
const genderLabels={all:"Everyone / unspecified",women:"Women (opt-in)",men:"Men (opt-in)","self-described":"Self-described (opt-in)"};
function defaultMonthSettings(){
 return {base:1,limit:7,weekend:1,video:strategy.video,audience:"all",member:"all",gender:"all",ads:false,platforms:strategy.channels.slice(),layers:Object.fromEntries(categories.map(c=>[c.id,{enabled:strategy.topics[c.id]!=="off",frequency:"normal",priority:"normal",visible:true}]))};
}
function monthConfig(month){const saved=monthSettings[month]||{},def=defaultMonthSettings();return {...def,...saved,platforms:saved.platforms?.slice()||def.platforms,layers:Object.fromEntries(categories.map(c=>[c.id,{...def.layers[c.id],...(saved.layers?.[c.id]||{})}]))}}
function setupMonthControls(){
 const root=$("sp-layer-choices");root.innerHTML=categories.map(c=>'<div class="sp-layer-row" data-category="'+c.id+'"><label><input type="checkbox" id="sp-m-on-'+c.id+'"> '+$esc(c.emoji+" "+c.name)+'</label><label><span class="sr-only">Frequency for '+$esc(c.name)+'</span><select id="sp-m-freq-'+c.id+'"><option value="low">Rare</option><option value="normal">Normal</option><option value="high">Frequent</option></select></label><label><span class="sr-only">Priority for '+$esc(c.name)+'</span><select id="sp-m-priority-'+c.id+'"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label><input class="sp-layer-show" type="checkbox" id="sp-m-show-'+c.id+'"> Show</label></div>').join("");
 $("sp-m-video").addEventListener("input",()=>{$("sp-m-video-out").textContent=$("sp-m-video").value+"%"});
 $("sp-month-form").addEventListener("change",e=>{
  monthPreview=null;$("sp-m-apply").disabled=true;$("sp-month-preview").hidden=true;
  if(e.target.classList.contains("sp-layer-show")){
   liveLayerVisibility[viewMonth]={};
   for(const c of categories)liveLayerVisibility[viewMonth][c.id]={visible:$("sp-m-show-"+c.id).checked};
   render();
  }
  monthMessage("Settings changed. Preview before applying. Current posts are unchanged.");
 });
}
function hydrateMonthControls(){
 const cfg=monthConfig(viewMonth),label=new Date(viewMonth+"-01T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",month:"long",year:"numeric"});
 $("sp-config-month-label").textContent=label;
 $("sp-m-base").value=cfg.base;$("sp-m-limit").value=cfg.limit;$("sp-m-weekend").value=cfg.weekend;
 $("sp-m-video").value=cfg.video;$("sp-m-video-out").textContent=cfg.video+"%";
 $("sp-m-audience").value=cfg.audience;$("sp-m-member").value=cfg.member;$("sp-m-gender").value=cfg.gender;$("sp-m-ads").checked=cfg.ads;
 for(const p of platformIds)$("sp-m-"+p).checked=cfg.platforms.includes(p);
 for(const c of categories){const lay=cfg.layers[c.id];$("sp-m-on-"+c.id).checked=lay.enabled;$("sp-m-freq-"+c.id).value=lay.frequency;$("sp-m-priority-"+c.id).value=lay.priority;$("sp-m-show-"+c.id).checked=lay.visible!==false}
 monthPreview=null;$("sp-m-apply").disabled=true;$("sp-month-preview").hidden=true;
 liveLayerVisibility[viewMonth]=cfg.layers;
 $("sp-copy-month-choices").innerHTML=monthsList().filter(m=>m!==viewMonth).map(m=>'<label><input type="checkbox" data-copy-month="'+m+'"> '+$esc(new Date(m+"-01T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",month:"short",year:"numeric"}))+'</label>').join("");
 monthMessage("Month settings are suggestions until you apply them. Approved or edited posts are protected.");
 updateUndoButtons();
}
function readMonthControls(){
 const cfg={base:Number($("sp-m-base").value),limit:Number($("sp-m-limit").value),weekend:Number($("sp-m-weekend").value),video:Number($("sp-m-video").value),audience:$("sp-m-audience").value,member:$("sp-m-member").value,gender:$("sp-m-gender").value,ads:$("sp-m-ads").checked,platforms:platformIds.filter(p=>$("sp-m-"+p).checked),layers:{}};
 for(const c of categories)cfg.layers[c.id]={enabled:$("sp-m-on-"+c.id).checked,frequency:$("sp-m-freq-"+c.id).value,priority:$("sp-m-priority-"+c.id).value,visible:$("sp-m-show-"+c.id).checked};
 return cfg;
}
function monthMessage(s){$("sp-month-feedback").textContent=s}
function validateMonth(cfg){
 if(!cfg.platforms.length)return "Choose at least one platform.";
 if(!categories.some(c=>cfg.layers[c.id].enabled))return "Enable at least one category.";
 if(cfg.base>cfg.limit)return "The daily limit must be at least the base posting frequency.";
 if(cfg.video<100&&!cfg.platforms.some(x=>["facebook","instagram","noticeboard"].includes(x)))return "With only YouTube/TikTok, use 100% video or add a channel for images.";
 return "";
}
function monthDates(month){return Array.from(days.keys()).filter(x=>x.startsWith(month))}
function proposalForMonth(month,cfg){
 const dates=monthDates(month),old=monthPosts(month),protectedPosts=old.filter(editedOrApproved),replaceable=old.filter(x=>!editedOrApproved(x));
 const keepByDate=new Map(dates.map(d=>[d,protectedPosts.filter(p=>(edits[p.id]?.date||p.date)===d)]));
 const salt=Number(month.replace("-",""))+strategy.mix*233+cfg.base*443+cfg.video*67+cfg.limit*47;
 const random=rand(salt),newPosts=[],limitsExceeded=[],layerWeights=categories.map(c=>{
  const l=cfg.layers[c.id];if(!l.enabled)return 0;
  const f={low:.4,normal:1,high:2.5}[l.frequency]||1;
  const p={low:.7,normal:1,high:1.7}[l.priority]||1;
  return c.n*f*p;
 });
 const available=categories.map((c,i)=>i).filter(i=>layerWeights[i]>0);
 let serial=0,lastCat=-1;
 const choose=(date)=>{
  const h=holidays(date);
  const weights=available.map(i=>{
   let w=layerWeights[i];
   if(h.q&&["visitors","health","voice","volleyball"].includes(categories[i].id))w*=1.7;
   if(h.n&&!h.q&&["visitors","voice","other"].includes(categories[i].id))w*=1.35;
   if(i===lastCat)w*=.35;
   return w;
  });
  let v=random()*weights.reduce((a,b)=>a+b,0),picked=available[available.length-1];
  for(let j=0;j<available.length;j++){v-=weights[j];if(v<=0){picked=available[j];break}}
  lastCat=picked;return picked;
 };
 for(const date of dates){
  const h=holidays(date),wd=weekday(date),kept=keepByDate.get(date)||[];
  let wanted=cfg.base;
  if(wd>=5)wanted+=cfg.weekend;
  if(h.q&&strategy.qld!=="off")wanted+=strategy.qld==="high"?2:1;
  if(h.n&&strategy.nsw!=="off")wanted+=strategy.nsw==="high"?2:1;
  wanted=Math.min(cfg.limit,wanted);
  if(kept.length>cfg.limit)limitsExceeded.push(date);
  const count=Math.max(0,wanted-kept.length);
  const safetyIdx=categories.findIndex(c=>c.id==="safety"),newsIdx=categories.findIndex(c=>c.id==="news"),visitorIdx=categories.findIndex(c=>c.id==="visitors");
  const tomorrow=holidays(add(date,1));
  for(let j=0;j<count;j++){
   let ci=choose(date),special="";
   if(j===0){
    if(wd>=3&&wd<=5&&layerWeights[safetyIdx]>0&&!kept.some(p=>p.cat===safetyIdx)){
     ci=safetyIdx;special=["Thursday","Friday","Saturday"][wd-3]+" weather outlook: verify current official forecast";
    }else if(date.endsWith("-01")&&layerWeights[newsIdx]>0&&!kept.some(p=>p.cat===newsIdx)){
     ci=newsIdx;special="Monthly Sandy Sports proposal newsletter: verify actual progress";
    }else if(visitorIdx>=0&&layerWeights[visitorIdx]>0&&((tomorrow.q&&!h.q)||(tomorrow.n&&!h.n))){
     ci=visitorIdx;special="School holiday begins tomorrow: invite visiting families to contribute ideas";
    }
   }
   const p=makePost(date,kept.length+j,ci,serial++,"Monthly suggestion");
   if(special){p.topic=special;p.title=special+" · "+p.angle}
   p.id="monthly-"+month+"-"+date+"-"+j+"-"+(salt+Math.floor(random()*1000000));
   p.audienceRegion=cfg.audience;p.audienceMember=cfg.member;p.audienceGender=cfg.gender;
   p.group=areaLabels[cfg.audience];
   p.relatedTopic=categories[ci].topics[(Math.floor(random()*categories[ci].topics.length))];
   newPosts.push(p);
  }
 }
 const protectedVideo=protectedPosts.filter(p=>effectivePost(p).format==="video").length;
 const desiredTotal=protectedPosts.length+newPosts.length;
 const wantedVideo=Math.max(0,Math.min(newPosts.length,Math.round(desiredTotal*cfg.video/100)-protectedVideo));
 const indices=shuffle(newPosts.map((_,i)=>i),rand(salt+73)),videoSet=new Set(indices.slice(0,wantedVideo));
 const other=["image","carousel","poll","link"];
 newPosts.forEach((p,i)=>{
  p.format=videoSet.has(i)?"video":other[i%4];
  const base=channelFormats[p.format].filter(ch=>cfg.platforms.includes(ch));
  if(p.format==="video"&&cfg.platforms.includes("youtube")&&i%9===0)base.push("youtube-standard");
  if(cfg.platforms.includes("noticeboard")&&i%3===0&&!base.includes("noticeboard"))base.push("noticeboard");
  p.channels=base.length?base:cfg.platforms.filter(x=>channelFormats[p.format].includes(x));
  if(!p.channels.length){p.format="video";p.channels=cfg.platforms.filter(x=>["youtube","facebook","instagram","tiktok"].includes(x))}
  if(!p.channels.length){p.format="image";p.channels=["noticeboard"]}
  p.paid=cfg.ads&&i%9===0&&p.channels.some(x=>["youtube","facebook","instagram","tiktok"].includes(x));
 });
 return {month,cfg,keep:protectedPosts,replaceable,newPosts,limitsExceeded,current:old.length,planned:protectedPosts.length+newPosts.length};
}
function previewMonth(){
 const cfg=readMonthControls(),error=validateMonth(cfg);
 if(error){monthMessage(error);return}
 const preview=proposalForMonth(viewMonth,cfg),pr=preview.planned;
 monthPreview=preview;
 const videos=preview.newPosts.filter(p=>p.format==="video").length+preview.keep.filter(p=>effectivePost(p).format==="video").length;
 const holidayDays=monthDates(viewMonth).filter(d=>{const h=holidays(d);return h.q||h.n}).length;
 const rows=preview.newPosts.slice(0,7).map(p=>'<li>'+$esc(p.date+" · "+p.title)+"</li>").join("");
 $("sp-month-preview").innerHTML='<strong>Monthly preview (not applied)</strong><p>'+preview.current+' existing posts → '+pr+' proposed posts ('+preview.keep.length+' protected; '+preview.replaceable.length+' replaceable). '+Math.round(100*videos/Math.max(1,pr))+'% video. '+holidayDays+' QLD/NSW holiday dates in the month.</p><p class="sp-hint">'+preview.newPosts.length+' new suggestions, with '+preview.cfg.platforms.length+' platform(s) and your chosen audiences. '+(preview.limitsExceeded.length?preview.limitsExceeded.length+' date(s) exceed the cap because existing edited/approved posts will be kept.':"")+'</p><ul>'+rows+'</ul>';
 $("sp-month-preview").hidden=false;$("sp-m-apply").disabled=false;
 monthMessage("Preview ready. No posts changed. Select Apply to update this month only.");
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
 render();updateUndoButtons();
 monthMessage("Month applied: "+created+" suggestions, "+retained+" edited/approved posts preserved. "+(ok?"Saved in this browser.":"Local saving failed: export CSV to preserve this plan."));
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
   if(["youtube","tiktok"].includes(platform)&&fmt!=="video"&&!format)patch.format="video";
   if(platform==="all"){
    const allowed=channelFormats[patch.format||fmt]||[];
    patch.channels=strategy.channels.filter(x=>allowed.includes(x));
    if(!patch.channels.length)patch.channels=["noticeboard"];
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
 const ok=saveMonthData();selectedIds.clear();render();updateUndoButtons();
 $("sp-b-feedback").textContent="Updated "+ids.length+" selected post(s), preserving their other fields. "+(ok?"Saved locally.":"Storage failed; export CSV.");
 monthMessage("Bulk edit applied to "+ids.length+" posts. Undo is available.");
}
function previewStrategy(){
 const cfg=readStrategy(),error=validateStrategy(cfg);if(error){message(error);return}
 const preview=build(cfg.start,cfg),dates=Array.from({length:7},(_,i)=>add(cfg.start,i));
 const cards=dates.map(date=>{
  const items=preview.dayMap.get(date).posts;
  return '<div class="sp-preview-day"><strong>'+new Date(date+"T00:00:00Z").toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"})+'</strong><div><b>'+$esc(items[0].title)+'</b><p class="sp-hint">'+items.length+' proposed post'+(items.length===1?"":"s")+' · '+$esc(categories[items[0].cat].name)+'</p>'+(items.length>1?'<span class="sp-hint">Plus: '+$esc(items.slice(1,3).map(x=>x.topic).join(" · "))+'</span>':"")+'</div></div>';
 }).join("");
 $("sp-preview").innerHTML='<h3>Sample week · your choices</h3><p class="sp-hint">This is a preview of the mix, not an approved schedule. Try another mix, adjust topics, or generate the full draft when ready.</p>'+cards;
 $("sp-preview").hidden=false;saveSettings(cfg);
 message("Preview ready. Make changes above until the mix feels right; the calendar has not been generated.");
}
function generateFromChoices(){
 const cfg=readStrategy(),error=validateStrategy(cfg);if(error){message(error);return}
 if(generated&&JSON.stringify(cfg)!==JSON.stringify(strategy)&&Object.keys(edits).length>0){
  if(!window.confirm("Your existing edits belong to the previous strategy. They will remain in this browser, but switching strategies opens a different draft. Export the current CSV first if you want a copy. Continue?"))return;
 }
 strategy=cfg;start=cfg.start;selected=start;viewMonth=start.slice(0,7);generated=true;
 saveSettings(cfg);regenerate();hydrateMonthControls();
 message("Draft generated from your choices. Edit any post in the calendar. Nothing will publish automatically.");
 $("sp-preview").hidden=true;
}
applySettings(strategy);
setupMonthControls();
$("sp-video").addEventListener("input",()=>{$("sp-video-out").textContent=$("sp-video").value+"%"});
$("sp-builder").addEventListener("change",e=>{
 if(e.target.matches("button"))return;
 $("sp-preview").hidden=true;
 message(generated?"Your controls have changed. The existing calendar is untouched until you choose Generate again.":"Strategy changed. Preview a week before generating the full calendar.");
});
$("sp-preview-btn").addEventListener("click",previewStrategy);
$("sp-generate-btn").addEventListener("click",generateFromChoices);
$("sp-remix-btn").addEventListener("click",()=>{mixSeed++;previewStrategy()});
$("sp-month").addEventListener("change",e=>{viewMonth=e.target.value;selectedIds.clear();const available=Array.from(days.keys()).find(x=>x.slice(0,7)===viewMonth);if(available)selected=available;hydrateMonthControls();render()});
["sp-cat","sp-channel","sp-paid"].forEach(id=>$(id).addEventListener("change",()=>{if(generated)render()}));
$("sp-grid").addEventListener("click",e=>{const b=e.target.closest("[data-date]");if(b){selected=b.dataset.date;render()}});
$("sp-detail").addEventListener("change",e=>{
 if(e.target.classList.contains("sp-status")){
  const id=e.target.dataset.id;edits[id]=Object.assign({},edits[id]||{},{status:e.target.value});saveEdits();
 }
});
$("sp-detail").addEventListener("click",e=>{
 const saveBtn=e.target.closest("[data-save]"),copyBtn=e.target.closest("[data-copy]"),altBtn=e.target.closest("[data-alt]");
 if(copyBtn)copyBrief(copyBtn.dataset.copy);
 if(altBtn){
  const id=altBtn.dataset.alt,p=plan.find(x=>x.id===id);if(!p)return;
  const prev=edits[id]||{},count=(prev.alt||0)+1,c=categories[p.cat];
  const index=c.topics.indexOf(p.topic),newTopic=c.topics[(Math.max(0,index)+count*7)%c.topics.length];
  edits[id]=Object.assign({},prev,{alt:count,title:newTopic+" · "+angleCycle[(count+p.seq)%angleCycle.length],caption:"What do you think about "+newTopic.charAt(0).toLowerCase()+newTopic.slice(1)+"? Sandy Sports is a proposal and we'd love your ideas. "+c.cta});
  saveEdits();renderDetail();message("Alternative idea drafted. You can edit it or try another.");
 }
 if(saveBtn){
  const id=saveBtn.dataset.save,card=saveBtn.closest("[data-item]"),original=plan.find(p=>p.id===id);
  const val=x=>card.querySelector(x).value;
  const changed={title:val(".sp-edit-title").trim()||original.title,caption:val(".sp-edit-caption").trim(),format:val(".sp-edit-format"),date:val(".sp-edit-date")||original.date,time:val(".sp-edit-time")||original.time,status:val(".sp-status"),note:val(".sp-note")};
  if(changed.date<start||changed.date>add(start,364)){message("Choose a date inside this 365-day calendar.");return}
  edits[id]=Object.assign({},edits[id]||{},changed);const okay=saveEdits();
  message(okay?"Post changes saved privately in this browser. Export CSV to keep a separate copy.":"Could not save in browser storage. Export the CSV to keep a copy.");
  render();
 }
});
$("sp-m-preview").addEventListener("click",previewMonth);
$("sp-m-apply").addEventListener("click",applyMonth);
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
 if(window.confirm("Clear the saved titles, dates, captions, statuses and notes for this draft? The generated topic mix stays the same.")){
  localStorage.removeItem(storageKey());edits={};render();message("Edits cleared for this draft. Other strategy versions remain saved separately.");
 }
});
generated=true;regenerate();hydrateMonthControls();message("The calendar is ready. Select a month and use the collapsible monthly controls; annual defaults are optional.");

})();