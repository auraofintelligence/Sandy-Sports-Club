-- Webmaster announcements and come-and-try events with member RSVPs.
-- The worker also creates these tables on first use.
CREATE TABLE IF NOT EXISTS club_announcements(
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '',
 event_date TEXT,
 event_time TEXT NOT NULL DEFAULT '',
 location TEXT NOT NULL DEFAULT '',
 rsvp INTEGER NOT NULL DEFAULT 0 CHECK(rsvp IN (0,1)),
 audience TEXT NOT NULL DEFAULT 'all' CHECK(audience IN ('all','film')),
 created_by TEXT NOT NULL REFERENCES club_accounts(id),
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL,
 archived_utc TEXT
);
CREATE TABLE IF NOT EXISTS club_announcement_rsvps(
 announcement_id TEXT NOT NULL REFERENCES club_announcements(id),
 account_id TEXT NOT NULL REFERENCES club_accounts(id),
 response TEXT NOT NULL CHECK(response IN ('going','maybe','not_going')),
 children INTEGER NOT NULL DEFAULT 0 CHECK(children BETWEEN 0 AND 8),
 updated_utc TEXT NOT NULL,
 PRIMARY KEY(announcement_id,account_id)
);
