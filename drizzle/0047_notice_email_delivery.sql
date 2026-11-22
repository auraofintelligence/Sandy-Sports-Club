-- Existing member notices have only a calendar day. Time-stamp new deliveries so
-- joining the email list midway through a day cannot release an earlier notice.
CREATE TABLE member_notice_posted (
  notice_id TEXT PRIMARY KEY REFERENCES member_notices(id) ON DELETE CASCADE,
  posted_at TEXT NOT NULL
);
CREATE TRIGGER member_notice_record_time AFTER INSERT ON member_notices BEGIN
  INSERT INTO member_notice_posted(notice_id,posted_at)
    VALUES(NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER member_notice_remove_time AFTER DELETE ON member_notices BEGIN
  DELETE FROM member_notice_posted WHERE notice_id=OLD.id;
END;
CREATE TRIGGER member_notice_changed_time AFTER UPDATE OF title,body,issue_day ON member_notices
WHEN NEW.kind='calendar_event' AND (NEW.title<>OLD.title OR NEW.body<>OLD.body OR NEW.issue_day<>OLD.issue_day) BEGIN
  INSERT INTO member_notice_posted(notice_id,posted_at) VALUES(NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(notice_id) DO UPDATE SET posted_at=excluded.posted_at;
END;
CREATE INDEX member_notice_posted_time ON member_notice_posted(posted_at);

CREATE VIEW notice_email_recipients AS
  SELECT c.account_id,c.email,c.important,c.weekly,c.enabled_at,
    coalesce(c.important_since,c.enabled_at) AS important_since,coalesce(c.weekly_since,c.enabled_at) AS weekly_since,a.role,a.paid_through
  FROM notice_email_choices c JOIN club_accounts a ON a.id=c.account_id AND a.disabled=0
  LEFT JOIN member_profiles p ON p.account_id=a.id LEFT JOIN member_age_checks g ON g.account_id=a.id
  WHERE (c.important=1 OR c.weekly=1) AND (a.role<>'member' OR
    (coalesce(g.age_band,'')<>'under16' AND coalesce(p.membership_type,'') NOT IN ('junior','cadet'))
    OR lower(trim(p.contact_email))=c.email);

-- Join each source to its actual audience. A member email never acquires an
-- officer title merely because a post happens to have the same date.
CREATE VIEW notice_email_items AS
  SELECT c.account_id,'committee:'||n.id AS item_key,'Committee noticeboard' AS section,
    n.title,n.created_at AS posted_at,n.important,'' AS visible_from,'9999-12-31' AS visible_until
  FROM notice_email_recipients c JOIN committee_notices n ON c.role IN ('committee','administrator','treasurer')
    AND n.author_id<>c.account_id AND n.archived_at IS NULL AND n.created_at>=c.enabled_at
  UNION ALL
  SELECT c.account_id,'member:'||n.id,'Club inbox',
    CASE n.kind WHEN 'calendar_event' THEN CASE WHEN e.published=1 THEN e.title ELSE 'An event was removed from the calendar' END
      WHEN 'minutes_release' THEN CASE WHEN length(m.date)=10 THEN 'Meeting minutes for '||substr(m.date,9,2)||'/'||substr(m.date,6,2)||'/'||substr(m.date,1,4)
        ELSE 'New meeting minutes' END ELSE n.title END,
    t.posted_at,coalesce(b.important,0),n.issue_day,
    CASE WHEN c.role='member' AND n.kind NOT IN ('renewal','payment') THEN coalesce(c.paid_through,'') ELSE '9999-12-31' END
  FROM notice_email_recipients c JOIN member_notices n ON n.account_id=c.account_id
    JOIN member_notice_posted t ON t.notice_id=n.id AND t.posted_at>=c.enabled_at
    LEFT JOIN member_bulletins b ON n.id='bulletin:'||b.id||':'||n.account_id
    JOIN member_profiles p ON p.account_id=c.account_id
    LEFT JOIN member_event_notices e ON n.kind='calendar_event' AND e.event_id=n.cycle
    LEFT JOIN meeting_register m ON n.kind='minutes_release' AND m.id=n.cycle
  WHERE (b.created_by IS NULL OR b.created_by<>c.account_id)
    AND (b.id IS NULL OR (b.audience IN ('all',p.membership_type) AND
      CASE b.kind WHEN 'general' THEN p.general_notices WHEN 'meeting' THEN p.meetings
        WHEN 'working_bee' THEN p.working_bees WHEN 'competition' THEN p.competitions
        WHEN 'newsletter' THEN coalesce(p.newsletters,p.membership_type IN ('adult','cadet')) ELSE 0 END=1))
    AND (n.kind<>'minutes_release' OR p.meetings=1)
    AND (n.kind<>'calendar_event' OR EXISTS (SELECT 1 FROM club_events evt WHERE evt.id=n.cycle
      AND CASE WHEN evt.type IN ('local','interclub','workshop') THEN p.competitions
               WHEN evt.type IN ('bbq','raffle','fundraiser') THEN p.working_bees ELSE 0 END=1))
  UNION ALL
  SELECT c.account_id,'price:'||p.seq,'Prices',p.title,p.changed_at,0,'','9999-12-31'
  FROM notice_email_recipients c JOIN officer_price_recipients r ON r.recipient='account:'||c.account_id
    JOIN officer_price_changes p ON p.seq=r.seq AND p.actor_id<>c.account_id AND p.changed_at>=c.enabled_at
  WHERE c.role IN ('committee','administrator','treasurer');

CREATE TABLE notice_email_outbox (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES club_accounts(id),
  enabled_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('important','weekly')),
  event_key TEXT NOT NULL,
  provider_key TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  items_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','cancelled','failed','check')),
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt TEXT,
  next_try TEXT NOT NULL DEFAULT '',
  lease TEXT,
  provider TEXT,
  gmail_started INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  provider_id TEXT,
  UNIQUE(account_id,kind,event_key)
);
CREATE INDEX notice_email_work ON notice_email_outbox(state,next_try,id);
