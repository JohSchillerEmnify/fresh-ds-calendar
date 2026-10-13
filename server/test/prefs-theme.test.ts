import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrefsStore } from '../src/services/prefsStore.js';
import { SettingsStore } from '../src/services/settingsStore.js';
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
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { cat: 'off' } })).status).toBe(400);
  });
});

describe('one scene choice (migration of the retired top bar scene)', () => {
  const dirs: string[] = [];
  const store = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-scene-')); dirs.push(d); return { d, prefs: new PrefsStore(d) }; };
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it('accepts sunflowers as a theme scene', async () => {
    const r = await t.json('PATCH', '/api/prefs/theme', { overrides: { scene: 'sunflowers' } });
    expect(r.body.overrides).toEqual({ scene: 'sunflowers' });
  });

  it.each([
    ['Default', {}, 'mordor', { scene: 'mordor' }],
    ['Neon', { scene: 'none' }, 'none', { scene: 'none' }],
    ['Default', {}, 'sunflowers', { scene: 'sunflowers' }],
    ['Spring', {}, 'mordor', {}],
    ['Fall', { scene: 'none' }, 'mordor', { scene: 'mordor' }],
    ['Default', { scene: 'winter' }, 'mordor', { scene: 'winter' }],
  ])('%s with overrides %j and old top bar scene %s becomes %j', (preset, overrides, legacy, expected) => {
    const { prefs } = store();
    prefs.setTheme('local', { preset, overrides });
    // setTheme marks the theme as migrated, so write the pre-migration state by hand
    const f = path.join(prefs['dataDir'], 'users', 'local', 'prefs.json');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    delete j.theme.sceneUnified;
    fs.writeFileSync(f, JSON.stringify(j));
    prefs.migrateScene('local', legacy);
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected });
    // a second run changes nothing
    prefs.migrateScene('local', 'none');
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected });
  });

  it('migrates a person who never chose a theme, and does nothing without an old scene', () => {
    const { prefs } = store();
    prefs.migrateScene('local', undefined);
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: {} });
    prefs.migrateScene('local', 'mordor');
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: { scene: 'mordor' } });
  });

  it('keeps the old scene on disk but does not serve it', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-scene-')); dirs.push(d);
    fs.writeFileSync(path.join(d, 'settings.json'), JSON.stringify({ scene: 'mordor', garden: 'off', version: 3 }));
    const s = new SettingsStore(d, { real: () => new Date() } as never, 'UTC');
    expect(s.get()).not.toHaveProperty('scene');
    expect(s.legacyTopBarScene()).toBe('mordor');
    s.update((x) => { x.garden = 'plant'; });
    expect(JSON.parse(fs.readFileSync(path.join(d, 'settings.json'), 'utf8')).scene).toBe('mordor');
  });
});
