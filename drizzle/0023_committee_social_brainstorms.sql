CREATE TABLE committee_social_brainstorms (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  started_at TEXT NOT NULL,
  started_by TEXT NOT NULL,
  starter_name TEXT NOT NULL,
  finished_at TEXT,
  finished_by TEXT,
  finisher_name TEXT
);

CREATE UNIQUE INDEX committee_one_active_brainstorm
  ON committee_social_brainstorms((1)) WHERE finished_at IS NULL;
CREATE INDEX committee_recent_brainstorms ON committee_social_brainstorms(finished_at);

CREATE TABLE committee_brainstorm_ideas (
  plan_id TEXT PRIMARY KEY REFERENCES committee_social_plans(id),
  session_id TEXT NOT NULL REFERENCES committee_social_brainstorms(id)
);
CREATE INDEX committee_ideas_by_session ON committee_brainstorm_ideas(session_id);
