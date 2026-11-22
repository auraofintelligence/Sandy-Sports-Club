CREATE TABLE newsletter_recipes (
  month TEXT NOT NULL REFERENCES newsletter_editions(month),
  office TEXT NOT NULL CHECK(office IN ('president','vicepresident','secretary','assistantsecretary','treasurer')),
  title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','submitted','included')),
  version INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, last_key TEXT NOT NULL,
  PRIMARY KEY(month,office)
);
CREATE TABLE newsletter_recipe_revisions (
  month TEXT NOT NULL, office TEXT NOT NULL, version INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(month,office,version)
);
CREATE VIEW newsletter_articles AS
  SELECT month,office,'article' AS kind,title,body,status,version,updated_at FROM newsletter_contributions
  UNION ALL
  SELECT month,office,'recipe' AS kind,title,body,status,version,updated_at FROM newsletter_recipes;

CREATE TRIGGER newsletter_recipe_created AFTER INSERT ON newsletter_recipes BEGIN
  INSERT INTO newsletter_recipe_revisions VALUES(NEW.month,NEW.office,NEW.version,NEW.title,NEW.body,NEW.status,NEW.updated_at,NEW.updated_by);
END;
CREATE TRIGGER newsletter_recipe_updated AFTER UPDATE ON newsletter_recipes BEGIN
  INSERT INTO newsletter_recipe_revisions VALUES(NEW.month,NEW.office,NEW.version,NEW.title,NEW.body,NEW.status,NEW.updated_at,NEW.updated_by);
  UPDATE newsletter_editions SET version=version+1,last_key=NULL,updated_at=NEW.updated_at,updated_by=NEW.updated_by
    WHERE month=NEW.month AND (NEW.status='included' OR OLD.status='included');
END;
CREATE TRIGGER newsletter_recipe_frozen BEFORE UPDATE ON newsletter_recipes
  WHEN EXISTS(SELECT 1 FROM newsletter_editions WHERE month=OLD.month AND status<>'draft') BEGIN
  SELECT RAISE(ABORT,'This edition is closed for edits');
END;
CREATE TRIGGER newsletter_recipe_late BEFORE INSERT ON newsletter_recipes
  WHEN EXISTS(SELECT 1 FROM newsletter_editions WHERE month=NEW.month AND status<>'draft') BEGIN
  SELECT RAISE(ABORT,'This edition is closed for edits');
END;

DROP TRIGGER newsletter_edition_released;
CREATE TRIGGER newsletter_edition_released AFTER UPDATE OF status ON newsletter_editions WHEN NEW.status='published' AND OLD.status<>'published' BEGIN
  INSERT INTO member_bulletins(id,kind,audience,title,body,issue_day,created_by,edition_month)
    VALUES(NEW.bulletin_id,'newsletter','all',NEW.title,NEW.body||
    CASE WHEN NEW.president_message='' THEN '' ELSE char(10)||char(10)||'From the president'||char(10)||NEW.president_message END||
    coalesce((SELECT group_concat(char(10)||char(10)||title||char(10)||body,'') FROM
      (SELECT title,body FROM newsletter_articles WHERE month=NEW.month AND status='included' ORDER BY kind,office)), ''),
    date(NEW.published_at,'+10 hours'),NEW.updated_by,NEW.month);
END;
