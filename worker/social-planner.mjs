const channels=['facebook','instagram','youtube','tiktok'];
const platforms={facebook:['facebook.com','fb.com','fb.watch'],instagram:['instagram.com'],
  youtube:['youtube.com','youtu.be'],tiktok:['tiktok.com']};
const officeLabels={president:'President',vicepresident:'Vice President',secretary:'Secretary',assistantsecretary:'Assistant Secretary',treasurer:'Treasurer'};
const stages=['idea','draft','ready','published'];
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const editable=['id','version','title','body','plannedDate','channels','status','links'];

function parsePlan(input,{dateField,textField,HttpError}) {
  const invalid=message=>{throw new HttpError(400,message,'invalid_social_plan');};
  if(Object.keys(input).some(key=>!editable.includes(key)))invalid('Use the fields on the social planner.');
  if(typeof input.id!=='string'||!uuid.test(input.id)||!Number.isSafeInteger(input.version)||input.version<0||input.version>=2147483647)
    invalid('Open the post plan again before saving it.');
  const title=textField(input.title,'the post title',140,true);
  if(/[\r\n]/.test(title))invalid('Keep the post title on one line.');
  const body=textField(input.body,'the post wording',6000);
  const plannedDate=dateField(input.plannedDate,false);
  if(!Array.isArray(input.channels)||input.channels.length>channels.length||input.channels.some(c=>!channels.includes(c)))
    invalid('Choose the platforms for this post.');
  const selected=channels.filter(c=>input.channels.includes(c));
  const status=input.status;
  if(!stages.includes(status))invalid('Choose the stage of this post.');
  if(!selected.length && (status==='published'||status==='ready'))invalid('Choose at least one platform for a ready or published post.');
  const links={},submitted=input.links??{};
  if(typeof submitted!=='object'||Array.isArray(submitted)||Object.keys(submitted).some(c=>!channels.includes(c)))
    invalid('Enter a post link beside its platform.');
  for(const c of channels) {
    const url=textField(submitted[c],'the published link',2048);
    if(!url)continue;
    if(!selected.includes(c))invalid('Select the platform that this link belongs to.');
    let parsed;
    try{parsed=new URL(url);}catch{invalid('Paste the full HTTPS link for this platform.');}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port ||
      !platforms[c].some(host=>parsed.hostname===host||parsed.hostname.endsWith('.'+host)))
      invalid('Use the HTTPS link to the post on its selected platform.');
    links[c]=parsed.href;
  }
  return {id:input.id.toLowerCase(),version:input.version,title,body,plannedDate,status,channels:selected,links};
}

function toPlan(row) {
  const {editorId,...plan}=row;
  return {...plan,channels:JSON.parse(row.channels),links:JSON.parse(row.links)};
}
const sameContent=(row,plan)=>row.title===plan.title && row.body===plan.body && row.plannedDate===plan.plannedDate &&
  row.status===plan.status && row.channels===JSON.stringify(plan.channels) && row.links===JSON.stringify(plan.links);

export async function socialPlannerEndpoint(request,env,identity,helpers) {
  const {json,requireRole,requireDb,bodyJson,HttpError}=helpers;
  requireRole(identity,['committee']);
  if(!['GET','POST'].includes(request.method))throw new HttpError(405,'Open or save a post in the social planner.','method_not_allowed');
  const now=new Date(),today=new Date(+now+36000000).toISOString().slice(0,10);
  const params=new URL(request.url).searchParams,month=params.get('month')??today.slice(0,7);
  const target=params.get('post');
  if([...params.keys()].some(k=>k!=='month'&&k!=='post') || params.getAll('month').length>1 ||
    !/^(?:19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])$/.test(month))
    throw new HttpError(400,'Choose a valid month in the planner.','invalid_month');
  if(target!==null && (request.method!=='GET'||!uuid.test(target)||params.getAll('post').length!==1))
    throw new HttpError(400,'Open the post again from the planner.','invalid_social_plan');
  const binding=requireDb(env),db=binding.withSession?binding.withSession('first-primary'):binding;
  const name=identity.name||identity.id;
  const office=identity.administrator?'Webmaster':
    ['committee','treasurer'].includes(identity.accountRole) && Object.hasOwn(officeLabels,name)?officeLabels[name]:'Committee member';
  const list=async()=>{
    if(target!==null){
      const targetMonth=`SELECT COALESCE(NULLIF(substr(plannedDate,1,7),''),?) AS month
        FROM committee_social_current WHERE id=?`;
      const [lookup,posts]=await db.batch([
        db.prepare(targetMonth).bind(month,target.toLowerCase()),
        db.prepare(`WITH chosen AS (${targetMonth})
          SELECT p.* FROM committee_social_current p,chosen
          WHERE p.plannedDate='' OR substr(p.plannedDate,1,7)=chosen.month
          ORDER BY CASE WHEN p.plannedDate='' THEN 1 ELSE 0 END,p.plannedDate,p.updatedAt DESC,p.id`).bind(month,target.toLowerCase())
      ]);
      if(!lookup.results[0])throw new HttpError(404,'This post could not be found in the club planner.','social_plan_not_found');
      return {today,month:lookup.results[0].month,viewer:{name,office},plans:posts.results.map(toPlan)};
    }
    const result=await db.prepare(`SELECT * FROM committee_social_current
      WHERE plannedDate='' OR (plannedDate>=? AND plannedDate<date(?,'+1 month'))
      ORDER BY CASE WHEN plannedDate='' THEN 1 ELSE 0 END,plannedDate,updatedAt DESC,id`).bind(month+'-01',month+'-01').all();
    return {today,month,viewer:{name,office},plans:result.results.map(toPlan)};
  };
  if(request.method==='GET')return json(await list());
  const plan=parsePlan(await bodyJson(request,56000),helpers);
  const rowForId=()=>db.prepare('SELECT * FROM committee_social_current WHERE id=?').bind(plan.id);
  const old=await rowForId().first();
  const retry=row=>row && row.version===plan.version+1 && row.editorId===identity.id && sameContent(row,plan);
  const conflict=()=>new HttpError(409,'Another officer saved this post. Open the latest version and check your changes.','social_plan_conflict');
  if(old && (retry(old) || (old.version===plan.version && sameContent(old,plan)))) return json({...await list(),plan:toPlan(old)});
  if((old?.version??0)!==plan.version)throw conflict();
  const timestamp=now.toISOString(),next=plan.version+1;
  const head=plan.version===0
    ?db.prepare('INSERT INTO committee_social_plans(id,current_version,created_at,created_by,creator_name) VALUES(?,1,?,?,?) ON CONFLICT(id) DO NOTHING').bind(plan.id,timestamp,identity.id,name)
    :db.prepare('UPDATE committee_social_plans SET current_version=? WHERE id=? AND current_version=?').bind(next,plan.id,plan.version);
  const changed=await db.batch([head,
    db.prepare(`INSERT INTO committee_social_revisions(plan_id,version,title,body,planned_date,channels_json,status,links_json,updated_at,updated_by,editor_name)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1`).bind(plan.id,next,plan.title,plan.body,plan.plannedDate,JSON.stringify(plan.channels),plan.status,
        JSON.stringify(plan.links),timestamp,identity.id,name),
    db.prepare('INSERT INTO audit_log SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),identity.id,identity.accountRole||identity.role,
      !old?'social_plan_created':old.status!==plan.status?'social_plan_marked_'+plan.status:'social_plan_edited',plan.id,timestamp),
    rowForId()]);
  const saved=changed[3].results[0];
  if(!changed[0].meta.changes && !retry(saved))throw conflict();
  return json({...await list(),plan:toPlan(saved)},!old&&changed[0].meta.changes?201:200);
}
