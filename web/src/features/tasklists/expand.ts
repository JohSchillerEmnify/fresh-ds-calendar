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
/** The expanded card is never narrower than this, even over a narrow month cell or week column. */
export const EXPAND_MIN_WIDTH = 240;

/**
 * Place the expanded card over its collapsed `anchor` inside `bounds` (the visible part of the scroll area).
 * It starts at the anchor's top and grows down; with too little room below it grows up from the anchor's bottom; when
 * neither side holds `contentH` it takes the roomier side and `maxHeight` makes it scroll inside. Horizontally it keeps
 * the anchor's left edge and is pulled back inside `bounds`.
 */
export function placeExpanded(anchor: Box, bounds: Box, contentH: number, minWidth = EXPAND_MIN_WIDTH): Placement {
  const m = EXPAND_MARGIN;
  const room = bounds.right - bounds.left - 2 * m;
  const width = Math.max(0, Math.min(Math.max(anchor.right - anchor.left, minWidth), room));
  const left = Math.max(bounds.left + m, Math.min(anchor.left, bounds.right - m - width));
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
