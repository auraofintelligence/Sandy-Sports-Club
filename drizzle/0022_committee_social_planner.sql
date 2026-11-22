CREATE TABLE committee_social_plans (
  id TEXT PRIMARY KEY, current_version INTEGER NOT NULL CHECK(current_version>0),
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, creator_name TEXT NOT NULL
);
CREATE TABLE committee_social_revisions (
  plan_id TEXT NOT NULL REFERENCES committee_social_plans(id),
  version INTEGER NOT NULL CHECK(version>0), title TEXT NOT NULL, body TEXT NOT NULL,
  planned_date TEXT NOT NULL, channels_json TEXT NOT NULL CHECK(json_valid(channels_json)),
  status TEXT NOT NULL CHECK(status IN ('idea','draft','ready','published')),
  links_json TEXT NOT NULL CHECK(json_valid(links_json)),
  updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, editor_name TEXT NOT NULL,
  PRIMARY KEY(plan_id,version)
);
CREATE INDEX committee_social_dates ON committee_social_revisions(planned_date,plan_id,version);
CREATE VIEW committee_social_current AS
SELECT p.id,p.created_at AS createdAt,p.creator_name AS createdBy,r.version,r.title,r.body,
  r.planned_date AS plannedDate,r.channels_json AS channels,r.status,r.links_json AS links,
  r.updated_at AS updatedAt,r.editor_name AS updatedBy,r.updated_by AS editorId
FROM committee_social_plans p JOIN committee_social_revisions r ON r.plan_id=p.id AND r.version=p.current_version;
