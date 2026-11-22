const cents = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000000;

export function stockCostFields(body, HttpError) {
  const total=body.costCents ?? null, unit=body.unitCostCents ?? null;
  if ((total!==null && (body.kind!=='delivery' || !cents(total))) ||
      (unit!==null && (body.kind!=='count' || !cents(unit)))) {
    throw new HttpError(400,'Check the dollar amount entered for this stock change.','invalid_stock_cost');
  }
  const input=body.costSource ?? '';
  if (typeof input!=='string' || input.length>180 || /[\x00-\x1f\x7f]/.test(input) || (input.trim() && total===null && unit===null)) {
    throw new HttpError(400,'Add a cost with the supplier or invoice reference, or leave both blank.','invalid_cost_source');
  }
  return {total,unit,source:input.trim()};
}

export async function deliveryInvoices(db,request,identity,{json,bodyJson,HttpError}) {
  if(request.method==='GET'){
    const params=new URL(request.url).searchParams,filter=params.get('filter')??'missing';
    const before=Number(params.get('before')??Number.MAX_SAFE_INTEGER);
    if(!['missing','all'].includes(filter)||!Number.isSafeInteger(before)||before<1)throw new HttpError(400,'Choose a list of deliveries.','invalid_deliveries');
    const found=await db.prepare(`SELECT m.rowid AS seq,m.id,i.label,m.units,m.occurred_at AS occurredAt,
      c.cost_cents AS costCents, c.source AS costSource,COALESCE(c.version,0) AS version
      FROM merch_movements m JOIN merch_stock_items i ON i.id=m.item_id LEFT JOIN merch_movement_costs c ON c.movement_id=m.id
      WHERE m.kind='delivery' AND m.rowid<? AND (?='all' OR c.movement_id IS NULL)
      ORDER BY m.rowid DESC LIMIT 51`).bind(before,filter).all();
    return json({deliveries:found.results.slice(0,50),next:found.results.length>50?found.results[49].seq:null});
  }
  if(request.method!=='POST')throw new HttpError(405,'Open the delivery invoice form.','method_not_allowed');
  const data=await bodyJson(request);
  if(typeof data.id!=='string' || !data.id.length || data.id.length>120 || !Number.isSafeInteger(data.version) || data.version<0 ||
     !cents(data.costCents) || Object.keys(data).some(k=>!['id','version','costCents','costSource'].includes(k))){
    throw new HttpError(400,'Choose a delivery and enter the total supplier cost for this item.','invalid_delivery_cost');
  }
  const {total,source}=stockCostFields({...data,kind:'delivery'},HttpError);
  const stamp=new Date().toISOString();
  const [write,read]=await db.batch([
    db.prepare(`INSERT INTO merch_movement_costs(movement_id,cost_cents,source,version,updated_by,updated_at)
      SELECT m.id,?,?,1,?,? FROM merch_movements m LEFT JOIN merch_movement_costs old ON old.movement_id=m.id
      WHERE m.id=? AND m.kind='delivery' AND COALESCE(old.version,0)=?
      AND (old.cost_cents IS NOT ? OR old.source IS NOT ?)
      ON CONFLICT(movement_id) DO UPDATE SET cost_cents=excluded.cost_cents,source=excluded.source,
        version=merch_movement_costs.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .bind(total,source,identity.id,stamp,data.id,data.version,total,source),
    db.prepare('SELECT cost_cents AS costCents,source,version,updated_by AS actor FROM merch_movement_costs WHERE movement_id=?').bind(data.id)
  ]);
  const saved=read.results[0];
  const matching=saved && saved.costCents===total && saved.source===source;
  if(!(write.meta.changes || (matching && (saved.version===data.version || (saved.version===data.version+1 && saved.actor===identity.id))))) {
    throw new HttpError(409,'This delivery changed. Reload the deliveries and check its invoice cost.','invoice_conflict');
  }
  return json({id:data.id,version:saved.version,costCents:saved.costCents,costSource:saved.source});
}
