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

  it('stores the Halloween preset and its scene', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Halloween', overrides: { scene: 'halloween' } })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Halloween', overrides: { scene: 'halloween' } });
  });

  it('rejects unknown presets and values', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Easter' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { glow: 'blinding' } })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { cat: 'off' } })).status).toBe(400);
  });
});

describe('one scene choice (migration of the retired top bar scene)', () => {
  const dirs: string[] = [];
  const store = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-scene-')); dirs.push(d); return { d, prefs: new PrefsStore(d) }; };
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it('accepts the automatic season scene and every single season scene', async () => {
    for (const scene of ['season', 'spring', 'summer', 'fall', 'halloween', 'winter']) {
      expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { scene } })).body.overrides).toEqual({ scene });
    }
  });

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
    s.update((x) => { x.plant = true; });
    expect(JSON.parse(fs.readFileSync(path.join(d, 'settings.json'), 'utf8')).scene).toBe('mordor');
  });
});

describe('scene and plant (migration of the retired garden style)', () => {
  const dirs: string[] = [];
  const settingsWith = (stored: object) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-garden-')); dirs.push(d);
    fs.writeFileSync(path.join(d, 'settings.json'), JSON.stringify({ version: 3, ...stored }));
    return { d, s: new SettingsStore(d, { real: () => new Date() } as never, 'UTC') };
  };
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it.each([['plant', true], ['sunflowers', false], ['off', false]])('stored garden %s becomes plant=%s and is not served', (garden, plant) => {
    const { d, s } = settingsWith({ garden });
    expect(s.get()).toMatchObject({ plant, sunflowers: 'grow' });
    expect(s.get()).not.toHaveProperty('garden');
    expect(s.legacyGarden()).toBe(garden);
    // the old key stays on disk after a save, and a stored plant switch wins over it from then on
    s.update((x) => { x.plant = !plant; });
    expect(JSON.parse(fs.readFileSync(path.join(d, 'settings.json'), 'utf8'))).toMatchObject({ garden, plant: !plant });
    expect(new SettingsStore(d, { real: () => new Date() } as never, 'UTC').get().plant).toBe(!plant);
  });

  it('settings without a stored garden keep the defaults', () => {
    const { s } = settingsWith({});
    expect(s.get()).toMatchObject({ plant: true, sunflowers: 'grow' });
    expect(s.legacyGarden()).toBeUndefined();
  });

  it.each([
    ['sunflowers', 'Default', {}, { scene: 'sunflowers' }],
    ['sunflowers', 'Neon', {}, { scene: 'sunflowers' }],
    ['sunflowers', 'Spring', {}, {}],
    ['sunflowers', 'Default', { scene: 'mordor' }, { scene: 'mordor' }],
    ['sunflowers', 'Default', { scene: 'none' }, { scene: 'none' }],
    ['plant', 'Default', {}, {}],
    ['plant', 'Default', { scene: 'sunflowers' }, { scene: 'none' }],
    ['off', 'Fall', { scene: 'sunflowers' }, { scene: 'none' }],
    ['off', 'Default', { scene: 'mordor' }, { scene: 'mordor' }],
  ])('garden %s with theme %s %j gives overrides %j', (garden, preset, overrides, expected) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-garden-')); dirs.push(d);
    const prefs = new PrefsStore(d);
    prefs.setTheme('local', { preset, overrides });
    // setTheme marks the theme as migrated, so write the pre-migration state by hand
    const f = path.join(d, 'users', 'local', 'prefs.json');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    delete j.theme.gardenMigrated;
    fs.writeFileSync(f, JSON.stringify(j));
    prefs.migrateGarden('local', garden);
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected });
    // a second run changes nothing
    prefs.migrateGarden('local', garden === 'sunflowers' ? 'plant' : 'sunflowers');
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected });
  });

  it('migrates a person who never chose a theme, and does nothing without an old garden style', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-garden-')); dirs.push(d);
    const prefs = new PrefsStore(d);
    prefs.migrateGarden('local', undefined);
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: {} });
    prefs.migrateGarden('local', 'sunflowers');
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: { scene: 'sunflowers' } });
  });
});
