/** Domain types shared by the local database, stores and screens. */

/** `YYYY-MM-DD` in the device's local timezone. */
export type DayKey = string;

export interface WalkingSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  day: DayKey;
  steps: number;
  /** Active (unpaused) milliseconds. */
  durationMs: number;
  distanceM: number;
  calories: number;
  /** Steps per minute across the active duration. */
  avgPace: number;
  note: string | null;
  deleted: boolean;
  updatedAt: number;
}

export interface DailySteps {
  id: string;
  day: DayKey;
  steps: number;
  distanceM: number;
  calories: number;
  activeMs: number;
  goal: number;
  deleted: boolean;
  updatedAt: number;
}

export interface PracticeActivity {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetMinutes: number;
  sortOrder: number;
  archived: boolean;
  createdAt: number;
  deleted: boolean;
  updatedAt: number;
}

export interface PracticeSession {
  id: string;
  activityId: string;
  day: DayKey;
  startedAt: number;
  endedAt: number | null;
  minutes: number;
  source: 'timer' | 'manual';
  note: string | null;
  deleted: boolean;
  updatedAt: number;
}

/** One day's worth of walking, as rendered by the charts and detail sheets. */
export interface DayStats {
  day: DayKey;
  steps: number;
  distanceM: number;
  calories: number;
  activeMs: number;
  goal: number;
  sessions: number;
}

export interface WeeklyWalkingStats {
  start: DayKey;
  end: DayKey;
  days: DayStats[];
  totalSteps: number;
  dailyAverage: number;
  bestDay: DayStats | null;
  totalActiveMs: number;
  totalDistanceM: number;
  totalCalories: number;
  daysGoalMet: number;
  streak: number;
  deltaVsPreviousPct: number | null;
}

export interface PracticeDayCell {
  day: DayKey;
  minutes: number;
  /** 0..1, clamped — how much of the daily target was hit. */
  progress: number;
  met: boolean;
}

export interface PracticeWeeklyStats {
  activityId: string;
  start: DayKey;
  days: PracticeDayCell[];
  totalMinutes: number;
  dailyAverage: number;
  daysCompleted: number;
  streak: number;
  longestStreak: number;
  previousTotalMinutes: number;
  deltaVsPreviousPct: number | null;
}

/** A pending outbound change, drained by the sync engine when online. */
export interface SyncQueueItem {
  id: number;
  entity: 'walking_sessions' | 'daily_steps' | 'practice_activities' | 'practice_sessions';
  rowId: string;
  updatedAt: number;
}
