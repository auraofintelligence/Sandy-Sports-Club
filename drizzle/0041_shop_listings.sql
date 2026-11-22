CREATE TABLE shop_listings (
  product_id TEXT PRIMARY KEY REFERENCES merch_products(id),
  kind TEXT NOT NULL CHECK(kind IN ('merchandise','ticket','service','donation')),
  mode TEXT NOT NULL CHECK(mode IN ('stock','places','enquiry','donation')),
  description TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  variable_amount INTEGER NOT NULL DEFAULT 0 CHECK(variable_amount IN (0,1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO shop_listings(product_id,kind,mode,published,updated_by,updated_at)
  SELECT id,'merchandise','stock',1,'migration',strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM merch_products WHERE id IN ('shirt','cooler','sticker');
UPDATE shop_listings SET description='Example only. Ask the club about designs and availability; the Treasurer will confirm prices.'
  WHERE product_id IN ('shirt','cooler','sticker');
CREATE TABLE shop_variants (
  stock_item_id TEXT PRIMARY KEY REFERENCES merch_stock_items(id),
  product_id TEXT NOT NULL REFERENCES shop_listings(product_id),
  style TEXT NOT NULL DEFAULT '',colour TEXT NOT NULL DEFAULT '',size TEXT NOT NULL DEFAULT '',
  combination TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(product_id,combination)
);
CREATE TABLE shop_listing_mutations (
  id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES shop_listings(product_id),actor TEXT NOT NULL,request_key TEXT NOT NULL
);
ALTER TABLE merch_shop_requests ADD COLUMN requested_variant_id TEXT REFERENCES shop_variants(stock_item_id);
ALTER TABLE merch_shop_requests ADD COLUMN requested_amount_cents INTEGER;
CREATE TRIGGER shop_match_requested_variant BEFORE UPDATE OF status ON merch_shop_requests
WHEN NEW.status IN ('confirmed','collected') AND NEW.requested_variant_id IS NOT NULL AND
  (NEW.requested_variant_id IS NOT NEW.stock_item_id OR NOT EXISTS(SELECT 1 FROM shop_variants WHERE stock_item_id=NEW.requested_variant_id AND active=1))
BEGIN SELECT RAISE(ABORT,'pickup_stock_conflict'); END;
DROP TRIGGER IF EXISTS merch_initial_price;
DROP TRIGGER IF EXISTS merch_changed_price;
CREATE TRIGGER merch_initial_price AFTER INSERT ON merch_shop_offers
WHEN NEW.price_cents IS NOT NULL AND EXISTS(SELECT 1 FROM shop_listings WHERE product_id=NEW.product_id AND published=1)
BEGIN
  INSERT INTO officer_price_changes(kind,item_id,title,old_cents,new_cents,actor_id,actor_login,changed_at)
    SELECT CASE l.kind WHEN 'merchandise' THEN 'merchandise' ELSE l.kind END,p.id,p.name,NULL,NEW.price_cents,NEW.updated_by,
      COALESCE((SELECT login FROM club_accounts WHERE id=NEW.updated_by),'Club officer'),NEW.updated_at
    FROM merch_products p JOIN shop_listings l ON l.product_id=p.id WHERE p.id=NEW.product_id;
END;
CREATE TRIGGER merch_changed_price AFTER UPDATE OF price_cents ON merch_shop_offers
WHEN OLD.price_cents IS NOT NEW.price_cents AND EXISTS(SELECT 1 FROM shop_listings WHERE product_id=NEW.product_id AND published=1)
BEGIN
  INSERT INTO officer_price_changes(kind,item_id,title,old_cents,new_cents,actor_id,actor_login,changed_at)
    SELECT l.kind,p.id,p.name,OLD.price_cents,NEW.price_cents,NEW.updated_by,
      COALESCE((SELECT login FROM club_accounts WHERE id=NEW.updated_by),'Club officer'),NEW.updated_at
    FROM merch_products p JOIN shop_listings l ON l.product_id=p.id WHERE p.id=NEW.product_id;
END;
CREATE TRIGGER shop_publish_price AFTER UPDATE OF published ON shop_listings
WHEN NEW.published<>OLD.published AND EXISTS(SELECT 1 FROM merch_shop_offers WHERE product_id=NEW.product_id AND price_cents IS NOT NULL)
BEGIN
  INSERT INTO officer_price_changes(kind,item_id,title,old_cents,new_cents,actor_id,actor_login,changed_at)
    SELECT NEW.kind,p.id,p.name,CASE WHEN OLD.published=1 THEN o.price_cents END,CASE WHEN NEW.published=1 THEN o.price_cents END,
      NEW.updated_by,COALESCE((SELECT login FROM club_accounts WHERE id=NEW.updated_by),'Club officer'),NEW.updated_at
    FROM merch_products p JOIN merch_shop_offers o ON o.product_id=p.id WHERE p.id=NEW.product_id;
END;
