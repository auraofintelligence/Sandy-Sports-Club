-- Sports interest survey on sports.html. Additive only; no existing table changes.
-- Apply only with owner approval, before SANDY_SURVEY_ENABLED is set to enabled.
-- Responses are anonymous: no names, emails or contact details are collected.
-- ip_hash is a keyed hash kept 30 days for rate limits, then blanked.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS club_survey_responses(
 id TEXT PRIMARY KEY,
 created_utc TEXT NOT NULL,
 age_group TEXT NOT NULL DEFAULT '',
 town TEXT NOT NULL DEFAULT '',
 frequency TEXT NOT NULL DEFAULT '',
 ip_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS club_survey_time ON club_survey_responses(created_utc);
CREATE INDEX IF NOT EXISTS club_survey_ip ON club_survey_responses(ip_hash,created_utc);
-- One row per sport a visitor chose, in their priority order (rank 1 is the top choice),
-- with what they want from it: casual play, regular training or regional competition.
CREATE TABLE IF NOT EXISTS club_survey_choices(
 response_id TEXT NOT NULL REFERENCES club_survey_responses(id) ON DELETE CASCADE,
 sport TEXT NOT NULL,
 goal TEXT NOT NULL CHECK(goal IN ('casual','training','compete')),
 rank INTEGER NOT NULL CHECK(rank BETWEEN 1 AND 14),
 PRIMARY KEY(response_id,sport)
);
CREATE INDEX IF NOT EXISTS club_survey_choice_sport ON club_survey_choices(sport,goal);
