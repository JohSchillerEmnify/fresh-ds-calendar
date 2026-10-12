/**
 * Date/time helpers. Step values are Europe/Berlin wall-clock values; the test runner itself may run in UTC,
 * so every conversion goes through Intl with an explicit time zone (no reliance on the process TZ).
 */
export const TIME_ZONE = 'Europe/Berlin';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Parse 'YYYY-MM-DD' into UTC midnight epoch ms (calendar arithmetic only). */
function dateToUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, days: number): string {
  return utcMsToDate(dateToUtcMs(date) + days * 86_400_000);
}

/** Inclusive list of dates from `from` to `to`. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Minutes since local midnight; '24:00' = 1440. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Offset (minutes east of UTC) of Europe/Berlin at the given instant. */
function zoneOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60_000);
}

/** Epoch ms of a Berlin wall-clock date + time ('24:00' = next day 00:00). */
export function berlinToEpoch(date: string, time: string): number {
  const naive = dateToUtcMs(date) + minutesOf(time) * 60_000;
  // Two iterations settle the offset around DST transitions.
  let guess = naive - zoneOffsetMinutes(naive) * 60_000;
  guess = naive - zoneOffsetMinutes(guess) * 60_000;
  return guess;
}

/** RFC 3339 with the Berlin offset, e.g. '2026-10-14T09:00:00+02:00'. */
export function berlinIso(date: string, time: string): string {
  const epoch = berlinToEpoch(date, time);
  const off = zoneOffsetMinutes(epoch);
  const local = new Date(epoch + off * 60_000);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Same instant? (tolerates different offsets / 'Z'). */
export function sameInstant(a: string | undefined, b: string): boolean {
  return a !== undefined && Date.parse(a) === Date.parse(b);
}

export function weekdayOffset(name: Weekday): number {
  return WEEKDAYS.indexOf(name);
}
