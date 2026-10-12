import { computed } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import { filterActive, matchesFilters, type Filters } from '@/lib/items';
import type { CalendarItem } from '@/api/types';

function list(v: LocationQuery[string]): string[] {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.split(',').map((x) => x.trim()).filter(Boolean) : [];
}

/** Category/tag filters live in the URL query (`categories=a,b&tags=x`), see API.md. */
export function useFilters() {
  const route = useRoute();
  const router = useRouter();
  const filters = computed<Filters>(() => ({ categories: list(route.query.categories), tags: list(route.query.tags) }));
  const active = computed(() => filterActive(filters.value));
  const count = computed(() => filters.value.categories.length + filters.value.tags.length);

  function write(f: Filters) {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(route.query)) if (k !== 'categories' && k !== 'tags' && typeof v === 'string') query[k] = v;
    if (f.categories.length) query.categories = f.categories.join(',');
    if (f.tags.length) query.tags = f.tags.join(',');
    return router.replace({ path: route.path, query });
  }
  const toggle = (kind: 'categories' | 'tags', v: string) => {
    const cur = filters.value[kind];
    return write({ ...filters.value, [kind]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const clear = () => write({ categories: [], tags: [] });
  const apply = (items: CalendarItem[]) => (active.value ? items.filter((i) => matchesFilters(i, filters.value)) : items);

  return { filters, active, count, toggle, clear, apply, matches: (i: CalendarItem) => matchesFilters(i, filters.value) };
}
