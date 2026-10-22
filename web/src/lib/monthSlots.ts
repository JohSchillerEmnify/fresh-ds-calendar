/**
 * Slot packing of one month week row: a week shares one set of entry rows ("slots"), a multi-day bar takes its slot only
 * on the days it covers, and each day's own entries fill that day's free slots from the top (feature event-display).
 * Pure maths, no DOM.
 */

/** The part of a bar the packing needs: the covered columns (inclusive, 0-based) and its slot. */
export interface SlotBar {
  startCol: number;
  endCol: number;
  lane: number;
}

/** Where one day's entries land. */
export interface DaySlots {
  /** First slot of each entry, in the order given. */
  slots: number[];
  /** Slots each entry takes (a wanted span is cut to the free run it starts in; at least 1). */
  spans: number[];
  /** Slots taken by bars on this day (what the day's entry budget has to subtract). */
  taken: number;
  /** Slots from the top down to the last thing on this day (bar or entry). */
  used: number;
}

/**
 * Assigns the entries of every day of a week row to slots.
 *
 * Entries keep their order: each starts at the first free slot at or after the end of the previous one, so gaps
 * under or between bars fill first, then the rows below.
 *
 * @param bars Bars of the row with their lane.
 * @param wanted Per column, the slots each entry wants (1 for a chip, more for a task list card).
 * @returns One :class:`DaySlots` per column of ``wanted``.
 */
export function packWeek(bars: SlotBar[], wanted: number[][]): DaySlots[] {
  return wanted.map((want, col) => {
    const busy = new Set(bars.filter((b) => b.startCol <= col && col <= b.endCol).map((b) => b.lane));
    const slots: number[] = [], spans: number[] = [];
    let next = 0;
    for (const w of want) {
      // an entry never starts on a bar's slot, and never grows into one
      while (busy.has(next)) next++;
      let run = 1;
      while (run < w && !busy.has(next + run)) run++;
      slots.push(next);
      spans.push(run);
      next += run;
    }
    const lastBar = busy.size ? Math.max(...busy) + 1 : 0;
    return { slots, spans, taken: busy.size, used: Math.max(next, lastBar) };
  });
}
