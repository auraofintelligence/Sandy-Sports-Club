CREATE TABLE club_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT,
  closer_name TEXT,
  close_note TEXT NOT NULL DEFAULT '',
  takings_cents INTEGER CHECK (takings_cents>=0),
  expenses_cents INTEGER CHECK (expenses_cents>=0),
  money_recorded_at TEXT,
  money_recorded_by TEXT,
  money_recorder_name TEXT
);

CREATE TABLE club_event_jobs (
  event_id TEXT NOT NULL REFERENCES club_events(id),
  key TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  owner_kind TEXT CHECK (owner_kind IN ('officer','helper')),
  owner_id TEXT,
  owner_name TEXT,
  helper_recorded_by TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  done_at TEXT,
  done_by TEXT,
  done_by_name TEXT,
  PRIMARY KEY(event_id,key)
);
CREATE INDEX club_event_jobs_by_officer ON club_event_jobs(owner_id) WHERE done_at IS NULL AND owner_kind='officer';

CREATE TABLE club_event_activity (
  mutation_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES club_events(id),
  action TEXT NOT NULL,
  request_json TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX club_event_activity_by_event ON club_event_activity(event_id,recorded_at);
