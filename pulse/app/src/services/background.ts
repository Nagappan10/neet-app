import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { getDaily, upsertDaily } from '@/db/walking';
import { toDayKey } from '@/utils/date';
import { caloriesFromDailySteps, distanceFromSteps } from '@/utils/metrics';
import { getStepsForDay, SUPPORTS_HISTORY } from './pedometer';
import { loadSettingsSnapshot } from './settingsSnapshot';
import { runSync } from './sync';

/**
 * Background upkeep. The OS wakes us periodically (iOS decides when; Android
 * uses WorkManager) and we do two cheap things:
 *
 *   1. Re-read today's step total from the native pedometer and persist it, so
 *      steps taken with the app closed are already in the database when the
 *      user next opens it.
 *   2. Drain the sync queue if the network is up.
 *
 * On Android the platform step counter keeps running in the sensor hub whether
 * or not our process is alive, so nothing is lost between wakeups — we just
 * cannot query history, and reconcile from the live subscription instead.
 */

export const STEP_SYNC_TASK = 'pulse-step-sync';

TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  try {
    const day = toDayKey();
    const settings = await loadSettingsSnapshot();

    if (SUPPORTS_HISTORY) {
      const steps = await getStepsForDay(day);
      if (steps !== null) {
        const existing = await getDaily(day);
        // Never let a background read walk the total backwards.
        const next = Math.max(steps, existing?.steps ?? 0);
        await upsertDaily(day, {
          steps: next,
          distanceM: distanceFromSteps(next, settings.strideLength),
          calories: caloriesFromDailySteps(next, settings.weightKg),
          goal: settings.dailyGoal,
        });
      }
    }

    await runSync().catch(() => undefined);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundTask(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return false;

    const already = await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK);
    if (already) return true;

    await BackgroundTask.registerTaskAsync(STEP_SYNC_TASK, {
      minimumInterval: 15, // minutes; the OS treats this as a floor, not a promise
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterBackgroundTask(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK)) {
      await BackgroundTask.unregisterTaskAsync(STEP_SYNC_TASK);
    }
  } catch {
    // Nothing to do — an unregistered task is the state we wanted anyway.
  }
}

export async function isBackgroundTaskRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK);
  } catch {
    return false;
  }
}
