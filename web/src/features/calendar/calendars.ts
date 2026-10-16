import { shallowRef } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';

/** Calendar list for the event dialog (the person's own calendars only: events are never put into other people's): loaded on demand, refreshed in the background on every call. */
export const calendars = shallowRef<Calendar[]>([]);
let inflight: Promise<void> | null = null;

export function loadCalendars(): Promise<void> {
  inflight ??= api.calendars().then(
    (r) => { calendars.value = r.calendars.filter((c) => c.own); },
    () => undefined,
  ).finally(() => { inflight = null; });
  return inflight;
}
