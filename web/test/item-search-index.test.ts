/** The item search's matcher and order (feature item-search): normalising, typos from four letters, every word, fields, order. */
import { describe, expect, it } from 'vitest';
import type { CalendarEvent, TaskList } from '@/api/types';
import { ItemIndex, matchedItemTitle, type Searchable } from '@/features/search/searchIndex';
import { orderHits } from '@/features/search/searchOrder';
import { eventFixture } from './helpers';

const ev = (title: string, date: string, o: Record<string, unknown> = {}): CalendarEvent =>
  eventFixture(`${title}@${date}`, `${date}T10:00:00+01:00`, `${date}T11:00:00+01:00`, { title, ...o }) as unknown as CalendarEvent;
const list = (title: string, date: string | null, items: string[] = [], o: Partial<TaskList> = {}): TaskList => ({
  kind: 'tasklist', id: `${title}@${date}`, calendarId: 'tasks', title, date, time: null,
  items: items.map((t, i) => ({ id: `${title}-${i}`, title: t, done: false, ...(t === '' ? { ink: true as const } : {}) })),
  doneCount: 0, totalCount: items.length, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#000', calendarColor: '#000',
  completedOn: null, canvas: null, etag: 'e', updated: '2026-10-12T08:00:00+02:00', ...o,
});
const find = (items: Searchable[], q: string): string[] => { const i = new ItemIndex(); i.update(items); return i.search(q).map((h) => h.item.title); };

describe('what is searched', () => {
  const check = ev('Check-up', '2026-12-03', { location: 'Rosenstrasse 4', description: 'bring the insurance card' });
  it('finds an event by title, notes and place', () => {
    expect(find([check], 'check')).toEqual(['Check-up']);
    expect(find([check], 'insurance')).toEqual(['Check-up']);
    expect(find([check], 'rosenstrasse')).toEqual(['Check-up']);
  });
  it('finds a list by its title and by an item, but never by an ink item', () => {
    const l = list('Packing', '2026-12-05', ['Passport', 'Charger', '']);
    expect(find([l], 'pack')).toEqual(['Packing']);
    expect(find([l], 'passport')).toEqual(['Packing']);
    expect(find([list('Groceries', '2026-12-01', ['', ''])], 'handwritten')).toEqual([]);
  });
  it('names the matched item of a list', () => {
    const l = list('Packing', '2026-12-05', ['Passport', 'Charger']);
    const i = new ItemIndex();
    i.update([l]);
    expect(matchedItemTitle(l, i.search('chargr')[0]!.terms)).toBe('Charger');
    expect(matchedItemTitle(l, i.search('pack')[0]!.terms)).toBeNull();
  });
});

describe('how words match', () => {
  const team = ev('Team lunch', '2026-12-04');
  it('ignores capitals, accents and hyphens', () => {
    expect(find([ev('Café Anna', '2026-12-02')], 'CAFE')).toHaveLength(1);
    expect(find([ev('Check-up', '2026-12-02')], 'check up')).toHaveLength(1);
    expect(find([ev('Checkup', '2026-12-02')], 'CHECKUP')).toHaveLength(1);
  });
  it('forgives one typo in a word of four letters or more', () => {
    expect(find([ev('Advisor meeting', '2026-12-02')], 'advsor')).toHaveLength(1);
    expect(find([team], 'teem')).toHaveLength(1);
    expect(find([team], 'tehm')).toHaveLength(1);
    expect(find([team], 'taem')).toHaveLength(0); // two letters swapped are two edits
  });
  it('matches the start of a word of three letters and forgives no typo there', () => {
    expect(find([team], 'tea')).toHaveLength(1);
    expect(find([team], 'tem')).toHaveLength(0);
  });
  it('needs every word, each with its own typo, in any order', () => {
    expect(find([team], 'lunsh team')).toHaveLength(1);
    expect(find([team, ev('Team meeting', '2026-12-04')], 'lunch team')).toEqual(['Team lunch']);
    expect(find([team], 'lunch dentist')).toEqual([]);
  });
  it('finds nothing for a far word', () => {
    expect(find([ev('Dentist', '2026-12-03')], 'doctor')).toEqual([]);
    expect(find([ev('Dentist', '2026-12-03')], 'xylophone')).toEqual([]);
    expect(find([team], '')).toEqual([]);
  });
});

describe('keeping the index in step', () => {
  it('adds, replaces and discards by the item, not by a rebuild', () => {
    const a = ev('Dentist', '2026-12-03'), b = ev('Barber', '2026-12-04');
    const i = new ItemIndex();
    i.update([a, b]);
    expect(i.size).toBe(2);
    i.update([{ ...a, title: 'Doctor' }, b, ev('Baker', '2026-12-05')]);
    expect(i.search('dentist')).toHaveLength(0);
    expect(i.search('doctor')).toHaveLength(1);
    expect(i.size).toBe(3);
    i.update([b]);
    expect(i.search('doctor')).toHaveLength(0);
    expect(i.size).toBe(1);
  });
  it('builds in chunks, yielding between them', async () => {
    const i = new ItemIndex();
    let yields = 0;
    await i.updateAsync(Array.from({ length: 10 }, (_, n) => ev(`Run ${n}`, '2026-12-03')), 4, async () => { yields++; });
    expect(yields).toBe(2);
    expect(i.size).toBe(10);
  });
});

describe('the order of the results', () => {
  const titles = (items: Searchable[]) => orderHits(items.map((item) => ({ item, terms: {} })), '2026-11-26').map((h) => h.item.id);
  it('upcoming nearest first, then the past newest first, undated last', () => {
    const items = [
      ev('Run', '2026-12-10'), ev('Run', '2026-11-30'), ev('Run', '2026-11-01'), ev('Run', '2026-09-15'), list('Run plan', null, ['Shoes']),
    ];
    expect(titles(items)).toEqual(['Run@2026-11-30', 'Run@2026-12-10', 'Run@2026-11-01', 'Run@2026-09-15', 'Run plan@null']);
  });
  it('puts today among the upcoming, all-day before timed, then by title', () => {
    const items = [
      ev('B', '2026-11-26'), eventFixture('x', '2026-11-26', '2026-11-27', { title: 'A', allDay: true }) as unknown as CalendarEvent, ev('A', '2026-11-26'),
    ];
    expect(titles(items)).toEqual(['x', 'A@2026-11-26', 'B@2026-11-26']);
  });
});

describe('ItemIndex.clear', () => {
  it('forgets everything it held (the device was wiped)', () => {
    const idx = new ItemIndex();
    idx.update([ev('Dentist', '2026-12-03')]);
    expect(idx.search('dentist')).toHaveLength(1);
    idx.clear();
    expect(idx.size).toBe(0);
    expect(idx.search('dentist')).toEqual([]);
  });
});
