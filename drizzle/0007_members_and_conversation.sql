ALTER TABLE club_accounts ADD COLUMN paid_through TEXT;
ALTER TABLE club_invites ADD COLUMN paid_through TEXT;
CREATE TABLE community_posts (
  id TEXT PRIMARY KEY, parent_id TEXT REFERENCES community_posts(id), author_id TEXT NOT NULL,
  author_name TEXT NOT NULL, message TEXT NOT NULL, photo TEXT, created_at TEXT NOT NULL, removed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX community_posts_time ON community_posts(parent_id,created_at);
CREATE INDEX community_posts_author ON community_posts(author_id,created_at);
CREATE INDEX club_auth_expiry ON club_auth_attempts(expires);
