// The committee room's desks: one list used by the committee room and the public "How the club works" page.
import {SUITE_DESKS} from './studio/sandy-suite-spec.js';
export const DESKS=[
 {key:'notices',group:'Communications',label:'Committee notices',kind:'notice',description:'Updates for the committee, and jobs with a due date for an officer.'},
 {key:'todos',group:'Communications',label:'To-do lists',kind:'task',description:'Every officer’s jobs in one place: take one, finish it, print your list.'},
 {key:'news',group:'Communications',label:'Newsletter desk',kind:'newsletter',description:'Write an issue, preview it, share it or send it by email.'},
 {key:'social',group:'Communications',label:'Social Studio',tab:'social',description:'The 12-month Social Media Hub and its post briefs.'},
 {key:'handover',group:'Governance',label:'Officer handover',kind:'governance',description:'Hand an office over: duties, open jobs, documents and logins.'},
 {key:'meetings',group:'Governance',label:'Meetings and minutes',kind:'meeting',description:'Agenda, attendance, outcomes, draft minutes and follow-up jobs.'},
 {key:'agm',group:'Governance',label:'AGM jobs',kind:'governance',description:'Pick the AGM date; the jobs leading up to it go on officers’ to-do lists.'},
 {key:'documents',group:'Governance',label:'Documents',kind:'governance',description:'Where each club document lives, who looks after it, when it is reviewed.'},
 {key:'automations',group:'Governance',label:'Membership automations',kind:'governance',description:'Plan reminders such as renewals and welcome messages.'},
 {key:'ready-setco',group:'Governance',label:'Ready SETCO decisions',kind:'partner',description:'Requests to the Ready SET Co-op, from idea to written agreement.'},
 {key:'access',group:'Governance',label:'Manage club access',tab:'accounts',webmaster:true,description:'Reserve officer accounts and send their one-time invitations.'},
 {key:'island-news',group:'Sport and film',label:'Island news and live',kind:'film',description:'Check Film Club stories before they go public, and run live broadcasts.'},
 {key:'events',group:'Events and funding',label:'Events and run sheets',kind:'event',description:'Plan the event, roster helpers, publish to the calendar, debrief.'},
 {key:'fundraising',group:'Events and funding',label:'Fundraising register',kind:'fundraising',description:'Fundraising ideas, who is running them, money in and costs.'},
 {key:'equipment',group:'Events and funding',label:'Club assets and loans',kind:'equipment',description:'Every piece of club gear: where it is, condition, loans and repairs.'},
 {key:'sponsors',group:'Events and funding',label:'Sponsors and supporters',kind:'sponsor',description:'Sponsor conversations, tiers, benefits and their private portal links.'},
 {key:'grants',group:'Events and funding',label:'Grant register',kind:'grant',description:'Grants from idea to won: deadlines, documents and who is leading.'},
 {key:'leaderboard',group:'Events and funding',label:'Results, prizes and sponsors',kind:'governance',description:'Results tables and prizes, shared once checked and names agreed.'},
 {key:'stock',group:'Events and funding',label:'Shop, stock and prices',kind:'asset',description:'Stock counts, prices and price changes for the store.'},
 {key:'safety',group:'Members and safeguards',label:'Member age and permissions',kind:'safeguard',restricted:true,description:'Children registered by guardians, permissions and blue-tick ID checks.'},
 {key:'applications',group:'Members and safeguards',label:'Applications',kind:'volunteer',description:'Who has joined, interest sign-ups still to chase, and blue ticks.',related:[['people','People & memberships']]},
 {key:'returning',group:'Members and safeguards',label:'Invite returning members',kind:'volunteer',description:'Plan how to welcome back past members and lapsed sign-ups.',related:[['people','People & memberships']]}
];
for(const spec of SUITE_DESKS){
 if(DESKS.some(x=>x.key===spec.key))continue;
 DESKS.push({key:spec.key,group:spec.group,label:spec.title,kind:spec.kind,description:spec.purpose});
}
