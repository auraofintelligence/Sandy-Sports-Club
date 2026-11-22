ALTER TABLE meeting_register ADD COLUMN agenda_kind TEXT NOT NULL DEFAULT 'committee'
  CHECK (agenda_kind IN ('committee','general','agm','special','informal'));

-- Existing topic lists and reviewed reminder snapshots remain intact.
ALTER TABLE meeting_agendas ADD COLUMN formal_json TEXT CHECK(formal_json IS NULL OR json_valid(formal_json));
