CREATE TABLE committee_grants (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL, funder TEXT NOT NULL, source_url TEXT NOT NULL DEFAULT '',
  office TEXT NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('checking','preparing','submitted','delivery','reporting','closed','declined','parked')),
  deadline TEXT NOT NULL DEFAULT '', report_due TEXT NOT NULL DEFAULT '', next_step TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
  updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
