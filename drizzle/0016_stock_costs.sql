-- Keep the original receipt intact when an invoice arrives or is corrected later.
ALTER TABLE merch_movements ADD COLUMN initial_delivery_cost_cents INTEGER
  CHECK(initial_delivery_cost_cents IS NULL OR (kind='delivery' AND typeof(initial_delivery_cost_cents)='integer' AND initial_delivery_cost_cents BETWEEN 0 AND 100000000));
ALTER TABLE merch_movements ADD COLUMN unit_cost_cents INTEGER
  CHECK(unit_cost_cents IS NULL OR (kind='count' AND typeof(unit_cost_cents)='integer' AND unit_cost_cents BETWEEN 0 AND 100000000));
ALTER TABLE merch_movements ADD COLUMN initial_cost_source TEXT NOT NULL DEFAULT '';

CREATE TABLE merch_movement_costs (
  movement_id TEXT PRIMARY KEY NOT NULL REFERENCES merch_movements(id),
  cost_cents INTEGER NOT NULL CHECK(typeof(cost_cents)='integer' AND cost_cents BETWEEN 0 AND 100000000),
  source TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE merch_cost_history (
  movement_id TEXT NOT NULL REFERENCES merch_movements(id),
  version INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  source TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  PRIMARY KEY(movement_id,version)
);
CREATE TRIGGER merch_cost_delivery_only BEFORE INSERT ON merch_movement_costs
WHEN NOT EXISTS(SELECT 1 FROM merch_movements WHERE id=NEW.movement_id AND kind='delivery')
BEGIN SELECT RAISE(ABORT,'delivery_cost_only'); END;
CREATE TRIGGER merch_cost_initial AFTER INSERT ON merch_movements
WHEN NEW.initial_delivery_cost_cents IS NOT NULL
BEGIN
  INSERT INTO merch_movement_costs(movement_id,cost_cents,source,updated_by,updated_at)
    VALUES(NEW.id,NEW.initial_delivery_cost_cents,NEW.initial_cost_source,NEW.actor_id,NEW.occurred_at);
END;
CREATE TRIGGER merch_cost_history_insert AFTER INSERT ON merch_movement_costs
BEGIN
  INSERT INTO merch_cost_history VALUES(NEW.movement_id,NEW.version,NEW.cost_cents,NEW.source,NEW.updated_by,NEW.updated_at);
END;
CREATE TRIGGER merch_cost_history_update AFTER UPDATE ON merch_movement_costs
BEGIN
  INSERT INTO merch_cost_history VALUES(NEW.movement_id,NEW.version,NEW.cost_cents,NEW.source,NEW.updated_by,NEW.updated_at);
END;
CREATE INDEX merch_movement_dates ON merch_movements(occurred_at);
CREATE INDEX merch_movement_item_dates ON merch_movements(item_id,occurred_at,item_revision);
