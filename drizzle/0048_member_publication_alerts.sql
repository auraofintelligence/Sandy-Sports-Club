-- These two inbox topics use the member's separate weekly email choice.
-- Leave the existing delivery queue for the earlier membership notices.
DROP TRIGGER member_notice_delivery;
CREATE TRIGGER member_notice_delivery AFTER INSERT ON member_notices
WHEN NEW.kind NOT IN ('calendar_event','minutes_release') BEGIN
  INSERT OR IGNORE INTO member_delivery_queue(notice_id,channel) SELECT NEW.id,'email' FROM member_profiles
    WHERE account_id=NEW.account_id AND pref_email=1 AND contact_email<>'';
  INSERT OR IGNORE INTO member_delivery_queue(notice_id,channel) SELECT NEW.id,'sms' FROM member_profiles
    WHERE account_id=NEW.account_id AND pref_sms=1 AND contact_mobile<>'';
END;

CREATE INDEX member_notice_publication ON member_notices(kind,cycle) WHERE kind IN ('calendar_event','minutes_release');

CREATE VIEW member_calendar_alert_recipients AS
SELECT e.id AS event_id,p.account_id
FROM club_events e JOIN member_profiles p ON CASE
    WHEN e.type IN ('local','interclub','workshop') THEN p.competitions
    WHEN e.type IN ('bbq','raffle','fundraiser') THEN p.working_bees
    ELSE 0 END=1
JOIN club_accounts a ON a.id=p.account_id
WHERE a.disabled=0 AND a.role='member' AND a.paid_through>=date('now','+10 hours');

-- Fire on the explicitly published member copy. Private event planning fields
-- and approved committee notes have their own tables and are never copied.
CREATE TRIGGER member_calendar_alert_new AFTER INSERT ON member_event_notices
WHEN NEW.published=1 BEGIN
  INSERT INTO member_notices(id,account_id,kind,title,body,issue_day,cycle)
    SELECT 'calendar:'||NEW.event_id||':'||account_id,account_id,'calendar_event',NEW.title,
      'A date has been added to the member calendar for '||NEW.event_date||'.',date('now','+10 hours'),NEW.event_id
    FROM member_calendar_alert_recipients WHERE event_id=NEW.event_id;
END;

CREATE TRIGGER member_calendar_alert_change AFTER UPDATE ON member_event_notices
WHEN NEW.published=1 AND (OLD.published=0 OR NEW.title<>OLD.title OR NEW.event_date<>OLD.event_date
    OR NEW.start_time<>OLD.start_time OR NEW.place<>OLD.place OR NEW.details<>OLD.details) BEGIN
  DELETE FROM member_notices WHERE kind='calendar_event' AND cycle=NEW.event_id;
  INSERT INTO member_notices(id,account_id,kind,title,body,issue_day,cycle)
    SELECT 'calendar:'||NEW.event_id||':'||account_id,account_id,'calendar_event',NEW.title,
      CASE WHEN OLD.published=0 THEN 'A date has been added to the member calendar for '
        ELSE 'The committee updated the calendar entry for ' END||NEW.event_date||'.',date('now','+10 hours'),NEW.event_id
    FROM member_calendar_alert_recipients WHERE event_id=NEW.event_id;
END;

CREATE TRIGGER member_calendar_alert_withdraw AFTER UPDATE OF published ON member_event_notices
WHEN OLD.published=1 AND NEW.published=0 BEGIN
  DELETE FROM member_notices WHERE kind='calendar_event' AND cycle=NEW.event_id AND account_id NOT IN
    (SELECT account_id FROM member_calendar_alert_recipients WHERE event_id=NEW.event_id);
  UPDATE member_notices SET title='An event was removed from the calendar',
    body='Check the member calendar for the current club dates.',read_at=NULL,issue_day=date('now','+10 hours')
    WHERE kind='calendar_event' AND cycle=NEW.event_id;
  UPDATE member_notice_posted SET posted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE notice_id IN (SELECT id FROM member_notices WHERE kind='calendar_event' AND cycle=NEW.event_id);
END;

CREATE TRIGGER member_minutes_alert_release AFTER INSERT ON member_minutes BEGIN
  INSERT INTO member_notices(id,account_id,kind,title,body,issue_day,cycle)
    SELECT 'minutes:'||NEW.meeting_id||':'||p.account_id,p.account_id,'minutes_release','New meeting minutes',
      'The committee has released the member copy for the meeting on '||r.date||'.',date('now','+10 hours'),NEW.meeting_id
    FROM member_profiles p JOIN club_accounts a ON a.id=p.account_id JOIN meeting_register r ON r.id=NEW.meeting_id
    WHERE p.meetings=1 AND a.role='member' AND a.disabled=0 AND a.paid_through>=date('now','+10 hours');
END;
