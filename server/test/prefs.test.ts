import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('prefs (Labs switches)', () => {
  it('defaults to off, merges patches and survives a calendar visibility change', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, approachBar: false, approachWindowHours: 3 });
    expect((await t.json('PATCH', '/api/prefs', { labs: true })).body).toEqual({ labs: true, approachBar: false, approachWindowHours: 3 });
    expect((await t.json('PATCH', '/api/prefs', { approachBar: true, approachWindowHours: 3 })).body).toEqual({ labs: true, approachBar: true, approachWindowHours: 3 });
    const { body } = await t.json('GET', '/api/calendars');
    await t.json('PATCH', `/api/calendars/${body.calendars[0].id}`, { hidden: true });
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: true, approachBar: true, approachWindowHours: 3 });
  });

  it('keeps the approach window per person, 3 hours by default, only 3, 6 or 12', async () => {
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 6 })).body.approachWindowHours).toBe(6);
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(6);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 5 })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: '6' })).status).toBe(400);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(3);
  });

  it('rejects non-boolean values and resets with the test reset', async () => {
    expect((await t.json('PATCH', '/api/prefs', { labs: 'yes' })).status).toBe(400);
    await t.json('PATCH', '/api/prefs', { labs: true });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.labs).toBe(false);
  });
});
