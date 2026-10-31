import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('settings', () => {
  it('has the documented defaults and the four categories', async () => {
    const { body: s } = await t.json('GET', '/api/settings');
    expect(s).toMatchObject({
      themeMode: 'system', seedColor: '#1a73e8', defaultView: 'month', animationLevel: 'full', sounds: false, calmMode: false, ignoreSystemMotion: false,
      sunflowers: 'grow', version: 1,
    });
    expect(s).not.toHaveProperty('scene');
    expect(s).not.toHaveProperty('streakFlame');
    expect(s).not.toHaveProperty('plant');
    expect(s).not.toHaveProperty('garden');
    expect(s.categories.map((c: any) => [c.id, c.name, c.color, c.icon, c.googleColorId])).toEqual([
      ['shopping', 'Shopping', '#0b8043', '🛒', '10'], ['todo', 'To-do', '#3f51b5', '✅', '9'],
      ['work', 'Work', '#8e24aa', '💼', '3'], ['home', 'Home', '#f4511e', '🏠', '6'],
    ]);
  });

  it('PATCH merges, lowercases the seed color, bumps version', async () => {
    const r = await t.json('PATCH', '/api/settings', { themeMode: 'dark', seedColor: '#C43E00', sunflowers: 'full' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ themeMode: 'dark', seedColor: '#c43e00', sunflowers: 'full', version: 2 });
  });

  it('validates values', async () => {
    const bad = [{ seedColor: 'red' }, { themeMode: 'x' }, { scene: 'mordor' }, { transitionWarningMinutes: 7 }, { garden: 'plant' }, { plant: true }, { streakFlame: false }, { plant: 'yes' }, { sunflowers: 'many' }, { nope: 1 }, { categories: [] }];
    for (const b of bad) expect((await t.json('PATCH', '/api/settings', b)).status, JSON.stringify(b)).toBe(400);
    expect((await t.json('PATCH', '/api/settings', { seedColor: 'red' })).body.error.message).toBe('Enter a color like #1a73e8');
  });

  it('If-Match uses the settings version', async () => {
    const ok = await t.json('PATCH', '/api/settings', { sounds: true }, { 'If-Match': '1' });
    expect(ok.status).toBe(200);
    const stale = await t.json('PATCH', '/api/settings', { sounds: false }, { 'If-Match': '1' });
    expect(stale.status).toBe(412);
    expect(stale.body.error.code).toBe('PRECONDITION_FAILED');
  });

  it('persists to DATA_DIR/settings.json (atomic) and reloads', async () => {
    await t.json('PATCH', '/api/settings', { seedColor: '#6750a4' });
    const file = path.join(t.dir, 'settings.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).seedColor).toBe('#6750a4');
    expect(fs.readdirSync(t.dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    const again = buildApp({ ...loadConfig({ DATA_DIR: t.dir, TEST_MODE: 'false' }), webDist: null });
    expect((await (await again.request('/api/settings')).json()).seedColor).toBe('#6750a4');
    again.close();
  });

  // the flame and plant switches were replaced by the person pref `streak` (API.md "Flame and plant switches retired")
  it('drops the retired flame and plant switches on load, on the next save and after a restore, and nobody gets a streak', async () => {
    const file = path.join(t.dir, 'settings.json');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...stored, streakFlame: true, plant: true }));
    const again = buildApp({ ...loadConfig({ DATA_DIR: t.dir, TEST_MODE: 'false' }), webDist: null });
    const served = await (await again.request('/api/settings')).json();
    expect(served).not.toHaveProperty('streakFlame');
    expect(served).not.toHaveProperty('plant');
    expect((await (await again.request('/api/prefs')).json()).streak).toBe('off');
    await again.request('/api/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sounds: true }) });
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(saved).not.toHaveProperty('streakFlame');
    expect(saved).not.toHaveProperty('plant');
    again.close();
  });

  it('ignores a stored default event colour: new events follow their calendar', async () => {
    const file = path.join(t.dir, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), defaultEventColorId: '11' }));
    const again = buildApp({ ...loadConfig({ DATA_DIR: t.dir, TEST_MODE: 'false' }), webDist: null });
    expect(await (await again.request('/api/settings')).json()).not.toHaveProperty('defaultEventColorId');
    again.close();
  });

  it('accepts and drops the retired defaultEventColorId sent by an older app', async () => {
    const r = await t.json('PATCH', '/api/settings', { defaultEventColorId: '5', sounds: true });
    expect(r.status).toBe(200);
    expect(r.body.sounds).toBe(true);
    expect(r.body).not.toHaveProperty('defaultEventColorId');
    expect(await t.json('GET', '/api/settings')).toMatchObject({ body: { sounds: true } });
  });

  it('works during an outage', async () => {
    await t.json('POST', '/api/__test/outage', { down: true });
    expect((await t.json('PATCH', '/api/settings', { sounds: true })).status).toBe(200);
    expect((await t.json('POST', '/api/categories', { name: 'X', color: '#112233' })).status).toBe(201);
  });
});

describe('categories', () => {
  it('creates with nanoid, lowercase color, derived googleColorId', async () => {
    const r = await t.json('POST', '/api/categories', { name: ' Pets ', color: '#AABBCC', icon: '🐶' });
    expect(r.status).toBe(201);
    const c = r.body.categories.at(-1);
    expect(c).toMatchObject({ name: 'Pets', color: '#aabbcc', icon: '🐶' });
    expect(c.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(c.googleColorId).toMatch(/^\d+$/);
    expect(r.body.version).toBe(2);
  });

  it('validates name, uniqueness (case-insensitive), color, icon', async () => {
    const m = async (b: object) => (await t.json('POST', '/api/categories', b)).body.error?.message;
    expect(await m({ name: ' ', color: '#112233' })).toBe('Name is required');
    expect(await m({ color: '#112233' })).toBe('Name is required');
    expect(await m({ name: 'shopping', color: '#112233' })).toBe('A category with this name already exists');
    expect(await m({ name: 'x'.repeat(41), color: '#112233' })).toBe('Name must be at most 40 characters');
    expect(await m({ name: 'ok', color: 'blue' })).toBe('Enter a color like #1a73e8');
    expect(await m({ name: 'ok', color: '#112233', icon: '123456789' })).toBeTruthy();
  });

  it('patches, deletes and reorders', async () => {
    const p = await t.json('PATCH', '/api/categories/work', { name: 'Job', color: '#D50000', icon: null });
    expect(p.body.categories.find((c: any) => c.id === 'work')).toMatchObject({ name: 'Job', color: '#d50000', icon: null, googleColorId: '11' });
    expect((await t.json('PATCH', '/api/categories/work', { name: 'home' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/categories/work', { name: 'JOB' })).status).toBe(200); // own name is fine
    expect((await t.json('PATCH', '/api/categories/nope', { name: 'a' })).status).toBe(404);
    const o = await t.json('PUT', '/api/categories/order', { categoryIds: ['home', 'work', 'todo', 'shopping'] });
    expect(o.body.categories.map((c: any) => c.id)).toEqual(['home', 'work', 'todo', 'shopping']);
    expect((await t.json('PUT', '/api/categories/order', { categoryIds: ['home'] })).status).toBe(400);
    const d = await t.json('DELETE', '/api/categories/home');
    expect(d.body.categories.map((c: any) => c.id)).toEqual(['work', 'todo', 'shopping']);
    expect((await t.json('DELETE', '/api/categories/home')).status).toBe(404);
  });

  it('reset restores default settings and categories', async () => {
    await t.json('DELETE', '/api/categories/home');
    await t.json('PATCH', '/api/settings', { sunflowers: 'full' });
    const r = await t.json('POST', '/api/__test/reset');
    expect(r.body.settings.categories).toHaveLength(4);
    expect(r.body.settings.sunflowers).toBe('grow');
  });
});
