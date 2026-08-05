import type { DailySteps, DayKey, DayStats, WalkingSession, WeeklyWalkingStats } from '@/types';
import { addDays, dayRange, toDayKey, weekDays } from '@/utils/date';
import { enqueueSync, getDb, uuid } from './client';

/* ------------------------------ row mapping ------------------------------ */

interface WalkingRow {
  id: string;
  started_at: number;
  ended_at: number | null;
  day: string;
  steps: number;
  duration_ms: number;
  distance_m: number;
  calories: number;
  avg_pace: number;
  note: string | null;
  deleted: number;
  updated_at: number;
}

interface DailyRow {
  id: string;
  day: string;
  steps: number;
  distance_m: number;
  calories: number;
  active_ms: number;
  goal: number;
  deleted: number;
  updated_at: number;
}

const toSession = (r: WalkingRow): WalkingSession => ({
  id: r.id,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  day: r.day,
  steps: r.steps,
  durationMs: r.duration_ms,
  distanceM: r.distance_m,
  calories: r.calories,
  avgPace: r.avg_pace,
  note: r.note,
  deleted: r.deleted === 1,
  updatedAt: r.updated_at,
});

const toDaily = (r: DailyRow): DailySteps => ({
  id: r.id,
  day: r.day,
  steps: r.steps,
  distanceM: r.distance_m,
  calories: r.calories,
  activeMs: r.active_ms,
  goal: r.goal,
  deleted: r.deleted === 1,
  updatedAt: r.updated_at,
});

/* ----------------------------- walking sessions -------------------------- */

export async function saveSession(
  input: Omit<WalkingSession, 'id' | 'updatedAt' | 'deleted'> & Partial<Pick<WalkingSession, 'id'>>,
): Promise<WalkingSession> {
  const db = await getDb();
  const id = input.id ?? uuid();
  const updatedAt = Date.now();

  await db.runAsync(
    `INSERT INTO walking_sessions
       (id, started_at, ended_at, day, steps, duration_ms, distance_m, calories, avg_pace, note, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       started_at = excluded.started_at,
       ended_at   = excluded.ended_at,
       day        = excluded.day,
       steps      = excluded.steps,
       duration_ms= excluded.duration_ms,
       distance_m = excluded.distance_m,
       calories   = excluded.calories,
       avg_pace   = excluded.avg_pace,
       note       = excluded.note,
       updated_at = excluded.updated_at`,
    id,
    input.startedAt,
    input.endedAt,
    input.day,
    Math.round(input.steps),
    Math.round(input.durationMs),
    input.distanceM,
    input.calories,
    input.avgPace,
    input.note ?? null,
    updatedAt,
  );

  await enqueueSync('walking_sessions', id, updatedAt);
  return { ...input, id, note: input.note ?? null, deleted: false, updatedAt };
}

export async function listSessions(limit = 100): Promise<WalkingSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WalkingRow>(
    `SELECT * FROM walking_sessions
      WHERE deleted = 0 AND ended_at IS NOT NULL
      ORDER BY started_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(toSession);
}

export async function getSession(id: string): Promise<WalkingSession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<WalkingRow>(`SELECT * FROM walking_sessions WHERE id = ?`, id);
  return row ? toSession(row) : null;
}

export async function listSessionsForDay(day: DayKey): Promise<WalkingSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WalkingRow>(
    `SELECT * FROM walking_sessions
      WHERE deleted = 0 AND ended_at IS NOT NULL AND day = ?
      ORDER BY started_at DESC`,
    day,
  );
  return rows.map(toSession);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  const updatedAt = Date.now();
  await db.runAsync(
    `UPDATE walking_sessions SET deleted = 1, updated_at = ? WHERE id = ?`,
    updatedAt,
    id,
  );
  await enqueueSync('walking_sessions', id, updatedAt);
}

/* ------------------------------- daily steps ----------------------------- */

export async function upsertDaily(
  day: DayKey,
  patch: Partial<Omit<DailySteps, 'id' | 'day' | 'deleted' | 'updatedAt'>>,
): Promise<DailySteps> {
  const db = await getDb();
  const existing = await getDaily(day);
  const updatedAt = Date.now();
  const id = existing?.id ?? `day:${day}`;

  const next: DailySteps = {
    id,
    day,
    steps: patch.steps ?? existing?.steps ?? 0,
    distanceM: patch.distanceM ?? existing?.distanceM ?? 0,
    calories: patch.calories ?? existing?.calories ?? 0,
    activeMs: patch.activeMs ?? existing?.activeMs ?? 0,
    goal: patch.goal ?? existing?.goal ?? 10000,
    deleted: false,
    updatedAt,
  };

  await db.runAsync(
    `INSERT INTO daily_steps (id, day, steps, distance_m, calories, active_ms, goal, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       steps      = excluded.steps,
       distance_m = excluded.distance_m,
       calories   = excluded.calories,
       active_ms  = excluded.active_ms,
       goal       = excluded.goal,
       updated_at = excluded.updated_at`,
    next.id,
    next.day,
    Math.round(next.steps),
    next.distanceM,
    next.calories,
    Math.round(next.activeMs),
    next.goal,
    updatedAt,
  );

  await enqueueSync('daily_steps', next.id, updatedAt);
  return next;
}

export async function getDaily(day: DayKey): Promise<DailySteps | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DailyRow>(
    `SELECT * FROM daily_steps WHERE day = ? AND deleted = 0`,
    day,
  );
  return row ? toDaily(row) : null;
}

/** Applies a new goal to every day from today forward (past days keep theirs). */
export async function applyGoalToToday(goal: number): Promise<void> {
  await upsertDaily(toDayKey(), { goal });
}

/* -------------------------------- aggregates ----------------------------- */

/**
 * Day-by-day stats across a range, zero-filled. Computed locally so the whole
 * stats screen works with no network; the server exposes the same shape for
 * cross-device reads.
 */
export async function statsForRange(
  from: DayKey,
  to: DayKey,
  fallbackGoal: number,
): Promise<DayStats[]> {
  const db = await getDb();

  const daily = await db.getAllAsync<DailyRow>(
    `SELECT * FROM daily_steps WHERE deleted = 0 AND day BETWEEN ? AND ?`,
    from,
    to,
  );
  const sessions = await db.getAllAsync<{ day: string; count: number; ms: number }>(
    `SELECT day, COUNT(*) AS count, COALESCE(SUM(duration_ms), 0) AS ms
       FROM walking_sessions
      WHERE deleted = 0 AND ended_at IS NOT NULL AND day BETWEEN ? AND ?
      GROUP BY day`,
    from,
    to,
  );

  const byDay = new Map(daily.map((r) => [r.day, r]));
  const sessionsByDay = new Map(sessions.map((r) => [r.day, r]));

  return dayRange(from, to).map((day) => {
    const d = byDay.get(day);
    const s = sessionsByDay.get(day);
    return {
      day,
      steps: d?.steps ?? 0,
      distanceM: d?.distance_m ?? 0,
      calories: d?.calories ?? 0,
      activeMs: d?.active_ms ?? s?.ms ?? 0,
      goal: d?.goal ?? fallbackGoal,
      sessions: s?.count ?? 0,
    };
  });
}

export async function weeklyStats(start: DayKey, fallbackGoal: number): Promise<WeeklyWalkingStats> {
  const days = weekDays(start);
  const end = days[days.length - 1]!;
  const current = await statsForRange(start, end, fallbackGoal);
  const previous = await statsForRange(addDays(start, -7), addDays(start, -1), fallbackGoal);

  const totalSteps = sum(current, (d) => d.steps);
  const prevSteps = sum(previous, (d) => d.steps);
  const today = toDayKey();
  const elapsed = current.filter((d) => d.day <= today).length || 7;

  const bestDay = current.reduce<DayStats | null>(
    (best, d) => (d.steps > 0 && (!best || d.steps > best.steps) ? d : best),
    null,
  );

  return {
    start,
    end,
    days: current,
    totalSteps,
    dailyAverage: Math.round(totalSteps / elapsed),
    bestDay,
    totalActiveMs: sum(current, (d) => d.activeMs),
    totalDistanceM: sum(current, (d) => d.distanceM),
    totalCalories: sum(current, (d) => d.calories),
    daysGoalMet: current.filter((d) => d.goal > 0 && d.steps >= d.goal).length,
    streak: await currentStreak(),
    deltaVsPreviousPct: prevSteps > 0 ? ((totalSteps - prevSteps) / prevSteps) * 100 : null,
  };
}

/**
 * Consecutive goal-met days counted back from today. Today is exempt while
 * still in progress, so an unfinished day never appears to break a streak.
 */
export async function currentStreak(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyRow>(
    `SELECT * FROM daily_steps WHERE deleted = 0 ORDER BY day DESC LIMIT 400`,
  );
  const met = new Map(rows.map((r) => [r.day, r.steps >= r.goal]));

  const today = toDayKey();
  let cursor = met.get(today) === true ? today : addDays(today, -1);
  let streak = 0;
  while (met.get(cursor) === true) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

const sum = <T>(items: T[], pick: (item: T) => number): number =>
  items.reduce((acc, item) => acc + pick(item), 0);
