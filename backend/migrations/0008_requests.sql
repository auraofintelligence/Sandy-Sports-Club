-- Wishes and requests from members to the committee. The worker also creates this table on first use.
CREATE TABLE IF NOT EXISTS club_requests(
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL DEFAULT 'wish' CHECK(kind IN ('wish')),
 title TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT '',
 priority TEXT NOT NULL DEFAULT '',
 purpose TEXT NOT NULL DEFAULT '',
 next_step TEXT NOT NULL DEFAULT '',
 from_account TEXT NOT NULL REFERENCES club_accounts(id),
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','planned','declined','done')),
 committee_note TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT,
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS club_requests_status ON club_requests(status,created_utc);
