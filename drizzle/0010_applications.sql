CREATE TABLE membership_applications (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  membership_type TEXT NOT NULL CHECK(membership_type IN ('adult','cadet','junior','social','casual','lifetime')),
  contact_email TEXT NOT NULL DEFAULT '',
  contact_mobile TEXT NOT NULL DEFAULT '',
  pack_method TEXT NOT NULL CHECK(pack_method IN ('collect','post')),
  postal_address TEXT NOT NULL DEFAULT '',
  guardian_name TEXT NOT NULL DEFAULT '',
  guardian_authorised INTEGER NOT NULL DEFAULT 0,
  guardian_social INTEGER NOT NULL DEFAULT 0,
  guardian_reviewed INTEGER NOT NULL DEFAULT 0,
  social_reviewed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','followup','approved','invited','active','declined')),
  submitted_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  reviewed_at INTEGER, reviewed_by TEXT,
  invite_login TEXT COLLATE NOCASE, invite_digest TEXT UNIQUE, invite_expires INTEGER,
  account_id TEXT UNIQUE REFERENCES club_accounts(id)
);
CREATE INDEX applications_by_status ON membership_applications(status,seq DESC);
CREATE INDEX applications_pending_login ON membership_applications(invite_login) WHERE status='invited';

-- Claiming the invitation and inserting its account run in the same D1 transaction.
CREATE TRIGGER membership_application_activated AFTER INSERT ON club_accounts
WHEN NEW.role='member'
BEGIN
  UPDATE membership_applications SET status='active', account_id=NEW.id
    WHERE status='invited' AND invite_login=NEW.login AND EXISTS (
      SELECT 1 FROM club_invites i WHERE i.digest=membership_applications.invite_digest
      AND i.used_by IS NOT NULL AND i.login=NEW.login AND i.role='member' AND i.reset_id IS NULL
    );
  INSERT INTO member_profiles(account_id,membership_type,contact_email,contact_mobile,pack_method)
    SELECT NEW.id,membership_type,contact_email,contact_mobile,pack_method FROM membership_applications
    WHERE account_id=NEW.id AND status='active'
    ON CONFLICT(account_id) DO UPDATE SET membership_type=excluded.membership_type,
      contact_email=excluded.contact_email,contact_mobile=excluded.contact_mobile,pack_method=excluded.pack_method;
END;
