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

describe('calendarPlans (feature calendar-off-plan)', () => {
  const win = { from: { day: 5, time: '17:00' }, to: { day: 0, time: '16:00' } };

  it('accepts weekly windows and an off-for-a-while together', () => {
    const plans = { work: { windows: [win], until: '2026-11-10', since: '2026-11-08T17:00', switchedAt: '2026-11-07T10:00' } };
    expect(parsePrefsPatch({ calendarPlans: plans }, defaultPrefs())).toEqual({ patch: { calendarPlans: plans } });
  });

  it('refuses a window that starts where it ends, a bad day or time, and a bad date', () => {
    for (const bad of [
      { work: { windows: [{ from: { day: 1, time: '08:00' }, to: { day: 1, time: '08:00' } }] } },
      { work: { windows: [{ from: { day: 7, time: '08:00' }, to: { day: 1, time: '09:00' } }] } },
      { work: { windows: [{ from: { day: 1, time: '8:00' }, to: { day: 1, time: '09:00' } }] } },
      { work: { until: '10.11.2026' } },
      { work: { extra: 1 } },
      [],
    ]) expect(parsePrefsPatch({ calendarPlans: bad }, defaultPrefs())).toEqual({ error: 'Invalid calendarPlans', field: 'calendarPlans' });
  });

  it('replaces the plans as a whole, so removing a calendar removes its plan', () => {
    const cur = { ...defaultPrefs(), calendarPlans: { work: { until: '2026-11-06' } } };
    expect(parsePrefsPatch({ calendarPlans: {} }, cur)).toEqual({ patch: { calendarPlans: {} } });
  });
});
