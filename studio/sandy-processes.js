// How things get done at Sandy Sports, step by step, and who can act at each step.
// "who" is either an access group from studio/sandy-access.js (so the offices shown always
// match what the site enforces) or one of the people and helpers below.
export const ACTORS=Object.freeze({
 public:{label:'Anyone',kind:'member'},
 member:{label:'Member',kind:'member'},
 guardian:{label:'Guardian',kind:'member'},
 filmMember:{label:'Film Club member',kind:'member'},
 kitOwner:{label:'Kit owner',kind:'member'},
 committee:{label:'The committee, by resolution',kind:'officer'},
 site:{label:'The site does it',kind:'auto'},
 sponsor:{label:'Sponsor, by private link',kind:'outside'},
 steward:{label:'Partner steward',kind:'outside'}
});
// My Membership tabs, in the order they appear (a test checks this against member-home.html).
export const MEMBER_TABS=Object.freeze([
 ['home','My Clubhouse','Your home page in the club'],['profile','My profile','Picture, badges and email notifications'],['directory','Members','Directory and connections'],
 ['calendar','Calendar & events','RSVPs and a calendar file for your phone'],['volunteer','Helping out','Ways to help and your offers'],['film','Film club','Join by lane, kit shelf, send in a story'],
 ['notices','Notices & newsletters','New notices, events and RSVPs'],['family','My family','Children and their permissions'],['privacy','My privacy & data','What we keep and your choices']]);
export const WORKFLOWS=Object.freeze([
 {key:'joining',title:'Joining and the blue tick',steps:[['Join free online','public'],['Picture and profile','member'],['Shows on the Applications desk','site'],['Welcome and member pack','memberRecords'],['ID sighted in person: blue tick','officers'],['Badges earned by taking part','site']]},
 {key:'notice',title:'Member notice',steps:[['Write it and pick who it reaches','memberRecords'],['Reach preview and the 2-a-week guide','site'],['Publish, pin if needed','memberRecords'],['New badge, emails batched by each member’s choice','site'],['Read it, RSVP','member']]},
 {key:'event',title:'Event',steps:[['Plan, run sheet, helpers','officers'],['Publish to the calendar, public if chosen','memberRecords'],['RSVP, add to own calendar','member'],['Changed or cancelled: going members told at once','site'],['Debrief and results','officers'],['Results shared once names are agreed','officers']]},
 {key:'story',title:'Island news story',steps:[['Film it, send it with the consent tick','filmMember'],['Waiting on the news desk','officers'],['Publish, or decline with a note','memberRecords'],['Maker told, story on Island news','site'],['Copy to the Screen Media Network','memberRecords'],['Network steward reviews','steward']]},
 {key:'broadcast',title:'Live broadcast',steps:[['Schedule: time, stream link, crew','memberRecords'],['Copy for the Straddie Noticeboard','memberRecords'],['Steward puts it on island screens','steward'],['Go live','memberRecords'],['Red “Live now” bar across the site','site'],['End, add the replay link','memberRecords']]},
 {key:'kit',title:'Kit loan',steps:[['Join the Film Club, list kit','member'],['Lend it, or bring it along','kitOwner'],['Ask for dates','filmMember'],['Yes, or not this time','kitOwner'],['Both told','site'],['Back, marked returned','kitOwner']]},
 {key:'sponsor',title:'Sponsor',steps:[['Conversation noted','officers'],['Agree tier and benefits, issue a private link','memberRecords'],['Sends logo, blurb and products','sponsor'],['Approve what shows','memberRecords'],['On the Sponsors page and in the store','site']]},
 {key:'meetings',title:'Meetings and AGM',steps:[['Agenda','secretariat'],['Meeting: attendance, outcomes','secretariat'],['Draft and approve minutes','secretariat'],['Follow-up jobs land on to-do lists','site'],['Jobs done and ticked off','officers'],['AGM date sets the run-up jobs','secretariat']]},
 {key:'newsletter',title:'Monthly newsletter',steps:[['Write the issue (the only place for ads)','secretariat'],['Audience: all who agreed, or visitors only','secretariat'],['Email queue, then Message delivery','secretariat'],['Unsubscribe honoured','site']]},
 {key:'store',title:'Store',steps:[['Products, prices, stock, discount codes','money'],['Order','member'],['Orders and reports','memberRecords'],['Finance records','money']]},
 {key:'safeguarding',title:'Children and safeguarding',steps:[['Register a child, set permissions','guardian'],['Ages and permissions checked','safeguarding'],['Participation and safety checks','safeguarding'],['Safety library kept current','safeguarding']]},
 {key:'access',title:'Officer access',steps:[['Committee resolution','committee'],['Reserve the account, send a one-time invite','accounts'],['Signs in and sees their desks','officers'],['Handover when the office changes','officers'],['Changing who can do what: a resolution, then Schedule 1','committee']]}
]);
