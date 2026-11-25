// Generate a NEW synthetic fixture SQL file. Never run it against the live database.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {SUITE_DESKS} from '../../studio/sandy-suite-spec.js';
import {defaultCampaignSettings} from '../../studio/social-campaign-engine.js';
import {fixtureId} from '../../worker/view-mode.mjs';
import {STAFF} from '../../worker/shared.mjs';
const stamp='2026-11-25T00:00:00.000Z',date='2027-02-13';
const quote=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replace(/'/g,"''")+"'";
const insert=(table,fields)=>'INSERT INTO '+table+'('+Object.keys(fields).join(',')+') VALUES('+Object.values(fields).map(quote).join(',')+');';
const explicit={
 notices:{subject:'Example equipment check',message:'Review proposed nets and shade before the practice session.',responseOwner:'Example Secretary'},
 todos:{action:'Check proposed equipment list',owner:'Example Treasurer',progress:'Example follow-up from planning discussion'},
 news:{headline:'Example Sandy monthly update',lead:'A fictional community sport and film update.',articles:'Sport practice ideas\nFilm programme proposal'},
 handover:{office:'Example Secretary',from:'Example outgoing officer',to:'Example incoming officer',duties:'Prepare draft agenda\nMaintain minutes'},
 meetings:{meetingType:'Working group',date,startTime:'09:00',endTime:'10:00',location:'Example venue, no booking',chair:'Example President',minuteTaker:'Example Secretary',agenda:'Equipment check\nAccessibility review',followUps:'Check net stock | Example Treasurer | 2027-02-20',draftMinutes:'Fictional planning notes only.'},
 events:{activity:'Mixed beach volleyball',eventDate:date,startTime:'09:00',endTime:'10:30',site:'Example site, no booking',programme:'Warm-up\nSkills practice\nReview',risk:'Example heat and shade plan'},
 stock:{sku:'EXAMPLE-NET',category:'Sports gear',opening:4,inward:2,outward:1,price:0,unitCost:25,supplier:'Fictional supplier',stocktake:'Five sample units, not actual inventory.'},
 grants:{funder:'Fictional community fund',scheme:'Example equipment proposal',officialUrl:'',amount:1000,case:'Example budget for practice equipment; no award.'},
 equipment:{assetType:'Sport net / court',tag:'EXAMPLE-ASSET',quantity:1,holder:'Example custodian',condition:'Proposed'},
 safety:{policy:'Guardian consent process',responsible:'Example safeguarding officer',requirements:'Fictional procedure review. No child or case details.'},
 film:{type:'Cinema screening',filmTitle:'Example community film',location:'Example screen venue',rights:'No rights assumed or screening confirmed.'},
 documents:{documentType:'Draft procedure',visibility:'Committee only',custodian:'Example Secretary',versionLabel:'Example v1',summary:'Fictional metadata, no private source document.'}
};
const defaults=f=>f.type==='checkbox'?false:f.type==='number'?0:f.type==='select'?f.options[0]:f.type==='date'?date:f.type==='month'?'2027-02':f.type==='time'?(f.key.toLowerCase().includes('end')||f.key.toLowerCase().includes('finish')?'10:30':'09:00'):f.type==='url'?'':f.required?'Example '+f.label.toLowerCase():'';
export function showcaseSql(){
 // Fail at the first existing table. No DROP, DELETE, session, invite or credential data.
 const schema=readFileSync(new URL('../migrations/0001_club.sql',import.meta.url),'utf8').replaceAll('CREATE TABLE IF NOT EXISTS','CREATE TABLE');
 const out=[schema],owner=fixtureId(1);
 let sequence=100;
 const next=()=>fixtureId(sequence++);
 const record=(kind,title,body,eventDate=null,actor=owner,role='webmaster')=>{
  const id=next();
  out.push(insert('club_records',{id,kind,title:'[EXAMPLE] '+title,body_json:JSON.stringify(body),status:'draft',event_date:eventDate,created_by:actor,updated_by:actor,created_utc:stamp,updated_utc:stamp}));
  out.push(insert('club_revisions',{id:next(),resource_kind:'record',resource_id:id,resource_version:1,operation:'synthetic_fixture',actor_id:actor,actor_role:role,actor_office:'Example '+role,at_utc:stamp,snapshot_json:JSON.stringify(body)}));
  out.push(insert('club_audit',{id:next(),actor_id:actor,actor_role:role,action:'synthetic_fixture',resource_kind:'record',resource_id:id,occurred_utc:stamp}));
 };
 STAFF.forEach((role,i)=>out.push(insert('club_accounts',{id:fixtureId(i+1),username:'example-'+role,role,office_label:'Example '+role.replace(/_/g,' '),display_name:'Fictional '+role.replace(/_/g,' '),state:'reserved',created_utc:stamp})));
 out.push(insert('club_people',{id:next(),full_name:'Illustrative demo member',membership_class:'other',status:'interested',town:'Example island locality',notes:'Synthetic preview only. No account, enrolment or membership.',created_by:owner,updated_by:owner,created_utc:stamp,updated_utc:stamp}));
 for(const desk of SUITE_DESKS){
  const fields=Object.fromEntries(desk.fields.map(f=>[f.key,explicit[desk.key]?.[f.key]??defaults(f)]));
  const eventDate=['date','eventDate','closingDate','dueDate','reviewDate','agmDate'].map(k=>fields[k]).find(v=>/^\d{4}-\d{2}-\d{2}$/.test(v||''))||null;
  record(desk.kind,desk.title,{sandySuiteVersion:1,domain:desk.key,fields},eventDate);
 }
 record('social_idea','Beginner volleyball tips',{category:'',channel:'undecided',notes:'Fictional idea for a short coaching clip.',authorNote:'Example officer'});
 record('governance','Constitution working draft',{source:'sandy-constitution-builder',fields:{name:'Sandy Sports Club (example draft)',additional:'Fictional review notes. No adopted rules.'},markdown:'Example constitution draft only.'});
 STAFF.forEach((role,i)=>record('notice','Help with example calendar',{sandyWebmasterRequest:1,category:'Committee workflow',message:'Fictional support request for '+role,readAt:null,reply:''},null,fixtureId(i+1),role));
 out.push(insert('club_interest',{id:next(),created_utc:stamp,first_name:'Example',town:'Example island locality',interests_json:JSON.stringify(['Sport and film']),comments:'Fictional expression of interest.',contact_consent:0,source:'synthetic fixture'}));
 out.push(insert('studio_settings',{id:1,version:1,settings_json:JSON.stringify(defaultCampaignSettings()),updated_by:owner,updated_utc:stamp}));
 out.push(insert('studio_briefs',{id:next(),title:'[EXAMPLE] Beach skills video brief',date,brief:'Fictional internal coaching video concept. No commission or publication.',created_by:owner,updated_by:owner,created_utc:stamp,updated_utc:stamp}));
 out.push("CREATE TABLE sandy_showcase_marker(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,classification TEXT NOT NULL);");
 out.push(insert('sandy_showcase_marker',{id:1,version:1,classification:'SANDY_SYNTHETIC_ONLY'}));
 return out.join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(showcaseSql());
