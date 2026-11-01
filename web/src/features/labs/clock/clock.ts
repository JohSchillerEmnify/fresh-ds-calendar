/**
 * What the 24-hour clock shows of a day (which segments are arcs, which are listed in the middle, their texts) and the
 * pure rules of its gestures (turning an arc, snapping a tap to a time, the focus wedge).
 */
import { addDays, minutesToTime, parseIsoDate, toIsoDate } from '@/lib/dates';
import { displayTitle, neutralName, type Segment } from '@/lib/items';
import { showProgress } from '@/features/tasklists';
import { formatDuration } from '@/features/calendar/timeline';
import { localToIso } from '@/features/calendar/zone';
import { t } from '@/i18n';
import { assignLanes } from './geometry';

/** Step every clock gesture snaps to, in minutes (the time grid's step). */
export const SNAP_MIN = 15;

/**
 * Shortest arc the dial draws, in minutes (its snap step): at 24 hours per turn a shorter one would be a dot, too small
 * to see or tap. The entry's real times never change.
 */
export const MIN_ARC_MIN = SNAP_MIN;

/** A timed entry on the dial: its ring (`lane`, 0 outermost) and the span it is drawn over, in minutes of the day. */
export type ClockArc = Segment & { lane: number; drawStart: number; drawEnd: number };

/**
 * Splits a day's segments: timed events and timed task lists become arcs, untimed task lists the chips below, all-day
 * events (and days inside a multi-day event) the chips above. Each arc is drawn at least {@link MIN_ARC_MIN} and
 * `minMinutes` (the minimum event length setting) long, kept on the day, and entries whose drawn spans overlap go on
 * separate rings; arcs that only touch share a ring (they are drawn with square ends and a gap). `room` is how many
 * minutes of its ring an entry needs from its start (for a name written along the ring), default none.
 */
export function clockSegments(
  segs: Segment[], minMinutes = 0, room: (s: Segment) => number = () => 0,
): { timed: ClockArc[]; untimed: Segment[]; allDay: Segment[] } {
  const timed = segs.filter((s) => !s.allDay && s.startTime && s.endTime).map((s) => {
    const len = Math.max(s.endMin - s.startMin, minMinutes, MIN_ARC_MIN);
    const drawEnd = Math.min(1440, s.startMin + len);
    return { ...s, drawStart: Math.min(s.startMin, drawEnd - len), drawEnd };
  });
  const untimed = segs.filter((s) => s.item.kind === 'tasklist' && !s.startTime);
  const allDay = segs.filter((s) => s.item.kind === 'event' && s.allDay);
  const laned = assignLanes(
    timed.map((s) => ({ s, startMin: s.drawStart, endMin: s.drawEnd })),
    (prev) => Math.max(0, room(prev.s) - (prev.endMin - prev.startMin)),
  );
  return { timed: laned.map(({ s, lane }) => ({ ...s, lane })), untimed, allDay };
}

/**
 * Start minute of an arc turned round the dial by `deltaMin` (the pointer's accumulated turn since pick-up): snapped to
 * {@link SNAP_MIN} and kept on the day, so the whole arc stays between 00:00 and 24:00.
 */
export function turnedStart(startMin: number, endMin: number, deltaMin: number): number {
  const snapped = Math.round((startMin + deltaMin) / SNAP_MIN) * SNAP_MIN;
  return Math.min(Math.max(snapped, 0), Math.max(0, 1440 - (endMin - startMin)));
}

/** The time a tap at minute `m` of the dial means: the nearest {@link SNAP_MIN} step, `HH:MM` (24:00 wraps to 00:00). */
export function tappedTime(m: number): string {
  const snapped = (Math.round(m / SNAP_MIN) * SNAP_MIN) % 1440;
  return `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
}

/**
 * Timed entries that can stand in the middle: timed events and timed task lists, never all-day ones.
 * Today an entry that began the day before counts too (it is running).
 */
const timedEntries = (segs: Segment[]) => segs.filter((s) => !s.allDay && s.startTime !== null);

/**
 * What today's middle names: the running entry (the one ending first when several run), else the next one starting
 * today, else the first one tomorrow (`tomorrow` = tomorrow's segments), else nothing.
 */
export function clockFocus(
  today: Segment[], tomorrow: Segment[], nowMin: number,
): { kind: 'running' | 'next' | 'tomorrow'; seg: Segment } | null {
  const evs = timedEntries(today);
  const cur = evs.filter((s) => s.startMin <= nowMin && nowMin < s.endMin).sort((a, b) => a.endMin - b.endMin || a.startMin - b.startMin)[0];
  if (cur) return { kind: 'running', seg: cur };
  const next = evs.filter((s) => s.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)[0];
  if (next) return { kind: 'next', seg: next };
  // tomorrow only what begins tomorrow: the rest of an entry from today is not tomorrow's first
  const first = timedEntries(tomorrow).filter((s) => s.first).sort((a, b) => a.startMin - b.startMin)[0];
  return first ? { kind: 'tomorrow', seg: first } : null;
}

/**
 * The middle's text: the title over when and how long until ("09:00 · in 1 h", "until 10:00 · 30 min left", "Tomorrow
 * 09:00"), or one line when nothing comes. The second line is never cut, so it carries no title.
 */
export function clockMiddle(
  focus: ReturnType<typeof clockFocus>, nowMs: number, tz: string,
): { title: string; when: string } | { line: string } {
  if (!focus) return { line: t('calendar.now.nothingElse') };
  const { kind, seg } = focus;
  const title = neutralName(seg.item);
  // real minutes between two instants, so a clock change in between counts (wall-clock minutes would not)
  // (from the start of the current minute, like the hand: seconds into it do not count)
  const until = (time: string) => formatDuration((instantOf(seg.date, time, tz) - Math.floor(nowMs / 60000) * 60000) / 60000);
  if (kind === 'running') return { title, when: t('calendar.clock.untilLeft', { end: minutesToTime(seg.endMin % 1440), left: until(seg.endTime!) }) };
  if (kind === 'next') return { title, when: t('calendar.clock.nextAt', { start: seg.startTime!, duration: until(seg.startTime!) }) };
  return { title, when: t('calendar.clock.tomorrowAt', { start: seg.startTime! }) };
}

/** The instant (ms) of wall-clock `time` on `date` in `tz`; "24:00" is the next day's midnight. */
function instantOf(date: string, time: string, tz: string): number {
  if (time === '24:00') return Date.parse(localToIso(toIsoDate(addDays(parseIsoDate(date)!, 1)), '00:00', tz));
  return Date.parse(localToIso(date, time, tz));
}

/**
 * The focus wedge of today's dial (a Time Timer-like sector from the hand): to the end of the running entry, else to the
 * start of the next one today, else none — always what the middle names (tomorrow's entry gets no wedge).
 */
export function focusWedge(
  segs: Segment[], nowMin: number, colorOf: (s: Segment) => string,
): { from: number; to: number; color: string; running: boolean } | null {
  const f = clockFocus(segs, [], nowMin);
  if (!f) return null;
  const running = f.kind === 'running';
  return { from: nowMin, to: running ? f.seg.endMin : f.seg.startMin, color: colorOf(f.seg), running };
}

/** The text a clock entry is named with: the title, for task lists followed by "done/total" (not for a one-item list). */
export function clockText(item: Segment['item']): string {
  return item.kind === 'tasklist' ? (showProgress(item) ? `${neutralName(item)} ${item.doneCount}/${item.totalCount}` : neutralName(item)) : displayTitle(item);
}
