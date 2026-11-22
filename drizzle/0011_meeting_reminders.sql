CREATE TABLE meeting_agendas (
  meeting_id TEXT PRIMARY KEY REFERENCES meeting_register(id),
  topics TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE meeting_reminders (
  meeting_id TEXT NOT NULL REFERENCES meeting_register(id),
  channel TEXT NOT NULL CHECK(channel IN ('email','sms','chat')),
  due_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK(state IN ('scheduled','ready','reviewed','elapsed')),
  ready_at INTEGER,
  elapsed_at INTEGER,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  PRIMARY KEY(meeting_id,channel)
);
CREATE INDEX meeting_reminders_due ON meeting_reminders(state,due_at);
CREATE INDEX meeting_reminders_expiring ON meeting_reminders(state,expires_at);

CREATE VIEW planned_meeting_reminders AS
  SELECT r.id AS meeting_id, window.channel,
    CAST(strftime('%s',r.date || 'T' || r.time || ':00+10:00') AS INTEGER) - window.lead_seconds AS due_at,
    CAST(strftime('%s',r.date || 'T' || r.time || ':00+10:00') AS INTEGER) - window.next_lead AS expires_at
  FROM meeting_register r CROSS JOIN (
    SELECT 'email' AS channel,604800 AS lead_seconds,259200 AS next_lead
    UNION ALL SELECT 'sms',259200,3600
    UNION ALL SELECT 'chat',3600,0
  ) AS window;

INSERT INTO meeting_reminders(meeting_id,channel,due_at,expires_at)
SELECT meeting_id,channel,due_at,expires_at FROM planned_meeting_reminders;

CREATE TRIGGER register_meeting_reminders AFTER INSERT ON meeting_register BEGIN
  INSERT INTO meeting_reminders(meeting_id,channel,due_at,expires_at)
  SELECT meeting_id,channel,due_at,expires_at FROM planned_meeting_reminders WHERE meeting_id=NEW.id;
END;
