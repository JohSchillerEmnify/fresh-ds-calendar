import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { tasksAreOn, type TasksState } from '@calendar/shared/tasks-state';
import { api } from '@/api/client';
import { useCalendarsStore } from './calendars';
import { useDeviceStore } from './device';
import { useSyncStore } from './sync';

/** Whether the person has task lists (tasklists-calendar-consent); a device file, so it holds offline. */
export const useTasksCalendarStore = defineStore('tasksCalendar', () => {
  const device = useDeviceStore();
  const calendars = useCalendarsStore();
  const sync = useSyncStore();
  const state = computed<TasksState | undefined>(() => device.file<{ state: TasksState }>('tasksCalendar')?.state ?? (calendars.tasksCalendar ? 'on' : undefined));
  /** Task lists are available: every entry point to them (create switch, tray, Tasks view) follows this one flag. */
  const on = computed(() => tasksAreOn(state.value));
  /** The person has not answered yet: the question is due. */
  const asking = computed(() => state.value === 'ask');
  const busy = ref(false);

  /** "Turn on" creates the calendar in Google; "Not now" keeps task lists off. Needs a connection; a failure is reported and changes nothing. */
  async function answer(enabled: boolean): Promise<boolean> {
    busy.value = true;
    try {
      device.putFile('tasksCalendar', await api.setTasksCalendar(enabled));
      // the calendar, its task lists and the entry points arrive with the next sync
      await sync.syncNow('changed');
      return true;
    } catch (e) {
      sync.reportError(e);
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { state, on, asking, busy, answer };
});
