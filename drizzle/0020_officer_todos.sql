CREATE TABLE officer_todo_items (
  id TEXT PRIMARY KEY, office TEXT NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL, due_date TEXT NOT NULL,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, done_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX officer_open_todos ON officer_todo_items(office,done_at,due_date);
CREATE TABLE officer_action_owners (
  meeting_id TEXT NOT NULL REFERENCES meeting_register(id),action_id TEXT NOT NULL,original_owner TEXT NOT NULL,office TEXT NOT NULL,
  PRIMARY KEY(meeting_id,action_id)
);
CREATE TABLE officer_todo_log (
  mutation TEXT PRIMARY KEY,action TEXT NOT NULL,source TEXT NOT NULL,task_id TEXT NOT NULL,meeting_id TEXT NOT NULL,
  office TEXT NOT NULL,title TEXT NOT NULL,base_version INTEGER NOT NULL,paper INTEGER NOT NULL,
  recorded_by TEXT NOT NULL,recorder_name TEXT NOT NULL,recorded_at TEXT NOT NULL
);
CREATE INDEX officer_todo_activity ON officer_todo_log(office,recorded_at);
