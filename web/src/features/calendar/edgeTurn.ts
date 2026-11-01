/**
 * Turning the day or week while dragging (feature drag-to-reschedule, owner 2026-10-25): the pure parts. While an entry
 * is dragged in the day or week view, the outer {@link EDGE_ZONE_PX} of the day columns on each side are edge zones; a
 * band names the day or week a turn leads to, and resting there for {@link EDGE_HOLD_MS} turns the view (again after
 * each such wait). The week view waits longer so a drop on Sunday or Monday is never stolen.
 */
import { dayText, format, shiftPeriod, weekDays } from '@/lib/dates';
import { dateLocale, language } from '@/i18n/language';

/** Width (px) of the edge zone on each side of the day columns. */
export const EDGE_ZONE_PX = 24;
/** How long (ms) the pointer rests in an edge zone before the view turns, per view. */
export const EDGE_HOLD_MS = { day: 600, week: 1000 } as const;

/** A view that turns at its edges. */
export type EdgeView = keyof typeof EDGE_HOLD_MS;

/**
 * The edge zone a pointer is in.
 *
 * @param x The pointer's x (client px).
 * @param left The left edge of the day columns (client px).
 * @param right The right edge of the day columns (client px).
 * @returns `left` or `right` inside a zone, else null (also outside the columns).
 */
export function edgeSide(x: number, left: number, right: number): 'left' | 'right' | null {
  if (x < left || x > right) return null;
  if (x < left + EDGE_ZONE_PX) return 'left';
  if (x > right - EDGE_ZONE_PX) return 'right';
  return null;
}

/**
 * The band's text for a turn: the day ("Thu 15 ›") or the week ("19–25 Oct ›") it leads to, the arrow on its side.
 *
 * @param view The view that turns.
 * @param anchor A date of the period shown now.
 * @param dir 1 for the next period, -1 for the previous one.
 * @returns The label in the active language.
 */
export function edgeLabel(view: EdgeView, anchor: Date, dir: 1 | -1): string {
  const to = shiftPeriod(view, anchor, dir);
  const text = view === 'day' ? dayText(to) : weekText(weekDays(to));
  return dir === 1 ? `${text} ›` : `‹ ${text}`;
}


/** A week as the range of its first and last day, the month written once when they share it. */
function weekText(days: Date[]): string {
  const [a, b] = [days[0], days[6]];
  const same = a.getMonth() === b.getMonth();
  if (language.value === 'en') return same ? `${a.getDate()}–${format(b, 'd MMM')}` : `${format(a, 'd MMM')} – ${format(b, 'd MMM')}`;
  const dm = new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' });
  return same ? `${a.getDate()}.–${dm.format(b)}` : `${dm.format(a)} – ${dm.format(b)}`;
}
