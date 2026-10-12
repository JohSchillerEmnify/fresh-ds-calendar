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
  /** Never fewer lines than this (item rows, including the "+k" line). Default 2. */
  minLines?: number;
  maxLines?: number;
}
export interface Fit {
  /** Item names shown, in order. */
  shown: number;
  /** Items hidden behind the "+k" line (0 = no such line). */
  more: number;
  /** Less than one row of room: names run inline next to the title instead. */
  inline: boolean;
}

/** Degradation ladder: all names one per line -> as many as fit plus "+k" -> at least `minLines` lines -> inline next to the title. */
export function fitItems(i: FitInput): Fit {
  if (i.count <= 0) return { shown: 0, more: 0, inline: false };
  const maxLines = i.maxLines ?? i.count;
  const minLines = i.minLines ?? 2;
  let lines = i.height === undefined ? maxLines : Math.floor((i.height - i.titleH - i.pad - (i.footH ?? 0)) / i.rowH);
  // A block of at least 34 px always gets one row (titleH + one row + padding fits by design).
  if (i.height !== undefined && i.height >= 34) lines = Math.max(lines, 1);
  if (minLines === 0 && lines < 1) return { shown: i.count, more: 0, inline: true };
  lines = Math.min(maxLines, Math.max(lines, minLines, 1));
  if (lines >= i.count) return { shown: i.count, more: 0, inline: false };
  const shown = Math.max(1, lines - 1);
  return { shown, more: i.count - shown, inline: false };
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

export interface RowStep { scale: number; opacity: number }
/** Min legible values: font never below 8 px (callers clamp), opacity never below 0.5. */
export const MIN_SCALE = 0.7, MIN_OPACITY = 0.5;
/**
 * Fade/shrink step for visible row `index` (0 = first open item; the "+k" line uses index `shown`).
 * Only applies when the list is truncated (`more > 0`); otherwise every row is 1 / 1.
 */
export function rowStep(index: number, more: number): RowStep {
  if (more <= 0 || index <= 0) return { scale: 1, opacity: 1 };
  return { scale: Math.max(MIN_SCALE, 1 - 0.15 * index), opacity: Math.max(MIN_OPACITY, 1 - 0.15 * index) };
}
