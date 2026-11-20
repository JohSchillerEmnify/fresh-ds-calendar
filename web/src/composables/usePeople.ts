/** The people offered when sharing (addresses typed before, people who share with this person): the device copy, refreshed from the server when a sharing dialog opens. */
import { computed, ref, type ComputedRef } from 'vue';
import { api } from '@/api/client';
import type { Person } from '@/api/types';
import { useDeviceStore } from '@/stores/device';

/** The suggestions: the device copy (reactive), and `refresh`, which asks the server and keeps the answer there. */
export function usePeople(): { people: ComputedRef<Person[]>; refresh: () => Promise<void> } {
  const device = useDeviceStore();
  const fetched = ref<Person[]>([]);
  const people = computed(() => device.file<{ people: Person[] }>('people')?.people ?? fetched.value);
  async function refresh(): Promise<void> {
    try {
      const answer = await api.people();
      // the device copy follows the server's own list of this person's contacts
      device.putFile('people', answer);
      fetched.value = answer.people;
    } catch { /* offline: the device copy stays */ }
  }
  return { people, refresh };
}
