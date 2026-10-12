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
  it('has the documented defaults incl. scene and the four categories', async () => {
    const { body: s } = await t.json('GET', '/api/settings');
    expect(s).toMatchObject({
      themeMode: 'system', seedColor: '#1a73e8', defaultView: 'month', defaultEventColorId: null, animationLevel: 'full', sounds: false, calmMode: false,
      transitionWarningMinutes: 10, streakFlame: true, garden: 'plant', scene: 'sunflowers', version: 1,
    });
    expect(s.categories.map((c: any) => [c.id, c.name, c.color, c.icon, c.googleColorId])).toEqual([
      ['shopping', 'Shopping', '#0b8043', '🛒', '10'], ['todo', 'To-do', '#3f51b5', '✅', '9'],
      ['work', 'Work', '#8e24aa', '💼', '3'], ['home', 'Home', '#f4511e', '🏠', '6'],
    ]);
  });

  it('PATCH merges, lowercases the seed color, bumps version and supports the mordor scene', async () => {
    const r = await t.json('PATCH', '/api/settings', { themeMode: 'dark', seedColor: '#C43E00', scene: 'mordor', garden: 'sunflowers' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ themeMode: 'dark', seedColor: '#c43e00', scene: 'mordor', garden: 'sunflowers', version: 2 });
    expect((await t.json('GET', '/api/settings')).body.scene).toBe('mordor');
  });

  it('validates values', async () => {
    const bad = [{ seedColor: 'red' }, { themeMode: 'x' }, { scene: 'moon' }, { transitionWarningMinutes: 7 }, { defaultEventColorId: '12' }, { garden: 'tree' }, { nope: 1 }, { categories: [] }];
    for (const b of bad) expect((await t.json('PATCH', '/api/settings', b)).status, JSON.stringify(b)).toBe(400);
    expect((await t.json('PATCH', '/api/settings', { seedColor: 'red' })).body.error.message).toBe('Enter a color like #1a73e8');
    expect((await t.json('PATCH', '/api/settings', { defaultEventColorId: '5' })).body.defaultEventColorId).toBe('5');
    expect((await t.json('PATCH', '/api/settings', { defaultEventColorId: null })).body.defaultEventColorId).toBeNull();
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
    await t.json('PATCH', '/api/settings', { scene: 'none' });
    const r = await t.json('POST', '/api/__test/reset');
    expect(r.body.settings.categories).toHaveLength(4);
    expect(r.body.settings.scene).toBe('sunflowers');
  });
});
