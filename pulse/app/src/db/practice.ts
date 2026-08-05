import type {
  DayKey,
  PracticeActivity,
  PracticeSession,
  PracticeWeeklyStats,
} from '@/types';
import { addDays, toDayKey, weekDays } from '@/utils/date';
import { enqueueSync, getDb, uuid } from './client';

interface ActivityRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_minutes: number;
  sort_order: number;
  archived: number;
  created_at: number;
  deleted: number;
  updated_at: number;
}

interface SessionRow {
  id: string;
  activity_id: string;
  day: string;
  started_at: number;
  ended_at: number | null;
  minutes: number;
  source: string;
  note: string | null;
  deleted: number;
  updated_at: number;
}

const toActivity = (r: ActivityRow): PracticeActivity => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  targetMinutes: r.target_minutes,
  sortOrder: r.sort_order,
  archived: r.archived === 1,
  createdAt: r.created_at,
  deleted: r.deleted === 1,
  updatedAt: r.updated_at,
});

const toSession = (r: SessionRow): PracticeSession => ({
  id: r.id,
  activityId: r.activity_id,
  day: r.day,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  minutes: r.minutes,
  source: r.source === 'manual' ? 'manual' : 'timer',
  note: r.note,
  deleted: r.deleted === 1,
  updatedAt: r.updated_at,
});

/* -------------------------------- activities ----------------------------- */

export async function listActivities(includeArchived = false): Promise<PracticeActivity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT * FROM practice_activities
      WHERE deleted = 0 ${includeArchived ? '' : 'AND archived = 0'}
      ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows.map(toActivity);
}

export async function getActivity(id: string): Promise<PracticeActivity | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ActivityRow>(
    `SELECT * FROM practice_activities WHERE id = ?`,
    id,
  );
  return row ? toActivity(row) : null;
}

export async function saveActivity(
  input: Partial<PracticeActivity> & Pick<PracticeActivity, 'name' | 'icon' | 'color' | 'targetMinutes'>,
): Promise<PracticeActivity> {
  const db = await getDb();
  const id = input.id ?? uuid();
  const updatedAt = Date.now();
  const createdAt = input.createdAt ?? updatedAt;

  await db.runAsync(
    `INSERT INTO practice_activities
       (id, name, icon, color, target_minutes, sort_order, archived, created_at, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       name           = excluded.name,
       icon           = excluded.icon,
       color          = excluded.color,
       target_minutes = excluded.target_minutes,
       sort_order     = excluded.sort_order,
       archived       = excluded.archived,
       updated_at     = excluded.updated_at`,
    id,
    input.name,
    input.icon,
    input.color,
    input.targetMinutes,
    input.sortOrder ?? 0,
    input.archived ? 1 : 0,
    createdAt,
    updatedAt,
  );

  await enqueueSync('practice_activities', id, updatedAt);
  return {
    id,
    name: input.name,
    icon: input.icon,
    color: input.color,
    targetMinutes: input.targetMinutes,
    sortOrder: input.sortOrder ?? 0,
    archived: input.archived ?? false,
    createdAt,
    deleted: false,
    updatedAt,
  };
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await getDb();
  const updatedAt = Date.now();
  await db.runAsync(
    `UPDATE practice_activities SET deleted = 1, updated_at = ? WHERE id = ?`,
    updatedAt,
    id,
  );
  await enqueueSync('practice_activities', id, updatedAt);
}

/* --------------------------------- sessions ------------------------------ */

export async function logPractice(input: {
  id?: string;
  activityId: string;
  minutes: number;
  startedAt?: number;
  endedAt?: number | null;
  day?: DayKey;
  source?: 'timer' | 'manual';
  note?: string | null;
}): Promise<PracticeSession> {
  const db = await getDb();
  const id = input.id ?? uuid();
  const updatedAt = Date.now();
  const startedAt = input.startedAt ?? updatedAt;
  const session: PracticeSession = {
    id,
    activityId: input.activityId,
    day: input.day ?? toDayKey(startedAt),
    startedAt,
    endedAt: input.endedAt ?? updatedAt,
    minutes: Math.round(input.minutes * 100) / 100,
    source: input.source ?? 'timer',
    note: input.note ?? null,
    deleted: false,
    updatedAt,
  };

  await db.runAsync(
    `INSERT INTO practice_sessions
       (id, activity_id, day, started_at, ended_at, minutes, source, note, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       activity_id = excluded.activity_id,
       day         = excluded.day,
       started_at  = excluded.started_at,
       ended_at    = excluded.ended_at,
       minutes     = excluded.minutes,
       source      = excluded.source,
       note        = excluded.note,
       updated_at  = excluded.updated_at`,
    session.id,
    session.activityId,
    session.day,
    session.startedAt,
    session.endedAt,
    session.minutes,
    session.source,
    session.note,
    updatedAt,
  );

  await enqueueSync('practice_sessions', id, updatedAt);
  return session;
}

export async function listPracticeSessions(
  activityId?: string,
  limit = 200,
): Promise<PracticeSession[]> {
  const db = await getDb();
  const rows = activityId
    ? await db.getAllAsync<SessionRow>(
        `SELECT * FROM practice_sessions
          WHERE deleted = 0 AND activity_id = ?
          ORDER BY started_at DESC LIMIT ?`,
        activityId,
        limit,
      )
    : await db.getAllAsync<SessionRow>(
        `SELECT * FROM practice_sessions
          WHERE deleted = 0
          ORDER BY started_at DESC LIMIT ?`,
        limit,
      );
  return rows.map(toSession);
}

export async function deletePracticeSession(id: string): Promise<void> {
  const db = await getDb();
  const updatedAt = Date.now();
  await db.runAsync(
    `UPDATE practice_sessions SET deleted = 1, updated_at = ? WHERE id = ?`,
    updatedAt,
    id,
  );
  await enqueueSync('practice_sessions', id, updatedAt);
}

/* -------------------------------- aggregates ----------------------------- */

async function minutesByDay(
  activityId: string,
  from: DayKey,
  to: DayKey,
): Promise<Map<DayKey, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string; minutes: number }>(
    `SELECT day, SUM(minutes) AS minutes FROM practice_sessions
      WHERE deleted = 0 AND activity_id = ? AND day BETWEEN ? AND ?
      GROUP BY day`,
    activityId,
    from,
    to,
  );
  return new Map(rows.map((r) => [r.day, r.minutes]));
}

export async function weeklyPracticeStats(
  activity: PracticeActivity,
  start: DayKey,
): Promise<PracticeWeeklyStats> {
  const days = weekDays(start);
  const end = days[days.length - 1]!;
  const thisWeek = await minutesByDay(activity.id, start, end);
  const lastWeek = await minutesByDay(activity.id, addDays(start, -7), addDays(start, -1));

  const cells = days.map((day) => {
    const minutes = thisWeek.get(day) ?? 0;
    return {
      day,
      minutes,
      progress: activity.targetMinutes > 0 ? Math.min(1, minutes / activity.targetMinutes) : 0,
      met: minutes >= activity.targetMinutes && minutes > 0,
    };
  });

  const totalMinutes = cells.reduce((a, c) => a + c.minutes, 0);
  const previousTotalMinutes = [...lastWeek.values()].reduce((a, m) => a + m, 0);
  const streaks = await practiceStreaks(activity.id, activity.targetMinutes);

  return {
    activityId: activity.id,
    start,
    days: cells,
    totalMinutes,
    dailyAverage: Math.round((totalMinutes / 7) * 10) / 10,
    daysCompleted: cells.filter((c) => c.met).length,
    streak: streaks.current,
    longestStreak: streaks.longest,
    previousTotalMinutes,
    deltaVsPreviousPct:
      previousTotalMinutes > 0
        ? ((totalMinutes - previousTotalMinutes) / previousTotalMinutes) * 100
        : null,
  };
}

/** Current and longest run of consecutive days where the target was met. */
export async function practiceStreaks(
  activityId: string,
  targetMinutes: number,
): Promise<{ current: number; longest: number }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT day FROM practice_sessions
      WHERE deleted = 0 AND activity_id = ?
      GROUP BY day HAVING SUM(minutes) >= ?
      ORDER BY day ASC`,
    activityId,
    targetMinutes,
  );

  if (rows.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < rows.length; i += 1) {
    if (addDays(rows[i - 1]!.day, 1) === rows[i]!.day) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const met = new Set(rows.map((r) => r.day));
  const today = toDayKey();
  let cursor = met.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (met.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

export async function minutesToday(activityId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ minutes: number | null }>(
    `SELECT SUM(minutes) AS minutes FROM practice_sessions
      WHERE deleted = 0 AND activity_id = ? AND day = ?`,
    activityId,
    toDayKey(),
  );
  return row?.minutes ?? 0;
}
