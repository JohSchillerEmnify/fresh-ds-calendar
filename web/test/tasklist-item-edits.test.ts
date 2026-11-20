/** The item lines of the task list form: what a changed text turns into (feature tasklists-crud, issue 177). */
import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/api/types';
import { parseIndented } from '@calendar/shared/subtasks';
import { finalOrder, linesOfItems, planItemEdits } from '@/features/tasklists/itemEdits';

const it$ = (id: string, title: string, over: Partial<TaskItem> = {}): TaskItem => ({ id, title, done: false, ...over });
const plan = (items: TaskItem[], text: string) => planItemEdits(items, parseIndented(text));
const order = (items: TaskItem[], text: string) => finalOrder(items, parseIndented(text), plan(items, text), (n) => `new${n}`);
const milk = [it$('m', 'Milk', { done: true }), it$('e', 'Eggs'), it$('b', 'Bread')];

describe('linesOfItems', () => {
  it('writes a subtask with spaces and leaves handwritten items out', () => {
    expect(linesOfItems([it$('a', 'Tent'), it$('b', 'Pegs', { level: 1 }), it$('i', '', { ink: true }), it$('c', 'Poles', { level: 2 })])).toBe('Tent\n  Pegs\n    Poles');
  });
});

describe('planItemEdits', () => {
  it('changes nothing for the same lines', () => {
    const p = plan(milk, 'Milk\nEggs\nBread');
    expect(p).toMatchObject({ renames: [], deletes: [], adds: [], flatten: false });
    expect(order(milk, 'Milk\nEggs\nBread')).toBeNull();
  });
  it('adds a line at the end without an order', () => {
    expect(plan(milk, 'Milk\nEggs\nBread\nTea').adds).toEqual([3]);
    expect(order(milk, 'Milk\nEggs\nBread\nTea')).toBeNull();
  });
  it('adds a line in the middle and orders', () => {
    expect(plan(milk, 'Milk\nTea\nEggs\nBread').adds).toEqual([1]);
    expect(order(milk, 'Milk\nTea\nEggs\nBread')).toEqual({ ids: ['m', 'new1', 'e', 'b'], levels: [0, 0, 0, 0] });
  });
  it('renames a changed line in place', () => {
    const p = plan(milk, 'Oat milk\nEggs\nBread');
    expect(p.renames).toEqual([{ id: 'm', title: 'Oat milk' }]);
    expect(p.deletes).toEqual([]);
    expect(p.adds).toEqual([]);
  });
  it('removes a line that is gone', () => {
    expect(plan(milk, 'Milk\nBread').deletes).toEqual([{ id: 'e', title: 'Eggs' }]);
  });
  it('pairs more lines than items as renames then adds, fewer as renames then deletes', () => {
    const p = plan([it$('a', 'A'), it$('b', 'B')], 'X\nY\nZ');
    expect(p.renames.map((r) => r.id)).toEqual(['a', 'b']);
    expect(p.adds).toEqual([2]);
    const q = plan([it$('a', 'A'), it$('b', 'B'), it$('c', 'C')], 'X');
    expect(q.renames).toEqual([{ id: 'a', title: 'X' }]);
    expect(q.deletes.map((d) => d.id)).toEqual(['b', 'c']);
  });
  it('changes a level by indenting and orders', () => {
    expect(order(milk, 'Milk\n  Eggs\nBread')).toEqual({ ids: ['m', 'e', 'b'], levels: [0, 1, 0] });
  });
  it('flattens first when a removed task leaves subtasks behind', () => {
    const items = [it$('t', 'Tent'), it$('p', 'Pegs', { level: 1 })];
    const p = plan(items, 'Pegs');
    expect(p.deletes.map((d) => d.id)).toEqual(['t']);
    expect(p.flatten).toBe(true);
    expect(order(items, 'Pegs')).toEqual({ ids: ['p'], levels: [0] });
  });
  it('does not flatten when the subtasks go too', () => {
    expect(plan([it$('t', 'Tent'), it$('p', 'Pegs', { level: 1 })], '').flatten).toBe(false);
  });
  it('keeps a handwritten item after the item it followed', () => {
    const items = [it$('a', 'A'), it$('i', '', { ink: true }), it$('b', 'B')];
    expect(order(items, 'A\nNew\nB')).toEqual({ ids: ['a', 'i', 'new1', 'b'], levels: [0, 0, 0, 0] });
  });
  it('moves the handwriting of a removed item to the end', () => {
    const items = [it$('a', 'A'), it$('i', '', { ink: true }), it$('b', 'B')];
    expect(order(items, 'B')).toEqual({ ids: ['b', 'i'], levels: [0, 0] });
  });
});
