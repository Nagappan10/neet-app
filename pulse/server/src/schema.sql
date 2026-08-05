-- Pulse server schema.
--
-- Sync model: every syncable row carries a client-generated id, an owning
-- user_id, an `updated_at` epoch-ms stamp and a `deleted` tombstone flag.
-- Conflict resolution is last-write-wins on `updated_at`, which lets the
-- device stay the source of truth while still allowing multi-device merges.
--
-- Primary keys are (user_id, id), NOT id alone. Client ids are only unique
-- within a device's own database — `daily_steps` in particular uses the
-- deterministic id `day:YYYY-MM-DD` — so a bare `id` primary key would make
-- two users collide on the same key, and the second writer's upsert would
-- silently no-op against the first writer's row.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  display_name  TEXT    NOT NULL DEFAULT 'Athlete',
  daily_goal    INTEGER NOT NULL DEFAULT 10000,
  stride_length REAL    NOT NULL DEFAULT 0.762, -- metres
  weight_kg     REAL    NOT NULL DEFAULT 70,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS walking_sessions (
  id            TEXT    NOT NULL,
  user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    INTEGER NOT NULL,          -- epoch ms
  ended_at      INTEGER,                   -- epoch ms, null while in flight
  day           TEXT    NOT NULL,          -- YYYY-MM-DD in device-local time
  steps         INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER NOT NULL DEFAULT 0, -- active (unpaused) duration
  distance_m    REAL    NOT NULL DEFAULT 0,
  calories      REAL    NOT NULL DEFAULT 0,
  avg_pace      REAL    NOT NULL DEFAULT 0, -- steps per minute
  note          TEXT,
  deleted       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_walking_user_day  ON walking_sessions(user_id, day);
CREATE INDEX IF NOT EXISTS idx_walking_user_upd  ON walking_sessions(user_id, updated_at);

CREATE TABLE IF NOT EXISTS daily_steps (
  id            TEXT    NOT NULL,          -- `day:YYYY-MM-DD`, unique per user only
  user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           TEXT    NOT NULL,
  steps         INTEGER NOT NULL DEFAULT 0,
  distance_m    REAL    NOT NULL DEFAULT 0,
  calories      REAL    NOT NULL DEFAULT 0,
  active_ms     INTEGER NOT NULL DEFAULT 0,
  goal          INTEGER NOT NULL DEFAULT 10000,
  deleted       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_daily_user_upd ON daily_steps(user_id, updated_at);

CREATE TABLE IF NOT EXISTS practice_activities (
  id             TEXT    NOT NULL,
  user_id        TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT    NOT NULL,
  icon           TEXT    NOT NULL DEFAULT 'sparkles',
  color          TEXT    NOT NULL DEFAULT '#8B5CF6',
  target_minutes INTEGER NOT NULL DEFAULT 20,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  archived       INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  deleted        INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_activity_user_upd ON practice_activities(user_id, updated_at);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id           TEXT    NOT NULL,
  user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id  TEXT    NOT NULL,
  day          TEXT    NOT NULL,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  minutes      REAL    NOT NULL DEFAULT 0,
  source       TEXT    NOT NULL DEFAULT 'timer', -- 'timer' | 'manual'
  note         TEXT,
  deleted      INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_practice_user_day ON practice_sessions(user_id, day);
CREATE INDEX IF NOT EXISTS idx_practice_activity ON practice_sessions(activity_id, day);
CREATE INDEX IF NOT EXISTS idx_practice_user_upd ON practice_sessions(user_id, updated_at);
