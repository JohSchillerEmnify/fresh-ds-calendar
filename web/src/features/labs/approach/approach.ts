/** Pure math of the approach bar (Labs): which entries it shows, its time ticks and where the chips sit on the track. */
import { taskListSpan, type Segment } from '@/lib/items';

/** Tick steps in minutes, tried from the finest; the first whose labels do not collide wins. */
const TICK_STEPS = [15, 30, 60, 120, 180] as const;
/** The track never grows beyond this many chip rows ("don't take too much space"). */
const MAX_ROWS = 2;

export interface ApproachEntries { entries: Segment[]; atEnd: boolean }

/**
 * All timed entries of today (events and task lists with a time, not carried-over ones) starting within `windowMin` after now, by start
 * (not only the next three). Entries already running stay (they slide out to the left). When none is within the window, the next timed entry of today is returned with `atEnd` (it waits at the right end
 * of the track).
 */
export function approachEntries(daySegments: Segment[], nowMin: number, windowMin: number): ApproachEntries {
  // a carried-over list is untimed today, so it never sits on the track
  const timed = daySegments.filter((s) => !s.carriedFrom).flatMap(timedToday).sort((a, b) => a.startMin - b.startMin);
  const ahead = timed.filter((s) => s.startMin > nowMin);
  const within = timed.filter((s) => s.endMin > nowMin && s.startMin <= nowMin + windowMin);
  if (within.length || !ahead.length) return { entries: within, atEnd: false };
  return { entries: [ahead[0]], atEnd: true };
}

/**
 * The segment as it sits on the track, or none when it has no time today. A carried-over task list renders untimed on
 * today but keeps its time, so on the track it sits at that time, as long as a timed task list lasts.
 */
export function timedToday(s: Segment): Segment[] {
  if (s.allDay) return [];
  if (s.startTime !== null) return [s];
  if (!s.carriedFrom || s.item.kind !== 'tasklist' || !s.item.time) return [];
  return [{ ...s, startTime: s.item.time, ...taskListSpan(s.item.time, s.item.estimateMinutes) }];
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

export interface ApproachChip {
  segment: Segment;
  minutes: number;
  /** Already started: the block starts at now and shows only the time left. */
  running: boolean;
  /** Left edge of the block (now at 0). */
  x: number;
  /** Block width: the entry's duration on the track's scale. */
  width: number;
  row: number;
  faded: boolean;
  /** The title does not fit in the block and sits right after it, `titleWidth` wide. */
  titleOutside: boolean;
  titleWidth: number;
  /** Width of the block not covered by a later chip on its row: a title inside the block is clipped to it. */
  visibleWidth: number;
}

export interface ApproachSizes {
  /** Room the title needs inside a block (text plus the chip's padding). */
  titlePx: (segment: Segment) => number;
  /** Width of the waiting entry at the end of the track (at most a quarter of the track). */
  endChipPx: number;
  /** Smallest block width. */
  minBlockPx: number;
  /** Space between a block and its title outside. */
  gapPx: number;
  /** Below this much room after the block the title stays inside (clipped) instead. */
  minTitlePx: number;
}

/** Right edge of what a chip takes on its row: the block, plus the title when it sits outside. */
const chipEnd = (c: ApproachChip, gapPx: number) => c.x + c.width + (c.titleOutside && c.titleWidth > 0 ? gapPx + c.titleWidth : 0);

/**
 * Block positions on a track `trackPx` wide spanning `windowMin`: a block's left edge is its start time (now at 0) and
 * its width is its duration on the same scale (a running entry starts at now with the time it has left; at least `minBlockPx`, clipped at the track end). The title sits inside
 * when it fits, else right after the block (shortened to the room left on the track). The waiting entry (`atEnd`) is a
 * chip at the right end, at most a quarter of the track wide, title inside. Overlapping chips (block and outside title)
 * take a second row; with both rows taken a chip goes to the row that frees up first, the title of the chip before it
 * is shortened to make room and, if it still overlaps, the new chip is `faded`; a block a later chip covers shows its title only in the part left (`visibleWidth`). Never more than {@link MAX_ROWS} rows.
 */
export function approachLayout(
  entries: Segment[], nowMin: number, windowMin: number, trackPx: number, sizes: ApproachSizes, atEnd = false,
): { chips: ApproachChip[]; rows: number } {
  const track = Math.max(0, trackPx);
  const pxPerMin = windowMin > 0 ? track / windowMin : 0;
  const { gapPx } = sizes;
  const last: ApproachChip[] = [];
  const chips = entries.map((segment) => {
    const minutes = segment.startMin - nowMin;
    let width: number, x: number, titleOutside = false, titleWidth = 0;
    if (atEnd) {
      width = Math.min(sizes.endChipPx, track / 4);
      x = track - width;
    } else {
      const raw = Math.min(Math.max(0, minutes), windowMin) * pxPerMin;
      // a running entry shows only the time it has left
      const duration = Math.max(0, segment.endMin - Math.max(segment.startMin, nowMin)) * pxPerMin;
      width = Math.min(Math.max(sizes.minBlockPx, Math.min(duration, track - raw)), track);
      x = Math.max(0, Math.min(raw, track - width));
      const need = sizes.titlePx(segment);
      const room = track - (x + width + gapPx);
      if (need > width && room >= sizes.minTitlePx) {
        titleOutside = true;
        titleWidth = Math.min(need, room);
      }
    }
    const chip: ApproachChip = { segment, minutes, running: !atEnd && minutes <= 0, x, width, row: 0, faded: false, titleOutside, titleWidth, visibleWidth: width };
    // first row whose last chip ends before this one starts, else a new row, else the row that frees up first
    let row = last.findIndex((c) => chipEnd(c, gapPx) <= x);
    if (row < 0 && last.length < MAX_ROWS) row = last.length;
    if (row < 0) {
      row = chipEnd(last[0], gapPx) <= chipEnd(last[1], gapPx) ? 0 : 1;
      const prev = last[row];
      // a block keeps its duration; only an outside title gives way
      if (prev.titleOutside) prev.titleWidth = Math.max(0, x - gapPx - (prev.x + prev.width));
      chip.faded = chipEnd(prev, gapPx) > x;
    }
    chip.row = row;
    last[row] = chip;
    return chip;
  });
  // later chips paint over earlier ones, so an earlier block only shows up to the next start on its row
  chips.forEach((c, i) => {
    const next = chips.slice(i + 1).find((o) => o.row === c.row && o.x < c.x + c.width);
    if (next) c.visibleWidth = Math.max(0, next.x - c.x);
  });
  return { chips, rows: Math.max(1, last.length) };
}
