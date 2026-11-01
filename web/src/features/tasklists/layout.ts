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

/** The height of an item row on a card with ink. */
const INK_ROW_PX = 24;

/** Timed blocks shorter than this (about an hour or less) show the open items inline after the title, no footer row. */
export const INLINE_BELOW_PX = 62;

/** What the collapsed (or grown) task list card knows about its host and its list, for {@link cardLayout}. */
export interface CardLayoutInput {
  /** Host variant: `block` (time grid), `allday` (band), `card` (month cell), `chip`. */
  variant: string;
  /** The expanded card (`ExpandedCard`): every item, nothing cut. */
  grown: boolean;
  /** Section mode "titles only" on an all-day band card: no item rows. */
  titles: boolean;
  /** Narrow card (mini tier, 9 px rows). */
  mini: boolean;
  /** Pixels available to the card; 0 or undefined = not measured. */
  height?: number;
  /** The list has a start time (a time foot can show). */
  timed: boolean;
  /** The list has a title (no lead needed). */
  titled: boolean;
  /** Open (not ticked) items, the ones the overview shows. */
  open: number;
  /** All items, ticked ones included (the grown card shows them all). */
  total: number;
  /** The list has an ink item: every row is as tall as the ink line (about 24 px; decision M3). */
  inked?: boolean;
}

/** Result of {@link cardLayout}: the item fit plus the rows around it. */
export interface CardLayout extends Fit {
  /** A timed block too short for a second row: no time line, names inline (or rows on a mini card). */
  shortBlock: boolean;
  /** The time foot row shows. */
  foot: boolean;
  /** Titleless and no item text below: the first item stands in the title slot. */
  lead: boolean;
}

/**
 * The one place that decides how a task list card uses its room: how many open item names show, whether they run
 * inline next to the title, whether the time foot shows, and whether a titleless list shows its first item as the lead.
 * Mini cards are too narrow for inline names (rows below the title instead); the lead only appears when no item renders
 * below, so nothing is shown twice.
 */
export function cardLayout(i: CardLayoutInput): CardLayout {
  const block = i.variant === 'block';
  // a block too short for a second row drops the time line, also when no open item is left to go inline
  const shortBlock = !i.grown && block && !!i.height && i.height < INLINE_BELOW_PX;
  // a list with one item and no title shows that item in the title slot, never a second time below it
  const single = !i.grown && !i.titled && i.total === 1;
  const fit = ((): Fit => {
    if (i.titles || !i.open || single) return { shown: 0, more: 0, inline: false };
    // grown: every item, one per line, nothing cut
    if (i.grown) return { shown: i.total, more: 0, inline: false };
    const f = fitItems({
      count: i.open,
      height: i.height || undefined,
      titleH: i.mini ? 15 : 17,
      rowH: i.inked ? INK_ROW_PX : i.mini ? 11 : 14,
      pad: block ? 6 : 5,
      footH: block && i.timed && !i.mini ? 14 : 0,
      minLines: block ? 0 : 1,
    });
    // mini cards are too narrow for inline names: rows below the title
    if (i.mini && (f.inline || shortBlock)) {
      const shown = f.inline ? 0 : f.shown;
      return { shown, more: i.open - shown, inline: false };
    }
    // inline names run on in one line and fade out at the right edge, so every open one is shown
    if (f.inline || shortBlock) return { shown: i.open, more: 0, inline: true };
    return f;
  })();
  const lead = !i.grown && !i.titled && (single || i.variant === 'chip' || i.titles || fit.shown === 0);
  return { ...fit, shortBlock, foot: i.timed && !fit.inline && !shortBlock, lead };
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

/** Month cell metrics in px, per tier: day number row, cell padding, one slot (chip height + the 2 px gap between entries; bars sit in slots), one event chip (the smallest entry). */
export const CELL_METRICS = {
  phone: { num: 20, pad: 1, lane: 18, chip: 16 },
  wide: { num: 28, pad: 8, lane: 20, chip: 18 },
} as const;

/**
 * How many multi-day bar lanes a month cell can reserve while still leaving room for one entry row below them.
 * Without the cap a tall week of bars (or a short phone grid) leaves the entries zero height and the cell looks empty.
 * At least one lane is always kept (all-day bars must show even when no entry fits beside them).
 * An unmeasured grid (`cellH` <= 0) is uncapped.
 */
export function maxLanes(cellH: number, phone: boolean): number {
  if (!(cellH > 0)) return Infinity;
  const m = phone ? CELL_METRICS.phone : CELL_METRICS.wide;
  return Math.max(1, Math.floor((cellH - m.num - m.pad - 2 - m.chip) / m.lane));
}

/**
 * Height of a month cell's entries box: the cell minus the day number, the cell's padding, its gap below the number and
 * its bottom border (1 + 1 px on phones, 3 + 1 px wider). An entry starting at or below it is completely hidden.
 * The wide tier always has the wider padding and gap: phones are `max-width: 767.98px` and the cell CSS switches at
 * `min-width: 768px`, so only a fractional width between the two (browser zoom) mixes the tiers: the box is then 7 px
 * taller than computed here (wide number, narrow padding and gap) and the top 7 px of a next entry would be left out.
 * An unmeasured grid (`cellH` <= 0) has unlimited room.
 *
 * @param cellH Height of one week row in px.
 * @param phone Whether the phone tier applies.
 * @returns The box height in px, or ``Infinity`` while unmeasured.
 */
export function entriesRoom(cellH: number, phone: boolean): number {
  if (!(cellH > 0)) return Infinity;
  const m = phone ? CELL_METRICS.phone : CELL_METRICS.wide;
  return cellH - m.num - m.pad - (phone ? 2 : 4);
}
