import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.PULSE_DB_PATH
  ? path.resolve(process.env.PULSE_DB_PATH)
  : path.resolve(process.cwd(), 'data', 'pulse.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = fs.existsSync(path.join(__dirname, 'schema.sql'))
  ? path.join(__dirname, 'schema.sql')
  : path.join(process.cwd(), 'src', 'schema.sql');

db.exec(fs.readFileSync(schemaPath, 'utf8'));

/** Ensures a user row exists so foreign keys resolve for a fresh device. */
export function ensureUser(userId: string): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, created_at, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  ).run(userId, now, now);
}

export { DB_PATH };
