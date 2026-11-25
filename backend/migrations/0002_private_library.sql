-- Additive only. No production content, accounts or existing records changed.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS sandy_library_documents(
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES club_accounts(id),
 title TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('owner','governance','finance','safety')),
 roles_json TEXT NOT NULL CHECK(json_valid(roles_json)),
 state TEXT NOT NULL CHECK(state IN ('private','withdrawn')),
 version INTEGER NOT NULL CHECK(version>0),
 content_version INTEGER NOT NULL CHECK(content_version>0),
 review_date TEXT NOT NULL,
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL,
 updated_by TEXT NOT NULL REFERENCES club_accounts(id)
);
CREATE INDEX IF NOT EXISTS sandy_library_owner ON sandy_library_documents(owner_id,updated_utc);
CREATE TABLE IF NOT EXISTS sandy_library_versions(
 document_id TEXT NOT NULL REFERENCES sandy_library_documents(id),
 content_version INTEGER NOT NULL,
 media_type TEXT NOT NULL CHECK(media_type IN ('application/pdf','image/png','image/jpeg')),
 byte_length INTEGER NOT NULL CHECK(byte_length>0 AND byte_length<=1048576),
 digest TEXT NOT NULL CHECK(length(digest)=64),
 part_count INTEGER NOT NULL CHECK(part_count>0 AND part_count<=32),
 source_note TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES club_accounts(id),
 created_utc TEXT NOT NULL,
 PRIMARY KEY(document_id,content_version)
);
CREATE TABLE IF NOT EXISTS sandy_library_parts(
 document_id TEXT NOT NULL,
 content_version INTEGER NOT NULL,
 part INTEGER NOT NULL CHECK(part>=0),
 iv TEXT NOT NULL,
 ciphertext TEXT NOT NULL,
 PRIMARY KEY(document_id,content_version,part),
 FOREIGN KEY(document_id,content_version) REFERENCES sandy_library_versions(document_id,content_version)
);
