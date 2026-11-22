CREATE TABLE minute_assist_usage (
  actor_id TEXT PRIMARY KEY NOT NULL,
  local_day TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used BETWEEN 1 AND 5)
);
