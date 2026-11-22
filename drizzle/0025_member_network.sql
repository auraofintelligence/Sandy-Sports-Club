CREATE TABLE network_profiles (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE REFERENCES club_accounts(id),
  display_name TEXT NOT NULL, avatar TEXT NOT NULL, listed INTEGER NOT NULL DEFAULT 0 CHECK(listed IN (0,1)),
  photo TEXT, version INTEGER NOT NULL, mutation TEXT NOT NULL UNIQUE
);
CREATE VIEW network_eligible AS
  SELECT n.id,n.account_id,n.display_name,n.avatar,n.listed,(n.photo IS NOT NULL) AS has_photo
  FROM network_profiles n JOIN club_accounts a ON a.id=n.account_id JOIN member_profiles p ON p.account_id=a.id
  WHERE a.role='member' AND a.disabled=0 AND a.paid_through>=date('now','+10 hours')
  AND p.membership_type IN ('adult','social','casual','lifetime') AND NOT EXISTS (
    SELECT 1 FROM membership_applications x WHERE x.account_id=a.id AND x.status='active' AND x.membership_type IN ('cadet','junior'));
CREATE TABLE network_pairs (
  low_id TEXT NOT NULL REFERENCES network_profiles(id), high_id TEXT NOT NULL REFERENCES network_profiles(id),
  state TEXT NOT NULL CHECK(state IN ('none','pending','friend')), requester TEXT,
  low_block INTEGER NOT NULL DEFAULT 0, high_block INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL, mutation TEXT NOT NULL UNIQUE,
  PRIMARY KEY(low_id,high_id),CHECK(low_id<high_id)
);
CREATE INDEX network_pairs_reverse ON network_pairs(high_id);
CREATE TABLE network_items (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES network_profiles(id), content TEXT NOT NULL, photo TEXT,
  created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, mutation TEXT NOT NULL UNIQUE
);
CREATE INDEX network_items_owner ON network_items(owner_id,created_at DESC);
CREATE TABLE network_recipients (
  item_id TEXT NOT NULL REFERENCES network_items(id), peer_id TEXT NOT NULL REFERENCES network_profiles(id),
  expires_at TEXT, revoked_at TEXT, PRIMARY KEY(item_id,peer_id)
);
CREATE INDEX network_recipients_peer ON network_recipients(peer_id,item_id);
CREATE TABLE network_mutations (
  id TEXT PRIMARY KEY, actor TEXT NOT NULL, digest TEXT NOT NULL, created_at TEXT NOT NULL
);
