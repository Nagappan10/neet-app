import { db } from './db';

/**
 * All aggregation is computed in SQL rather than in JS so a client can ask for
 * a month of heatmap data without downloading a month of rows.
 */

export interface DayBucket {
  day: string;
  steps: number;
  distance_m: number;
  calories: number;
  active_ms: number;
  goal: number;
  sessions: number;
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Per-day walking buckets, zero-filled across the whole range. */
export function walkingBuckets(userId: string, start: string, end: string): DayBucket[] {
  const daily = db
    .prepare(
      `SELECT day, steps, distance_m, calories, active_ms, goal
         FROM daily_steps
        WHERE user_id = ? AND deleted = 0 AND day BETWEEN ? AND ?`,
    )
    .all(userId, start, end) as Omit<DayBucket, 'sessions'>[];

  const sessions = db
    .prepare(
      `SELECT day,
              COUNT(*)          AS sessions,
              SUM(duration_ms)  AS session_ms,
              SUM(steps)        AS session_steps
         FROM walking_sessions
        WHERE user_id = ? AND deleted = 0 AND ended_at IS NOT NULL AND day BETWEEN ? AND ?
        GROUP BY day`,
    )
    .all(userId, start, end) as {
    day: string;
    sessions: number;
    session_ms: number;
    session_steps: number;
  }[];

  const byDay = new Map(daily.map((r) => [r.day, r]));
  const sessionsByDay = new Map(sessions.map((r) => [r.day, r]));
  const goal = currentGoal(userId);

  return dayRange(start, end).map((day) => {
    const base = byDay.get(day);
    const s = sessionsByDay.get(day);
    return {
      day,
      steps: base?.steps ?? 0,
      distance_m: base?.distance_m ?? 0,
      calories: base?.calories ?? 0,
      // Fall back to summed session time when no daily rollup exists yet.
      active_ms: base?.active_ms ?? s?.session_ms ?? 0,
      goal: base?.goal ?? goal,
      sessions: s?.sessions ?? 0,
    };
  });
}

function currentGoal(userId: string): number {
  const row = db.prepare(`SELECT daily_goal FROM users WHERE id = ?`).get(userId) as
    | { daily_goal: number }
    | undefined;
  return row?.daily_goal ?? 10000;
}

export interface WeeklyWalkingSummary {
  start: string;
  end: string;
  days: DayBucket[];
  total_steps: number;
  daily_average: number;
  best_day: { day: string; steps: number } | null;
  total_active_ms: number;
  total_distance_m: number;
  total_calories: number;
  days_goal_met: number;
  streak: number;
  delta_vs_previous_pct: number | null;
}

export function weeklyWalking(userId: string, start: string): WeeklyWalkingSummary {
  const end = addDays(start, 6);
  const days = walkingBuckets(userId, start, end);
  const total = days.reduce((a, d) => a + d.steps, 0);

  const best = days.reduce<{ day: string; steps: number } | null>(
    (acc, d) => (d.steps > 0 && (!acc || d.steps > acc.steps) ? { day: d.day, steps: d.steps } : acc),
    null,
  );

  const prev = walkingBuckets(userId, addDays(start, -7), addDays(start, -1));
  const prevTotal = prev.reduce((a, d) => a + d.steps, 0);

  // Only count days that have actually happened toward the average.
  const today = new Date().toISOString().slice(0, 10);
  const elapsed = days.filter((d) => d.day <= today).length || days.length;

  return {
    start,
    end,
    days,
    total_steps: total,
    daily_average: Math.round(total / elapsed),
    best_day: best,
    total_active_ms: days.reduce((a, d) => a + d.active_ms, 0),
    total_distance_m: days.reduce((a, d) => a + d.distance_m, 0),
    total_calories: days.reduce((a, d) => a + d.calories, 0),
    days_goal_met: days.filter((d) => d.goal > 0 && d.steps >= d.goal).length,
    streak: walkingStreak(userId),
    delta_vs_previous_pct: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
  };
}

/**
 * Consecutive days meeting goal, counted backwards from today. Today not yet
 * meeting its goal does not break the streak — the day is still in progress.
 */
export function walkingStreak(userId: string): number {
  const rows = db
    .prepare(
      `SELECT day, steps, goal FROM daily_steps
        WHERE user_id = ? AND deleted = 0
        ORDER BY day DESC LIMIT 400`,
    )
    .all(userId) as { day: string; steps: number; goal: number }[];

  const met = new Map(rows.map((r) => [r.day, r.steps >= r.goal]));
  const today = new Date().toISOString().slice(0, 10);

  let streak = 0;
  let cursor = today;
  if (met.get(today) !== true) cursor = addDays(today, -1); // grace for today
  while (met.get(cursor) === true) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function monthlyWalking(userId: string, month: string) {
  const start = `${month}-01`;
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  const end = d.toISOString().slice(0, 10);
  const days = walkingBuckets(userId, start, end);
  const total = days.reduce((a, x) => a + x.steps, 0);
  return {
    month,
    start,
    end,
    days,
    total_steps: total,
    daily_average: Math.round(total / days.length),
    best_day: days.reduce<DayBucket | null>((a, x) => (!a || x.steps > a.steps ? x : a), null),
    days_goal_met: days.filter((x) => x.goal > 0 && x.steps >= x.goal).length,
  };
}

export interface PracticeWeekly {
  activity_id: string;
  name: string;
  color: string;
  icon: string;
  target_minutes: number;
  start: string;
  end: string;
  days: { day: string; minutes: number; met: boolean }[];
  total_minutes: number;
  daily_average: number;
  days_completed: number;
  streak: number;
  longest_streak: number;
  previous_total_minutes: number;
  delta_vs_previous_pct: number | null;
}

export function practiceWeekly(userId: string, start: string): PracticeWeekly[] {
  const end = addDays(start, 6);
  const activities = db
    .prepare(
      `SELECT id, name, color, icon, target_minutes FROM practice_activities
        WHERE user_id = ? AND deleted = 0 AND archived = 0
        ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(userId) as {
    id: string;
    name: string;
    color: string;
    icon: string;
    target_minutes: number;
  }[];

  const totalsFor = (activityId: string, from: string, to: string) =>
    new Map(
      (
        db
          .prepare(
            `SELECT day, SUM(minutes) AS minutes FROM practice_sessions
              WHERE user_id = ? AND activity_id = ? AND deleted = 0 AND day BETWEEN ? AND ?
              GROUP BY day`,
          )
          .all(userId, activityId, from, to) as { day: string; minutes: number }[]
      ).map((r) => [r.day, r.minutes]),
    );

  return activities.map((a) => {
    const thisWeek = totalsFor(a.id, start, end);
    const lastWeek = totalsFor(a.id, addDays(start, -7), addDays(start, -1));

    const days = dayRange(start, end).map((day) => {
      const minutes = thisWeek.get(day) ?? 0;
      return { day, minutes, met: minutes >= a.target_minutes };
    });

    const total = days.reduce((s, d) => s + d.minutes, 0);
    const prevTotal = [...lastWeek.values()].reduce((s, m) => s + m, 0);
    const streaks = practiceStreaks(userId, a.id, a.target_minutes);

    return {
      activity_id: a.id,
      name: a.name,
      color: a.color,
      icon: a.icon,
      target_minutes: a.target_minutes,
      start,
      end,
      days,
      total_minutes: total,
      daily_average: Math.round((total / 7) * 10) / 10,
      days_completed: days.filter((d) => d.met).length,
      streak: streaks.current,
      longest_streak: streaks.longest,
      previous_total_minutes: prevTotal,
      delta_vs_previous_pct: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
    };
  });
}

/** Current and all-time-longest run of consecutive days hitting the target. */
export function practiceStreaks(userId: string, activityId: string, target: number) {
  const rows = db
    .prepare(
      `SELECT day, SUM(minutes) AS minutes FROM practice_sessions
        WHERE user_id = ? AND activity_id = ? AND deleted = 0
        GROUP BY day HAVING SUM(minutes) >= ?
        ORDER BY day ASC`,
    )
    .all(userId, activityId, target) as { day: string; minutes: number }[];

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
  const today = new Date().toISOString().slice(0, 10);
  let cursor = met.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (met.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}
