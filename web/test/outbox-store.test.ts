/** The outbox store: device first, kept per person, sent in order, retried, refused, ids replaced (ADR 0031). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { CalendarEvent, TaskList } from '@/api/types';
import { memoryKv, setDeviceDb, setDevicePerson, wipeDevice } from '@/lib/deviceDb';
import { useAuthStore } from '@/stores/auth';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { useUiStore } from '@/stores/ui';
import { clearDeviceLog, deviceLog } from '@/lib/deviceLog';
import { ApiClient, setApi } from '@/api/client';
import { apiError, eventFixture, freshPinia, mockFetch } from './helpers';

const list = (o: Partial<TaskList> = {}): TaskList => ({
  kind: 'tasklist', id: 'G', calendarId: 'tasks', title: 'Groceries', date: '2026-10-12', time: null, estimateMinutes: null, recurrence: null, calendarColor: '#000', completedOn: null, canvas: null, categoryId: null, tags: [], color: '#000', etag: 'e1', updated: '',
  items: [{ id: 'm', title: 'Milk', done: false }, { id: 'e', title: 'Eggs', done: false }], doneCount: 0, totalCount: 2, ...o,
});
const tick = (l: TaskList, id: string): TaskList => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, done: true } : i)), doneCount: 1 });
const down = () => apiError(503, 'PROVIDER_UNAVAILABLE');
const writes = (m: ReturnType<typeof mockFetch>) => m.calls.filter((c) => c.method !== 'GET');
const unsent = () => useOutboxStore().entries.map((e) => `${e.change.op} ${e.change.id}`);

let kv: ReturnType<typeof memoryKv>;
beforeEach(() => {
  kv = memoryKv();
  setDeviceDb(kv);
  freshPinia();
  // the stores register with the outbox when they are created
  useItemsStore();
  useDeviceStore();
});
afterEach(() => { setDeviceDb(null); vi.useRealTimers(); });

describe('outbox: device first', () => {
  it('shows a tick at once and keeps the entry on the device while it cannot be sent', async () => {
    mockFetch({ 'PATCH /api/tasklists/G/items/m': down });
    const items = useItemsStore();
    items.upsert(list());
    useOutboxStore().patchItem('G', 'm', { done: true });
    expect((items.get('G') as TaskList).items[0].done).toBe(true);
    await flushPromises();
    expect(unsent()).toEqual(['item.patch G']);
    expect((kv.data.get('outbox') as unknown[]).length).toBe(1);
    expect(document.documentElement.dataset.unsynced).toBe('1');
    expect(useUiStore().snackbars).toEqual([]);
  });

  it('sends in the order made, one at a time, with an Idempotency-Key each, and shows the server\'s answer', async () => {
    const m = mockFetch({
      'PATCH /api/tasklists/G/items/m': () => ({ ...tick(list(), 'm'), etag: 'e2' }),
      'PATCH /api/tasklists/G/items/e': () => ({ ...tick(tick(list(), 'm'), 'e'), etag: 'e3' }),
    });
    const items = useItemsStore();
    items.upsert(list());
    const out = useOutboxStore();
    out.patchItem('G', 'm', { done: true });
    out.patchItem('G', 'e', { done: true });
    await flushPromises();
    expect(writes(m).map((c) => c.path)).toEqual(['/api/tasklists/G/items/m', '/api/tasklists/G/items/e']);
    expect(new Set(writes(m).map((c) => c.headers['Idempotency-Key'])).size).toBe(2);
    expect(out.count).toBe(0);
    expect(items.get('G')).toMatchObject({ etag: 'e3' });
  });

  it('a sync that runs while a change is unsent keeps it on the device copy', async () => {
    mockFetch({ 'PATCH /api/tasklists/G/items/m': down });
    const items = useItemsStore();
    const device = useDeviceStore();
    device.data = { events: [], taskLists: [list()], cursor: 'c', calendars: [], files: {}, window: { from: '2020-01-01', to: '2030-01-01' } } as unknown as typeof device.data;
    items.upsert(list());
    useOutboxStore().patchItem('G', 'm', { done: true });
    await flushPromises();
    device.take({ full: true, cursor: 'c2', window: { from: '2020-01-01', to: '2030-01-01' }, calendars: [], events: { calendars: [], replace: [], series: [], removed: [], upserts: [], failed: [] }, taskLists: { replace: true, series: [], removed: [], upserts: [list()], failed: false }, files: {} } as never);
    expect((device.data!.taskLists[0].items[0]).done).toBe(true);
  });
});

describe('outbox: sending', () => {
  it('retries after a network failure with a growing wait and sends nothing twice', async () => {
    vi.useFakeTimers();
    let up = false;
    const m = mockFetch({ 'PATCH /api/tasklists/G/items/m': () => (up ? tick(list(), 'm') : down()) });
    useItemsStore().upsert(list());
    const out = useOutboxStore();
    out.patchItem('G', 'm', { done: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(writes(m)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes(m)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(writes(m)).toHaveLength(2);
    up = true;
    await vi.advanceTimersByTimeAsync(1);
    expect(writes(m)).toHaveLength(3);
    expect(new Set(writes(m).map((c) => c.headers['Idempotency-Key'])).size).toBe(1);
    expect(out.count).toBe(0);
  });

  it('keeps the entry on a 401 and a 5xx', async () => {
    mockFetch({ 'PATCH /api/tasklists/G/items/m': () => apiError(401, 'UNAUTHENTICATED') });
    useItemsStore().upsert(list());
    useOutboxStore().patchItem('G', 'm', { done: true });
    await flushPromises();
    expect(unsent()).toEqual(['item.patch G']);
  });

  it('on a 412 reads the version again and sends the same fields on it', async () => {
    const m = mockFetch({
      'PATCH /api/events/a': ({ headers }) => (headers['If-Match'] === 'etag-a' ? apiError(412, 'PRECONDITION_FAILED') : { ...eventFixture('a', 's', 'e'), title: 'X', etag: 'z' }),
      'GET /api/events/a': () => ({ ...eventFixture('a', 's', 'e'), etag: 'etag-new' }),
    });
    const ev = eventFixture('a', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00') as CalendarEvent;
    useItemsStore().upsert(ev);
    useOutboxStore().saveEvent({ ...ev, title: 'X' }, { title: 'X' }, false);
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'PATCH').map((c) => [c.headers['If-Match'], c.body])).toEqual([['etag-a', { title: 'X' }], ['etag-new', { title: 'X' }]]);
  });

  it('refuses what the server refuses: undone on the device, noticed with Edit again, later entries go on', async () => {
    const m = mockFetch({
      'PATCH /api/events/a': () => apiError(400, 'VALIDATION_ERROR'),
      'GET /api/events/a': () => eventFixture('a', 's', 'e'),
      'PATCH /api/tasklists/G/items/m': () => tick(list(), 'm'),
    });
    const items = useItemsStore();
    const ev = eventFixture('a', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00') as CalendarEvent;
    items.upsert(ev);
    items.upsert(list());
    const out = useOutboxStore();
    out.saveEvent({ ...ev, title: 'X' }, { title: 'X' }, false);
    out.patchItem('G', 'm', { done: true });
    await flushPromises();
    expect(items.get('a')).toMatchObject({ title: 'a' });
    expect(out.count).toBe(0);
    expect(m.calls.map((c) => c.method + c.path)).toContain('PATCH/api/tasklists/G/items/m');
    const notice = useUiStore().snackbars.find((s) => s.testid === 'outbox-notice')!;
    expect(notice.text).toBe('The change to “X” was not saved because it was rejected.');
    expect(notice.action?.testid).toBe('outbox-edit-again');
    notice.action!.run();
    expect(useUiStore().dialog).toMatchObject({ kind: 'event', props: { id: 'a', draftEvent: { title: 'X' } } });
  });

  it('a change to something deleted elsewhere is refused as "deleted elsewhere", a tick offers no Edit again', async () => {
    mockFetch({ 'PATCH /api/tasklists/G/items/m': () => apiError(404, 'NOT_FOUND'), 'GET /api/tasklists/G': () => apiError(404, 'NOT_FOUND') });
    const items = useItemsStore();
    items.upsert(list());
    useOutboxStore().patchItem('G', 'm', { done: true });
    await flushPromises();
    const notice = useUiStore().snackbars.find((s) => s.testid === 'outbox-notice')!;
    expect(notice.text).toBe('The change to “Milk” was not saved because it was deleted elsewhere.');
    expect(notice.action).toBeUndefined();
    expect(items.get('G')).toBeUndefined();
  });

  it('a delete of something already gone counts as sent', async () => {
    mockFetch({ 'DELETE /api/events/a': () => apiError(404, 'NOT_FOUND') });
    const ev = eventFixture('a', 's', 'e') as CalendarEvent;
    useItemsStore().upsert(ev);
    useOutboxStore().deleteEvent(ev);
    await flushPromises();
    expect(useOutboxStore().count).toBe(0);
    expect(useUiStore().snackbars).toEqual([]);
  });
});

describe('outbox: things created offline', () => {
  it('a device id is replaced by the server\'s in the store, the dialog state and the later entries', async () => {
    let release!: () => void;
    const m = mockFetch({
      'POST /api/tasklists': () => new Promise((r) => { release = () => r({ ...list({ id: 'real' }), items: [{ id: 'srv0', title: 'Passport', done: false }] }); }),
      'PATCH /api/tasklists/real/items/srv0': () => ({ ...list({ id: 'real' }), items: [{ id: 'srv0', title: 'Passport', done: true }], doneCount: 1 }),
    });
    const items = useItemsStore();
    const ui = useUiStore();
    const out = useOutboxStore();
    const local = out.createList({ title: 'Packing', date: '2026-10-14', items: [{ title: 'Passport' }] });
    expect(items.get(local.id)).toBeDefined();
    ui.expandedCard = { id: local.id, date: '2026-10-14' };
    out.patchItem(local.id, (items.get(local.id) as TaskList).items[0].id, { done: true });
    await flushPromises();
    expect(writes(m)).toHaveLength(1);
    release();
    await flushPromises();
    expect(writes(m).map((c) => c.path)).toEqual(['/api/tasklists', '/api/tasklists/real/items/srv0']);
    expect(items.get(local.id)).toBeUndefined();
    expect(items.get('real')).toMatchObject({ items: [{ done: true }] });
    expect(ui.expandedCard.id).toBe('real');
  });

  it('a refused create takes what followed it with it', async () => {
    mockFetch({ 'POST /api/tasklists': () => apiError(400, 'VALIDATION_ERROR') });
    const items = useItemsStore();
    const out = useOutboxStore();
    const local = out.createList({ title: 'Packing', date: null, items: [{ title: 'Passport' }] });
    out.patchItem(local.id, (items.get(local.id) as TaskList).items[0].id, { done: true });
    await flushPromises();
    expect(out.count).toBe(0);
    expect(items.get(local.id)).toBeUndefined();
    expect(useUiStore().snackbars.filter((s) => s.testid === 'outbox-notice')).toHaveLength(1);
  });
});

describe('outbox: people', () => {
  it('never sends under another person: a change of one person is dropped when another is signed in', async () => {
    const m = mockFetch({ 'PATCH /api/tasklists/G/items/m': () => tick(list(), 'm') });
    const auth = useAuthStore();
    auth.status = 'in';
    auth.email = 'jo@example.com';
    useItemsStore().upsert(list());
    const out = useOutboxStore();
    out.entries = [{ key: 'k', person: 'anna@example.com', seq: 1, title: 'Milk', change: { op: 'item.patch', id: 'G', itemId: 'm', patch: { done: true } } }];
    await out.flush();
    expect(m.calls).toEqual([]);
    expect(out.count).toBe(0);
  });

  it('sends once the same person is signed in, and waits while nobody is known', async () => {
    const m = mockFetch({ 'GET /api/auth/me': () => apiError(503, 'PROVIDER_UNAVAILABLE'), 'PATCH /api/tasklists/G/items/m': () => tick(list(), 'm') });
    const auth = useAuthStore();
    auth.status = 'unknown';
    useItemsStore().upsert(list());
    const out = useOutboxStore();
    out.entries = [{ key: 'k', person: 'jo@example.com', seq: 1, title: 'Milk', change: { op: 'item.patch', id: 'G', itemId: 'm', patch: { done: true } } }];
    await out.flush();
    expect(m.calls.map((c) => c.path)).toEqual(['/api/auth/me']);
    expect(out.count).toBe(1);
    auth.status = 'in';
    auth.email = 'Jo@example.com';
    await out.flush();
    expect(out.count).toBe(0);
  });

  it('is read back from the device when the app opens', async () => {
    kv.data.set('outbox', [{ key: 'k', person: '-', seq: 7, title: 'Milk', change: { op: 'item.patch', id: 'G', itemId: 'm', patch: { done: true } } }]);
    const out = useOutboxStore();
    await out.load();
    expect(unsent()).toEqual(['item.patch G']);
    expect(document.documentElement.dataset.unsynced).toBe('1');
  });
});

const tickEntry = (person: string, key = 'k') => ({ key, person, seq: 1, title: 'Milk', change: { op: 'item.patch', id: 'G', itemId: 'm', patch: { done: true } } });

describe('outbox: another person\'s entries', () => {
  beforeEach(() => localStorage.clear());

  it('are not shown to the person signed in on this device, and are purged once they are known', async () => {
    const m = mockFetch({ 'PATCH /api/tasklists/G/items/m': () => tick(list(), 'm') });
    setDevicePerson('jo@example.com');
    kv.data.set('outbox', [tickEntry('anna@example.com')]);
    const items = useItemsStore();
    items.upsert(list());
    const out = useOutboxStore();
    await out.load();
    expect((items.get('G') as TaskList).items[0].done).toBe(false);
    const auth = useAuthStore();
    auth.status = 'in';
    auth.email = 'jo@example.com';
    await out.flush();
    expect(writes(m)).toEqual([]);
    expect(out.count).toBe(0);
    expect(kv.data.get('outbox')).toEqual([]);
  });

  it('are shown only after the person is known, when they are theirs', async () => {
    mockFetch({ 'GET /api/auth/me': () => ({ email: 'jo@example.com', name: 'Jo' }), 'PATCH /api/tasklists/G/items/m': down });
    useAuthStore().status = 'unknown';
    kv.data.set('outbox', [tickEntry('jo@example.com')]);
    const items = useItemsStore();
    items.upsert(list());
    const out = useOutboxStore();
    await out.load();
    expect((items.get('G') as TaskList).items[0].done).toBe(false);
    await out.flush();
    expect((items.get('G') as TaskList).items[0].done).toBe(true);
  });

  it('what is dropped is taken off the screen again', async () => {
    mockFetch({ 'POST /api/tasklists': down });
    const items = useItemsStore();
    const out = useOutboxStore();
    const local = out.createList({ title: 'Packing', date: null });
    await flushPromises();
    expect(items.get(local.id)).toBeDefined();
    out.entries = out.entries.map((e) => ({ ...e, person: 'anna@example.com' }));
    const auth = useAuthStore();
    auth.status = 'in';
    auth.email = 'jo@example.com';
    await out.flush();
    expect(items.get(local.id)).toBeUndefined();
  });

  it('a change made while nobody is known waits for the person and is never dropped', async () => {
    const m = mockFetch({ 'GET /api/auth/me': () => apiError(503, 'PROVIDER_UNAVAILABLE'), 'PATCH /api/tasklists/G/items/m': () => tick(list(), 'm') });
    const auth = useAuthStore();
    auth.status = 'unknown';
    useItemsStore().upsert(list());
    const out = useOutboxStore();
    out.patchItem('G', 'm', { done: true });
    await flushPromises();
    expect(out.count).toBe(1);
    auth.status = 'in';
    auth.email = 'jo@example.com';
    await out.flush();
    expect(out.count).toBe(0);
    expect(writes(m)).toHaveLength(1);
  });
});

describe('outbox: robustness', () => {
  it('a sign-out during a refusal does not bring the entries back', async () => {
    mockFetch({
      'PATCH /api/tasklists/G/items/m': () => apiError(400, 'VALIDATION_ERROR'),
      'GET /api/tasklists/G': async () => { await wipeDevice(); return list(); },
    });
    useItemsStore().upsert(list());
    const out = useOutboxStore();
    out.patchItem('G', 'm', { done: true });
    out.patchItem('G', 'e', { done: true });
    await flushPromises();
    expect(out.count).toBe(0);
    expect(kv.data.get('outbox') ?? []).toEqual([]);
    expect(useUiStore().snackbars).toEqual([]);
  });

  it('a repeating list delete keeps its first path across retries (same key, same request)', async () => {
    let up = false;
    const m = mockFetch({
      'DELETE /api/tasklists/G': () => (up ? { status: 204 } : down()),
      'DELETE /api/tasklists/S': () => ({ status: 204 }),
    });
    vi.useFakeTimers();
    const items = useItemsStore();
    items.upsert(list());
    useOutboxStore().deleteList(list());
    await vi.advanceTimersByTimeAsync(0);
    items.noteSeries('G', 'S');
    up = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes(m).map((c) => c.path)).toEqual(['/api/tasklists/G', '/api/tasklists/G']);
    expect(useOutboxStore().count).toBe(0);
  });

  it('a new change does not send while a retry is waiting', async () => {
    vi.useFakeTimers();
    const m = mockFetch({ 'PATCH /api/tasklists/G/items/m': down, 'PATCH /api/tasklists/G/items/e': () => tick(list(), 'e') });
    useItemsStore().upsert(list());
    const out = useOutboxStore();
    out.patchItem('G', 'm', { done: true });
    await vi.advanceTimersByTimeAsync(0);
    out.patchItem('G', 'e', { done: true });
    await vi.advanceTimersByTimeAsync(500);
    expect(writes(m)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(writes(m)).toHaveLength(2);
  });
});

describe('outbox: device log (feature device-log)', () => {
  beforeEach(() => clearDeviceLog());

  it('logs a refused delete with the decision and what the client saw, never the title', async () => {
    mockFetch({
      'DELETE /api/events/a': () => apiError(400, 'VALIDATION_ERROR'),
      'GET /api/events/a': () => eventFixture('a', 's', 'e'),
    });
    const ev = { ...eventFixture('a', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00'), title: 'Dentist Meyer' } as CalendarEvent;
    useItemsStore().upsert(ev);
    useOutboxStore().deleteEvent(ev);
    await flushPromises();
    const entry = deviceLog.value.find((e) => e.kind === 'outbox')!;
    expect(entry.summary).toBe('event.delete refused DELETE /api/events/:id 400 VALIDATION_ERROR');
    expect(entry.data).toMatchObject({ op: 'event.delete', decision: 'refused', status: 400, code: 'VALIDATION_ERROR', bodyEmpty: false });
    expect(JSON.stringify(deviceLog.value)).not.toContain('Dentist');
  });

  it('logs an answer that is no ApiError with its name and message, kept for a retry', async () => {
    // a body the browser cannot read: the client passes the browser's own error on
    setApi(new ApiClient({ fetch: async () => Object.assign(new Response('{}'), { text: () => Promise.reject(new TypeError('Body stream lost')) }) }));
    useItemsStore().upsert(list());
    useOutboxStore().patchItem('G', 'm', { done: true });
    await flushPromises();
    expect(deviceLog.value.find((e) => e.kind === 'outbox')?.data).toMatchObject({ op: 'item.patch', decision: 'retry-unexpected', errorName: 'TypeError' });
  });
});
