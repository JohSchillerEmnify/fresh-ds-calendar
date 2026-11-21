/** How unsent changes show subtasks on the device: the same rules as the server (feature tasklist-subtasks). */
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { TaskList } from '@/api/types';
import { createPinia, setActivePinia } from 'pinia';
import { useItemsStore } from '@/stores/items';
import { localTaskList, withPending, type Change, type OutboxEntry } from '@/lib/outbox';
import { perform } from '@/lib/outboxSend';

const entry = (change: Change): OutboxEntry => ({ key: 'k', person: 'p', seq: 1, change, title: 't' });
const list = (): TaskList => ({
  kind: 'tasklist', id: 'L', calendarId: 'c', title: 'Packing', date: '2026-10-14', time: null, doneCount: 0, totalCount: 4, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], calendarColor: '#000', completedOn: null, canvas: null,
  color: '#000', etag: 'e1', updated: '',
  items: [{ id: 'tent', title: 'Tent', done: false }, { id: 'pegs', title: 'Pegs', done: false, level: 1 }, { id: 'poles', title: 'Poles', done: false, level: 2 }, { id: 'food', title: 'Food', done: false }],
});
const apply = (...c: Change[]) => withPending(list(), c.map(entry)) as TaskList;
const levels = (l: TaskList) => l.items.map((i) => i.level ?? 0);

describe('subtasks on the device before the server answers', () => {
  it('a reorder with levels sets place and level together; without levels they stay', () => {
    expect(levels(apply({ op: 'item.order', id: 'L', itemIds: ['tent', 'pegs', 'poles', 'food'], levels: [0, 1, 2, 1] }))).toEqual([0, 1, 2, 1]);
    expect(levels(apply({ op: 'item.order', id: 'L', itemIds: ['food', 'tent', 'pegs', 'poles'] }))).toEqual([0, 0, 1, 2]);
  });
  it('a tick goes to the subtasks, a tick of a subtask leaves its task', () => {
    expect(apply({ op: 'item.patch', id: 'L', itemId: 'tent', patch: { done: true } }).items.map((i) => i.done)).toEqual([true, true, true, false]);
    const sub = apply({ op: 'item.patch', id: 'L', itemId: 'pegs', patch: { done: true } });
    expect(sub.items.map((i) => i.done)).toEqual([false, true, true, false]);
    expect(sub.doneCount).toBe(2);
  });
  it('unticking a subtask of a done task opens the task; a reorder under a done task opens it', () => {
    const open = apply({ op: 'item.patch', id: 'L', itemId: 'tent', patch: { done: true } }, { op: 'item.patch', id: 'L', itemId: 'poles', patch: { done: false } });
    expect(open.items.map((i) => i.done)).toEqual([false, false, false, false]);
    expect(open.doneCount).toBe(0);
    const moved = apply({ op: 'item.patch', id: 'L', itemId: 'tent', patch: { done: true } }, { op: 'item.order', id: 'L', itemIds: ['tent', 'food', 'pegs', 'poles'], levels: [0, 1, 1, 2] });
    expect(moved.items.map((i) => i.done)).toEqual([false, false, true, true]);
    expect(moved.doneCount).toBe(2);
    const under = apply({ op: 'item.patch', id: 'L', itemId: 'food', patch: { done: true } }, { op: 'item.order', id: 'L', itemIds: ['tent', 'pegs', 'poles', 'food'], levels: [0, 1, 2, 0] }, { op: 'item.add', id: 'L', itemId: 'new', title: 'Stove', level: 1 });
    expect(under.items.map((i) => i.done)).toEqual([false, false, false, false, false]);
  });
  it('a rename ticks nothing', () => {
    expect(apply({ op: 'item.patch', id: 'L', itemId: 'tent', patch: { title: 'Big tent' } }).items.map((i) => i.done)).toEqual([false, false, false, false]);
  });
  it('removing a task removes its subtasks', () => {
    const out = apply({ op: 'item.delete', id: 'L', itemId: 'tent' });
    expect(out.items.map((i) => i.id)).toEqual(['food']);
    expect(out.totalCount).toBe(1);
  });
  it('a new list keeps the levels of its lines, made valid', () => {
    const l = localTaskList('N', { title: 'Camping', date: null, items: [{ title: 'Tent' }, { title: 'Pegs', level: 1 }, { title: 'Poles', level: 2 }, { title: 'Food', level: 2 }] });
    expect(levels(l)).toEqual([0, 1, 2, 2]);
    expect(levels(localTaskList('N', { title: 'C', date: null, items: [{ title: 'A', level: 2 }] }))).toEqual([0]);
  });
  it('an added item with level 2 after a task shows level 1, and is sent with its level', async () => {
    const add: Change = { op: 'item.add', id: 'L', itemId: 'newitem1', title: 'Rope', level: 2 };
    expect(levels(withPending({ ...list(), items: [{ id: 'a', title: 'A', done: false }] }, [entry(add)]) as TaskList)).toEqual([0, 1]);
    const send = vi.spyOn(api, 'addTaskItem').mockResolvedValue({} as TaskList);
    await perform(entry(add));
    expect(send).toHaveBeenCalledWith('L', expect.objectContaining({ title: 'Rope', level: 2 }), expect.anything(), undefined);
    send.mockRestore();
  });
});

describe('a list cached before the repair', () => {
  it('shows a done task over an open subtask open, with the counts that follow', () => {
    setActivePinia(createPinia());
    const items = useItemsStore();
    const old = list();
    items.upsert({ ...old, items: [{ id: 'a', title: 'Tidy up', done: true }, { id: 'b', title: 'Fold clothes', done: false, level: 1 }], doneCount: 1, totalCount: 2 });
    const shown = items.get('L') as TaskList;
    expect(shown.items.map((i) => i.done)).toEqual([false, false]);
    expect(shown.doneCount).toBe(0);
  });
});
