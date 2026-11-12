/** The rules on the device's data (ADR 0025): applying a change set, the window, reading items and counts back out. */
import { describe, expect, it } from 'vitest';
import type { CalendarEvent, TaskList } from '@/api/types';
import {
  applyChanges, covers, dropItem, isQuiet, emptyData, itemsIn, putItem, recolourEvents, recolourTaskLists, summaryOf, windowOf, type ChangeSet, type DeviceData,
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

  it('holds the dates of Google Contacts under their own source: replaced as a whole, dropped when the source is no longer answered', () => {
    const contact = (id: string, date: string) => ({ ...ev(id, date, 'birthdays'), sourceCalendarId: 'people' });
    const d = held([ev('a', '2026-10-13'), contact('contact:c1', '2026-10-14')]);
    const replaced = applyChanges(d, answer({ events: { calendars: ['primary', 'people'], replace: ['people'], series: [], removed: [], failed: [], upserts: [contact('contact:c2', '2026-10-15')] } }));
    expect(ids(replaced)).toEqual(['a', 'contact:c2']);
    expect(ids(applyChanges(d, answer({ events: { calendars: ['primary', 'people'], replace: [], series: [], removed: [], failed: [], upserts: [] } })))).toEqual(['a', 'contact:c1']);
    expect(ids(applyChanges(d, answer()))).toEqual(['a']);
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
    const d = held([ev('s_20261013', '2026-10-13'), ev('s_20261020', '2026-10-20'), ev('s2_20261014', '2026-10-14')]);
    const next = applyChanges(d, answer({
      events: { calendars: ['primary'], replace: [], series: [{ calendarId: 'primary', seriesId: 's' }], removed: [], failed: [], upserts: [ev('s_20261027', '2026-10-27')] },
    }));
    expect(ids(next)).toEqual(['s2_20261014', 's_20261027']);
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

describe('series ids', () => {
  it('drops the instances `<series>_<start>` of a series and keeps a plain event whose id only begins like it', () => {
    const d = held([ev('s', '2026-10-12'), ev('s_20261013', '2026-10-13'), ev('s_20261020T080000Z', '2026-10-20'), ev('s_x1', '2026-10-14'), ev('s2_20261013', '2026-10-15')]);
    const next = applyChanges(d, answer({ events: { calendars: ['primary'], replace: [], series: [{ calendarId: 'primary', seriesId: 's' }], removed: [], failed: [], upserts: [] } }));
    expect(ids(next)).toEqual(['s2_20261013', 's_x1']);
  });

  it('drops the occurrences of a repeating task list by its series id', () => {
    const d = held([], [list('w_20261012', '2026-10-12', { seriesId: 'w' }), list('w_20261019', '2026-10-19', { seriesId: 'w' }), list('other', '2026-10-12')]);
    const next = applyChanges(d, answer({ taskLists: { replace: false, series: ['w'], removed: [], upserts: [], failed: false } }));
    expect(ids(next)).toEqual(['other']);
  });
});

describe('window, quiet answers and deletes', () => {
  it('a failed calendar keeps the old window end so the days it missed are not shown as empty', () => {
    const next = applyChanges(held([]), answer({ window: { from: '2025-10-20', to: '2027-10-21' }, events: { calendars: ['primary'], replace: [], series: [], removed: [], upserts: [], failed: ['primary'] } }));
    expect(next.window).toEqual({ from: '2025-10-20', to: '2027-10-13' });
  });

  it('an answer with nothing in it is quiet; any change, file or failure is not', () => {
    const d = { ...held([ev('a', '2026-10-13')]), calendars: [{ id: 'primary' }] as never };
    expect(isQuiet(d, answer())).toBe(true);
    expect(isQuiet(d, answer({ files: { prefs: {} } }))).toBe(false);
    expect(isQuiet(d, answer({ window: { from: '2025-10-13', to: '2027-10-14' } }))).toBe(false);
    expect(isQuiet(d, answer({ full: true }))).toBe(false);
    expect(isQuiet(d, answer({ taskLists: { replace: false, series: [], removed: [], upserts: [], failed: true } }))).toBe(false);
  });

  it('a delete of an event takes only the one of its calendar when ids repeat', () => {
    const d = held([ev('same', '2026-10-13', 'primary'), ev('same', '2026-10-13', 'work')]);
    expect(dropItem(d, 'same', 'work').events.map((e) => e.calendarId)).toEqual(['primary']);
  });
});

describe('recolourEvents (feature calendar-colours)', () => {
  const dressed = (id: string, calendarId: string, color: string, colorId: string | null = null) => ({ ...ev(id, '2026-10-13', calendarId), color, colorId }) as CalendarEvent;
  const events = [dressed('a', 'primary', '#039be5'), dressed('b', 'primary', '#d50000', '11'), dressed('c', 'other', '#039be5')];

  it('recolours the events that follow the changed calendar and no others', () => {
    const next = recolourEvents(events, [{ id: 'primary', color: '#039be5' }, { id: 'other', color: '#039be5' }] as never, [{ id: 'primary', color: '#0b8043' }, { id: 'other', color: '#039be5' }] as never);
    expect(next.map((e) => e.color)).toEqual(['#0b8043', '#d50000', '#039be5']);
  });

  it('keeps the very same list when no colour changed', () => {
    const cals = [{ id: 'primary', color: '#039be5' }] as never;
    expect(recolourEvents(events, cals, cals)).toBe(events);
  });

  it('applyChanges recolours held events when the answer brings a new calendar colour', () => {
    const data = { ...held(events), calendars: [{ id: 'primary', color: '#039be5' }, { id: 'other', color: '#039be5' }] as never };
    const next = applyChanges(data, answer({ calendars: [{ id: 'primary', color: '#0b8043' }, { id: 'other', color: '#039be5' }] as never, events: { calendars: ['primary', 'other'], replace: [], series: [], removed: [], upserts: [], failed: [] } }));
    expect(next.events.map((e) => e.color)).toEqual(['#0b8043', '#d50000', '#039be5']);
  });
});

describe('recolourTaskLists (the tasks calendar colour)', () => {
  const lists = [
    list('plain', '2026-10-13', { color: '#039be5', calendarColor: '#039be5' }),
    list('sorted', '2026-10-13', { categoryId: 'work', color: '#8e24aa', calendarColor: '#039be5' }),
    list('shared:x', '2026-10-13', { color: '#039be5', calendarColor: '#039be5' }),
  ];

  it('recolours the lists that follow the calendar: the calendar colour of all, the colour of those without a category; shared lists keep theirs', () => {
    const next = recolourTaskLists(lists, '#039be5', '#0b8043');
    expect(next.map((l) => [l.color, l.calendarColor])).toEqual([['#0b8043', '#0b8043'], ['#8e24aa', '#0b8043'], ['#039be5', '#039be5']]);
  });

  it('keeps the very same list when the colour did not change or is not known yet', () => {
    expect(recolourTaskLists(lists, '#039be5', '#039BE5')).toBe(lists);
    expect(recolourTaskLists(lists, undefined, '#0b8043')).toBe(lists);
  });

  it('applyChanges recolours held lists when the answer brings a new tasks calendar colour', () => {
    const data = { ...held([], lists), files: { tasksCalendarColor: { color: '#039be5' } } };
    const next = applyChanges(data, answer({ files: { tasksCalendarColor: { color: '#0b8043' } } }));
    expect(next.taskLists.map((l) => l.calendarColor).sort()).toEqual(['#039be5', '#0b8043', '#0b8043']);
  });
});
