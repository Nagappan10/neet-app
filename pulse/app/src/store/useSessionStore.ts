import { create } from 'zustand';
import { saveSession } from '@/db/walking';
import { haptics } from '@/services/haptics';
import { watchSteps } from '@/services/pedometer';
import type { WalkingSession } from '@/types';
import { toDayKey } from '@/utils/date';
import { caloriesBurned, distanceFromSteps, paceStepsPerMinute } from '@/utils/metrics';

export type SessionStatus = 'idle' | 'active' | 'paused';

interface SessionState {
  status: SessionStatus;
  startedAt: number | null;

  /** Steps counted across every running (unpaused) stretch of this session. */
  steps: number;
  /** Active milliseconds, excluding paused time. */
  elapsedMs: number;
  /** Cadence over the last few seconds, not the whole session. */
  currentPace: number;

  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<WalkingSession | null>;
  discard: () => void;

  /** Wired up by the live screen; supplies stride and weight for metrics. */
  configure: (config: { strideLength: number; weightKg: number }) => void;
}

/* ------------------------- non-reactive session state ---------------------- */
/*
 * These live outside the store because they change many times per second and
 * nothing should re-render when they do. Only the derived values the UI
 * actually displays get published into Zustand, on a fixed tick.
 */

let unsubscribe: (() => void) | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

/** Cumulative steps reported by the platform since the subscription began. */
let rawCumulative = 0;
/** Raw reading at the last start/resume — the origin for the running stretch. */
let rawAtResume = 0;
/** Steps banked from stretches that have already ended (i.e. before a pause). */
let bankedSteps = 0;

let bankedMs = 0;
let resumedAt = 0;

let config = { strideLength: 0.762, weightKg: 70 };

/** Rolling window of (timestamp, steps) samples used for the live cadence. */
let paceSamples: { t: number; steps: number }[] = [];
const PACE_WINDOW_MS = 20_000;

function reset() {
  unsubscribe?.();
  unsubscribe = null;
  if (ticker) clearInterval(ticker);
  ticker = null;
  rawCumulative = 0;
  rawAtResume = 0;
  bankedSteps = 0;
  bankedMs = 0;
  resumedAt = 0;
  paceSamples = [];
}

const runningSteps = () => bankedSteps + Math.max(0, rawCumulative - rawAtResume);

const runningMs = (status: SessionStatus) =>
  bankedMs + (status === 'active' && resumedAt > 0 ? Date.now() - resumedAt : 0);

/** Cadence across the recent window, which is what "current pace" should mean. */
function computeCurrentPace(): number {
  const now = Date.now();
  paceSamples = paceSamples.filter((s) => now - s.t <= PACE_WINDOW_MS);
  if (paceSamples.length < 2) return 0;

  const first = paceSamples[0]!;
  const last = paceSamples[paceSamples.length - 1]!;
  const spanMs = last.t - first.t;
  if (spanMs < 2000) return 0;

  return ((last.steps - first.steps) / spanMs) * 60_000;
}

/**
 * Live walking session.
 *
 * Steps come straight from the native pedometer subscription — the callback
 * reports a cumulative count since the subscription started, so pausing is
 * handled by banking the running total and re-basing the origin on resume,
 * rather than by tearing the subscription down and losing the platform's
 * internal state.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  startedAt: null,
  steps: 0,
  elapsedMs: 0,
  currentPace: 0,

  configure: (next) => {
    config = next;
  },

  start: () => {
    if (get().status !== 'idle') return;
    reset();

    const now = Date.now();
    resumedAt = now;
    paceSamples = [{ t: now, steps: 0 }];

    unsubscribe = watchSteps((cumulative) => {
      rawCumulative = cumulative;
      if (get().status === 'active') {
        paceSamples.push({ t: Date.now(), steps: runningSteps() });
      }
    });

    // One tick drives the clock, the step readout and the pace together, so
    // the whole readout stays internally consistent frame to frame.
    ticker = setInterval(() => {
      const status = get().status;
      if (status === 'idle') return;
      set({
        steps: runningSteps(),
        elapsedMs: runningMs(status),
        currentPace: status === 'active' ? computeCurrentPace() : 0,
      });
    }, 250);

    haptics.impact();
    set({ status: 'active', startedAt: now, steps: 0, elapsedMs: 0, currentPace: 0 });
  },

  pause: () => {
    if (get().status !== 'active') return;

    bankedSteps = runningSteps();
    bankedMs = runningMs('active');
    resumedAt = 0;
    paceSamples = [];

    haptics.tap();
    set({ status: 'paused', steps: bankedSteps, elapsedMs: bankedMs, currentPace: 0 });
  },

  resume: () => {
    if (get().status !== 'paused') return;

    // Re-base onto the platform's current cumulative reading so steps taken
    // while paused are excluded from the session.
    rawAtResume = rawCumulative;
    resumedAt = Date.now();
    paceSamples = [{ t: resumedAt, steps: bankedSteps }];

    haptics.tap();
    set({ status: 'active' });
  },

  stop: async () => {
    const status = get().status;
    if (status === 'idle') return null;

    const steps = runningSteps();
    const durationMs = runningMs(status);
    const startedAt = get().startedAt ?? Date.now() - durationMs;

    reset();
    set({ status: 'idle', startedAt: null, steps: 0, elapsedMs: 0, currentPace: 0 });

    // A tap that produced nothing is not worth a history row.
    if (steps === 0 && durationMs < 3000) {
      haptics.warning();
      return null;
    }

    const distanceM = distanceFromSteps(steps, config.strideLength);
    const session = await saveSession({
      startedAt,
      endedAt: Date.now(),
      day: toDayKey(startedAt),
      steps,
      durationMs,
      distanceM,
      calories: caloriesBurned(steps, durationMs, config.weightKg),
      avgPace: paceStepsPerMinute(steps, durationMs),
      note: null,
    });

    haptics.success();
    return session;
  },

  discard: () => {
    reset();
    set({ status: 'idle', startedAt: null, steps: 0, elapsedMs: 0, currentPace: 0 });
  },
}));

/** Live-derived values the session screen renders. */
export function sessionMetrics(steps: number, elapsedMs: number, strideLength: number, weightKg: number) {
  return {
    distanceM: distanceFromSteps(steps, strideLength),
    calories: caloriesBurned(steps, elapsedMs, weightKg),
    avgPace: paceStepsPerMinute(steps, elapsedMs),
  };
}
