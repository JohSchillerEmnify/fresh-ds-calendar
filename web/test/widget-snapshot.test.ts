import { describe, expect, it } from 'vitest';
import type { CalendarEvent, TaskList } from '@/api/types';
import { buildWidgetSnapshot, type WidgetTheme } from '@/native/widgetSnapshot';

const theme: WidgetTheme = {
  primary: '#111111', onPrimary: '#ffffff', primaryContainer: '#222222', onPrimaryContainer: '#eeeeee', surface: '#fafafa',
  surfaceContainer: '#f0f0f0', onSurface: '#000000', onSurfaceVariant: '#555555', outlineVariant: '#cccccc',
};

const ev = (id: string, title: string, start: string, end: string, allDay = false): CalendarEvent => ({
  kind: 'event', id, calendarId: 'primary', title, description: '', location: '', allDay, start, end, colorId: null, color: '#1a73e8', etag: 'e', updated: start,
});
const list = (title: string, date: string | null, done: number, total: number): TaskList => ({
  kind: 'tasklist', id: title, calendarId: 'tasks', title, date, time: null, items: [], doneCount: done, totalCount: total, estimateMinutes: null,
  recurrence: null, categoryId: null, tags: [], color: '#0b8043', completedOn: null, canvas: null, etag: 'e', updated: '2026-10-14T00:00:00+02:00',
});

// 2026-10-14 is a Wednesday; its week is Mon 2026-10-12 .. Sun 2026-10-18
const build = (items: (CalendarEvent | TaskList)[]) =>
  buildWidgetSnapshot({ items, today: '2026-10-14', theme, dark: true, language: 'de', now: new Date('2026-10-14T08:30:00Z') });

describe('buildWidgetSnapshot', () => {
  it('covers Monday to Sunday of the current week with the theme, language and time', () => {
    const s = build([]);
    expect(s.v).toBe(1);
    expect(s.weekStart).toBe('2026-10-12');
    expect(s.days.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect([s.language, s.dark, s.theme, s.generatedAt]).toEqual(['de', true, theme, '2026-10-14T08:30:00.000Z']);
  });

  it('puts a timed event on its day with wall-clock start and end, and orders all-day first, then by time', () => {
    const s = build([
      ev('a', 'Late', '2026-10-14T18:00:00+02:00', '2026-10-14T19:00:00+02:00'),
      ev('b', 'Early', '2026-10-14T09:15:00+02:00', '2026-10-14T10:00:00+02:00'),
      ev('c', 'Holiday', '2026-10-14', '2026-10-15', true),
    ]);
    expect(s.days[2].events).toEqual([
      { title: 'Holiday', allDay: true, start: null, end: null, color: '#1a73e8' },
      { title: 'Early', allDay: false, start: '09:15', end: '10:00', color: '#1a73e8' },
      { title: 'Late', allDay: false, start: '18:00', end: '19:00', color: '#1a73e8' },
    ]);
  });

  it('shows a multi-day all-day event on every day it covers (end is exclusive)', () => {
    const s = build([ev('a', 'Trip', '2026-10-16', '2026-10-19', true)]);
    expect(s.days.filter((d) => d.events.length).map((d) => d.date)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });

  it('shows the time of an overnight event on its first day only (ending at 24:00 there), and not on a day it ends at midnight', () => {
    const s = build([ev('a', 'Night', '2026-10-13T22:00:00+02:00', '2026-10-14T00:00:00+02:00'), ev('b', 'Long', '2026-10-14T22:00:00+02:00', '2026-10-15T02:00:00+02:00')]);
    expect(s.days[1].events.map((e) => e.title)).toEqual(['Night']);
    expect(s.days[2].events).toEqual([{ title: 'Long', allDay: false, start: '22:00', end: '24:00', color: '#1a73e8' }]);
    expect(s.days[3].events).toEqual([{ title: 'Long', allDay: true, start: null, end: null, color: '#1a73e8' }]);
  });

  it('ignores events outside the week', () => {
    const s = build([ev('a', 'Before', '2026-10-11T10:00:00+02:00', '2026-10-11T11:00:00+02:00'), ev('b', 'After', '2026-10-19', '2026-10-20', true)]);
    expect(s.days.every((d) => d.events.length === 0)).toBe(true);
  });

  it("lists only today's task lists, with their progress, and keeps them out of the day columns", () => {
    const s = build([list('Groceries', '2026-10-14', 2, 5), list('Tomorrow', '2026-10-15', 0, 3), list('Undated', null, 0, 1)]);
    expect(s.tasklists).toEqual([{ title: 'Groceries', done: 2, total: 5, color: '#0b8043' }]);
    expect(s.days.every((d) => d.events.length === 0)).toBe(true);
  });

  it('leaves out events of hidden calendars', () => {
    const hidden = { ...ev('h', 'Secret', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00'), calendarId: 'work' };
    const shown = ev('s', 'Open', '2026-10-14T11:00:00+02:00', '2026-10-14T12:00:00+02:00');
    const s = buildWidgetSnapshot({ items: [hidden, shown], today: '2026-10-14', theme, dark: true, language: 'de', now: new Date('2026-10-14T08:30:00Z'), hiddenCalendars: new Set(['work']) });
    expect(s.days[2].events.map((e) => e.title)).toEqual(['Open']);
  });
});
