// Small, reusable editorial day patterns. Examples are prompts, not claimed events.
export const DAILY_FORMATS=Object.freeze([
  ['video','🎬 Short video'],['image','🖼️ Image'],['carousel','🗂️ Carousel'],['link','🔗 Link']
]);
const slot=(id,layerId,time,format,title,brief)=>({id,layerId,time,format,title,brief});
const template=(id,name,items)=>({id,name,items});
export const BUILTIN_DAY_PATTERNS=Object.freeze({
 weekday:[
  template('weekday-skills','Morning skill + evening question',[
   slot('s1','volleyball','07:35','video','A sporting skill','Choose one sport skill to demonstrate and verify technique and participant rights.'),
   slot('s2','voice','18:10','image','A community question','Ask an open question about what people would like the proposed club to offer.')
  ]),
  template('weekday-wellbeing','An active-living spotlight',[
   slot('s1','health','12:15','video','Health and wellbeing','Choose one evidence-supported benefit of enjoyable movement without making treatment claims.')
  ])
 ],
 friday:[
  template('friday-weekend','Friday weekend lead-in',[
   slot('s1','weather','07:35','video','Weekend weather check','Only add a freshly verified Bureau of Meteorology forecast and relevant site safety advice.'),
   slot('s2','visitors','16:15','image','Weekend visitor question','Invite holidaymakers to share ideas for future sports and recreation on Straddie.')
  ]),
  template('friday-film','Sport and screen possibilities',[
   slot('s1','film','17:30','image','Film club or outdoor screen idea','Explore a film or media concept without claiming a scheduled screening.')
  ])
 ],
 weekend:[
  template('weekend-families','Family and sport inspiration',[
   slot('s1','skills','08:30','video','Beginner-friendly sport idea','Describe a family-safe sport challenge using appropriate safeguarding advice.'),
   slot('s2','health','17:35','image','Wellbeing and community connection','Invite a conversation about enjoying physical activity together.')
  ]),
  template('weekend-three-towns','Three-town proposal',[
   slot('s1','places','09:00','carousel','One island, three towns','Show proposed facilities and distinguish possibilities from approved sites.')
  ])
 ],
 longWeekend:[
  template('longweekend-visitors','Visitor welcome and outdoor safety',[
   slot('s1','visitors','08:00','video','Holidaymaker sports ideas','Invite visitor input without promising events or facilities.'),
   slot('s2','safety','12:15','carousel','Outdoor safety check','Use verified weather, UV and accessibility information.'),
   slot('s3','voice','18:05','image','Weekend community poll','Ask which proposed activity or facility matters most.')
  ])
 ],
 publicHoliday:[
  template('publicholiday-ideas','Public-holiday sport and wellbeing',[
   slot('s1','health','09:15','video','Move, connect and thrive','Encourage optional, age-appropriate activity and verified advice.'),
   slot('s2','safety','13:00','image','Local conditions check','Use a verified official source and show publishing date.')
  ])
 ],
 holiday:[
  template('holiday-family','School-holiday family activities',[
   slot('s1','visitors','08:45','image','Visitor sport idea','Ask families what they might like to play in a potential club programme.'),
   slot('s2','volleyball','17:15','video','Sand-sport skill or challenge','Make one simple 30-second skill brief with coaching and consent checks.')
  ]),
  template('holiday-local','Local and visiting people',[
   slot('s1','voice','09:00','carousel','What could Sandy Sports bring to the island?','Use a question or poll and preserve local perspectives and choices.')
  ])
 ]
});
export const DAY_ARCHETYPE_LABELS=Object.freeze({
  weekday:'☀️ Ordinary weekday',friday:'✨ Friday',weekend:'🏖️ Weekend',
  longWeekend:'🧳 Long weekend',publicHoliday:'🎉 Public holiday',holiday:'🎒 School holidays'
});
export const DAY_TYPES=Object.freeze(Object.keys(DAY_ARCHETYPE_LABELS));
export const validSlot=slot=>Boolean(slot&&typeof slot==='object'&&!Array.isArray(slot)&&
  /^[-a-zA-Z0-9_]{1,50}$/.test(slot.id)&&
  ['video','image','carousel','link'].includes(slot.format)&&
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.time)&&
  typeof slot.layerId==='string'&&
  typeof slot.title==='string'&&slot.title.trim()&&slot.title.length<=180&&
  typeof slot.brief==='string'&&slot.brief.length<=4000);
export const allDayPresets=(type,saved={})=>[
  ...(BUILTIN_DAY_PATTERNS[type]||[]),
  ...(saved[type]||[])
];
export const patternFor=(type,id,saved={})=>allDayPresets(type,saved).find(p=>p.id===id);
export const planFromPattern=(pattern)=>({
  patternId:pattern.id,items:pattern.items.map(slot=>({...slot}))
});
export const planFromPosts=(posts,edits={})=>({
  patternId:'',items:posts.filter(post=>!edits[post.id]?.hidden).map((post,i)=>({
    id:'s'+(i+1),layerId:post.layerIds.find(x=>x!=='daily')||'voice',
    time:edits[post.id]?.time||post.suggestedTime||'08:00',
    format:post.durationSeconds?'video':(['image','carousel','link'].includes(post.format)?post.format:'image'),
    title:edits[post.id]?.title||post.title,brief:edits[post.id]?.brief||post.brief
  }))
});
export const newDaySlot=index=>({
  id:'s'+index,layerId:'voice',time:'12:00',format:'image',
  title:'New Sandy Sports planning item',brief:'Add your idea and check facts before review.'
});
