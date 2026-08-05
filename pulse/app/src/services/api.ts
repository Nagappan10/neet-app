import { loadSettingsSnapshot } from './settingsSnapshot';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Server row shapes — snake_case, exactly as the API returns them. */
export interface ServerPayload {
  walking_sessions: Record<string, unknown>[];
  daily_steps: Record<string, unknown>[];
  practice_activities: Record<string, unknown>[];
  practice_sessions: Record<string, unknown>[];
}

export interface SyncResponse {
  server_time: number;
  pushed: Record<string, number>;
  pull: ServerPayload;
}

const TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiBaseUrl, deviceId } = await loadSettingsSnapshot();
  if (!apiBaseUrl) throw new ApiError('No API base URL configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-pulse-user': deviceId,
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) throw new ApiError(`Request failed: ${res.status}`, res.status);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out');
    }
    throw new ApiError(err instanceof Error ? err.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  sync: (since: number, push: ServerPayload) =>
    request<SyncResponse>('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ since, push }),
    }),
};

/** Cheap reachability probe used before attempting a sync. */
export async function isReachable(): Promise<boolean> {
  try {
    const { apiBaseUrl } = await loadSettingsSnapshot();
    if (!apiBaseUrl) return false;
    await api.health();
    return true;
  } catch {
    return false;
  }
}
