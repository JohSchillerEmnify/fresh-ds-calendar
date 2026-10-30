import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';
import { useDeviceStore } from './device';

/** Every calendar of the person with their hidden choice. Toggling is instant; the server is told in the background. */
export const useCalendarsStore = defineStore('calendars', () => {
  const list = ref<Calendar[]>([]);
  let saving = 0;

  const hidden = computed(() => new Set(list.value.filter((c) => c.hidden).map((c) => c.id)));
  const isHidden = (calendarId: string) => hidden.value.has(calendarId);

  /** Takes the list the device holds; a poll must not undo a toggle that is still being saved. */
  function fromDevice(saved: Calendar[]): void {
    if (saving === 0) list.value = saved;
  }

  /** Reads the list from the device store; the server only before the device has had its first sync. */
  async function load(): Promise<void> {
    const device = useDeviceStore();
    if (device.ready) return fromDevice(device.data!.calendars);
    fromDevice((await api.calendars()).calendars);
  }

  async function toggle(id: string): Promise<void> {
    const cur = list.value.find((c) => c.id === id);
    if (!cur) return;
    const next = !cur.hidden;
    list.value = list.value.map((c) => (c.id === id ? { ...c, hidden: next } : c));
    saving++;
    try {
      await api.setCalendarHidden(id, next);
      useDeviceStore().putCalendars(list.value);
    } catch {
      list.value = list.value.map((c) => (c.id === id ? { ...c, hidden: !next } : c));
    } finally {
      saving--;
    }
  }

  /** Replaces a calendar's popup reminder defaults (Google's `defaultReminders`); shown at once, rolled back on failure. */
  async function setDefaultReminders(id: string, minutes: number[]): Promise<void> {
    const before = list.value;
    list.value = before.map((c) => (c.id === id ? { ...c, defaultReminders: minutes } : c));
    saving++;
    try {
      const saved = await api.setCalendarDefaultReminders(id, minutes);
      list.value = list.value.map((c) => (c.id === id ? { ...c, defaultReminders: saved.defaultReminders ?? minutes } : c));
      useDeviceStore().putCalendars(list.value);
    } catch (e) {
      list.value = list.value.map((c) => (c.id === id ? { ...c, defaultReminders: before.find((x) => x.id === id)?.defaultReminders } : c));
      throw e;
    } finally {
      saving--;
    }
  }

  return { list, hidden, isHidden, load, fromDevice, toggle, setDefaultReminders };
});
