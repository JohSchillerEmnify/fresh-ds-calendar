import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';

/** Every calendar of the person with their hidden choice. Toggling is instant; the server is told in the background. */
export const useCalendarsStore = defineStore('calendars', () => {
  const list = ref<Calendar[]>([]);
  let saving = 0;

  const hidden = computed(() => new Set(list.value.filter((c) => c.hidden).map((c) => c.id)));
  const isHidden = (calendarId: string) => hidden.value.has(calendarId);

  async function load(): Promise<void> {
    const r = await api.calendars();
    if (saving === 0) list.value = r.calendars; // a poll must not undo a toggle that is still being saved
  }

  async function toggle(id: string): Promise<void> {
    const cur = list.value.find((c) => c.id === id);
    if (!cur) return;
    const next = !cur.hidden;
    list.value = list.value.map((c) => (c.id === id ? { ...c, hidden: next } : c));
    saving++;
    try {
      await api.setCalendarHidden(id, next);
    } catch {
      list.value = list.value.map((c) => (c.id === id ? { ...c, hidden: !next } : c));
    } finally {
      saving--;
    }
  }

  return { list, hidden, isHidden, load, toggle };
});
