import { getDb, getMeta, setMeta } from '@/db/client';
import { api, type ServerPayload } from './api';
import { loadSettingsSnapshot } from './settingsSnapshot';

/**
 * Offline-first sync.
 *
 * Local SQLite is always the write target — the UI never waits on the network.
 * Mutations append to `sync_queue`; this engine drains that queue into a single
 * batched POST that also returns everything the server has seen since our last
 * watermark. Both directions resolve conflicts by last-write-wins on
 * `updated_at`, so the two halves can be applied in any order.
 */

const WATERMARK_KEY = 'sync:watermark';
const LAST_SYNC_KEY = 'sync:lastAt';

type Entity = keyof ServerPayload;

const ENTITIES: Entity[] = [
  'walking_sessions',
  'daily_steps',
  'practice_activities',
  'practice_sessions',
];

/** Columns that exist on both sides, per table, in insert order. */
const COLUMNS: Record<Entity, string[]> = {
  walking_sessions: [
    'id',
    'started_at',
    'ended_at',
    'day',
    'steps',
    'duration_ms',
    'distance_m',
    'calories',
    'avg_pace',
    'note',
    'deleted',
    'updated_at',
  ],
  daily_steps: [
    'id',
    'day',
    'steps',
    'distance_m',
    'calories',
    'active_ms',
    'goal',
    'deleted',
    'updated_at',
  ],
  practice_activities: [
    'id',
    'name',
    'icon',
    'color',
    'target_minutes',
    'sort_order',
    'archived',
    'created_at',
    'deleted',
    'updated_at',
  ],
  practice_sessions: [
    'id',
    'activity_id',
    'day',
    'started_at',
    'ended_at',
    'minutes',
    'source',
    'note',
    'deleted',
    'updated_at',
  ],
};

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
  at: number;
}

let inFlight: Promise<SyncResult> | null = null;

/** Serialised so overlapping triggers (app focus, background task) coalesce. */
export function runSync(): Promise<SyncResult> {
  if (!inFlight) {
    inFlight = doSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doSync(): Promise<SyncResult> {
  const at = Date.now();
  const settings = await loadSettingsSnapshot();

  if (!settings.syncEnabled || !settings.apiBaseUrl) {
    return { ok: false, pushed: 0, pulled: 0, error: 'Sync disabled', at };
  }

  const db = await getDb();
  const since = Number((await getMeta(WATERMARK_KEY)) ?? 0);

  /* ------------------------------- collect push ------------------------- */

  const queued = await db.getAllAsync<{ id: number; entity: string; row_id: string }>(
    `SELECT id, entity, row_id FROM sync_queue ORDER BY id ASC LIMIT 1000`,
  );

  const push: ServerPayload = {
    walking_sessions: [],
    daily_steps: [],
    practice_activities: [],
    practice_sessions: [],
  };

  const drainedIds: number[] = [];

  for (const item of queued) {
    const entity = item.entity as Entity;
    if (!ENTITIES.includes(entity)) {
      drainedIds.push(item.id); // unknown entity: drop rather than retry forever
      continue;
    }
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT ${COLUMNS[entity].join(', ')} FROM ${entity} WHERE id = ?`,
      item.row_id,
    );
    if (row) push[entity].push(row);
    drainedIds.push(item.id);
  }

  const pushCount = ENTITIES.reduce((acc, e) => acc + push[e].length, 0);

  /* --------------------------------- transmit --------------------------- */

  let response;
  try {
    response = await api.sync(since, push);
  } catch (err) {
    return {
      ok: false,
      pushed: 0,
      pulled: 0,
      error: err instanceof Error ? err.message : 'Sync failed',
      at,
    };
  }

  // Only clear the queue once the server has acknowledged the batch, so a
  // failed request leaves every pending change intact for the next attempt.
  if (drainedIds.length > 0) {
    await db.runAsync(
      `DELETE FROM sync_queue WHERE id IN (${drainedIds.map(() => '?').join(',')})`,
      ...drainedIds,
    );
  }

  /* -------------------------------- apply pull -------------------------- */

  let pulled = 0;
  for (const entity of ENTITIES) {
    const rows = response.pull[entity] ?? [];
    for (const row of rows) {
      const applied = await applyRemoteRow(db, entity, row);
      if (applied) pulled += 1;
    }
  }

  await setMeta(WATERMARK_KEY, String(response.server_time));
  await setMeta(LAST_SYNC_KEY, String(at));

  return { ok: true, pushed: pushCount, pulled, at };
}

/**
 * The column an upsert must collide on. `daily_steps` is keyed by day locally
 * (there can only ever be one row per calendar day), so a remote row for the
 * same day but a different id has to update that day's row rather than trip
 * the UNIQUE(day) constraint. The conflict handler rewrites `id` too, which
 * converges both sides onto the server's identifier.
 */
const CONFLICT_TARGET: Record<Entity, string> = {
  walking_sessions: 'id',
  daily_steps: 'day',
  practice_activities: 'id',
  practice_sessions: 'id',
};

/**
 * Writes a server row into local SQLite, but only when it is strictly newer
 * than what we hold — the pull-side half of last-write-wins.
 */
async function applyRemoteRow(
  db: Awaited<ReturnType<typeof getDb>>,
  entity: Entity,
  row: Record<string, unknown>,
): Promise<boolean> {
  const cols = COLUMNS[entity];
  const target = CONFLICT_TARGET[entity];
  const values = cols.map((c) => (row[c] === undefined ? null : (row[c] as never)));
  const assignments = cols
    .filter((c) => c !== target)
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  const result = await db.runAsync(
    `INSERT INTO ${entity} (${cols.join(', ')})
     VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(${target}) DO UPDATE SET ${assignments}
     WHERE excluded.updated_at > ${entity}.updated_at`,
    ...values,
  );

  return result.changes > 0;
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM sync_queue`);
  return row?.n ?? 0;
}

export async function lastSyncedAt(): Promise<number | null> {
  const value = await getMeta(LAST_SYNC_KEY);
  return value ? Number(value) : null;
}

/** Forces a full re-pull on the next sync (e.g. after restoring a backup). */
export async function resetWatermark(): Promise<void> {
  await setMeta(WATERMARK_KEY, '0');
}
