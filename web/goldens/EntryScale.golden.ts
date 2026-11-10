/**
 * The reference for how an entry looks at every size (issue 76): one sheet with a row per kind of entry (timed chip, all-day entry,
 * multi-day bar, task list card, birthday, timed block) and a column per size (minimum, small, regular, large), at each density (Comfortable,
 * Compact, Airy); the phone step is the narrow viewport of the same sheet. Month, week and day draw these same components, so a change to one size
 * shows here first.
 */
import { defineComponent, h } from 'vue';
import { test } from 'vitest';
import EventItem from '@/features/calendar/EventItem.vue';
import EventBar from '@/features/calendar/EventBar.vue';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { DENSITY_SCALE } from '@/theme/fine';
import type { Bar } from '@/lib/spans';
import { DAY, event, golden, list, segOf, type Cell } from './golden';

/** A row label that also breaks the line, so each kind starts on its own row. */
const Caption = defineComponent({
  props: { text: { type: String, required: true } },
  setup: (p) => () => h('div', { style: { font: '600 11px sans-serif', color: 'var(--md-sys-color-on-surface-variant)', padding: '6px 0 0' } }, p.text),
});
const caption = (text: string): Cell => ({ key: `row-${text}`, component: Caption, props: { text }, w: 2000 });

const allDay = (o = {}) => event({ allDay: true, start: DAY, end: '2030-01-08', title: 'Trip to Berlin', ...o });
const item = (key: string, e: ReturnType<typeof event>, variant: string, w: number, height?: number): Cell =>
  ({ key, component: EventItem, props: { segment: segOf(e), variant, height }, w, h: height });

/** The four size columns of an event renderer: minimum, small, regular, large. */
function sizes(prefix: string, e: ReturnType<typeof event>, variant: string, dims: [number, number | undefined][]): Cell[] {
  return (['min', 'small', 'regular', 'large'] as const).map((name, n) => item(`${prefix}-${name}`, e, variant, ...dims[n]!));
}

const dates = ['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-10', '2030-01-11', '2030-01-12', '2030-01-13'];
const trip = event({ title: 'Conference in Lisbon', allDay: true, start: '2030-01-06', end: '2030-01-16' });
const bar = (o: Partial<Bar>): Bar => ({ item: trip, startCol: 1, endCol: 4, lane: 0, continuedFromPrev: false, continuesToNext: false, startDate: dates[1]!, endDate: dates[4]!, ...o });
const barCell = (key: string, b: Bar, chip: boolean): Cell =>
  ({ key, component: EventBar, props: { bar: b, dates, chip }, w: 340, style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', '--bar-h': '20px' } });
const card = (key: string, l: ReturnType<typeof list>, variant: string, w: number, height?: number): Cell =>
  ({ key, component: TaskListCard, props: { segment: segOf(l), variant, height }, w, h: height });
const groceries = list({ items: [['Milk', false], ['Eggs', true], ['Bread', false], ['Jam', false]] });
const long = event({ title: 'Quarterly planning with the whole extended team', location: 'Room 4', description: 'Agenda: numbers, plans, the rest of the long description text' });

/** The sheet of one density: the density factor sits on the root like the theme sets it, so every `--entry-*` token follows it. */
const sheet = (name: string, density: keyof typeof DENSITY_SCALE) => golden(name, [
  caption('timed chip (month): minimum, small, regular, large'),
  ...sizes('chip', event(), 'chip', [[48, undefined], [90, undefined], [140, undefined], [220, undefined]]),
  caption('all-day entry'),
  ...sizes('allday', allDay(), 'allday', [[48, undefined], [90, undefined], [140, undefined], [220, undefined]]),
  caption('birthday and anniversary marker'),
  ...sizes('birthday', allDay({ title: 'Anna', special: 'birthday', readOnly: true }), 'allday', [[48, undefined], [90, undefined], [140, undefined], [220, undefined]]),
  caption('multi-day bar: week band, continued, month'),
  barCell('bar', bar({}), false), barCell('bar-cont', bar({ startCol: 0, endCol: 6, continuedFromPrev: true, continuesToNext: true }), false), barCell('bar-month', bar({}), true),
  caption('task list card: minimum, small, regular, large'),
  card('card-min', groceries, 'card', 52), card('card-small', groceries, 'card', 90), card('card-regular', groceries, 'card', 140), card('card-large', groceries, 'card', 140, 90),
  caption('timed block (week and day): minimum, small, regular, large, narrow'),
  ...sizes('block', long, 'block', [[160, 22], [160, 44], [160, 60], [160, 140]]),
  item('block-narrow', event({ title: 'Workshop' }), 'block', 47, 60),
], () => { document.documentElement.style.setProperty('--dz', String(DENSITY_SCALE[density])); });

/** Runs a density sheet and puts the root back, whatever the outcome. */
async function atDensity(name: string, density: keyof typeof DENSITY_SCALE): Promise<void> {
  try { await sheet(name, density); } finally { document.documentElement.style.removeProperty('--dz'); }
}

test('EntryScale: Comfortable', () => atDensity('scale', 'comfortable'));
test('EntryScale: Compact', () => atDensity('scale-compact', 'compact'));
test('EntryScale: Airy', () => atDensity('scale-airy', 'airy'));
