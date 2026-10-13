import { describe, expect, it } from 'vitest';
import { PRESET_NAMES, PRESETS, automaticPreset, seasonScene, resolveTheme, sanitizePref, seasonOf } from '@/theme/presets';

describe('theme presets', () => {
  it('maps dates to seasons at the month boundaries', () => {
    expect(['2026-02-28', '2026-03-01', '2026-05-31', '2026-06-01', '2026-08-31', '2026-09-01', '2026-11-30', '2026-12-01'].map(seasonOf))
      .toEqual(['Winter', 'Spring', 'Spring', 'Summer', 'Summer', 'Fall', 'Fall', 'Winter']);
  });
  it('maps all of October to Halloween and to Fall again in November', () => {
    expect(['2026-09-30', '2026-10-01', '2026-10-12', '2026-10-31', '2026-11-01', '2026-11-10'].map(automaticPreset))
      .toEqual(['Fall', 'Halloween', 'Halloween', 'Halloween', 'Fall', 'Fall']);
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
    expect(PRESET_NAMES).toEqual(['Default', 'Neon', 'Spring', 'Easter', 'Summer', 'Summer holidays', 'Fall', 'Halloween', 'Christmas', 'New Year\'s Eve', 'New Year', 'Winter', 'Mordor']);
    expect((['Easter', 'Summer holidays', 'Christmas', 'New Year\'s Eve', 'New Year'] as const).map((n) => [PRESETS[n].attrs.scene, PRESETS[n].mode]))
      .toEqual([['easter', null], ['summerholidays', null], ['christmas', null], ['newyearseve', 'dark'], ['newyear', null]]);
  });
  const off = { overrides: {}, seasonal: 'off' } as const;
  it('seasonal off applies the chosen theme and the person\'s scene as they are', () => {
    expect(resolveTheme({ preset: 'Neon', ...off }, '2026-12-24')).toMatchObject({ name: 'Neon', seed: PRESETS.Neon.seed, attrs: { glow: 'neon', scene: 'none' } });
    expect(resolveTheme({ preset: 'Spring', overrides: { scene: 'mordor' }, seasonal: 'off' }, '2026-10-10').attrs.scene).toBe('mordor');
    expect(resolveTheme({ preset: 'Spring', ...off }, '2026-10-10').attrs.scene).toBe('spring');
  });
  it('header only brings the calendar\'s scene and leaves the chosen colours alone', () => {
    expect(resolveTheme({ preset: 'Neon', overrides: {}, seasonal: 'header' }, '2026-12-24')).toMatchObject({ name: 'Neon', seed: PRESETS.Neon.seed, mode: 'dark', attrs: { glow: 'neon', scene: 'christmas' } });
    // an imported theme keeps its colours, its own picture gives way to the calendar's scene
    const doc = { schema: 'calendar-theme/2', name: 'Mine', colors: { seed: '#112233' }, scene: { gradient: ['#000000', '#ffffff'] } } as never;
    expect(resolveTheme({ preset: 'theme:a1', ...off }, '2026-04-20', { a1: { doc } }).attrs.scene).toBe('custom');
    expect(resolveTheme({ preset: 'theme:a1', overrides: {}, seasonal: 'header' }, '2026-04-20', { a1: { doc } })).toMatchObject({ seed: '#112233', attrs: { scene: 'spring' } });
  });
  it('header + colours takes the calendar\'s colours and style and its scene, whatever the base is', () => {
    const r = resolveTheme({ preset: 'Neon', overrides: {}, seasonal: 'all' }, '2026-12-24');
    expect(r).toMatchObject({ name: 'Christmas', seed: PRESETS.Christmas.seed, mode: null, attrs: { glow: 'soft', entries: 'tinted', scene: 'christmas' } });
    // New Year's Eve is dark whenever its colours apply
    expect(resolveTheme({ preset: 'Default', overrides: {}, seasonal: 'all' }, '2026-12-31').mode).toBe('dark');
    // an imported theme's role colours do not survive, its font does
    const doc = { schema: 'calendar-theme/2', name: 'Mine', font: 'serif', colors: { seed: '#112233', light: { primary: '#ff0000' } } } as never;
    const own = resolveTheme({ preset: 'theme:a1', overrides: {}, seasonal: 'all' }, '2026-04-20', { a1: { doc } });
    expect(own).toMatchObject({ name: 'Spring', seed: PRESETS.Spring.seed, font: 'serif' });
    expect(own.roles).toBeUndefined();
  });
  it('fine-tuning overrides sit on top; a picked scene wins over the calendar\'s', () => {
    const r = resolveTheme({ preset: 'Default', overrides: { entries: 'outline', seed: '#123456', scene: 'mordor' }, seasonal: 'all' }, '2026-04-20');
    expect(r).toMatchObject({ seed: '#123456', attrs: { entries: 'outline', scene: 'mordor' } });
  });
  it('a new person gets header + colours on Default', () => {
    expect(sanitizePref(null)).toEqual({ preset: 'Default', overrides: {}, seasonal: 'all' });
    expect(resolveTheme(sanitizePref(null), '2026-10-12')).toMatchObject({ name: 'Halloween', attrs: { scene: 'halloween' } });
  });
  it('migrates a cached preference from before the setting: Automatic => Default + all, scene season => header, else off', () => {
    expect(sanitizePref({ preset: 'Automatic', overrides: {} })).toEqual({ preset: 'Default', overrides: {}, seasonal: 'all' });
    expect(sanitizePref({ preset: 'Neon', overrides: { scene: 'season', glow: 'soft' } })).toEqual({ preset: 'Neon', overrides: { glow: 'soft' }, seasonal: 'header' });
    expect(sanitizePref({ preset: 'Neon', overrides: { scene: 'mordor' } })).toEqual({ preset: 'Neon', overrides: { scene: 'mordor' }, seasonal: 'off' });
    expect(sanitizePref({ preset: 'Neon', overrides: {}, seasonal: 'header' }).seasonal).toBe('header');
  });
  it('lets the season presets keep the person\'s mode; only Neon and Mordor force dark', () => {
    expect((['Spring', 'Summer', 'Fall', 'Halloween', 'Winter'] as const).map((n) => PRESETS[n].mode)).toEqual([null, null, null, null, null]);
    expect(resolveTheme({ preset: 'Default', overrides: {}, seasonal: 'all' }, '2026-01-10').mode).toBeNull();
    expect([PRESETS.Neon.mode, PRESETS.Mordor.mode]).toEqual(['dark', 'dark']);
  });
  it('drops unknown stored presets', () => {
    expect(sanitizePref({ preset: 'Nope' }).preset).toBe('Default');
  });
  it('drops retired overrides such as the old support cat switch, so a theme save is not refused', () => {
    expect(sanitizePref({ preset: 'Neon', overrides: { cat: 'off', glow: 'soft' } })).toEqual({ preset: 'Neon', overrides: { glow: 'soft' }, seasonal: 'off' });
  });
});
