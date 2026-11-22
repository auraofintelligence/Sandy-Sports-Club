CREATE TABLE shop_photos (
  product_id TEXT NOT NULL REFERENCES shop_listings(product_id),
  variant_key TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL UNIQUE,
  jpeg TEXT,
  alt TEXT NOT NULL DEFAULT '',
  mutation_id TEXT NOT NULL,
  mutation_key TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(product_id, variant_key)
);
