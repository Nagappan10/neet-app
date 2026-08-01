import { db } from './db';
import {
  bit,
  type DailySteps,
  type PracticeActivity,
  type PracticeSession,
  type WalkingSession,
} from './types';

/**
 * Every upsert below is guarded by `WHERE excluded.updated_at > table.updated_at`,
 * which is the whole of our conflict resolution: last write wins, and a stale
 * replay of an old record can never clobber newer state.
 *
 * The conflict target is `(user_id, id)`, matching the composite primary key.
 * Targeting `id` alone would let one user's row block another's, because
 * client-generated ids are only unique per device — `daily_steps` uses the
 * deterministic `day:YYYY-MM-DD`, which every user generates identically.
 */

const upsertWalking = db.prepare(`
  INSERT INTO walking_sessions
    (id, user_id, started_at, ended_at, day, steps, duration_ms, distance_m,
     calories, avg_pace, note, deleted, updated_at)
  VALUES
    (@id, @user_id, @started_at, @ended_at, @day, @steps, @duration_ms, @distance_m,
     @calories, @avg_pace, @note, @deleted, @updated_at)
  ON CONFLICT(user_id, id) DO UPDATE SET
    started_at  = excluded.started_at,
    ended_at    = excluded.ended_at,
    day         = excluded.day,
    steps       = excluded.steps,
    duration_ms = excluded.duration_ms,
    distance_m  = excluded.distance_m,
    calories    = excluded.calories,
    avg_pace    = excluded.avg_pace,
    note        = excluded.note,
    deleted     = excluded.deleted,
    updated_at  = excluded.updated_at
  WHERE excluded.updated_at > walking_sessions.updated_at
`);

const upsertDaily = db.prepare(`
  INSERT INTO daily_steps
    (id, user_id, day, steps, distance_m, calories, active_ms, goal, deleted, updated_at)
  VALUES
    (@id, @user_id, @day, @steps, @distance_m, @calories, @active_ms, @goal, @deleted, @updated_at)
  ON CONFLICT(user_id, id) DO UPDATE SET
    day        = excluded.day,
    steps      = excluded.steps,
    distance_m = excluded.distance_m,
    calories   = excluded.calories,
    active_ms  = excluded.active_ms,
    goal       = excluded.goal,
    deleted    = excluded.deleted,
    updated_at = excluded.updated_at
  WHERE excluded.updated_at > daily_steps.updated_at
`);

const upsertActivity = db.prepare(`
  INSERT INTO practice_activities
    (id, user_id, name, icon, color, target_minutes, sort_order, archived,
     created_at, deleted, updated_at)
  VALUES
    (@id, @user_id, @name, @icon, @color, @target_minutes, @sort_order, @archived,
     @created_at, @deleted, @updated_at)
  ON CONFLICT(user_id, id) DO UPDATE SET
    name           = excluded.name,
    icon           = excluded.icon,
    color          = excluded.color,
    target_minutes = excluded.target_minutes,
    sort_order     = excluded.sort_order,
    archived       = excluded.archived,
    deleted        = excluded.deleted,
    updated_at     = excluded.updated_at
  WHERE excluded.updated_at > practice_activities.updated_at
`);

const upsertPractice = db.prepare(`
  INSERT INTO practice_sessions
    (id, user_id, activity_id, day, started_at, ended_at, minutes, source, note,
     deleted, updated_at)
  VALUES
    (@id, @user_id, @activity_id, @day, @started_at, @ended_at, @minutes, @source, @note,
     @deleted, @updated_at)
  ON CONFLICT(user_id, id) DO UPDATE SET
    activity_id = excluded.activity_id,
    day         = excluded.day,
    started_at  = excluded.started_at,
    ended_at    = excluded.ended_at,
    minutes     = excluded.minutes,
    source      = excluded.source,
    note        = excluded.note,
    deleted     = excluded.deleted,
    updated_at  = excluded.updated_at
  WHERE excluded.updated_at > practice_sessions.updated_at
`);

export function saveWalkingSession(userId: string, row: WalkingSession) {
  upsertWalking.run({
    ...row,
    user_id: userId,
    ended_at: row.ended_at ?? null,
    note: row.note ?? null,
    deleted: bit(row.deleted),
  });
}

export function saveDailySteps(userId: string, row: DailySteps) {
  upsertDaily.run({ ...row, user_id: userId, deleted: bit(row.deleted) });
}

export function saveActivity(userId: string, row: PracticeActivity) {
  upsertActivity.run({
    ...row,
    user_id: userId,
    archived: bit(row.archived),
    deleted: bit(row.deleted),
  });
}

export function savePracticeSession(userId: string, row: PracticeSession) {
  upsertPractice.run({
    ...row,
    user_id: userId,
    ended_at: row.ended_at ?? null,
    note: row.note ?? null,
    deleted: bit(row.deleted),
  });
}

const TABLES = [
  'walking_sessions',
  'daily_steps',
  'practice_activities',
  'practice_sessions',
] as const;

export type SyncTable = (typeof TABLES)[number];

/** Rows changed strictly after `since`, for the pull half of a sync. */
export function changedSince(userId: string, since: number) {
  const out = {} as Record<SyncTable, unknown[]>;
  for (const table of TABLES) {
    out[table] = db
      .prepare(
        `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 5000`,
      )
      .all(userId, since);
  }
  return out;
}

export const listAll = (table: SyncTable, userId: string) =>
  db
    .prepare(`SELECT * FROM ${table} WHERE user_id = ? AND deleted = 0 ORDER BY updated_at DESC`)
    .all(userId);

export const getById = (table: SyncTable, userId: string, id: string) =>
  db.prepare(`SELECT * FROM ${table} WHERE user_id = ? AND id = ?`).get(userId, id);

/** Soft delete keeps the tombstone so other devices learn about the removal. */
export function softDelete(table: SyncTable, userId: string, id: string): boolean {
  const res = db
    .prepare(`UPDATE ${table} SET deleted = 1, updated_at = ? WHERE user_id = ? AND id = ?`)
    .run(Date.now(), userId, id);
  return res.changes > 0;
}
