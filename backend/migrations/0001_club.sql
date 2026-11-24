-- Sandy Sports Club: isolated shared Cloudflare D1 schema.
-- Proposed club: no active members, confirmed officers or approvals are seeded.
-- Apply only to a NEW Sandy D1 database, never PLFC's database.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS club_accounts(
 id TEXT PRIMARY KEY,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('webmaster','webmaster_demo','president','vice_president','secretary','assistant_secretary','treasurer','committee','member')),
 office_label TEXT NOT NULL DEFAULT '',
 display_name TEXT NOT NULL DEFAULT '',
 person_id TEXT,
 state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','active','disabled')),
 password_salt TEXT,
 password_verifier TEXT,
 created_utc TEXT NOT NULL,
 activated_utc TEXT,
 last_login_utc TEXT,
 CHECK(state!='active' OR (password_salt IS NOT NULL AND password_verifier IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS club_sessions(
 digest TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES club_accounts(id),
 created_epoch INTEGER NOT NULL,
 expires_epoch INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS club_sessions_owner ON club_sessions(account_id,expires_epoch);
CREATE TABLE IF NOT EXISTS club_invites(
 digest TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES club_accounts(id),
 issued_by TEXT NOT NULL REFERENCES club_accounts(id),
 created_epoch INTEGER NOT NULL,
 expires_epoch INTEGER NOT NULL,
 redeemed_epoch INTEGER
);
CREATE INDEX IF NOT EXISTS club_invites_owner ON club_invites(account_id,expires_epoch);
CREATE TABLE IF NOT EXISTS club_login_attempts(
 key TEXT PRIMARY KEY,
 count INTEGER NOT NULL DEFAULT 0,
 expires_epoch INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS club_people(
 id TEXT PRIMARY KEY,
 account_id TEXT REFERENCES club_accounts(id),
 full_name TEXT NOT NULL,
 preferred_name TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 mobile TEXT NOT NULL DEFAULT '',
 membership_class TEXT NOT NULL DEFAULT 'interested',
 status TEXT NOT NULL DEFAULT 'interested' CHECK(status IN ('interested','founder_prospect','applicant','pending','active','lapsed','inactive','withdrawn')),
 joined_on TEXT,
 renewal_on TEXT,
 gender TEXT NOT NULL DEFAULT '',
 town TEXT NOT NULL DEFAULT '',
 audience_region TEXT NOT NULL DEFAULT '' CHECK(audience_region IN ('','local','regional','tourist','other')),
 consent_contact INTEGER NOT NULL DEFAULT 0 CHECK(consent_contact IN (0,1)),
 consent_publication INTEGER NOT NULL DEFAULT 0 CHECK(consent_publication IN (0,1)),
 source TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS club_people_join ON club_people(joined_on);
CREATE INDEX IF NOT EXISTS club_people_renewal ON club_people(renewal_on);
CREATE INDEX IF NOT EXISTS club_people_town ON club_people(town,status);
CREATE INDEX IF NOT EXISTS club_people_class ON club_people(membership_class,status);
CREATE INDEX IF NOT EXISTS club_people_email ON club_people(email);
CREATE TABLE IF NOT EXISTS club_interest(
 id TEXT PRIMARY KEY,
 created_utc TEXT NOT NULL,
 first_name TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 town TEXT NOT NULL DEFAULT '',
 audience_region TEXT NOT NULL DEFAULT 'other',
 interests_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(interests_json)),
 comments TEXT NOT NULL DEFAULT '',
 contact_consent INTEGER NOT NULL CHECK(contact_consent IN (0,1)),
 source TEXT NOT NULL DEFAULT '',
 reviewed_utc TEXT,
 reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS club_interest_date ON club_interest(created_utc);

CREATE TABLE IF NOT EXISTS club_records(
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('event','meeting','task','calendar','grant','asset','equipment','fundraising','film','sponsor','partner','volunteer','newsletter','notice','governance','production','safeguard')),
 title TEXT NOT NULL,
 body_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(body_json)),
 status TEXT NOT NULL DEFAULT 'proposal' CHECK(status IN ('proposal','draft','review','approved','scheduled','completed','archived','rejected')),
 event_date TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL REFERENCES club_accounts(id),
 updated_by TEXT NOT NULL REFERENCES club_accounts(id),
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS club_records_kind_date ON club_records(kind,event_date);
CREATE INDEX IF NOT EXISTS club_records_status ON club_records(status);

CREATE TABLE IF NOT EXISTS studio_settings(
 id INTEGER PRIMARY KEY CHECK(id=1),
 version INTEGER NOT NULL CHECK(version>0),
 settings_json TEXT NOT NULL CHECK(json_valid(settings_json)),
 updated_by TEXT NOT NULL REFERENCES club_accounts(id),
 updated_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_post_edits(
 id INTEGER PRIMARY KEY CHECK(id=1),
 version INTEGER NOT NULL CHECK(version>0),
 edits_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(edits_json)),
 updated_by TEXT NOT NULL REFERENCES club_accounts(id),
 updated_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_briefs(
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 date TEXT,
 source_post_id TEXT NOT NULL DEFAULT '',
 source_url TEXT NOT NULL DEFAULT '',
 brief TEXT NOT NULL DEFAULT '',
 producer TEXT NOT NULL DEFAULT 'in-house',
 reviewer TEXT NOT NULL DEFAULT 'founding',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','proposed','prepared','revision','evidence','closed','assigned','delivered','approved','rejected','published')),
 due TEXT,
 author_note TEXT NOT NULL DEFAULT '',
 decision_by_note TEXT NOT NULL DEFAULT '',
 evidence TEXT NOT NULL DEFAULT '',
 published_url TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL REFERENCES club_accounts(id),
 updated_by TEXT NOT NULL REFERENCES club_accounts(id),
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_briefs_date ON studio_briefs(date,status);
CREATE TABLE IF NOT EXISTS studio_decisions(
 id TEXT PRIMARY KEY,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('record','studio_brief','studio_post')),
 entity_id TEXT NOT NULL,
 entity_version INTEGER NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected','returned','publish_authorised')),
 scope_json TEXT NOT NULL CHECK(json_valid(scope_json)),
 evidence_url TEXT NOT NULL,
 authorised_actor TEXT NOT NULL REFERENCES club_accounts(id),
 authorised_office TEXT NOT NULL,
 decided_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_decisions_entity ON studio_decisions(entity_type,entity_id,decided_utc);

CREATE TABLE IF NOT EXISTS club_revisions(
 id TEXT PRIMARY KEY,
 resource_kind TEXT NOT NULL,
 resource_id TEXT NOT NULL,
 resource_version INTEGER NOT NULL,
 operation TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES club_accounts(id),
 actor_role TEXT NOT NULL,
 actor_office TEXT NOT NULL,
 at_utc TEXT NOT NULL,
 changes_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(changes_json)),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 UNIQUE(resource_kind,resource_id,resource_version)
);
CREATE INDEX IF NOT EXISTS club_revisions_entity ON club_revisions(resource_kind,resource_id,resource_version DESC);
CREATE TABLE IF NOT EXISTS club_audit(
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES club_accounts(id),
 actor_role TEXT NOT NULL,
 action TEXT NOT NULL,
 resource_kind TEXT NOT NULL,
 resource_id TEXT NOT NULL,
 occurred_utc TEXT NOT NULL,
 context_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(context_json))
);
CREATE INDEX IF NOT EXISTS club_audit_time ON club_audit(occurred_utc DESC);
