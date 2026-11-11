/** The virtual Birthdays calendar is named in the app's language; the device copy keeps the server's name. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLanguage } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';
import { useDeviceStore } from '@/stores/device';
import { useHolidaysStore } from '@/stores/holidays';
import { api } from '@/api/client';
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

  it('a holiday calendar added in German keeps the server name in what goes to the device', async () => {
    await applyLanguage('de', ['de']);
    const cals = useCalendarsStore();
    const putCalendars = vi.spyOn(useDeviceStore(), 'putCalendars').mockImplementation(() => undefined);
    cals.fromDevice([birthdays] as never);
    vi.spyOn(api, 'addHolidayCalendar').mockResolvedValue(work as never);
    await useHolidaysStore().add('de', 'official' as never, 'de');
    expect(putCalendars.mock.calls[0]![0].map((c) => c.name)).toEqual(['Birthdays', 'Work']);
    expect(cals.list.map((c) => c.name)).toEqual(['Geburtstage', 'Work']);
  });
});
