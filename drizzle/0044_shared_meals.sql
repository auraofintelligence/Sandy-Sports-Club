CREATE TABLE shared_meals (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES club_accounts(id),
  venue_type TEXT NOT NULL CHECK (venue_type IN ('home','bbq')),
  visibility TEXT NOT NULL CHECK (visibility IN ('invited','members')),
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
  contents TEXT NOT NULL, location TEXT NOT NULL, job_count INTEGER NOT NULL CHECK(job_count BETWEEN 0 AND 8),
  receipt TEXT NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0 CHECK(cancelled IN (0,1))
);
CREATE INDEX shared_meals_host ON shared_meals(host_id,starts_at);
CREATE INDEX shared_meals_calendar ON shared_meals(ends_at,visibility);
CREATE TABLE shared_meal_invites (
  id TEXT PRIMARY KEY, meal_id TEXT NOT NULL REFERENCES shared_meals(id),
  member_id TEXT REFERENCES club_accounts(id), guest_name TEXT, browser_hash TEXT,
  response TEXT NOT NULL DEFAULT 'pending' CHECK(response IN ('pending','going','declined')),
  party_size INTEGER NOT NULL DEFAULT 1 CHECK(party_size BETWEEN 1 AND 8),
  dietary TEXT, contribution TEXT, revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
  CHECK((member_id IS NULL)=(guest_name IS NOT NULL)),
  UNIQUE(meal_id,member_id)
);
CREATE INDEX shared_meal_inbox ON shared_meal_invites(member_id,meal_id);
CREATE INDEX shared_meal_guests ON shared_meal_invites(meal_id,revoked,response);
CREATE TABLE shared_meal_jobs (
  meal_id TEXT NOT NULL REFERENCES shared_meals(id), slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 7),
  invite_id TEXT REFERENCES shared_meal_invites(id),
  PRIMARY KEY(meal_id,slot)
);
CREATE VIEW shared_meal_blocked AS
 SELECT a.account_id AS first_id,b.account_id AS second_id FROM network_pairs n
 JOIN network_profiles a ON a.id=n.low_id JOIN network_profiles b ON b.id=n.high_id
 WHERE n.low_block=1 OR n.high_block=1;
CREATE TRIGGER shared_meal_release_jobs AFTER UPDATE OF revoked,response ON shared_meal_invites
WHEN NEW.revoked=1 OR NEW.response<>'going' BEGIN
 DELETE FROM shared_meal_jobs WHERE meal_id=NEW.meal_id AND invite_id=NEW.id;
END;
CREATE TRIGGER shared_meal_withdraw AFTER UPDATE OF accepted ON member_terms_acceptance
WHEN OLD.accepted=1 AND NEW.accepted=0 BEGIN
 UPDATE shared_meals SET cancelled=1 WHERE host_id=NEW.account_id;
 UPDATE shared_meal_invites SET revoked=1,dietary=NULL,contribution=NULL WHERE member_id=NEW.account_id;
END;
CREATE VIEW shared_meal_profile_pairs AS
 SELECT i.id AS invitation,min(h.id,p.id) AS low_profile,max(h.id,p.id) AS high_profile
 FROM shared_meal_invites i JOIN shared_meals m ON m.id=i.meal_id
 JOIN network_profiles h ON h.account_id=m.host_id JOIN network_profiles p ON p.account_id=i.member_id;
CREATE TRIGGER shared_meal_new_block AFTER INSERT ON network_pairs WHEN NEW.low_block OR NEW.high_block BEGIN
 UPDATE shared_meal_invites SET revoked=1,dietary=NULL,contribution=NULL
 WHERE id IN (SELECT invitation FROM shared_meal_profile_pairs WHERE low_profile=NEW.low_id AND high_profile=NEW.high_id);
END;
CREATE TRIGGER shared_meal_block AFTER UPDATE ON network_pairs
WHEN ((NEW.low_block OR NEW.high_block) AND NOT (OLD.low_block OR OLD.high_block))
  OR (OLD.state='friend' AND NEW.state<>'friend') BEGIN
 UPDATE shared_meal_invites SET revoked=1,dietary=NULL,contribution=NULL
 WHERE id IN (SELECT invitation FROM shared_meal_profile_pairs WHERE low_profile=NEW.low_id AND high_profile=NEW.high_id);
END;
