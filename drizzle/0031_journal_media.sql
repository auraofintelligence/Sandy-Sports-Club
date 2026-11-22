CREATE TABLE journal_media (
  catch_id TEXT PRIMARY KEY REFERENCES catches(id) ON DELETE CASCADE,
  photo_cipher TEXT,
  pin_cipher TEXT,
  version INTEGER NOT NULL CHECK(version >= 1),
  request_digest TEXT NOT NULL
);
CREATE INDEX journal_pin_ids ON journal_media(catch_id) WHERE pin_cipher IS NOT NULL;
