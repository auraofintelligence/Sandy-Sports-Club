ALTER TABLE member_bulletins ADD COLUMN important INTEGER NOT NULL DEFAULT 0 CHECK(important IN (0,1));
ALTER TABLE member_profiles ADD COLUMN general_notices INTEGER NOT NULL DEFAULT 1 CHECK(general_notices IN (0,1));
CREATE TRIGGER member_general_notice AFTER INSERT ON member_bulletins WHEN NEW.kind='general' BEGIN
  INSERT INTO member_notices(id,account_id,kind,title,body,issue_day)
    SELECT 'bulletin:'||NEW.id||':'||p.account_id,p.account_id,NEW.kind,NEW.title,NEW.body,NEW.issue_day
    FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id
    WHERE a.role='member' AND a.disabled=0 AND a.paid_through>=NEW.issue_day AND p.general_notices=1
      AND (NEW.audience='all' OR p.membership_type=NEW.audience);
END;

CREATE TABLE notice_email_choices (
  account_id TEXT PRIMARY KEY REFERENCES club_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  important INTEGER NOT NULL CHECK(important IN (0,1)),
  weekly INTEGER NOT NULL CHECK(weekly IN (0,1)),
  enabled_at TEXT NOT NULL,
  important_since TEXT,
  weekly_since TEXT
);

CREATE TRIGGER notice_email_new_subscription AFTER INSERT ON notice_email_choices BEGIN
  UPDATE notice_email_choices SET important_since=CASE WHEN NEW.important THEN NEW.enabled_at END,
    weekly_since=CASE WHEN NEW.weekly THEN NEW.enabled_at END WHERE account_id=NEW.account_id;
END;
CREATE TRIGGER notice_email_changed_subscription AFTER UPDATE OF email,important,weekly ON notice_email_choices
WHEN NEW.email<>OLD.email OR NEW.important<>OLD.important OR NEW.weekly<>OLD.weekly BEGIN
  UPDATE notice_email_choices SET
    important_since=CASE WHEN NEW.important=0 THEN NULL WHEN OLD.important=0 OR NEW.email<>OLD.email THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE OLD.important_since END,
    weekly_since=CASE WHEN NEW.weekly=0 THEN NULL WHEN OLD.weekly=0 OR NEW.email<>OLD.email THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE OLD.weekly_since END
  WHERE account_id=NEW.account_id;
END;

CREATE TABLE notice_email_pending (
  account_id TEXT PRIMARY KEY REFERENCES club_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  important INTEGER NOT NULL CHECK(important IN (0,1)),
  weekly INTEGER NOT NULL CHECK(weekly IN (0,1)),
  code_hash TEXT,
  attempted_at INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0
);
