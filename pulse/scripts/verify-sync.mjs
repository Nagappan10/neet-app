// Validates the app's local schema + sync SQL against a real SQLite engine,
// using the exact SCHEMA_SQL and COLUMNS the app ships.
// Uses the server's better-sqlite3 install; run `npm install` in ../server first.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../server/package.json'));
const Database = require('better-sqlite3');
import fs from 'node:fs';

const schemaTs = fs.readFileSync(path.join(here, '../app/src/db/schema.ts'), 'utf8');
const SCHEMA_SQL = schemaTs.split('export const SCHEMA_SQL = `')[1].split('`;')[0];

const syncTs = fs.readFileSync(path.join(here, '../app/src/services/sync.ts'), 'utf8');
// pull COLUMNS out of the source so this test can never drift from the app
const colsBlock = syncTs.split('const COLUMNS: Record<Entity, string[]> = {')[1].split('\n};')[0];
const COLUMNS = {};
for (const m of colsBlock.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
  COLUMNS[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}
const CONFLICT_TARGET = {
  walking_sessions: 'id',
  daily_steps: 'day',
  practice_activities: 'id',
  practice_sessions: 'id',
};

const db = new Database(':memory:');
db.exec(SCHEMA_SQL);

// 1. Every column the sync engine references must exist in the local schema.
for (const [table, cols] of Object.entries(COLUMNS)) {
  const actual = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name));
  const missing = cols.filter((c) => !actual.has(c));
  if (missing.length) throw new Error(`${table}: local schema missing ${missing.join(', ')}`);
  console.log(`✓ ${table}: all ${cols.length} sync columns exist locally`);
}

// 2. applyRemoteRow's generated SQL must actually execute, and must honour LWW.
function applyRemoteRow(entity, row) {
  const cols = COLUMNS[entity];
  const target = CONFLICT_TARGET[entity];
  const assignments = cols.filter((c) => c !== target).map((c) => `${c} = excluded.${c}`).join(', ');
  const stmt = db.prepare(
    `INSERT INTO ${entity} (${cols.join(', ')})
     VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(${target}) DO UPDATE SET ${assignments}
     WHERE excluded.updated_at > ${entity}.updated_at`,
  );
  return stmt.run(...cols.map((c) => (row[c] === undefined ? null : row[c]))).changes;
}

applyRemoteRow('walking_sessions', {
  id: 'w1', started_at: 1, ended_at: 2, day: '2026-08-01', steps: 500,
  duration_ms: 1000, distance_m: 380, calories: 20, avg_pace: 90, note: null,
  deleted: 0, updated_at: 2000,
});
applyRemoteRow('walking_sessions', { id: 'w1', started_at: 1, ended_at: 2, day: '2026-08-01', steps: 1, duration_ms: 1, distance_m: 1, calories: 1, avg_pace: 1, note: null, deleted: 0, updated_at: 1000 });
let ws = db.prepare('SELECT steps FROM walking_sessions WHERE id = ?').get('w1');
if (ws.steps !== 500) throw new Error(`stale write clobbered local row: ${ws.steps}`);
console.log('✓ walking_sessions: stale remote row rejected');

applyRemoteRow('walking_sessions', { id: 'w1', started_at: 1, ended_at: 2, day: '2026-08-01', steps: 999, duration_ms: 1, distance_m: 1, calories: 1, avg_pace: 1, note: null, deleted: 0, updated_at: 3000 });
ws = db.prepare('SELECT steps FROM walking_sessions WHERE id = ?').get('w1');
if (ws.steps !== 999) throw new Error(`newer write not applied: ${ws.steps}`);
console.log('✓ walking_sessions: newer remote row applied');

// 3. The daily_steps case that motivated the day-keyed conflict target:
//    a locally created row, then a server row for the same day with a DIFFERENT id.
db.prepare(
  `INSERT INTO daily_steps (id, day, steps, distance_m, calories, active_ms, goal, deleted, updated_at)
   VALUES ('day:2026-08-01','2026-08-01',100,76,5,0,10000,0,1000)`,
).run();

const changed = applyRemoteRow('daily_steps', {
  id: 'u1:2026-08-01', day: '2026-08-01', steps: 8000, distance_m: 6096,
  calories: 300, active_ms: 3600000, goal: 10000, deleted: 0, updated_at: 5000,
});
const rows = db.prepare('SELECT * FROM daily_steps').all();
if (rows.length !== 1) throw new Error(`expected 1 daily row, got ${rows.length}`);
if (rows[0].steps !== 8000) throw new Error(`day-keyed upsert did not apply: ${rows[0].steps}`);
if (rows[0].id !== 'u1:2026-08-01') throw new Error(`id did not converge: ${rows[0].id}`);
console.log(`✓ daily_steps: cross-id same-day upsert merged (changes=${changed}), id converged`);

// 4. Practice tables round-trip.
applyRemoteRow('practice_activities', {
  id: 'a1', name: 'Guitar', icon: 'musical-notes', color: '#A855F7',
  target_minutes: 20, sort_order: 0, archived: 0, created_at: 1, deleted: 0, updated_at: 10,
});
applyRemoteRow('practice_sessions', {
  id: 's1', activity_id: 'a1', day: '2026-08-01', started_at: 1, ended_at: 2,
  minutes: 25, source: 'timer', note: null, deleted: 0, updated_at: 10,
});
const streak = db.prepare(
  `SELECT day FROM practice_sessions WHERE deleted = 0 AND activity_id = ?
   GROUP BY day HAVING SUM(minutes) >= ? ORDER BY day ASC`,
).all('a1', 20);
if (streak.length !== 1) throw new Error('practice streak query failed');
console.log('✓ practice_activities / practice_sessions round-trip + streak query');

console.log('\nAll sync SQL checks passed.');
