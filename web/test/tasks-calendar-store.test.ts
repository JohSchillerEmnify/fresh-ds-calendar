import { beforeEach, describe, expect, it } from 'vitest';
import { useCalendarsStore } from '@/stores/calendars';
import { freshPinia, mockFetch } from './helpers';

const tasks = { id: 'tasks1', name: 'Calendar app: tasks', color: '#039be5', primary: false, writable: false, defaultReminders: [], tasks: true as const };
const work = { id: 'work', name: 'Work', color: '#0b8043', primary: false, writable: true, defaultReminders: [] };

describe('the task lists calendar in the calendars store (feature tasklists-own-calendar)', () => {
  beforeEach(() => freshPinia());

  it('is no calendar of the list, but has its own entry, named in the app language', () => {
    const cals = useCalendarsStore();
    cals.fromDevice([work, tasks] as never);
    expect(cals.list.map((c) => c.id)).toEqual(['work']);
    expect(cals.tasksCalendar).toMatchObject({ id: 'tasks1', name: 'Task lists calendar' });
    expect(cals.find('tasks1')?.id).toBe('tasks1');
  });

  it('is hidden for every view when switched off, like any calendar', async () => {
    mockFetch({ 'PATCH /api/calendars/tasks1': () => ({ ...tasks, hidden: true }) });
    const cals = useCalendarsStore();
    cals.fromDevice([work, tasks] as never);
    expect(cals.isHidden('tasks1')).toBe(false);
    await cals.toggle('tasks1');
    expect(cals.isHidden('tasks1')).toBe(true);
  });

  it('saves its default reminders through the tasks endpoint', async () => {
    const m = mockFetch({ 'PATCH /api/reminders/tasks-calendar': (r: { body: { defaultReminders: number[] } }) => r.body });
    const cals = useCalendarsStore();
    cals.fromDevice([work, tasks] as never);
    await cals.setDefaultReminders('tasks1', [15]);
    expect(m.calls.some((c) => c.method === 'PATCH' && c.path === '/api/reminders/tasks-calendar')).toBe(true);
  });
});
