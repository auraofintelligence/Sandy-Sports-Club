CREATE TABLE webmaster_help_requests (
  seq INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL CHECK(topic IN ('invitation','password','workspace','email','website')),
  source TEXT NOT NULL CHECK(source IN ('signin','invitation','access','email','website')),
  contact_type TEXT NOT NULL CHECK(contact_type IN ('email','phone')),
  contact_box TEXT NOT NULL,
  submitted_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'new' CHECK(state IN ('new','in_progress','resolved')),
  assigned_to TEXT,
  assigned_role TEXT CHECK(assigned_role IN ('webmaster','secretary')),
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX webmaster_help_folder ON webmaster_help_requests(state,seq);
CREATE TABLE webmaster_help_reads (
  request_id TEXT NOT NULL REFERENCES webmaster_help_requests(id),
  account_id TEXT NOT NULL REFERENCES club_accounts(id),
  seen_version INTEGER NOT NULL,
  PRIMARY KEY(request_id,account_id)
);
