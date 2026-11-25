"""Generate ordered, verified SQL batches for the empty Sandy showcase only."""
import pathlib, sqlite3, sys
root = pathlib.Path(sys.argv[1])
source = (root / 'showcase-full.sql').read_text()
statements = []
pending = ''
for line in source.splitlines(keepends=True):
    if not pending.strip() and (not line.strip() or line.lstrip().startswith('--')):
        continue
    pending += line
    if sqlite3.complete_statement(pending):
        statements.append(pending.strip())
        pending = ''
assert not pending.strip(), 'Incomplete SQL statement'
assert not any(s.lstrip().upper().startswith(('DROP ', 'DELETE ', 'UPDATE ', 'ALTER ')) for s in statements)
assert not any('INSERT INTO club_sessions' in s or 'INSERT INTO club_invites' in s for s in statements)
batches = []
batch = []
size = 0
for stmt in statements:
    length = len(stmt.encode('utf-8'))
    if batch and (size + length > 60000 or len(batch) >= 40):
        batches.append(batch)
        batch, size = [], 0
    batch.append(stmt)
    size += length + 1
if batch:
    batches.append(batch)
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
for i, batch in enumerate(batches, 1):
    data = '\n'.join(batch) + '\n'
    db.executescript(data)
    (root / f'{i:02d}-paste-in-console.sql').write_text(data)
assert db.execute("SELECT classification FROM sandy_showcase_marker").fetchone() == ('SANDY_SYNTHETIC_ONLY',)
assert db.execute("SELECT COUNT(*) FROM club_accounts WHERE state='reserved' AND password_salt IS NULL AND password_verifier IS NULL").fetchone()[0] == 7
assert db.execute("SELECT COUNT(*) FROM club_people").fetchone()[0] == 1
assert db.execute("SELECT COUNT(*) FROM club_sessions").fetchone()[0] == 0
assert db.execute("SELECT COUNT(*) FROM club_invites").fetchone()[0] == 0
assert not db.execute("PRAGMA foreign_key_check").fetchall()
(root / 'READ-ME-FIRST.txt').write_text(
    'SANDY SHOWCASE ONLY. Database: sandy-sports-clubhouse-showcase\n'
    'ID: fbc64621-a57a-43e7-8138-717576d167c2\n'
    'Never run this in sandy-sports-clubhouse or any PLFC database.\n'
    'Use either the full file once OR the numbered console files in order, not both.\n'
    'If a console batch fails, STOP and check table/row state. Do not retry blindly.\n'
    'No accounts with login credentials, real memberships, or invitations are created.\n'
    f'Validated {len(statements)} statements in {len(batches)} numbered batches.\n'
    'After all batches, verify: SELECT classification FROM sandy_showcase_marker;\n'
)
print(f'Validated fixture: {len(statements)} statements, {len(batches)} batches, {len(source.encode())} bytes')
