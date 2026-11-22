DROP TRIGGER member_notice_delivery;
CREATE TRIGGER member_notice_delivery AFTER INSERT ON member_notices
WHEN NEW.kind NOT IN ('calendar_event','minutes_release') BEGIN
  INSERT OR IGNORE INTO member_delivery_queue(notice_id,channel)
    SELECT NEW.id,'email' FROM member_profiles
    WHERE account_id=NEW.account_id AND pref_email=1 AND contact_email<>'';
END;

DELETE FROM member_delivery_queue WHERE channel='sms';
UPDATE member_profiles SET pref_sms=0 WHERE pref_sms<>0;
