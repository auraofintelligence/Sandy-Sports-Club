-- Public nominations and spam quarantine. Additive only; no existing table changes.
-- Apply only with owner approval, before SANDY_NOMINATIONS_ENABLED is set to enabled.
PRAGMA foreign_keys=ON;
-- Each genuine nomination links to one private people-register row (club_people).
-- No contact details are copied here; ip_hash is a keyed hash kept 30 days for rate limits.
CREATE TABLE IF NOT EXISTS club_nominations(
 id TEXT PRIMARY KEY,
 person_id TEXT NOT NULL REFERENCES club_people(id),
 created_utc TEXT NOT NULL,
 pathway TEXT NOT NULL,
 town TEXT NOT NULL DEFAULT '',
 interests TEXT NOT NULL DEFAULT '',
 offer TEXT NOT NULL DEFAULT '',
 origin TEXT NOT NULL CHECK(origin IN ('form','released_from_spam')),
 ip_hash TEXT NOT NULL DEFAULT '',
 alert_state TEXT NOT NULL DEFAULT 'pending' CHECK(alert_state IN ('pending','sent','failed','not_configured')),
 alert_utc TEXT
);
CREATE INDEX IF NOT EXISTS club_nominations_time ON club_nominations(created_utc);
CREATE INDEX IF NOT EXISTS club_nominations_ip ON club_nominations(ip_hash,created_utc);
-- Everything spam protection catches is kept here, apart from the register, until
-- expires_utc (90 days, for the owner to confirm). Minimal metadata only.
CREATE TABLE IF NOT EXISTS club_spam_quarantine(
 id TEXT PRIMARY KEY,
 created_utc TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('turnstile_failed','honeypot','rate_limited','malformed','cross_origin')),
 detail TEXT NOT NULL DEFAULT '',
 ip_hash TEXT NOT NULL DEFAULT '',
 user_agent TEXT NOT NULL DEFAULT '',
 payload_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload_json)),
 expires_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS club_spam_time ON club_spam_quarantine(created_utc);
CREATE INDEX IF NOT EXISTS club_spam_expiry ON club_spam_quarantine(expires_utc);
-- When a flood passes the hourly storage cap, only a counter is kept.
CREATE TABLE IF NOT EXISTS club_spam_overflow(
 hour_utc TEXT PRIMARY KEY,
 dropped INTEGER NOT NULL DEFAULT 0 CHECK(dropped>=0)
);
-- One daily alert digest per Brisbane date.
CREATE TABLE IF NOT EXISTS club_alert_digests(
 digest_date TEXT PRIMARY KEY,
 sent_utc TEXT NOT NULL,
 genuine INTEGER NOT NULL DEFAULT 0,
 quarantined INTEGER NOT NULL DEFAULT 0,
 overflow INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL CHECK(state IN ('sent','failed'))
);
