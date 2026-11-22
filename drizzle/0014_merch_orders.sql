CREATE TABLE merch_shop_offers (
  product_id TEXT PRIMARY KEY REFERENCES merch_products(id),
  price_cents INTEGER CHECK(price_cents BETWEEN 1 AND 1000000),
  sizes_json TEXT NOT NULL DEFAULT '[]',
  checkout_url TEXT,
  version INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL, last_key TEXT NOT NULL, mutation TEXT NOT NULL
);
CREATE TABLE merch_shop_throttle (
  bucket_key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX merch_shop_throttle_expiry ON merch_shop_throttle(expires_at);
CREATE TABLE merch_shop_policy(id INTEGER PRIMARY KEY CHECK(id=1), throttle_salt TEXT NOT NULL);
INSERT INTO merch_shop_policy VALUES(1,lower(hex(randomblob(32))));
CREATE TABLE merch_shop_requests (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL UNIQUE, reference TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('enquiry','pickup')), product_id TEXT NOT NULL REFERENCES merch_products(id),
  name TEXT NOT NULL, email TEXT NOT NULL, mobile TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
  size TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', consent_version TEXT NOT NULL,
  listed_unit_cents INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','confirmed','closed','collected')),
  staff_note TEXT NOT NULL DEFAULT '', quote_cents INTEGER CHECK(quote_cents BETWEEN 0 AND 100000000),
  pickup_details TEXT NOT NULL DEFAULT '', pickup_at TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1, updated_by TEXT, last_update_key TEXT,
  stock_item_id TEXT REFERENCES merch_stock_items(id), stock_revision INTEGER, amount_cents INTEGER,
  payment_method TEXT CHECK(payment_method IN ('cash','square'))
);
CREATE INDEX merch_shop_holds ON merch_shop_requests(stock_item_id,status);
CREATE TRIGGER merch_confirm_hold BEFORE UPDATE ON merch_shop_requests WHEN NEW.status='confirmed' BEGIN
  SELECT CASE WHEN NEW.kind<>'pickup' OR NOT EXISTS(
    SELECT 1 FROM merch_stock_items i WHERE i.id=NEW.stock_item_id AND i.product_id=NEW.product_id AND i.revision=NEW.stock_revision
    AND i.on_hand-COALESCE((SELECT SUM(r.quantity) FROM merch_shop_requests r WHERE r.stock_item_id=i.id AND r.status='confirmed' AND r.seq<>NEW.seq),0)>=NEW.quantity)
    THEN RAISE(ABORT,'pickup_stock_conflict') END;
END;
CREATE TRIGGER merch_keep_held_units BEFORE INSERT ON merch_movements
WHEN NEW.kind IN ('sale','count') AND EXISTS(SELECT 1 FROM merch_shop_requests WHERE stock_item_id=NEW.item_id AND status='confirmed')
BEGIN
  SELECT CASE WHEN NEW.after_units IS NULL OR NEW.after_units<(SELECT SUM(quantity) FROM merch_shop_requests WHERE stock_item_id=NEW.item_id AND status='confirmed')
    THEN RAISE(ABORT,'merch_units_reserved') END;
END;
CREATE TRIGGER merch_pickup_sale AFTER UPDATE OF status ON merch_shop_requests
WHEN NEW.status='collected' AND OLD.status<>'collected'
BEGIN
  SELECT CASE WHEN OLD.status<>'confirmed' OR NEW.kind<>'pickup' OR NEW.stock_item_id IS NOT OLD.stock_item_id OR NEW.payment_method IS NULL
    OR NEW.amount_cents IS NULL OR NEW.amount_cents IS NOT NEW.quote_cents
    OR NOT EXISTS(SELECT 1 FROM merch_stock_items WHERE id=NEW.stock_item_id AND product_id=NEW.product_id
      AND on_hand>=NEW.quantity AND revision=NEW.stock_revision)
    THEN RAISE(ABORT,'pickup_stock_conflict') END;
  INSERT INTO merch_movements(id,item_id,kind,units,amount_cents,after_units,item_revision,actor_id,occurred_at)
  SELECT 'pickup-'||NEW.reference,id,'sale',NEW.quantity,NEW.amount_cents,on_hand-NEW.quantity,revision+1,NEW.updated_by,NEW.updated_at
    FROM merch_stock_items WHERE id=NEW.stock_item_id;
END;
