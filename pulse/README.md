# Pulse

A fitness + practice tracking app. Native-pedometer walking sessions, custom
practice activities with streaks, and an offline-first local database that
optionally syncs to a self-hosted REST API.

```
pulse/
├── app/      Expo (React Native, TypeScript) — the mobile app
└── server/   Express + TypeScript + better-sqlite3 — the sync API
```

---

## Requirements

| Tool | Version |
|---|---|
| Node | 20+ (built and tested on 22) |
| npm | 10+ |
| Xcode | 16+ — iOS builds only |
| Android Studio | Ladybug+ with SDK 35 — Android builds only |

**A physical device is required to see step counts.** Neither the iOS Simulator
nor the Android emulator has a pedometer, so `Pedometer.isAvailableAsync()`
resolves `false` there and the app shows the "No step sensor found" screen.
Everything else — practice tracking, charts, navigation, the whole design
system — works fine in a simulator.

---

## 1. Run the app

```bash
cd pulse/app
npm install
```

Pulse uses native modules (pedometer, SQLite, blur, Reanimated), so it cannot
run in Expo Go. You need a development build.

### iOS

```bash
npx expo run:ios --device      # pick your connected iPhone when prompted
```

First run compiles the native project into `ios/` and takes a few minutes.
Afterwards `npx expo start --dev-client` is enough.

iOS will prompt for **Motion & Fitness** access on first launch. If you decline,
it cannot be re-requested in-app — you have to re-enable it under
*Settings → Privacy & Security → Motion & Fitness → Pulse*.

### Android

```bash
npx expo run:android          # device connected over USB with debugging on
```

Android prompts for **Physical activity** (`ACTIVITY_RECOGNITION`) at runtime.
Unlike iOS, a denial can be re-requested, so the permission screen's button
keeps working.

### Day to day

```bash
npm start          # dev server for an already-installed dev build
npm run typecheck  # tsc --noEmit
```

---

## 2. Run the sync server (optional)

The app is fully functional with no server. Sync only adds cloud backup and
multi-device merge.

```bash
cd pulse/server
npm install
npm run dev        # http://localhost:4000, SQLite file at server/data/pulse.db
```

Then in the app: **Settings → Cloud sync**, toggle *Enable sync* and set the
server URL.

> Use your machine's **LAN IP**, not `localhost` — on a phone, `localhost`
> means the phone itself. Find it with `ipconfig getifaddr en0` (macOS) or
> `hostname -I` (Linux), giving something like `http://192.168.1.10:4000`.

`PULSE_DB_PATH` overrides the database location; `PORT` overrides the port.

---

## Verifying it works

**Walking.** Open the Walk tab, grant motion access, tap *Start walking*, and
walk. Steps, the timer, distance, calories and pace all update live, and the
ring fills toward your daily goal. Tap *Stop* and the session is saved and
opens its detail screen.

**Daily totals.** Steps are counted all day, session or not. On iOS the count
is read straight from CoreMotion, so steps taken with the app closed appear on
next launch. On Android they accumulate from the live subscription plus the
background task.

**Practice.** Practice tab → **+** → name it, pick an icon, colour and daily
target. Run its timer or tap a quick-log chip. Cross the daily target and the
day's cell fills and springs a checkmark in.

**Sync.** Start the server, enable sync, tap *Sync now*. The status block shows
pending changes and the last sync time. To prove offline-first: turn on
airplane mode, record a walk, turn it back on — the queued change pushes on the
next foreground.

The sync layer has automated checks (multi-device merge, conflict resolution,
tombstones) — see [Testing](#testing).

---

## How it works

### Steps come from the hardware pedometer

`expo-sensors`' `Pedometer` wraps **CMPedometer** on iOS and the
**`TYPE_STEP_COUNTER`** sensor on Android. Both count in dedicated low-power
silicon, which is why Pulse never integrates accelerometer data itself —
hand-rolled step detection is both less accurate and far worse on battery.

The two platforms differ in one way that shapes the whole design:

| | iOS | Android |
|---|---|---|
| Live counting | `watchStepCount` | `watchStepCount` |
| Historical query | `getStepCountAsync`, ~7 days | **not available** |
| Counts while app is closed | yes, and readable after the fact | yes, but only readable live |

So `getStepsForDay()` returns `number | null`, and `null` means *"fall back to
the accumulator"* — never *zero*. On iOS the day's total is re-read from the
platform and is authoritative. On Android a persisted accumulator is fed by
deltas from the live subscription, batched every 5s rather than written per
step.

### Offline-first sync

Local SQLite is the source of truth. The UI never awaits the network.

```
write  →  local SQLite  →  sync_queue row
                                  ↓  (on foreground / background task / manual)
                          POST /api/sync  { since, push }
                                  ↓
                          { server_time, pull }  →  merge into local SQLite
```

Conflicts resolve **last-write-wins on `updated_at`**, enforced in SQL on both
sides:

```sql
ON CONFLICT(id) DO UPDATE SET ...
WHERE excluded.updated_at > table_name.updated_at
```

A stale replay therefore cannot clobber newer state, and the push and pull
halves can be applied in any order. Deletes are tombstones (`deleted = 1`) so
removals propagate rather than resurrecting on the next pull. The queue is only
cleared *after* the server acknowledges the batch, so a failed request leaves
every pending change intact.

`daily_steps` upserts collide on `day` rather than `id`, since there can only
ever be one row per calendar day — this is what lets a row created locally and
one created through the REST API converge instead of tripping `UNIQUE(day)`.

### Dates are local, always

Every key is a `YYYY-MM-DD` string in the device's local timezone. A walk at
11pm belongs to the day the user experienced it, not the day in UTC.

---

## API

All routes take an `x-pulse-user` header identifying the device (the app sends
a generated device ID). This is a trust-the-caller stand-in — **put real auth
in front of it before exposing it beyond a trusted network.**

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness + resolved DB path |
| `POST` | `/api/sync` | Batched push + pull, LWW merge |
| `GET` | `/api/walking/sessions` | Recent sessions |
| `GET` | `/api/walking/sessions/:id` | One session |
| `POST` | `/api/walking/sessions` | Upsert a session |
| `DELETE` | `/api/walking/sessions/:id` | Tombstone a session |
| `GET` | `/api/walking/daily?from=&to=` | Daily step rows |
| `PUT` | `/api/walking/daily/:day` | Upsert one day |
| `GET` | `/api/practice/activities` | List activities |
| `POST` | `/api/practice/activities` | Create |
| `PATCH` | `/api/practice/activities/:id` | Update |
| `DELETE` | `/api/practice/activities/:id` | Tombstone |
| `GET` | `/api/practice/sessions?activity_id=` | Practice log |
| `POST` | `/api/practice/sessions` | Log practice |
| `DELETE` | `/api/practice/sessions/:id` | Tombstone |
| `GET` | `/api/stats/walking/weekly?start=` | Week totals, best day, streak, vs last week |
| `GET` | `/api/stats/walking/monthly?month=` | Month heatmap buckets |
| `GET` | `/api/stats/walking/range?from=&to=` | Arbitrary range |
| `GET` | `/api/stats/practice/weekly?start=` | Per-activity week, streaks, deltas |

Aggregation runs in SQL server-side, so a month of heatmap data is one query
rather than a month of rows over the wire.

### Schema

`users`, `walking_sessions`, `daily_steps`, `practice_activities`,
`practice_sessions` — see [`server/src/schema.sql`](server/src/schema.sql). The
local schema in [`app/src/db/schema.ts`](app/src/db/schema.ts) mirrors it
column-for-column, plus `sync_queue` and `meta`, so sync payloads are a field
mapping rather than a translation layer.

---

## Design system

Everything is built on [`app/src/theme`](app/src/theme) and
[`app/src/components`](app/src/components), so the look is defined once.

**Glass.** `GlassCard` layers a `BlurView`, a translucent fill, a top-down
inner glow, a **1px `rgba(255,255,255,0.18)` top highlight**, a hairline border
and two shadow layers. The top highlight is the detail that sells it — it is
what a real bevel catching light looks like.

**The mesh.** Glass needs something to refract. `MeshBackground` drifts three
oversized gradient blobs on long offset sine loops and melts them with one
heavy blur. It is mounted once at the root, so the gradient never restarts
during navigation.

**Motion.** Springs, never linear easing. The house spring is
**damping 15 / stiffness 120**; the other presets are deliberate deviations
(`snappy` for presses, `precise` for the ring so it can't overshoot past 100%,
`bouncy` for completion moments). Every preset carries
`reduceMotion: System`, so Reduce Motion is honoured throughout.

**Numbers.** All tabular-figure so live counters never jitter, and animated via
`useAnimatedProps` on a `TextInput` — formatting happens inside a worklet, so a
count-up costs zero React renders.

**Where the polish lives:**

| Effect | File |
|---|---|
| Animated mesh gradient | `components/MeshBackground.tsx` |
| Frosted card | `components/GlassCard.tsx` |
| Spring press + haptics | `components/PressableScale.tsx` |
| Spring count-up numbers | `components/AnimatedNumber.tsx` |
| SVG `stroke-dashoffset` ring | `components/ProgressRing.tsx` |
| Staggered bar chart | `components/BarChart.tsx` |
| Month heatmap | `components/HeatmapCalendar.tsx` |
| Sliding-indicator tab bar | `components/FloatingTabBar.tsx` |
| Collapsing header + pull-to-refresh | `components/Screen.tsx`, `PullIndicator.tsx` |
| Shared element transitions | `components/SharedHero.tsx` |
| Completion spring + checkmark | `components/WeekGrid.tsx` |

---

## Testing

```bash
cd pulse/server && npm run dev     # in one terminal

node scripts/verify-sync.mjs       # local schema + sync SQL, against real SQLite
node scripts/e2e-sync.mjs          # two devices merging through the live API
```

`verify-sync.mjs` parses `SCHEMA_SQL` and the sync column map straight out of
the app source, so it cannot drift from what ships. `e2e-sync.mjs` exercises
cold-start pull, incremental pull, cross-device conflict resolution, stale
replay rejection and tombstone propagation.

Typechecking:

```bash
cd pulse/app    && npm run typecheck
cd pulse/server && npm run typecheck
```

---

## Notes and deviations

A few places where the brief and the current toolchain disagreed, and what
shipped instead:

- **Reanimated 4, not 3.** Expo SDK 57 / React Native 0.86 bundle Reanimated
  4.5.1; v3 is not compatible with this RN version. The APIs used here
  (`useSharedValue`, `withSpring`, `useAnimatedProps`, `useAnimatedScrollHandler`)
  are unchanged between the two.
- **`expo-background-task`, not `expo-background-fetch`.** The latter is
  deprecated as of SDK 53 and removed from the SDK 57 module set;
  `expo-task-manager` is still used to define the task, exactly as described.
- **Shared element transitions are measurement-based.** Reanimated 4 still
  exports `sharedTransitionTag`, but it is unreliable on the New Architecture.
  `SharedHero` instead measures the tapped row's on-screen rect, passes it
  through route params, and springs the detail hero from it — visually
  identical, and it cannot silently no-op.
- **Pull-to-refresh differs by platform.** iOS scroll views report negative
  content offsets while rubber-banding, so the custom arc tracks the gesture
  directly. Android reports no such offset, so it uses a tinted
  `RefreshControl` rather than faking a gesture the platform does not expose.
- **Calories are an estimate.** A MET model derived from cadence
  (`kcal/min = MET × 3.5 × kg / 200`), tuned by the weight and stride in
  Settings. Treat it as indicative, not medical.
