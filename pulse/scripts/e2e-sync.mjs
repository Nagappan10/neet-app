// End-to-end: two "devices" sharing a user, syncing through the real API,
// exercising the exact push/pull payload shape the app sends.
const BASE = process.env.PULSE_API ?? 'http://localhost:4000';
// Fresh user per run so the script is idempotent and never reads stale state
// left behind by a previous invocation.
const USER = `e2e-${Date.now()}`;

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pulse-user': USER },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};

const sync = (since, push) =>
  post('/api/sync', {
    since,
    push: {
      walking_sessions: [], daily_steps: [],
      practice_activities: [], practice_sessions: [],
      ...push,
    },
  });

const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); console.log(`✓ ${msg}`); };

// --- Device A: records a walk offline, then syncs -------------------------
let a = await sync(0, {
  walking_sessions: [{
    id: 'sess-a', started_at: 1_000, ended_at: 61_000, day: '2026-08-01',
    steps: 1200, duration_ms: 60_000, distance_m: 914.4, calories: 48,
    avg_pace: 1200, note: null, deleted: 0, updated_at: 1_000,
  }],
  daily_steps: [{
    id: 'day:2026-08-01', day: '2026-08-01', steps: 1200, distance_m: 914.4,
    calories: 48, active_ms: 60_000, goal: 10_000, deleted: 0, updated_at: 1_000,
  }],
});
assert(a.pushed.walking_sessions === 1, 'device A pushed its walking session');
const watermarkA = a.server_time;

// --- Device B: cold start, pulls everything ------------------------------
const b = await sync(0, {});
assert(b.pull.walking_sessions.length === 1, 'device B pulled the session from scratch');
assert(b.pull.walking_sessions[0].steps === 1200, 'device B sees the correct step count');
assert(b.pull.daily_steps.length === 1, 'device B pulled the daily rollup');
const watermarkB = b.server_time;

// --- Device B edits the same day, newer timestamp ------------------------
await sync(watermarkB, {
  daily_steps: [{
    id: 'day:2026-08-01', day: '2026-08-01', steps: 9500, distance_m: 7239,
    calories: 380, active_ms: 3_000_000, goal: 10_000, deleted: 0,
    updated_at: Date.now(),
  }],
});

// --- Device A pulls the delta only ---------------------------------------
const a2 = await sync(watermarkA, {});
assert(a2.pull.daily_steps.length === 1, 'device A pulled exactly the changed day');
assert(a2.pull.daily_steps[0].steps === 9500, "device A received device B's newer value");
assert(a2.pull.walking_sessions.length === 0, 'unchanged rows were not re-sent');

// --- A stale replay from device A must not win ---------------------------
await sync(0, {
  daily_steps: [{
    id: 'day:2026-08-01', day: '2026-08-01', steps: 1200, distance_m: 914.4,
    calories: 48, active_ms: 60_000, goal: 10_000, deleted: 0, updated_at: 1_000,
  }],
});
const after = await sync(0, {});
const day = after.pull.daily_steps.find((d) => d.day === '2026-08-01');
assert(day.steps === 9500, 'stale replay did not clobber the newer value');

// --- Tombstone propagates ------------------------------------------------
await sync(0, {
  walking_sessions: [{
    id: 'sess-a', started_at: 1_000, ended_at: 61_000, day: '2026-08-01',
    steps: 1200, duration_ms: 60_000, distance_m: 914.4, calories: 48,
    avg_pace: 1200, note: null, deleted: 1, updated_at: Date.now(),
  }],
});
const afterDelete = await sync(0, {});
assert(
  afterDelete.pull.walking_sessions.find((s) => s.id === 'sess-a').deleted === 1,
  'delete tombstone propagates to other devices',
);

// --- Server-side aggregates reflect the merged state ---------------------
const weekly = await (await fetch(`${BASE}/api/stats/walking/weekly?start=2026-08-01`, {
  headers: { 'x-pulse-user': USER },
})).json();
assert(weekly.total_steps === 9500, `weekly aggregate uses merged value (${weekly.total_steps})`);
assert(weekly.days.length === 7, 'weekly aggregate is zero-filled to 7 days');

// --- Multi-tenancy: two different users, same deterministic row id --------
// `daily_steps` ids are `day:YYYY-MM-DD`, which every user generates
// identically. If the server keyed rows on `id` alone, the second user's write
// would silently no-op against the first user's row and their data would
// vanish. This is a regression test for exactly that.
const other = `e2e-other-${Date.now()}`;
const postAs = async (user, body) => {
  const res = await fetch(`${BASE}/api/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pulse-user': user },
    body: JSON.stringify({
      since: 0,
      push: { walking_sessions: [], daily_steps: [], practice_activities: [], practice_sessions: [], ...body },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

const sharedId = { id: 'day:2026-08-01', day: '2026-08-01', distance_m: 0, calories: 0, active_ms: 0, goal: 10_000, deleted: 0 };
await postAs(other, { daily_steps: [{ ...sharedId, steps: 4242, updated_at: Date.now() }] });

const otherPull = await postAs(other, {});
const otherDay = otherPull.pull.daily_steps.find((d) => d.id === 'day:2026-08-01');
assert(otherDay !== undefined, "second user's row exists despite the shared id");
assert(otherDay.steps === 4242, `second user sees their own value (${otherDay?.steps})`);

const firstPull = await sync(0, {});
const firstDay = firstPull.pull.daily_steps.find((d) => d.id === 'day:2026-08-01');
assert(firstDay.steps === 9500, `first user's value is untouched (${firstDay.steps})`);

console.log('\nEnd-to-end sync passed.');
