/**
 * Local schema. Deliberately mirrors the server schema column-for-column so
 * sync payloads are a straight field mapping rather than a translation layer.
 *
 * `sync_queue` records rows that changed locally and have not yet been pushed.
 * `meta` holds the sync watermark and device identity.
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS walking_sessions (
  id            TEXT PRIMARY KEY NOT NULL,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  day           TEXT NOT NULL,
  steps         INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  distance_m    REAL NOT NULL DEFAULT 0,
  calories      REAL NOT NULL DEFAULT 0,
  avg_pace      REAL NOT NULL DEFAULT 0,
  note          TEXT,
  deleted       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ws_day ON walking_sessions(day);
CREATE INDEX IF NOT EXISTS idx_ws_started ON walking_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS daily_steps (
  id            TEXT PRIMARY KEY NOT NULL,
  day           TEXT NOT NULL UNIQUE,
  steps         INTEGER NOT NULL DEFAULT 0,
  distance_m    REAL NOT NULL DEFAULT 0,
  calories      REAL NOT NULL DEFAULT 0,
  active_ms     INTEGER NOT NULL DEFAULT 0,
  goal          INTEGER NOT NULL DEFAULT 10000,
  deleted       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_activities (
  id             TEXT PRIMARY KEY NOT NULL,
  name           TEXT NOT NULL,
  icon           TEXT NOT NULL DEFAULT 'sparkles',
  color          TEXT NOT NULL DEFAULT '#8B5CF6',
  target_minutes INTEGER NOT NULL DEFAULT 20,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  archived       INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  deleted        INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id           TEXT PRIMARY KEY NOT NULL,
  activity_id  TEXT NOT NULL,
  day          TEXT NOT NULL,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  minutes      REAL NOT NULL DEFAULT 0,
  source       TEXT NOT NULL DEFAULT 'timer',
  note         TEXT,
  deleted      INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ps_activity_day ON practice_sessions(activity_id, day);
CREATE INDEX IF NOT EXISTS idx_ps_started ON practice_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS sync_queue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT NOT NULL,
  row_id     TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (entity, row_id) ON CONFLICT REPLACE
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export const DB_NAME = 'pulse.db';
