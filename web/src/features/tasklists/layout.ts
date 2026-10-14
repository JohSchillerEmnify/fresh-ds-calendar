/** Pure layout maths for the collapsed task list card: how many item names fit, and how a cell shares its height. */

export interface FitInput {
  count: number;
  /** Pixels available to the whole card; undefined = not measured (use `maxLines`). */
  height?: number;
  titleH: number;
  rowH: number;
  /** Vertical padding of the card. */
  pad: number;
  /** Footer row (time, estimate, carried label) when it is visible. */
  footH?: number;
  /** Never fewer lines than this (item rows). Default 1. */
  minLines?: number;
  maxLines?: number;
}
export interface Fit {
  /** Item names shown, in order. */
  shown: number;
  /** Items that do not fit: the list fades out at the bottom (0 = nothing cut off). */
  more: number;
  /** Less than one row of room: names run inline next to the title instead. */
  inline: boolean;
}

/** Degradation ladder: all names one per line -> as many as fit (the rest fades out) -> at least `minLines` lines -> inline next to the title. */
export function fitItems(i: FitInput): Fit {
  if (i.count <= 0) return { shown: 0, more: 0, inline: false };
  const maxLines = i.maxLines ?? i.count;
  const minLines = i.minLines ?? 1;
  let lines = i.height === undefined ? maxLines : Math.floor((i.height - i.titleH - i.pad - (i.footH ?? 0)) / i.rowH);
  // A block of at least 34 px always gets one row (titleH + one row + padding fits by design).
  if (i.height !== undefined && i.height >= 34) lines = Math.max(lines, 1);
  if (minLines === 0 && lines < 1) return { shown: i.count, more: 0, inline: true };
  lines = Math.min(maxLines, Math.max(lines, minLines, 1));
  if (lines >= i.count) return { shown: i.count, more: 0, inline: false };
  return { shown: lines, more: i.count - lines, inline: false };
}

/**
 * Splits `avail` px between entries: nobody gets more than they need, the leftovers go to the hungry ones (water filling),
 * nobody gets less than `min`.
 */
export function allotHeights(needs: number[], avail: number, min: number): number[] {
  const out = needs.map(() => min);
  let left = avail - min * needs.length;
  let open = needs.map((_, n) => n).filter((n) => needs[n] > min);
  while (left > 0.5 && open.length) {
    const share = left / open.length;
    const next: number[] = [];
    for (const n of open) {
      const give = Math.min(share, needs[n] - out[n]);
      out[n] += give;
      left -= give;
      if (needs[n] - out[n] > 0.5) next.push(n);
    }
    if (next.length === open.length && left < 0.5) break;
    open = next;
  }
  return out.map((v) => Math.floor(v));
}

/** Month cell metrics in px, per tier: day number row, cell padding, one bar lane, one event chip (the smallest entry). */
export const CELL_METRICS = {
  phone: { num: 26, pad: 2, lane: 18, chip: 16 },
  wide: { num: 28, pad: 8, lane: 22, chip: 18 },
} as const;

/**
 * How many multi-day bar lanes a month cell can reserve while still leaving room for one entry row below them.
 * Without the cap a tall week of bars (or a short phone grid) leaves the entries zero height and the cell looks empty.
 * An unmeasured grid (`cellH` <= 0) is uncapped.
 */
export function maxLanes(cellH: number, phone: boolean): number {
  if (!(cellH > 0)) return Infinity;
  const m = phone ? CELL_METRICS.phone : CELL_METRICS.wide;
  return Math.max(0, Math.floor((cellH - m.num - m.pad - 2 - m.chip) / m.lane));
}
