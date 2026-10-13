import { describe, expect, it } from 'vitest';
import { PRESET_NAMES, PRESETS, automaticPreset, presetFor, seasonScene, resolveTheme, sanitizePref, seasonOf } from '@/theme/presets';

describe('theme presets', () => {
  it('maps dates to seasons at the month boundaries', () => {
    expect(['2026-02-28', '2026-03-01', '2026-05-31', '2026-06-01', '2026-08-31', '2026-09-01', '2026-11-30', '2026-12-01'].map(seasonOf))
      .toEqual(['Winter', 'Spring', 'Spring', 'Summer', 'Summer', 'Fall', 'Fall', 'Winter']);
  });
  it('resolves Automatic to Halloween for all of October and to Fall again in November', () => {
    expect(['2026-09-30', '2026-10-01', '2026-10-12', '2026-10-31', '2026-11-01', '2026-11-10'].map(automaticPreset))
      .toEqual(['Fall', 'Halloween', 'Halloween', 'Halloween', 'Fall', 'Fall']);
    expect(presetFor('Automatic', '2026-10-12').name).toBe('Halloween');
    expect(seasonScene('2026-10-12')).toBe('halloween');
    expect(seasonScene('2026-11-10')).toBe('fall');
  });
  it('offers Halloween after Fall: pumpkin orange, keeps the person\'s mode, brings its own scene', () => {
    expect(PRESET_NAMES.slice(4, 7)).toEqual(['Fall', 'Halloween', 'Winter']);
    expect(PRESETS.Halloween).toMatchObject({ mode: null, attrs: { scene: 'halloween' } });
    expect(PRESETS.Halloween.seed).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('resolves Automatic to the season and applies overrides', () => {
    const r = resolveTheme({ preset: 'Automatic', overrides: { entries: 'outline' } }, '2026-04-10');
    expect(r.name).toBe('Spring');
    expect(r.attrs.entries).toBe('outline');
    expect(r.attrs.scene).toBe('spring');
  });
  it('resolves the automatic Season scene by date and keeps an explicit scene as picked', () => {
    expect(resolveTheme({ preset: 'Default', overrides: { scene: 'season' } }, '2026-04-10').attrs.scene).toBe('spring');
    expect(resolveTheme({ preset: 'Default', overrides: { scene: 'season' } }, '2026-10-10').attrs.scene).toBe('halloween');
    expect(resolveTheme({ preset: 'Default', overrides: { scene: 'halloween' } }, '2026-04-10').attrs.scene).toBe('halloween');
    expect(resolveTheme({ preset: 'Spring', overrides: {} }, '2026-10-10').attrs.scene).toBe('spring');
  });
  it('lets the season presets keep the person\'s mode; only Neon and Mordor force dark', () => {
    expect((['Spring', 'Summer', 'Fall', 'Halloween', 'Winter'] as const).map((n) => PRESETS[n].mode)).toEqual([null, null, null, null, null]);
    expect(resolveTheme({ preset: 'Automatic', overrides: {} }, '2026-01-10').mode).toBeNull();
    expect([PRESETS.Neon.mode, PRESETS.Mordor.mode]).toEqual(['dark', 'dark']);
  });
  it('drops unknown stored presets', () => {
    expect(sanitizePref({ preset: 'Nope' }).preset).toBe('Default');
  });
  it('drops retired overrides such as the old support cat switch, so a theme save is not refused', () => {
    expect(sanitizePref({ preset: 'Neon', overrides: { cat: 'off', glow: 'soft' } })).toEqual({ preset: 'Neon', overrides: { glow: 'soft' } });
  });
});
