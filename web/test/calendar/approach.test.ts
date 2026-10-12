import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { approachEntries, approachLayout } from '@/features/labs/approach/approach';
import { ev, segsOf, t } from './helpers';

const D = '2026-10-14';
const list = (id: string, time: string | null, title = id) => ({
  kind: 'tasklist', id, calendarId: 'primary', title, date: D, time, items: [], doneCount: 0, totalCount: 0,
  estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '',
}) as unknown as CalendarItem;
const dentist = ev('dentist', t(D, '09:00'), t(D, '10:00'), { title: 'Dentist' });
const gym = ev('gym', t(D, '11:00'), t(D, '12:00'), { title: 'Gym' });
const lunch = ev('lunch', t(D, '12:30'), t(D, '13:00'), { title: 'Lunch' });
const allDay = ev('trip', '2026-10-14', '2026-10-15', { title: 'Trip', allDay: true });

describe('approach bar entries', () => {
  const segs = segsOf([lunch, gym, dentist, list('groceries', '10:00', 'Groceries'), list('untimed', null), allDay], D);
  const titles = (nowMin: number) => approachEntries(segs, nowMin).map((s) => s.item.title);

  it('takes the next three timed entries of today by start, task lists with a time included', () => {
    expect(titles(8 * 60)).toEqual(['Dentist', 'Groceries', 'Gym']);
  });
  it('leaves out the current event and what has started', () => {
    expect(titles(9 * 60 + 30)).toEqual(['Groceries', 'Gym', 'Lunch']);
    expect(titles(9 * 60)).toEqual(['Groceries', 'Gym', 'Lunch']);
  });
  it('shows fewer when fewer are ahead, none when nothing is ahead', () => {
    expect(titles(11 * 60 + 30)).toEqual(['Lunch']);
    expect(titles(13 * 60)).toEqual([]);
  });
});

describe('approach bar layout', () => {
  const segs = segsOf([dentist, list('groceries', '10:00', 'Groceries'), gym], D);
  const at = (nowMin: number, track = 400, chip = 100) => approachLayout(approachEntries(segs, nowMin), nowMin, track, chip);

  it('places chips proportionally between now and the start of the last one', () => {
    const l = at(8 * 60);
    expect(l.chips.map((c) => c.minutes)).toEqual([60, 120, 180]);
    expect(l.chips.map((c) => c.x)).toEqual([100, 200, 300]);
    expect(l.rows).toBe(1);
  });
  it('stacks chips that would overlap into another row instead of hiding them', () => {
    const l = at(8 * 60, 400, 150);
    expect(l.chips.map((c) => c.row)).toEqual([0, 1, 0]);
    expect(l.rows).toBe(2);
  });
  it('moves the next chip towards now as time passes while the last one stays at the end', () => {
    expect(at(8 * 60 + 45).chips[0].x).toBeLessThan(at(8 * 60).chips[0].x);
    expect(at(8 * 60 + 45).chips[2].x).toBe(300);
  });
  it('without a measured width everything sits at now', () => {
    expect(at(8 * 60, 0).chips.map((c) => c.x)).toEqual([0, 0, 0]);
  });
});
