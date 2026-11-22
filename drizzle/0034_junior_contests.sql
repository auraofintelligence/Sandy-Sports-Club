CREATE TABLE junior_anglers (
  id TEXT PRIMARY KEY, guardian TEXT NOT NULL REFERENCES club_accounts(id),
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 40),
  guardian_declaration_at TEXT NOT NULL, UNIQUE(id,guardian)
);
CREATE INDEX junior_anglers_guardian ON junior_anglers(guardian);
CREATE TABLE junior_entries (
  id TEXT PRIMARY KEY, guardian TEXT NOT NULL REFERENCES club_accounts(id), child_id TEXT NOT NULL,
  competition_id TEXT NOT NULL REFERENCES honours_competitions(id), species TEXT NOT NULL,
  millimetres INTEGER NOT NULL CHECK(millimetres BETWEEN 1 AND 20000), caught_on TEXT NOT NULL,
  entered TEXT NOT NULL, consent_edition TEXT NOT NULL, result_consent INTEGER NOT NULL CHECK(result_consent IN (0,1)),
  nickname_consent INTEGER NOT NULL DEFAULT 0 CHECK(nickname_consent IN (0,1) AND nickname_consent<=result_consent),
  photo_consent INTEGER NOT NULL CHECK(photo_consent IN (0,1) AND photo_consent<=result_consent),
  initial_digest TEXT NOT NULL, photo_cipher TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','declined','withdrawn')),
  guardian_checked INTEGER NOT NULL DEFAULT 0, catch_checked INTEGER NOT NULL DEFAULT 0, photo_checked INTEGER NOT NULL DEFAULT 0,
  reviewed_by TEXT REFERENCES club_accounts(id), reviewed_at TEXT, version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(child_id,guardian) REFERENCES junior_anglers(id,guardian)
);
CREATE INDEX junior_entries_guardian ON junior_entries(guardian,caught_on);
CREATE INDEX junior_entries_competition ON junior_entries(competition_id,species);
CREATE VIEW junior_live_results AS
  SELECT j.id,CASE WHEN j.nickname_consent=1 THEN c.nickname ELSE 'Junior angler' END AS nickname,j.competition_id,h.title AS competition,j.species,j.millimetres,j.caught_on,
    (j.photo_consent=1 AND j.photo_checked=1) AS photo_live
  FROM junior_entries j JOIN junior_anglers c ON c.id=j.child_id
  JOIN honours_competitions h ON h.id=j.competition_id JOIN member_safeguard_flags f ON f.accountId=j.guardian
  WHERE j.status='verified' AND j.guardian_checked=1 AND j.catch_checked=1 AND j.result_consent=1
    AND f.canEnterHonours=1 AND h.published=1;
CREATE TRIGGER junior_competition_rules BEFORE UPDATE OF season,target_species ON honours_competitions
WHEN EXISTS(SELECT 1 FROM junior_entries j WHERE j.competition_id=NEW.id AND j.status IN ('pending','verified')
    AND (CAST(substr(j.caught_on,1,4) AS INTEGER)<>NEW.season OR
        (json_array_length(NEW.target_species)>0 AND NOT EXISTS(SELECT 1 FROM json_each(NEW.target_species) WHERE value=j.species))))
BEGIN SELECT RAISE(ABORT,'junior_entries_require_targets'); END;
CREATE TRIGGER junior_terms_withdrawn AFTER UPDATE ON member_terms_acceptance
WHEN OLD.accepted=1 AND NEW.accepted=0 BEGIN
  UPDATE junior_entries SET status='withdrawn',result_consent=0,nickname_consent=0,photo_consent=0,version=version+1
    WHERE guardian=NEW.account_id AND status IN ('pending','verified');
END;
-- Paid access expires through the live view even if nobody opens the desk.
-- A fresh term after a lapse requires fresh, per-entry permission to publish.
CREATE TRIGGER junior_membership_ended AFTER UPDATE OF disabled,paid_through ON club_accounts
WHEN NEW.role='member' AND (NEW.disabled=1 OR NEW.paid_through IS NULL OR NEW.paid_through<date('now','+10 hours')
  OR (OLD.paid_through<date('now','+10 hours') AND NEW.paid_through IS NOT OLD.paid_through)) BEGIN
  UPDATE junior_entries SET status='withdrawn',photo_consent=0,nickname_consent=0,result_consent=0,version=version+1
    WHERE guardian=NEW.id AND status IN ('pending','verified');
END;
