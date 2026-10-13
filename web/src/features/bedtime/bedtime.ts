/**
 * Bedtime mode, pure part (ARCHITECTURE "Bedtime mode"): turns the person's bedtime preference and the items of the
 * calendar into night windows. Every view's overlay and the reminder read the windows from here; nothing else
 * re-implements the rule.
 *
 * Times are wall-clock minutes since 1970-01-01 00:00 ("absolute" below), the same wall-clock model the segments use, so a
 * night over midnight is one window and clock changes do not matter.
 */
import type { BedtimePrefs } from '@/api/types';
import type { Segment } from '@/lib/items';

/** The preference of a person who never touched the settings: bedtime mode is off. */
export const DEFAULT_BEDTIME: BedtimePrefs = {
  enabled: false, mode: 'fixed', bedtime: '23:00', wake: '07:00', weekendDifferent: false, weekendBedtime: '00:00', weekendWake: '09:00',
  sleepMinutes: 480, leadMinutes: 60, reminderMinutes: 30,
};

/** Anything that answers "the segments of a date" (the items store's `byDate` map, or a filtered view of it). */
export interface SegmentSource { get(date: string): readonly Segment[] | undefined }

/** One night: from going to bed to waking up. */
export interface BedtimeWindow {
  /** The day the night ends on (the night is named by it). */
  wakeDate: string;
  /** Absolute wall-clock minute of going to bed. */
  start: number;
  /** Absolute wall-clock minute of waking up. */
  end: number;
  /** Bedtime as `YYYY-MM-DD HH:MM`. */
  from: string;
  /** Wake-up as `YYYY-MM-DD HH:MM`. */
  to: string;
  /** `dynamic` when the first appointment moved the times, else `fixed`. */
  mode: 'fixed' | 'dynamic';
}

/** The part of a night that lies on one day, in minutes of that day (`endMin` 1440 = end of day). */
export interface DayPiece {
  startMin: number;
  endMin: number;
  /** The night really starts here (show the moon). */
  startsHere: boolean;
  /** The night really ends here (show the sun). */
  endsHere: boolean;
}

const DAY = 1440;

/** Day number of an ISO date (days since 1970-01-01). */
function dayNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** ISO date of a day number. */
function isoOf(dn: number): string {
  return new Date(dn * 86_400_000).toISOString().slice(0, 10);
}

/** Minutes of day of an `HH:MM` text. */
function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/** `YYYY-MM-DD HH:MM` of an absolute minute. */
function stamp(abs: number): string {
  const dn = Math.floor(abs / DAY);
  const m = abs - dn * DAY;
  return `${isoOf(dn)} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * First timed item that starts on a date: events and timed task lists, never all-day events, untimed or carried-over
 * lists, or the continuation days of a multi-day event.
 *
 * @param items Where to read the day's segments.
 * @param date The day (ISO).
 * @returns Its start in minutes of the day, or null when the day has no timed item.
 */
export function firstTimedStart(items: SegmentSource, date: string): number | null {
  let first: number | null = null;
  for (const s of items.get(date) ?? []) {
    if (s.allDay || s.startTime === null || !s.first) continue;
    if (first === null || s.startMin < first) first = s.startMin;
  }
  return first;
}

/**
 * The night that ends on a wake-up day.
 *
 * @param wakeDate The day the night ends on (ISO).
 * @param prefs The bedtime preference.
 * @param items Source of the items for the dynamic rule.
 * @returns The window, or null when bedtime and wake-up are the same time.
 */
function nightEndingOn(wakeDate: string, prefs: BedtimePrefs, items: SegmentSource): BedtimeWindow | null {
  const dn = dayNum(wakeDate);
  // the nights before Saturday and Sunday (wake-up on those days) use the weekend pair
  const weekday = (dn + 4) % 7;
  const weekend = prefs.weekendDifferent && (weekday === 6 || weekday === 0);
  const bed = minutesOf(weekend ? prefs.weekendBedtime : prefs.bedtime);
  const wake = minutesOf(weekend ? prefs.weekendWake : prefs.wake);
  const length = (((wake - bed) % DAY) + DAY) % DAY;
  if (length === 0) return null;
  let end = dn * DAY + wake;
  let start = end - length;
  let mode: BedtimeWindow['mode'] = 'fixed';
  if (prefs.mode === 'dynamic') {
    const appt = firstTimedStart(items, wakeDate);
    if (appt !== null) {
      const dynEnd = dn * DAY + appt - prefs.leadMinutes;
      const dynStart = dynEnd - prefs.sleepMinutes;
      // never later than the fixed bedtime: then the whole fixed pair applies
      if (dynStart < start) { start = dynStart; end = dynEnd; mode = 'dynamic'; }
    }
  }
  return { wakeDate, start, end, from: stamp(start), to: stamp(end), mode };
}

/**
 * The night windows that touch a range of days.
 *
 * @param range The shown days: `from` (inclusive) to `to` (exclusive), ISO dates.
 * @param prefs The bedtime preference; a switched-off one gives no windows.
 * @param items Source of the items (first appointment of the next day in dynamic mode).
 * @returns The windows in time order, including the night that ends on `to` when it begins inside the range.
 */
export function bedtimeWindows(range: { from: string; to: string }, prefs: BedtimePrefs, items: SegmentSource): BedtimeWindow[] {
  if (!prefs.enabled) return [];
  const lo = dayNum(range.from) * DAY;
  const hi = dayNum(range.to) * DAY;
  const out: BedtimeWindow[] = [];
  for (let dn = dayNum(range.from); dn <= dayNum(range.to); dn++) {
    const w = nightEndingOn(isoOf(dn), prefs, items);
    if (w && w.end > lo && w.start < hi) out.push(w);
  }
  return out;
}

/**
 * The part of a night on one day.
 *
 * @param w The night.
 * @param date The day (ISO).
 * @returns The piece, or null when the night does not touch the day.
 */
export function clipToDay(w: BedtimeWindow, date: string): DayPiece | null {
  const ds = dayNum(date) * DAY;
  const s = Math.max(w.start, ds);
  const e = Math.min(w.end, ds + DAY);
  if (e <= s) return null;
  return { startMin: s - ds, endMin: e - ds, startsHere: w.start >= ds, endsHere: w.end <= ds + DAY };
}

/** `HH:MM` of a minute of the day, `24:00` for the end of the day. */
export function pieceTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * The first night that has not started yet, or the one in progress: what the reminder is about.
 *
 * @param windows Windows around now.
 * @param nowAbs Absolute wall-clock minute of now.
 * @returns The first window whose end is after now, or null.
 */
export function tonight(windows: readonly BedtimeWindow[], nowAbs: number): BedtimeWindow | null {
  return windows.find((w) => w.end > nowAbs) ?? null;
}

/**
 * Absolute wall-clock minute of a date and minute of day.
 *
 * @param date ISO date.
 * @param minutes Minutes since midnight.
 */
export function absMinutes(date: string, minutes: number): number {
  return dayNum(date) * DAY + minutes;
}

/** The part of a night that lies inside a track that starts now, as fractions of the track (0 = now, 1 = its end). */
export interface TrackBand {
  window: BedtimeWindow;
  left: number;
  width: number;
  /** Bedtime itself is on the track (show the moon). */
  moon: boolean;
  /** Wake-up itself is on the track (show the sun). */
  sun: boolean;
}

/**
 * Night windows as stretches of a track that shows `windowMin` minutes from now (the Approaching track).
 *
 * @param windows Windows around now.
 * @param nowAbs Absolute wall-clock minute of now (the track's left end).
 * @param windowMin Length of the track in minutes.
 * @returns One band per night that overlaps the track.
 */
export function trackBands(windows: readonly BedtimeWindow[], nowAbs: number, windowMin: number): TrackBand[] {
  const out: TrackBand[] = [];
  for (const w of windows) {
    const s = Math.max(w.start, nowAbs);
    const e = Math.min(w.end, nowAbs + windowMin);
    if (e <= s) continue;
    out.push({ window: w, left: (s - nowAbs) / windowMin, width: (e - s) / windowMin, moon: w.start >= nowAbs && w.start <= nowAbs + windowMin, sun: w.end >= nowAbs && w.end <= nowAbs + windowMin });
  }
  return out;
}
