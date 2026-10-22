/** Goldens of the event renderer (`EventItem`): month chip, all-day bar, time grid block, dot. */
import { test } from 'vitest';
import EventItem from '@/features/calendar/EventItem.vue';
import { DAY, event, golden, segOf, type Cell } from './golden';

const cell = (key: string, variant: string, e = event(), w = 140, h?: number): Cell =>
  ({ key, component: EventItem, props: { segment: segOf(e), variant, height: h }, w, h });
const allDay = (o = {}) => event({ allDay: true, start: DAY, end: '2030-01-08', ...o });

test('EventItem: month chip and dot', () => golden('chip', [
  cell('chip', 'chip'),
  cell('chip-narrow', 'chip', event(), 48),
  cell('chip-allday', 'allday', allDay({ title: 'Trip to Berlin' })),
  cell('chip-allday-narrow', 'allday', allDay({ title: 'Trip to Berlin' }), 48),
  cell('birthday', 'allday', allDay({ title: 'Anna', special: 'birthday', readOnly: true })),
  cell('dot', 'dot'),
]));

test('EventItem: time grid block, wide and narrow', () => golden('block', [
  cell('tall', 'block', event({ location: 'Room 4', description: 'Agenda: numbers, plans, the rest of the long description text' }), 160, 140),
  cell('medium', 'block', event({ location: 'Room 4' }), 160, 60),
  cell('short', 'block', event(), 160, 22),
  cell('long-title', 'block', event({ title: 'Quarterly planning with the whole extended team' }), 160, 44),
  cell('narrow-tall', 'block', event({ title: 'Workshop' }), 47, 120),
  cell('narrow-short', 'block', event({ title: 'Standup' }), 47, 22),
  cell('cont', 'block', event({ start: '2030-01-06T22:00:00', end: `${DAY}T01:00:00` }), 160, 50),
]));

test('EventItem: calm mode', () => golden('calm', [
  cell('chip', 'chip'),
  cell('block', 'block', event(), 160, 60),
], () => { document.documentElement.dataset.calm = 'true'; }));
