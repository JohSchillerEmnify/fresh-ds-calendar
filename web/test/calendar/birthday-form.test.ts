import { describe, expect, it } from 'vitest';
import { birthdayPatch, formFromEvent, newForm, toBirthdayInput, validateBirthday } from '@/features/calendar/eventForm';
import type { CalendarEvent } from '@/api/types';

const lena: CalendarEvent = {
  kind: 'event', id: 'b1_20261015', calendarId: 'primary', title: 'Lena', description: '', location: '', allDay: true, start: '2026-10-15', end: '2026-10-16',
  colorId: null, color: '#039be5', special: 'birthday', reminders: { useDefault: true, minutes: [] }, etag: '"1"', updated: '',
};

describe('birthday form', () => {
  it('needs a name and a date', () => {
    const f = newForm('2026-10-15', null, 'primary', null);
    expect(validateBirthday(f)?.field).toBe('title');
    expect(validateBirthday({ ...f, title: 'Lena' })).toBeNull();
    expect(validateBirthday({ ...f, title: 'Lena', startDate: '' })?.field).toBe('startDate');
    expect(validateBirthday({ ...f, title: 'x'.repeat(201) })?.field).toBe('title');
  });

  it('builds the create body from name, date and colour only', () => {
    expect(toBirthdayInput({ ...newForm('2026-10-15', null, 'primary', '4'), title: ' Lena ' })).toEqual({ kind: 'birthday', title: 'Lena', date: '2026-10-15', colorId: '4' });
    expect(toBirthdayInput({ ...newForm('2028-02-29', null, 'primary', null), title: 'Leap' })).toEqual({ kind: 'birthday', title: 'Leap', date: '2028-02-29', colorId: null });
  });

  it('patches only what changed, the date as a one-day all-day range', () => {
    const f = formFromEvent(lena);
    expect(birthdayPatch(f, lena)).toEqual({});
    expect(birthdayPatch({ ...f, title: 'Lena M.', colorId: '2', startDate: '2026-10-16' }, lena))
      .toEqual({ title: 'Lena M.', colorId: '2', allDay: true, start: '2026-10-16', end: '2026-10-17' });
    expect(birthdayPatch({ ...f, startDate: '2028-02-29' }, lena)).toMatchObject({ start: '2028-02-29', end: '2028-03-01' });
  });
});
