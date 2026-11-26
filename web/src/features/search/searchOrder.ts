/** The order of the item search's results (feature item-search): upcoming first, nearest first; then the past, newest first; undated lists last. */
import type { LocalDate } from '@/api/types';
import type { IndexHit, Searchable } from './searchIndex';

/** The day an item is shown on in the results; null for an undated list. */
export const dayOf = (it: Searchable): LocalDate | null => (it.kind === 'event' ? it.start.slice(0, 10) : it.date);

/** Within a day: all-day and untimed first, then by time. */
const timeOf = (it: Searchable): string => (it.kind === 'event' ? (it.allDay ? '' : it.start.slice(11, 16)) : it.time ?? '');

const group = (day: LocalDate | null, today: LocalDate): 0 | 1 | 2 => (day === null ? 2 : day >= today ? 0 : 1);

/** `hits` in result order for `today`; a new array. */
export function orderHits(hits: readonly IndexHit[], today: LocalDate): IndexHit[] {
  const key = (h: IndexHit) => ({ day: dayOf(h.item), time: timeOf(h.item), title: h.item.title });
  return hits.map((h) => ({ h, k: key(h) })).sort((a, b) => {
    const ga = group(a.k.day, today), gb = group(b.k.day, today);
    if (ga !== gb) return ga - gb;
    if (ga === 0 && a.k.day !== b.k.day) return a.k.day! < b.k.day! ? -1 : 1;
    if (ga === 1 && a.k.day !== b.k.day) return a.k.day! < b.k.day! ? 1 : -1;
    return a.k.time.localeCompare(b.k.time) || a.k.title.localeCompare(b.k.title);
  }).map((x) => x.h);
}
