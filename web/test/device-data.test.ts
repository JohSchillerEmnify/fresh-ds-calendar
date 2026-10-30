/** The rules on the device's data (ADR 0025): applying a change set, the window, reading items and counts back out. */
import { describe, expect, it } from 'vitest';
import type { CalendarEvent, TaskList } from '@/api/types';
import {
  applyChanges, covers, dropItem, emptyData, itemsIn, putItem, summaryOf, windowOf, type ChangeSet, type DeviceData,
} from '@/lib/deviceData';
import { eventFixture } from './helpers';

const ev = (id: string, date: string, calendarId = 'primary'): CalendarEvent =>
  eventFixture(id, `${date}T10:00:00+02:00`, `${date}T11:00:00+02:00`, { calendarId }) as unknown as CalendarEvent;
const list = (id: string, date: string | null, o: Partial<TaskList> = {}): TaskList => ({
  kind: 'tasklist', id, calendarId: 'tasks', title: id, date, time: null, items: [], doneCount: 0, totalCount: 1,
  estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#000', calendarColor: '#000',
  completedOn: null, canvas: null, etag: 'e', updated: '2026-10-12T08:00:00+02:00', ...o,
});
const answer = (o: Partial<ChangeSet> = {}): ChangeSet => ({
  full: false, cursor: 'c2', window: { from: '2025-10-12', to: '2027-10-13' }, calendars: [{ id: 'primary' } as never],
  events: { calendars: ['primary'], replace: [], series: [], removed: [], upserts: [], failed: [] },
  taskLists: { replace: false, series: [], removed: [], upserts: [], failed: false },
  files: {}, ...o,
});
const held = (events: CalendarEvent[], lists: TaskList[] = []): DeviceData => ({ ...emptyData('-'), cursor: 'c1', events, taskLists: lists, window: { from: '2025-10-12', to: '2027-10-13' } });
const ids = (d: DeviceData) => [...d.events.map((e) => e.id), ...d.taskLists.map((l) => l.id)].sort();

describe('windowOf', () => {
  it('is a year back to a year ahead, end exclusive', () => {
    expect(windowOf('2026-10-12')).toEqual({ from: '2025-10-12', to: '2027-10-13' });
  });
});

describe('applyChanges', () => {
  it('adds, changes and removes events, and takes cursor, calendars and files', () => {
    const next = applyChanges(held([ev('a', '2026-10-13'), ev('b', '2026-10-14')]), answer({
      events: { calendars: ['primary'], replace: [], series: [], removed: [{ calendarId: 'primary', id: 'a' }], failed: [], upserts: [ev('b', '2026-10-15'), ev('c', '2026-10-16')] },
      files: { prefs: { language: 'de' } },
    }));
    expect(ids(next)).toEqual(['b', 'c']);
    expect(next.events.find((e) => e.id === 'b')!.start).toContain('2026-10-15');
    expect(next.cursor).toBe('c2');
    expect(next.files.prefs).toEqual({ language: 'de' });
  });

  it('drops the events of a calendar that is gone and of one answered as replace, before the upserts', () => {
    const d = held([ev('a', '2026-10-13', 'primary'), ev('w', '2026-10-13', 'work'), ev('x', '2026-10-13', 'old')]);
    const next = applyChanges(d, answer({
      events: { calendars: ['primary', 'work'], replace: ['work'], series: [], removed: [], failed: [], upserts: [ev('w2', '2026-10-14', 'work')] },
    }));
    expect(ids(next)).toEqual(['a', 'w2']);
  });

  it('keeps the events of a calendar that failed', () => {
    const next = applyChanges(held([ev('a', '2026-10-13')]), answer({ events: { calendars: ['primary'], replace: [], series: [], removed: [], upserts: [], failed: ['primary'] } }));
    expect(ids(next)).toEqual(['a']);
  });

  it('drops the stored instances of a series and puts the current ones in', () => {
    const d = held([ev('s_1', '2026-10-13'), ev('s_2', '2026-10-20'), ev('s2_1', '2026-10-14')]);
    const next = applyChanges(d, answer({
      events: { calendars: ['primary'], replace: [], series: [{ calendarId: 'primary', seriesId: 's' }], removed: [], failed: [], upserts: [ev('s_3', '2026-10-27')] },
    }));
    expect(ids(next)).toEqual(['s2_1', 's_3']);
  });

  it('drops events that moved out of the window and keeps task lists of every date', () => {
    const d = held([ev('far', '2026-10-13')], [list('old', '2020-01-01'), list('undated', null)]);
    const next = applyChanges(d, answer({ window: { from: '2026-11-01', to: '2028-01-01' } }));
    expect(ids(next)).toEqual(['old', 'undated']);
  });

  it('applies task list replace (own lists only), removals and upserts', () => {
    const d = held([], [list('a', '2026-10-12'), list('shared:s', null), list('b', '2026-10-13')]);
    const next = applyChanges(d, answer({ taskLists: { replace: true, series: [], removed: ['shared:gone'], failed: false, upserts: [list('c', null)] } }));
    expect(ids(next)).toEqual(['c', 'shared:s']);
    const again = applyChanges(next, answer({ taskLists: { replace: false, series: [], removed: ['shared:s'], failed: false, upserts: [] } }));
    expect(ids(again)).toEqual(['c']);
  });

  it('keeps its task lists when the tasks calendar could not be read', () => {
    const next = applyChanges(held([], [list('a', '2026-10-12')]), answer({ taskLists: { replace: false, series: [], removed: [], upserts: [], failed: true } }));
    expect(ids(next)).toEqual(['a']);
  });
});

describe('reading the held data', () => {
  const d = held([ev('a', '2026-10-13'), ev('b', '2027-03-01')], [list('t', '2026-10-13'), list('u', null)]);

  it('returns the events and dated lists of a range, never undated lists', () => {
    expect(itemsIn(d, '2026-10-12', '2026-10-19').map((i) => i.id).sort()).toEqual(['a', 't']);
  });

  it('holds a range only inside the window', () => {
    expect(covers(d, '2026-10-12', '2026-10-19')).toBe(true);
    expect(covers(d, '2027-10-01', '2027-11-01')).toBe(false);
    expect(covers(emptyData('-'), '2026-10-12', '2026-10-13')).toBe(false);
  });

  it('counts days as the server does: items per day, open lists, density', () => {
    const s = summaryOf(d, '2026-10-12', '2026-10-19');
    expect(s['2026-10-13']).toEqual({ events: 1, tasklists: 1, openTasklists: 1, density: 2 });
    expect(Object.keys(s)).toEqual(['2026-10-13']);
  });
});

describe('writing through', () => {
  it('a saved item replaces its older copy, an event outside the window is not kept, a delete takes it out', () => {
    let d = held([ev('a', '2026-10-13')], [list('t', '2026-10-13')]);
    d = putItem(d, ev('a', '2026-10-14'));
    expect(d.events[0]!.start).toContain('2026-10-14');
    d = putItem(d, ev('far', '2031-01-01'));
    expect(ids(d)).toEqual(['a', 't']);
    d = putItem(d, list('t', '2026-10-15', { title: 'new' }));
    expect(d.taskLists).toHaveLength(1);
    expect(ids(dropItem(d, 't'))).toEqual(['a']);
  });
});
