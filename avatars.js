// Sandy Sports cartoon avatars: shared by the browser and the Worker (validation).
// Each avatar is tagged by age group and gender so suggestions match the member or child.
const spec=[['kid','female',4],['kid','male',4],['teen','female',3],['teen','male',3],['adult','female',5],['adult','male',5],['adult','neutral',2],['senior','female',5],['senior','male',5]];
export const AVATARS=Object.freeze(spec.flatMap(([age,gender,n])=>Array.from({length:n},()=>({age,gender}))).map((a,i)=>Object.freeze({id:'sandy-'+String(i+1).padStart(2,'0'),...a})));
export const AGE_GROUPS=Object.freeze(['18-29','30-49','50-64','65+']);
export const GENDERS=Object.freeze(['female','male','non-binary']);
export const GENDER_LABELS=Object.freeze({female:'Female',male:'Male','non-binary':'Non-binary'});
export const avatarUrl=id=>'/assets/avatars/'+id+'.webp';
export const validAvatar=id=>AVATARS.some(a=>a.id===id);
const agesFor={'18-29':['adult'],'30-49':['adult'],'50-64':['senior','adult'],'65+':['senior'],'under16':['kid','teen'],'16-17':['teen']};
// Suggested first, then everything else. Non-binary: gender-neutral avatars first, then both.
export function orderAvatars({ageGroup='',ageBand='',gender=''}={}){
 const ages=agesFor[ageGroup||ageBand]||[],genders=gender==='non-binary'?['neutral','female','male']:gender?[gender,'neutral']:[];
 const score=a=>{const ai=ages.indexOf(a.age),gi=genders.indexOf(a.gender);return (ai<0?9:ai)*10+(gi<0?9:gi)};
 const suggested=AVATARS.filter(a=>ages.includes(a.age)&&(!genders.length||genders.includes(a.gender))).sort((x,y)=>score(x)-score(y));
 return {suggested,others:AVATARS.filter(a=>!suggested.includes(a))};
}
