import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { tasksAreOn } from '@calendar/shared/tasks-state';
import { api } from '@/api/client';
import { emptyData } from '@/lib/deviceData';
import { useCalendarsStore } from '@/stores/calendars';
import { useDeviceStore } from '@/stores/device';
import { useSyncStore } from '@/stores/sync';
import { useTasksCalendarStore } from '@/stores/tasksCalendar';

beforeEach(() => { setActivePinia(createPinia()); vi.restoreAllMocks(); });

function withState(state?: 'on' | 'off' | 'ask') {
  const device = useDeviceStore();
  device.data = { ...emptyData('-'), files: state ? { tasksCalendar: { state } } : {} };
  return device;
}

describe('the one rule for task lists being available', () => {
  it('hides them only after "not now" or before the question is answered; an unknown state hides nothing', () => {
    expect([undefined, 'on', 'off', 'ask'].map((s) => tasksAreOn(s as never))).toEqual([true, true, false, false]);
  });
});

describe('the task lists state on the device', () => {
  it('reads the answer from the device file, so it holds offline', () => {
    withState('ask');
    const tasks = useTasksCalendarStore();
    expect([tasks.state, tasks.on, tasks.asking]).toEqual(['ask', false, true]);
    withState('off');
    expect([tasks.on, tasks.asking]).toEqual([false, false]);
  });

  it('counts an old device copy that has a tasks calendar entry as on, and an empty one as unknown (shown)', () => {
    withState();
    const tasks = useTasksCalendarStore();
    expect([tasks.state, tasks.on, tasks.asking]).toEqual([undefined, true, false]);
    useCalendarsStore().fromDevice([{ id: 't', name: 'Calendar app: tasks', color: '#000', primary: false, writable: false, defaultReminders: [], hidden: false, tasks: true }]);
    expect(tasks.state).toBe('on');
  });

  it('"turn on" sends the answer, keeps it on the device and syncs; a failure changes nothing', async () => {
    const device = withState('ask');
    const sync = useSyncStore();
    const syncNow = vi.spyOn(sync, 'syncNow').mockResolvedValue();
    const set = vi.spyOn(api, 'setTasksCalendar').mockResolvedValue({ state: 'on' });
    const tasks = useTasksCalendarStore();
    expect(await tasks.answer(true)).toBe(true);
    expect(set).toHaveBeenCalledWith(true);
    expect(device.file('tasksCalendar')).toEqual({ state: 'on' });
    expect(syncNow).toHaveBeenCalled();

    withState('ask');
    vi.spyOn(sync, 'reportError').mockImplementation(() => undefined);
    set.mockRejectedValue(new Error('offline'));
    expect(await tasks.answer(true)).toBe(false);
    expect(tasks.state).toBe('ask');
  });
});
