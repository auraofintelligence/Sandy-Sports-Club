CREATE TABLE sponsor_offers (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK(source IN ('nomination','lead')),
  offer_cipher TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('new','reviewing','agreed','declined')),
  owner TEXT NOT NULL DEFAULT '',
  follow_up_on TEXT NOT NULL DEFAULT '',
  loan_eligible INTEGER NOT NULL DEFAULT 0 CHECK(loan_eligible IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX sponsor_offers_date ON sponsor_offers(created_at DESC,id DESC);
CREATE INDEX sponsor_offers_status_date ON sponsor_offers(status,created_at DESC,id DESC);
CREATE TABLE sponsor_offer_reviews (
  offer_id TEXT NOT NULL REFERENCES sponsor_offers(id),
  version INTEGER NOT NULL,
  retry_key TEXT NOT NULL,
  review_cipher TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY(offer_id,version)
);
