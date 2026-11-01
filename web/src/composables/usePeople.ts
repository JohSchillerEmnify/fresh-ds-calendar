/** The people a list or category can be shared with: the device copy, refreshed from the server when a sharing dialog opens. */
import { computed, ref, type ComputedRef } from 'vue';
import { api } from '@/api/client';
import type { Person } from '@/api/types';
import { useDeviceStore } from '@/stores/device';

/** The people to share with: the device copy (reactive), and `refresh`, which asks the server and keeps the answer there. */
export function usePeople(): { people: ComputedRef<Person[]>; refresh: () => Promise<void> } {
  const device = useDeviceStore();
  const fetched = ref<Person[]>([]);
  const people = computed(() => device.file<{ people: Person[] }>('people')?.people ?? fetched.value);
  async function refresh(): Promise<void> {
    try {
      const answer = await api.people();
      // the device copy must not stay behind a person who signed in after it was made
      device.putFile('people', answer);
      fetched.value = answer.people;
    } catch { /* offline: the device copy stays */ }
  }
  return { people, refresh };
}
