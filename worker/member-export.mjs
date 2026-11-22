import {privateAreaKeys,openPrivateText} from './member-network.mjs';
import {mealKeyArea} from './shared-meals.mjs';

// Only records owned by the signed-in account belong here. The sharing feed also
// contains other people's photos, so it must never be used to build a download.
const groups={
  recipes:{title:'My recipes',from:'member_recipes t',owner:'t.owner_id',fields:'t.id,t.created,t.content'},
  meals:{title:'Meals I hosted',from:'shared_meals t',owner:'t.host_id',fields:'t.id,t.venue_type AS venueType,t.visibility,t.starts_at AS startsAt,t.cancelled,t.guest_limit AS guestLimit,t.contents,t.location'},
  mealReplies:{title:'My meal replies and contributions',from:'shared_meal_invites t JOIN shared_meals m ON m.id=t.meal_id',owner:'t.member_id',
    fields:`t.id,t.meal_id AS mealId,t.response,t.party_size AS partySize,t.dietary,t.contribution,t.revoked,
      (SELECT json_group_array(j.slot) FROM shared_meal_jobs j WHERE j.invite_id=t.id AND j.meal_id=m.id) AS slots,m.contents AS mealDetails`},
  recipePhotos:{title:'My recipe photos',from:'member_recipe_photos t JOIN member_recipes r ON r.id=t.recipe_id',owner:'r.owner_id',fields:'t.id,r.id AS recipeId,t.slot+1 AS picture,t.content AS photo'},
  posts:{title:'My conversation posts and replies',from:'community_posts t',owner:'t.author_id',filter:' AND t.removed=0',
    fields:'t.id,t.parent_id AS repliedTo,t.author_name AS displayName,t.message,t.created_at AS recorded,t.photo'},
  saved:{title:'My private notes and photos',from:'network_items t JOIN network_profiles p ON p.id=t.owner_id',owner:'p.account_id',
    fields:'t.id,t.created_at AS recorded,t.content,t.photo'},
  profile:{title:'My member profile',from:'network_profiles t',owner:'t.account_id',
    fields:'t.id,t.display_name AS displayName,t.avatar,t.listed,t.photo'},
  volunteering:{title:'My offers to help and work with partners',from:'partner_handoffs t',owner:'t.owner_id',filter:" AND t.kind IN ('volunteer','employment')",
    fields:'t.id,t.kind,t.scope,t.event_title AS event,t.status,t.consent_at AS agreed,t.revoked_at AS withdrawn'},
  choices:{title:'My sharing agreement',from:'member_terms_acceptance t',owner:'t.account_id',
    fields:'t.terms_version AS edition,t.accepted,t.updated_at AS recorded'},
};
const privateHeaders={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const areas={meals:mealKeyArea,mealReplies:mealKeyArea,recipes:'Sandy Sports Club members recipe book v1',recipePhotos:'Sandy Sports Club members recipe book v1'};

function numberParam(search,name) {
  const value=search.get(name);
  return value!==null && /^\d{1,16}$/.test(value) && Number.isSafeInteger(Number(value))?Number(value):null;
}

export async function memberExportEndpoint(request,env,identity,{requireDb,HttpError,json}){
  const fail=(status,message)=>{throw new HttpError(status,message,'member_export');};
  if(!identity)fail(401,'Sign in with your member username to download your contributions.');
  if(identity.accountRole!=='member'||!['member','signed_in'].includes(identity.role))fail(403,'Use your own individual member account to download your contributions.');
  if(request.method!=='GET')fail(405,'Open My club download to prepare your file.');
  const expected=request.headers.get('X-Sandy-Export-Account');
  if(expected && expected!==identity.id)fail(409,'The signed-in member changed. Start your download again.');
  const path=new URL(request.url),base='/api/member/export';
  const store=requireDb(env),db=store.withSession?store.withSession('first-primary'):store;
  if(path.pathname===base){
    const sets=Object.entries(groups);
    const counts=await db.batch(sets.map(([,g])=>db.prepare('SELECT COUNT(*) AS total,COALESCE(MAX(t.rowid),0) AS through FROM '+g.from+' WHERE '+g.owner+'=?'+(g.filter||'')).bind(identity.id)));
    return json({account:identity.id,createdAt:new Date().toISOString(),groups:sets.map(([id,g],i)=>({id,title:g.title,...counts[i].results[0]}))},200,privateHeaders);
  }
  const key=path.pathname.slice(base.length+1),g=Object.hasOwn(groups,key)?groups[key]:null;
  if(!g||path.pathname!==base+'/'+key)fail(404,'This download section is unavailable.');
  const after=numberParam(path.searchParams,'after'),through=numberParam(path.searchParams,'through');
  if(after===null||through===null||after>through)fail(400,'Reopen My club download to start a fresh copy.');
  // A page includes the photo beside the text that describes it in one read.
  // Use small pages for image-bearing sources to bound D1 response size and memory.
  const size=['volunteering','choices'].includes(key)?75:3;
  const query='SELECT t.rowid AS seq,'+g.fields+' FROM '+g.from+' WHERE '+g.owner+'=?'+(g.filter||'')+' AND t.rowid>? AND t.rowid<=? ORDER BY t.rowid LIMIT ?';
  const {results}=await db.prepare(query).bind(identity.id,after,through,size).all();
  let contentKey;
  async function decrypt(scope,value){
    if(!value)return null;
    if(!env.PRIVATE_AUTH_KEY)fail(503,'Private photo storage is unavailable. Try your download again shortly.');
    contentKey||=(await privateAreaKeys(env.PRIVATE_AUTH_KEY,areas[key])).content;
    return openPrivateText(contentKey,scope,value);
  }
  const rows=[];
  for(const item of results){
    const {seq,...row}=item;
    if(key==='journal'){
      row.pin=JSON.parse(await decrypt('journal-pin:'+row.id,row.pin));
      row.photo=await decrypt('journal-photo:'+row.id,row.photo);
    }else if(key==='recipes'){
      const details=JSON.parse(await decrypt('recipe:'+row.id,row.content));delete row.content;Object.assign(row,details);
    }else if(key==='meals'){
      const details=JSON.parse(await decrypt('meal-details:'+row.id,row.contents));
      delete row.contents;
      Object.assign(row,details,{location:await decrypt('meal-location:'+row.id,row.location)});
    }else if(key==='mealReplies'){
      const offered=row.contribution ? JSON.parse(await decrypt('meal-contribution:'+row.id,row.contribution)) : {};
      const slots=JSON.parse(row.slots);
      const ownJobs=slots.length ? JSON.parse(await decrypt('meal-details:'+row.mealId,row.mealDetails)).jobs : [];
      row.jobs=slots.map(slot=>ownJobs[slot]).filter(Boolean);
      row.dietary=await decrypt('meal-dietary:'+row.id,row.dietary);
      delete row.mealDetails;
      delete row.slots;
      delete row.contribution;
      Object.assign(row,offered);
    }else if(key==='recipePhotos')row.photo=await decrypt('recipe-photo:'+row.id,row.photo);
    else if(key==='saved'){
      const saved=JSON.parse(await decrypt('item:'+row.id,row.content));
      delete row.content;
      Object.assign(row,saved);
      row.photo=await decrypt('photo:'+row.id,row.photo);
    }else if(key==='profile')row.photo=await decrypt('profile:'+row.id,row.photo);
    else if(key==='honours')row.photo=await decrypt('honours:'+row.id,row.photo);
    else if(key==='juniors')row.photo=await decrypt('junior:'+row.id,row.photo);
    rows.push(row);
  }
  const last=results.at(-1)?.seq;
  return json({rows,next:results.length===size && last<through?last:null},200,privateHeaders);
}
