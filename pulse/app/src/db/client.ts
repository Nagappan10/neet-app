import * as SQLite from 'expo-sqlite';
import { DB_NAME, SCHEMA_SQL } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Single shared connection, opened lazily. Every caller awaits the same
 * promise so the schema is only ever applied once.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA_SQL);
      return db;
    })();
  }
  return dbPromise;
}

/** Marks a row as needing to be pushed on the next sync. */
export async function enqueueSync(
  entity: 'walking_sessions' | 'daily_steps' | 'practice_activities' | 'practice_sessions',
  rowId: string,
  updatedAt: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (entity, row_id, updated_at) VALUES (?, ?, ?)`,
    entity,
    rowId,
    updatedAt,
  );
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = ?`,
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

/** Drops every table's contents. Used by the "reset local data" action. */
export async function wipeLocalData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM walking_sessions;
    DELETE FROM daily_steps;
    DELETE FROM practice_activities;
    DELETE FROM practice_sessions;
    DELETE FROM sync_queue;
    DELETE FROM meta;
  `);
}

/**
 * `crypto.randomUUID` is not guaranteed to exist in the RN runtime, so fall
 * back to an RFC-4122 v4 shape built from Math.random. Ids only need to be
 * collision-free across this device's rows, not cryptographically strong.
 */
export function uuid(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof globalCrypto?.randomUUID === 'function') return globalCrypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8; // variant bits for the `y` nibble
    return v.toString(16);
  });
}
