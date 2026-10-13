/**
 * Calendar logic of the holiday themes (ARCHITECTURE "Holiday themes and Seasons & holidays"): Easter, the Advent
 * Sundays, the Advent candles and the tree lights, and which holiday (if any) a date falls in. Pure functions on
 * `YYYY-MM-DD` strings, no DOM and no clock.
 */

export type Holiday = 'New Year\'s Eve' | 'New Year' | 'Christmas' | 'Easter';

/** Adds whole days to a `YYYY-MM-DD` date (UTC arithmetic, so no daylight-saving drift). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Easter Sunday of a year by the anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The 1st Advent Sunday of a year: three weeks before the Sunday on or before 24 December (the 4th Advent). */
export function firstAdvent(year: number): string {
  const christmasEve = `${year}-12-24`;
  const weekday = new Date(`${christmasEve}T00:00:00Z`).getUTCDay();
  return addDays(christmasEve, -weekday - 21);
}

/** The Advent candles and the tree on a date: lit candles (1..4) and whether the tree lights are on. */
export interface ChristmasState { candles: 1 | 2 | 3 | 4; lights: boolean }

/**
 * What the Christmas scene shows on a date. During Advent (1st Advent to 23 December) the candles are lit one per
 * Advent Sunday and the tree is dark; on every other date, 24-30 December and a hand-picked Christmas scene included,
 * all four candles burn and the tree lights are on.
 */
export function christmasState(date: string): ChristmasState {
  const year = Number(date.slice(0, 4));
  const start = firstAdvent(year);
  if (date >= start && date <= `${year}-12-23`) {
    return { candles: (1 + Math.floor(daysBetween(start, date) / 7)) as ChristmasState['candles'], lights: false };
  }
  return { candles: 4, lights: true };
}

/** The holiday a date falls in, in the priority of the calendar, or null. */
export function holidayOf(date: string): Holiday | null {
  const year = Number(date.slice(0, 4));
  const md = date.slice(5);
  if (md === '12-31') return 'New Year\'s Eve';
  if (md === '01-01') return 'New Year';
  if (date >= firstAdvent(year) && date <= `${year}-12-30`) return 'Christmas';
  const easter = easterSunday(year);
  if (date >= addDays(easter, -7) && date <= addDays(easter, 6)) return 'Easter';
  return null;
}
