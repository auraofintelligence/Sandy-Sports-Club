const endpoint='/api/committee/membership-waivers/report';
const categories={adult:'Adult',cadet:'Cadet',junior:'Junior',social:'Social',casual:'Casual',lifetime:'Lifetime',unconfirmed:'Unconfirmed'};
const eventNames={approved:'Offer approved',accepted:'Offer accepted',granted:'Free year granted'};
const money=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'});
const localTime=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
const localDay=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',year:'numeric'});
const day=value=>localDay.format(new Date(value+'T12:00:00+10:00'));
const amount=cents=>money.format(cents/100);

function reportMarkup({period,totals,rows},esc) {
  const metric=(name,value)=>'<div><dt>'+name+'</dt><dd>'+esc(String(value))+'</dd></div>';
  const activity=rows.map(row=>{
    let grant='';
    if(row.event==='granted'){
      const fee=row.waivedFeeCents===null?'Annual fee unknown':'Annual fee waived '+amount(row.waivedFeeCents);
      grant='<p>'+esc(fee)+(row.paidThrough?' · Membership through '+esc(day(row.paidThrough)):'')+'</p>';
    }
    return '<li><strong>'+esc(eventNames[row.event])+'</strong> · '+esc(localTime.format(new Date(row.occurredAt)))+
      '<br>'+esc(categories[row.category]||'Unconfirmed')+' membership'+grant+'<p><small>Offer reference <code style="overflow-wrap:anywhere">'+esc(row.reference)+'</code></small></p></li>';
  }).join('');
  const unknown=totals.unpricedGrantCount;
  const coverage=unknown===1?'1 grant had no published annual fee on record.':
    unknown+' grants had no published annual fee on record.';
  const query=new URLSearchParams({[period.type]:period.key});
  return '<article class="report-sheet"><header class="report-heading"><h4>'+esc(period.label)+'</h4><p>'+esc(day(period.startDate))+' to '+esc(day(period.endDate))+' · Brisbane time</p></header>'+
    '<dl class="report-stats">'+metric('Offers approved',totals.approvedCount)+metric('Offers accepted',totals.acceptedCount)+metric('Free years granted',totals.grantedCount)+
    metric('Known annual fees waived',amount(totals.knownWaivedFeeCents))+metric('Cash received',amount(totals.cashReceivedCents))+'</dl>'+
    '<div class="report-section">'+(unknown?'<p>'+esc(coverage)+' The total includes only recorded fees.</p>':'')+
    '<p><a class="button outline" href="'+endpoint+'.csv?'+esc(query.toString())+'" download="Sandy-membership-waivers-'+esc(period.type+'-'+period.key)+'.csv">Download spreadsheet (CSV)</a></p>'+
    '<p><small>Open the downloaded file in Excel, Numbers or Google Sheets. It includes the totals and each dated entry.</small></p>'+
    (activity?'<details><summary>View dated entries ('+rows.length+')</summary><ol>'+activity+'</ol></details>':
    '<p>No offers were approved, accepted or granted during this period.</p>')+'</div></article>';
}

export function setupWaiverReport({host,api,esc,signal}) {
  if(!host || signal?.aborted) return;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const year=Number(today.find(part=>part.type==='year').value),month=today.find(part=>part.type==='month').value;
  host.innerHTML='<section class="report-picker"><h3>Membership waiver report</h3><p>Check how many free years were granted and the value of any published annual fees waived.</p>'+
    '<form><label>Reporting period<select name="period"><option value="month">Monthly</option><option value="quarter">Quarterly</option><option value="financialYear">Financial year (July to June)</option><option value="year">Calendar year</option></select></label>'+
    '<label>Month<input type="month" name="month" required></label>'+
    '<label hidden>Quarter<select name="quarter" disabled><option value="1">January to March</option><option value="2">April to June</option><option value="3">July to September</option><option value="4">October to December</option></select></label>'+
    '<label hidden><span data-year-label>Year</span><input type="number" name="year" min="1" max="9999" step="1" required disabled></label>'+
    '<button type="submit" class="button">Show waiver report</button></form><p role="status"></p><div data-results></div></section>';
  const form=host.querySelector('form'),fields=form.elements,status=host.querySelector('[role=status]'),results=host.querySelector('[data-results]');
  fields.month.value=String(year)+'-'+month;
  fields.quarter.value=String(Math.ceil(Number(month)/3));
  let pending=null,downloading=null,disposed=false,previousType='';
  const downloads=new Set();
  function clearReport(){
    pending?.abort();
    downloading?.abort();
    downloading=null;
    pending=null;
    results.replaceChildren();
    status.textContent='';
  }
  function updatePeriod(){
    const type=fields.period.value;
    for (const [input,shown] of [[fields.month,type==='month'],[fields.quarter,type==='quarter'],[fields.year,type!=='month']]) {
      input.disabled=!shown;
      input.closest('label').hidden=!shown;
    }
    if(type!==previousType){
      fields.year.value=type==='financialYear'&&Number(month)>6?year+1:year;
      form.querySelector('[data-year-label]').textContent=type==='financialYear'?'Year ending 30 June':'Year';
      previousType=type;
    }
  }
  function change(){clearReport();updatePeriod();}
  async function show(event){
    event.preventDefault();
    clearReport();
    if(!form.reportValidity()) return;
    const type=fields.period.value;
    const yearKey=fields.year.value.padStart(4,'0');
    const value=type==='month'?fields.month.value:type==='quarter'?yearKey+'-Q'+fields.quarter.value:yearKey;
    const read=new AbortController();
    pending=read;
    status.textContent='Opening your report…';
    try {
      const report=await api(endpoint+'?'+new URLSearchParams({[type]:value}),{signal:read.signal});
      if(disposed || pending!==read) return;
      results.innerHTML=reportMarkup(report,esc);
      status.textContent='Report ready for '+report.period.label+'.';
    } catch(error) {
      if(!disposed && pending===read) status.textContent=error.message||'The report could not open. Please try again.';
    }
  }
  async function download(event){
    const link=event.target.closest('a[download]');
    if(!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if(downloading) return;
    const read=new AbortController();
    downloading=read;
    status.textContent='Preparing your spreadsheet…';
    try {
      const res=await fetch(link.href,{signal:read.signal,credentials:'same-origin',cache:'no-store'});
      if(!res.ok || !res.headers.get('Content-Type')?.startsWith('text/csv')) throw Error(res.status===401||res.status===403?'Sign in with Treasurer access to download the report.':'The spreadsheet could not download. Please try again.');
      const file=await res.blob();
      if(disposed || downloading!==read) return;
      const url=URL.createObjectURL(file),save=document.createElement('a');
      downloads.add(url);
      save.href=url;save.download=link.download;
      document.body.append(save);save.click();save.remove();
      setTimeout(()=>{if(downloads.delete(url)) URL.revokeObjectURL(url);},60000);
      status.textContent='Your spreadsheet download has started.';
    } catch(error){
      if(!disposed && downloading===read) status.textContent=error.message;
    } finally {if(downloading===read) downloading=null;}
  }
  updatePeriod();
  form.addEventListener('input',change);
  form.addEventListener('change',change);
  form.addEventListener('submit',show);
  results.addEventListener('click',download);
  function dispose(){
    disposed=true;
    clearReport();
    for(const url of downloads) URL.revokeObjectURL(url);
    downloads.clear();
    host.replaceChildren();
    signal?.removeEventListener('abort',dispose);
  }
  signal?.addEventListener('abort',dispose,{once:true});
  return dispose;
}
