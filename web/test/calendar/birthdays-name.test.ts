/** The virtual Birthdays calendar is named in the app's language; the device copy keeps the server's name. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyLanguage } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';
import { freshPinia } from '../helpers';

const birthdays = { id: 'birthdays', name: 'Birthdays', color: '#9fc6e7', primary: false, writable: false, hidden: false, defaultReminders: [], virtual: true };
const work = { id: 'work', name: 'Work', color: '#039be5', primary: false, writable: true, hidden: false, defaultReminders: [] };

describe('the Birthdays calendar name', () => {
  beforeEach(() => freshPinia());
  afterEach(() => applyLanguage('en', ['en']));

  it('follows the app language, also when it changes, and leaves other calendars alone', async () => {
    await applyLanguage('de', ['de']);
    const cals = useCalendarsStore();
    cals.fromDevice([birthdays, work] as never);
    expect(cals.list.map((c) => c.name)).toEqual(['Geburtstage', 'Work']);
    await applyLanguage('en', ['en']);
    expect(cals.list.map((c) => c.name)).toEqual(['Birthdays', 'Work']);
  });
});
