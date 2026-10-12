import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { apiError, config, eventFixture, freshPinia, mockFetch, settingsFixture } from './helpers';

function setHidden(v: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
}

describe('sync store', () => {
  it('a successful initial load counts as a sync (data-last-sync)', async () => {
    setup();
    await useClockStore().load();
    expect(useSyncStore().lastSync).toBeNull();
    await useItemsStore().setVisible('2026-10-01', '2026-11-01');
    expect(useSyncStore().lastSync).not.toBeNull();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    window.__appTimers = 0;
    freshPinia();
  });
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  function setup(extra: Record<string, () => unknown> = {}) {
    const m = mockFetch({
      'GET /api/config': () => config({ pollIntervalMs: 1000 }),
      'GET /api/items': () => ({ items: [], from: 'a', to: 'b', syncedAt: 'x' }),
      'GET /api/settings': () => settingsFixture(),
      'GET /api/summary': () => ({ days: {} }),
      ...extra,
    });
    return m;
  }
  const count = (m: ReturnType<typeof setup>, p: string) => m.calls.filter((c) => c.path === p).length;

  it('polls every pollIntervalMs with one timer and cleans everything up on stop', async () => {
    const m = setup();
    await useClockStore().load();
    const items = useItemsStore();
    await items.setVisible('2026-10-01', '2026-11-01');
    const sync = useSyncStore();
    const base = count(m, '/api/items');
    sync.start();
    sync.start(); // idempotent
    await vi.advanceTimersByTimeAsync(1000);
    expect(count(m, '/api/items')).toBe(base + 1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(count(m, '/api/items')).toBe(base + 3);
    sync.stop();
    const after = count(m, '/api/items');
    await vi.advanceTimersByTimeAsync(10000);
    expect(count(m, '/api/items')).toBe(after);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses while hidden and resumes with an immediate sync when visible', async () => {
    const m = setup();
    await useClockStore().load();
    await useItemsStore().setVisible('2026-10-01', '2026-11-01');
    const sync = useSyncStore();
    sync.start();
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    const n = count(m, '/api/items');
    await vi.advanceTimersByTimeAsync(5000);
    expect(count(m, '/api/items')).toBe(n);
    expect(vi.getTimerCount()).toBe(0);
    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10);
    expect(count(m, '/api/items')).toBe(n + 1);
    expect(count(m, '/api/config')).toBeGreaterThan(1);
    sync.stop();
  });

  it('refreshes on focus (debounced) and when coming back online', async () => {
    const m = setup();
    await useClockStore().load();
    await useItemsStore().setVisible('2026-10-01', '2026-11-01');
    const sync = useSyncStore();
    sync.start();
    const n = count(m, '/api/items');
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(600);
    expect(count(m, '/api/items')).toBe(n + 1);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);
    expect(count(m, '/api/items')).toBe(n + 2);
    sync.stop();
  });

  it('shows the error on outage and clears it after the next success', async () => {
    let down = false;
    setup({ 'GET /api/items': () => (down ? apiError(503, 'PROVIDER_UNAVAILABLE') : { items: [], from: 'a', to: 'b', syncedAt: 'x' }) });
    await useClockStore().load();
    await useItemsStore().setVisible('2026-10-01', '2026-11-01');
    const sync = useSyncStore();
    down = true;
    await sync.retry();
    expect(sync.state).toBe('error');
    expect(sync.error).toBeInstanceOf(ApiError);
    down = false;
    await sync.retry();
    expect(sync.state).toBe('idle');
    expect(sync.error).toBeNull();
    expect(sync.lastSync).not.toBeNull();
  });

  it('runs registered tasks on every sync', async () => {
    setup();
    await useClockStore().load();
    const sync = useSyncStore();
    const task = vi.fn(async () => undefined);
    const off = sync.registerTask('tray', task);
    await sync.syncNow();
    off();
    await sync.syncNow();
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('clock store', () => {
  beforeEach(() => freshPinia());
  it('uses the frozen server time and the calendar zone for today', async () => {
    mockFetch({ 'GET /api/config': () => config({ now: '2026-10-12T22:30:00.000Z' }) });
    const c = useClockStore();
    await c.load();
    expect(c.today).toBe('2026-10-13'); // 00:30 in Berlin
    expect(c.minutesNow).toBe(30);
  });
  it('falls back to the device clock when config fails', async () => {
    mockFetch({ 'GET /api/config': () => apiError(503, 'PROVIDER_UNAVAILABLE') });
    const c = useClockStore();
    await c.load();
    expect(c.timeZone).toBe('Europe/Berlin');
    expect(c.pollIntervalMs).toBe(30000);
  });
  it('minute ticker leaves no timer behind', async () => {
    vi.useFakeTimers();
    mockFetch({ 'GET /api/config': () => config({ clockFrozen: false }) });
    const c = useClockStore();
    c.startTicker();
    expect(vi.getTimerCount()).toBe(1);
    c.stopTicker();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('items store', () => {
  beforeEach(() => freshPinia());
  const resp = (items: unknown[]) => ({ items, from: 'a', to: 'b', syncedAt: 's' });

  it('caches a range, replaces it on refresh and drops removed items', async () => {
    let list: unknown[] = [eventFixture('a', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00'), eventFixture('b', '2026-10-15T09:00:00+02:00', '2026-10-15T10:00:00+02:00')];
    mockFetch({ 'GET /api/items': () => resp(list) });
    const s = useItemsStore();
    await s.setVisible('2026-10-12', '2026-10-19');
    expect(s.all.map((i) => i.id)).toEqual(['a', 'b']);
    list = [list[1]];
    await s.refreshVisible();
    expect(s.all.map((i) => i.id)).toEqual(['b']);
    expect(s.byDate.get('2026-10-15')).toHaveLength(1);
  });

  it('keeps at most 6 ranges (LRU) and garbage-collects their items', async () => {
    mockFetch({ 'GET /api/items': ({ url }) => resp([eventFixture(url.searchParams.get('from')!, `${url.searchParams.get('from')}T09:00:00+02:00`, `${url.searchParams.get('from')}T10:00:00+02:00`)]) });
    const s = useItemsStore();
    for (let d = 1; d <= 8; d++) await s.setVisible(`2026-10-0${d}`, `2026-10-0${d + 1}`);
    expect(Object.keys(s.ranges)).toHaveLength(6);
    expect(s.all).toHaveLength(6);
  });

  it('sends the cached etag as If-Match and surfaces a 412 conflict', async () => {
    const { calls } = mockFetch({
      'GET /api/items': () => resp([eventFixture('a', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00')]),
      'PATCH /api/events/a': () => apiError(412, 'PRECONDITION_FAILED'),
    });
    const s = useItemsStore();
    await s.setVisible('2026-10-12', '2026-10-19');
    const err = await s.updateEvent('a', { title: 'X' }).catch((e) => e);
    expect(calls.find((c) => c.method === 'PATCH')!.headers['If-Match']).toBe('etag-a');
    expect(err.isConflict).toBe(true);
    expect(s.get('a').title).toBe('a'); // nothing applied
  });

  it('item operations are optimistic, roll back on failure and a poll never undoes them in flight', async () => {
    const tl = { kind: 'tasklist', id: 't', calendarId: 'primary', title: 'G', date: '2026-10-14', time: null, items: [{ id: 'i1', title: 'Milk', done: false }],
      doneCount: 0, totalCount: 1, estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '' };
    let fail = true;
    let gate: Promise<void> = Promise.resolve();
    mockFetch({
      'GET /api/items': () => resp([tl]),
      'PATCH /api/tasklists/t/items/i1': async () => { await gate; return fail ? apiError(503, 'PROVIDER_UNAVAILABLE') : { ...tl, items: [{ id: 'i1', title: 'Milk', done: true }], doneCount: 1 }; },
    });
    const s = useItemsStore();
    await s.setVisible('2026-10-12', '2026-10-19');
    const tick = (l: typeof tl) => ({ ...l, items: l.items.map((i) => ({ ...i, done: true })), doneCount: 1 });
    const { api } = await import('@/api/client');
    let release!: () => void;
    gate = new Promise((r) => { release = r; });
    const p = s.optimistic('t', tick as never, () => api.updateTaskItem('t', 'i1', { done: true })).catch((e) => e);
    expect((s.get('t') as typeof tl).doneCount).toBe(1); // applied at once
    await s.refreshVisible(); // poll while pending: optimistic state kept
    expect((s.get('t') as typeof tl).doneCount).toBe(1);
    release();
    const e = await p;
    expect(e).toBeInstanceOf(ApiError);
    expect((s.get('t') as typeof tl).doneCount).toBe(0); // rolled back
    fail = false;
    gate = Promise.resolve();
    await s.optimistic('t', tick as never, () => api.updateTaskItem('t', 'i1', { done: true }));
    expect((s.get('t') as typeof tl).doneCount).toBe(1);
  });

  it('aborts a superseded range load', async () => {
    let n = 0;
    mockFetch({ 'GET /api/items': () => resp([eventFixture('x' + n++, '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00')]) });
    const s = useItemsStore();
    await Promise.all([s.setVisible('2026-10-12', '2026-10-19'), s.setVisible('2026-10-19', '2026-10-26')]);
    expect(s.visible!.from).toBe('2026-10-19');
  });
});

describe('settings store', () => {
  beforeEach(() => freshPinia());
  it('patches optimistically with If-Match, rolls back on failure', async () => {
    let fail = false;
    const { calls } = mockFetch({
      'GET /api/settings': () => settingsFixture(),
      'PATCH /api/settings': ({ body }) => (fail ? apiError(503, 'PROVIDER_UNAVAILABLE') : settingsFixture({ ...body, version: 2 })),
    });
    const s = useSettingsStore();
    await s.load();
    const p = s.patch({ themeMode: 'dark' });
    expect(s.settings.themeMode).toBe('dark');
    await p;
    expect(calls.at(-1)!.headers['If-Match']).toBe('1');
    expect(s.settings.version).toBe(2);
    fail = true;
    await s.patch({ themeMode: 'light' }).catch(() => undefined);
    expect(s.settings.themeMode).toBe('dark');
    expect(s.saveError).toBeTruthy();
  });
  it('re-reads and retries once on a stale version (412)', async () => {
    let first = true;
    const { calls } = mockFetch({
      'GET /api/settings': () => settingsFixture({ version: 5, defaultView: 'week' }),
      'PATCH /api/settings': ({ body, headers }) => {
        if (first) { first = false; return apiError(412, 'PRECONDITION_FAILED'); }
        return settingsFixture({ ...body, version: Number(headers['If-Match']) + 1, defaultView: 'week' });
      },
    });
    const s = useSettingsStore();
    await s.patch({ sounds: true });
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2);
    expect(s.settings.version).toBe(6);
    expect(s.settings.sounds).toBe(true);
    expect(s.settings.defaultView).toBe('week');
  });
  it('resolves the effective scene from scene + garden and sets the Mordor preset', async () => {
    let server = settingsFixture();
    mockFetch({
      'GET /api/settings': () => server,
      'PATCH /api/settings': ({ body }) => (server = settingsFixture({ ...server, ...body, version: server.version + 1 })),
    });
    const s = useSettingsStore();
    await s.load();
    expect(s.effectiveScene).toBe('none'); // sunflowers scene needs garden = sunflowers
    await s.patch({ garden: 'sunflowers' });
    expect(s.effectiveScene).toBe('sunflowers');
    await s.applyMordor();
    expect(s.settings).toMatchObject({ seedColor: '#c43e00', themeMode: 'dark', scene: 'mordor' });
    await s.patch({ garden: 'off' });
    expect(s.effectiveScene).toBe('mordor');
  });
});
