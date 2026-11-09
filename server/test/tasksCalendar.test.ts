import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../src/lib/clock.js';
import { MockGoogleProvider } from '../src/providers/mock/MockGoogleProvider.js';
import { PrefsStore } from '../src/services/prefsStore.js';
import { TASKS_CALENDAR_SUMMARY, TasksCalendar } from '../src/services/tasksCalendar.js';
import { makeApp, type TestApp } from './helpers.js';

let dir: string;
let prefs: PrefsStore;
let mock: MockGoogleProvider;
const tasksCalendars = () => mock.remote.calendars().filter((c) => c.summary === TASKS_CALENDAR_SUMMARY);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-tasks-'));
  prefs = new PrefsStore(dir);
  mock = new MockGoogleProvider({ dataDir: null, tz: 'Europe/Berlin', clock: new Clock() });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('TasksCalendar (per-person tasks calendar)', () => {
  it('uses the stored id when that calendar still exists', async () => {
    const cal = mock.remote.insertCalendar('Renamed by the person', true);
    prefs.setTasksCalendarId('p1', cal.id);
    const insert = vi.spyOn(mock, 'insertCalendar');
    expect(await new TasksCalendar(mock, prefs, 'p1').id()).toBe(cal.id);
    expect(insert).not.toHaveBeenCalled();
  });

  it('finds an owned calendar by its summary and stores its id, keeping other prefs', async () => {
    prefs.setLabs('p1', { labs: true });
    const cal = mock.remote.insertCalendar(TASKS_CALENDAR_SUMMARY, true);
    expect(await new TasksCalendar(mock, prefs, 'p1').id()).toBe(cal.id);
    expect(prefs.tasksCalendarId('p1')).toBe(cal.id);
    expect(prefs.labsPrefs('p1').labs).toBe(true);
    expect(tasksCalendars()).toHaveLength(1);
  });

  it('ignores a calendar with that summary that is only shared with the person', async () => {
    mock.setCalendars([...mock.remote.calendars(), { id: 'shared', summary: TASKS_CALENDAR_SUMMARY, backgroundColor: '#000000', primary: false, accessRole: 'reader' }]);
    const id = await new TasksCalendar(mock, prefs, 'p1').id();
    expect(id).not.toBe('shared');
  });

  it('creates the calendar once under parallel calls and hides it in Google', async () => {
    const insert = vi.spyOn(mock, 'insertCalendar');
    const tasks = new TasksCalendar(mock, prefs, 'p1');
    const ids = await Promise.all([tasks.id(), tasks.id(), tasks.id()]);
    expect(new Set(ids).size).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(tasksCalendars()).toEqual([expect.objectContaining({ id: ids[0], hidden: true, accessRole: 'owner' })]);
    expect(prefs.tasksCalendarId('p1')).toBe(ids[0]);
  });

  it('creates a new calendar when the stored one was deleted in Google', async () => {
    prefs.setTasksCalendarId('p1', 'gone@group.calendar.google.com');
    const id = await new TasksCalendar(mock, prefs, 'p1').id();
    expect(id).not.toBe('gone@group.calendar.google.com');
    expect(prefs.tasksCalendarId('p1')).toBe(id);
  });

  it('keeps people apart', async () => {
    const a = await new TasksCalendar(mock, prefs, 'p1').id();
    const other = new MockGoogleProvider({ dataDir: null, tz: 'Europe/Berlin', clock: new Clock() });
    const b = await new TasksCalendar(other, prefs, 'p2').id();
    expect(prefs.tasksCalendarId('p1')).toBe(a);
    expect(prefs.tasksCalendarId('p2')).toBe(b);
  });

  it('"Show tasks calendar in Google" sets hidden to match and remembers the choice', async () => {
    const tasks = new TasksCalendar(mock, prefs, 'p1');
    expect(tasks.visible()).toBe(false);
    await tasks.setVisible(true);
    expect(tasksCalendars()).toEqual([expect.objectContaining({ hidden: false })]);
    expect(tasks.visible()).toBe(true);
    await tasks.setVisible(false);
    expect(tasksCalendars()).toEqual([expect.objectContaining({ hidden: true })]);
    expect(tasks.visible()).toBe(false);
  });

  it('creates the calendar visible when the person chose to show it', async () => {
    prefs.setTasksCalendarVisible('p1', true);
    await new TasksCalendar(mock, prefs, 'p1').id();
    expect(tasksCalendars()).toEqual([expect.objectContaining({ hidden: false })]);
  });
});

describe('task lists through the API', () => {
  let t: TestApp;
  beforeEach(async () => { t = makeApp(); await t.req('POST', '/api/__test/reset'); });
  afterEach(() => t.cleanup());

  it('writes task lists only to the hidden tasks calendar and never lists it as an event calendar', async () => {
    const created = await t.json('POST', '/api/tasklists', { title: 'Groceries', date: '2026-10-14', items: [{ title: 'Milk' }] });
    expect(created.status).toBe(201);
    const { calendars } = (await t.json('GET', '/api/__test/remote/calendars')).body;
    const tasks = calendars.find((c: any) => c.summary === TASKS_CALENDAR_SUMMARY);
    expect(tasks).toMatchObject({ hidden: true });
    expect(created.body.calendarId).toBe(tasks.id);
    expect((await t.json('GET', '/api/__test/remote/events?calendarId=primary')).body.items).toHaveLength(0);
    expect((await t.json('GET', '/api/calendars')).body.calendars.map((c: any) => c.name)).toEqual(['Personal', 'Work', 'Birthdays']);
    expect((await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.items.map((i: any) => i.title)).toEqual(['Groceries']);
  });

  it('ignores events in the tasks calendar that are not task lists, and task-list-shaped events elsewhere', async () => {
    const { id: calendarId } = (await t.json('GET', '/api/__test/tasks-calendar')).body;
    await t.json('POST', '/api/__test/remote/events', { calendarId, summary: 'Stray', start: { date: '2026-10-14' }, end: { date: '2026-10-15' } });
    await t.json('POST', '/api/__test/remote/events', { summary: 'Old list', start: { date: '2026-10-14' }, end: { date: '2026-10-15' }, extendedProperties: { private: { kind: 'tasklist' } } });
    expect((await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.items).toEqual([]);
  });

  it('PATCH /api/prefs tasksCalendarVisible shows the tasks calendar in Google', async () => {
    expect((await t.json('PATCH', '/api/prefs', { tasksCalendarVisible: true })).body).toMatchObject({ tasksCalendarVisible: true });
    const { calendars } = (await t.json('GET', '/api/__test/remote/calendars')).body;
    expect(calendars.filter((c: any) => c.summary === TASKS_CALENDAR_SUMMARY)).toEqual([expect.objectContaining({ hidden: false })]);
    expect((await t.json('GET', '/api/calendars')).body.calendars.map((c: any) => c.name)).toEqual(['Personal', 'Work', 'Birthdays']);
    expect((await t.json('PATCH', '/api/prefs', { tasksCalendarVisible: 'yes' })).status).toBe(400);
  });
});
