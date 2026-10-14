/** Pure placement maths for the card that expands in place over the calendar (ARCHITECTURE "Expanded task list card"). */

export interface Box { left: number; top: number; right: number; bottom: number }
export interface Placement {
  left: number;
  top: number;
  width: number;
  /** Pixels the card may take; a taller list scrolls inside the card. */
  maxHeight: number;
  /** Where the card grows from its collapsed box. */
  dir: 'down' | 'up';
}

/** Room kept between the card and the edge of the area it must stay in. */
export const EXPAND_MARGIN = 8;

/**
 * Place the expanded card over its collapsed `anchor` inside `bounds` (the visible part of the scroll area).
 * It starts at the anchor's top and grows down; with too little room below it grows up from the anchor's bottom; when
 * neither side holds `contentH` it takes the roomier side and `maxHeight` makes it scroll inside. Horizontally it is the
 * anchor's own column: exactly the same left edge and width.
 */
export function placeExpanded(anchor: Box, bounds: Box, contentH: number): Placement {
  const m = EXPAND_MARGIN;
  const width = anchor.right - anchor.left;
  const left = anchor.left;
  const below = Math.max(0, bounds.bottom - m - anchor.top);
  const above = Math.max(0, anchor.bottom - (bounds.top + m));
  if (contentH <= below) return { left, top: anchor.top, width, maxHeight: below, dir: 'down' };
  if (contentH <= above) return { left, top: anchor.bottom - contentH, width, maxHeight: above, dir: 'up' };
  return below >= above
    ? { left, top: anchor.top, width, maxHeight: below, dir: 'down' }
    : { left, top: anchor.bottom - above, width, maxHeight: above, dir: 'up' };
}

/** True while the anchor is at least partly inside `bounds` (a card scrolled out of sight closes its expansion). */
export function anchorVisible(anchor: Box, bounds: Box): boolean {
  return anchor.bottom > bounds.top && anchor.top < bounds.bottom && anchor.right > bounds.left && anchor.left < bounds.right;
}

/** What the collapsed card of a time block cuts off (decided from its own layout, see `measureCut`). */
export interface Cut {
  /** The title is ellipsised. */
  title: boolean;
  /** An open item name is ellipsised or runs out of the slot's width. */
  names: boolean;
  /** Open items are hidden or only run inline (the card's own fit says `more` or `inline`). */
  rows: boolean;
}

/**
 * Grow only what is needed (owner decision): a card that already shows its whole title and every open item does not grow at all;
 * one whose own slot cuts something (title, a name, or open items hidden / run inline) takes the full day column and as much
 * height as its items need.
 */
export function growPlan(c: Cut): { grow: boolean; wide: boolean } {
  const cut = c.title || c.names || c.rows;
  return { grow: cut, wide: cut };
}

/** Measure what the collapsed card `card` cuts off: ellipsised title or names (scrollWidth) and its fit (`data-fit`). */
export function measureCut(card: HTMLElement): Cut {
  const over = (e: Element | null) => !!e && e.scrollWidth > e.clientWidth + 1;
  const names = over(card.querySelector('[data-testid="tasklist-card-items"]')) || Array.from(card.querySelectorAll('.it:not(.over)')).some(over);
  return { title: over(card.querySelector('.title')) || over(card.querySelector('.tx')), names, rows: card.dataset.fit !== 'all' };
}
