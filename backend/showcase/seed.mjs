// Generate a NEW synthetic fixture SQL file. Never run it against the live database.
import {readFileSync} from 'node:fs';
import {createHash,createCipheriv,randomBytes} from 'node:crypto';
import {FIXTURE_LIBRARY_KEY} from '../../worker/library.mjs';
import {pathToFileURL} from 'node:url';
import {SUITE_DESKS} from '../../studio/sandy-suite-spec.js';
import {defaultCampaignSettings} from '../../studio/social-campaign-engine.js';
import {fixtureId} from '../../worker/view-mode.mjs';
import {STAFF} from '../../worker/shared.mjs';
const stamp='2026-11-25T00:00:00.000Z',date='2026-12-12';
const quote=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replace(/'/g,"''")+"'";
const insert=(table,fields)=>'INSERT INTO '+table+'('+Object.keys(fields).join(',')+') VALUES('+Object.values(fields).map(quote).join(',')+');';
const explicit={
 "notices": {
  "title": "Point Lookout portable beach setup checklist",
  "subject": "Summer beach pilot: Cylinder and Home Beach, locals and visitors",
  "message": "Prepare for the eight-week Straddie summer campaign, 5 December 2026 to 29 January 2027 (illustrative planning window). Cylinder Beach and Home Beach serve residents and tourists; Adder Rock and Flinders Beach are additional camper-focused options. Assess available sand, tides, crowds, weather and permissions. Founder reports erosion at Amity and limited sand at Main Beach. No site booked.",
  "responseOwner": "Example Secretary",
  "responses": "Keep permanent facility options in all three townships separate from temporary summer activations.",
  "dueDate": "2026-12-04"
 },
 "todos": {
  "title": "Founder-funded starter equipment planning",
  "action": "Obtain AUD prices for two portable net kits, a battery-powered speaker and fundraising supplies",
  "owner": "Example equipment coordinator",
  "linkedDesk": "Portable beach pilot and bracelet fundraiser",
  "progress": "Prioritise equipment quotes, permissions and fundraising arrangements before the summer visitor peak. Founder is considering personal expenditure; existing pop-up tent proposed for reuse. No purchases or reimbursements recorded.",
  "dueDate": "2026-12-04"
 },
 "news": {
  "title": "Straddie sport and screen community update",
  "headline": "Straddie summer 2026-27: sport, skills and community",
  "lead": "A fictional newsletter exploring Sandy Sports activities across Dunwich / Goompi, Amity Point / Pulan and Point Lookout / Mulumba.",
  "articles": "Cylinder and Home Beach: locals and tourists\nAdder Rock and Flinders Beach: camper outreach\nEight-week summer portable sports and bracelet fundraising campaign\nPermanent facility possibilities in all three towns",
  "eventRoundup": "Illustrative 5 December to 29 January planning window; Queensland state school holidays run 12 December to 26 January. Dates and beach suitability remain subject to permissions and conditions.",
  "editor": "Example Secretary",
  "reviewNotes": "Check permissions, local terminology and Queensland dates before any distribution.",
  "editionMonth": "2026-12"
 },
 "handover": {
  "title": "Island equipment and committee handover",
  "office": "Example Secretary",
  "from": "Example outgoing officer",
  "to": "Example incoming officer",
  "duties": "Prepare working meeting agendas\nMaintain draft minutes\nCoordinate across the three island townships",
  "openTasks": "Review ferry logistics\nCheck venue permissions",
  "handoverNotes": "Fictional handover; no actual appointment or transfer."
 },
 "meetings": {
  "title": "Summer launch preparation in Dunwich",
  "meetingType": "Working group",
  "startTime": "09:00",
  "endTime": "10:00",
  "location": "Dunwich / Goompi, proposed meeting venue not booked",
  "chair": "Example President",
  "minuteTaker": "Example Secretary",
  "attendees": "Example President\nExample Secretary\nExample Treasurer",
  "quorum": "Not a formal meeting; no quorum or motion certified",
  "agenda": "Prepare for the eight-week summer visitor campaign (5 December to 29 January)\nAssess Cylinder Beach and Home Beach for residents and tourists\nConsider Adder Rock and Flinders Beach for camper-focused outreach\nTwo prospective personally funded net kits, existing pop-up tent, prospective battery-powered speaker\nBracelet fundraising: indicative AUD 0.50 unit cost, AUD 10 minimum selling price, no upper limit on voluntary additional support\nSeparate permanent facility possibilities in all three towns\nSite permissions, insurance, music licensing and fundraising arrangements",
  "draftMinutes": "Fictional preparation meeting based on founder's summer concept, not a held meeting. Prioritise December 2026 and January 2027, not February. Amity beach erosion and limited Main Beach sand make those unsuitable as assumed temporary courts. No purchase, sale, booking or motion adopted.",
  "decisions": "Proposal only: assess suitable beach locations and obtain equipment quotes; determine lawful fundraising arrangements before trading.",
  "followUps": "Check net stock | Example Treasurer | 2026-12-04",
  "openingNotes": "Respect Quandamooka Country; seek appropriate permissions for activities and cultural content.",
  "date": "2026-12-02"
 },
 "agm": {
  "title": "Future AGM planning in Dunwich",
  "venue": "Dunwich / Goompi, venue to be confirmed",
  "notices": "Draft notice under eventual adopted rules\nCheck nomination timetable",
  "officerRoles": "Example President\nExample Secretary\nExample Treasurer",
  "agendaItems": "Future activity report\nFinancial reporting in AUD\nCommittee nominations",
  "nominations": "No real nominations received",
  "finance": "Prepare draft reporting template; no actual financial statements.",
  "agmDate": "2027-03-13",
  "noticeDue": "2027-02-20"
 },
 "documents": {
  "title": "Minjerribah equipment and venue procedure",
  "documentType": "Draft procedure",
  "visibility": "Committee only",
  "custodian": "Example Secretary",
  "versionLabel": "Example v1",
  "summary": "Sample register for beach courts, transport, shade and accessible island venues. No private source document."
 },
 "automations": {
  "title": "Straddie future member welcome reminder",
  "process": "Membership welcome",
  "trigger": "After future lawful enrolment and verified contact consent",
  "delivery": "None - internal",
  "message": "Welcome to Sandy Sports on Minjerribah. Choose island activities and preferred townships. Check transport and weather before travelling.",
  "responsible": "Example Secretary",
  "consentRequired": true,
  "authorityRequired": true
 },
 "ready-setco": {
  "title": "Proposed island event logistics collaboration",
  "request": "Explore volunteer and equipment logistics for three-town Sandy activities",
  "service": "Volunteer coordination",
  "sandyOwner": "Example Secretary",
  "partnerContact": "Ready SET Co-op, proposed contact only",
  "scope": "Explore temporary equipment and volunteer logistics for suitable Point Lookout and camper beaches, plus separate permanent site options in all three towns. No agreement, cost or authority assumed.",
  "estimatedCost": 0,
  "conditions": "Written permission and defined volunteer roles\nQueensland safety requirements\nSeparate approval of AUD expenses and C-Hours",
  "writtenAcceptance": "None received; fictional proposal only."
 },
 "events": {
  "title": "Summer Cylinder Beach and Home Beach portable volleyball pilot",
  "activity": "Mixed beach volleyball",
  "town": "Point Lookout / Mulumba",
  "site": "Cylinder Beach or Home Beach, Point Lookout / Mulumba, for locals and tourists. Additional Adder Rock or Flinders Beach camper-focused sessions. Check available sand, tide, access and permission. Illustrative dates only; no reservation.",
  "startTime": "09:00",
  "endTime": "10:30",
  "programme": "Eight-week summer planning window: 5 December to 29 January\nCheck conditions and permissions\nSet up two proposed portable nets and existing pop-up tent if permitted\nBeginner drills and mixed social teams for locals and tourists\nMusic and bracelet fundraiser only if authorised\nPack down and leave beach tidy",
  "volunteers": "Example facilitator | Fictional role | 08:30",
  "equipment": "Two portable net kits (proposed founder purchase)\nVolleyballs\nExisting founder pop-up tent (proposed use)\nBattery-powered speaker (proposed purchase)\nWater, first aid kit and appropriate tent anchoring",
  "risk": "Check tides, heat, lightning, erosion, dunes, wildlife, other beach users, tent wind limits and emergency access. No Amity beach setup; Main Beach has limited sand according to founder. No site confirmed.",
  "debrief": "Record hypothetical participant feedback, suitable sand space, equipment costs and interest in future permanent facilities.",
  "eventDate": "2026-12-12"
 },
 "fundraising": {
  "title": "Summer local and tourist bracelet fundraising pilot",
  "method": "Donation appeal",
  "cashCustodian": "Example finance custodian (not appointed)",
  "income": 0,
  "cost": 0,
  "receiptRefs": "No actual transactions or expenses. Proposed product: bracelets costing about AUD 0.50 each, selling price at least AUD 10, with voluntary larger contributions and no upper limit. Record sales separately from additional voluntary contributions and expenses.",
  "outstanding": "Use existing founder pop-up tent if permitted. Proposed battery speaker, two net kits and small merchandise supplies funded personally by founder. Check permission to trade/fundraise, music licensing, cash/receipt controls and appropriate legal arrangements before selling. Disclose purpose and destination of funds. No charitable status or tax deductibility assumed. Prioritise December/January visitor period and keep simple daily stock, gross receipts and expenses records.",
  "date": "2026-12-12"
 },
 "equipment": {
  "title": "Two portable net kits and pop-up event setup",
  "assetType": "Sport net / court",
  "tag": "STRADDIE-EXAMPLE-NET-KITS",
  "location": "Founder storage (location not recorded); proposed portable summer setup at suitable Cylinder/Home Beach sites and Adder Rock/Flinders Beach camper areas",
  "quantity": 2,
  "holder": "Founder, proposed personal ownership; no transfer",
  "condition": "Proposed",
  "maintenance": "Two net kits not yet purchased. Existing pop-up tent proposed for shade subject to wind-safe anchoring and permission. Battery-powered speaker and fundraising supplies proposed. Record actual ownership, condition and costs separately."
 },
 "sponsors": {
  "title": "Hypothetical Straddie equipment supporter",
  "organisation": "Fictional island small-business supporter",
  "contact": "No real contact",
  "offerType": "Equipment",
  "offer": "Example offer of shade or equipment transport; not received from a real business.",
  "recognition": "Only discuss acknowledgement after permission.",
  "channel": "No actual contact details"
 },
 "grants": {
  "title": "Queensland community sport equipment funding scenario",
  "funder": "Fictional Queensland community sport funding round",
  "scheme": "Illustrative portable sports equipment proposal",
  "amount": 1000,
  "eligibility": "Not assessed",
  "applicant": "Future eligible Sandy entity, not established",
  "case": "AUD 1,000 illustrative funding scenario for two portable net kits, safe beach setup, accessibility and future three-town facility planning. Founder may initially self-fund equipment; no grant identified or awarded.",
  "officer": "Example Treasurer",
  "attachments": "Indicative AUD supplier quotes\nVenue permission\nEligibility and insurance review",
  "submission": "No actual grant identified, submitted or awarded."
 },
 "leaderboard": {
  "title": "Point Lookout mixed beach volleyball scoring example",
  "format": "Mixed beach volleyball practice",
  "results": "Fictional Team Sand 21 | Fictional Team Shore 17",
  "rules": "Illustrative friendly scoring; no official competition result.",
  "prizes": "Proposed reusable drink bottles only; no donor committed"
 },
 "stock": {
  "title": "Bracelet fundraiser stock and unit economics example",
  "sku": "STRADDIE-EXAMPLE-BRACELET",
  "category": "Event goods",
  "opening": 100,
  "inward": 0,
  "outward": 0,
  "price": 10,
  "unitCost": 0.5,
  "supplier": "Supplier to be selected; indicative price from founder",
  "stocktake": "Fictional scenario only: 100 bracelets at AUD 0.50 = AUD 50 stock cost. Minimum AUD 10 selling price each, voluntary higher payment with no maximum. At 100 minimum-price sales, gross receipts AUD 1,000 and AUD 950 before other expenses. No actual stock, sale, payment or donation."
 },
 "safety": {
  "title": "Queensland junior participation and beach safety planning",
  "policy": "Guardian consent process",
  "responsible": "Example safeguarding officer",
  "requirements": "Review Queensland Blue Card requirements where applicable, guardian authority, sun protection, heat and tide plans, emergency access and culturally appropriate site permissions. No child or case details.",
  "reviewed": false
 },
 "applications": {
  "title": "Amity Point founding interest example",
  "applicationKind": "Founding member interest",
  "reference": "STRADDIE-FICTIONAL-001",
  "reviewer": "Example Secretary",
  "checks": "Contact consent not assumed\nMembership not approved\nCheck proposed class and safety prerequisites",
  "decisionNotes": "Fictional interest in mixed beach volleyball and community cinema; no application lodged."
 },
 "returning": {
  "title": "Future island supporter follow-up scenario",
  "path": "Founding supporter follow-up",
  "memberRef": "STRADDIE-FICTIONAL-001",
  "terms": "No actual membership history. Ask permission before future contact.",
  "assigned": "Example Secretary"
 },
 "member-packs": {
  "title": "Minjerribah welcome pack example",
  "packName": "Sandy Sports island welcome pack (draft)",
  "contents": "Township activity guide\nTransport and access information\nWorking constitution and code of conduct\nWeather and tide checks",
  "welcome": "Welcome to Sandy Sports on Straddie. Explore inclusive sport and community film in the three island towns.",
  "sports": "Mixed beach volleyball\nBeach cricket\nAirBadminton\nCommunity film",
  "safeguards": "Verify age and guardian permissions; separate media consent.",
  "officer": "Example Secretary"
 },
 "member-types": {
  "title": "Island adult membership class proposal",
  "className": "Proposed adult community sport membership",
  "eligibility": "Future adult applicants, subject to adopted rules",
  "proposedFee": 0,
  "rights": "Illustrative discussion of access and voting rights. No fee set or membership approved."
 },
 "member-notice": {
  "title": "Straddie weekend practice draft notice",
  "subject": "Proposed Straddie summer beach sports pilot",
  "body": "Cylinder Beach and Home Beach are options for residents and tourists over the summer school holiday period. Adder Rock and Flinders Beach may suit camper-focused sessions. Eight-week planning window 5 December to 29 January; all dates, permissions and conditions remain provisional. Permanent sites in all three towns are a separate project.",
  "delivery": "Not sent; future opt-in audience only.",
  "proposedSend": "2026-12-04"
 },
 "birthday": {
  "title": "Future island birthday activity offer",
  "offer": "Illustrative birthday invitation to a social sport session",
  "eligibility": "Future consenting adult members only, subject to policy",
  "value": "No monetary voucher or actual offer; no date of birth collected.",
  "approvalNotes": "Review privacy before any proposal is adopted."
 },
 "email-queue": {
  "title": "Dunwich volunteer briefing email draft",
  "subject": "Draft only: Dunwich equipment and volunteer briefing",
  "recipientGroup": "Future consented volunteers, no addresses",
  "body": "Keen to help with proposed island sport and film activities? This fictional briefing covers safe equipment setup, shade, accessibility and pack-down. Nothing is confirmed.",
  "responsible": "Example Secretary",
  "deliveryLog": "Not sent. No actual recipients."
 },
 "sport-programme": {
  "title": "Summer Point Lookout beach cricket skills proposal",
  "sport": "Beach cricket",
  "location": "Cylinder Beach or Home Beach for local residents and tourists, or Adder Rock and Flinders Beach for camper outreach; only suitable available sand and permitted sites",
  "coach": "Example facilitator",
  "capacity": 12,
  "needs": "Soft balls, portable stumps, shade, accessible approach and water. Avoid crowded areas, dunes and limited-sand sites.",
  "weatherPlan": "Check Bureau of Meteorology forecast, lightning, heat, tides and beach conditions; cancel or reschedule if unsafe.",
  "date": "2026-12-19"
 },
 "venues": {
  "title": "Three-town permanent sports and screen facility options",
  "town": "Multi-town / TBD",
  "site": "Separate permanent site possibilities in Dunwich / Goompi, Amity Point / Pulan and Point Lookout / Mulumba. Use summer pilot feedback to inform planning. No site, lease or booking established.",
  "assets": "Potential permanent courts\nOutdoor screen and community space\nShade and accessible amenities\nSeparate temporary portable net activities at suitable Point Lookout and camper beaches",
  "contact": "No confirmed venue or contact",
  "permissions": "Separate permanent tenure, planning, site suitability and cultural permissions from temporary beach use. Founder reports eroded Amity beach and limited Main Beach sand; no assumed temporary beach site there.",
  "date": "2027-01-29"
 },
 "volunteers": {
  "title": "Summer beach pilot equipment and fundraising roster",
  "event": "Point Lookout / Mulumba proposed portable volleyball pilot",
  "role": "Equipment setup and shade assistant",
  "person": "Example volunteer role, unassigned",
  "training": "Safe lifting\nSand anchors and net setup\nTent wind-safe setup\nSun safety\nAppropriate music volume and permissions\nFundraising recordkeeping\nPack-down and litter check",
  "followUp": "No actual volunteer has agreed. Confirm suitable beach conditions, site permissions and appropriate roles.",
  "date": "2026-12-12"
 },
 "film": {
  "title": "Dunwich community cinema planning",
  "type": "Cinema screening",
  "filmTitle": "Minjerribah community stories (fictional programme concept)",
  "location": "Dunwich / Goompi, proposed outdoor screen site",
  "programme": "Welcome\nIllustrative local short-film programme\nDiscussion and pack down",
  "crew": "Example projection role | Fictional | 17:30",
  "equipment": "Portable screen\nProjector\nPA and microphones\nSafe power and shade",
  "rights": "No screening licence or cultural/appearance permissions assumed. Seek written approval before use.",
  "date": "2027-01-09"
 },
 "connections": {
  "title": "Straddie Noticeboard Network integration proposal",
  "service": "Straddie Noticeboards",
  "responsible": "Example Webmaster",
  "purpose": "Explore a reviewed event announcement handover between Sandy Sports and Straddie Noticeboard Network.",
  "data": "Only future authorised public notices; no member directory, contact details or private records.",
  "approval": "Proposed connection only. No service enabled."
 }
};
const defaults=f=>f.type==='checkbox'?false:f.type==='number'?0:f.type==='select'?f.options[0]:f.type==='date'?date:f.type==='month'?'2026-12':f.type==='time'?(f.key.toLowerCase().includes('end')||f.key.toLowerCase().includes('finish')?'10:30':'09:00'):f.type==='url'?'':f.required?'Example '+f.label.toLowerCase():'';
export function showcaseSql(){
 // Fail at the first existing table. No DROP, DELETE, session, invite or credential data.
 const schema=readFileSync(new URL('../migrations/0001_club.sql',import.meta.url),'utf8').replaceAll('CREATE TABLE IF NOT EXISTS','CREATE TABLE');
 const librarySchema=readFileSync(new URL('../migrations/0002_private_library.sql',import.meta.url),'utf8').replaceAll('CREATE TABLE IF NOT EXISTS','CREATE TABLE');
 const out=[schema,librarySchema],owner=fixtureId(1);
 let sequence=100;
 const next=()=>fixtureId(sequence++);
 const record=(kind,title,body,eventDate=null,actor=owner,role='webmaster')=>{
  const id=next();
  out.push(insert('club_records',{id,kind,title:'[EXAMPLE] '+title,body_json:JSON.stringify(body),status:'draft',event_date:eventDate,created_by:actor,updated_by:actor,created_utc:stamp,updated_utc:stamp}));
  out.push(insert('club_revisions',{id:next(),resource_kind:'record',resource_id:id,resource_version:1,operation:'synthetic_fixture',actor_id:actor,actor_role:role,actor_office:'Example '+role,at_utc:stamp,snapshot_json:JSON.stringify(body)}));
  out.push(insert('club_audit',{id:next(),actor_id:actor,actor_role:role,action:'synthetic_fixture',resource_kind:'record',resource_id:id,occurred_utc:stamp}));
 };
 STAFF.forEach((role,i)=>out.push(insert('club_accounts',{id:fixtureId(i+1),username:'example-'+role,role,office_label:'Example '+role.replace(/_/g,' '),display_name:'Fictional '+role.replace(/_/g,' '),state:'reserved',created_utc:stamp})));
 out.push(insert('club_people',{id:next(),full_name:'Illustrative demo member',membership_class:'other',status:'interested',town:'Amity Point / Pulan, Minjerribah, QLD',notes:'Synthetic preview only. No account, enrolment or membership.',created_by:owner,updated_by:owner,created_utc:stamp,updated_utc:stamp}));
 for(const desk of SUITE_DESKS){
  if(!explicit[desk.key]?.title)throw Error('Missing Straddie fixture for '+desk.key);
  const fields=Object.fromEntries(desk.fields.map(f=>[f.key,explicit[desk.key]?.[f.key]??defaults(f)]));
  const eventDate=['date','eventDate','closingDate','dueDate','reviewDate','agmDate'].map(k=>fields[k]).find(v=>/^\d{4}-\d{2}-\d{2}$/.test(v||''))||null;
  record(desk.kind,explicit[desk.key].title,{sandySuiteVersion:1,domain:desk.key,fields},eventDate);
 }
 record('social_idea','Cylinder Beach and Home Beach beginner volleyball tips',{category:'',channel:'undecided',notes:'Fictional Queensland summer coaching clip concept: suitable sand at Cylinder Beach or Home Beach, two proposed portable nets, shade, water, respectful music and safe pack-down. No recording or publication.',authorNote:'Example officer'});
 record('governance','Constitution working draft',{source:'sandy-constitution-builder',fields:{name:'Sandy Sports Club (example draft)',additional:'Fictional Sandy Sports Club working notes for Minjerribah, Queensland, across Dunwich / Goompi, Amity Point / Pulan and Point Lookout / Mulumba. No adopted rules.'},markdown:'Example Queensland club constitution draft for Sandy Sports on Minjerribah. No adopted rules.'});
 STAFF.forEach((role,i)=>record('notice','Help with Straddie activity calendar',{sandyWebmasterRequest:1,category:'Committee workflow',message:'Fictional support request for '+role+': check the Brisbane-time calendar, island venues and consent controls.',readAt:null,reply:''},null,fixtureId(i+1),role));
 out.push(insert('club_interest',{id:next(),created_utc:stamp,first_name:'Example',town:'Point Lookout / Mulumba, QLD',interests_json:JSON.stringify(['Sport and film']),comments:'Fictional Point Lookout interest in beach cricket and a community film night. No contact or consent.',contact_consent:0,source:'synthetic fixture'}));
 const summer=defaultCampaignSettings();
 summer.timingSignals.holidays.enabled=true;
 summer.timingSignals.holidays.leadDays=[14,7,3,1];
 for(const layer of ['volleyball','other','vision','holidays'])if(summer.layers[layer])summer.layers[layer].enabled=true;
 // Synthetic editorial planning, never confirmed club events or scheduled publication.
 const weeks=[
 ['2026-12-05','Preparation and equipment','Compare two portable net kits, existing pop-up tent, proposed battery speaker and fundraising stock. Check beach suitability and permissions.'],
 ['2026-12-12','School holiday opening','Cylinder Beach and Home Beach are options for locals and tourists. Check space, conditions and permissions before any pilot.'],
 ['2026-12-19','Visitor and camper outreach','Explore Adder Rock and Flinders Beach camper audiences, alongside Point Lookout residents and tourists.'],
 ['2026-12-26','Christmas and New Year visitor period','Consider safe, respectful beach activities and bracelet fundraising only where authorised; avoid crowding and sensitive areas.'],
 ['2027-01-02','Summer social sport','Consider volleyball and other portable net games with safe setup and welcoming local and tourist participation.'],
 ['2027-01-09','Community and visitor engagement','Review possible camper-focused activity and community cinema concepts; no screening or booking assumed.'],
 ['2027-01-16','Fundraising and participation review','Review hypothetical stock, expenses, voluntary extra contributions and feedback; no actual payments or appointments.'],
 ['2027-01-23','Summer closing review','Gather hypothetical pilot lessons and distinguish temporary beach sessions from permanent facility options in each township.']
 ];
 for(const [day,title,brief] of weeks)summer.dayPlans[day]={patternId:'example-summer-weekly',items:[{id:'summer-plan',layerId:'volleyball',format:'image',time:'08:00',title:'[EXAMPLE] '+title,brief:'Draft editorial idea. '+brief},{id:'summer-community',layerId:'vision',format:'image',time:'17:15',title:'[EXAMPLE] Sandy Sports summer community update',brief:'Draft only. Communicate actual verified progress; no promises or publishing without authorisation.'}]};
 out.push(insert('studio_settings',{id:1,version:1,settings_json:JSON.stringify(summer),updated_by:owner,updated_utc:stamp}));
 out.push(insert('studio_briefs',{id:next(),title:'[EXAMPLE] Straddie summer beach skills and fundraiser video brief',date,brief:'Fictional December/January campaign: Cylinder and Home Beach for locals and tourists, Adder Rock and Flinders Beach for campers, two proposed portable nets, tent, speaker and bracelet fundraising. Show safe setup and leave-no-trace pack-down only after permissions. No commission, film or publication.',created_by:owner,updated_by:owner,created_utc:stamp,updated_utc:stamp}));
 // Harmless single-pixel PNG. The fixture key is never accepted for live files.
 const sample=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=','base64');
 const key=createHash('sha256').update('sandy-library-v1/content/'+FIXTURE_LIBRARY_KEY).digest();
 for(const [scope,roles] of [['governance',['webmaster','president','secretary','assistant_secretary']],['finance',['webmaster','treasurer']],['safety',['webmaster','president','secretary']]]){
  const doc=next(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('sandy-library-v1/'+doc+'/1/0'));
  const ciphertext=Buffer.concat([cipher.update(sample),cipher.final(),cipher.getAuthTag()]);
  out.push(insert('sandy_library_documents',{id:doc,owner_id:owner,title:'[EXAMPLE] '+scope+' private image',scope,roles_json:JSON.stringify(roles),state:'private',version:1,content_version:1,review_date:date,created_utc:stamp,updated_utc:stamp,updated_by:owner}));
  out.push(insert('sandy_library_versions',{document_id:doc,content_version:1,media_type:'image/png',byte_length:sample.length,digest:createHash('sha256').update(sample).digest('hex'),part_count:1,source_note:'Synthetic fixture image only',created_by:owner,created_utc:stamp}));
  out.push(insert('sandy_library_parts',{document_id:doc,content_version:1,part:0,iv:iv.toString('base64'),ciphertext:ciphertext.toString('base64')}));
  out.push(insert('club_revisions',{id:next(),resource_kind:'library',resource_id:doc,resource_version:1,operation:'synthetic_fixture',actor_id:owner,actor_role:'webmaster',actor_office:'Example Webmaster',at_utc:stamp,snapshot_json:JSON.stringify({title:'[EXAMPLE] '+scope+' private image',scope,contentVersion:1})}));
 }
 out.push("CREATE TABLE sandy_showcase_marker(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,classification TEXT NOT NULL);");
 out.push(insert('sandy_showcase_marker',{id:1,version:1,classification:'SANDY_SYNTHETIC_ONLY'}));
 return out.join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(showcaseSql());
