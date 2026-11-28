-- Member profiles, opt-in member directory and connections between adult members.
-- The worker also creates these tables on first use.
CREATE TABLE IF NOT EXISTS club_member_profiles(
 account_id TEXT PRIMARY KEY REFERENCES club_accounts(id),
 bio TEXT NOT NULL DEFAULT '',
 sports_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(sports_json)),
 skill_level TEXT NOT NULL DEFAULT '' CHECK(skill_level IN ('','new','social','competitive','coach')),
 availability_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(availability_json)),
 film_member INTEGER NOT NULL DEFAULT 0 CHECK(film_member IN (0,1)),
 crew_skills_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(crew_skills_json)),
 helping_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(helping_json)),
 directory_visible INTEGER NOT NULL DEFAULT 0 CHECK(directory_visible IN (0,1)),
 show_town INTEGER NOT NULL DEFAULT 0 CHECK(show_town IN (0,1)),
 share_contact INTEGER NOT NULL DEFAULT 0 CHECK(share_contact IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 updated_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS club_member_connections(
 low_id TEXT NOT NULL REFERENCES club_accounts(id),
 high_id TEXT NOT NULL REFERENCES club_accounts(id),
 requested_by TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','connected','blocked')),
 blocked_by TEXT,
 created_utc TEXT NOT NULL,
 updated_utc TEXT NOT NULL,
 PRIMARY KEY(low_id,high_id),
 CHECK(low_id<high_id)
);
