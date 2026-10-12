/** Pure math of the approach bar (Labs): which entries it shows and where their chips sit on the track. */
import type { Segment } from '@/lib/items';

/** How many entries the track shows (ARCHITECTURE "Labs"). */
export const APPROACH_COUNT = 3;

/**
 * The next timed entries of today (events and task lists with a time), by start. Only entries starting after now, so
 * the current event (start <= now) is never among them.
 */
export function approachEntries(daySegments: Segment[], nowMin: number): Segment[] {
  return daySegments
    .filter((s) => !s.allDay && s.startTime !== null && s.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin)
    .slice(0, APPROACH_COUNT);
}

export interface ApproachChip { segment: Segment; minutes: number; x: number; row: number }

/**
 * Chip positions on a track `trackPx` wide: now at 0, the last entry's start at the right end (minus one chip width so
 * it stays inside). Chips that would overlap go to the next free row, so every title stays readable.
 */
export function approachLayout(entries: Segment[], nowMin: number, trackPx: number, chipPx: number): { chips: ApproachChip[]; rows: number } {
  const span = entries.length ? entries[entries.length - 1].startMin - nowMin : 0;
  const room = Math.max(0, trackPx - chipPx);
  const rowEnds: number[] = [];
  const chips = entries.map((segment) => {
    const minutes = segment.startMin - nowMin;
    const x = span > 0 ? (minutes / span) * room : 0;
    // first row whose last chip ends before this one starts
    let row = rowEnds.findIndex((end) => end <= x);
    if (row < 0) row = rowEnds.length;
    rowEnds[row] = x + chipPx;
    return { segment, minutes, x, row };
  });
  return { chips, rows: Math.max(1, rowEnds.length) };
}
