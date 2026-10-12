import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import type { CalendarEvent, CalendarItem } from '@/api/types';
import { itemSegments, type Segment } from '@/lib/items';
import { config, eventFixture } from '../helpers';

export const ev = (id: string, start: string, end: string, o: Record<string, unknown> = {}) => eventFixture(id, start, end, o) as unknown as CalendarEvent;
export const t = (date: string, hm: string) => `${date}T${hm}:00+02:00`;
export const segsOf = (items: CalendarItem[], date: string): Segment[] => items.flatMap((it) => itemSegments(it)).filter((s) => s.date === date);

/** Load the clock store frozen at a Berlin wall time (summer time, +02:00). */
export async function setNow(date: string, hm: string) {
  const { mockFetchConfig } = await import('./util');
  mockFetchConfig(config({ now: new Date(`${date}T${hm}:00+02:00`).toISOString(), clockFrozen: true }));
  const clock = useClockStore();
  await clock.load();
  return clock;
}
/** Moves the frozen app clock and ticks (what the minute ticker does). */
export function advance(minutes: number) {
  const clock = useClockStore();
  clock.nowTick = clock.nowTick + minutes * 60000;
}
export const items = () => useItemsStore();
