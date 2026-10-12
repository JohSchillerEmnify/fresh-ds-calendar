import { shallowRef } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';

/** Calendar list for the event dialog: loaded on demand, refreshed in the background on every call. */
export const calendars = shallowRef<Calendar[]>([]);
let inflight: Promise<void> | null = null;

export function loadCalendars(): Promise<void> {
  inflight ??= api.calendars().then(
    (r) => { calendars.value = r.calendars.filter((c) => c.writable); },
    () => undefined,
  ).finally(() => { inflight = null; });
  return inflight;
}
