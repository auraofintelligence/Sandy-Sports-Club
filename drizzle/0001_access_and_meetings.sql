CREATE TABLE club_accounts (
  id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('member','committee','treasurer','administrator')),
  salt TEXT NOT NULL, verifier TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE club_invites (
  digest TEXT PRIMARY KEY, login TEXT COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('member','committee','treasurer','administrator')),
  created_by TEXT NOT NULL, expires INTEGER NOT NULL, used_by TEXT,
  reset_id TEXT REFERENCES club_accounts(id)
);
CREATE TABLE club_sessions (
  digest TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES club_accounts(id), expires INTEGER NOT NULL
);
CREATE INDEX club_sessions_account ON club_sessions(account_id);
CREATE TABLE club_auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
ALTER TABLE meeting_notes ADD COLUMN decisions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE meeting_notes ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved'));
ALTER TABLE meeting_notes ADD COLUMN approved_at TEXT;
ALTER TABLE meeting_notes ADD COLUMN approved_by TEXT;
