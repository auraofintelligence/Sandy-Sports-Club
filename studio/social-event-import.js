// Import committee calendar dates as social planning anchors, never as publication permission.
// Event run sheets and meeting records remain their respective source of truth.
import {parseDelimited} from './social-performance.js';

const dayPattern=/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
export function validCalendarDate(value){
  if(typeof value!=='string'||!dayPattern.test(value))return false;
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
const hash=value=>{
  let h=2166136261;
  for(const char of String(value)){h=Math.imul(h^char.charCodeAt(0),16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
};
export const importKey=(source,id)=>'m-import-'+source+'-'+hash(id);
export const isImportedMilestone=id=>typeof id==='string'&&/^m-import-(?:event|meeting|csv)-[0-9a-f]{8}$/.test(id);
export const importOrigin=id=>id?.startsWith('m-import-event-')?'Club event run sheet':
  id?.startsWith('m-import-meeting-')?'Committee meeting register':
  id?.startsWith('m-import-csv-')?'Annual calendar CSV':'Manually entered';
export const importedEventKinds=Object.freeze(['event','meeting','programme_open','programme_close']);
const limitWindow=(date,start,months=12)=>{
  if(!validCalendarDate(date))return false;
  if(!start)return true;
  const low=start+'-01',end=new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5))-1+months,1)).toISOString().slice(0,10);
  return date>=low&&date<end;
};
export function clubEventCandidates(events,startMonth){
  if(!Array.isArray(events))return [];
  return events.filter(x=>['open','closed'].includes(x?.status)&&limitWindow(x.date,startMonth)&&
    typeof x.title==='string'&&x.title.trim()&&typeof x.id==='string').map(x=>({
    id:importKey('event',x.id),title:x.title.trim().slice(0,140),date:x.date,kind:'event',
    origin:'Club event run sheet',status:x.status==='closed'?'Closed run sheet — check before promotion':'Planning run sheet',
    inactive:x.status==='closed',description:String(x.goal||'').slice(0,250)
  }));
}
export function meetingCandidates(meetings,startMonth){
  if(!Array.isArray(meetings))return [];
  return meetings.filter(x=>limitWindow(x?.date,startMonth)&&
    typeof x.title==='string'&&x.title.trim()&&typeof x.id==='string').map(x=>({
    id:importKey('meeting',x.id),title:x.title.trim().slice(0,140),date:x.date,kind:'meeting',
    origin:'Committee meeting register',status:x.status==='approved'?'Meeting record approved':'Meeting working record',
    description:String(x.location||'').slice(0,250)
  }));
}
export function parseAnnualCalendarCSV(csv,startMonth){
  const {headers,rows}=parseDelimited(csv);
  const norm=text=>text.trim().toLowerCase().replace(/[\s_-]+/g,'');
  const column=names=>headers.find(header=>names.includes(norm(header)))||'';
  const title=column(['title','eventtitle','event','name','eventname']);
  const date=column(['date','eventdate','startdate']);
  const kind=column(['kind','type','eventtype']);
  const id=column(['id','eventid','reference','ref']);
  const description=column(['description','details','notes','summary']);
  if(!title||!date)throw Error('CSV needs title and date columns (YYYY-MM-DD). Optional: type, id, notes.');
  if(rows.length>180)throw Error('Choose no more than 180 rows for the annual calendar.');
  const candidates=[],invalid=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i],dateValue=String(row[date]||'').trim(),name=String(row[title]||'').trim();
    if(!name&&!dateValue)continue;
    if(!validCalendarDate(dateValue)||name.length<3||name.length>140){
      invalid.push(i+2);continue;
    }
    if(!limitWindow(dateValue,startMonth))continue;
    const rawKind=String(kind?row[kind]:'').toLowerCase().replace(/[\s-]+/g,'_');
    const mapped=importedEventKinds.includes(rawKind)?rawKind:'event';
    const key=String(id?row[id]:'').trim()||name.toLowerCase()+'|'+mapped+'|'+dateValue;
    candidates.push({id:importKey('csv',key),title:name,date:dateValue,kind:mapped,
      origin:'Annual calendar CSV',status:'Imported planning date',
      description:String(description?row[description]:'').slice(0,250)});
  }
  return {candidates,invalidRows:invalid};
}
export const mergeEventCandidates=(previous,incoming)=>[
  ...new Map([...(previous||[]),...(incoming||[])].map(item=>[item.id,item])).values()
].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
export function importCalendarAnchors(milestones,candidates,selectedIds,verifiedIds){
  const current=Array.isArray(milestones)?milestones:[];
  const chosen=candidates.filter(c=>selectedIds.includes(c.id));
  const merged=new Map(current.map(item=>[item.id,item]));
  let added=0,updated=0,unchanged=0,verificationReset=0;
  for(const event of chosen){
    const prior=merged.get(event.id);
    const changed=prior&&(prior.title!==event.title||prior.date!==event.date||prior.kind!==event.kind);
    const verified=!event.inactive&&verifiedIds.includes(event.id);
    // A source date change or closed run sheet needs an explicit fresh review.
    // Closed event plans cannot be marked verified by importing them.
    const confirmed=!event.inactive&&(verified||Boolean(!changed&&prior?.confirmed));
    if(prior?.confirmed&&!confirmed)verificationReset++;
    const target={id:event.id,kind:event.kind,title:event.title,date:event.date,
      sourceUrl:'',confirmed};
    if(!prior)added++;
    else if(JSON.stringify(prior)!==JSON.stringify(target))updated++;
    else unchanged++;
    merged.set(event.id,target);
  }
  if(merged.size>80)throw Error('The social event list holds 80 planning anchors. Remove old or duplicate dates before importing more.');
  return {milestones:[...merged.values()],added,updated,unchanged,verificationReset};
}
export const surpriseDayItem=index=>({
  id:'s'+index,layerId:'surprise',time:'17:15',format:'image',
  title:'An unexpected Straddie moment',
  brief:'Keep this slot open for an unusual opportunity, special visitor or spontaneous island story. Check facts, people’s permission and Sandy Sports approval before sharing.'
});
