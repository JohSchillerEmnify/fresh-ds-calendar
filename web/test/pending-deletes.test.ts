import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { CalendarEvent, TaskList } from '@/api/types';
import { useItemsStore } from '@/stores/items';
import { UNDO_MS, usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { apiError, eventFixture, freshPinia, mockFetch } from './helpers';

const ev = eventFixture('Dentist', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00') as CalendarEvent;
const list = (): TaskList => ({
  kind: 'tasklist', id: 'G', calendarId: 'primary', title: 'Groceries', date: '2026-10-14', time: null,
  items: [{ id: 'm', title: 'Milk', done: false }, { id: 'e', title: 'Eggs', done: true }, { id: 'b', title: 'Bread', done: false }],
  doneCount: 1, totalCount: 3, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', etag: '"e-G"', updated: 'x',
});
const deletes = (m: ReturnType<typeof mockFetch>) => m.calls.filter((c) => c.method === 'DELETE').map((c) => c.path);
const snack = () => useUiStore().snackbars.find((s) => s.testid === 'undo-snackbar');

describe('pending deletes (delete with undo)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    freshPinia();
  });
  afterEach(() => {
    usePendingDeletesStore().undo(); // no pending delete leaks into the next test
    vi.useRealTimers();
  });

  it('hides at once, offers undo and sends the DELETE only when the undo time is over', async () => {
    const m = mockFetch({ 'DELETE /api/events/Dentist': () => ({ status: 204 }) });
    const items = useItemsStore();
    items.upsert(ev);
    usePendingDeletesStore().deleteEvent(ev);
    expect(items.get('Dentist')).toBeUndefined();
    expect(snack()).toMatchObject({ text: 'Deleted: Dentist', action: { label: 'Undo', testid: 'undo-action' } });
    expect(window.__pendingDeletes).toBe(1);
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(deletes(m)).toEqual([]);
    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(deletes(m)).toEqual(['/api/events/Dentist']);
    expect(m.calls[0].headers['If-Match']).toBe('etag-Dentist');
    expect(snack()).toBeUndefined();
    expect(window.__pendingDeletes).toBe(0);
    items.applyResponse('2026-10-12', '2026-10-19', [ev], 's'); // a stale poll does not bring it back
    expect(items.get('Dentist')).toBeUndefined();
  });

  it('undo brings the entry back without a request, also after a poll', async () => {
    const m = mockFetch({});
    const items = useItemsStore();
    items.upsert(ev);
    usePendingDeletesStore().deleteEvent(ev);
    items.applyResponse('2026-10-12', '2026-10-19', [ev], 's');
    expect(items.get('Dentist')).toBeUndefined();
    snack()!.action!.run();
    expect(items.get('Dentist')).toEqual(ev);
    vi.advanceTimersByTime(UNDO_MS * 2);
    await flushPromises();
    expect(m.calls).toEqual([]);
    expect(snack()).toBeUndefined();
  });

  it('a new delete sends the previous one at once; one snackbar at a time', async () => {
    const m = mockFetch({ 'DELETE /api/events/Dentist': () => ({ status: 204 }), 'DELETE /api/tasklists/G': () => ({ status: 204 }) });
    const pd = usePendingDeletesStore();
    useItemsStore().upsert(ev);
    useItemsStore().upsert(list());
    pd.deleteEvent(ev);
    pd.deleteTaskList({ ...list(), title: '' });
    await flushPromises();
    expect(deletes(m)).toEqual(['/api/events/Dentist']);
    expect(useUiStore().snackbars.filter((s) => s.testid === 'undo-snackbar').map((s) => s.text)).toEqual(['Deleted: Task list']);
  });

  it('pagehide and a hidden tab send the pending delete with keepalive', async () => {
    const m = mockFetch({ 'DELETE /api/events/Dentist': () => ({ status: 204 }) });
    useItemsStore().upsert(ev);
    usePendingDeletesStore().deleteEvent(ev);
    window.dispatchEvent(new Event('pagehide'));
    await flushPromises();
    expect(deletes(m)).toEqual(['/api/events/Dentist']);
    expect(m.fn.mock.calls[0][1]).toMatchObject({ keepalive: true });
  });

  it('a failed delete brings the entry back and shows the sync error banner', async () => {
    mockFetch({ 'DELETE /api/events/Dentist': () => apiError(503, 'GOOGLE_UNAVAILABLE') });
    const items = useItemsStore();
    items.upsert(ev);
    usePendingDeletesStore().deleteEvent(ev);
    await usePendingDeletesStore().flush();
    expect(items.get('Dentist')).toEqual(ev);
    expect(useSyncStore().error).not.toBeNull();
  });

  it('an entry already gone on the server stays gone', async () => {
    mockFetch({ 'DELETE /api/events/Dentist': () => apiError(404, 'NOT_FOUND') });
    const items = useItemsStore();
    items.upsert(ev);
    usePendingDeletesStore().deleteEvent(ev);
    await usePendingDeletesStore().flush();
    expect(items.get('Dentist')).toBeUndefined();
  });

  it('a task list item is hidden (also from polls) and undo puts it back at its index', () => {
    mockFetch({});
    const items = useItemsStore();
    items.upsert(list());
    usePendingDeletesStore().deleteTaskItem('G', list().items[1], 1);
    const titles = () => (items.get('G') as TaskList).items.map((i) => i.title);
    expect(titles()).toEqual(['Milk', 'Bread']);
    expect(items.get('G')).toMatchObject({ doneCount: 0, totalCount: 2 });
    items.applyResponse('2026-10-12', '2026-10-19', [list()], 's');
    expect(titles()).toEqual(['Milk', 'Bread']);
    expect(snack()!.text).toBe('Deleted: Eggs');
    usePendingDeletesStore().undo();
    expect(titles()).toEqual(['Milk', 'Eggs', 'Bread']);
    expect(items.get('G')).toMatchObject({ doneCount: 1, totalCount: 3 });
  });

  it('a task list item delete is sent through the list queue when the undo time is over', async () => {
    const m = mockFetch({ 'DELETE /api/tasklists/G/items/e': () => ({ ...list(), items: list().items.filter((i) => i.id !== 'e'), etag: '"e2"' }) });
    const items = useItemsStore();
    items.upsert(list());
    usePendingDeletesStore().deleteTaskItem('G', list().items[1], 1);
    vi.advanceTimersByTime(UNDO_MS);
    await flushPromises();
    expect(deletes(m)).toEqual(['/api/tasklists/G/items/e']);
    expect(items.get('G')).toMatchObject({ etag: '"e2"', items: [{ id: 'm' }, { id: 'b' }] });
  });
});
