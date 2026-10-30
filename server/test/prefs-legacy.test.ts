import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { defaultPrefs } from '@calendar/shared/prefs';
import { PrefsStore } from '../src/services/prefsStore.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-prefs-legacy-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Writes `doc` as a person's `prefs.json` and reads it back through the store, as the server does on start. */
function load(doc: unknown) {
  fs.mkdirSync(path.join(dir, 'users', 'p'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'users', 'p', 'prefs.json'), JSON.stringify(doc));
  const store = new PrefsStore(dir);
  return { store, prefs: store.labsPrefs('p') };
}

// Golden outputs are what main's old `normalise` (server/src/services/prefsStore.ts) answered for the same file.
describe('legacy prefs.json values read as the old normalise did', () => {
  it('reads a default-true boolean as true unless it is exactly false, and a default-false one as false unless exactly true', () => {
    expect(load({ approachBar: 'no', approachingCard: 0, showCarriedFrom: null }).prefs).toMatchObject({ approachBar: true, approachingCard: true, showCarriedFrom: true });
    expect(load({ approachBar: false }).prefs.approachBar).toBe(false);
    expect(load({ labs: 'yes', leftHanded: 1, weekTwoRow: [] }).prefs).toMatchObject({ labs: false, leftHanded: false, weekTwoRow: false });
  });

  it('reads weekTwoRowTop as 3 only for the number 3', () => {
    expect(load({ weekTwoRowTop: '3' }).prefs.weekTwoRowTop).toBe(4);
    expect(load({ weekTwoRowTop: 5 }).prefs.weekTwoRowTop).toBe(4);
    expect(load({ weekTwoRowTop: 3 }).prefs.weekTwoRowTop).toBe(3);
  });

  it('falls back whole objects to their defaults when one bedtime or notify field is bad', () => {
    expect(load({ bedtime: { enabled: true, wake: '06:30', sleepMinutes: 5 } }).prefs.bedtime).toEqual(defaultPrefs().bedtime);
    expect(load({ bedtime: [] }).prefs.bedtime).toEqual(defaultPrefs().bedtime);
    expect(load({ notify: { morning: true, morningTime: '8:00' } }).prefs.notify).toEqual(defaultPrefs().notify);
    expect(load({ bedtime: { enabled: true, wake: '06:30' } }).prefs.bedtime).toEqual({ ...defaultPrefs().bedtime, enabled: true, wake: '06:30' });
  });

  it('reads a tasksFilter that is an array, or has an extra key, as the default', () => {
    expect(load({ tasksFilter: [] }).prefs.tasksFilter).toEqual({ categories: [], when: 'all' });
    expect(load({ tasksFilter: { categories: [], when: 'all', x: 1 } }).prefs.tasksFilter).toEqual({ categories: [], when: 'all' });
    expect(load({ tasksFilter: { categories: ['a'], when: 'week' } }).prefs.tasksFilter).toEqual({ categories: ['a'], when: 'week' });
  });

  it('reads other bad values as defaults', () => {
    expect(load({ approachWindowHours: 3.5, language: 'fr', navPhone: 'left', minEventMinutes: 20, daySideBySide: 5, weekSideBySide: 4, streak: true, labsViews: { 'Bad Id': true } }).prefs)
      .toMatchObject({ approachWindowHours: 3, language: 'auto', navPhone: 'bottom', minEventMinutes: 0, daySideBySide: 4, weekSideBySide: 2, streak: 'off', labsViews: {} });
  });

  it('keeps unknown keys, the theme and the hidden calendars, and repairs a bad hiddenCalendars', () => {
    const theme = { preset: 'Neon', overrides: {}, seasonal: 'header', seasonalMigrated: true };
    const { store } = load({ mystery: 7, theme, hiddenCalendars: ['c1'], tasksCalendarId: 'tc' });
    expect(store['read']('p')).toMatchObject({ mystery: 7, theme, hiddenCalendars: ['c1'], tasksCalendarId: 'tc' });
    expect(store.theme('p')).toEqual({ preset: 'Neon', overrides: {}, seasonal: 'header' });
    expect(store.hiddenCalendars('p')).toEqual(['c1']);
    expect(load({ hiddenCalendars: 'c1', tasksCalendarId: 5 }).store['read']('p')).toMatchObject({ hiddenCalendars: [], tasksCalendarId: null });
  });
});
