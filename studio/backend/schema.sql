-- Optional future D1 schema. This is NOT deployed or connected to the public static site.
-- Identity, permissions, session validation and role checks must be implemented before use.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS studio_settings (
 site TEXT PRIMARY KEY CHECK(site='sandy-sports'),
 version INTEGER NOT NULL CHECK(version>=0),
 settings_json TEXT NOT NULL CHECK(json_valid(settings_json)),
 updated_by_actor TEXT NOT NULL,
 updated_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_revisions (
 id TEXT PRIMARY KEY,
 site TEXT NOT NULL CHECK(site='sandy-sports'),
 version INTEGER NOT NULL CHECK(version>0),
 actor_id TEXT NOT NULL,
 actor_office TEXT NOT NULL,
 actor_role TEXT NOT NULL,
 saved_at_utc TEXT NOT NULL,
 prior_version INTEGER NOT NULL,
 changes_json TEXT NOT NULL CHECK(json_valid(changes_json)),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 UNIQUE(site,version)
);
CREATE TABLE IF NOT EXISTS studio_briefs (
 id TEXT PRIMARY KEY,
 version INTEGER NOT NULL CHECK(version>0),
 title TEXT NOT NULL,
 source_post_id TEXT,
 planned_date TEXT,
 production_route TEXT NOT NULL,
 proposed_assignee TEXT,
 status TEXT NOT NULL CHECK(status IN ('idea','prepared','handoff-proposed','assigned','delivered','review','approved','rejected','publish-authorised','published','closed')),
 source_link TEXT,
 notes_json TEXT NOT NULL DEFAULT '{}',
 last_editor_id TEXT NOT NULL,
 updated_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_brief_revisions (
 id TEXT PRIMARY KEY,
 brief_id TEXT NOT NULL REFERENCES studio_briefs(id),
 version INTEGER NOT NULL CHECK(version>0),
 actor_id TEXT NOT NULL,
 actor_office TEXT NOT NULL,
 actor_role TEXT NOT NULL,
 saved_at_utc TEXT NOT NULL,
 before_json TEXT NOT NULL CHECK(json_valid(before_json)),
 after_json TEXT NOT NULL CHECK(json_valid(after_json)),
 UNIQUE(brief_id,version)
);
CREATE TABLE IF NOT EXISTS studio_decisions (
 id TEXT PRIMARY KEY,
 brief_id TEXT NOT NULL REFERENCES studio_briefs(id),
 brief_version INTEGER NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected','returned')),
 authorised_actor_id TEXT NOT NULL,
 authorised_office TEXT NOT NULL,
 decided_at_utc TEXT NOT NULL,
 scope_json TEXT NOT NULL CHECK(json_valid(scope_json)),
 evidence_https_url TEXT,
 recorded_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_handoffs (
 id TEXT PRIMARY KEY,
 brief_id TEXT NOT NULL REFERENCES studio_briefs(id),
 decision_id TEXT REFERENCES studio_decisions(id),
 contractor TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('proposed','authorised','delivered','withdrawn')),
 issued_by_actor TEXT,
 issued_at_utc TEXT,
 requested_delivery_date TEXT,
 returned_asset_links_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS studio_post_links (
 id TEXT PRIMARY KEY,
 brief_id TEXT NOT NULL REFERENCES studio_briefs(id),
 decision_id TEXT REFERENCES studio_decisions(id),
 platform TEXT NOT NULL CHECK(platform IN ('youtube','facebook','instagram','tiktok','noticeboard')),
 public_https_url TEXT NOT NULL,
 published_at_utc TEXT,
 recorded_by_actor TEXT NOT NULL,
 recorded_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_brief_status ON studio_briefs(status,planned_date);
CREATE INDEX IF NOT EXISTS studio_revisions_date ON studio_revisions(saved_at_utc);
CREATE INDEX IF NOT EXISTS studio_handoffs_brief ON studio_handoffs(brief_id);
