import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { clockSegments, clockText } from '@/features/labs/clock/clock';
import { clip, fadingRows, labelSizing, VIEW } from '@/features/labs/clock/geometry';
import { ev, segsOf, t } from './helpers';

const D = '2026-10-14';
const list = (id: string, time: string | null, o: Record<string, unknown> = {}) => ({
  kind: 'tasklist', id, calendarId: 'primary', title: id, date: D, time, items: [], doneCount: 0, totalCount: 0,
  estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '', ...o,
}) as unknown as CalendarItem;

describe('clock selection', () => {
  const segs = segsOf([
    ev('dentist', t(D, '09:00'), t(D, '10:00'), { title: 'Dentist' }),
    ev('trip', D, '2026-10-15', { title: 'Trip', allDay: true }),
    list('Laundry', '09:30', { estimateMinutes: 90 }),
    list('Call', '18:00'),
    list('Groceries', null),
  ], D);
  const { timed, untimed } = clockSegments(segs);

  it('makes timed events and timed task lists arcs, all-day events nothing, untimed task lists the middle', () => {
    expect(timed.map((s) => s.item.title).sort()).toEqual(['Call', 'Dentist', 'Laundry']);
    expect(untimed.map((s) => s.item.title)).toEqual(['Groceries']);
  });
  it('gives a task list its estimate, else 30 minutes, and puts overlaps on inner lanes', () => {
    const by = (title: string) => timed.find((s) => s.item.title === title)!;
    expect([by('Laundry').startTime, by('Laundry').endTime, by('Laundry').lane]).toEqual(['09:30', '11:00', 1]);
    expect([by('Call').startTime, by('Call').endTime, by('Call').lane]).toEqual(['18:00', '18:30', 0]);
  });
  it('names task lists with their done count, untitled ones as "List"', () => {
    expect(clockText(list('Laundry', '18:00', { doneCount: 1, totalCount: 2 }))).toBe('Laundry 1/2');
    expect(clockText(list('', null, { title: ' ', totalCount: 3 }))).toBe('List 0/3');
    expect(clockText(segs[0].item)).toBe('Dentist');
  });
});

describe('clock geometry', () => {
  it('keeps labels between 11 and 16 screen pixels and fits more characters on a bigger dial', () => {
    const small = labelSizing(300), base = labelSizing(VIEW), big = labelSizing(900);
    expect(small.font * (300 / VIEW)).toBeCloseTo(11);
    expect(base.font).toBeCloseTo(12);
    expect(big.font * (900 / VIEW)).toBeCloseTo(16);
    expect(small.maxChars).toBeLessThan(big.maxChars);
    expect(labelSizing(0)).toEqual(base);
  });
  it('clips long text with an ellipsis', () => {
    expect(clip('Laundry', 10)).toBe('Laundry');
    expect(clip('A very long title', 6)).toBe('A ver…');
  });
  it('shows the rows that fit and fades the last ones when more are left', () => {
    expect(fadingRows(2, 4)).toEqual([1, 1]);
    expect(fadingRows(6, 4)).toEqual([1, 1, 2 / 3, 1 / 3]);
    expect(fadingRows(3, 1)).toEqual([1 / 2]);
    expect(fadingRows(3, 0)).toEqual([]);
  });
});
