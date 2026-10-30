import { shallowRef } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';
import { useDeviceStore } from '@/stores/device';

/** Calendar list for the event dialog (the person's own calendars only: events are never put into other people's): loaded on demand, refreshed in the background on every call. */
export const calendars = shallowRef<Calendar[]>([]);
let inflight: Promise<void> | null = null;

export function loadCalendars(): Promise<void> {
  const device = useDeviceStore();
  if (device.ready) {
    calendars.value = device.data!.calendars.filter((c) => c.own);
    return Promise.resolve();
  }
  inflight ??= api.calendars().then(
    (r) => { calendars.value = r.calendars.filter((c) => c.own); },
    () => undefined,
  ).finally(() => { inflight = null; });
  return inflight;
}
