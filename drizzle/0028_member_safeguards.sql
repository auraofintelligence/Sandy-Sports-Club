CREATE TABLE member_safeguard_policy (
  id INTEGER PRIMARY KEY CHECK(id=1), terms_version TEXT NOT NULL
);
INSERT INTO member_safeguard_policy VALUES (1,'sandy-initial-v1');
CREATE TABLE member_age_checks (
  account_id TEXT PRIMARY KEY REFERENCES club_accounts(id),
  age_band TEXT NOT NULL CHECK(age_band IN ('unconfirmed','under16','16+')),
  guardian_permission INTEGER NOT NULL CHECK(guardian_permission IN (0,1) AND (age_band='under16' OR guardian_permission=0)),
  version INTEGER NOT NULL CHECK(version>=1), verified_at TEXT NOT NULL, verified_by TEXT NOT NULL
);
CREATE TABLE member_terms_acceptance (
  account_id TEXT PRIMARY KEY REFERENCES club_accounts(id),
  terms_version TEXT NOT NULL, accepted INTEGER NOT NULL CHECK(accepted IN (0,1)),
  version INTEGER NOT NULL CHECK(version>=1), updated_at TEXT NOT NULL
);
CREATE VIEW member_safeguard_flags AS
  WITH account_flags AS (
    SELECT a.id AS accountId, COALESCE(c.age_band,'unconfirmed') AS ageBand,
      COALESCE(c.guardian_permission,0) AS guardianPermission, p.terms_version AS termsVersion,
      COALESCE(t.accepted=1 AND t.terms_version=p.terms_version,0) AS accepted,
      COALESCE(t.version,0) AS version,
      COALESCE(a.disabled=0 AND a.paid_through>=date('now','+10 hours'),0) AS paid
    FROM club_accounts a CROSS JOIN member_safeguard_policy p
    LEFT JOIN member_age_checks c ON c.account_id=a.id
    LEFT JOIN member_terms_acceptance t ON t.account_id=a.id WHERE a.role='member'
  )
  SELECT *, (paid AND ageBand='16+' AND accepted) AS socialAccess,
    (paid AND ageBand='16+' AND accepted) AS canEnterHonours,
    (paid AND (ageBand='16+' OR (ageBand='under16' AND guardianPermission))) AS canUseJournal
  FROM account_flags;
DROP VIEW IF EXISTS network_eligible;
CREATE VIEW network_eligible AS
  SELECT n.id,n.account_id,n.display_name,n.avatar,n.listed,(n.photo IS NOT NULL) AS has_photo
  FROM network_profiles n JOIN member_safeguard_flags f ON f.accountId=n.account_id WHERE f.socialAccess=1;

-- A changed decision retires grants permanently, including grants received.
-- Reducing access never deletes the member's saved entries or photos.
CREATE VIEW safeguard_grants AS
  SELECT r.item_id,r.peer_id,p.account_id AS recipient,o.account_id AS sender
  FROM network_recipients r JOIN network_profiles p ON p.id=r.peer_id
  JOIN network_items i ON i.id=r.item_id JOIN network_profiles o ON o.id=i.owner_id
  WHERE r.revoked_at IS NULL;
CREATE TRIGGER safeguard_age_revoke AFTER UPDATE ON member_age_checks
WHEN OLD.age_band='16+' AND NEW.age_band<>'16+' BEGIN
  UPDATE member_terms_acceptance SET accepted=0,version=version+1,updated_at=NEW.verified_at
    WHERE account_id=NEW.account_id AND accepted=1;
  UPDATE network_recipients SET revoked_at=NEW.verified_at WHERE (item_id,peer_id) IN
    (SELECT item_id,peer_id FROM safeguard_grants WHERE sender=NEW.account_id OR recipient=NEW.account_id);
  UPDATE network_profiles SET listed=0,version=version+1 WHERE account_id=NEW.account_id AND listed=1;
  UPDATE network_pairs SET state='none',requester=NULL,version=version+1 WHERE state<>'none'
    AND (low_id IN (SELECT id FROM network_profiles WHERE account_id=NEW.account_id)
    OR high_id IN (SELECT id FROM network_profiles WHERE account_id=NEW.account_id));
END;
CREATE TRIGGER safeguard_policy_recheck AFTER UPDATE OF terms_version ON member_safeguard_policy
WHEN NEW.terms_version<>OLD.terms_version BEGIN
  UPDATE member_terms_acceptance SET accepted=0,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE accepted=1;
END;
CREATE TRIGGER safeguard_terms_revoke AFTER UPDATE ON member_terms_acceptance
WHEN OLD.accepted=1 AND NEW.accepted=0 BEGIN
  UPDATE network_recipients SET revoked_at=NEW.updated_at WHERE (item_id,peer_id) IN
    (SELECT item_id,peer_id FROM safeguard_grants WHERE sender=NEW.account_id OR recipient=NEW.account_id);
  UPDATE network_profiles SET listed=0,version=version+1 WHERE account_id=NEW.account_id AND listed=1;
  UPDATE network_pairs SET state='none',requester=NULL,version=version+1 WHERE state<>'none'
    AND (low_id IN (SELECT id FROM network_profiles WHERE account_id=NEW.account_id)
    OR high_id IN (SELECT id FROM network_profiles WHERE account_id=NEW.account_id));
END;
