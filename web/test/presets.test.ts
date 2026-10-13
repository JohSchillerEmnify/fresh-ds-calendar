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
    expect(PRESET_NAMES.slice(6, 8)).toEqual(['Fall', 'Halloween']);
    expect(PRESETS.Halloween).toMatchObject({ mode: null, attrs: { scene: 'halloween' } });
    expect(PRESETS.Halloween.seed).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('follows the calendar by priority: New Year\'s Eve, New Year, Christmas, Easter, Halloween, season; never Summer holidays', () => {
    const at = ['2026-11-29', '2026-12-24', '2026-12-31', '2027-01-01', '2027-01-02', '2027-03-25', '2027-04-04', '2027-10-12', '2026-07-10'].map(automaticPreset);
    expect(at).toEqual(['Christmas', 'Christmas', 'New Year\'s Eve', 'New Year', 'Winter', 'Easter', 'Spring', 'Halloween', 'Summer']);
    expect(['2026-11-29', '2026-12-31', '2027-01-01', '2027-03-25'].map(seasonScene)).toEqual(['christmas', 'newyearseve', 'newyear', 'easter']);
    const days = Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2028, 0, 1 + i)).toISOString().slice(0, 10));
    expect(days.map(automaticPreset)).not.toContain('Summer holidays');
  });
  it('offers the holiday presets in the order of the Scene card, each with its own scene, the person\'s mode except a dark New Year\'s Eve', () => {
    expect(PRESET_NAMES).toEqual(['Default', 'Neon', 'Spring', 'Easter', 'Summer', 'Summer holidays', 'Fall', 'Halloween', 'Christmas', 'New Year\'s Eve', 'New Year', 'Winter', 'Mordor', 'Automatic']);
    expect((['Easter', 'Summer holidays', 'Christmas', 'New Year\'s Eve', 'New Year'] as const).map((n) => [PRESETS[n].attrs.scene, PRESETS[n].mode]))
      .toEqual([['easter', null], ['summerholidays', null], ['christmas', null], ['newyearseve', 'dark'], ['newyear', null]]);
  });
  it('the season scene override follows the calendar on any theme and leaves its colours alone', () => {
    const r = resolveTheme({ preset: 'Neon', overrides: { scene: 'season' } }, '2026-12-24');
    expect(r).toMatchObject({ name: 'Neon', seed: PRESETS.Neon.seed, attrs: { glow: 'neon', scene: 'christmas' } });
    // an imported theme's own picture is replaced by the calendar's scene... only through the override; without it the own picture stays
    const doc = { schema: 'calendar-theme/2', name: 'Mine', colors: { seed: '#112233' }, scene: { gradient: ['#000000', '#ffffff'] } } as never;
    expect(resolveTheme({ preset: 'theme:a1', overrides: {} }, '2026-04-20', { a1: { doc } }).attrs.scene).toBe('custom');
    expect(resolveTheme({ preset: 'theme:a1', overrides: { scene: 'season' } }, '2026-04-20', { a1: { doc } })).toMatchObject({ seed: '#112233', attrs: { scene: 'spring' } });
  });
  it('Automatic follows with colours and scene by default; a picked scene stops the scene following', () => {
    expect(resolveTheme({ preset: 'Automatic', overrides: {} }, '2026-12-24')).toMatchObject({ name: 'Christmas', attrs: { scene: 'christmas' } });
    expect(resolveTheme({ preset: 'Automatic', overrides: { scene: 'mordor' } }, '2026-12-24')).toMatchObject({ name: 'Christmas', attrs: { scene: 'mordor' } });
  });
  it('drops fields a stored preference no longer has (the retired Automatic follows settings)', () => {
    expect(sanitizePref({ preset: 'Automatic', automatic: 'scene', automaticBase: 'Neon' })).toEqual({ preset: 'Automatic', overrides: {} });
  });
  it('resolves Automatic to the season and applies overrides', () => {
    const r = resolveTheme({ preset: 'Automatic', overrides: { entries: 'outline' } }, '2026-04-20');
    expect(r.name).toBe('Spring');
    expect(r.attrs.entries).toBe('outline');
    expect(r.attrs.scene).toBe('spring');
  });
  it('resolves the automatic Season scene by date and keeps an explicit scene as picked', () => {
    expect(resolveTheme({ preset: 'Default', overrides: { scene: 'season' } }, '2026-04-20').attrs.scene).toBe('spring');
    expect(resolveTheme({ preset: 'Default', overrides: { scene: 'season' } }, '2026-10-10').attrs.scene).toBe('halloween');
    expect(resolveTheme({ preset: 'Default', overrides: { scene: 'halloween' } }, '2026-04-20').attrs.scene).toBe('halloween');
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
