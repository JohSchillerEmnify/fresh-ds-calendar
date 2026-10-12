/** Pure math of the approach bar (Labs): which entries it shows, its time ticks and where the chips sit on the track. */
import type { Segment } from '@/lib/items';

/** How many entries the track shows (ARCHITECTURE "Labs"). */
export const APPROACH_COUNT = 3;
/** Tick steps in minutes, tried from the finest; the first whose labels do not collide wins. */
export const TICK_STEPS = [15, 30, 60, 120, 180] as const;
/** The track never grows beyond this many chip rows (owner: "don't take too much space"). */
export const MAX_ROWS = 2;

export interface ApproachEntries { entries: Segment[]; atEnd: boolean }

/**
 * Up to three timed entries of today (events and task lists with a time) starting within `windowMin` after now, by
 * start. Only entries starting after now, so the current event is never among them. When none is within the window,
 * the next timed entry of today is returned with `atEnd` (it waits at the right end of the track).
 */
export function approachEntries(daySegments: Segment[], nowMin: number, windowMin: number): ApproachEntries {
  const ahead = daySegments
    .filter((s) => !s.allDay && s.startTime !== null && s.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin);
  const within = ahead.filter((s) => s.startMin <= nowMin + windowMin).slice(0, APPROACH_COUNT);
  if (within.length || !ahead.length) return { entries: within, atEnd: false };
  return { entries: [ahead[0]], atEnd: true };
}

export interface ApproachTick { min: number; x: number; label: string }

/**
 * Time labels (HH:MM) at the smallest step of {@link TICK_STEPS} whose labels, `labelPx` wide, do not collide on a
 * track `trackPx` wide spanning `windowMin`. Ticks sit on whole multiples of the step after now; a label that would
 * stick out of the track is left out.
 */
export function approachTicks(nowMin: number, windowMin: number, trackPx: number, labelPx: number): ApproachTick[] {
  if (trackPx <= 0 || windowMin <= 0) return [];
  const pxPerMin = trackPx / windowMin;
  const step = TICK_STEPS.find((s) => s * pxPerMin >= labelPx) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const ticks: ApproachTick[] = [];
  for (let m = Math.floor(nowMin / step) * step + step; m <= nowMin + windowMin; m += step) {
    const x = (m - nowMin) * pxPerMin;
    if (x - labelPx / 2 < 0 || x + labelPx / 2 > trackPx) continue;
    const d = ((m % 1440) + 1440) % 1440;
    ticks.push({ min: m, x, label: `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}` });
  }
  return ticks;
}

export interface ApproachChip { segment: Segment; minutes: number; x: number; width: number; row: number; faded: boolean }

/**
 * Chip positions on a track `trackPx` wide spanning `windowMin`: a chip's left edge is its start time (now at 0).
 * Chips near the end narrow down to `minChipPx` so they stay inside; the waiting entry (`atEnd`) sits at the right
 * end, at most a quarter of the track wide. Overlapping chips take a second row; with both rows taken a chip goes to
 * the row that frees up first, the chip before it is shortened to make room and, if it still overlaps, the new chip
 * is `faded`. Never more than {@link MAX_ROWS} rows.
 */
export function approachLayout(
  entries: Segment[], nowMin: number, windowMin: number, trackPx: number, chipPx: number, minChipPx: number, atEnd = false,
): { chips: ApproachChip[]; rows: number } {
  const track = Math.max(0, trackPx);
  const last: ApproachChip[] = [];
  const chips = entries.map((segment) => {
    const minutes = segment.startMin - nowMin;
    let width: number, x: number;
    if (atEnd) {
      width = Math.min(chipPx, track / 4);
      x = track - width;
    } else {
      const raw = windowMin > 0 ? Math.min(1, minutes / windowMin) * track : 0;
      width = Math.min(chipPx, Math.max(minChipPx, track - raw), track);
      x = Math.max(0, Math.min(raw, track - width));
    }
    const chip: ApproachChip = { segment, minutes, x, width, row: 0, faded: false };
    // first row whose last chip ends before this one starts, else a new row, else the row that frees up first
    let row = last.findIndex((c) => c.x + c.width <= x);
    if (row < 0 && last.length < MAX_ROWS) row = last.length;
    if (row < 0) {
      row = last[0].x + last[0].width <= last[1].x + last[1].width ? 0 : 1;
      const prev = last[row];
      prev.width = Math.max(minChipPx, x - prev.x);
      chip.faded = prev.x + prev.width > x;
    }
    chip.row = row;
    last[row] = chip;
    return chip;
  });
  return { chips, rows: Math.max(1, last.length) };
}
