import { useClockStore } from '@/stores/clock';
import type { CalendarEvent, CalendarItem } from '@/api/types';
import { itemSegments, type Segment } from '@/lib/items';
import { eventFixture } from '../helpers';

export const ev = (id: string, start: string, end: string, o: Record<string, unknown> = {}) => eventFixture(id, start, end, o) as unknown as CalendarEvent;
export const t = (date: string, hm: string) => `${date}T${hm}:00+02:00`;
export const segsOf = (items: CalendarItem[], date: string): Segment[] => items.flatMap((it) => itemSegments(it)).filter((s) => s.date === date);

/** Moves the frozen app clock and ticks (what the minute ticker does). */
export function advance(minutes: number) {
  const clock = useClockStore();
  clock.nowTick = clock.nowTick + minutes * 60000;
}
