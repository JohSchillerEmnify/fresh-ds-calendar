/** Goldens of the task list card (`TaskListCard`) in every variant and mode a host uses or the card still supports. */
import { test } from 'vitest';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { golden, list, segOf, type Cell } from './golden';

const many: [string, boolean][] = [['Tomatoes', false], ['Pasta', true], ['Coffee beans', false], ['Bread', false], ['Cheese', false], ['Olive oil', false]];
const card = (key: string, l = list(), w = 140, h?: number, extra: Partial<Cell> = {}): Cell =>
  ({ key, component: TaskListCard, props: { segment: segOf(l), variant: 'card', height: h }, w, h, ...extra });

test('TaskListCard: month card', () => golden('card', [
  card('titled', list()),
  card('titled-mini', list(), 52),
  card('titleless', list({ title: '' })),
  card('titleless-short', list({ title: '' }), 140, 20),
  card('titleless-mini', list({ title: '' }), 52, 20),
  card('many-faded', list({ items: many }), 140, 48),
  card('complete', list({ items: [['Milk', true], ['Eggs', true]] })),
  card('partial', list({ items: [['Milk', true], ['Eggs', false], ['Bread', false], ['Jam', false]] })),
  card('empty', list({ items: [] })),
  card('estimate', list({ estimateMinutes: 90 }), 200),
  card('carried', list({ date: '2030-01-03' }), 200),
  card('carried-mini', list({ date: '2030-01-03' }), 52),
  card('shared', list({ shared: { owned: true, owner: { sub: 'me', name: 'Me', email: 'me@x', initial: 'M' }, with: [{ sub: 'a', name: 'Anna', email: 'a@x', initial: 'A' }] } })),
  card('long-title', list({ title: 'Weekly shopping for the big family barbecue' }), 90),
]));

test('TaskListCard: all-day band, full and titles only', () => golden('allday', [
  { key: 'full', component: TaskListCard, props: { segment: segOf(list()), variant: 'allday' }, w: 160 },
  { key: 'full-narrow', component: TaskListCard, props: { segment: segOf(list()), variant: 'allday' }, w: 48 },
  { key: 'titles', component: TaskListCard, props: { segment: segOf(list()), variant: 'allday' }, w: 160, section: 'titles' },
  { key: 'titles-untitled', component: TaskListCard, props: { segment: segOf(list({ title: '' })), variant: 'allday' }, w: 160, section: 'titles' },
  { key: 'titles-narrow', component: TaskListCard, props: { segment: segOf(list()), variant: 'allday' }, w: 48, section: 'titles' },
  { key: 'timed-full', component: TaskListCard, props: { segment: segOf(list({ time: '17:00', estimateMinutes: 45 })), variant: 'allday' }, w: 160 },
]));

const block = (key: string, l: ReturnType<typeof list>, w: number, h: number): Cell =>
  ({ key, component: TaskListCard, props: { segment: segOf(l), variant: 'block', height: h }, w, h });
const timed = (o: Parameters<typeof list>[0] = {}) => list({ time: '17:00', estimateMinutes: 90, ...o });

test('TaskListCard: time grid block, wide and narrow', () => golden('block', [
  block('tall', timed(), 160, 110),
  block('tall-many', timed({ items: many }), 160, 80),
  block('inline', timed(), 160, 45),
  block('inline-short', timed(), 160, 22),
  block('inline-untitled', timed({ title: '' }), 160, 30),
  block('mini-tall', timed(), 47, 110),
  block('mini-short', timed(), 47, 45),
  block('mini-tiny', timed({ title: '' }), 47, 22),
  block('complete', timed({ items: [['Milk', true]] }), 160, 60),
  block('estimate', timed({ estimateMinutes: 30 }), 200, 70),
]));

test('TaskListCard: chip and dot (no host passes them today)', () => golden('chip-dot', [
  { key: 'chip', component: TaskListCard, props: { segment: segOf(list()), variant: 'chip' }, w: 140 },
  { key: 'chip-wide', component: TaskListCard, props: { segment: segOf(list()), variant: 'chip' }, w: 260 },
  { key: 'chip-untitled', component: TaskListCard, props: { segment: segOf(list({ title: '' })), variant: 'chip' }, w: 140 },
  { key: 'dot', component: TaskListCard, props: { segment: segOf(list()), variant: 'dot' }, w: 140 },
]));

const grown = (key: string, l: ReturnType<typeof list>, variant: string, w: number, minH: number, extra: Record<string, unknown> = {}): Cell =>
  ({ key, component: TaskListCard, props: { segment: segOf(l), variant, grown: true, ...extra }, w, style: { '--min-h': `${minH}px`, position: 'relative', margin: '0 0 12px' } });

test('TaskListCard: grown (the expanded card)', () => golden('grown', [
  grown('down', timed(), 'block', 160, 60, { growDir: 'down' }),
  grown('up', timed(), 'block', 160, 60, { growDir: 'up' }),
  grown('tight', timed({ title: 'Call the dentist and the bank', estimateMinutes: 15 }), 'block', 160, 22, { growDir: 'down', tight: true }),
  grown('tight-narrow', timed({ title: 'Weekly shopping', estimateMinutes: 15 }), 'block', 47, 22, { growDir: 'down', tight: true }),
  grown('narrow', timed({ items: many }), 'block', 47, 60, { growDir: 'down' }),
  grown('flat', list({ items: many }), 'card', 140, 0),
  grown('allday', list(), 'allday', 160, 26, { growDir: 'down' }),
  grown('untitled', timed({ title: '' }), 'block', 160, 40, { growDir: 'down' }),
]));

test('TaskListCard: calm mode and categories', () => golden('calm', [
  card('calm', list()),
  block('calm-block', timed(), 160, 80),
], () => {
  useSettingsStore().settings.calmMode = true;
}));

test('TaskListCard: categories on (category colour and icon)', () => golden('categories', [
  card('icon', list({ categoryInfo: { name: 'Home', color: '#e67c73', icon: '🛒' }, color: '#e67c73' })),
  block('icon-block', timed({ categoryInfo: { name: 'Home', color: '#e67c73', icon: '🧹' }, color: '#e67c73' }), 160, 80),
], () => { usePrefsStore().taskCategories = true; }));

test('TaskListCard: resize handles after a release without moving', () => golden('resizing', [
  { ...block('resizing', timed(), 160, 80), style: { margin: '14px 0' } },
  { ...block('resizing-short', timed(), 160, 30), style: { margin: '14px 0' } },
], () => { useUiStore().resizing = { kind: 'tasklist', id: 'l1', date: '2030-01-07' }; }));

// one-line lists (#79): A one item without a title, B a title without items; C a title and one item, D two or more items
const oneLine = {
  A: (): Parameters<typeof list>[0] => ({ title: '', items: [['Tickets', false]] }),
  Along: (): Parameters<typeof list>[0] => ({ title: '', items: [['Book the train tickets for the trip', false]] }),
  Adone: (): Parameters<typeof list>[0] => ({ title: '', items: [['Tickets', true]] }),
  B: (): Parameters<typeof list>[0] => ({ title: 'Ideas', items: [] }),
  C: (): Parameters<typeof list>[0] => ({ title: 'Post', items: [['Stamps', false]] }),
  D: (): Parameters<typeof list>[0] => ({ title: 'Groceries', items: [['Milk', false], ['Eggs', false]] }),
};
const cases = Object.entries(oneLine);

test('TaskListCard: one-line lists, month card', () => golden('one-line-card', cases.flatMap(([k, mk]) => [
  card(`${k}`, list(mk())),
  card(`${k}-mini`, list(mk()), 52),
])));

test('TaskListCard: one-line lists, all-day band', () => golden('one-line-allday', cases.flatMap(([k, mk]) => [
  { key: k, component: TaskListCard, props: { segment: segOf(list(mk())), variant: 'allday' }, w: 160 } as Cell,
  { key: `${k}-narrow`, component: TaskListCard, props: { segment: segOf(list(mk())), variant: 'allday' }, w: 48 } as Cell,
])));

const oneBlock = (names: string[]) => cases.filter(([k]) => names.includes(k)).flatMap(([k, mk]) =>
  [22, 30, 45, 60].flatMap((h) => [block(`${k}-${h}`, timed(mk()), 160, h), block(`${k}-${h}-narrow`, timed(mk()), 47, h)]));
test('TaskListCard: one-line lists, time grid A and B', () => golden('one-line-block-ab', oneBlock(['A', 'Along', 'Adone', 'B'])));
test('TaskListCard: one-line lists, time grid C and D', () => golden('one-line-block-cd', oneBlock(['C', 'D'])));

test('TaskListCard: one-line lists, grown C and D', () => golden('one-line-grown', [
  grown('C-flat', list(oneLine.C()), 'card', 140, 0),
  grown('D-flat', list(oneLine.D()), 'card', 140, 0),
  grown('C-block', timed(oneLine.C()), 'block', 160, 60, { growDir: 'down' }),
  grown('D-block', timed(oneLine.D()), 'block', 160, 60, { growDir: 'down' }),
  grown('C-narrow', timed(oneLine.C()), 'block', 47, 60, { growDir: 'down' }),
  grown('D-narrow', timed(oneLine.D()), 'block', 47, 60, { growDir: 'down' }),
]));
