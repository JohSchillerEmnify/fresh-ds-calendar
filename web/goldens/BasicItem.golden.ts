/** Goldens of the registry's fallback renderer (`BasicItem`), drawn when no feature registered a renderer for a kind. */
import { test } from 'vitest';
import BasicItem from '@/components/calendar/BasicItem.vue';
import { DAY, event, golden, list, segOf, type Cell } from './golden';

const cell = (key: string, variant: string, item: Parameters<typeof segOf>[0], w = 160, h?: number): Cell =>
  ({ key, component: BasicItem, props: { segment: segOf(item), variant, height: h }, w, h });

test('BasicItem: events and task lists', () => golden('basic', [
  cell('event-chip', 'chip', event()),
  cell('event-allday', 'allday', event({ allDay: true, start: DAY, end: '2030-01-08' })),
  cell('event-block', 'block', event(), 160, 60),
  cell('list-chip', 'chip', list()),
  cell('list-block', 'block', list({ time: '17:00', estimateMinutes: 60 }), 160, 60),
  cell('list-done', 'card', list({ items: [['Milk', true]] })),
]));
