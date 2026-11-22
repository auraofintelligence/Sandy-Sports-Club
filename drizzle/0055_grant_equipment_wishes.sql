CREATE TABLE committee_grant_wishes (
  grant_id TEXT NOT NULL REFERENCES committee_grants(id) ON DELETE CASCADE,
  wish_id TEXT NOT NULL REFERENCES equipment_wishes(id) ON DELETE CASCADE,
  PRIMARY KEY (grant_id, wish_id)
);
CREATE INDEX committee_grant_wishes_by_wish ON committee_grant_wishes(wish_id, grant_id);

-- Identifies an exact retry of the last versioned grant change.
ALTER TABLE committee_grants ADD COLUMN last_change TEXT NOT NULL DEFAULT '';
