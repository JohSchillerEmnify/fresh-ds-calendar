import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { makeApp, sessionCookie, type TestApp } from './helpers.js';

const JO = 'jo@example.com', ANNA = 'anna@example.com';
type Call = (m: string, u: string, b?: unknown) => Promise<{ status: number; body: any }>;

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

/** Signs both people in and returns a caller per person. */
async function twoPeople(): Promise<{ jo: Call; anna: Call }> {
  await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
  const as = async (email: string): Promise<Call> => {
    const cookie = await sessionCookie(t, email);
    return (m, u, b) => t.json(m, u, b, { cookie });
  };
  return { jo: await as(JO), anna: await as(ANNA) };
}

describe('two people\'s settings are separate', () => {
  it('Anna changing view, calm mode, animations, sounds, motion, sunflowers and theme mode leaves Jo at the defaults', async () => {
    const { jo, anna } = await twoPeople();
    const before = (await jo('GET', '/api/settings')).body;
    const r = await anna('PATCH', '/api/settings', {
      defaultView: 'week', calmMode: true, animationLevel: 'off', sounds: true, ignoreSystemMotion: true, sunflowers: 'full', themeMode: 'dark',
    });
    expect(r.status).toBe(200);
    expect((await anna('GET', '/api/settings')).body).toMatchObject({ defaultView: 'week', calmMode: true, animationLevel: 'off', sounds: true, themeMode: 'dark' });
    const joNow = (await jo('GET', '/api/settings')).body;
    expect(joNow).toMatchObject({
      defaultView: 'month', calmMode: false, animationLevel: 'full', sounds: false, ignoreSystemMotion: false, sunflowers: 'grow', themeMode: 'system',
    });
    expect(joNow.version).toBe(before.version);
  });

  it('Anna adding, renaming and deleting categories leaves Jo with the four defaults', async () => {
    const { jo, anna } = await twoPeople();
    await anna('POST', '/api/categories', { name: 'Garden', color: '#0b8043' });
    await anna('PATCH', '/api/categories/work', { name: 'Job' });
    await anna('DELETE', '/api/categories/home');
    expect((await anna('GET', '/api/settings')).body.categories.map((c: any) => c.name)).toEqual(['Shopping', 'To-do', 'Job', 'Garden']);
    expect((await jo('GET', '/api/settings')).body.categories.map((c: any) => c.name)).toEqual(['Shopping', 'To-do', 'Work', 'Home']);
    // Jo cannot file a list under Anna's category
    const garden = (await anna('GET', '/api/settings')).body.categories.at(-1).id;
    expect((await jo('POST', '/api/tasklists', { title: 'Weeds', date: null, items: [], categoryId: garden })).status).toBe(400);
  });

  it('Jo\'s If-Match is his own version: Anna\'s changes never make it stale', async () => {
    const { jo, anna } = await twoPeople();
    const v = (await jo('GET', '/api/settings')).body.version;
    await anna('PATCH', '/api/settings', { sounds: true });
    const cookieJo = await sessionCookie(t, JO);
    expect((await t.json('PATCH', '/api/settings', { sounds: true }, { 'If-Match': String(v), cookie: cookieJo })).status).toBe(200);
  });

  it('a shared list still shows the owner\'s category to the member', async () => {
    const { jo, anna } = await twoPeople();
    const cat = (await jo('POST', '/api/categories', { name: 'Garden', color: '#0b8043', icon: '🌻' })).body.categories.at(-1);
    const own = (await jo('POST', '/api/tasklists', { title: 'Weeds', date: null, items: [{ title: 'Pull' }], categoryId: cat.id })).body;
    const shared = (await jo('POST', `/api/tasklists/${own.id}/share`, { person: mockSub(ANNA) })).body;
    const hers = (await anna('GET', `/api/tasklists/${shared.id}`)).body;
    expect(hers).toMatchObject({ categoryId: cat.id, categoryInfo: { name: 'Garden', icon: '🌻', color: '#0b8043' } });
    expect((await anna('GET', '/api/settings')).body.categories.map((c: any) => c.name)).not.toContain('Garden');
  });

  it('stores each person\'s settings in their own folder', async () => {
    const { anna } = await twoPeople();
    await anna('PATCH', '/api/settings', { defaultView: 'day' });
    const file = path.join(t.dir, 'users', mockSub(ANNA), 'settings.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).defaultView).toBe('day');
    expect(fs.existsSync(path.join(t.dir, 'settings.json'))).toBe(false);
  });
});

describe('two people\'s streak and plant are separate', () => {
  it('Anna checking in and earning plant points leaves Jo at zero', async () => {
    const { jo, anna } = await twoPeople();
    await anna('POST', '/api/streak/checkin');
    await anna('POST', '/api/tasklists', { title: 'Weeds', date: null, items: [] });
    expect((await anna('GET', '/api/motivation')).body.streak.current).toBe(1);
    const mine = (await jo('GET', '/api/motivation')).body;
    expect(mine.streak).toMatchObject({ current: 0, best: 0, lastCheckIn: null });
    expect(mine.plant.growth).toBe(0);
  });
});

describe('moving the server-wide settings to every person (once, on start)', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
  const SUB_A = 'sub-jo', SUB_B = 'sub-anna';
  const start = (dir: string) => buildApp({ ...loadConfig({ DATA_DIR: dir, TEST_MODE: 'false' }), webDist: null });
  const read = (dir: string, ...p: string[]) => JSON.parse(fs.readFileSync(path.join(dir, ...p), 'utf8'));

  function oldServer(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-split-')); dirs.push(d);
    fs.writeFileSync(path.join(d, 'people.json'), JSON.stringify({ [SUB_A]: { email: JO }, [SUB_B]: { email: ANNA } }));
    fs.writeFileSync(path.join(d, 'settings.json'), JSON.stringify({
      themeMode: 'dark', seedColor: '#1a73e8', defaultView: 'week', animationLevel: 'reduced', sounds: true, calmMode: true, ignoreSystemMotion: false,
      sunflowers: 'full', categories: [{ id: 'pets', name: 'Pets', color: '#aabbcc', icon: null, googleColorId: '7' }], updated: '2026-10-01T10:00:00+02:00',
      version: 9, scene: 'mordor',
    }));
    fs.writeFileSync(path.join(d, 'motivation.json'), JSON.stringify({ checkIns: ['2026-10-30'], current: 4, best: 6, lastCheckIn: '2026-10-30', growth: 80 }));
    return d;
  }

  it('copies the settings and the streak to every known person and keeps the old files as .bak', () => {
    const d = oldServer();
    start(d).close();
    for (const sub of [SUB_A, SUB_B]) {
      expect(read(d, 'users', sub, 'settings.json')).toMatchObject({ defaultView: 'week', calmMode: true, sunflowers: 'full', version: 9, scene: 'mordor' });
      expect(read(d, 'users', sub, 'settings.json').categories.map((c: any) => c.name)).toEqual(['Pets']);
      expect(read(d, 'users', sub, 'motivation.json')).toMatchObject({ current: 4, best: 6, growth: 80 });
    }
    expect(fs.existsSync(path.join(d, 'settings.json'))).toBe(false);
    expect(fs.existsSync(path.join(d, 'motivation.json'))).toBe(false);
    expect(read(d, 'settings.json.bak').defaultView).toBe('week');
    expect(read(d, 'motivation.json.bak').growth).toBe(80);
  });

  it('serves the copied values and the old top bar scene to each person', async () => {
    const d = oldServer();
    const app = start(d);
    try {
      expect(app.ctx.settings.get(SUB_B)).toMatchObject({ defaultView: 'week', themeMode: 'dark' });
      expect(app.ctx.settings.get(SUB_B)).not.toHaveProperty('scene');
      expect(app.ctx.settings.legacyTopBarScene(SUB_B)).toBe('mordor');
      expect(app.ctx.settings.get('somebody-new')).toMatchObject({ defaultView: 'month', calmMode: false });
    } finally { app.close(); }
  });

  it('runs once: a second start changes nothing a person saved since', () => {
    const d = oldServer();
    start(d).close();
    const f = path.join(d, 'users', SUB_A, 'settings.json');
    fs.writeFileSync(f, JSON.stringify({ ...read(d, 'users', SUB_A, 'settings.json'), defaultView: 'day' }));
    start(d).close();
    expect(read(d, 'users', SUB_A, 'settings.json').defaultView).toBe('day');
    expect(read(d, 'settings.json.bak').defaultView).toBe('week');
  });

  it('never overwrites a person\'s own file and finishes after an interrupted run', () => {
    const d = oldServer();
    fs.mkdirSync(path.join(d, 'users', SUB_A), { recursive: true });
    fs.writeFileSync(path.join(d, 'users', SUB_A, 'settings.json'), JSON.stringify({ defaultView: 'day', version: 2 }));
    start(d).close();
    expect(read(d, 'users', SUB_A, 'settings.json').defaultView).toBe('day');
    expect(read(d, 'users', SUB_B, 'settings.json').defaultView).toBe('week');
  });

  it('a server without sign-in keeps its settings for the one person it has', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-split-')); dirs.push(d);
    fs.writeFileSync(path.join(d, 'settings.json'), JSON.stringify({ defaultView: 'week', version: 3 }));
    const app = start(d);
    try {
      expect(app.ctx.settings.get('local').defaultView).toBe('week');
    } finally { app.close(); }
  });
});
