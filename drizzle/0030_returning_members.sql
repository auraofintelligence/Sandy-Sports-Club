CREATE TABLE returning_member_offers (
  id TEXT PRIMARY KEY, target_type TEXT NOT NULL CHECK(target_type IN ('account','application','paper')),
  register_digest TEXT NOT NULL, paper_label TEXT NOT NULL DEFAULT '',
  account_id TEXT REFERENCES club_accounts(id), application_id TEXT REFERENCES membership_applications(id),
  status TEXT NOT NULL CHECK(status IN ('proposed','approved','activation','granted','cancelled')),
  version INTEGER NOT NULL DEFAULT 1, proposed_by TEXT NOT NULL, proposed_at TEXT NOT NULL,
  approved_by TEXT, approved_at TEXT, accepted_at TEXT, granted_at TEXT,
  previous_through TEXT, paid_through TEXT, category TEXT, waived_fee_cents INTEGER, cancelled_by TEXT, cancelled_at TEXT,
  link_digest TEXT UNIQUE, link_generation INTEGER NOT NULL DEFAULT 0, link_expires INTEGER,
  activation_digest TEXT UNIQUE, activation_generation INTEGER NOT NULL DEFAULT 0,
  CHECK(target_type<>'account' OR account_id IS NOT NULL),
  CHECK(target_type<>'application' OR application_id IS NOT NULL)
);
CREATE UNIQUE INDEX returning_once_per_register ON returning_member_offers(register_digest) WHERE status<>'cancelled';
CREATE UNIQUE INDEX returning_once_per_account ON returning_member_offers(account_id) WHERE status<>'cancelled';
CREATE UNIQUE INDEX returning_once_per_application ON returning_member_offers(application_id) WHERE status<>'cancelled';
CREATE VIEW returning_member_waivers AS
  SELECT o.id,o.status,COALESCE(o.category,p.membership_type,m.membership_type,'unconfirmed') AS category,
    s.login AS proposedBy,o.proposed_at AS proposedAt,t.login AS approvedBy,o.approved_at AS approvedAt,
    o.accepted_at AS acceptedAt,o.granted_at AS grantedAt,o.paid_through AS paidThrough,o.previous_through AS previousThrough,
    o.waived_fee_cents AS waivedFeeCents
  FROM returning_member_offers o LEFT JOIN member_profiles p ON p.account_id=o.account_id
  LEFT JOIN membership_applications m ON m.id=o.application_id
  LEFT JOIN club_accounts s ON s.id=o.proposed_by LEFT JOIN club_accounts t ON t.id=o.approved_by;

-- Only exists during the transaction that credits a complimentary membership.
CREATE TABLE returning_credit_write(account_id TEXT PRIMARY KEY,offer_id TEXT NOT NULL UNIQUE);
CREATE TRIGGER returning_prevent_paid_invite BEFORE INSERT ON club_invites
WHEN NEW.role='member' AND NEW.reset_id IS NULL AND NEW.paid_through IS NOT NULL AND EXISTS(
  SELECT 1 FROM returning_member_offers o JOIN membership_applications m ON m.id=o.application_id
    WHERE m.invite_digest=NEW.digest AND o.status IN ('proposed','approved','activation')
) BEGIN SELECT RAISE(ABORT,'use returning member invitation'); END;
DROP TRIGGER member_renewal_recorded;
CREATE TRIGGER member_renewal_recorded AFTER UPDATE OF paid_through ON club_accounts
WHEN NEW.role='member' AND NEW.disabled=0 AND NEW.paid_through IS NOT NULL AND NEW.paid_through IS NOT OLD.paid_through BEGIN
  UPDATE member_cycle_clock SET completed_day=NULL WHERE id=1;
  DELETE FROM member_notices WHERE account_id=NEW.id AND kind='renewal' AND cycle IS NOT NEW.paid_through;
  INSERT OR IGNORE INTO member_notices(id,account_id,kind,title,body,issue_day)
    SELECT 'paid:'||NEW.id||':'||NEW.paid_through,NEW.id,'payment','Membership payment recorded',
      'Your membership is paid through '||NEW.paid_through||'.',date('now','+10 hours')
    WHERE NOT EXISTS(SELECT 1 FROM returning_credit_write WHERE account_id=NEW.id);
END;
CREATE TRIGGER returning_apply_credit AFTER UPDATE OF status ON returning_member_offers
WHEN NEW.status='granted' AND OLD.status<>'granted' BEGIN
  UPDATE returning_member_offers SET waived_fee_cents=(SELECT price_cents FROM club_fees
    WHERE id='membership-'||NEW.category AND category=NEW.category AND kind='membership' AND active=1
    AND category IN ('adult','cadet','junior','social')) WHERE id=NEW.id;
  INSERT INTO returning_credit_write VALUES(NEW.account_id,NEW.id);
  UPDATE club_accounts SET paid_through=NEW.paid_through WHERE id=NEW.account_id AND role='member' AND disabled=0;
  SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'returning account unavailable') END;
  DELETE FROM returning_credit_write WHERE account_id=NEW.account_id;
  INSERT INTO audit_log(id,actor_id,actor_role,action,entity_id,occurred_at)
    VALUES(lower(hex(randomblob(16))),NEW.account_id,'member','complimentary_year_granted',NEW.id,NEW.granted_at);
END;
-- Claiming an ordinary application invitation creates the normal profile,
-- links the application and credits exactly one year from the activation day.
CREATE TRIGGER returning_new_account AFTER INSERT ON club_accounts WHEN NEW.role='member' BEGIN
  UPDATE returning_member_offers SET account_id=NEW.id,status='granted',version=version+1,
    granted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    paid_through=date('now','+10 hours','+1 year','-1 day'),
    category=(SELECT membership_type FROM membership_applications WHERE id=returning_member_offers.application_id)
    WHERE status='activation' AND EXISTS(
      SELECT 1 FROM club_invites i JOIN membership_applications m ON m.invite_digest=i.digest
      WHERE i.digest=returning_member_offers.activation_digest AND m.id=returning_member_offers.application_id
        AND i.used_by=NEW.id AND i.reset_id IS NULL AND i.login=NEW.login
    );
END;
