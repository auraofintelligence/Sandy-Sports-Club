const keyPatterns = {
  month: /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/,
  quarter: /^(?!0000)\d{4}-Q[1-4]$/,
  year: /^(?!0000)\d{4}$/,
  financialYear: /^(?!0000)\d{4}$/,
};
const monthName = new Intl.DateTimeFormat('en-AU', {month:'long', year:'numeric', timeZone:'UTC'});

export function reportRange(parameters, HttpError) {
  const entries = [...parameters];
  const [type, key] = entries[0] || [];
  if (entries.length !== 1 || !Object.hasOwn(keyPatterns, type) || key !== key.trim() || !keyPatterns[type].test(key)) {
    if (entries.length === 1 && type === 'month') throw new HttpError(400, 'Choose a calendar month.', 'invalid_report_month');
    throw new HttpError(400, 'Choose one month, quarter, calendar year or financial year.', 'invalid_report_period');
  }
  const year = Number(key.slice(0, 4));
  let startYear = year, startMonth = 0, months = 12, label = 'Calendar year ' + key;
  switch (type) {
    case 'month':
      startMonth = Number(key.slice(5)) - 1;
      months = 1;
      break;
    case 'quarter':
      startMonth = (Number(key.slice(-1)) - 1) * 3;
      months = 3;
      label = key.slice(-2) + ' ' + year;
      break;
    case 'financialYear':
      startYear = year - 1;
      startMonth = 6;
      label = 'Financial year ' + startYear + '/' + key.slice(-2);
      break;
  }
  const first = new Date(0);
  first.setUTCFullYear(startYear, startMonth, 1);
  const following = new Date(first);
  following.setUTCMonth(startMonth + months);
  const last = new Date(following.getTime() - 86400000);
  const startDate = first.toISOString().slice(0, 10), endDate = last.toISOString().slice(0, 10);
  const period = {type, key, label:type === 'month' ? monthName.format(first) : label, startDate, endDate};
  // UTC ledger timestamps use the half-open interval between two Brisbane midnights.
  const midnightBrisbane = day => new Date(day.getTime() - 10 * 3600000).toISOString();
  return {period, start:midnightBrisbane(first), end:midnightBrisbane(following)};
}

export function monthlyStockReport(db, month, HttpError) {
  return stockPeriodReport(db, new URLSearchParams({month:typeof month === 'string' ? month : ''}), HttpError);
}

function closingValuation(items) {
  const empty = () => ({knownValueCents:0, valuedItems:0, uncountedItems:0, unpricedItems:0});
  const valuation = empty(), grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.categoryId)) {
      grouped.set(item.categoryId, {id:item.categoryId, name:item.categoryName, ...empty()});
    }
    const category = grouped.get(item.categoryId);
    item.closingValueCents = null;
    if (item.closingUnits === null) {
      category.uncountedItems++;
      valuation.uncountedItems++;
    } else if (item.closingUnits > 0 && item.basisCents === null) {
      category.unpricedItems++;
      valuation.unpricedItems++;
    } else {
      // Multiply before dividing so an invoice split over several units only rounds at the SKU total.
      item.closingValueCents = item.closingUnits === 0 ? 0 : Math.round(item.closingUnits * item.basisCents / item.basisUnits);
      category.valuedItems++;
      valuation.valuedItems++;
      category.knownValueCents += item.closingValueCents;
      valuation.knownValueCents += item.closingValueCents;
    }
  }
  return {valuation, categories:[...grouped.values()]};
}

export async function stockPeriodReport(db, parameters, HttpError) {
  const {period, start, end} = reportRange(parameters, HttpError);
  const extended=await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='shop_listings' AND type='table'").first();
  const [opening, ledger, archive] = await db.batch([
    db.prepare(`SELECT i.id AS itemId, i.label, p.id AS categoryId, p.name AS categoryName,`+
      (extended?'(SELECT mode FROM shop_listings WHERE product_id=p.id) AS offeringMode,':'')+`
      basis.occurred_at AS basisDate, basis.kind AS basisKind,
      NULLIF(CASE WHEN basis.kind='count' THEN basis.initial_cost_source ELSE receipt.source END, '') AS basisSource,
      CASE WHEN basis.kind='delivery' THEN receipt.cost_cents ELSE basis.unit_cost_cents END AS basisCents,
      CASE basis.kind WHEN 'delivery' THEN basis.units WHEN 'count' THEN 1 END AS basisUnits,
      (SELECT m.after_units FROM merch_movements m WHERE m.item_id = i.id AND m.occurred_at < ?
       ORDER BY m.occurred_at DESC, m.item_revision DESC LIMIT 1) AS openingUnits
      FROM merch_stock_items i JOIN merch_products p ON p.id = i.product_id
      LEFT JOIN merch_movements basis ON basis.id = (
        SELECT m.id FROM merch_movements m LEFT JOIN merch_movement_costs c ON c.movement_id = m.id
        WHERE m.item_id = i.id AND m.occurred_at < ?
        AND ((m.kind='count' AND m.unit_cost_cents IS NOT NULL) OR (m.kind='delivery' AND c.cost_cents IS NOT NULL))
        ORDER BY m.occurred_at DESC, m.item_revision DESC LIMIT 1)
      LEFT JOIN merch_movement_costs receipt ON receipt.movement_id = basis.id
      ORDER BY p.display_order, i.label, i.id`).bind(start, end),
    db.prepare(`SELECT m.item_id AS itemId, m.occurred_at AS occurredAt, i.label, m.kind, m.units,
      m.amount_cents AS amountCents, m.after_units AS afterUnits, pickup.payment_method AS paymentMethod,
      cost.cost_cents AS costCents, NULLIF(cost.source,'') AS costSource, m.unit_cost_cents AS unitCostCents
      FROM merch_movements m JOIN merch_stock_items i ON i.id = m.item_id
      LEFT JOIN merch_shop_requests pickup ON m.id LIKE 'pickup-%' AND pickup.reference = substr(m.id, 8)
        AND pickup.status = 'collected'
      LEFT JOIN merch_movement_costs cost ON m.kind = 'delivery' AND m.id = cost.movement_id
      WHERE m.occurred_at >= ? AND m.occurred_at < ?
      ORDER BY m.occurred_at, m.rowid`).bind(start, end),
    db.prepare(`SELECT r.reported_on AS reportedOn, r.kind, p.name AS productName, r.description,
      r.units, r.amount_cents AS amountCents, r.source
      FROM merch_source_records r LEFT JOIN merch_products p ON p.id = r.product_id
      WHERE substr(r.reported_on, 1, 7) BETWEEN ? AND ? ORDER BY r.reported_on, r.id`)
      .bind(period.startDate.slice(0, 7), period.endDate.slice(0, 7)),
  ]);
  const costs = {knownDeliveryCostCents:0, deliveriesWithCost:0, deliveriesWithoutCost:0};
  const seats=new Map(opening.results.filter(r=>r.offeringMode==='places').map(r=>[r.itemId,r]));
  const bookings={placesSold:0,receivedCents:0,salesCount:0,receipts:[]};
  for(const movement of ledger.results){
    const seat=seats.get(movement.itemId);
    if(!seat || movement.kind!=='sale')continue;
    bookings.placesSold+=movement.units;bookings.receivedCents+=movement.amountCents;bookings.salesCount++;
    bookings.receipts.push({itemId:seat.itemId,productId:seat.categoryId,name:seat.categoryName,occurredAt:movement.occurredAt,places:movement.units,
      amountCents:movement.amountCents,paymentMethod:movement.paymentMethod});
  }
  const items = opening.results.filter(row=>!seats.has(row.itemId)).map(row => ({
    ...row, basisUnitCents:row.basisCents === null ? null : row.basisCents / row.basisUnits,
    unitsDelivered: 0, unitsSold: 0, receivedCents: 0, closingUnits: row.openingUnits, stocktakes: 0, ...costs,
  }));
  const byItem = new Map(items.map(item => [item.itemId, item]));
  const totals = {salesCount: 0, unitsSold: 0, receivedCents: 0, unitsDelivered: 0, stocktakes: 0, ...costs};
  const movements = ledger.results.filter(row=>!seats.has(row.itemId)).map(({itemId, ...movement}) => {
    const item = byItem.get(itemId);
    item.closingUnits = movement.afterUnits;
    switch (movement.kind) {
      case 'sale':
        totals.salesCount++;
        totals.unitsSold += movement.units;
        totals.receivedCents += movement.amountCents;
        item.unitsSold += movement.units;
        item.receivedCents += movement.amountCents;
        break;
      case 'delivery':
        totals.unitsDelivered += movement.units;
        item.unitsDelivered += movement.units;
        if (movement.costCents === null) {
          totals.deliveriesWithoutCost++;
          item.deliveriesWithoutCost++;
        } else {
          totals.deliveriesWithCost++;
          item.deliveriesWithCost++;
          totals.knownDeliveryCostCents += movement.costCents;
          item.knownDeliveryCostCents += movement.costCents;
        }
        break;
      case 'count':
        totals.stocktakes++;
        item.stocktakes++;
        break;
    }
    return movement;
  });
  return {...(period.type === 'month' ? {month:period.key} : {}), period, totals, items,bookings,
    ...closingValuation(items), movements, history: archive.results};
}
