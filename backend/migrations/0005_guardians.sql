-- Guardian gateway: children are profiles managed by a joined adult guardian.
-- Children have no login or contact details; date of birth sets the age group. The worker also creates
-- this table on first use so a deploy works before this migration is applied.
CREATE TABLE IF NOT EXISTS club_guardian_links(
 child_person_id TEXT PRIMARY KEY REFERENCES club_people(id),
 guardian_account_id TEXT NOT NULL REFERENCES club_accounts(id),
 relationship TEXT NOT NULL DEFAULT 'parent' CHECK(relationship IN ('parent','guardian','carer','grandparent','other')),
 age_band TEXT NOT NULL CHECK(age_band IN ('under16','16-17')),
 participation_permission INTEGER NOT NULL DEFAULT 1 CHECK(participation_permission IN (0,1)),
 photo_permission INTEGER NOT NULL DEFAULT 0 CHECK(photo_permission IN (0,1)),
 interests_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(interests_json)),
 dob TEXT NOT NULL DEFAULT '',
 gender TEXT NOT NULL DEFAULT '',
 avatar_id TEXT NOT NULL DEFAULT '',
 photo TEXT,
 picture_type TEXT NOT NULL DEFAULT '' CHECK(picture_type IN ('','avatar','photo')),
 version INTEGER NOT NULL DEFAULT 1,
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL,
 withdrawn_utc TEXT
);
CREATE INDEX IF NOT EXISTS club_guardian_links_guardian ON club_guardian_links(guardian_account_id);
