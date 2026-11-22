import {canManageStock} from './stock.mjs';
import {reportRange} from './stock-reports.mjs';

const events = {approved:'Offer approved',accepted:'Offer accepted',granted:'Free year granted'};
const categoryNames = {adult:'Adult',cadet:'Cadet',junior:'Junior',social:'Social',casual:'Casual',lifetime:'Lifetime',unconfirmed:'Unconfirmed'};
const localTime = new Intl.DateTimeFormat('en-AU', {
  timeZone:'Australia/Brisbane', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23',
});

async function buildReport(db, range) {
  const {period,start,end} = range;
  // Events can fall in separate periods, and an approved offer may never result in a grant.
  const {results:rows} = await db.prepare(`SELECT reference,category,event,occurredAt,previousThrough,paidThrough,waivedFeeCents FROM (
    SELECT id AS reference,category,'approved' AS event,approvedAt AS occurredAt,NULL AS previousThrough,NULL AS paidThrough,NULL AS waivedFeeCents,1 AS step
      FROM returning_member_waivers WHERE approvedAt>=?1 AND approvedAt<?2
    UNION ALL SELECT id,category,'accepted',acceptedAt,NULL,NULL,NULL,2
      FROM returning_member_waivers WHERE acceptedAt>=?1 AND acceptedAt<?2
    UNION ALL SELECT id,category,'granted',grantedAt,previousThrough,paidThrough,waivedFeeCents,3
      FROM returning_member_waivers WHERE grantedAt>=?1 AND grantedAt<?2
    ) ORDER BY occurredAt,reference,step`).bind(start,end).all();
  const totals = {approvedCount:0,acceptedCount:0,grantedCount:0,knownWaivedFeeCents:0,valuedGrantCount:0,unpricedGrantCount:0,cashReceivedCents:0};
  for (const row of rows) {
    totals[row.event+'Count']++;
    if (row.event !== 'granted') continue;
    if (row.waivedFeeCents === null) totals.unpricedGrantCount++;
    else {
      totals.valuedGrantCount++;
      totals.knownWaivedFeeCents += row.waivedFeeCents;
    }
  }
  return {period,totals,rows};
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]|^[\t\r]/.test(text)) text = "'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}

function csvReport({period,totals,rows}) {
  const dollars = cents => (cents / 100).toFixed(2);
  const lines = [
    ['Sandy Sports Club','Returning member complimentary years'],
    ['Reporting period',period.label],['Brisbane dates',period.startDate,period.endDate],
    ['Offers approved',totals.approvedCount],['Offers accepted',totals.acceptedCount],['Free years granted',totals.grantedCount],
    ['Known annual fees waived (AUD)',dollars(totals.knownWaivedFeeCents)],
    ['Grants with a recorded annual fee',totals.valuedGrantCount],['Grants without a recorded annual fee',totals.unpricedGrantCount],
    ['Cash received (AUD)',dollars(totals.cashReceivedCents)],[],
    ['Offer reference','Category','Event','Date and time (Brisbane)','Previous membership through','Complimentary membership through','Annual fee waived (AUD)'],
  ];
  for (const row of rows) {
    const fee = row.waivedFeeCents === null ? (row.event === 'granted' ? 'Unknown' : '') : dollars(row.waivedFeeCents);
    lines.push([row.reference,categoryNames[row.category] || 'Unconfirmed',events[row.event],localTime.format(new Date(row.occurredAt)),row.previousThrough,row.paidThrough,fee]);
  }
  return '\uFEFF'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

export async function waiverReportEndpoint(request,env,identity,{json,response,requireRole,requireDb,HttpError}) {
  requireRole(identity,['committee']);
  if (!canManageStock(identity,env)) throw new HttpError(403,'Treasurer access is needed to open the membership waiver report.','treasurer_required');
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405,'Open the report to view or download it.','method_not_allowed');
  const url = new URL(request.url);
  const range = reportRange(url.searchParams,HttpError);
  const store = requireDb(env);
  const db = store.withSession?.('first-primary') || store;
  const csv = url.pathname.endsWith('.csv');
  const headers = {'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
  if (csv) {
    headers['Content-Type']='text/csv; charset=utf-8';
    headers['Content-Disposition']='attachment; filename="Sandy-Sports-membership-waivers-'+range.period.type+'-'+range.period.key+'.csv"';
  } else headers['Content-Type']='application/json; charset=utf-8';
  if (request.method === 'HEAD') return response(null,200,headers);
  const report = await buildReport(db,range);
  return csv ? response(csvReport(report),200,headers) : json(report,200,headers);
}
