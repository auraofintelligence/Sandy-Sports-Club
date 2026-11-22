CREATE INDEX webmaster_help_weekly_time ON webmaster_help_requests(updated_at);

-- A shared delivery address receives one copy of each case, with the
-- Secretary's copy first. Each login keeps its own unread state in the inbox.
CREATE VIEW notice_email_delivery_items AS
SELECT account_id,item_key,section,title,posted_at,important,visible_from,visible_until
FROM notice_email_items
UNION ALL
SELECT account_id, 'help:' || id, section,
  'Help request SANDY-' || upper(substr(id,1,12)) || ' · ' ||
    CASE state WHEN 'new' THEN 'New' WHEN 'in_progress' THEN 'Being handled' ELSE 'Resolved' END,
  updated_at, 0, '', '9999-12-31'
FROM (
  SELECT c.account_id,h.id,h.state,h.updated_at,
    CASE a.role WHEN 'administrator' THEN 'Webmaster help requests' ELSE 'Secretary copies of Webmaster requests' END AS section,
    row_number() OVER (
      PARTITION BY h.id,lower(trim(c.email))
      ORDER BY CASE a.role WHEN 'committee' THEN 0 ELSE 1 END,a.id
    ) AS delivery_copy
  FROM notice_email_recipients c
  JOIN club_accounts a ON a.id=c.account_id
  JOIN webmaster_help_requests h ON h.updated_at>=c.weekly_since
  WHERE c.weekly=1 AND (a.role='administrator' OR (a.role='committee' AND a.login='secretary'))
)
WHERE delivery_copy=1;
