// Shared Sandy Sports workflow schema. Browser renders forms; Worker validates all saves independently.
// Sandy-specific adaptation of PLFC committee operations. No fishing operations, paid services or assumed appointments.
const txt=(key,label,step='Plan',required=false)=>({key,label,type:'text',step,required});
const notes=(key,label,step='Plan',required=false)=>({key,label,type:'textarea',step,required});
const day=(key,label,step='Plan')=>({key,label,type:'date',step});
const month=(key,label,step='Plan')=>({key,label,type:'month',step});
const time=(key,label,step='Plan')=>({key,label,type:'time',step});
const num=(key,label,step='Plan')=>({key,label,type:'number',step});
const url=(key,label,step='Evidence')=>({key,label,type:'url',step});
const check=(key,label,step='Review')=>({key,label,type:'checkbox',step});
const list=(key,label,step='Plan')=>({key,label,type:'lines',step});
const choice=(key,label,options,step='Plan')=>({key,label,type:'select',options,step});
const F=[
 {key:'notices',title:'Committee notices',kind:'notice',group:'Communications',purpose:'Draft internal committee notices, set review needs, and record who saw each item.',fields:[
 txt('subject','Notice subject','Prepare',true),choice('audience','Audience',['All proposed officers','President and secretary','Office holders','Project leads'],'Prepare'),
 notes('message','Notice text','Prepare',true),day('dueDate','Response due','Review'),txt('responseOwner','Officer to follow up','Review'),notes('responses','Responses and amendments','Review'),check('clearedForDiscussion','Ready for committee discussion','Review')]},
 {key:'todos',title:'Officer to-do lists',kind:'task',group:'Communications',purpose:'Assign practical actions, reminders and handovers without pretending people have accepted appointments.',fields:[
 txt('action','Action required','Action',true),txt('owner','Responsible proposed office/person','Action'),day('dueDate','Due date','Action'),
 choice('priority','Priority',['Normal','Important','Urgent'],'Action'),txt('linkedDesk','Related meeting, event or project','Follow-up'),notes('progress','Progress notes','Follow-up'),check('complete','Marked complete','Follow-up')]},
 {key:'news',title:'Newsletter desk',kind:'newsletter',group:'Communications',purpose:'Build a club newsletter issue, arrange articles and reviewer notes, export the draft; sending requires separate consent and authority.',fields:[
 month('editionMonth','Edition month','Edition'),txt('headline','Issue headline','Edition',true),
 choice('audience','Intended audience',['Prospective members','Officers','Supporters','All future members'],'Edition'),
 notes('lead','Opening editorial','Content'),list('articles','Article headlines and sections','Content'),notes('eventRoundup','Sport and event round-up','Content'),
 notes('acknowledgements','Contributor and sponsor acknowledgements','Content'),txt('editor','Editor / assembler','Review'),
 notes('reviewNotes','Review changes and sign-off requests','Review'),check('mediaRightsChecked','Media rights and consent reviewed','Review'),
 check('contactConsentChecked','Intended recipients consent checked','Review')]},
 {key:'handover',title:'Officer handover',kind:'governance',group:'Governance',purpose:'Record the outgoing office, incoming candidate, outstanding duties, documents and decisions without appointing anyone.',fields:[
 txt('office','Office or responsibility','Handover',true),txt('from','Current responsible person','Handover'),txt('to','Proposed new responsible person','Handover'),
 day('transferDate','Target handover date','Handover'),list('duties','Regular duties','Checklist'),list('openTasks','Outstanding tasks','Checklist'),
 list('resources','Document links and assets to transfer','Checklist'),notes('handoverNotes','Handover notes','Review'),check('recipientAcknowledged','Recipient has acknowledged responsibilities','Review')]},
 {key:'meetings',title:'Meetings and minutes',kind:'meeting',group:'Governance',purpose:'Create the meeting, assemble the agenda, record notes, review draft minutes, assign actions and export a calendar invitation.',fields:[
 choice('meetingType','Meeting type',['Management committee','Founding meeting','Annual general meeting','General meeting','Special meeting','Working group','Informal discussion'],'Schedule'),
 day('date','Meeting date','Schedule'),time('startTime','Start time (Brisbane)','Schedule'),time('endTime','End time (Brisbane)','Schedule'),
 txt('location','Venue / online link description','Schedule'),txt('chair','Chair / facilitator','Schedule'),txt('minuteTaker','Minute taker','Schedule'),
 list('attendees','Attendees and apologies','Attendance'),txt('quorum','Quorum requirement / observed attendance','Attendance'),
 list('agenda','Agenda items, one per line','Agenda'),notes('openingNotes','Opening and disclosures','Agenda'),
 notes('transcript','Typed or pasted notes or consented transcript','Capture'),notes('draftMinutes','Draft minutes','Review'),
 list('decisions','Proposed decisions, one per line','Review'),list('followUps','Action | owner | due date, one per line','Follow-up'),
 check('reviewedForPersonalData','Personal information removed from member-facing notes','Review'),
 check('reviewedBySecretary','Secretary reviewed draft wording','Review')]},
 {key:'agm',title:'AGM preparation',kind:'governance',group:'Governance',purpose:'Plan AGM statutory tasks, notices, reports, nominations and documents, subject to the eventual adopted rules.',fields:[
 day('agmDate','Proposed AGM date','Schedule'),txt('venue','Venue','Schedule'),list('notices','Notices to prepare','Planning'),
 list('officerRoles','AGM officers and presenters','Planning'),list('agendaItems','Annual reports and agenda','Planning'),
 list('nominations','Nomination and election preparations','Planning'),day('noticeDue','Notice deadline for review','Review'),
 notes('finance','Accounts and reporting notes','Review'),notes('minutes','Draft AGM proceedings','Follow-up')]},
 {key:'documents',title:'Club documents and register',kind:'governance',group:'Governance',purpose:'Index controlled documents, privacy classifications, version owners and external source locations. No private binary file upload is provided.',fields:[
 txt('documentType','Document type / classification','Register',true),choice('visibility','Access classification',['Committee only','Selected officers','Public proposal','Future members'],'Register'),
 txt('custodian','Responsible custodian','Register'),url('sourceUrl','Document location (HTTPS)','Register'),
 txt('versionLabel','Version / date label','Review'),day('reviewDate','Next review date','Review'),notes('summary','Summary and retention notes','Review')]},
 {key:'automations',title:'Membership automations',kind:'governance',group:'Governance',purpose:'Plan optional onboarding, renewals and reminders. No member messages or scheduled tasks are automatically dispatched.',fields:[
 choice('process','Proposed process',['Application acknowledgement','Membership welcome','Renewal reminder','Birthday greeting','Event notification','Consent refresh'],'Design'),
 notes('trigger','Intended trigger','Design'),choice('delivery','Proposed channel',['None - internal','Email (not connected)','Printed letter','Officer follow-up'],'Design'),
 notes('message','Draft template','Template'),txt('responsible','Officer responsible','Review'),
 check('consentRequired','Recipient-specific permission required','Review'),check('authorityRequired','Approval required before activation','Review')]},
 {key:'ready-setco',title:'Ready SETCO requests',kind:'partner',group:'Partnerships',purpose:'Propose and review work requests to Ready SET Co-op with roles, budgets and written acceptance kept separate.',fields:[
 txt('request','Requested service','Scope',true),choice('service','Service category',['Volunteer coordination','Paid work referral','Event delivery','Training','Equipment logistics','Media and notices','Other'],'Scope'),
 txt('sandyOwner','Sandy officer responsible','Scope'),txt('partnerContact','Proposed partner contact','Scope'),
 notes('scope','Specific deliverables and boundaries','Scope'),num('estimatedCost','Indicative cash budget (AUD), separate from C-Hours','Resources'),
 list('conditions','Permissions and safety prerequisites','Review'),check('consentChecked','Consent and data-sharing boundaries identified','Review'),
 notes('writtenAcceptance','Written agreement reference and status (if any)','Review')]},
 {key:'events',title:'Sport, film and community events',kind:'event',group:'Operations',purpose:'Plan programme, venue, volunteers, equipment, safety and debrief for a proposed Sandy activity.',fields:[
 choice('activity','Type of activation',['Mixed beach volleyball','Sand cricket','Flag football','Beach rugby','Beach football','Sand games','Wellbeing session','Film screening','Market and festival','Multi-sport','Other'],'Programme'),
 day('eventDate','Proposed date','Programme'),time('startTime','Start time (Brisbane)','Programme'),time('endTime','Finish time (Brisbane)','Programme'),
 choice('town','Island area',['Dunwich / Goompi','Amity Point / Pulan','Point Lookout / Mulumba','Multi-town / TBD'],'Programme'),
 txt('site','Site / venue and booking reference','Venue'),notes('programme','Session or event running order','Programme'),
 list('volunteers','Role | person | time for helpers','People'),list('equipment','Equipment, keys and staging','Venue'),
 notes('risk','Heat, weather, safeguarding, accessibility and emergency plan','Safety'),check('insuranceReviewed','Insurance requirements checked','Safety'),
 check('culturalPermissionReviewed','Cultural and site permissions reviewed','Safety'),notes('debrief','Tick, Flick & Debrief (what worked, receipts and outstanding actions)','Debrief')]},
 {key:'fundraising',title:'Fundraising and collections',kind:'fundraising',group:'Operations',purpose:'Plan an event fundraising activity and reconcile proposed income and costs without activating payments.',fields:[
 choice('method','Method',['BBQ or market stall','Donation appeal','Community raffle proposal','Sponsor contribution','Film fundraiser','Tournament fees (proposal)','Other'],'Plan'),
 day('date','Proposed date','Plan'),txt('cashCustodian','Proposed finance custodian','Plan'),
 num('income','Recorded income (AUD)','Reconciliation'),num('cost','Recorded costs (AUD)','Reconciliation'),
 notes('receiptRefs','Receipt and deposit references','Reconciliation'),check('twoPersonCount','Two-person cash count noted where relevant','Review'),
 notes('outstanding','Follow-up and reconciliation notes','Review')]},
 {key:'equipment',title:'Club assets and loans',kind:'equipment',group:'Operations',purpose:'Track sporting, film and event equipment; check condition, holders, loan dates, maintenance and return follow-up.',fields:[
 choice('assetType','Equipment type',['Sport net / court','Ball or team kit','First aid / safety','Film / camera / audio','Screen / projector','Storage / transport','Shade / furniture','Other'],'Equipment'),
 txt('tag','Asset tag / identifier','Equipment'),txt('location','Location / store','Equipment'),num('quantity','Quantity','Equipment'),
 choice('condition','Condition',['Proposed','New','Serviceable','Inspect','Repair','Retired'],'Equipment'),
 txt('holder','Loan holder / proposed custodian','Loan'),day('outDate','Loan date','Loan'),day('returnDate','Expected return date','Loan'),
 notes('maintenance','Maintenance and condition report','Maintenance'),check('returned','Loan returned or closed','Maintenance')]},
 {key:'sponsors',title:'Sponsors and supporters',kind:'sponsor',group:'Operations',purpose:'Track who offered help, permitted acknowledgements and outstanding conversations; do not automatically advertise anyone.',fields:[
 txt('organisation','Organisation or supporter','Contact'),txt('contact','Contact name / title','Contact'),
 txt('channel','Private contact reference (where consented)','Contact'),choice('offerType','Support type',['Equipment','Volunteer expertise','Venue','Services','Financial proposal','Prizes','Media support','Other'],'Offer'),
 notes('offer','Offer and limits','Offer'),notes('recognition','Proposed recognition or deliverables','Offer'),
 day('followup','Follow-up date','Review'),check('consentToContact','Consent to follow up confirmed','Review'),
 check('logoPermission','Permission to display name/logo confirmed','Review')]},
 {key:'grants',title:'Grant register',kind:'grant',group:'Operations',purpose:'Track actual grant opportunities, official deadlines, eligibility, partner needs, budgets and acquittals.',fields:[
 txt('funder','Funding organisation','Opportunity',true),txt('scheme','Programme name','Opportunity'),
 url('officialUrl','Official guidelines or apply URL','Opportunity'),day('closingDate','Closing date (Brisbane if appropriate)','Opportunity'),
 num('amount','Indicative request (AUD)','Budget'),choice('eligibility','Eligibility review',['Not assessed','Eligible in principle','Partner needed','Not eligible'],'Review'),
 txt('applicant','Possible eligible applicant','Review'),notes('case','Purpose, deliverables and evidence','Review'),
 txt('officer','Proposal lead','Work'),list('attachments','Documents, quotes and permissions needed','Work'),
 notes('submission','Submission and acquittal references','Work')]},
 {key:'leaderboard',title:'Results, prizes and sponsors',kind:'governance',group:'Operations',purpose:'Prepare multi-sport scoreboards, prize eligibility and acknowledgements, with verified results only.',fields:[
 txt('format','Sport / competition format','Programme'),day('eventDate','Event date','Programme'),
 list('results','Result lines (verify before any publication)','Results'),notes('rules','Scoring and eligibility rules','Results'),
 list('prizes','Proposed prizes and donors','Prizes'),check('resultsVerified','Results verified by event organiser','Review'),
 check('consentForNames','Participant naming/photo consent reviewed','Review')]},
 {key:'stock',title:'Shop, stock and prices',kind:'asset',group:'Operations',purpose:'Record prospective merchandise stock, costs and location. No sales, payment collection or invoices are connected.',fields:[
 txt('sku','Product / SKU','Catalogue'),choice('category','Category',['Club shirts','Sports gear','Event goods','Food and drink proposal','Media merchandise','Other'],'Catalogue'),
 num('opening','Opening quantity','Stock'),num('inward','Stock received','Stock'),num('outward','Stock issued','Stock'),
 num('price','Proposed sale price (AUD)','Price'),num('unitCost','Estimated unit cost (AUD)','Price'),
 txt('supplier','Supplier / reference','Price'),notes('stocktake','Count, delivery and stocktake notes','Reconcile')]},
 {key:'safety',title:'Member ages and safeguards',kind:'safeguard',group:'Safeguards',purpose:'Restricted planning for safeguarding, Blue Cards, privacy, youth consent and incident processes; do not add unneeded identifying health information.',roles:['webmaster','president','secretary'],fields:[
 choice('policy','Control',['Blue Card register process','Guardian consent process','Media consent process','First aid / incident process','Code of conduct','Junior event eligibility','Accessibility and safe inclusion'],'Plan'),
 txt('responsible','Designated safeguarding officer','Plan'),day('reviewDate','Review date','Review'),
 notes('requirements','Procedural requirements (no names of minors)','Review'),url('policyUrl','Policy / official reference URL','Review'),
 check('reviewed','Reviewed by designated authority','Review')]},
 {key:'applications',title:'Membership and volunteer applications',kind:'volunteer',group:'Membership',purpose:'Manage the application workflow and related tasks. Actual personal directory records are managed in People & memberships.',fields:[
 choice('applicationKind','Application pathway',['Founding member interest','General future member','Volunteer helper','Sport participant','Film club participant','Organisation or partner'],'Enquiry'),
 txt('reference','Internal application reference','Enquiry'),day('received','Received / proposed date','Enquiry'),
 txt('reviewer','Assigned reviewer','Review'),list('checks','Safeguarding, consent and policy checks','Review'),
 notes('decisionNotes','Review and follow-up notes, not an authorised membership decision','Review')]},
 {key:'returning',title:'Member return and renewal planning',kind:'volunteer',group:'Membership',purpose:'Plan voluntary renewal outreach and eligibility. No real member is automatically invited or charged.',fields:[
 choice('path','Pathway',['Membership renewal','Lapsed member return','Founding supporter follow-up','New event interest'],'Review'),
 txt('memberRef','Member directory reference (not password)','Review'),day('targetDate','Target follow-up date','Review'),
 notes('terms','Proposed terms and consent','Review'),txt('assigned','Responsible officer','Review'),
 check('permission','Individual contact permission verified','Review')]},
 {key:'member-packs',title:'Member packs and onboarding',kind:'governance',group:'Membership',purpose:'Prepare a member welcome pack and handover checklist without assuming membership has been approved.',fields:[
 txt('packName','Pack template name','Build',true),list('contents','Documents, joining details and practical tips','Build'),
 notes('welcome','Welcome message','Build'),list('sports','Proposed sport and activity options','Build'),
 notes('safeguards','Consent, age and photo/video safeguards','Review'),txt('officer','Responsible pack assembler','Review'),
 check('packChecked','Pack content proofread','Review')]},
 {key:'member-types',title:'Membership types and numbers',kind:'governance',group:'Membership',purpose:'Draft membership classes, proposed fees and rights for constitution review; not a payment or registration service.',fields:[
 txt('className','Proposed class name','Classes',true),txt('eligibility','Eligibility criteria','Classes'),
 num('proposedFee','Proposed fee (AUD, not charged)','Classes'),notes('rights','Proposed rights and voting','Review'),
 day('reviewDate','Committee review date','Review'),check('constitutionReviewed','Checked against working constitution','Review')]},
 {key:'member-notice',title:'Member notices and delivery',kind:'notice',group:'Membership',purpose:'Compose opt-in messages for eventual members. This is a preview and delivery checklist, not a live mailing service.',fields:[
 txt('subject','Notice subject','Compose',true),choice('audience','Recipient class',['All future members','Adult members','Guardian contacts','Volunteers','Film club participants'],'Compose'),
 notes('body','Message body','Compose',true),day('proposedSend','Proposed issue date','Delivery'),
 check('consent','Recipient consent requirements checked','Delivery'),
 check('review','Authorised reviewer marked ready to discuss','Delivery'),notes('delivery','Manual delivery handover and receipt notes','Delivery')]},
 {key:'birthday',title:'Birthday offers and approvals',kind:'governance',group:'Membership',purpose:'Plan optional birthday benefits and their permissions. No codes or private greetings are issued automatically.',fields:[
 txt('offer','Proposed birthday offer','Offer'),txt('eligibility','Eligibility rules','Offer'),
 notes('value','Benefit limits and restrictions','Offer'),day('reviewDate','Proposal review date','Review'),
 check('privacy','Birthday data minimisation reviewed','Review'),notes('approvalNotes','Review notes (not formal approval)','Review')]},
 {key:'email-queue',title:'Email awaiting delivery',kind:'notice',group:'Membership',purpose:'An internal outbound-message queue for human review. The platform sends no emails or SMS.',fields:[
 txt('subject','Draft subject','Draft',true),txt('recipientGroup','Intended audience or consented contact reference','Draft'),
 notes('body','Draft message','Draft',true),txt('responsible','Reviewer / sender','Review'),
 day('sendAfter','Proposed delivery date','Review'),check('consentVerified','Recipient consent checked','Review'),
 notes('deliveryLog','Manual delivery status or handover','Review')]},
 {key:'sport-programme',title:'Sports and coaching calendar',kind:'calendar',group:'Sport and film',purpose:'Set planned sessions, skills pathways, coaching roles, registrations and equipment.',fields:[
 choice('sport','Sport / activity',['Mixed beach volleyball','Beach cricket','Flag football','Beach soccer','Beach rugby','AirBadminton','Beach tennis','Handball','Wellbeing movement','Multi-sport'],'Session'),
 day('date','Session date','Session'),time('startTime','Start time (Brisbane)','Session'),
 txt('location','Town / proposed court or venue','Session'),txt('coach','Coach / facilitator','People'),
 num('capacity','Proposed capacity','People'),notes('needs','Equipment, skill and access needs','People'),
 check('safeguards','Participant safeguarding plan reviewed','Safety'),notes('weatherPlan','Heat, lightning and weather backup plan','Safety')]},
 {key:'venues',title:'Venue, court and screen bookings',kind:'asset',group:'Sport and film',purpose:'Plan multi-town facility and screen requirements without making an actual facility reservation.',fields:[
 choice('town','Town',['Dunwich / Goompi','Amity Point / Pulan','Point Lookout / Mulumba','Multi-town / TBD'],'Venue'),
 txt('site','Facility / proposed location','Venue'),day('date','Planned date','Venue'),
 time('startTime','Start time','Venue'),time('endTime','End time','Venue'),
 list('assets','Courts, screens, shade, amenities and transport','Requirements'),
 txt('contact','Venue contact / permission reference','Requirements'),notes('permissions','Tenure, electrical, safety and booking permissions','Review'),
 check('confirmed','External site permission actually recorded','Review')]},
 {key:'volunteers',title:'Volunteers and event roles',kind:'volunteer',group:'Sport and film',purpose:'Prepare rosters, training and role checklists with role owners and safeguarding prerequisites.',fields:[
 txt('event','Event or project','Roles'),txt('role','Volunteer role','Roles',true),
 txt('person','Prospective volunteer / office reference','Roles'),day('date','Roster day','Roles'),
 time('start','Start time','Roles'),time('finish','Finish time','Roles'),
 list('training','Training and safety checklist','Readiness'),check('consent','Volunteer agreed to role','Readiness'),
 notes('followUp','Follow-up and backup volunteer','Readiness')]},
 {key:'film',title:'Film club and media programme',kind:'film',group:'Sport and film',purpose:'Plan screenings, production, content rights, schedules and equipment using Sandy-specific film workflows.',fields:[
 choice('type','Activity',['Cinema screening','Filming session','Production workshop','Live stream proposal','Community film festival','Screen content'],'Programme'),
 txt('filmTitle','Film or production title','Programme'),day('date','Proposed date','Programme'),
 txt('location','Venue / screen','Programme'),notes('programme','Running order and presenter brief','Production'),
 list('crew','Crew | role | time','Production'),list('equipment','Screen, projector, camera and audio requirements','Production'),
 notes('rights','Copyright/licensing, cultural permissions, appearance releases','Permissions'),check('rightsReviewed','Rights and consents reviewed','Permissions')]},
 {key:'connections',title:'External connections and approvals',kind:'governance',group:'Governance',purpose:'Record possible third-party integrations and who may approve them. No service is connected by drafting a proposal.',fields:[
 choice('service','Potential connection',['Calendar reminders','Meeting transcription','Weather and tide sources','Mozzie guided assistance','Straddie Noticeboards','Screen & Media Network','Ready SET Co-op','Other'],'Design'),
 txt('responsible','Sandy owner','Design'),notes('purpose','Use case and expected benefit','Design'),
 notes('data','Data shared and privacy conditions','Safeguards'),url('source','Provider terms / guidance link','Safeguards'),
 check('humanControl','Human review and withdrawal process identified','Safeguards'),notes('approval','Committee consideration and next steps','Review')]}
];
export const SUITE_DESKS=Object.freeze(F.map(entry=>Object.freeze({...entry,
 fields:Object.freeze(entry.fields.map(f=>Object.freeze(f))),
 steps:Object.freeze([...new Set(entry.fields.map(f=>f.step))]),
 roles:Object.freeze(entry.roles||['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'])
})));
export const SUITE_BY_KEY=Object.freeze(Object.fromEntries(SUITE_DESKS.map(s=>[s.key,s])));
