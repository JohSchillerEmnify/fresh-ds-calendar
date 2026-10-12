import { useFilters } from './useFilters';
import { useItemsStore } from '@/stores/items';
import type { Segment } from '@/lib/items';
import { computeBars, isBarEvent, type Bar } from '@/lib/spans';

/** Per-day segments (ordered per ARCHITECTURE §5) with the URL filters applied. Reactive. */
export function useDaySegments() {
  const items = useItemsStore();
  const f = useFilters();
  return (date: string): Segment[] => {
    const l = (items.byDate.get(date) ?? []).filter((s) => !isBarEvent(s.item)); // multi-day events are bars
    return f.active.value ? l.filter((s) => f.matches(s.item)) : l;
  };
}

/** Multi-day bar segments for a row of consecutive dates (events are never filtered). Reactive. */
export function useBars() {
  const items = useItemsStore();
  return (dates: string[]): Bar[] => computeBars(items.all, dates);
}
