CREATE TABLE library_parts (
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  part INTEGER NOT NULL CHECK (part >= 0),
  encoded TEXT NOT NULL,
  PRIMARY KEY (digest, part)
) WITHOUT ROWID;

CREATE TABLE library_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_date TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL,
  access_level TEXT NOT NULL CHECK (access_level IN ('member', 'committee')),
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  byte_length INTEGER NOT NULL CHECK (byte_length BETWEEN 1 AND 1000000),
  part_count INTEGER NOT NULL CHECK (part_count > 0),
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
