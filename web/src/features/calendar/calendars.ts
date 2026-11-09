import { shallowRef } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';
import { useDeviceStore } from '@/stores/device';

/** Calendar list for the event dialog (the calendars the person may write in Google only): loaded on demand, refreshed in the background on every call. */
export const calendars = shallowRef<Calendar[]>([]);
let inflight: Promise<void> | null = null;

export function loadCalendars(): Promise<void> {
  const device = useDeviceStore();
  if (device.ready) {
    calendars.value = device.data!.calendars.filter((c) => c.writable);
    return Promise.resolve();
  }
  inflight ??= api.calendars().then(
    (r) => { calendars.value = r.calendars.filter((c) => c.writable); },
    () => undefined,
  ).finally(() => { inflight = null; });
  return inflight;
}
