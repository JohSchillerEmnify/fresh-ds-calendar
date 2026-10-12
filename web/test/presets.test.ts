import { describe, expect, it } from 'vitest';
import { PRESETS, presetFor, resolveTheme, sanitizePref, seasonOf } from '@/theme/presets';

describe('theme presets', () => {
  it('maps dates to seasons at the month boundaries', () => {
    expect(['2026-02-28', '2026-03-01', '2026-05-31', '2026-06-01', '2026-08-31', '2026-09-01', '2026-11-30', '2026-12-01'].map(seasonOf))
      .toEqual(['Winter', 'Spring', 'Spring', 'Summer', 'Summer', 'Fall', 'Fall', 'Winter']);
  });
  it('resolves Automatic to the season and applies overrides', () => {
    expect(presetFor('Automatic', '2026-10-12').name).toBe('Fall');
    const r = resolveTheme({ preset: 'Automatic', overrides: { entries: 'outline' } }, '2026-04-10');
    expect(r.name).toBe('Spring');
    expect(r.attrs.entries).toBe('outline');
    expect(r.attrs.scene).toBe('spring');
  });
  it('lets the season presets keep the person\'s mode; only Neon and Mordor force dark', () => {
    expect((['Spring', 'Summer', 'Fall', 'Winter'] as const).map((n) => PRESETS[n].mode)).toEqual([null, null, null, null]);
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
