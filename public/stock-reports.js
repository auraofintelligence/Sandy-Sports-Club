const brisbane='Australia/Brisbane';
const money=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'});
const unitMoney=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2,maximumFractionDigits:4});
const localTime=new Intl.DateTimeFormat('en-AU',{timeZone:brisbane,day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
const localDay=new Intl.DateTimeFormat('en-AU',{timeZone:brisbane,day:'numeric',month:'short',year:'numeric'});
const monthParts=new Intl.DateTimeFormat('en-AU',{timeZone:brisbane,year:'numeric',month:'2-digit'});
const movementLabels={sale:'Sale',delivery:'Delivery',count:'Shelf count',purchase:'Purchase',order:'Order',review:'Print review'};
const paymentLabels={cash:'Cash',square:'Square'};
const reportName='Shop sales, stock and bookings';
const unknown='Uncounted';
const valuationRule='Each item’s closing shelf count is multiplied by its most recent recorded unit cost on or before the report date.';

function monthOf(date) {
  const parts=Object.fromEntries(monthParts.formatToParts(date).map(p=>[p.type,p.value]));
  return parts.year+'-'+parts.month;
}

function defaultMonth(today) {
  const [year,month]=monthOf(today).split('-').map(Number);
  return monthOf(new Date(Date.UTC(year,month-2,15)));
}

function amountsInDollars(cents) {return cents==null?null:cents/100;}
function dateOnly(value) {return localDay.format(new Date(value+'T12:00:00+10:00'));}
function periodDates(period) {return dateOnly(period.startDate)+' to '+dateOnly(period.endDate);}
function deliveryCost(row) {
  return row.deliveriesWithoutCost>0 && row.deliveriesWithCost===0?'Unknown':amountsInDollars(row.knownDeliveryCostCents);
}
function priceCell(table,column,value,forFile) {
  if(!table.moneyColumns.includes(column)||typeof value!=='number')return value;
  if(column===table.unitMoneyColumn)return forFile?value.toFixed(4):unitMoney.format(value);
  return forFile?value.toFixed(2):money.format(value);
}
function coverage(row){
  if(!row.uncountedItems&&!row.unpricedItems)return 'Complete';
  return row.valuedItems?'Known subtotal':'Unknown';
}
function knownValue(row){
  return coverage(row)==='Unknown'?'Unknown':amountsInDollars(row.knownValueCents);
}
function basisInfo(item){
  if(!item.basisDate)return null;
  const units=item.basisUnits;
  const cost=money.format(amountsInDollars(item.basisCents))+' for '+units+(units===1?' unit':' units');
  return [localDay.format(new Date(item.basisDate)),movementLabels[item.basisKind],cost,item.basisSource].filter(Boolean).join(' · ');
}

function yearsAndQuarter(today){
  const [year,month]=monthOf(today).split('-').map(Number);
  const quarter=Math.ceil(month/3);
  return {year,quarter,previousQuarter:quarter===1?4:quarter-1,previousQuarterYear:quarter===1?year-1:year,
    financialYear:month>6?year+1:year};
}

function chosenPeriod(form){
  const fields=form.elements,type=fields.period.value;
  if(type==='month'){
    const key=fields.month.value;
    if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(key))return null;
    const [year,month]=key.split('-').map(Number);
    return span('month',key,year,month,1);
  }
  const year=Number(fields.year.value);
  if(!Number.isInteger(year)||year<1000||year>9999)return null;
  if(type==='quarter'){
    const q=Number(fields.quarter.value);
    return span('quarter',year+'-Q'+q,year,q*3-2,3);
  }
  const financial=fields.basis.value==='financialYear';
  return span(financial?'financialYear':'year',String(year),financial?year-1:year,financial?7:1,12);
}
function span(type,key,year,firstMonth,length) {
  const start=new Date(Date.UTC(year,firstMonth-1,1));
  const end=new Date(Date.UTC(year,firstMonth+length-1,0));
  return {type,key,startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
}
function brisbaneDay(date){
  const fields=new Intl.DateTimeFormat('en-CA',{timeZone:brisbane,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const values=Object.fromEntries(fields.map(f=>[f.type,f.value]));
  return [values.year,values.month,values.day].join('-');
}

function reportTables(report) {
  const {totals,items,movements,history,valuation,categories}=report;
  return {
    summary:{
      heading:'Stock book totals',
      headings:['Sales received (AUD)','Recorded delivery cost (AUD)','Sales recorded','Units sold','Units delivered','Deliveries missing a cost','Shelf counts'],
      rows:[[amountsInDollars(totals.receivedCents),deliveryCost(totals),totals.salesCount,totals.unitsSold,totals.unitsDelivered,totals.deliveriesWithoutCost,totals.stocktakes]],
      moneyColumns:[0,1]
    },
    ...(report.bookings?{
      bookingTotals:{heading:'Ticket and service totals',headings:['Places sold','Booking sales recorded','Booking payments (AUD)'],
        rows:[[report.bookings.placesSold,report.bookings.salesCount,amountsInDollars(report.bookings.receivedCents)]],moneyColumns:[2]},
      bookingReceipts:{heading:'Booking payments',headings:['Date','Ticket or service','Places','Payment method','Amount received (AUD)'],
        rows:report.bookings.receipts.map(r=>[localDay.format(new Date(r.occurredAt)),r.name,r.places,r.paymentMethod==='cash'?'Cash':r.paymentMethod==='square'?'Square':r.paymentMethod||'',amountsInDollars(r.amountCents)]),
        moneyColumns:[4],empty:'No booking payments recorded in this period.'}
    }:{}),
    valuation:{
      heading:'Stock valuation summary',
      headings:['Coverage','Stock value or known subtotal (AUD)','Items valued','Items needing a shelf count','Items needing a unit cost'],
      rows:[[coverage(valuation),knownValue(valuation),valuation.valuedItems,valuation.uncountedItems,valuation.unpricedItems]],
      moneyColumns:[1]
    },
    categories:{
      heading:'Stock value by category',
      headings:['Category','Stock value or known subtotal (AUD)','Coverage','Items needing a shelf count','Items needing a unit cost'],
      rows:categories.map(c=>[c.name,knownValue(c),coverage(c),c.uncountedItems,c.unpricedItems]),
      moneyColumns:[1],empty:'There are no stock categories to value.'
    },
    valuationItems:{
      heading:'Stock values by item',
      headings:['Category','Item','Closing units','Unit cost (AUD)','Stock value (AUD)','Cost record'],
      rows:items.map(i=>[i.categoryName,i.label,i.closingUnits??unknown,i.basisUnitCents==null?'Unknown':amountsInDollars(i.basisUnitCents),
        i.closingValueCents==null?'Unknown':amountsInDollars(i.closingValueCents),basisInfo(i)]),
      moneyColumns:[3,4],unitMoneyColumn:3,empty:'There are no items to value.'
    },
    items:{
      heading:'Stock by item',
      headings:['Item','Opening units','Units delivered','Units sold','Sales received (AUD)','Closing units','Shelf counts'],
      rows:items.map(i=>[i.label,i.openingUnits??unknown,i.unitsDelivered,i.unitsSold,amountsInDollars(i.receivedCents),i.closingUnits??unknown,i.stocktakes]),
      moneyColumns:[4],empty:'There are no items in the club stock book.'
    },
    costs:{
      heading:'Delivery costs by item',
      headings:['Item','Units delivered','Recorded delivery cost (AUD)','Deliveries missing a cost'],
      rows:items.filter(i=>i.unitsDelivered>0).map(i=>[i.label,i.unitsDelivered,deliveryCost(i),i.deliveriesWithoutCost]),
      moneyColumns:[2],empty:'No deliveries were recorded for this period.'
    },
    deliveries:{
      heading:'Individual delivery costs',
      headings:['Date and time (AEST)','Item','Units delivered','Supplier cost (AUD)','Cost source'],
      rows:movements.filter(m=>m.kind==='delivery').map(m=>[localTime.format(new Date(m.occurredAt)),m.label,m.units,
        m.costCents==null?'Unknown':amountsInDollars(m.costCents),m.costSource??null]),
      moneyColumns:[3],empty:'No deliveries were recorded for this period.'
    },
    movements:{
      heading:'Stock book entries',
      headings:['Date and time (AEST)','Item','Entry','Units','Amount received (AUD)','Payment method','Units on hand after entry','Shelf count unit cost (AUD)'],
      rows:movements.map(m=>[localTime.format(new Date(m.occurredAt)),m.label,movementLabels[m.kind]||m.kind,m.units,amountsInDollars(m.amountCents),
        m.kind==='sale'?(paymentLabels[m.paymentMethod]||'Unrecorded'):null,m.afterUnits??unknown,amountsInDollars(m.unitCostCents)]),
      moneyColumns:[4,7],empty:'No stock book entries were recorded for this period.'
    },
    history:{
      heading:'Historical club records',
      headings:['Report date','Item','Record type','Units reported','Amount reported (AUD)','Description','Source'],
      rows:history.map(h=>[dateOnly(h.reportedOn),h.productName||'Club merchandise',movementLabels[h.kind]||h.kind,h.units,
        amountsInDollars(h.amountCents),h.description,h.source]),
      moneyColumns:[4],empty:'No historical club records are dated in this period.'
    }
  };
}

function csvCell(value) {
  let text=String(value??'');
  if(typeof value==='string' && (/^[\s\u0000-\u001F]*[=+\-@＝＋－＠]/u.test(text)||/^[\t\r\n]/.test(text)))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}

function fileText(report,tables,subtitle,valuationDate,review) {
  const rows=[['Sandy Sports Club',reportName],[report.period.label,periodDates(report.period)],[subtitle]];
  if(review)rows.push(['Private review on this PC']);
  for(const table of Object.values(tables)) {
    rows.push([], [table.heading]);
    if(table===tables.valuation)rows.push(['Stock value at',dateOnly(valuationDate)],[valuationRule]);
    if(table===tables.history)rows.push(['For reference only. Stock book totals use recorded stock movements.']);
    rows.push(table.headings);
    if(!table.rows.length)rows.push([table.empty]);
    for(const row of table.rows){
      rows.push(row.map((value,i)=>priceCell(table,i,value,true)));
    }
  }
  const width=Math.max(...Object.values(tables).map(t=>t.headings.length));
  return '\uFEFF'+rows.map(row=>Array.from({length:width},(_,i)=>csvCell(row[i])).join(',')).join('\r\n')+'\r\n';
}

function tableMarkup(table,esc) {
  if(!table.rows.length)return '<p class="report-empty">'+esc(table.empty)+'</p>';
  const head=table.headings.map(h=>'<th scope="col">'+esc(h)+'</th>').join('');
  const rows=table.rows.map(row=>'<tr>'+row.map((value,i)=>{
    const text=priceCell(table,i,value,false);
    return '<td data-label="'+esc(table.headings[i])+'">'+(text==null?'<span aria-label="No value">·</span>':esc(text))+'</td>';
  }).join('')+'</tr>').join('');
  return '<table class="report-table"><caption class="sr-only">'+esc(table.heading)+'</caption><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>';
}

function reportMarkup(report,tables,subtitle,valuationDate,review,esc) {
  const summary=tables.summary, stats=summary.rows[0].map((value,i)=>{
    const label=summary.headings[i];
    return '<div><dt>'+label+'</dt><dd>'+esc(priceCell(summary,i,value,false))+'</dd></div>';
  });
  return '<article class="report-sheet">'+
    '<header class="report-heading"><p>Sandy Sports Club'+(review?' · Private review on this PC':'')+'</p>'+
    '<h2>'+esc(report.period.label)+'</h2><p><strong>'+esc(periodDates(report.period))+'</strong><br>'+esc(reportName)+'<br>'+esc(subtitle)+'</p></header>'+
    '<dl class="report-stats">'+stats.join('')+'</dl>'+
    (tables.bookingTotals?'<h3>Tickets and services</h3>'+tableMarkup(tables.bookingTotals,esc):'')+
    valuationMarkup(report.valuation,valuationDate,tables.categories,esc)+
    [tables.bookingReceipts,tables.valuationItems,tables.items,tables.costs,tables.deliveries,tables.movements,tables.history].filter(Boolean).map(t=>'<details class="report-section"><summary>'+t.heading+' ('+t.rows.length+')</summary>'+
      (t===tables.history?'<p class="report-note">For reference only. Stock book totals use recorded stock movements.</p>':'')+
      tableMarkup(t,esc)+'</details>').join('')+'</article>';
}

function valuationMarkup(value,date,table,esc){
  const mode=coverage(value);
  const known=mode==='Unknown'?'Unknown':money.format(amountsInDollars(value.knownValueCents));
  const needs=[];
  if(value.uncountedItems)needs.push(value.uncountedItems+(value.uncountedItems===1?' item needs a shelf count':' items need a shelf count'));
  if(value.unpricedItems)needs.push(value.unpricedItems+(value.unpricedItems===1?' item needs a unit cost':' items need a unit cost'));
  const missing=needs.length?'<p>'+esc(needs.join(' and '))+'. In the stock book, enter a shelf count or record the cost on a delivery or shelf count. <a data-report-desk-link href="#stock">Go to treasurer’s desk</a></p>':'';
  return '<section class="report-section report-value"><h3>Stock value at '+esc(dateOnly(date))+'</h3>'+
    '<p class="report-value-figure">'+esc(known)+(mode==='Known subtotal'?' <small>Known subtotal</small>':'')+'</p>'+
    '<p class="report-note">'+valuationRule+'</p>'+missing+'<h4>'+table.heading+'</h4>'+tableMarkup(table,esc)+'</section>';
}

function saveFile(text,name) {
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export function setupStockReports({api,esc}) {
  const mount=document.getElementById('monthly-reports');
  if(!mount)return;
  let authorised=false,account=null,job=null,selected=null,printCopy=null,printTitle=null,oldTitle=null;
  const available=()=>authorised && location.hash==='#stock/reports';
  const status=()=>mount.querySelector('[data-report-status]');
  function finishPrint(){
    printCopy?.remove();printCopy=null;
    document.body.classList.remove('printing-stock-report');
    if(document.title===printTitle && oldTitle!=null)document.title=oldTitle;
    printTitle=null;oldTitle=null;
  }
  function forgetReport(){
    job?.abort();job=null;selected=null;finishPrint();
    mount.querySelector('[data-report-output]')?.replaceChildren();
    const button=mount.querySelector('[type=submit]');
    if(button)button.disabled=false;
  }
  function enter(){
    if(!available()){
      forgetReport();mount.replaceChildren();return;
    }
    if(mount.querySelector('form'))return;
    const now=new Date(),dates=yearsAndQuarter(now);
    mount.innerHTML='<h1 class="page-title">Stock and sales reports</h1><section class="panel stock-panel report-picker"><h2>Choose your reporting period</h2>'+
      '<p>See merchandise sales, stock values and payments for tickets and services. The club’s financial year runs from July to June.</p>'+
      '<form><label for="stock-report-period">Report period<select id="stock-report-period" name="period"><option value="month">Monthly</option><option value="quarter">Quarterly</option><option value="annual">Annual</option></select></label>'+
      '<label for="stock-report-month">Report month<input id="stock-report-month" name="month" type="month" placeholder="YYYY-MM" required value="'+
      defaultMonth(now)+'" max="'+monthOf(now)+'"></label>'+
      '<label for="stock-report-quarter" hidden>Quarter<select id="stock-report-quarter" name="quarter" disabled><option value="1">January to March</option><option value="2">April to June</option><option value="3">July to September</option><option value="4">October to December</option></select></label>'+
      '<label for="stock-report-basis" hidden>Year type<select id="stock-report-basis" name="basis" disabled><option value="financialYear">Club financial year (July to June)</option><option value="year">Calendar year (January to December)</option></select></label>'+
      '<label for="stock-report-year" hidden><span data-year-label>Year</span><input type="number" id="stock-report-year" name="year" step="1" min="1000" max="'+dates.year+'" required disabled></label>'+
      '<p class="report-range" data-range></p><button class="button" type="submit">Show report</button></form></section>'+
      '<p role="status" data-report-status></p><div data-report-output></div>';
    setFields(mount.querySelector('form'));
  }

  function setFields(form){
    const fields=form.elements,dates=yearsAndQuarter(new Date());
    const quarter=fields.period.value==='quarter',annual=fields.period.value==='annual',financial=annual&&fields.basis.value==='financialYear';
    for(const [field,show] of [[fields.month,!quarter&&!annual],[fields.quarter,quarter],[fields.year,quarter||annual],[fields.basis,annual]]){
      field.disabled=!show;field.closest('label').hidden=!show;
    }
    if(quarter)fields.quarter.value=String(dates.previousQuarter);
    form.querySelector('[data-year-label]').textContent=financial?'Year ending 30 June':'Calendar year';
    fields.year.max=financial?dates.financialYear:dates.year;
    fields.year.value=quarter?dates.previousQuarterYear:(financial?dates.financialYear:dates.year)-1;
    updateRange(form);
  }
  function updateRange(form){
    const selectedPeriod=chosenPeriod(form);
    form.querySelector('[data-range]').textContent=selectedPeriod?'Covers '+periodDates(selectedPeriod)+'.':'';
  }

  async function showReport(form) {
    forgetReport();
    const period=chosenPeriod(form);
    if(!period||period.startDate>brisbaneDay(new Date())){
      status().textContent='Choose a reporting period that has already started.';return;
    }
    const controller=new AbortController();job=controller;
    const button=form.querySelector('[type=submit]');button.disabled=true;
    status().textContent='Opening the report…';
    try{
      const report=await api('/api/stock/report?'+new URLSearchParams({[period.type]:period.key}),{signal:controller.signal,cache:'no-store'});
      if(job!==controller||!available())return;
      if(report.period?.type!==period.type||String(report.period.key)!==period.key||report.period.startDate!==period.startDate||report.period.endDate!==period.endDate)
        throw Error('The selected reporting dates could not be confirmed. Choose Show report to try again.');
      const now=new Date(),review=document.querySelector('.preview-bar')?.textContent.includes('Changes stay on this PC')===true;
      const today=brisbaneDay(now),valuationDate=report.period.endDate<today?report.period.endDate:today;
      const subtitle=(report.period.endDate>=today?'Figures to date. ':'')+'Prepared '+localTime.format(now)+' AEST. All amounts are Australian dollars.';
      const tables=reportTables(report);
      mount.querySelector('[data-report-output]').innerHTML='<div class="report-actions"><div><button class="button" type="button" data-report-csv>Download spreadsheet (CSV)</button><small>Your CSV file opens in Excel or Numbers. Find it in Downloads.</small></div>'+
        '<div><button class="button outline" type="button" data-report-print>Print / save PDF</button><small>Choose a printer or select Save as PDF in the print window.</small></div></div>'+reportMarkup(report,tables,subtitle,valuationDate,review,esc);
      selected={report,tables,subtitle,valuationDate,review};
      status().textContent='Report ready for '+report.period.label+'.';
    }catch(error){
      if(job!==controller||!available())return;
      status().textContent=error.message||'The report could not load. Choose Show report to try again.';
    }finally{
      if(job===controller){job=null;button.disabled=false;}
    }
  }
  function printReport(){
    finishPrint();
    printCopy=mount.querySelector('.report-sheet').cloneNode(true);
    printCopy.id='stock-report-print';
    for(const detail of printCopy.querySelectorAll('details')){
      const section=document.createElement('section'),heading=document.createElement('h3');
      heading.textContent=detail.querySelector('summary').textContent;
      detail.querySelector('summary').replaceWith(heading);section.className='report-section';
      section.append(...detail.childNodes);detail.replaceWith(section);
    }
    document.body.append(printCopy);document.body.classList.add('printing-stock-report');
    oldTitle=document.title;printTitle='Sandy Sports stock and sales '+selected.report.period.label;document.title=printTitle;
    try{window.print();}catch{finishPrint();status().textContent='Printing could not open in this browser. You can download the spreadsheet instead.';}
  }
  mount.addEventListener('submit',event=>{
    event.preventDefault();
    if(available())showReport(event.target);
  });
  mount.addEventListener('input',event=>{
    const form=event.target.form;
    if(form){forgetReport();status().textContent='';updateRange(form);}
  });
  mount.addEventListener('change',event=>{
    const form=event.target.form;
    if(!form)return;
    forgetReport();status().textContent='';
    if(['period','basis'].includes(event.target.name))setFields(form);else updateRange(form);
  });
  mount.addEventListener('click',event=>{
    if(!available()||!selected)return;
    if(event.target.closest('[data-report-csv]')){
      const {report,tables,subtitle,valuationDate,review}=selected;
      const {type,key}=report.period;
      const periodFile=type==='financialYear'?'FY-ending-'+key:type==='year'?'calendar-'+key:key;
      const name='Sandy-Sports-'+(review?'review-':'')+'stock-and-sales-'+periodFile+'.csv';
      saveFile(fileText(report,tables,subtitle,valuationDate,review),name);
      status().textContent='Look for '+name+' in Downloads, or in the folder you chose.';
    }
    if(event.target.closest('[data-report-print]'))printReport();
  });
  window.addEventListener('afterprint',finishPrint);
  window.addEventListener('plfc:navigated',enter);
  window.addEventListener('plfc:session-changed',event=>{
    const next=event.detail;
    if(account!==next?.identity?.id){forgetReport();mount.replaceChildren();}
    account=next?.identity?.id;authorised=Boolean(next?.authenticated&&next?.canManageStock);enter();
  });
  window.addEventListener('pagehide',()=>{forgetReport();mount.replaceChildren();});
  window.addEventListener('pageshow',enter);
}

