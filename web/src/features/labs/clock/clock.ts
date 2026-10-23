/**
 * What the 24-hour clock shows of a day (which segments are arcs, which are listed in the middle, their texts) and the
 * pure rules of its gestures (turning an arc, snapping a tap to a time, the focus wedge).
 */
import { displayTitle, neutralName, type Segment } from '@/lib/items';
import { assignLanes } from './geometry';

/** Step every clock gesture snaps to, in minutes (the time grid's step). */
export const SNAP_MIN = 15;

/**
 * Shortest arc the dial draws, in minutes (its snap step): at 24 hours per turn a shorter one would be a dot, too small
 * to see or tap (owner, 2026-10-23). The entry's real times never change.
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
 * The focus wedge of today's dial (a Time Timer-like sector from the hand): to the end of the running event, else to the
 * start of the next timed event, else none. Only timed events count, like the Approaching card.
 */
export function focusWedge(segs: Segment[], nowMin: number): { from: number; to: number; color: string; running: boolean } | null {
  const evs = segs.filter((s) => s.item.kind === 'event' && !s.allDay && s.startTime !== null);
  const cur = evs.filter((s) => s.startMin <= nowMin && nowMin < s.endMin).sort((a, b) => a.endMin - b.endMin)[0];
  if (cur) return { from: nowMin, to: cur.endMin, color: cur.item.color, running: true };
  const next = evs.filter((s) => s.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)[0];
  return next ? { from: nowMin, to: next.startMin, color: next.item.color, running: false } : null;
}

/** The text a clock entry is named with: the title, for task lists followed by "done/total". */
export function clockText(item: Segment['item']): string {
  return item.kind === 'tasklist' ? `${neutralName(item)} ${item.doneCount}/${item.totalCount}` : displayTitle(item);
}
