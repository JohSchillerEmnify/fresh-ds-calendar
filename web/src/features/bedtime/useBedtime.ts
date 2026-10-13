/**
 * Store glue of bedtime mode: reads the person's preference, the items and the hidden calendars and hands the pure
 * rule (`bedtime.ts`) its input. Views, the Approaching card and the reminder all get their windows from here.
 */
import { computed, type ComputedRef } from 'vue';
import { addDays, parseIsoDate, toIsoDate } from '@/lib/dates';
import { useCalendarsStore } from '@/stores/calendars';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { bedtimeWindows, type BedtimeWindow, type SegmentSource } from './bedtime';

/**
 * The day after an ISO date.
 *
 * @param iso ISO date.
 * @returns The next ISO date.
 */
export function nextIsoDate(iso: string): string {
  return toIsoDate(addDays(parseIsoDate(iso)!, 1));
}

/**
 * The night windows that touch a range of days, live (recomputed when the preference or the items change).
 *
 * @param range The shown days, `to` exclusive; read inside the computed, so it may be reactive.
 * @returns A computed list of windows; empty while bedtime mode is off.
 */
export function useBedtimeWindows(range: () => { from: string; to: string }): ComputedRef<BedtimeWindow[]> {
  const prefs = usePrefsStore();
  const items = useItemsStore();
  const cals = useCalendarsStore();
  // hidden calendars do not count as "the first appointment"
  const source: SegmentSource = { get: (date) => (items.byDate.get(date) ?? []).filter((s) => !cals.isHidden(s.item.calendarId)) };
  return computed(() => (prefs.bedtime.enabled ? bedtimeWindows(range(), prefs.bedtime, source) : []));
}
