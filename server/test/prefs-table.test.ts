import { describe, expect, it } from 'vitest';
import { defaultPrefs, parsePrefsPatch, PREFS, PREF_KEYS, readPrefs } from '@calendar/shared/prefs';

describe('the preferences table (shared/prefs.js)', () => {
  it('accepts every default through its own validation', () => {
    for (const k of PREF_KEYS) expect(PREFS[k].parse(PREFS[k].default, k), k).toEqual({ value: PREFS[k].default });
  });

  it('reads nothing and garbage as the defaults, keeping valid fields', () => {
    expect(readPrefs(null)).toEqual(defaultPrefs());
    expect(readPrefs({ streak: 'flame', navPhone: 'left', bedtime: { enabled: true, mode: 'x' }, labs: 'yes' })).toEqual({ ...defaultPrefs(), streak: 'flame' });
    expect(readPrefs({ bedtime: { enabled: true, wake: '06:30' } }).bedtime).toEqual({ ...defaultPrefs().bedtime, enabled: true, wake: '06:30' });
  });

  it('hands out fresh objects, so a change never reaches the defaults', () => {
    defaultPrefs().notify.morning = true;
    expect(defaultPrefs().notify.morning).toBe(false);
  });

  it('merges object preferences over the current value and names the first bad field', () => {
    const cur = defaultPrefs();
    expect(parsePrefsPatch({ notify: { morning: true }, labsViews: { clock: true } }, cur)).toEqual({ patch: { notify: { ...cur.notify, morning: true }, labsViews: { clock: true } } });
    expect(parsePrefsPatch({ streak: 'both' }, cur)).toEqual({ error: 'streak must be off, flame or plant', field: 'streak' });
    expect(parsePrefsPatch({ bedtime: { bedtime: '7:15' } }, cur)).toEqual({ error: 'bedtime.bedtime must be HH:MM', field: 'bedtime' });
  });
});
