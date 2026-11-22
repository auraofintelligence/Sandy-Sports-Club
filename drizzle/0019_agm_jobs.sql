CREATE TABLE agm_job_plans (
  meeting_id TEXT PRIMARY KEY REFERENCES meeting_register(id),
  basis TEXT NOT NULL CHECK(basis IN ('fresh','adjourned')),
  version INTEGER NOT NULL
);
CREATE TABLE agm_job_state (
  meeting_id TEXT NOT NULL REFERENCES meeting_register(id),
  job TEXT NOT NULL, owner_id TEXT, owner_name TEXT,
  done_at TEXT, done_by TEXT, version INTEGER NOT NULL,
  PRIMARY KEY(meeting_id,job)
);

-- Confirming notes of an informal discussion cannot give authority to delegate.
CREATE VIEW formal_authority_decisions AS
SELECT r.id,r.title,r.date,d.value AS motion
FROM meeting_register r JOIN meeting_notes n ON n.id=r.id
LEFT JOIN meeting_agendas a ON a.meeting_id=r.id JOIN json_each(n.decisions_json) d
WHERE n.status='approved'
AND coalesce(json_extract(a.formal_json,'$.kind'),r.agenda_kind)<>'informal'
AND (a.formal_json IS NULL OR json_extract(a.formal_json,'$.quorumStatus')='present'
  OR (json_extract(a.formal_json,'$.quorumStatus')='lost' AND EXISTS (
    SELECT 1 FROM json_each(a.formal_json,'$.items') item JOIN json_each(item.value,'$.motions') vote
    WHERE json_extract(vote.value,'$.outcome')='carried' AND json_extract(vote.value,'$.text')=d.value
  )));
