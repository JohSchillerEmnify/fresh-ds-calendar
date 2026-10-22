import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { diffInput, formFromEvent, newForm, ownReminders, toInput } from '@/features/calendar/eventForm';
import { formatLead, formatLeads, pushPlan, reminderPlan } from '@/features/calendar/reminderPlan';
import { ev, segsOf, t } from './helpers';

const D = '2026-10-12';
const kinds = { events: true, tasklists: false };
const remind = (minutes: number[], useDefault = false) => ({ reminders: { useDefault, minutes } });
const NOW = new Date(`${D}T10:25:00+02:00`).getTime();
const NOW_MIN = 10 * 60 + 25;
const plan = (items: CalendarItem[], k = kinds, days = 1) => reminderPlan(Array.from({ length: days }, (_, i) => segsOf(items, i === 0 ? D : `2026-10-13`)), NOW, NOW_MIN, k, 'Untitled');

describe('lead wording', () => {
  it('uses the duration format and whole days', () => {
    expect([0, 5, 30, 60, 90, 120, 1440, 2880].map(formatLead)).toEqual(['At start', '5 min', '30 min', '1 h', '1 h 30 min', '2 h', '1 day', '2 days']);
    expect(formatLeads([30, 10])).toBe('30 min, 10 min');
  });
});

describe('reminder plan', () => {
  const dentist = ev('d', t(D, '11:00'), t(D, '11:30'), { title: 'Dentist', ...remind([30, 15]) });

  it('has one reminder per lead at start minus lead, soonest first', () => {
    const p = plan([dentist]);
    expect(p.map((r) => [r.key, r.kind, r.title, r.body, r.at - NOW])).toEqual([
      [`d@${D}T11:00-30`, 'event', 'Dentist starts in 30 min', '11:00 – 11:30', 5 * 60000],
      [`d@${D}T11:00-15`, 'event', 'Dentist starts in 15 min', '11:00 – 11:30', 20 * 60000],
    ]);
    expect(p[0]!.startAt - NOW).toBe(35 * 60000);
  });

  it('includes leads already due (at <= now) while the event has not started, and nothing after the start', () => {
    const e = ev('e', t(D, '10:40'), t(D, '11:30'), { title: 'Early', ...remind([30, 10]) });
    expect(plan([e]).map((r) => r.at <= NOW)).toEqual([true, false]);
    const started = ev('s', t(D, '10:20'), t(D, '11:30'), { title: 'Started', ...remind([30]) });
    expect(plan([started])).toEqual([]);
  });

  it('has none for an event without reminders, all-day events and hidden kinds', () => {
    expect(plan([ev('n', t(D, '11:00'), t(D, '11:30'), remind([], true))])).toEqual([]);
    expect(plan([ev('a', D, '2026-10-13', { allDay: true, ...remind([30]) })])).toEqual([]);
    const list = { kind: 'tasklist', id: 'l', calendarId: 'tasks', title: '', date: D, time: '12:00', items: [], doneCount: 0, totalCount: 1, estimateMinutes: null, categoryId: null, tags: [], color: '#000', ...remind([60]), etag: 'e', updated: '' } as unknown as CalendarItem;
    expect(plan([list])).toEqual([]);
    expect(plan([list], { events: false, tasklists: true }).map((r) => [r.kind, r.title, r.body])).toEqual([['tasklist', 'Untitled starts in 1 h', '12:00 – 12:30']]);
    expect(plan([{ ...list, estimateMinutes: 45 } as CalendarItem], { events: false, tasklists: true }).map((r) => r.body)).toEqual(['12:00 – 12:45']);
  });

  it('plans a day lead for an event of tomorrow and says the lead once per duplicate', () => {
    const tomorrow = ev('t', t('2026-10-13', '12:00'), t('2026-10-13', '13:00'), { title: 'Trip', ...remind([1440, 1440]) });
    const p = reminderPlan([[], segsOf([tomorrow], '2026-10-13')], NOW, NOW_MIN, kinds, 'x');
    expect(p.map((r) => [r.title, r.at - NOW])).toEqual([['Trip starts in 1 day', (1440 + 12 * 60 - NOW_MIN - 1440) * 60000]]);
  });

  it('gives the times, with the day first when the item is not on the day the reminder rings', () => {
    const trip = ev('t', t('2026-10-13', '12:00'), t('2026-10-13', '13:30'), { title: 'Trip', ...remind([1440, 30]) });
    const p = reminderPlan([[], segsOf([trip], '2026-10-13')], NOW, NOW_MIN, kinds, 'x');
    expect(p.map((r) => [r.lead, r.body])).toEqual([[1440, 'Tue 13 Oct, 12:00 – 13:30'], [30, '12:00 – 13:30']]);
    // a 30 min lead of a 00:15 start rings the evening before
    const early = ev('e', t('2026-10-13', '00:15'), t('2026-10-13', '01:00'), { title: 'Early', ...remind([30]) });
    expect(reminderPlan([[], segsOf([early], '2026-10-13')], NOW, NOW_MIN, kinds, 'x').map((r) => r.body)).toEqual(['Tue 13 Oct, 00:15 – 01:00']);
  });

  it('names the end day of an item that runs past midnight', () => {
    const night = ev('n', t(D, '22:00'), t('2026-10-13', '01:00'), { title: 'Night', ...remind([30]) });
    expect(plan([night]).map((r) => r.body)).toEqual(['22:00 – Tue 13 Oct, 01:00']);
    const toMidnight = ev('m', t(D, '23:00'), t('2026-10-13', '00:00'), { title: 'Late', ...remind([30]) });
    expect(plan([toMidnight]).map((r) => r.body)).toEqual(['23:00 – 00:00']);
  });
});

describe('push plan', () => {
  const at = (id: string, date: string, time: string, minutes: number[]) => ev(id, t(date, time), t(date, '23:00'), { title: id, ...remind(minutes) });

  it('has the ahead reminders named by the item with its times, its kind, and the native reminder id as key', () => {
    const e = ev('d', t(D, '11:00'), t(D, '11:30'), { title: 'Dentist', ...remind([60, 30]) }); // the 1 h lead is due already
    expect(pushPlan(plan([e]), NOW)).toEqual([
      { at: NOW + 5 * 60000, title: 'Dentist', body: '11:00 – 11:30', key: `reminder:d@${D}T11:00-30`, kind: 'event' },
    ]);
  });

  it('keeps nothing beyond 7 days from now', () => {
    const days = Array.from({ length: 8 }, (_, i) => segsOf([at(`e${i}`, `2026-10-${12 + i}`, '23:00', [5])], `2026-10-${12 + i}`));
    const keys = pushPlan(reminderPlan(days, NOW, NOW_MIN, kinds, 'x'), NOW).map((p) => p.key.split('@')[0]);
    expect(keys).toEqual(['reminder:e0', 'reminder:e1', 'reminder:e2', 'reminder:e3', 'reminder:e4', 'reminder:e5', 'reminder:e6']);
  });

  it('drops reminders that are due already', () => {
    const e = ev('x', t(D, '10:40'), t(D, '11:30'), { title: 'Early', ...remind([30, 10]) });
    expect(pushPlan(plan([e]), NOW).map((p) => p.key)).toEqual([`reminder:x@${D}T10:40-10`]);
  });
});

describe('event form reminders', () => {
  it('a new event follows the calendar default and sends it as such', () => {
    const f = { ...newForm('2026-10-14', '10:00', 'primary', null), title: 'Dentist' };
    expect(f.reminders).toEqual({ useDefault: true, minutes: [] });
    expect(toInput(f, 'Europe/Berlin').reminders).toEqual({ useDefault: true, minutes: [] });
  });

  it('diffs the reminders against the own list; the calendar default has none', () => {
    const own = ev('x', t(D, '10:00'), t(D, '11:00'), remind([90, 30]));
    const f = formFromEvent(own);
    expect(f.reminders).toEqual({ useDefault: false, minutes: [90, 30] });
    expect(diffInput(toInput(f, 'Europe/Berlin'), own)).toEqual({});
    expect(diffInput(toInput({ ...f, reminders: { useDefault: false, minutes: [30, 90] } }, 'Europe/Berlin'), own)).toEqual({ reminders: { useDefault: false, minutes: [30, 90] } });
    const dflt = ev('y', t(D, '10:00'), t(D, '11:00'), remind([30, 10], true));
    expect(ownReminders(dflt)).toEqual({ useDefault: true, minutes: [] });
    expect(diffInput(toInput({ ...formFromEvent(dflt), reminders: { useDefault: false, minutes: [] } }, 'Europe/Berlin'), dflt)).toEqual({ reminders: { useDefault: false, minutes: [] } });
  });
});
