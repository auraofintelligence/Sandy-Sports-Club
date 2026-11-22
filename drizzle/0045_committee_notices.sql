CREATE TABLE committee_notices (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('info','action')),
  important INTEGER NOT NULL DEFAULT 0 CHECK (important IN (0,1)),
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_label TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  requested_review TEXT NOT NULL DEFAULT '',
  review_date TEXT NOT NULL DEFAULT '',
  task_id TEXT UNIQUE REFERENCES officer_todo_items(id),
  archived_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK ((kind='action' AND task_id IS NOT NULL AND review_date='') OR
         (kind='info' AND task_id IS NULL AND review_date<>''))
);
CREATE INDEX committee_notices_active ON committee_notices(archived_at,created_at);

CREATE TABLE committee_notice_reads (
  notice_id TEXT NOT NULL REFERENCES committee_notices(id),
  account_id TEXT NOT NULL,
  seen_version INTEGER NOT NULL,
  seen_at TEXT NOT NULL,
  PRIMARY KEY (notice_id,account_id)
);

CREATE TABLE committee_notice_changes (
  notice_id TEXT NOT NULL REFERENCES committee_notices(id),
  version INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('review','archive')),
  actor_id TEXT NOT NULL,
  requested_review TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  PRIMARY KEY (notice_id,version)
);
