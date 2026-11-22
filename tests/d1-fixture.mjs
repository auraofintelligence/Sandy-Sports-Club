import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Execute the real migration and production SQL against SQLite. This keeps the
// test independent of SQL mocks and also exercises atomic D1-style batches.
const sqliteScript = String.raw`
import json, sqlite3, sys, time
p=json.load(sys.stdin)
c=sqlite3.connect(p['path'])
c.row_factory=sqlite3.Row
try: c.execute('SELECT unixepoch()')
except sqlite3.OperationalError: c.create_function('unixepoch',-1,lambda *args:int(time.time()))
try:
  if 'migration' in p:
    c.executescript(p['migration'])
    out=[]
  else:
    out=[]
    with c:
      for s in p['statements']:
        before=c.total_changes
        cursor=c.execute(s['sql'],s.get('args',[]))
        rows=[dict(row) for row in cursor.fetchall()] if cursor.description else []
        out.append({'results':rows,'meta':{'changes':c.total_changes-before}})
  print(json.dumps(out))
finally:
  c.close()
`;

export function database(t, migrationFiles = ['0000_clubhouse.sql', '0001_access_and_meetings.sql','0005_meeting_register.sql','0007_members_and_conversation.sql','0011_meeting_reminders.sql','0013_reminder_snapshots.sql','0018_formal_meeting_agendas.sql']) {
  const directory = mkdtempSync(join(tmpdir(), 'plfc-db-test-'));
  const path = join(directory, 'club.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const execute = payload => {
    const child = spawnSync('python', ['-c', sqliteScript], { input: JSON.stringify({ path, ...payload }), encoding: 'utf8', env:{...process.env,PYTHONIOENCODING:'utf-8'}, windowsHide: true });
    if (child.status !== 0) throw new Error(child.stderr || 'SQLite test adapter failed');
    return JSON.parse(child.stdout);
  };
  const migrate=file=>execute({migration:readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8')});
  migrationFiles.forEach(migrate);
  return {
    migrate,
    prepare(sql) {
      return {
        sql, args: [],
        bind(...args) { this.args = args; return this; },
        async all() { return execute({ statements: [this] })[0]; },
        async first() { return (await this.all()).results[0] || null; },
        async run() { return execute({ statements: [this] })[0]; },
      };
    },
    async batch(statements) { return execute({ statements }); },
  };
}
