import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { pendingCount, runSync } from './sync';

/** Don't hammer the server if the user flips between apps repeatedly. */
const MIN_INTERVAL_MS = 30_000;

/**
 * Drives sync from app lifecycle rather than from each mutation.
 *
 * Mutations only ever enqueue — they never block the UI on a network call —
 * so the queue is drained at the moments that actually matter: when the app
 * comes to the foreground, once shortly after launch, and periodically while
 * the app stays open. The background task covers everything else.
 */
export function useSyncTriggers(): void {
  const syncEnabled = useSettingsStore((s) => s.syncEnabled);
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);
  const lastRun = useRef(0);

  useEffect(() => {
    if (!syncEnabled || !apiBaseUrl) return;

    const attempt = async () => {
      if (Date.now() - lastRun.current < MIN_INTERVAL_MS) return;
      // Skip the round trip entirely when there is nothing waiting and we
      // synced recently — an empty push still costs a request.
      lastRun.current = Date.now();
      await runSync().catch(() => undefined);
    };

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void attempt();
    };

    const subscription = AppState.addEventListener('change', onChange);

    // Kick once on mount, then keep a slow heartbeat while in the foreground.
    void attempt();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void attempt();
    }, 5 * 60_000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [syncEnabled, apiBaseUrl]);
}

/** Flushes the queue immediately, ignoring the throttle. For "Sync now". */
export async function flushNow(): Promise<void> {
  if (await pendingCount()) await runSync().catch(() => undefined);
}
