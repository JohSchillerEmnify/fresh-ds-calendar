import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('per-person theme', () => {
  it('defaults to the Default preset without overrides', async () => {
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Default', overrides: {} });
  });

  it('stores the preset and overrides and keeps hidden calendars intact', async () => {
    const r = await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon', overrides: { entries: 'outline' } });
    expect(r.status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Neon', overrides: { entries: 'outline' } });
    const cals = (await t.json('GET', '/api/calendars')).body.calendars;
    await t.json('PATCH', `/api/calendars/${encodeURIComponent(cals[0].id)}`, { hidden: true });
    expect((await t.json('GET', '/api/prefs/theme')).body.preset).toBe('Neon');
  });

  it('rejects unknown presets and values', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Halloween' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { glow: 'blinding' } })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { cat: 'maybe' } })).status).toBe(400);
  });

  it('stores the support cat switch in the overrides', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { cat: 'off' } })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Default', overrides: { cat: 'off' } });
  });
});
