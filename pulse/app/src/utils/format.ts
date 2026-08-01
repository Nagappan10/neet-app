/** Display formatting. Keep every numeric string tabular-width stable. */

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "1h 24m" / "24m" / "45s" — for summaries where HH:MM:SS is too heavy. */
export function formatDurationShort(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

const pad = (n: number) => `${n}`.padStart(2, '0');

export function formatSteps(steps: number): string {
  return Math.round(steps).toLocaleString();
}

export function formatDistance(metres: number): string {
  const km = metres / 1000;
  if (km < 10) return km.toFixed(2);
  return km.toFixed(1);
}

export function formatCalories(kcal: number): string {
  return Math.round(kcal).toLocaleString();
}

export function formatPace(stepsPerMinute: number): string {
  return Math.round(stepsPerMinute).toString();
}

export function formatDelta(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

export function clamp(value: number, min = 0, max = 1): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}
