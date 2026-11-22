import {stockPeriodReport} from './stock-reports.mjs';
import {deliveryInvoices,stockCostFields} from './stock-costs.mjs';
import {listings} from './shop-listings.mjs';
import {attachShopPhotos} from './shop-photos.mjs';

export function canManageStock(identity, env) {
  if (!identity) return false;
  if (identity.canManageStock === true) return true;
  if (identity.role !== 'committee' || !identity.id?.startsWith('access:')) return false;
  const allowed = String(env.TREASURER_EMAILS || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return allowed.includes(identity.email?.toLowerCase());
}

async function readStock(db) {
  const extended=await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='shop_listings' AND type='table'").first();
  const seat="EXISTS(SELECT 1 FROM shop_listings l JOIN merch_stock_items i ON i.product_id=l.product_id WHERE i.id=m.item_id AND l.mode='places')";
  const total="SELECT COUNT(*) AS saleCount,COALESCE(SUM(m.units),0) AS units,COALESCE(SUM(m.amount_cents),0) AS totalCents FROM merch_movements m WHERE m.kind='sale'";
  const [items, movements, evidence, totals,bookings] = await db.batch([
    db.prepare('SELECT i.id,i.product_id AS productId,i.label,i.on_hand AS onHand,i.revision,p.name AS productName'+
      (extended?',l.kind AS offeringKind,l.mode AS offeringMode,v.stock_item_id AS variantId':'')+
      ' FROM merch_stock_items i JOIN merch_products p ON p.id=i.product_id '+
      (extended?'LEFT JOIN shop_listings l ON l.product_id=p.id LEFT JOIN shop_variants v ON v.stock_item_id=i.id ':'')+'ORDER BY p.display_order,i.label'),
    db.prepare(`SELECT m.id,m.kind, i.label, m.units, m.amount_cents AS amountCents, m.after_units AS afterUnits, m.occurred_at AS occurredAt,
      c.cost_cents AS costCents,m.unit_cost_cents AS unitCostCents
      FROM merch_movements m JOIN merch_stock_items i ON i.id = m.item_id
      LEFT JOIN merch_movement_costs c ON c.movement_id=m.id`+(extended?' WHERE NOT '+seat:'')+
      ' ORDER BY m.occurred_at DESC, m.rowid DESC LIMIT 100'),
    db.prepare(`SELECT p.name AS productName, r.reported_on AS reportedOn, r.kind, r.description,
      r.units, r.amount_cents AS amountCents, r.source
      FROM merch_source_records r LEFT JOIN merch_products p ON p.id = r.product_id
      ORDER BY r.reported_on DESC, r.id`),
    db.prepare(total+(extended?' AND NOT '+seat:'')),...(extended?[db.prepare(total+' AND '+seat)]:[]),
  ]);
  return {items: items.results, movements: movements.results, evidence: evidence.results, sales: totals.results[0],...(bookings?{bookingSales:bookings.results[0]}:{})};
}

function validateMovement(body, HttpError) {
  const {id, itemId, kind, units, revision, amountCents} = body;
  const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || '') ||
    typeof itemId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(itemId) ||
    !['count', 'sale', 'delivery'].includes(kind) || !integer(units, kind === 'count' ? 0 : 1, 999999) ||
    !integer(revision, 0, 2147483646) || Object.keys(body).some(key => !['id', 'itemId', 'kind', 'units', 'revision', 'amountCents','costCents','unitCostCents','costSource'].includes(key))) {
    throw new HttpError(400, 'Choose an item and enter a whole number of units.', 'invalid_movement');
  }
  if (kind === 'sale' ? !integer(amountCents, 0, 100000000) : amountCents != null) {
    throw new HttpError(400, 'For a sale, enter the total actually received in Australian dollars.', 'invalid_amount');
  }
}

async function recordMovement(db, body, identity, HttpError) {
  validateMovement(body, HttpError);
  const cost=stockCostFields(body,HttpError);
  const {id, itemId, kind, units, revision} = body;
  const amountCents = body.amountCents ?? null;
  if(kind==='delivery'||cost.unit!==null||cost.total!==null){
    const extended=await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='shop_listings' AND type='table'").first();
    if(extended && await db.prepare("SELECT 1 FROM merch_stock_items i JOIN shop_listings l ON l.product_id=i.product_id WHERE i.id=? AND l.mode='places'").bind(itemId).first())
      throw new HttpError(400,'Update remaining places as a count. Supplier costs and deliveries apply to physical stock.','place_capacity');
  }
  const occurredAt = new Date().toISOString();
  // Only an observed revision can advance. A count establishes the first known balance.
  // Until then, receipts and sales are recorded with a deliberately unknown balance.
  const result = await db.prepare(`INSERT INTO merch_movements
    (id, item_id, kind, units, amount_cents, after_units, item_revision, actor_id, occurred_at, initial_delivery_cost_cents, unit_cost_cents, initial_cost_source)
    SELECT ?, id, ?, ?, ?, CASE ? WHEN 'count' THEN ? WHEN 'sale' THEN on_hand - ? ELSE on_hand + ? END,
      revision + 1, ?, ?, ?, ?, ?
    FROM merch_stock_items WHERE id = ? AND revision = ?
      AND (? <> 'sale' OR on_hand IS NULL OR on_hand >= ?)
      AND (? <> 'delivery' OR on_hand IS NULL OR on_hand + ? <= 999999)
    ON CONFLICT(id) DO NOTHING`).bind(id, kind, units, amountCents, kind, units, units, units,
      identity.id, occurredAt, cost.total, cost.unit, cost.source, itemId, revision, kind, units, kind, units).run();
  if (result.meta?.changes) return;
  const previous = await db.prepare('SELECT actor_id, item_id, kind, units, amount_cents, item_revision, initial_delivery_cost_cents, unit_cost_cents, initial_cost_source FROM merch_movements WHERE id = ?').bind(id).first();
  if (previous && previous.actor_id === identity.id && previous.item_id === itemId &&
      previous.kind === kind && previous.units === units && previous.amount_cents === amountCents && previous.item_revision === revision + 1 &&
      previous.initial_delivery_cost_cents===cost.total && previous.unit_cost_cents===cost.unit && previous.initial_cost_source===cost.source) return;
  throw new HttpError(409, 'Check the latest stock count and the number of units, then review the change again.', 'stock_conflict');
}

export async function stockEndpoint(path, request, env, identity, {json, bodyJson, HttpError, requireDb}) {
  if (path === '/api/shop/catalogue') {
    if (request.method !== 'GET') throw new HttpError(405, 'The public catalogue is available to browse.', 'method_not_allowed');
    const db = requireDb(env);
    try {
      if(await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='shop_listings' AND type='table'").first()){
        return json({products:await attachShopPhotos(db,await listings(db,false))});
      }
      // Older databases only have the three confirmed catalogue items.
      const catalogue = await db.prepare("SELECT id, name FROM merch_products WHERE id IN ('shirt','cooler','sticker') ORDER BY display_order, id").all();
      return json({products: catalogue.results});
    } catch {
      throw new HttpError(503, 'The club catalogue could not load. Please try again.', 'catalogue_unavailable');
    }
  }
  if (!canManageStock(identity, env)) {
    throw new HttpError(identity ? 403 : 401, 'Sign in with treasurer access to open the shared stock book.', 'stock_access_required');
  }
  const report = path === '/api/stock/report';
  if (report && request.method !== 'GET') {
    throw new HttpError(405, 'Open Reports to view or export a report.', 'method_not_allowed');
  }
  if (!['GET','POST'].includes(request.method)) {
    throw new HttpError(405, 'This action is not available.', 'method_not_allowed');
  }
  const db = requireDb(env);
  // Use the primary for an authorised stocktake so an immediate read reflects its receipt.
  const book = typeof db.withSession === 'function' ? db.withSession('first-primary') : db;
  try {
    if (report) return json(await stockPeriodReport(book, new URL(request.url).searchParams, HttpError));
    if (path==='/api/stock/delivery-costs') return await deliveryInvoices(book,request,identity,{json,bodyJson,HttpError});
    if (request.method === 'POST') await recordMovement(book, await bodyJson(request), identity, HttpError);
    return json(await readStock(book));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (report) throw new HttpError(503, 'The stock and sales report could not load. Choose Show report to try again.', 'stock_report_unavailable');
    if (String(error).includes('merch_units_reserved')) throw new HttpError(409,'Some units are held for confirmed pickups. Check the pickup requests before reducing this balance.','reserved_stock');
    throw new HttpError(503, 'The stock book could not confirm the result. Refresh before trying again.', 'stock_storage_unavailable');
  }
}
