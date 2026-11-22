-- Existing meals keep unlimited guest places until the host sets a limit.
ALTER TABLE shared_meals ADD COLUMN guest_limit INTEGER
  CHECK (guest_limit IS NULL OR (typeof(guest_limit)='integer' AND guest_limit>0));

CREATE VIEW shared_meal_headcounts AS
SELECT meal_id, SUM(party_size) AS guests
FROM shared_meal_invites
WHERE response='going' AND revoked=0
GROUP BY meal_id;

-- Check after the row is written so an idempotent INSERT that does nothing
-- never double counts a party. An overflow rolls back the whole statement.
CREATE TRIGGER shared_meal_places_joined AFTER INSERT ON shared_meal_invites
WHEN NEW.response='going' AND NEW.revoked=0 BEGIN
  SELECT RAISE(ABORT,'shared_meal_places_full')
  FROM shared_meals m JOIN shared_meal_headcounts c ON c.meal_id=m.id
  WHERE m.id=NEW.meal_id AND c.guests>m.guest_limit;
END;

CREATE TRIGGER shared_meal_places_changed AFTER UPDATE OF response,party_size,revoked,meal_id ON shared_meal_invites
WHEN NEW.response='going' AND NEW.revoked=0 BEGIN
  SELECT RAISE(ABORT,'shared_meal_places_full')
  FROM shared_meals m JOIN shared_meal_headcounts c ON c.meal_id=m.id
  WHERE m.id=NEW.meal_id AND c.guests>m.guest_limit;
END;

CREATE TRIGGER shared_meal_places_lowered BEFORE UPDATE OF guest_limit ON shared_meals
WHEN NEW.guest_limit IS NOT NULL BEGIN
  SELECT RAISE(ABORT,'shared_meal_places_full')
  FROM shared_meal_headcounts WHERE meal_id=NEW.id AND guests>NEW.guest_limit;
END;
