import {openCommitteeWishes} from './equipment-wishes.js?v=20261121-practical-wishes';

const endpoint='/api/committee/equipment';
const owners={club:'The club',member:'A member',officer:'An officer',sponsor:'A sponsor',supporter:'A supporter'};
const statuses={available:'Available',out:'On loan',returned:'Returned to owner'};
const actions={create:'Add equipment',edit:'Update details',lend:'Lend equipment',checkIn:'Check back in',returnOwner:'Return to owner'};
const past={create:'Added to the register',edit:'Updated the details',lend:'Lent out',checkIn:'Checked back in',returnOwner:'Returned to owner'};
const formatDay=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const day=value=>value?formatDay.format(new Date(value+'T12:00:00+10:00')):'';
let stagedOffer=null;

export function stageSponsorEquipment(details) {
  if (!details?.sourceOfferId) return;
  stagedOffer={...details};
  if (location.hash==='#committee/equipment') window.dispatchEvent(new Event('plfc:equipment-offer-ready'));
  else location.hash='committee/equipment';
}

export function setupClubEquipment({api,esc}) {
  const mount=document.getElementById('club-equipment');
  if (!mount) return;
  let session,request,record,filter='all',page=1,mode='',draftId,preset,retry,wishes;
  const active=()=>session?.authenticated && session.role==='committee' && location.hash==='#committee/equipment';
  const readOnly=()=>Boolean(session?.readOnly || session?.demo || session?.showcase);
  const el=selector=>mount.querySelector(selector);
  const button=(label,action,value='',primary=false)=>'<button type="button" class="button '+(primary?'':'outline small')+'" data-equipment="'+action+'" value="'+esc(String(value))+'">'+esc(label)+'</button>';
  const text=(name,label,value='',options={})=>'<label>'+esc(label)+'<input name="'+name+'" type="'+(options.date?'date':'text')+'" value="'+esc(value||'')+'" '+(options.required?'required ':'')+
    (options.date?(options.min?' min="'+esc(options.min)+'"':'')+(options.max?' max="'+esc(options.max)+'"':''):'maxlength="'+(options.max||140)+'"')+'></label>';
  function clear() {
    wishes?.abort();wishes=null;request?.abort();request=null;record=null;mode='';filter='all';page=1;preset=null;draftId=null;retry=null;mount.inert=false;mount.replaceChildren();
  }
  function say(message,error=false) {
    const node=el('[data-equipment-status]'); if (node) { node.setAttribute('role',error?'alert':'status');node.textContent=message; }
  }
  function heading() {el('[data-equipment-heading]')?.focus();}
  function outer(html) {
    mount.innerHTML=html+'<p role="status" aria-live="polite" data-equipment-status></p>';
    if(readOnly()) {
      for(const action of ['create','edit','lend','checkIn','returnOwner','offer-create'])
        mount.querySelectorAll('[data-equipment="'+action+'"]').forEach(control=>control.hidden=true);
      mount.querySelector('[data-equipment-form]')?.remove();
    }
  }
  function dateText(item) {
    if(item.status==='returned') return 'Returned '+day(item.onDate);
    const parts=[];
    if(item.loanDue) parts.push('Check in by '+day(item.loanDue));
    if(item.lenderDue) parts.push('Return to owner by '+day(item.lenderDue));
    return parts.join(' · ');
  }
  function badge(item) {return '<span class="equipment-badge">'+esc(statuses[item.status])+'</span>'+(item.overdue?' <strong class="equipment-late">Overdue</strong>':'');}
  function list() {
    const choices={all:'All equipment',available:'Available',out:'On loan',overdue:'Overdue',returned:'Returned to owner'};
    const rows=record.items.map(item=>'<li><div><button class="text-link" type="button" data-equipment="open" value="'+esc(item.id)+'">'+esc(item.name)+'</button> '+badge(item)+
      '<p>'+esc(item.custodian)+' · '+esc(item.location)+'</p>'+(dateText(item)?'<p>'+esc(dateText(item))+'</p>':'')+'</div></li>').join('');
    outer('<header><h1 data-equipment-heading tabindex="-1">Equipment register</h1><p>See who has the club gear, where it is and when it is due back.</p>'+
      '<div class="equipment-buttons">'+button('Add equipment','create','',true)+button('Equipment wish list','wishes')+'</div></header><div class="equipment-filter"><label>Show <select data-equipment-filter>'+
      Object.entries(choices).map(([k,v])=>'<option value="'+k+'"'+(k===filter?' selected':'')+'>'+v+'</option>').join('')+'</select></label></div>'+
      (rows?'<ul class="equipment-list">'+rows+'</ul>':filter==='all'?'<p>No equipment has been recorded yet.</p><details><summary>See an example</summary><p>A member lends a folding table for a club BBQ. Add the table, who owns it, who will collect it and the agreed return date. When the table goes back, open its record and choose <strong>Return to owner</strong>.</p></details>':'<p>No equipment matches this view.</p>')+
      (record.total>record.pageSize?'<nav aria-label="Equipment pages" class="equipment-buttons">'+(record.page>1?button('Previous page','page',record.page-1):'')+'<span>Page '+record.page+' of '+Math.ceil(record.total/record.pageSize)+'</span>'+(record.page*record.pageSize<record.total?button('Next page','page',record.page+1):'')+'</nav>':''));
  }
  function pair(title,value) {return value?'<div><dt>'+esc(title)+'</dt><dd>'+esc(value)+'</dd></div>':'';}
  function details() {
    const i=record.item;
    const buttons=i.status==='returned'?'':button(i.status==='out'?actions.checkIn:actions.lend,i.status==='out'?'checkIn':'lend','',true)+
      (i.ownerType!=='club'?button(actions.returnOwner,'returnOwner'):'')+button(actions.edit,'edit');
    const history=record.history.map(v=>'<li><p><strong>'+esc(past[v.action])+'</strong> · '+esc(day(v.onDate))+'</p><p>'+esc(v.officer)+' recorded '+esc(v.custodian)+' at '+esc(v.location)+'.</p>'+
      (v.notes?'<p>'+esc(v.notes)+'</p>':'')+(v.status!=='returned'&&dateText(v)?'<p>'+esc(dateText(v))+'</p>':'')+'</li>').join('');
    outer(button('Equipment register','list')+'<h1 data-equipment-heading tabindex="-1">'+esc(i.name)+'</h1>'+badge(i)+
      '<dl class="equipment-facts">'+pair('Owned by',i.ownerType==='club'?'Sandy Sports Club':i.lender+' ('+i.ownerType+')')+
      pair('Owner contact',i.lenderContact)+pair(i.status==='returned'?'Received by':'Held by',i.custodian)+pair('Location',i.location)+
      pair('Last recorded handover',day(i.onDate))+pair('Check in by',day(i.loanDue))+pair(i.status==='returned'?'Agreed return date':'Return to owner by',day(i.lenderDue))+pair('Last note',i.notes)+'</dl>'+
      '<div class="equipment-buttons">'+buttons+'</div><details class="equipment-history"><summary>Handover history ('+record.history.length+')</summary><ol>'+history+'</ol></details>');
  }
  function form(action) {
    mode=action;retry=null;
    const i=action==='create'?null:record.item;
    const offer=action==='create'?preset:null;
    const identity=action==='create'||action==='edit';
    const owner=i?.ownerType||(offer?'sponsor':'club');
    const date=record.today;
    const moves=['lend','checkIn','returnOwner'].includes(action);
    const required={required:true};
    const loan=action==='lend'||(action==='edit' && i?.status==='out');
    const when=action==='create'?'Date received':action==='returnOwner'?'Date returned':'Date of this entry';
    const person=action==='lend'?'Who is taking the equipment?':action==='returnOwner'?'Who received it back?':'Who is looking after it?';
    outer(button(action==='create'?'Equipment register':'Back to equipment',action==='create'?'list':'detail')+'<h1 data-equipment-heading tabindex="-1">'+esc(actions[action])+'</h1>'+
      (i?'<p>'+esc(i.name)+'</p>':offer?'<p>From an agreed sponsor loan. Add the handover details when the club receives the equipment.</p>':'')+
      '<form class="equipment-form" data-equipment-form>'+
      (identity?text('name','Equipment name',i?.name||offer?.name,{...required,max:140}):'')+
      (action==='create'&&!offer?'<label>Who owns it?<select name="ownerType">'+Object.entries(owners).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select></label>':'')+
      (identity?'<fieldset data-owner-fields'+(owner==='club'?' hidden':'')+'><legend>Borrowed equipment</legend>'+
        text('lender','Owner or organisation',i?.lender||offer?.lender,{max:160})+
        text('lenderContact','Owner contact (optional)',i?.lenderContact||offer?.lenderContact,{max:180})+
        text('lenderDue','Return to owner by (if agreed)',i?.lenderDue||offer?.lenderDue,{date:true})+'</fieldset>':'')+
      text('custodian',person,action==='returnOwner'?i.lender:moves?'':i?.custodian,{...required,max:120})+
      text('location',action==='returnOwner'?'Where was it handed back?':'Where will the gear be?',moves?'':i?.location,{...required,max:180})+
      text('onDate',when,date,{date:true,required:true,min:i?.onDate,max:date})+
      (loan?text('loanDue','When should it be checked back in?',i?.loanDue,{date:true,required:true,max:i?.lenderDue}):'')+
      '<label>Handover note (optional)<textarea rows="2" maxlength="600" name="notes">'+esc(offer?.notes||(!moves&&i?i.notes:''))+'</textarea></label>'+
      '<button class="button" type="submit">'+(action==='create'?'Save equipment':action==='edit'?'Save changes':'Record handover')+'</button></form>');
    toggleOwner();heading();
  }
  function offerList() {
    const rows=record.items.map(i=>'<li><button type="button" class="text-link" data-equipment="open" value="'+esc(i.id)+'">'+esc(i.name)+'</button> '+badge(i)+
      (dateText(i)?'<p>'+esc(dateText(i))+'</p>':'')+'</li>').join('');
    outer('<a class="text-link" href="#committee/sponsors">Back to sponsor offers</a><h1 data-equipment-heading tabindex="-1">Equipment from this offer</h1>'+
      '<ul class="equipment-list">'+rows+'</ul>'+button('Add another item','offer-create','',true));
  }
  function toggleOwner() {
    const f=el('[data-equipment-form]'), fields=f?.querySelector('[data-owner-fields]');
    if(!fields) return;
    const owner=f.elements.ownerType?.value||preset&&'sponsor'||record.item?.ownerType||'club';
    fields.hidden=owner==='club';fields.disabled=fields.hidden;
    f.elements.lender.required=!fields.hidden;
  }
  function rememberWishes(target) {
    const state={...window.history.state};
    if(target)state.equipmentWishes=target;
    else if(state.equipmentWishes)delete state.equipmentWishes;
    else return;
    window.history.replaceState(state,'',location.href);
  }
  async function load(params='',focus=true) {
    rememberWishes(null);
    wishes?.abort();wishes=null;
    request?.abort();const token=new AbortController();request=token;mount.inert=false;retry=null;
    const offer=stagedOffer; if(offer && !params) {preset=offer;stagedOffer=null;params=offer.assetId?'?id='+encodeURIComponent(offer.assetId):'?offer='+encodeURIComponent(offer.sourceOfferId);}
    const showList=!params;
    outer('<p role="status">Opening the equipment register…</p>');
    try {
      const data=await api(endpoint+(params||'?filter='+filter+'&page='+page),{cache:'no-store',signal:token.signal});
      if(request!==token || !active()) return;
      record=data;mode='';
      if(showList) {preset=null;list();}
      else if(data.item) {preset=null;details();}
      else if(preset) {
        if(data.items?.length && !preset.newItem)offerList();
        else {draftId=crypto.randomUUID();if(preset.newItem)preset.name='';form('create');}
      }
      if(focus) heading();
    } catch(error) {
      if(request===token && active()) {outer('<p role="alert">'+esc(error.message)+'</p>'+button('Try again','reload',params));}
    } finally {if(request===token) request=null;}
  }
  function openWishes(target = {}) {
    request?.abort();request=null;wishes?.abort();wishes=new AbortController();mode='wishes';
    rememberWishes(target);openCommitteeWishes(mount,{api,esc,rememberWishes,readOnly:readOnly()},wishes.signal,target);
  }
  function enter() {
    if(!active()){clear();return;}
    const url=new URL(location.href);
    const wishId=url.searchParams.get('wish'),grantId=url.searchParams.get('fromGrant'),idea=url.searchParams.get('idea');
    if(wishId||grantId||url.searchParams.get('wishList')==='1'){
      for(const key of ['wish','fromGrant','idea','wishList'])url.searchParams.delete(key);
      window.history.replaceState(window.history.state,'',url);
      openWishes(wishId||grantId?{wishId,grantId,idea}:{});
    } else if(stagedOffer)load('',false);
    else if(!record&&!request&&!wishes){
      if(window.history.state?.equipmentWishes)openWishes(window.history.state.equipmentWishes);
      else load('',false);
    }
  }
  mount.addEventListener('change',e=>{
    if(e.target.matches('[name="ownerType"]'))toggleOwner();
    if(e.target.matches('[data-equipment-filter]')) {filter=e.target.value;page=1;load();}
  });
  mount.addEventListener('click',e=>{
    const b=e.target.closest('[data-equipment]');if(!b||!active())return;
    const action=b.dataset.equipment;
    if(action==='list'){preset=null;load();}
    else if(action==='wishes')openWishes();
    else if(action==='page'){page=Number(b.value);load();}
    else if(action==='open'){load('?id='+encodeURIComponent(b.value));}
    else if(action==='reload'){load(b.value);}
    else if(action==='detail'){mode='';details();heading();}
    else if(action==='create'&&!readOnly()){draftId=crypto.randomUUID();preset=null;form('create');}
    else if(action==='offer-create'&&preset&&!readOnly()){draftId=crypto.randomUUID();preset={...preset,newItem:true,name:''};form('create');}
    else if(Object.hasOwn(actions,action)&&!readOnly())form(action);
  });
  mount.addEventListener('submit',async e=>{
    e.preventDefault();if(readOnly() || !active() || request || !e.target.matches('[data-equipment-form]')) return;
    const fields=Object.fromEntries(new FormData(e.target));
    const creating=mode==='create', id=creating?draftId:record.item.id;
    if(creating && preset){fields.ownerType='sponsor';fields.sourceOfferId=preset.sourceOfferId;}
    const payload={action:mode,id,...(creating?{}:{version:record.item.version}),...fields};
    const key=JSON.stringify(payload);
    if(retry?.key!==key) retry={key,mutationId:crypto.randomUUID()};
    const token=new AbortController();request=token;mount.inert=true;
    try {
      const data=await api(endpoint,{method:'POST',body:JSON.stringify({...payload,mutationId:retry.mutationId}),signal:token.signal});
      if(request!==token||!active())return;
      record=data;mode='';retry=null;preset=null;details();heading();say('Saved to the equipment register.');
    } catch(error) {
      if(request===token&&active()){say(error.message,true);const area=el('[data-equipment-status]');if(area)area.insertAdjacentHTML('afterend',button('Refresh record','reload',creating&&preset?'?offer='+encodeURIComponent(preset.sourceOfferId):creating?'':'?id='+encodeURIComponent(id)));}
    } finally {if(request===token){request=null;mount.inert=false;}}
  });
  window.addEventListener('plfc:equipment-offer-ready',()=>{if(active())load();});
  window.addEventListener('plfc:navigated',enter);
  window.addEventListener('plfc:session-changed',e=>{stagedOffer=null;clear();session=e.detail;enter();});
  window.addEventListener('pagehide',()=>{stagedOffer=null;clear();});
  window.addEventListener('pageshow',e=>{if(e.persisted && active())enter();});
}
