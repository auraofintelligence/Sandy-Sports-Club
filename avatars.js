// Sandy Sports cartoon avatars (the PLFC set): shared by the browser and the Worker (validation).
// Each avatar is tagged by age and gender so suggestions match the member's or child's date of birth and gender.
const tags='tf tm af am af am af am sf sm af sm kf km kf km kf km an am sf sm sf sm kf tm sf am af sm km sf am af tn sm'.split(' ');
const ages={k:'kid',t:'teen',a:'adult',s:'senior'},genders={f:'female',m:'male',n:'neutral'};
export const AVATARS=Object.freeze(tags.map((t,i)=>Object.freeze({id:'angler-'+String(i+1).padStart(2,'0'),age:ages[t[0]],gender:genders[t[1]]})));
export const GENDERS=Object.freeze(['female','male','non-binary']);
export const GENDER_LABELS=Object.freeze({female:'Female',male:'Male','non-binary':'Non-binary'});
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
export const avatarUrl=id=>'/assets/avatars/'+(reduced()?'still/':'')+id+'.webp';
export const validAvatar=id=>AVATARS.some(a=>a.id===id);
// Dates of birth are YYYY-MM-DD; ages are worked out on the Brisbane calendar date.
export const brisbaneToday=()=>new Date(Date.now()+10*3600000).toISOString().slice(0,10);
export function validDob(s){
 if(typeof s!=='string'||!/^(19|20)\d\d-(0[1-9]|1[0-2])-[0-3]\d$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s&&s<=brisbaneToday();
}
export function ageOn(dob,today=brisbaneToday()){
 const [y,m,d]=dob.split('-').map(Number),[ty,tm,td]=today.split('-').map(Number);
 return ty-y-((tm<m||(tm===m&&td<d))?1:0);
}
export const ageCategory=age=>age<13?'kid':age<18?'teen':age<55?'adult':'senior';
const near={kid:['kid','teen'],teen:['teen','kid','adult'],adult:['adult'],senior:['senior','adult']};
// Suggested first, then everything else. Non-binary: gender-neutral avatars first, then both.
export function orderAvatars({dob='',gender=''}={}){
 const ages=validDob(dob)?near[ageCategory(ageOn(dob))]:[],genders=gender==='non-binary'?['neutral','female','male']:gender?[gender,'neutral']:[];
 const score=a=>{const ai=ages.indexOf(a.age),gi=genders.indexOf(a.gender);return (ai<0?9:ai)*10+(gi<0?9:gi)};
 const suggested=AVATARS.filter(a=>ages.slice(0,2).includes(a.age)&&(!genders.length||genders.includes(a.gender))).sort((x,y)=>score(x)-score(y));
 return {suggested,others:AVATARS.filter(a=>!suggested.includes(a))};
}
