// Browser-local platform report import. No API calls, uploads or inferred identity matches.
export const METRIC_FIELDS=Object.freeze(['postId','externalId','postUrl','publishedAt','views','likes','comments','shares','saves','clicks']);
export const PLATFORMS=Object.freeze(['youtube','facebook','instagram','tiktok','noticeboard']);
const candidates={
  postId:['sandy_post_id','sandy id','campaign_id','campaign id','post_id_internal','internal_id','internal post id'],
  externalId:['post_id','post id','video_id','video id','content id','media id','media_id','external post id'],
  postUrl:['post_url','post url','permalink','url','video url','post link'],
  publishedAt:['published_at','published date','publish time','created time','date published'],
  views:['views','video views','plays','impressions','reach'],
  likes:['likes','reactions','like count'],
  comments:['comments','comment count'],
  shares:['shares','share count'],
  saves:['saves','bookmarks','saved'],
  clicks:['clicks','link clicks','link_clicks','profile visits']
};
export function parseDelimited(text){
  if(typeof text!=='string'||text.length>3_000_000)throw Error('Choose a CSV file under 3 MB.');
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')quoted=false;
      else cell+=c;
    }else if(c==='"'&&cell===''){quoted=true;}
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);cell='';if(row.some(v=>v!==''))rows.push(row);
      row=[];if(rows.length>15001)throw Error('CSV is too large; use at most 15,000 records.');
    }else cell+=c;
  }
  if(quoted)throw Error('CSV contains an unclosed quoted field.');
  row.push(cell);if(row.some(v=>v!==''))rows.push(row);
  const [header,...data]=rows;
  if(!header?.length || data.length===0)throw Error('CSV must include column headings and at least one data row.');
  if(header.length>150)throw Error('Too many columns in the CSV.');
  return {headers:header.map(v=>v.trim()),rows:data.map(record=>
    Object.fromEntries(header.map((name,i)=>[name.trim(),record[i]??''])))};
}
export function suggestedMapping(headers){
  const norm=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  return Object.fromEntries(METRIC_FIELDS.map(field=>{
    const aliases=candidates[field].map(norm);
    const name=headers.find(h=>aliases.includes(norm(h)))||'';
    return [field,name];
  }));
}
const positiveInteger=value=>{
  if(value===''||value===null||value===undefined)return null;
  const cleaned=String(value).trim().replace(/[ ,]/g,'');
  return /^\d+$/.test(cleaned)&&Number.isSafeInteger(Number(cleaned))?Number(cleaned):null;
};
export function metricFromRow(row,mapping,{platform,filename,importedAt}){
  if(!PLATFORMS.includes(platform))throw Error('Choose a valid platform.');
  const col=field=>String(row[mapping[field]]??'').trim();
  const counts=Object.fromEntries(['views','likes','comments','shares','saves','clicks'].map(field=>[field,positiveInteger(col(field))]));
  return {
    id:'',platform,visibilitySourceField:mapping.views||'',postId:col('postId'),externalId:col('externalId'),postUrl:col('postUrl'),
    publishedAt:col('publishedAt'),importedAt,filename,
    ...counts
  };
}
export function linkMetrics(metrics,posts,postEdits){
  const known=new Set(posts.map(p=>p.id));
  const byExternal=new Map();
  for(const [postId,edit] of Object.entries(postEdits||{})){
    if(!known.has(postId))continue;
    for(const ref of edit.externalRefs||[]){
      if(ref.externalId)byExternal.set(ref.platform+'|'+ref.externalId,postId);
      if(ref.postUrl)byExternal.set(ref.platform+'|'+ref.postUrl,postId);
    }
  }
  return metrics.map(item=>{
    const matched=known.has(item.postId)?item.postId:
      byExternal.get(item.platform+'|'+item.externalId)||
      byExternal.get(item.platform+'|'+item.postUrl)||'';
    return {...item,matchedPostId:matched};
  });
}
export function latestMetrics(records){
  const map=new Map();
  for(const item of records){
    if(!item.matchedPostId)continue;
    const key=item.platform+'|'+item.matchedPostId;
    const previous=map.get(key);
    if(!previous||item.importedAt>=previous.importedAt)map.set(key,item);
  }
  return [...map.values()];
}
export function summarizeMetrics(records,posts){
  const known=new Set(posts.map(p=>p.id));
  const groups=new Map();
  for(const entry of latestMetrics(records).filter(x=>known.has(x.matchedPostId))){
    const platform=entry.platform;
    if(!groups.has(platform))groups.set(platform,{platform,posts:0,views:0,interactions:0,clicks:0});
    const group=groups.get(platform);
    group.posts++;
    group.views+=entry.views??0;
    group.interactions+=(entry.likes??0)+(entry.comments??0)+(entry.shares??0)+(entry.saves??0);
    group.clicks+=entry.clicks??0;
  }
  return [...groups.values()].sort((a,b)=>b.views-a.views);
}
export function compareContentPatterns(records,posts){
  const byId=new Map(posts.map(p=>[p.id,p]));
  const groups=new Map();
  for(const m of latestMetrics(records)){
    const post=byId.get(m.matchedPostId);
    if(!post || m.views===null || m.views===undefined)continue;
    const layer=post.layerIds[0],key=m.platform+'|'+layer;
    if(!groups.has(key))groups.set(key,{platform:m.platform,layer,posts:0,views:0,interactions:0});
    const group=groups.get(key);
    group.posts++;
    group.views+=m.views;
    group.interactions+=(m.likes??0)+(m.comments??0)+(m.shares??0)+(m.saves??0);
  }
  return [...groups.values()].filter(x=>x.posts>=2)
    .map(x=>({...x,averageViews:Math.round(x.views/x.posts)}))
    .sort((a,b)=>a.platform.localeCompare(b.platform)||b.averageViews-a.averageViews);
}

export function planMetricsCSV(posts,postEdits,records){
  const linked=latestMetrics(records);
  const byId=new Map();
  for(const row of linked){
    if(!byId.has(row.matchedPostId))byId.set(row.matchedPostId,[]);
    byId.get(row.matchedPostId).push(row);
  }
  const columns=['sandy_post_id','date','time_AEST','time_zone','title','content_format','topics',
    'channels','brief','cta','storyboard','working_notes','working_status',
    'timing_signal','signal_target','lead_days','time_of_day','time_reason',
    'platform','external_post_id','post_url','platform_published_at','visibility_source_field','report_imported_at',
    'views','likes','comments','shares','saves','clicks'];
  const quote=value=>{
    let str=String(value??'').replace(/\r?\n/g,' ');
    if(/^\s*[=+@-]/.test(str))str="'"+str;
    return '"'+str.replaceAll('"','""')+'"';
  };
  const lines=[];
  for(const p of posts){
    const edit=postEdits[p.id]||{},results=byId.get(p.id)||[null];
    for(const result of results){
      const details={
        sandy_post_id:p.id,date:p.date,time_AEST:edit.time||p.suggestedTime,
        time_zone:'Australia/Brisbane',title:edit.title||p.title,content_format:p.format,
        topics:p.layerIds.join(' | '),channels:p.channels.join(' | '),brief:edit.brief||p.brief,
        cta:p.cta,storyboard:p.storyboard.join(' | '),working_notes:edit.notes||'',
        working_status:edit.status||'Idea',
        timing_signal:p.timingSignal?.kind||'',signal_target:p.timingSignal?.targetDate||'',
        lead_days:p.timingSignal?.leadDays??'',
        time_of_day:p.timeOfDaySignal?.window||'',time_reason:p.timeOfDaySignal?.reason||'',
        platform:result?.platform||'',external_post_id:result?.externalId||'',
        post_url:result?.postUrl||'',platform_published_at:result?.publishedAt||'',visibility_source_field:result?.visibilitySourceField||'',report_imported_at:result?.importedAt||'',
        views:result?.views??'',likes:result?.likes??'',comments:result?.comments??'',
        shares:result?.shares??'',saves:result?.saves??'',clicks:result?.clicks??''
      };
      lines.push(columns.map(key=>quote(details[key])).join(','));
    }
  }
  return '\uFEFF'+[columns.map(quote).join(','),...lines].join('\r\n');
}
