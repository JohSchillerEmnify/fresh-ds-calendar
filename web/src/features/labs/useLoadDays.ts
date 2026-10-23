import { nextTick, onMounted, watch, type Ref } from 'vue';
import { addDays } from 'date-fns';
import { toIsoDate } from '@/lib/dates';
import { useItemsStore } from '@/stores/items';

/**
 * Keeps the items of a Labs view's visible days loaded: once after mounting, and again whenever the days change.
 * A failed load is ignored here; the next change of days loads again.
 */
export function useLoadDays(days: Ref<Date[]>): void {
  const items = useItemsStore();
  const load = () => { const d = days.value; void items.setVisible(toIsoDate(d[0]!), toIsoDate(addDays(d[d.length - 1]!, 1))).catch(() => undefined); };
  watch(days, load);
  onMounted(async () => { await nextTick(); load(); });
}
