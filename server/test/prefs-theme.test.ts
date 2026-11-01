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
  it('defaults to the Default preset without overrides, with header + colours on', async () => {
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Default', overrides: {}, seasonal: 'all' });
  });

  it('stores the preset and overrides and keeps hidden calendars intact', async () => {
    const r = await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon', overrides: { entries: 'outline' } });
    expect(r.status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Neon', overrides: { entries: 'outline' }, seasonal: 'all' });
    const cals = (await t.json('GET', '/api/calendars')).body.calendars;
    await t.json('PATCH', `/api/calendars/${encodeURIComponent(cals[0].id)}`, { hidden: true });
    expect((await t.json('GET', '/api/prefs/theme')).body.preset).toBe('Neon');
  });

  it('stores the Halloween preset and its scene', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Halloween', overrides: { scene: 'halloween' } })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Halloween', overrides: { scene: 'halloween' }, seasonal: 'all' });
  });

  it('stores the holiday presets and their scenes', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: "New Year's Eve", overrides: { scene: 'newyearseve' } })).status).toBe(200);
    for (const scene of ['easter', 'summerholidays', 'christmas', 'newyear']) expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { scene } })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: "New Year's Eve", overrides: { scene: 'newyear' }, seasonal: 'all' });
  });

  it('stores seasons & holidays and keeps it when only the preset or overrides change', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { seasonal: 'header' })).body).toEqual({ preset: 'Default', overrides: {}, seasonal: 'header' });
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon' })).body.seasonal).toBe('header');
    expect((await t.json('PATCH', '/api/prefs/theme', { seasonal: 'off', overrides: { scene: 'mordor' } })).body).toEqual({ preset: 'Neon', overrides: { scene: 'mordor' }, seasonal: 'off' });
  });

  it('stores the fine-tuning overrides and rejects out-of-range ones', async () => {
    const fine = { glowStrength: 70, radius: 4, tint: 30, density: 'compact', checkbox: 'square', checkFill: 'outline', check: 'cross', icons: 'sharp' };
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: fine })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body.overrides).toEqual(fine);
    for (const bad of [{ glowStrength: 151 }, { glowStrength: -1 }, { radius: 29 }, { radius: 1.5 }, { tint: 4 }, { tint: '30' }, { density: 'tiny' }, { checkbox: 'star' }, { check: 'x' }, { icons: 'filled' }]) {
      expect((await t.json('PATCH', '/api/prefs/theme', { overrides: bad })).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('rejects unknown presets and values', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Midsummer' })).status).toBe(400);
    // Automatic and the season sentinel are gone; the seasonal setting is checked
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Automatic' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { scene: 'season' } })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { seasonal: 'sometimes' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { glow: 'blinding' } })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { cat: 'off' } })).status).toBe(400);
  });
});

describe('one scene choice (migration of the retired top bar scene)', () => {
  const dirs: string[] = [];
  const store = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-scene-')); dirs.push(d); return { d, prefs: new PrefsStore(d) }; };
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it('accepts every single season scene', async () => {
    for (const scene of ['spring', 'summer', 'fall', 'halloween', 'winter']) {
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
    const { d, prefs } = store();
    prefs.setTheme('local', { preset, overrides, seasonal: 'off' });
    // setTheme marks the theme as migrated, so write the pre-migration state by hand
    const f = path.join(d, 'users', 'local', 'prefs.json');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    delete j.theme.sceneUnified;
    fs.writeFileSync(f, JSON.stringify(j));
    prefs.migrateScene('local', legacy);
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected, seasonal: 'off' });
    // a second run changes nothing
    prefs.migrateScene('local', 'none');
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected, seasonal: 'off' });
  });

  it('migrates a person who never chose a theme, and does nothing without an old scene', () => {
    const { prefs } = store();
    prefs.migrateScene('local', undefined);
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: {}, seasonal: 'all' });
    prefs.migrateScene('local', 'mordor');
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: { scene: 'mordor' }, seasonal: 'all' });
  });

  it('keeps the old scene on disk but does not serve it', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-scene-')); dirs.push(d);
    const f = path.join(d, 'users', 'local', 'settings.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ scene: 'mordor', garden: 'off', version: 3 }));
    const s = new SettingsStore(d, { real: () => new Date() } as never, 'UTC');
    expect(s.get('local')).not.toHaveProperty('scene');
    expect(s.legacyTopBarScene('local')).toBe('mordor');
    s.update('local', (x) => { x.sounds = true; });
    expect(JSON.parse(fs.readFileSync(f, 'utf8')).scene).toBe('mordor');
  });
});

describe('scene and plant (migration of the retired garden style)', () => {
  const dirs: string[] = [];
  const settingsWith = (stored: object) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-garden-')); dirs.push(d);
    const f = path.join(d, 'users', 'local', 'settings.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ version: 3, ...stored }));
    return { d: path.dirname(f), s: new SettingsStore(d, { real: () => new Date() } as never, 'UTC') };
  };
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it.each(['plant', 'sunflowers', 'off'])('stored garden %s is kept on disk for the scene migration but not served', (garden) => {
    const { d, s } = settingsWith({ garden });
    expect(s.get('local')).toMatchObject({ sunflowers: 'grow' });
    expect(s.get('local')).not.toHaveProperty('garden');
    expect(s.legacyGarden('local')).toBe(garden);
    s.update('local', (x) => { x.sounds = true; });
    expect(JSON.parse(fs.readFileSync(path.join(d, 'settings.json'), 'utf8'))).toMatchObject({ garden });
  });

  it('settings without a stored garden keep the defaults', () => {
    const { s } = settingsWith({});
    expect(s.get('local')).toMatchObject({ sunflowers: 'grow' });
    expect(s.legacyGarden('local')).toBeUndefined();
  });

  // owner, 2026-10-26: the switches became the person pref `streak`, Off for everyone, so nothing is carried over
  it('drops the retired flame and plant switches on load and after a restored backup, and writes the file without them', () => {
    const { d, s } = settingsWith({ streakFlame: false, plant: true, garden: 'plant' });
    expect(s.get('local')).not.toHaveProperty('streakFlame');
    expect(s.get('local')).not.toHaveProperty('plant');
    s.update('local', (x) => { x.sounds = true; });
    const onDisk = () => JSON.parse(fs.readFileSync(path.join(d, 'settings.json'), 'utf8'));
    expect(onDisk()).not.toHaveProperty('streakFlame');
    expect(onDisk()).not.toHaveProperty('plant');
    // a restored older backup puts them back on disk; the next read drops them again
    fs.writeFileSync(path.join(d, 'settings.json'), JSON.stringify({ ...onDisk(), streakFlame: true, plant: true }));
    expect(s.get('local')).not.toHaveProperty('streakFlame');
    expect(s.get('local')).not.toHaveProperty('plant');
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
    prefs.setTheme('local', { preset, overrides, seasonal: 'off' });
    // setTheme marks the theme as migrated, so write the pre-migration state by hand
    const f = path.join(d, 'users', 'local', 'prefs.json');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    delete j.theme.gardenMigrated;
    fs.writeFileSync(f, JSON.stringify(j));
    prefs.migrateGarden('local', garden);
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected, seasonal: 'off' });
    // a second run changes nothing
    prefs.migrateGarden('local', garden === 'sunflowers' ? 'plant' : 'sunflowers');
    expect(prefs.theme('local')).toEqual({ preset, overrides: expected, seasonal: 'off' });
  });

  it('migrates a person who never chose a theme, and does nothing without an old garden style', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-garden-')); dirs.push(d);
    const prefs = new PrefsStore(d);
    prefs.migrateGarden('local', undefined);
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: {}, seasonal: 'all' });
    prefs.migrateGarden('local', 'sunflowers');
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: { scene: 'sunflowers' }, seasonal: 'all' });
  });
});

describe('seed colour as theme fine-tuning', () => {
  it('stores a seed override with the preset and refuses a bad colour', async () => {
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon', overrides: { seed: '#386A20', glow: 'soft' } })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body).toEqual({ preset: 'Neon', overrides: { seed: '#386A20', glow: 'soft' }, seasonal: 'all' });
    expect((await t.json('PATCH', '/api/prefs/theme', { overrides: { seed: 'green' } })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon', overrides: {} })).body.overrides).toEqual({});
  });
});

describe('seasons & holidays (migration of the preset Automatic and the season scene)', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
  /** A prefs store whose stored theme is written by hand, as an older build left it (no marker). */
  const withStored = (theme: object) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-seasonal-')); dirs.push(d);
    fs.mkdirSync(path.join(d, 'users', 'local'), { recursive: true });
    fs.writeFileSync(path.join(d, 'users', 'local', 'prefs.json'), JSON.stringify({ theme }));
    return new PrefsStore(d);
  };

  it.each([
    [{ preset: 'Automatic', overrides: {} }, { preset: 'Default', overrides: {}, seasonal: 'all' }],
    [{ preset: 'Automatic', overrides: { scene: 'season', glow: 'soft' } }, { preset: 'Default', overrides: { glow: 'soft' }, seasonal: 'all' }],
    [{ preset: 'Neon', overrides: { scene: 'season' } }, { preset: 'Neon', overrides: {}, seasonal: 'header' }],
    [{ preset: 'Neon', overrides: { scene: 'mordor' } }, { preset: 'Neon', overrides: { scene: 'mordor' }, seasonal: 'off' }],
    [{ preset: 'Spring', overrides: {} }, { preset: 'Spring', overrides: {}, seasonal: 'off' }],
  ])('stored %j is served as %j', (stored, served) => {
    expect(withStored(stored).theme('local')).toEqual(served);
  });

  it('migrates once: after a save the marker keeps what the person chose', () => {
    const prefs = withStored({ preset: 'Automatic', overrides: {} });
    prefs.setTheme('local', { preset: 'Neon', seasonal: 'header' });
    expect(prefs.theme('local')).toEqual({ preset: 'Neon', overrides: {}, seasonal: 'header' });
    prefs.setTheme('local', { seasonal: 'off' });
    expect(prefs.theme('local').seasonal).toBe('off');
  });

  it('the older scene migrations keep a stored Automatic as Default + all and write the marker', () => {
    const prefs = withStored({ preset: 'Automatic', overrides: {} });
    prefs.migrateScene('local', 'mordor');
    expect(prefs.theme('local')).toEqual({ preset: 'Default', overrides: {}, seasonal: 'all' });
  });
});
