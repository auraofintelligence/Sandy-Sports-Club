-- Retire pending SMS prompts. Keep reviewed snapshots and the audit trail.
UPDATE meeting_reminders
SET state='elapsed', elapsed_at=coalesce(elapsed_at,unixepoch())
WHERE channel='sms' AND state IN ('scheduled','ready');

-- The existing meeting-insert trigger reads this view. Both retained channels
-- keep their original review windows, including meetings already on the books.
DROP VIEW planned_meeting_reminders;
CREATE VIEW planned_meeting_reminders AS
  SELECT r.id AS meeting_id, slot.channel,
    unixepoch(r.date || 'T' || r.time || ':00+10:00') - slot.lead_seconds AS due_at,
    unixepoch(r.date || 'T' || r.time || ':00+10:00') - slot.closes_before AS expires_at
  FROM meeting_register r CROSS JOIN (
    SELECT 'email' AS channel, 604800 AS lead_seconds, 259200 AS closes_before
    UNION ALL SELECT 'chat', 3600, 0
  ) AS slot;
