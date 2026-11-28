// Who can use which club function. This one table is used by the website (server and pages),
// the committee room, and the draft constitution's Schedule of officer access, so what the rules
// say and what the site does cannot drift apart. Change it only after a committee resolution.
//
// A deputy holds the same access as the office they deputise for:
// the Vice President as the President, and the Assistant Secretary as the Secretary.
export const OFFICES=Object.freeze({webmaster:'Webmaster',president:'President',vice_president:'Vice President',secretary:'Secretary',assistant_secretary:'Assistant Secretary',treasurer:'Treasurer',committee:'Committee member'});
export const DEPUTIES=Object.freeze({president:'vice_president',secretary:'assistant_secretary'});
export function withDeputies(roles){
 const out=[...roles];
 for(const [office,deputy] of Object.entries(DEPUTIES))if(roles.includes(office)&&!out.includes(deputy))out.push(deputy);
 return Object.freeze(out);
}
// Access groups. Each lists the offices that hold it (deputies are added automatically).
export const ACCESS_GROUPS=Object.freeze({
 officers:withDeputies(['webmaster','president','secretary','treasurer','committee']),
 memberRecords:withDeputies(['webmaster','president','secretary','treasurer']),
 secretariat:withDeputies(['webmaster','president','secretary']),
 safeguarding:withDeputies(['webmaster','president','secretary']),
 money:Object.freeze(['webmaster','treasurer']),
 allocators:withDeputies(['webmaster','secretary']),
 accounts:Object.freeze(['webmaster'])
});
// Plain-English schedule: what each group can do. Used for the constitution and the committee room.
export const ACCESS_SCHEDULE=Object.freeze([
 {group:'officers',title:'Committee room',does:'Committee notices and to-do lists; planning events, run sheets, sports sessions, venues, film nights and results; club assets and loans; grants and fundraising; sponsors (view); officer handover; Social Studio; member wishes; checking ID for the blue tick.'},
 {group:'memberRecords',title:'Members and publishing',does:'The member list and onboarding; applications and joining; member packs, membership types and birthday offers; publishing notices and events to members and the public calendar; store orders and reports; managing sponsors.'},
 {group:'secretariat',title:'Meetings and records',does:'Meetings, agendas and minutes; the meeting archive: video, audio and transcripts (rule 4B); AGM jobs; newsletters and the message queue; club documents; membership automations; the audit log; formal decisions once the club is incorporated.'},
 {group:'safeguarding',title:'Safeguarding',does:'Children registered by guardians and their permissions; participation and safety checks; the safety library.'},
 {group:'money',title:'Money and stock',does:'Store products, prices, stock and discount codes; finance records.'},
 {group:'allocators',title:'Allocating work',does:'Giving jobs to another office and recording a returned paper job sheet.'},
 {group:'accounts',title:'Accounts and site settings',does:'Creating and closing officer accounts, and site settings. The Webmaster acts on the committee’s instructions.'}
]);
export const holds=(group,role)=>ACCESS_GROUPS[group]?.includes(role)||false;
