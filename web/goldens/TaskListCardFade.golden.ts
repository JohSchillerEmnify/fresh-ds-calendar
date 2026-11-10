/** Where a task list card fades on phones: only where text is really cut, and the last row shown when more items follow. */
import { test } from 'vitest';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { golden, list, segOf, type Cell } from './golden';

const LONG = 'A very long task list title that is cut';
const b = (key: string, title: string, items: [string, boolean][], w: number, h: number): Cell => ({
  key, component: TaskListCard, props: { segment: segOf(list({ title, items, time: '15:00', estimateMinutes: 30 })), variant: 'block', height: h }, w, h,
});
const two: [string, boolean][] = [['Foo', false], ['Bar', false]];

test('TaskListCardFade', () => golden('tasklist-card-fade', [
  // narrow columns: both rows when they fit, else the last row shown fades
  b('narrow-two-30', '', two, 47, 30), b('narrow-two-40', '', two, 47, 40), b('narrow-two-50', '', two, 47, 50),
  // wide inline: names never fade one by one, a title that fits keeps its last letter
  b('wide-two-22', '', two, 160, 22), b('titled-inline-22', 'Foo', [['A', false], ['B', false]], 300, 22),
  b('one-untitled-22', '', [['Foo', false]], 300, 22), b('titled-inline-60', 'Foo', [['A', false], ['B', false]], 300, 60),
  // a title wider than its room fades where it is cut
  b('long-inline-22', LONG, [['A', false], ['B', false]], 160, 22), b('long-60', LONG, [['A', false]], 160, 60),
]));
