ALTER TABLE member_bulletins ADD COLUMN edition_month TEXT;
DROP INDEX member_monthly_newsletter;
CREATE UNIQUE INDEX member_monthly_newsletter ON member_bulletins(coalesce(edition_month,substr(issue_day,1,7)),audience) WHERE kind='newsletter';

CREATE TABLE newsletter_editions (
  month TEXT PRIMARY KEY, bulletin_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
  president_message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','approved','published')),
  version INTEGER NOT NULL DEFAULT 0, updated_by TEXT, updated_at TEXT, published_at TEXT, last_key TEXT,
  approved_by TEXT, approved_at TEXT
);
INSERT INTO newsletter_editions(month,bulletin_id,title,body,status,version,updated_by,updated_at,published_at)
  SELECT substr(issue_day,1,7),id,title,body,'published',1,created_by,issue_day,issue_day
  FROM member_bulletins WHERE kind='newsletter' AND audience='all';

CREATE TABLE newsletter_contributions (
  month TEXT NOT NULL REFERENCES newsletter_editions(month), office TEXT NOT NULL CHECK(office IN ('president','vicepresident','secretary','assistantsecretary','treasurer')),
  title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','submitted','included')),
  version INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, last_key TEXT NOT NULL, PRIMARY KEY(month,office)
);
CREATE TABLE newsletter_contribution_revisions (
  month TEXT NOT NULL, office TEXT NOT NULL, version INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(month,office,version)
);
CREATE TRIGGER newsletter_article_created AFTER INSERT ON newsletter_contributions BEGIN
  INSERT INTO newsletter_contribution_revisions VALUES(NEW.month,NEW.office,NEW.version,NEW.title,NEW.body,NEW.status,NEW.updated_at,NEW.updated_by);
END;
CREATE TRIGGER newsletter_article_updated AFTER UPDATE ON newsletter_contributions BEGIN
  INSERT INTO newsletter_contribution_revisions VALUES(NEW.month,NEW.office,NEW.version,NEW.title,NEW.body,NEW.status,NEW.updated_at,NEW.updated_by);
  UPDATE newsletter_editions SET version=version+1,last_key=NULL,updated_at=NEW.updated_at,updated_by=NEW.updated_by
    WHERE month=NEW.month AND (NEW.status='included' OR OLD.status='included');
END;
CREATE TRIGGER newsletter_article_frozen BEFORE UPDATE ON newsletter_contributions
  WHEN EXISTS(SELECT 1 FROM newsletter_editions WHERE month=OLD.month AND status<>'draft') BEGIN
  SELECT RAISE(ABORT,'This edition is closed for edits');
END;
CREATE TRIGGER newsletter_article_late BEFORE INSERT ON newsletter_contributions
  WHEN EXISTS(SELECT 1 FROM newsletter_editions WHERE month=NEW.month AND status<>'draft') BEGIN
  SELECT RAISE(ABORT,'This edition is closed for edits');
END;
CREATE TRIGGER newsletter_edition_frozen BEFORE UPDATE ON newsletter_editions WHEN OLD.status='published' BEGIN
  SELECT RAISE(ABORT,'The published edition is archived');
END;
CREATE TABLE newsletter_edition_revisions (
  month TEXT NOT NULL, version INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, president_message TEXT NOT NULL,
  status TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(month,version)
);
CREATE TRIGGER newsletter_revision_saved AFTER UPDATE ON newsletter_editions WHEN NEW.version>OLD.version BEGIN
  INSERT INTO newsletter_edition_revisions VALUES(NEW.month,NEW.version,NEW.title,NEW.body,NEW.president_message,NEW.status,NEW.updated_at,NEW.updated_by);
END;

DROP TRIGGER member_bulletin_issued;
CREATE TRIGGER member_bulletin_issued AFTER INSERT ON member_bulletins BEGIN
  INSERT OR IGNORE INTO member_notices(id,account_id,kind,title,body,issue_day)
    SELECT 'bulletin:'||NEW.id||':'||p.account_id,p.account_id,NEW.kind,NEW.title,NEW.body,NEW.issue_day
    FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id WHERE a.disabled=0 AND a.paid_through>=NEW.issue_day
    AND (NEW.audience='all' OR NEW.audience=p.membership_type)
    AND CASE NEW.kind WHEN 'newsletter' THEN coalesce(p.newsletters,p.membership_type IN ('adult','cadet'))
      WHEN 'meeting' THEN p.meetings WHEN 'competition' THEN p.competitions WHEN 'working_bee' THEN p.working_bees END=1
    AND (NEW.kind<>'newsletter' OR NOT EXISTS (SELECT 1 FROM member_bulletins old
      JOIN member_notices delivered ON delivered.id='bulletin:'||old.id||':'||p.account_id
      WHERE old.kind='newsletter' AND coalesce(old.edition_month,substr(old.issue_day,1,7))=coalesce(NEW.edition_month,substr(NEW.issue_day,1,7))));
  INSERT INTO member_newsletter_jobs(month,published_by) SELECT coalesce(NEW.edition_month,substr(NEW.issue_day,1,7)),NEW.created_by WHERE NEW.kind='newsletter'
    ON CONFLICT(month) DO UPDATE SET published_by=excluded.published_by;
END;
CREATE TRIGGER newsletter_edition_released AFTER UPDATE OF status ON newsletter_editions WHEN NEW.status='published' AND OLD.status<>'published' BEGIN
  INSERT INTO member_bulletins(id,kind,audience,title,body,issue_day,created_by,edition_month)
    VALUES(NEW.bulletin_id,'newsletter','all',NEW.title,NEW.body||
    CASE WHEN NEW.president_message='' THEN '' ELSE char(10)||char(10)||'From the president'||char(10)||NEW.president_message END||
    coalesce((SELECT group_concat(char(10)||char(10)||title||char(10)||body,'') FROM
      (SELECT title,body FROM newsletter_contributions WHERE month=NEW.month AND status='included' ORDER BY office)), ''),
    date(NEW.published_at,'+10 hours'),NEW.updated_by,NEW.month);
END;

CREATE TABLE member_birthday_issued (
  account_id TEXT NOT NULL REFERENCES member_profiles(account_id), issue_year TEXT NOT NULL, PRIMARY KEY(account_id,issue_year)
);
INSERT OR IGNORE INTO member_birthday_issued SELECT account_id,cycle FROM member_notices WHERE kind='birthday' AND cycle IS NOT NULL;
INSERT OR IGNORE INTO member_birthday_issued SELECT account_id,issue_year FROM member_birthday_gifts;
CREATE TRIGGER birthday_already_issued BEFORE INSERT ON member_notices WHEN NEW.kind='birthday' AND
  EXISTS (SELECT 1 FROM member_birthday_issued WHERE account_id=NEW.account_id AND issue_year=NEW.cycle) BEGIN
  SELECT RAISE(IGNORE);
END;
CREATE TRIGGER birthday_mark_issued AFTER INSERT ON member_notices WHEN NEW.kind='birthday' BEGIN
  INSERT INTO member_birthday_issued VALUES(NEW.account_id,NEW.cycle);
END;
