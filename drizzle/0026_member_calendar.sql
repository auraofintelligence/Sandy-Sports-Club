CREATE TABLE member_event_notices (
  event_id TEXT PRIMARY KEY REFERENCES club_events(id),
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL CHECK (published IN (0,1)),
  version INTEGER NOT NULL CHECK (version>0),
  updated_at TEXT NOT NULL
);
CREATE INDEX member_event_notices_by_month ON member_event_notices(event_date) WHERE published=1;
