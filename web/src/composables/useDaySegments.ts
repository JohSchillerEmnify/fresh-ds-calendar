import { useFilters } from './useFilters';
import { useItemsStore } from '@/stores/items';
import type { Segment } from '@/lib/items';

/** Per-day segments (ordered per ARCHITECTURE §5) with the URL filters applied. Reactive. */
export function useDaySegments() {
  const items = useItemsStore();
  const f = useFilters();
  return (date: string): Segment[] => {
    const l = items.byDate.get(date) ?? [];
    return f.active.value ? l.filter((s) => f.matches(s.item)) : l;
  };
}
