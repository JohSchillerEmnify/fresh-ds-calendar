import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('prefs (Labs switches)', () => {
  it('defaults to off, merges patches and survives a calendar visibility change', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, approachBar: false, tasksCalendarVisible: false });
    expect((await t.json('PATCH', '/api/prefs', { labs: true })).body).toEqual({ labs: true, approachBar: false, tasksCalendarVisible: false });
    expect((await t.json('PATCH', '/api/prefs', { approachBar: true })).body).toEqual({ labs: true, approachBar: true, tasksCalendarVisible: false });
    const { body } = await t.json('GET', '/api/calendars');
    await t.json('PATCH', `/api/calendars/${body.calendars[0].id}`, { hidden: true });
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: true, approachBar: true, tasksCalendarVisible: false });
  });

  it('rejects non-boolean values and resets with the test reset', async () => {
    expect((await t.json('PATCH', '/api/prefs', { labs: 'yes' })).status).toBe(400);
    await t.json('PATCH', '/api/prefs', { labs: true });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.labs).toBe(false);
  });
});
