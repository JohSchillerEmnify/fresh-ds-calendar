import { defineStore } from 'pinia';
import { api } from '@/api/client';
import type { LocalDate, SearchResponse } from '@/api/types';

/** The item search beyond the device (feature item-search): Google's text search over the dates the device does not hold; needs a connection and keeps nothing. */
export const useItemSearchStore = defineStore('itemSearch', () => {
  function beyond(q: string, outside: { from: LocalDate; to: LocalDate }, today: LocalDate, cursor: string | undefined, signal: AbortSignal): Promise<SearchResponse> {
    return api.searchEvents(q, outside, today, cursor, { signal });
  }
  return { beyond };
});
