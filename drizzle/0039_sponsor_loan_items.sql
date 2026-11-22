CREATE TABLE club_equipment_offer_items (
  item_id TEXT PRIMARY KEY REFERENCES club_equipment(id),
  source_offer_id TEXT NOT NULL,
  item_key TEXT,
  UNIQUE(source_offer_id,item_key)
);
INSERT INTO club_equipment_offer_items(item_id,source_offer_id)
  SELECT id,source_offer_id FROM club_equipment WHERE source_offer_id IS NOT NULL;
