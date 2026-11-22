-- Reserve office identities without enabling sign-in or issuing invitations.
-- The setup workflow claims each account and records the appointment later.
WITH offices(login,role) AS (VALUES
  ('president','committee'),('vicepresident','committee'),('secretary','committee'),
  ('assistantsecretary','committee'),('treasurer','treasurer'))
INSERT INTO club_accounts(id,login,role,salt,verifier,disabled,created_at)
SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-8'||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),
  login,role,lower(hex(randomblob(32))),lower(hex(randomblob(32))),1,CAST(strftime('%s','now') AS INTEGER)
FROM offices;

CREATE TABLE office_slots (
  office TEXT PRIMARY KEY CHECK(office IN ('president','vicepresident','secretary','assistantsecretary','treasurer')),
  account_id TEXT UNIQUE REFERENCES club_accounts(id),
  status TEXT NOT NULL CHECK(status IN ('vacant','reserved','active')),
  assigned_at TEXT,
  assigned_by TEXT,
  CHECK ((status='vacant' AND account_id IS NULL AND assigned_at IS NULL AND assigned_by IS NULL)
    OR (status='reserved' AND account_id IS NOT NULL AND assigned_at IS NULL AND assigned_by IS NULL)
    OR (status='active' AND account_id IS NOT NULL AND assigned_at IS NOT NULL AND assigned_by IS NOT NULL))
);
INSERT INTO office_slots(office,account_id,status)
SELECT login,id,'reserved' FROM club_accounts
WHERE login IN ('president','vicepresident','secretary','assistantsecretary','treasurer');
