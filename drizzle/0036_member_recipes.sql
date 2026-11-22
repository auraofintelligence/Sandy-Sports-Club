CREATE TABLE member_recipes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES club_accounts(id),
  content TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version>0),
  published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
  write_token TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX member_recipe_owner ON member_recipes(owner_id);
CREATE INDEX member_recipe_date ON member_recipes(created DESC,id DESC);
CREATE TABLE member_recipe_photos (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES member_recipes(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 3),
  content TEXT NOT NULL,
  UNIQUE(recipe_id,slot)
);
CREATE TRIGGER unshare_recipes_with_terms AFTER UPDATE OF accepted ON member_terms_acceptance
WHEN OLD.accepted=1 AND NEW.accepted=0 BEGIN
  UPDATE member_recipes SET published=0,version=version+1 WHERE owner_id=NEW.account_id AND published=1;
END;
CREATE TRIGGER unshare_recipes_after_lapse AFTER UPDATE OF disabled,paid_through ON club_accounts
WHEN NEW.disabled=1 OR NEW.paid_through IS NULL OR NEW.paid_through<date('now','+10 hours')
 OR (OLD.paid_through<date('now','+10 hours') AND NEW.paid_through IS NOT OLD.paid_through) BEGIN
  UPDATE member_recipes SET published=0,version=version+1 WHERE owner_id=NEW.id AND published=1;
END;
