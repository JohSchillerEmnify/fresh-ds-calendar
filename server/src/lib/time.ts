/**
 * Time zone helpers built on Intl only (no date library). All "local" values are wall-clock values in a named IANA
 * zone (default Europe/Berlin). DST-safe: offsets are looked up per instant.
 */

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** RFC 3339 date-time with mandatory offset or Z. */
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,9})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i;

const DAY_MS = 86_400_000;

export function isLocalDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(s);
  if (!m) return false;
  const y = +m[1]!, mo = +m[2]!, d = +m[3]!;
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function isLocalTime(s: unknown): s is string {
  return typeof s === 'string' && LOCAL_TIME_RE.test(s);
}

export function isDateTime(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = DATETIME_RE.exec(s);
  if (!m) return false;
  return isLocalDate(`${m[1]}-${m[2]}-${m[3]}`) && !Number.isNaN(Date.parse(s));
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Days since 1970-01-01 for a local date (pure calendar arithmetic, zone independent). */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(dayNumber(date) + days);
}

/** b - a in calendar days. */
export function diffDays(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

export function addMonthsClamp(date: string, months: number): { date: string; exact: boolean } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dim = daysInMonth(ny, nm);
  const exact = d <= dim;
  return { date: `${pad(ny, 4)}-${pad(nm)}-${pad(Math.min(d, dim))}`, exact };
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(ms: number, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** Offset of the zone from UTC at the instant, in minutes (Berlin summer: +120). */
export function offsetMinutes(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const floored = Math.floor(ms / 1000) * 1000;
  return Math.round((asUtc - floored) / 60_000);
}

/**
 * Instant (ms) of a local wall-clock time. Ambiguous times (DST fall-back) resolve to the first occurrence;
 * non-existent times (spring-forward gap) are shifted forward by the gap, like Google does.
 */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Candidate offsets around the instant; pick the earliest instant whose local wall time matches.
  const o1 = offsetMinutes(wall - 86_400_000 / 2, tz);
  const o2 = offsetMinutes(wall + 86_400_000 / 2, tz);
  const candidates = [...new Set([o1, o2])].map((o) => wall - o * 60_000).sort((a, b) => a - b);
  for (const c of candidates) {
    if (offsetMinutes(c, tz) * 60_000 + c === wall) return c;
  }
  // Gap: use the offset before the transition (moves the wall time forward).
  return wall - Math.min(o1, o2) * 60_000;
}

/** Local midnight instant of a date. */
export function startOfLocalDay(date: string, tz: string): number {
  return zonedToUtc(date, '00:00', tz);
}

export function localDateOf(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

export function localTimeOf(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** RFC 3339 in the zone's offset, seconds precision: 2026-10-14T09:00:00+02:00 */
export function formatInZone(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  const off = offsetMinutes(ms, tz);
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
