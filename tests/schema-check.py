from pathlib import Path
import sqlite3

sql = Path("backend/migrations/0001_club.sql").read_text()
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(sql)
db.executescript(Path("backend/migrations/0002_private_library.sql").read_text())
db.executescript(Path("backend/migrations/0003_nominations.sql").read_text())
db.executescript(Path("backend/migrations/0004_survey.sql").read_text())
required = {
    "club_accounts", "club_sessions", "club_invites", "club_login_attempts",
    "club_people", "club_interest", "club_records",
    "studio_settings", "studio_post_edits", "studio_metrics",
    "studio_briefs", "studio_decisions", "studio_handoffs", "studio_post_links",
    "club_revisions", "club_audit",
    "sandy_library_documents", "sandy_library_versions", "sandy_library_parts",
    "club_nominations", "club_spam_quarantine", "club_spam_overflow", "club_alert_digests",
    "club_survey_responses", "club_survey_choices",
}
tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
missing = required - tables
assert not missing, f"Missing shared-club database tables: {missing}"
assert len(list(db.execute("PRAGMA foreign_key_check"))) == 0
assert not list(db.execute("SELECT * FROM club_accounts")), "Never seed fake office holders"
assert not list(db.execute("SELECT * FROM club_people")), "Never seed fake memberships"
assert not list(db.execute("SELECT * FROM studio_decisions")), "Never seed approval claims"
assert not list(db.execute("SELECT * FROM club_invites")), "No invitations should be created automatically"
assert not list(db.execute("SELECT * FROM club_nominations")), "Never seed nominations"
assert not list(db.execute("SELECT * FROM club_spam_quarantine")), "Never seed quarantine items"
assert not list(db.execute("SELECT * FROM club_survey_responses")), "Never seed survey responses"
print(f"Sandy shared-club migration valid: {len(required)} required tables; empty initial records")
