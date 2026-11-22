CREATE TABLE club_equipment (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('club','member','officer','sponsor','supporter')),
  status TEXT NOT NULL CHECK (status IN ('available','out','returned')),
  on_date TEXT NOT NULL,
  loan_due TEXT NOT NULL DEFAULT '',
  lender_due TEXT NOT NULL DEFAULT '',
  private_details TEXT NOT NULL,
  source_offer_id TEXT UNIQUE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL
);

CREATE INDEX club_equipment_list ON club_equipment(status,updated_at DESC,id);

CREATE TABLE club_equipment_history (
  mutation_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES club_equipment(id),
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  on_date TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  private_snapshot TEXT NOT NULL,
  receipt TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE(item_id,version)
);
