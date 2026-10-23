import { useFilters } from './useFilters';
import { useCalendarsStore } from '@/stores/calendars';
import { useItemsStore } from '@/stores/items';
import type { Segment } from '@/lib/items';
import { computeBars, isBarEvent, type Bar } from '@/lib/spans';

/**
 * Per-day segments (ordered per feature event-display) with the URL filters applied, without hidden calendars. Reactive.
 * Multi-day events are left out (the views draw them as bars) unless `withSpans`: views without a bar row (Labs)
 * show a multi-day event on each of its days.
 */
export function useDaySegments(opts: { withSpans?: boolean } = {}) {
  const items = useItemsStore();
  const f = useFilters();
  const cals = useCalendarsStore();
  return (date: string): Segment[] => {
    const l = (items.byDate.get(date) ?? []).filter((s) => (opts.withSpans || !isBarEvent(s.item)) && !cals.isHidden(s.item.calendarId));
    return f.active.value ? l.filter((s) => f.matches(s.item)) : l;
  };
}

/** Multi-day bar segments for a row of consecutive dates (events are never filtered). Reactive. */
export function useBars() {
  const items = useItemsStore();
  const cals = useCalendarsStore();
  return (dates: string[]): Bar[] => computeBars(items.all.filter((i) => !cals.isHidden(i.calendarId)), dates);
}
