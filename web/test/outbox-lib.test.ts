/** The pure outbox logic: how unsent changes show on the device, id replacement, labels (ADR 0031). */
import { describe, expect, it } from 'vitest';
import type { CalendarEvent, TaskList } from '@/api/types';
import { applyEntry, kindOf, localTaskList, renameId, renameItems, withPending, type Change, type OutboxEntry } from '@/lib/outbox';

const entry = (change: Change, extra: Partial<OutboxEntry> = {}): OutboxEntry => ({ key: 'k', person: 'p', seq: 1, change, title: 't', ...extra });
const list = (): TaskList => ({
  kind: 'tasklist', id: 'L', calendarId: 'c', title: 'Groceries', date: '2026-10-12', time: null, doneCount: 0, totalCount: 2, estimateMinutes: null, categoryId: null, tags: [],
  color: '#000', etag: 'e1', updated: '', items: [{ id: 'm', title: 'Milk', done: false }, { id: 'e', title: 'Eggs', done: false }],
});

describe('applyEntry / withPending', () => {
  it('ticks, adds, renames, deletes and reorders items and keeps the counts', () => {
    const out = withPending(list(), [
      entry({ op: 'item.patch', id: 'L', itemId: 'm', patch: { done: true } }),
      entry({ op: 'item.add', id: 'L', itemId: 'b', title: 'Butter' }),
      entry({ op: 'item.patch', id: 'L', itemId: 'e', patch: { title: 'Free eggs' } }),
      entry({ op: 'item.delete', id: 'L', itemId: 'm' }),
      entry({ op: 'item.order', id: 'L', itemIds: ['b', 'e'] }),
    ]) as TaskList;
    expect(out.items).toEqual([{ id: 'b', title: 'Butter', done: false }, { id: 'e', title: 'Free eggs', done: false }]);
    expect(out).toMatchObject({ doneCount: 0, totalCount: 2 });
  });

  it('applies an add only once', () => {
    const e = entry({ op: 'item.add', id: 'L', itemId: 'b', title: 'Butter' });
    expect((withPending(list(), [e, e]) as TaskList).items).toHaveLength(3);
  });

  it('merges a list patch and drops the time with the date', () => {
    const base = { ...list(), time: '09:00' };
    expect(applyEntry(base, entry({ op: 'list.update', id: 'L', patch: { title: 'Weekend' } }))).toMatchObject({ title: 'Weekend', time: '09:00' });
    expect(applyEntry(base, entry({ op: 'list.update', id: 'L', patch: { date: null } }))).toMatchObject({ date: null, time: null });
  });

  it('shows the event as the form made it, on the version the device has', () => {
    const shown = { kind: 'event', id: 'ev', title: 'Dentist Meyer', etag: 'old' } as CalendarEvent;
    const cur = { kind: 'event', id: 'ev', title: 'Dentist', etag: 'new' } as CalendarEvent;
    expect(applyEntry(cur, entry({ op: 'event.update', id: 'ev', patch: { title: 'Dentist Meyer' } }, { shown }))).toMatchObject({ title: 'Dentist Meyer', etag: 'new' });
  });

  it('a delete wins: nothing is shown', () => {
    expect(withPending(list(), [entry({ op: 'item.patch', id: 'L', itemId: 'm', patch: { done: true } }), entry({ op: 'list.delete', id: 'L' })])).toBeNull();
  });

  it('builds a task list from the create input', () => {
    const tl = localTaskList('dev-1', { title: 'Packing', date: '2026-10-14', items: [{ title: 'Passport' }, { title: 'Sunscreen' }] });
    expect(tl).toMatchObject({ id: 'dev-1', title: 'Packing', date: '2026-10-14', doneCount: 0, totalCount: 2 });
    expect(tl.items.map((i) => i.title)).toEqual(['Passport', 'Sunscreen']);
  });
});

describe('device ids', () => {
  it('replaces the list id in later entries', () => {
    const out = renameId([entry({ op: 'item.patch', id: 'dev-1', itemId: 'x', patch: { done: true } }), entry({ op: 'list.delete', id: 'other' })], 'dev-1', 'real');
    expect(out.map((e) => e.change.id)).toEqual(['real', 'other']);
  });

  it('replaces the ids of a created list\'s items by position', () => {
    const tl = localTaskList('dev-1', { title: 'P', date: null, items: [{ title: 'A' }, { title: 'B' }] });
    const fresh = [{ id: 'srvA', title: 'A', done: false }, { id: 'srvB', title: 'B', done: false }];
    const out = renameItems([
      entry({ op: 'item.patch', id: 'real', itemId: tl.items[1].id, patch: { done: true } }),
      entry({ op: 'item.order', id: 'real', itemIds: [tl.items[1].id, tl.items[0].id] }),
    ], 'real', 'dev-1', fresh);
    expect((out[0].change as { itemId: string }).itemId).toBe('srvB');
    expect((out[1].change as { itemIds: string[] }).itemIds).toEqual(['srvB', 'srvA']);
  });
});

describe('kindOf', () => {
  it('names the change for the list of unsent changes', () => {
    expect(kindOf({ op: 'item.patch', id: 'L', itemId: 'm', patch: { done: true } })).toBe('ticked');
    expect(kindOf({ op: 'item.patch', id: 'L', itemId: 'm', patch: { title: 'x' } })).toBe('renamed');
    expect(kindOf({ op: 'item.add', id: 'L', itemId: 'm', title: 'x' })).toBe('created');
    expect(kindOf({ op: 'event.delete', id: 'e' })).toBe('deleted');
    expect(kindOf({ op: 'event.update', id: 'e', patch: { title: 'x' } })).toBe('changed');
    expect(kindOf({ op: 'list.update', id: 'e', patch: { title: 'x' } })).toBe('renamed');
  });
});
