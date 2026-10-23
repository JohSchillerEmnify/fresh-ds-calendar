/** Goldens of the multi-day event bar (`EventBar`): week band bar and month chip bar, with continuation ends. */
import { test } from 'vitest';
import EventBar from '@/features/calendar/EventBar.vue';
import type { Bar } from '@/lib/spans';
import { event, golden, type Cell } from './golden';

const dates = ['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-10', '2030-01-11', '2030-01-12', '2030-01-13'];
const ev = event({ title: 'Conference in Lisbon', allDay: true, start: '2030-01-06', end: '2030-01-16' });
const bar = (o: Partial<Bar>): Bar => ({ item: ev, startCol: 1, endCol: 4, lane: 0, continuedFromPrev: false, continuesToNext: false, startDate: dates[1]!, endDate: dates[4]!, ...o });
const row = (key: string, b: Bar, chip: boolean, w: number): Cell =>
  ({ key, component: EventBar, props: { bar: b, dates, chip }, w, style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', '--bar-h': '20px' } });

test('EventBar: band bar and month chip bar', () => golden('bars', [
  row('band', bar({}), false, 340),
  row('band-cont', bar({ startCol: 0, endCol: 6, continuedFromPrev: true, continuesToNext: true }), false, 340),
  row('chip', bar({}), true, 340),
  row('chip-cont', bar({ startCol: 0, endCol: 6, continuedFromPrev: true, continuesToNext: true }), true, 340),
  row('birthday', bar({ item: event({ title: 'Anna', allDay: true, special: 'birthday', start: '2030-01-08', end: '2030-01-10' }) }), false, 340),
]));
