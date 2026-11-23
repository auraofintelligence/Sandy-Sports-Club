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
const storageKey=()=>["sandy-planner-edits-v2",start,strategy.volume,strategy.video,strategy.qld,strategy.nsw,strategy.ads?"ads":"organic",strategy.audience,strategy.mix,strategy.channels.join("."),categories.map(c=>(strategy.topics||{})[c.id]||"normal").join(".")].join("-");
function getEdits(){try{return JSON.parse(localStorage.getItem(storageKey()))||{}}catch{return{}}}
function saveEdits(){try{localStorage.setItem(storageKey(),JSON.stringify(edits));return true}catch{return false}}
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
const platformText={video:"YouTube Shorts 1080×1920 (9:16); Facebook/Instagram Reels 1080×1920 organic, 1440×2560 premium ad export; TikTok 1080×1920. Add subtitles, safe zones and a 30-second sequence. Standard YouTube variant (when selected): 1920×1080 (16:9), with a 3840×2160 thumbnail. For a longer sequence, overlap the final/first 2 seconds.",image:"Facebook Feed 1080×1350 organic or 1440×1800 paid (4:5); Instagram Feed 1080×1440 (3:4) or 1080×1350 (4:5).",carousel:"Facebook/Instagram carousel 1080×1080 (1:1), or custom 4:5 feed cards when placement allows.",poll:"Facebook poll or Instagram Story poll: 1080×1920 (9:16). An interactive poll needs a native platform action.",link:"Facebook link preview, source thumbnail 1200×630 (1.91:1); adapt a static notice for the planned Noticeboard web channel."};
const channelFormats={video:["youtube","facebook","instagram","tiktok"],image:["facebook","instagram"],carousel:["facebook","instagram"],poll:["facebook","instagram"],link:["facebook","noticeboard"]};
function channelNames(post){let out=post.channels.map(id=>({youtube:"YouTube Shorts","youtube-standard":"YouTube standard (16:9)",facebook:post.format==="video"?"Facebook Reels":"Facebook Feed",instagram:post.format==="video"?"Instagram Reels":"Instagram Feed/Story",tiktok:"TikTok",noticeboard:"Straddie Noticeboard (proposed)"}[id]));return out.join(" · ")}
function brief(post){
 const cat=categories[post.cat],style=post.format;
 const open=["Show the concept, then invite a response.","Begin with a question or demonstration.","Use one clear example before explaining the proposal.","Offer a useful takeaway; do not promise an event."][post.seq%4];
 let action="Ask: "+cat.cta;
 let format=style==="video"?"Video structure: 0–3s hook; 3–20s example or practical tip; 20–30s takeaway and invitation. If serialised, overlap 2 seconds between adjacent clips.":style==="poll"?"Use one specific answerable question and a small set of choices.":"Use concise text and one clear illustrative visual.";
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
 const data=build(start,strategy);plan=data.all;days=data.dayMap;edits=getEdits();
 const months=monthsList();$("sp-month").innerHTML=months.map(x=>'<option value="'+x+'">'+new Date(x+"-01T00:00:00Z").toLocaleDateString("en-AU",{timeZone:"UTC",month:"long",year:"numeric"})+"</option>").join("");
 if(!months.includes(viewMonth))viewMonth=months[0];$("sp-month").value=viewMonth;
 if(!days.has(selected))selected=start;const video=plan.filter(x=>x.format==="video").length,ads=plan.filter(x=>x.paid).length;
 $("sp-results").hidden=false;
 $("sp-stats").innerHTML='<div class="sp-stat"><strong>365</strong><small>Days with a primary post</small></div><div class="sp-stat"><strong>'+plan.length+'</strong><small>Content packages incl. peak extras</small></div><div class="sp-stat"><strong>'+Math.round(100*video/plan.length)+'%</strong><small>Video content (target ~67%)</small></div><div class="sp-stat"><strong>'+ads+'</strong><small>Paid candidates; $0 authorised</small></div>';
 render();
}
const matches=p=>{
 const category=$("sp-cat").value,channel=$("sp-channel").value,paid=$("sp-paid").value;
 return (category==="all"||categories[p.cat].id===category)&&(channel==="all"||p.channels.includes(channel))&&(paid==="all"||(paid==="paid"?p.paid:!p.paid));
};
function postsOn(date){return plan.filter(p=>(edits[p.id]?.date||p.date)===date)}
function effectivePost(p){const ov=edits[p.id]||{},fmt=ov.format||p.format;let channels=channelFormats[fmt].filter(ch=>strategy.channels.includes(ch));if(fmt==="video"&&strategy.channels.includes("youtube")&&p.channels.includes("youtube-standard"))channels.push("youtube-standard");if(strategy.channels.includes("noticeboard")&&p.channels.includes("noticeboard")&&!channels.includes("noticeboard"))channels.push("noticeboard");return {...p,format:fmt,channels}}
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
 $("sp-grid").innerHTML=out;$("sp-month-count").textContent=monthItems+" matching ideas this month";renderDetail();
}
function renderDetail(){
 const row=days.get(selected),host=$("sp-detail");if(!row){host.innerHTML="<h3>Choose a date</h3>";return}
 const match=postsOn(selected).map(effectivePost).filter(matches),h=row.holiday,labels=[];
 if(h.q)labels.push("QLD holidays");if(h.n)labels.push(h.w?"NSW Western Division":"NSW holidays");if(weekday(selected)>=4)labels.push("Weekend lead-in / peak");
 let html='<h3>'+labelDate(selected)+'</h3><p class="sp-hint">'+$esc(labels.join(" · ")||"Normal seven-day schedule")+'</p><p class="sp-hint">'+match.length+" draft idea(s). Nothing gets published or paid for here.</p>";
 if(!match.length)html+='<p>No content matches these filters. Adjust the filters or choose another date.</p>';
 for(const p of match){
  const cat=categories[p.cat],override=edits[p.id]||{},status=override.status||"Idea",note=override.note||"",caption=override.caption||suggestedCaption(p),spec=platformText[p.format]+(p.channels.includes("noticeboard")?" Noticeboard adaptation (proposed): static 1920×1080 for TV; 1080×1920 portrait kiosk; responsive web notice with a QR code and expiry.":"");
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
 for(const original of plan){const p=effectivePost(original),ov=edits[p.id]||{};arr.push([ov.date||p.date,ov.time||p.time,categories[p.cat].name,ov.title||p.title,p.format,channelNames(p),platformText[p.format]+(p.channels.includes("noticeboard")?"; TV 1920×1080, kiosk 1080×1920; proposed only":""),p.page,p.group,p.paid?"Yes":"No","No",ov.status||"Idea",ov.caption||suggestedCaption(p),brief(p),ov.note||""].map(quoted).join(","))}
 const blob=new Blob(["\ufeff"+arr.join("\r\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sandy-sports-social-"+start+"-365-days.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function copyBrief(id){const original=plan.find(x=>x.id===id);if(!original)return;const p=effectivePost(original),ov=edits[id]||{},content=[(ov.date||p.date)+" "+(ov.time||p.time)+" AEST",ov.title||p.title,categories[p.cat].name,p.format,channelNames(p),platformText[p.format],ov.caption||suggestedCaption(p),brief(p),p.page,"Audience: "+p.group,p.paid?"Paid candidate: budget not set or approved":"Organic","Status: "+(ov.status||"Idea"),ov.note||""].join("\n\n");if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(content).catch(()=>window.prompt("Copy brief:",content))}else window.prompt("Copy brief:",content)}

$("sp-cat").innerHTML+='<option value="all" hidden>All</option>'+categories.map(c=>'<option value="'+c.id+'">'+$esc(c.emoji+" "+c.name)+'</option>').join("");$("sp-cat").querySelector('option[hidden]')?.remove();
startInput.value=start;startInput.addEventListener("change",()=>{if(!startInput.value)return;start=startInput.value;viewMonth=start.slice(0,7);selected=start;regenerate()});
$("sp-month").addEventListener("change",e=>{viewMonth=e.target.value;const available=Array.from(days.keys()).find(x=>x.slice(0,7)===viewMonth);if(available)selected=available;render()});
["sp-cat","sp-channel","sp-paid"].forEach(id=>$(id).addEventListener("change",render));
$("sp-grid").addEventListener("click",e=>{const b=e.target.closest("[data-date]");if(b){selected=b.dataset.date;render()}});
$("sp-detail").addEventListener("change",e=>{if(e.target.classList.contains("sp-status")){const id=e.target.dataset.id;edits[id]=Object.assign({},edits[id]||{},{status:e.target.value});saveEdits()}});
$("sp-detail").addEventListener("click",e=>{
 const saveBtn=e.target.closest("[data-save]"),copyBtn=e.target.closest("[data-copy]");
 if(copyBtn)copyBrief(copyBtn.dataset.copy);
 if(saveBtn){const id=saveBtn.dataset.save,box=$("sp-detail").querySelector('textarea[data-id="'+id+'"]');edits[id]=Object.assign({},edits[id]||{},{note:box.value});const okay=saveEdits();saveBtn.textContent=okay?"Saved locally":"Export CSV to preserve edits";setTimeout(()=>{saveBtn.textContent="Save notes"},1400)}
});
$("sp-csv").addEventListener("click",exportCsv);
$("sp-reset").addEventListener("click",()=>{if(window.confirm("Clear saved statuses and notes for this 365-day plan in this browser? This cannot be undone unless you have exported them.")){localStorage.removeItem(storageKey());edits={};renderDetail()}});
regenerate();
})();