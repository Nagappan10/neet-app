import type { DayKey } from '@/types';

/**
 * Everything in Pulse keys off local calendar days, never UTC — a walk at
 * 11pm belongs to the day the user experienced, not the day in Greenwich.
 */

export function toDayKey(date: Date | number = new Date()): DayKey {
  const d = typeof date === 'number' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(day: DayKey, delta: number): DayKey {
  const d = fromDayKey(day);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/** Monday of the week containing `day` — Pulse weeks run Mon→Sun. */
export function startOfWeek(day: DayKey = toDayKey()): DayKey {
  const d = fromDayKey(day);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return toDayKey(d);
}

export function weekDays(start: DayKey = startOfWeek()): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function startOfMonth(day: DayKey = toDayKey()): DayKey {
  return `${day.slice(0, 7)}-01`;
}

export function endOfMonth(day: DayKey = toDayKey()): DayKey {
  const d = fromDayKey(startOfMonth(day));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toDayKey(d);
}

export function addMonths(month: string, delta: number): string {
  const d = new Date(`${month}-01T00:00:00`);
  d.setMonth(d.getMonth() + delta);
  return toDayKey(d).slice(0, 7);
}

export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function weekdayLabel(day: DayKey): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][fromDayKey(day).getDay()]!;
}

export function isToday(day: DayKey): boolean {
  return day === toDayKey();
}

export function isFuture(day: DayKey): boolean {
  return day > toDayKey();
}

/** "Today" / "Yesterday" / "Mon 14 Jul" */
export function friendlyDate(day: DayKey): string {
  const today = toDayKey();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const d = fromDayKey(day);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** Bounds of a local day as epoch ms, for pedometer range queries. */
export function dayBounds(day: DayKey): { start: Date; end: Date } {
  const start = fromDayKey(day);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
