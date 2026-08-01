import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import type { DayKey } from '@/types';
import { dayBounds, toDayKey } from '@/utils/date';

/**
 * Thin wrapper over the *native* hardware pedometer — CoreMotion's
 * CMPedometer on iOS, the TYPE_STEP_COUNTER sensor on Android. We never
 * integrate accelerometer data ourselves: the platform counters are both far
 * more accurate and vastly cheaper on battery.
 *
 * The two platforms differ in one important way:
 *
 *   iOS     CMPedometer stores ~7 days of history, so `getStepCountAsync`
 *           can answer "how many steps today" authoritatively at any moment,
 *           including steps taken while the app was closed.
 *
 *   Android TYPE_STEP_COUNTER exposes only a monotonic since-boot counter with
 *           no history API, so `getStepCountAsync` is unavailable. We instead
 *           accumulate deltas from a live subscription and persist the running
 *           daily total (see `accumulateDailySteps` in the steps store).
 */

export type PedometerPermission = 'granted' | 'denied' | 'undetermined';

export interface PedometerStatus {
  available: boolean;
  permission: PedometerPermission;
  /** True when historical day queries can be trusted (iOS only). */
  supportsHistory: boolean;
}

export const SUPPORTS_HISTORY = Platform.OS === 'ios';

export async function getStatus(): Promise<PedometerStatus> {
  const available = await isAvailable();
  const permission = await getPermission();
  return { available, permission, supportsHistory: SUPPORTS_HISTORY && available };
}

export async function isAvailable(): Promise<boolean> {
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getPermission(): Promise<PedometerPermission> {
  try {
    const res = await Pedometer.getPermissionsAsync();
    return normalise(res);
  } catch {
    return 'undetermined';
  }
}

export async function requestPermission(): Promise<PedometerPermission> {
  try {
    const res = await Pedometer.requestPermissionsAsync();
    return normalise(res);
  } catch {
    return 'denied';
  }
}

function normalise(res: {
  granted?: boolean;
  status?: string;
  canAskAgain?: boolean;
}): PedometerPermission {
  if (res.granted) return 'granted';
  if (res.status === 'undetermined' || res.canAskAgain) return 'undetermined';
  return 'denied';
}

/**
 * Live step subscription. The callback receives the *cumulative* steps since
 * the subscription began, exactly as the platform reports them — callers that
 * want deltas should diff against the previous value themselves.
 */
export function watchSteps(onUpdate: (cumulativeSteps: number) => void): () => void {
  const subscription = Pedometer.watchStepCount((result) => {
    onUpdate(result.steps);
  });
  return () => subscription.remove();
}

/**
 * Steps recorded between two instants. Resolves to `null` where the platform
 * has no history API, which callers must treat as "fall back to the
 * accumulator" rather than as zero.
 */
export async function getStepsBetween(start: Date, end: Date): Promise<number | null> {
  if (!SUPPORTS_HISTORY) return null;
  try {
    const result = await Pedometer.getStepCountAsync(start, end);
    return result?.steps ?? 0;
  } catch {
    return null;
  }
}

/** Total steps for a local calendar day, or null when unsupported. */
export async function getStepsForDay(day: DayKey = toDayKey()): Promise<number | null> {
  const { start, end } = dayBounds(day);
  const now = new Date();
  return getStepsBetween(start, end > now ? now : end);
}

/** Backfills up to `days` of history on first launch (iOS only). */
export async function getRecentHistory(days = 7): Promise<Map<DayKey, number>> {
  const out = new Map<DayKey, number>();
  if (!SUPPORTS_HISTORY) return out;

  const today = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDayKey(d);
    const steps = await getStepsForDay(key);
    if (steps !== null) out.set(key, steps);
  }
  return out;
}
