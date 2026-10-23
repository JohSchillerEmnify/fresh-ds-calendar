/** Goldens of the entry skins (theme menu: glow, entry style, corners) on every item renderer's block, chip and card. */
import { test } from 'vitest';
import EventItem from '@/features/calendar/EventItem.vue';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { event, golden, list, segOf, type Cell } from './golden';

const sheet: Cell[] = [
  { key: 'event-block', component: EventItem, props: { segment: segOf(event()), variant: 'block', height: 60 }, w: 140, h: 60 },
  { key: 'event-chip', component: EventItem, props: { segment: segOf(event()), variant: 'chip' }, w: 140 },
  { key: 'list-block', component: TaskListCard, props: { segment: segOf(list({ time: '17:00', estimateMinutes: 60 })), variant: 'block', height: 70 }, w: 140, h: 70 },
  { key: 'list-card', component: TaskListCard, props: { segment: segOf(list()), variant: 'card' }, w: 140 },
  { key: 'list-grown', component: TaskListCard, props: { segment: segOf(list({ time: '17:00', estimateMinutes: 60 })), variant: 'block', grown: true, growDir: 'down' }, w: 140, style: { '--min-h': '40px', position: 'relative' } },
];
const skin = (attrs: Record<string, string>) => () => { Object.assign(document.documentElement.dataset, attrs); };

test('Skins: neon glow', () => golden('glow-neon', sheet, skin({ glow: 'neon' })));
test('Skins: soft glow, tinted entries', () => golden('soft-tinted', sheet, skin({ glow: 'soft', entries: 'tinted' })));
test('Skins: outlined entries, pill corners', () => golden('outline-pill', sheet, skin({ entries: 'outline', corners: 'pill' })));
test('Skins: square corners', () => golden('square', sheet, skin({ corners: 'square' })));
