CREATE TABLE equipment_wishes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  goal_cents INTEGER NOT NULL CHECK (goal_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE equipment_wish_activity (
  mutation_id TEXT PRIMARY KEY,
  wish_id TEXT NOT NULL REFERENCES equipment_wishes(id),
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  receipt TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  kind TEXT,
  amount_cents INTEGER,
  on_date TEXT,
  private_entry TEXT,
  UNIQUE(wish_id,version),
  CHECK ((action='money' AND kind IN ('receipt','adjustment') AND amount_cents IS NOT NULL AND amount_cents<>0 AND on_date IS NOT NULL AND private_entry IS NOT NULL)
      OR (action<>'money' AND kind IS NULL AND amount_cents IS NULL AND on_date IS NULL AND private_entry IS NULL))
);
CREATE INDEX equipment_wish_fund_dates ON equipment_wish_activity(wish_id,on_date) WHERE action='money';
CREATE TRIGGER equipment_wish_activity_no_edit BEFORE UPDATE ON equipment_wish_activity
  BEGIN SELECT RAISE(ABORT,'Equipment wish entries are permanent'); END;
CREATE TRIGGER equipment_wish_activity_no_delete BEFORE DELETE ON equipment_wish_activity
  BEGIN SELECT RAISE(ABORT,'Equipment wish entries are permanent'); END;
