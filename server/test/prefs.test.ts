import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('prefs (Labs switches)', () => {
  it('defaults to Labs off with the approach track and Approaching card on, merges patches and survives a calendar visibility change', async () => {
    const rest = { tasksCalendarVisible: false, approachWindowHours: 3, approachingCard: true, supportCat: 'sometimes', versionInCorner: false, labsOwnThemes: false, leftHanded: false, tasksGroupBy: 'time', tasksSortBy: 'date', tasksSortDir: 'default', undatedDone: 'calendar', tasksFilter: { categories: [], when: 'all' }, language: 'auto', bedtime: { enabled: false, mode: 'fixed', bedtime: '23:00', wake: '07:00', weekendDifferent: false, weekendBedtime: '00:00', weekendWake: '09:00', sleepMinutes: 480, leadMinutes: 60, reminderMinutes: 30 } };
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, approachBar: true, ...rest });
    expect((await t.json('PATCH', '/api/prefs', { labs: true })).body).toEqual({ labs: true, approachBar: true, ...rest });
    expect((await t.json('PATCH', '/api/prefs', { approachBar: false, approachWindowHours: 3 })).body).toEqual({ labs: true, approachBar: false, ...rest });
    const { body } = await t.json('GET', '/api/calendars');
    await t.json('PATCH', `/api/calendars/${body.calendars[0].id}`, { hidden: true });
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: true, approachBar: false, ...rest });
  });

  it('switches the Approaching card off and back on with the test reset', async () => {
    expect((await t.json('PATCH', '/api/prefs', { approachingCard: false })).body.approachingCard).toBe(false);
    expect((await t.json('GET', '/api/prefs')).body.approachingCard).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { approachingCard: 'no' })).status).toBe(400);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ approachingCard: true, approachBar: true });
  });

  it('keeps the version-in-the-corner switch per person, off by default, boolean only', async () => {
    expect((await t.json('GET', '/api/prefs')).body.versionInCorner).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { versionInCorner: true })).body.versionInCorner).toBe(true);
    expect((await t.json('PATCH', '/api/prefs', { versionInCorner: 'yes' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.labsOwnThemes).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { labsOwnThemes: true })).body.labsOwnThemes).toBe(true);
    expect((await t.json('PATCH', '/api/prefs', { labsOwnThemes: 1 })).status).toBe(400);
    await t.json('PATCH', '/api/prefs', { labsOwnThemes: false });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.versionInCorner).toBe(false);
  });

  it('keeps the bedtime preference per person: off by default, partial patches merge, bad values are refused', async () => {
    const get = async () => (await t.json('GET', '/api/prefs')).body.bedtime;
    expect((await get()).enabled).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { bedtime: { enabled: true, mode: 'dynamic', sleepMinutes: 420 } })).body.bedtime).toMatchObject({ enabled: true, mode: 'dynamic', sleepMinutes: 420, bedtime: '23:00', reminderMinutes: 30 });
    expect((await t.json('PATCH', '/api/prefs', { bedtime: { bedtime: '22:15' } })).body.bedtime).toMatchObject({ enabled: true, mode: 'dynamic', bedtime: '22:15' });
    for (const bad of ['x', null, [], { enabled: 'yes' }, { mode: 'sometimes' }, { bedtime: '25:00' }, { wake: '7:00' }, { sleepMinutes: 5 }, { leadMinutes: 1.5 }, { reminderMinutes: 999 }]) {
      const r = await t.json('PATCH', '/api/prefs', { bedtime: bad });
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
    expect((await get()).bedtime).toBe('22:15');
    await t.req('POST', '/api/__test/reset');
    expect((await get()).enabled).toBe(false);
  });

  it('keeps the left-handed switch per person, off by default, boolean only', async () => {
    expect((await t.json('GET', '/api/prefs')).body.leftHanded).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { leftHanded: true })).body.leftHanded).toBe(true);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ leftHanded: true, versionInCorner: false });
    expect((await t.json('PATCH', '/api/prefs', { leftHanded: 'yes' })).status).toBe(400);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.leftHanded).toBe(false);
  });

  it('keeps the Tasks view grouping and sorting per person, time and date by default, whitelisted', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ tasksGroupBy: 'time', tasksSortBy: 'date', tasksSortDir: 'default' });
    expect((await t.json('PATCH', '/api/prefs', { tasksGroupBy: 'category', tasksSortBy: 'progress' })).body).toMatchObject({ tasksGroupBy: 'category', tasksSortBy: 'progress' });
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ tasksGroupBy: 'category', tasksSortBy: 'progress' });
    expect((await t.json('PATCH', '/api/prefs', { tasksGroupBy: 'week' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { tasksSortBy: 'size' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { tasksSortDir: 'reversed' })).body.tasksSortDir).toBe('reversed');
    expect((await t.json('PATCH', '/api/prefs', { tasksSortDir: 'desc' })).status).toBe(400);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ tasksGroupBy: 'time', tasksSortBy: 'date' });
  });

  it('keeps the approach window per person, 3 hours by default, any whole number from 1 to 24', async () => {
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 6 })).body.approachWindowHours).toBe(6);
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(6);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 5 })).body.approachWindowHours).toBe(5);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 1 })).body.approachWindowHours).toBe(1);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 24 })).body.approachWindowHours).toBe(24);
    for (const bad of [0, 25, 2.5, '6']) {
      expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: bad })).status).toBe(400);
    }
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(24);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(3);
  });

  it('rejects non-boolean values and resets with the test reset', async () => {
    expect((await t.json('PATCH', '/api/prefs', { labs: 'yes' })).status).toBe(400);
    await t.json('PATCH', '/api/prefs', { labs: true });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.labs).toBe(false);
  });

  it('keeps the support cat setting per person, independent of the theme', async () => {
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'always' })).body.supportCat).toBe('always');
    await t.json('PATCH', '/api/prefs/theme', { preset: 'Mordor', overrides: { glow: 'neon' } });
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, approachBar: true, approachWindowHours: 3, approachingCard: true, tasksCalendarVisible: false, supportCat: 'always', versionInCorner: false, labsOwnThemes: false, leftHanded: false, tasksGroupBy: 'time', tasksSortBy: 'date', tasksSortDir: 'default', undatedDone: 'calendar', tasksFilter: { categories: [], when: 'all' }, language: 'auto', bedtime: { enabled: false, mode: 'fixed', bedtime: '23:00', wake: '07:00', weekendDifferent: false, weekendBedtime: '00:00', weekendWake: '09:00', sleepMinutes: 480, leadMinutes: 60, reminderMinutes: 30 } });
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'off' })).body.supportCat).toBe('off');
  });

  it('keeps undatedDone, calendar by default, only the known values', async () => {
    expect((await t.json('GET', '/api/prefs')).body.undatedDone).toBe('calendar');
    expect((await t.json('PATCH', '/api/prefs', { undatedDone: 'archive' })).body.undatedDone).toBe('archive');
    expect((await t.json('PATCH', '/api/prefs', { undatedDone: 'trash' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.undatedDone).toBe('archive');
  });

  it('keeps the language per person, auto by default, only the known languages', async () => {
    expect((await t.json('GET', '/api/prefs')).body.language).toBe('auto');
    for (const l of ['en', 'de', 'de-x-mainfr', 'de-x-coldmirror', 'auto']) {
      expect((await t.json('PATCH', '/api/prefs', { language: l })).body.language).toBe(l);
    }
    await t.json('PATCH', '/api/prefs', { language: 'de' });
    for (const bad of ['fr', 'DE', '', 1, null]) expect((await t.json('PATCH', '/api/prefs', { language: bad })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.language).toBe('de');
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.language).toBe('auto');
  });

  it('rejects an unknown support cat value', async () => {
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'maybe' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { supportCat: true })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.supportCat).toBe('sometimes');
  });

  it('validates the whole patch before changing Google or the stored prefs', async () => {
    expect((await t.json('PATCH', '/api/prefs', { tasksCalendarVisible: true, labs: true, supportCat: 'maybe' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ labs: false, tasksCalendarVisible: false });
  });
});

describe('prefs: Tasks filter', () => {
  it('defaults to no filter, replaces the whole filter and survives a reset only as the default', async () => {
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual({ categories: [], when: 'all' });
    const f = { categories: ['shopping', 'none'], when: 'week' };
    expect((await t.json('PATCH', '/api/prefs', { tasksFilter: f })).body.tasksFilter).toEqual(f);
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual(f);
    expect((await t.json('PATCH', '/api/prefs', { tasksFilter: { categories: [], when: 'all' } })).body.tasksFilter).toEqual({ categories: [], when: 'all' });
    await t.json('PATCH', '/api/prefs', { tasksFilter: f });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual({ categories: [], when: 'all' });
  });

  it.each([
    ['an unknown when', { categories: [], when: 'soon' }],
    ['a missing when', { categories: [] }],
    ['a missing list', { when: 'all' }],
    ['a non-text id', { categories: [1], when: 'all' }],
    ['an empty id', { categories: [''], when: 'all' }],
    ['a long id', { categories: ['x'.repeat(65)], when: 'all' }],
    ['a duplicate id', { categories: ['a', 'a'], when: 'all' }],
    ['too many ids', { categories: Array.from({ length: 51 }, (_, i) => `c${i}`), when: 'all' }],
    ['an extra field', { categories: [], when: 'all', x: 1 }],
    ['a string', 'week'],
    ['null', null],
  ])('rejects %s and changes nothing', async (_n, tasksFilter) => {
    await t.json('PATCH', '/api/prefs', { tasksFilter: { categories: ['a'], when: 'today' } });
    const r = await t.json('PATCH', '/api/prefs', { tasksFilter });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual({ categories: ['a'], when: 'today' });
  });
});
