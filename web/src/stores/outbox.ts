import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { onDeviceWipe } from '@/lib/deviceDb';
import type { OutboxEntry } from '@/lib/outbox';
import { add, flush, load, setEntries, writes, type OutboxState } from '@/lib/outboxEngine';

/** The outbox of unsent changes (ADR 0031): shown on the device at once, kept per person, sent in order (`lib/outboxEngine.ts`). */
export const useOutboxStore = defineStore('outbox', () => {
  const entries = shallowRef<OutboxEntry[]>([]);
  const lastSent = ref<number | null>(null);
  const s: OutboxState = { entries, lastSent, seq: 0, running: false, backoff: 0, retry: null, loaded: null };

  onDeviceWipe((keep) => {
    s.retry?.();
    s.retry = null;
    if (keep) return;
    setEntries(s, []);
    s.loaded = null;
  });

  return {
    entries, lastSent, count: computed(() => entries.value.length),
    load: () => load(s), flush: (resync = true) => flush(s, resync), add: (...a: Parameters<typeof add> extends [unknown, ...infer R] ? R : never) => add(s, ...a), ...writes(s),
  };
});
