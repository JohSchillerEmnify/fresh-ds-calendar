import { describe, expect, it } from 'vitest';
import { dueDoorLists } from '../src/plugins/door/service.js';
import type { TaskList } from '../src/api/types.js';

const list = (p: Partial<TaskList> & { id: string; title: string }): TaskList => ({
  kind: 'tasklist', calendarId: 'tasks', date: null, time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null,
  recurrence: null, categoryId: null, tags: ['door'], color: '#000', calendarColor: '#000', completedOn: null, canvas: null,
  reminders: { useDefault: true, minutes: [] }, etag: '"1"', updated: '2026-10-19T00:00:00Z', ...p,
} as TaskList);

describe('door plugin: which lists are due', () => {
  it('keeps door-tagged lists dated today or earlier and undated ones, drops the rest', () => {
    const today = '2026-10-19';
    const got = dueDoorLists([
      list({ id: 'a', title: 'Friday errands', date: '2026-10-23' }),
      list({ id: 'b', title: 'Groceries', date: today, tags: [] }),
      list({ id: 'c', title: 'Parcel', date: '2026-10-17', time: '09:00' }),
      list({ id: 'd', title: 'Before any trip' }),
      list({ id: 'e', title: 'Today', date: today }),
    ], today);
    expect(got.map((l) => l.title)).toEqual(['Parcel', 'Today', 'Before any trip']);
  });

  it('counts a repeating list once, with its latest due occurrence', () => {
    const today = '2026-10-19';
    const got = dueDoorLists([
      list({ id: 'm_20261012', title: 'Bin day', date: '2026-10-12', recurrence: 'weekly' }),
      list({ id: 'm_20261019', title: 'Bin day', date: today, recurrence: 'weekly' }),
      list({ id: 'm_20261026', title: 'Bin day', date: '2026-10-26', recurrence: 'weekly' }),
    ], today);
    expect(got.map((l) => l.id)).toEqual(['m_20261019']);
  });

  it('counts a timed repeating list once too (Google ids _YYYYMMDDTHHMMSSZ)', () => {
    const today = '2026-10-19';
    const got = dueDoorLists([
      list({ id: 'm_20261012T070000Z', title: 'Bin day', date: '2026-10-12', time: '09:00', recurrence: 'weekly', seriesId: 'm' }),
      list({ id: 'm_20261019T070000Z', title: 'Bin day', date: today, time: '09:00', recurrence: 'weekly', seriesId: 'm' }),
    ], today);
    expect(got.map((l) => l.id)).toEqual(['m_20261019T070000Z']);
    const noSeries = dueDoorLists([
      list({ id: 'm_20261012T070000Z', title: 'Bin day', date: '2026-10-12', time: '09:00', recurrence: 'weekly' }),
      list({ id: 'm_20261019T070000Z', title: 'Bin day', date: today, time: '09:00', recurrence: 'weekly' }),
    ], today);
    expect(noSeries.map((l) => l.id)).toEqual(['m_20261019T070000Z']);
  });
});
