import { defineStore } from 'pinia';
import { api } from '@/api/client';
import { onDeviceWipe } from '@/lib/deviceDb';
import type { LocalDate, SearchResponse } from '@/api/types';

/** Calls `fn` when the device is wiped (the search index belongs to the person whose copy it was built from). */
export function onSearchWipe(fn: () => void): void {
  onDeviceWipe(fn);
}

/** The item search beyond the device (feature item-search): Google's text search over the dates the device does not hold; needs a connection and keeps nothing. */
export const useItemSearchStore = defineStore('itemSearch', () => {
  function beyond(q: string, outside: { from: LocalDate; to: LocalDate }, today: LocalDate, cursor: string | undefined, signal: AbortSignal): Promise<SearchResponse> {
    return api.searchEvents(q, outside, today, cursor, { signal });
  }
  return { beyond };
});
