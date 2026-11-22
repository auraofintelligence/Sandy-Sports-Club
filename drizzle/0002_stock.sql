CREATE TABLE merch_products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  public_note TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE merch_stock_items (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES merch_products(id),
  label TEXT NOT NULL,
  on_hand INTEGER CHECK (on_hand BETWEEN 0 AND 999999),
  revision INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);

CREATE TABLE merch_source_records (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT REFERENCES merch_products(id),
  reported_on TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  units INTEGER CHECK (units >= 0),
  amount_cents INTEGER CHECK (amount_cents >= 0),
  source TEXT NOT NULL
);

CREATE TABLE merch_movements (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL REFERENCES merch_stock_items(id),
  kind TEXT NOT NULL CHECK (kind IN ('count', 'delivery', 'sale')),
  units INTEGER NOT NULL CHECK (units BETWEEN 0 AND 999999 AND (kind = 'count' OR units > 0)),
  amount_cents INTEGER CHECK ((kind = 'sale' AND amount_cents IS NOT NULL AND amount_cents >= 0) OR (kind <> 'sale' AND amount_cents IS NULL)),
  after_units INTEGER CHECK (after_units BETWEEN 0 AND 999999),
  item_revision INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE (item_id, item_revision)
);

CREATE TRIGGER merch_apply_movement AFTER INSERT ON merch_movements BEGIN
  UPDATE merch_stock_items SET on_hand = NEW.after_units, revision = NEW.item_revision WHERE id = NEW.item_id;
  INSERT INTO audit_log (id, actor_id, actor_role, action, entity_id, occurred_at)
  VALUES ('stock-' || NEW.id, NEW.actor_id, 'treasurer', 'stock_' || NEW.kind, NEW.item_id, NEW.occurred_at);
END;
