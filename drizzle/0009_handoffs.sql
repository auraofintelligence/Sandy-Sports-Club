CREATE TABLE partner_handoffs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('volunteer','employment','event')),
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  scope TEXT NOT NULL,
  event_id TEXT REFERENCES partner_handoffs(id),
  event_title TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  meeting_id TEXT REFERENCES meeting_register(id),
  motion TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('requested','authorised','declined','withdrawn')),
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  revoked_at TEXT,
  revoked_by TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  mutation TEXT NOT NULL
);
CREATE INDEX partner_handoffs_owner ON partner_handoffs(owner_id,consent_at);
CREATE INDEX partner_handoffs_review ON partner_handoffs(status,consent_at);
CREATE INDEX partner_handoffs_event ON partner_handoffs(event_id,status);

