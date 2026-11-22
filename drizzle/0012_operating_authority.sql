CREATE TABLE operating_authorities (
  request_id TEXT PRIMARY KEY REFERENCES partner_handoffs(id),
  meeting_id TEXT NOT NULL REFERENCES meeting_register(id),
  motion TEXT NOT NULL,
  work TEXT NOT NULL,
  retained TEXT NOT NULL,
  club_lead TEXT NOT NULL,
  review_day TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  partner_lead TEXT,
  acceptance_ref TEXT,
  accepted_at TEXT,
  accepted_by TEXT,
  closed_at TEXT,
  closed_by TEXT
);
CREATE TRIGGER close_operating_authority AFTER UPDATE OF status ON partner_handoffs
WHEN NEW.status='withdrawn' BEGIN
  UPDATE operating_authorities SET closed_at=NEW.revoked_at,closed_by=NEW.revoked_by
  WHERE request_id=NEW.id AND closed_at IS NULL;
END;
