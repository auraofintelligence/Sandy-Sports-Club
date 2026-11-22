CREATE TABLE member_profiles (
  account_id TEXT PRIMARY KEY REFERENCES club_accounts(id),
  membership_type TEXT NOT NULL DEFAULT 'unconfirmed' CHECK(membership_type IN ('unconfirmed','adult','cadet','junior','social','casual','lifetime')),
  contact_email TEXT NOT NULL DEFAULT '', contact_mobile TEXT NOT NULL DEFAULT '',
  birthday_md TEXT, newsletters INTEGER CHECK(newsletters IN (0,1)), meetings INTEGER NOT NULL DEFAULT 1,
  competitions INTEGER NOT NULL DEFAULT 1, working_bees INTEGER NOT NULL DEFAULT 1,
  pref_email INTEGER NOT NULL DEFAULT 0, pref_sms INTEGER NOT NULL DEFAULT 0,
  pack_method TEXT NOT NULL DEFAULT 'confirm' CHECK(pack_method IN ('confirm','post','collect')),
  pack_stage TEXT NOT NULL DEFAULT 'prepare' CHECK(pack_stage IN ('prepare','ready','posted','collected')),
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE member_notices (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES member_profiles(account_id), kind TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL, issue_day TEXT NOT NULL, cycle TEXT, read_at TEXT
);
CREATE INDEX member_notices_owner ON member_notices(account_id,issue_day);
CREATE TABLE member_delivery_queue (
  notice_id TEXT NOT NULL REFERENCES member_notices(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms')), PRIMARY KEY(notice_id,channel)
);
CREATE TABLE member_lifecycle_settings (
  id INTEGER PRIMARY KEY CHECK(id=1), number_start INTEGER, number_reference TEXT,
  offer_kind TEXT CHECK(offer_kind IN ('percent','fixed')), offer_value INTEGER, offer_terms TEXT,
  offer_days INTEGER, offer_reference TEXT
);
INSERT INTO member_lifecycle_settings(id) VALUES (1);
CREATE TABLE member_numbers (
  number INTEGER PRIMARY KEY CHECK(number BETWEEN 1 AND 99999999), account_id TEXT UNIQUE REFERENCES member_profiles(account_id),
  assigned_day TEXT, released_day TEXT
);
CREATE TABLE member_birthday_gifts (
  code TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES member_profiles(account_id),
  issue_year TEXT NOT NULL, valid_until TEXT NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL, terms TEXT NOT NULL,
  approval_reference TEXT NOT NULL, redeemed_at TEXT, redeemed_by TEXT, purchase_cents INTEGER, discount_cents INTEGER,
  UNIQUE(account_id,issue_year)
);
CREATE TABLE member_bulletins (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, audience TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  issue_day TEXT NOT NULL, created_by TEXT NOT NULL
);
CREATE UNIQUE INDEX member_monthly_newsletter ON member_bulletins(substr(issue_day,1,7),audience) WHERE kind='newsletter';
CREATE TABLE member_newsletter_jobs (month TEXT PRIMARY KEY, published_by TEXT);
CREATE TABLE member_cycle_clock (id INTEGER PRIMARY KEY CHECK(id=1), completed_day TEXT);
INSERT INTO member_cycle_clock(id) VALUES(1);
CREATE TRIGGER member_cycle_due_on_settings AFTER UPDATE OF offer_kind,number_start ON member_lifecycle_settings BEGIN
  UPDATE member_cycle_clock SET completed_day=NULL WHERE id=1;
END;
CREATE TRIGGER member_notice_delivery AFTER INSERT ON member_notices BEGIN
  INSERT OR IGNORE INTO member_delivery_queue(notice_id,channel) SELECT NEW.id,'email' FROM member_profiles
    WHERE account_id=NEW.account_id AND pref_email=1 AND contact_email<>'';
  INSERT OR IGNORE INTO member_delivery_queue(notice_id,channel) SELECT NEW.id,'sms' FROM member_profiles
    WHERE account_id=NEW.account_id AND pref_sms=1 AND contact_mobile<>'';
END;
CREATE TRIGGER member_pack_changed AFTER UPDATE OF pack_stage ON member_profiles WHEN NEW.pack_stage<>OLD.pack_stage BEGIN
  INSERT OR IGNORE INTO member_notices(id,account_id,kind,title,body,issue_day) VALUES
    ('pack:'||NEW.account_id||':'||NEW.pack_stage,NEW.account_id,'pack','Your member pack',
    CASE NEW.pack_stage WHEN 'posted' THEN 'The committee marked your member pack as posted.'
    WHEN 'collected' THEN 'The committee marked your member pack as collected.'
    WHEN 'ready' THEN CASE NEW.pack_method WHEN 'collect' THEN 'Your pack is ready for collection. Contact the committee to arrange pickup.'
    WHEN 'post' THEN 'Your member pack is prepared and ready to post.' ELSE 'Your member pack is prepared. Contact the committee to arrange handover.' END END,date('now','+10 hours'));
END;
CREATE TRIGGER member_bulletin_issued AFTER INSERT ON member_bulletins BEGIN
  INSERT OR IGNORE INTO member_notices(id,account_id,kind,title,body,issue_day)
    SELECT 'bulletin:'||NEW.id||':'||p.account_id,p.account_id,NEW.kind,NEW.title,NEW.body,NEW.issue_day
    FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id WHERE a.disabled=0 AND a.paid_through>=NEW.issue_day
    AND (NEW.audience='all' OR NEW.audience=p.membership_type)
    AND CASE NEW.kind WHEN 'newsletter' THEN coalesce(p.newsletters,p.membership_type IN ('adult','cadet'))
      WHEN 'meeting' THEN p.meetings WHEN 'competition' THEN p.competitions WHEN 'working_bee' THEN p.working_bees END=1;
  INSERT INTO member_newsletter_jobs(month,published_by) SELECT substr(NEW.issue_day,1,7),NEW.created_by WHERE NEW.kind='newsletter'
    ON CONFLICT(month) DO UPDATE SET published_by=excluded.published_by;
END;
CREATE TRIGGER member_cycle_due_on_profile AFTER UPDATE OF birthday_md,membership_type ON member_profiles BEGIN
  UPDATE member_cycle_clock SET completed_day=NULL WHERE id=1;
END;
CREATE TRIGGER member_profile_on_join AFTER INSERT ON club_accounts WHEN NEW.role='member' BEGIN
  INSERT OR IGNORE INTO member_profiles(account_id) VALUES(NEW.id);
END;
CREATE TRIGGER member_welcome AFTER INSERT ON member_profiles BEGIN
  UPDATE member_cycle_clock SET completed_day=NULL WHERE id=1;
  INSERT INTO member_numbers(number,account_id,assigned_day)
    SELECT COALESCE((SELECT MIN(number) FROM member_numbers WHERE account_id IS NULL),
      MAX(s.number_start,COALESCE((SELECT MAX(number)+1 FROM member_numbers),s.number_start))),
      NEW.account_id,date('now','+10 hours') FROM member_lifecycle_settings s
      JOIN club_accounts a ON a.id=NEW.account_id
    WHERE s.number_start IS NOT NULL AND a.disabled=0 AND a.paid_through>=date('now','+10 hours')
    ON CONFLICT(number) DO UPDATE SET account_id=excluded.account_id,assigned_day=excluded.assigned_day,released_day=NULL WHERE member_numbers.account_id IS NULL;
  INSERT OR IGNORE INTO member_notices (id,account_id,kind,title,body,issue_day)
  VALUES ('welcome:'||NEW.account_id,NEW.account_id,'welcome','Welcome to the club','Your membership is recorded. Choose your notice preferences below. The club has a task to prepare your member pack.',date('now','+10 hours'));
END;
CREATE TRIGGER member_renewal_recorded AFTER UPDATE OF paid_through ON club_accounts
WHEN NEW.role='member' AND NEW.disabled=0 AND NEW.paid_through IS NOT NULL AND NEW.paid_through IS NOT OLD.paid_through BEGIN
  UPDATE member_cycle_clock SET completed_day=NULL WHERE id=1;
  DELETE FROM member_notices WHERE account_id=NEW.id AND kind='renewal' AND cycle IS NOT NEW.paid_through;
  INSERT OR IGNORE INTO member_notices (id,account_id,kind,title,body,issue_day) VALUES
    ('paid:'||NEW.id||':'||NEW.paid_through,NEW.id,'payment','Membership payment recorded','Your membership is paid through '||NEW.paid_through||'.',date('now','+10 hours'));
END;
CREATE TRIGGER member_cancelled AFTER UPDATE OF disabled ON club_accounts WHEN NEW.disabled=1 AND OLD.disabled=0 BEGIN
  UPDATE member_numbers SET account_id=NULL,released_day=date('now','+10 hours') WHERE account_id=NEW.id;
  DELETE FROM member_delivery_queue WHERE notice_id IN (SELECT id FROM member_notices WHERE account_id=NEW.id);
  DELETE FROM member_birthday_gifts WHERE account_id=NEW.id AND redeemed_at IS NULL;
END;
INSERT OR IGNORE INTO member_profiles(account_id) SELECT id FROM club_accounts WHERE role='member' AND disabled=0;
