CREATE TABLE honours_competitions (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  prizes TEXT NOT NULL DEFAULT '',
  sponsors TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE honours_entries (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  member_account TEXT,
  consent_kind TEXT NOT NULL,
  display_name TEXT NOT NULL,
  species TEXT NOT NULL,
  millimetres INTEGER NOT NULL CHECK(millimetres>0),
  caught_on TEXT NOT NULL,
  competition_id TEXT REFERENCES honours_competitions(id),
  consent_at TEXT NOT NULL,
  photo_cipher TEXT,
  sighted_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('pending','verified','declined','withdrawn')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX honours_verified ON honours_entries(caught_on,species,millimetres) WHERE status='verified';
CREATE INDEX honours_owner ON honours_entries(owner_id,caught_on);
CREATE TABLE honours_monthly (
  month TEXT PRIMARY KEY,
  entry_id TEXT REFERENCES honours_entries(id),
  reason TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE honours_changes (
  mutation TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  digest TEXT NOT NULL
);
