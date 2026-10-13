/**
 * Bedtime feature (ARCHITECTURE "Bedtime mode"): the night band layer of the time grid, the reminder and the background
 * load of the next day's items. The other views insert `BedtimeColumn`, `BedtimeDial` and `BedtimeTrack` themselves.
 */
import { watch } from 'vue';
import { registerGridLayer } from '@/extensions/registry';
import { addDays, parseIsoDate, toIsoDate } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import BedtimeColumn from './BedtimeColumn.vue';
import { startBedtimeReminder } from './bedtimeReminder';

let done = false;

/**
 * Registers the night band layer once and (re)starts the reminder on the active Pinia. In dynamic mode the items of the
 * day after the shown range and of tomorrow are loaded in the background, so the first appointment is known.
 */
export function registerBedtimeFeature(): void {
  startBedtimeReminder();
  if (done) return;
  done = true;
  registerGridLayer(BedtimeColumn);
  const prefs = usePrefsStore();
  const items = useItemsStore();
  const clock = useClockStore();
  watch(
    () => [prefs.bedtime.enabled && prefs.bedtime.mode === 'dynamic', items.visible?.to, clock.today] as const,
    ([dynamic, to, today]) => {
      if (!dynamic) return;
      const day = (iso: string) => toIsoDate(addDays(parseIsoDate(iso)!, 1));
      if (to) items.prefetch(to, day(to));
      items.prefetch(day(today), day(day(today)));
    },
    { immediate: true },
  );
}
