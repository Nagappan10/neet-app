import { create } from 'zustand';
import {
  deleteActivity,
  listActivities,
  listPracticeSessions,
  logPractice,
  saveActivity,
  weeklyPracticeStats,
} from '@/db/practice';
import { haptics } from '@/services/haptics';
import type { PracticeActivity, PracticeSession, PracticeWeeklyStats } from '@/types';
import { startOfWeek } from '@/utils/date';

/** A running practice timer. Only one activity can be timed at a time. */
export interface ActiveTimer {
  activityId: string;
  startedAt: number;
  /** Milliseconds banked from stretches before the current one. */
  bankedMs: number;
  running: boolean;
}

interface PracticeState {
  activities: PracticeActivity[];
  stats: Record<string, PracticeWeeklyStats>;
  sessions: PracticeSession[];
  weekStart: string;
  loading: boolean;

  timer: ActiveTimer | null;
  /** Republished on a tick so the timer display updates without re-render churn. */
  timerElapsedMs: number;

  load: () => Promise<void>;
  setWeekStart: (start: string) => Promise<void>;

  createActivity: (input: {
    name: string;
    icon: string;
    color: string;
    targetMinutes: number;
  }) => Promise<PracticeActivity>;
  updateActivity: (activity: PracticeActivity) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;

  startTimer: (activityId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => Promise<PracticeSession | null>;
  cancelTimer: () => void;

  logManual: (activityId: string, minutes: number) => Promise<void>;
}

let ticker: ReturnType<typeof setInterval> | null = null;

const stopTicker = () => {
  if (ticker) clearInterval(ticker);
  ticker = null;
};

const elapsedOf = (timer: ActiveTimer): number =>
  timer.bankedMs + (timer.running ? Date.now() - timer.startedAt : 0);

export const usePracticeStore = create<PracticeState>((set, get) => ({
  activities: [],
  stats: {},
  sessions: [],
  weekStart: startOfWeek(),
  loading: true,

  timer: null,
  timerElapsedMs: 0,

  load: async () => {
    const weekStart = get().weekStart;
    const activities = await listActivities();

    const stats: Record<string, PracticeWeeklyStats> = {};
    for (const activity of activities) {
      stats[activity.id] = await weeklyPracticeStats(activity, weekStart);
    }

    set({ activities, stats, sessions: await listPracticeSessions(undefined, 60), loading: false });
  },

  setWeekStart: async (weekStart) => {
    set({ weekStart });
    await get().load();
  },

  createActivity: async (input) => {
    const activity = await saveActivity({
      ...input,
      sortOrder: get().activities.length,
    });
    haptics.success();
    await get().load();
    return activity;
  },

  updateActivity: async (activity) => {
    await saveActivity(activity);
    await get().load();
  },

  removeActivity: async (id) => {
    // Never leave a timer pointing at an activity that no longer exists.
    if (get().timer?.activityId === id) get().cancelTimer();
    await deleteActivity(id);
    haptics.warning();
    await get().load();
  },

  startTimer: (activityId) => {
    stopTicker();
    const timer: ActiveTimer = {
      activityId,
      startedAt: Date.now(),
      bankedMs: 0,
      running: true,
    };

    ticker = setInterval(() => {
      const current = get().timer;
      if (current?.running) set({ timerElapsedMs: elapsedOf(current) });
    }, 250);

    haptics.impact();
    set({ timer, timerElapsedMs: 0 });
  },

  pauseTimer: () => {
    const timer = get().timer;
    if (!timer?.running) return;
    const banked = elapsedOf(timer);
    haptics.tap();
    set({ timer: { ...timer, bankedMs: banked, running: false }, timerElapsedMs: banked });
  },

  resumeTimer: () => {
    const timer = get().timer;
    if (!timer || timer.running) return;
    haptics.tap();
    set({ timer: { ...timer, startedAt: Date.now(), running: true } });
  },

  stopTimer: async () => {
    const timer = get().timer;
    if (!timer) return null;

    const elapsedMs = elapsedOf(timer);
    stopTicker();
    set({ timer: null, timerElapsedMs: 0 });

    // Under six seconds is a misfire, not a practice session.
    if (elapsedMs < 6000) {
      haptics.warning();
      return null;
    }

    const session = await logPractice({
      activityId: timer.activityId,
      minutes: elapsedMs / 60_000,
      startedAt: timer.startedAt - timer.bankedMs,
      endedAt: Date.now(),
      source: 'timer',
    });

    haptics.success();
    await get().load();
    return session;
  },

  cancelTimer: () => {
    stopTicker();
    set({ timer: null, timerElapsedMs: 0 });
  },

  logManual: async (activityId, minutes) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    await logPractice({ activityId, minutes, source: 'manual' });
    haptics.success();
    await get().load();
  },
}));

/** Icon choices offered when creating an activity. */
export const ACTIVITY_ICONS = [
  'sparkles',
  'game-controller',
  'musical-notes',
  'keypad',
  'book',
  'barbell',
  'brush',
  'code-slash',
  'language',
  'mic',
  'camera',
  'leaf',
] as const;
