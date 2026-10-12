import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('prefs (Labs switches)', () => {
  it('defaults to off, merges patches and survives a calendar visibility change', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, approachBar: false, supportCat: 'sometimes' });
    expect((await t.json('PATCH', '/api/prefs', { labs: true })).body).toEqual({ labs: true, approachBar: false, supportCat: 'sometimes' });
    expect((await t.json('PATCH', '/api/prefs', { approachBar: true })).body).toEqual({ labs: true, approachBar: true, supportCat: 'sometimes' });
    const { body } = await t.json('GET', '/api/calendars');
    await t.json('PATCH', `/api/calendars/${body.calendars[0].id}`, { hidden: true });
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: true, approachBar: true, supportCat: 'sometimes' });
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
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, approachBar: false, supportCat: 'always' });
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'off' })).body.supportCat).toBe('off');
  });

  it('rejects an unknown support cat value', async () => {
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'maybe' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { supportCat: true })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.supportCat).toBe('sometimes');
  });
});
