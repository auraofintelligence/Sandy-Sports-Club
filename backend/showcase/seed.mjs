// Generate a NEW synthetic fixture SQL file. Never run it against the live database.
import {readFileSync} from 'node:fs';
import {createHash,createCipheriv,randomBytes} from 'node:crypto';
import {FIXTURE_LIBRARY_KEY} from '../../worker/library.mjs';
import {pathToFileURL} from 'node:url';
import {SUITE_DESKS} from '../../studio/sandy-suite-spec.js';
import {defaultCampaignSettings} from '../../studio/social-campaign-engine.js';
import {fixtureId} from '../../worker/view-mode.mjs';
import {STAFF} from '../../worker/shared.mjs';
const stamp='2026-11-25T00:00:00.000Z',date='2027-02-13';
const quote=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replace(/'/g,"''")+"'";
const insert=(table,fields)=>'INSERT INTO '+table+'('+Object.keys(fields).join(',')+') VALUES('+Object.values(fields).map(quote).join(',')+');';
const explicit={
 "notices": {
  "title": "Amity Point equipment and shade checklist",
  "subject": "Amity Point / Pulan practice preparation",
  "message": "Review portable nets, shade, drinking water and access before proposing a Saturday practice. Check the weather, tides and site permission. No booking made.",
  "responseOwner": "Example Secretary",
  "responses": "Discuss equipment transport between Amity Point and Dunwich."
 },
 "todos": {
  "title": "Dunwich equipment transport plan",
  "action": "Compare vehicle ferry and island equipment transport options",
  "owner": "Example Treasurer",
  "linkedDesk": "Dunwich / Goompi sports equipment planning",
  "progress": "Obtain indicative AUD quotes; nothing purchased or booked."
 },
 "news": {
  "title": "Straddie sport and screen community update",
  "headline": "Around Minjerribah: sport, skills and community cinema",
  "lead": "A fictional newsletter exploring Sandy Sports activities across Dunwich / Goompi, Amity Point / Pulan and Point Lookout / Mulumba.",
  "articles": "Beach volleyball beginner sessions\nIsland transport and access\nCommunity film nights and volunteer skills",
  "eventRoundup": "Proposed beach games and family-friendly screen activities, subject to approvals.",
  "editor": "Example Secretary",
  "reviewNotes": "Check permissions, local terminology and Queensland dates before any distribution."
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
  "title": "Dunwich founding working-group discussion",
  "meetingType": "Working group",
  "startTime": "09:00",
  "endTime": "10:00",
  "location": "Dunwich / Goompi, proposed meeting venue not booked",
  "chair": "Example President",
  "minuteTaker": "Example Secretary",
  "attendees": "Example President\nExample Secretary\nExample Treasurer",
  "quorum": "Not a formal meeting; no quorum or motion certified",
  "agenda": "Portable beach sport equipment\nAccess for Amity Point and Point Lookout participants\nFerry and bus logistics\nSite permissions and Queensland safeguarding",
  "draftMinutes": "Fictional discussion of a three-town programme. No motion adopted.",
  "decisions": "Proposal only: investigate accessible venues and equipment costs",
  "followUps": "Check net stock | Example Treasurer | 2027-02-20",
  "openingNotes": "Respect Quandamooka Country; seek appropriate permissions for activities and cultural content."
 },
 "agm": {
  "title": "Future AGM planning in Dunwich",
  "venue": "Dunwich / Goompi, venue to be confirmed",
  "notices": "Draft notice under eventual adopted rules\nCheck nomination timetable",
  "officerRoles": "Example President\nExample Secretary\nExample Treasurer",
  "agendaItems": "Future activity report\nFinancial reporting in AUD\nCommittee nominations",
  "nominations": "No real nominations received",
  "finance": "Prepare draft reporting template; no actual financial statements."
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
  "scope": "Investigate moving nets and portable screen equipment between Dunwich, Amity Point and Point Lookout. No partnership agreement.",
  "estimatedCost": 180,
  "conditions": "Written permission and defined volunteer roles\nQueensland safety requirements\nSeparate approval of AUD expenses and C-Hours",
  "writtenAcceptance": "None received; fictional proposal only."
 },
 "events": {
  "title": "Amity Point beach volleyball practice proposal",
  "activity": "Mixed beach volleyball",
  "town": "Amity Point / Pulan",
  "site": "Amity Point / Pulan, suitable sand area to be assessed; no reservation",
  "startTime": "09:00",
  "endTime": "10:30",
  "programme": "Warm-up and mobility\nBeginner passing drills\nMixed teams\nPack down and leave beach tidy",
  "volunteers": "Example facilitator | Fictional role | 08:30",
  "equipment": "Portable net\nVolleyballs\nShade and water\nFirst aid kit",
  "risk": "Check tide, heat, lightning, shorebird and site restrictions; accessible arrival and emergency arrangements.",
  "debrief": "Record hypothetical equipment and access improvements."
 },
 "fundraising": {
  "title": "Dunwich community BBQ proposal",
  "method": "BBQ or market stall",
  "cashCustodian": "Example Treasurer",
  "income": 0,
  "cost": 0,
  "receiptRefs": "No receipts, purchases or payments. Illustrative budget discussion only.",
  "outstanding": "Explore food-handling, site permissions and waste arrangements; AUD costs to be assessed."
 },
 "equipment": {
  "title": "Portable beach net for island sessions",
  "assetType": "Sport net / court",
  "tag": "STRADDIE-EXAMPLE-NET-01",
  "location": "Dunwich / Goompi, proposed storage only",
  "quantity": 1,
  "holder": "Example custodian",
  "condition": "Proposed",
  "maintenance": "Check sand anchors, net tension and condition before any Amity or Point Lookout use."
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
  "case": "AUD 1,000 sample request for portable nets, accessibility and heat protection on Minjerribah.",
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
  "title": "Straddie portable volleyball net stock example",
  "sku": "STRADDIE-EXAMPLE-NET",
  "category": "Sports gear",
  "opening": 4,
  "inward": 2,
  "outward": 1,
  "price": 0,
  "unitCost": 25,
  "supplier": "Fictional Queensland equipment supplier",
  "stocktake": "Five sample units; AUD 25 illustrative unit cost, not actual inventory or sale."
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
  "subject": "Proposed Minjerribah weekend activity",
  "body": "A beginner-friendly beach sports session is being explored for Amity Point / Pulan. Check site permissions, weather and island transport before sharing confirmed details.",
  "delivery": "Not sent; future opt-in audience only."
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
  "title": "Point Lookout beginner beach cricket session",
  "sport": "Beach cricket",
  "location": "Point Lookout / Mulumba, suitable area subject to permission",
  "coach": "Example facilitator",
  "capacity": 12,
  "needs": "Soft balls, portable stumps, shade, accessible approach and water",
  "weatherPlan": "Check Bureau of Meteorology forecast, lightning, heat, tides and beach conditions; cancel or reschedule if unsafe."
 },
 "venues": {
  "title": "Dunwich sports and outdoor screen venue proposal",
  "town": "Dunwich / Goompi",
  "site": "Proposed community space; actual landholder permission required",
  "assets": "Portable court\nOutdoor screen\nProjector and audio\nShade and accessible amenities",
  "contact": "No confirmed venue or contact",
  "permissions": "Check council/landholder requirements, cultural permissions, public liability, electrical safety and transport."
 },
 "volunteers": {
  "title": "Amity Point beach activity setup roster",
  "event": "Amity Point / Pulan proposed volleyball practice",
  "role": "Equipment setup and shade assistant",
  "person": "Example volunteer role, unassigned",
  "training": "Safe lifting\nSand anchors and net setup\nSun safety\nPack-down and litter check",
  "followUp": "No actual volunteer has agreed. Confirm appropriate training and availability."
 },
 "film": {
  "title": "Dunwich community cinema planning",
  "type": "Cinema screening",
  "filmTitle": "Minjerribah community stories (fictional programme concept)",
  "location": "Dunwich / Goompi, proposed outdoor screen site",
  "programme": "Welcome\nIllustrative local short-film programme\nDiscussion and pack down",
  "crew": "Example projection role | Fictional | 17:30",
  "equipment": "Portable screen\nProjector\nPA and microphones\nSafe power and shade",
  "rights": "No screening licence or cultural/appearance permissions assumed. Seek written approval before use."
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
const defaults=f=>f.type==='checkbox'?false:f.type==='number'?0:f.type==='select'?f.options[0]:f.type==='date'?date:f.type==='month'?'2027-02':f.type==='time'?(f.key.toLowerCase().includes('end')||f.key.toLowerCase().includes('finish')?'10:30':'09:00'):f.type==='url'?'':f.required?'Example '+f.label.toLowerCase():'';
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
 record('social_idea','Amity Point beginner volleyball tips',{category:'',channel:'undecided',notes:'Fictional Queensland summer coaching clip: passing drills, shade, water and packing down on Straddie. No recording or publication.',authorNote:'Example officer'});
 record('governance','Constitution working draft',{source:'sandy-constitution-builder',fields:{name:'Sandy Sports Club (example draft)',additional:'Fictional Sandy Sports Club working notes for Minjerribah, Queensland, across Dunwich / Goompi, Amity Point / Pulan and Point Lookout / Mulumba. No adopted rules.'},markdown:'Example Queensland club constitution draft for Sandy Sports on Minjerribah. No adopted rules.'});
 STAFF.forEach((role,i)=>record('notice','Help with Straddie activity calendar',{sandyWebmasterRequest:1,category:'Committee workflow',message:'Fictional support request for '+role+': check the Brisbane-time calendar, island venues and consent controls.',readAt:null,reply:''},null,fixtureId(i+1),role));
 out.push(insert('club_interest',{id:next(),created_utc:stamp,first_name:'Example',town:'Point Lookout / Mulumba, QLD',interests_json:JSON.stringify(['Sport and film']),comments:'Fictional Point Lookout interest in beach cricket and a community film night. No contact or consent.',contact_consent:0,source:'synthetic fixture'}));
 out.push(insert('studio_settings',{id:1,version:1,settings_json:JSON.stringify(defaultCampaignSettings()),updated_by:owner,updated_utc:stamp}));
 out.push(insert('studio_briefs',{id:next(),title:'[EXAMPLE] Straddie beach skills video brief',date,brief:'Fictional coaching clip on Minjerribah: Amity Point passing drills, heat and shade, island transport and leave-no-trace pack down. No film permissions, commission or publication.',created_by:owner,updated_by:owner,created_utc:stamp,updated_utc:stamp}));
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
