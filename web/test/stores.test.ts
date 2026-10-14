import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useThemeStore } from '@/stores/theme';
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
      'GET /api/calendars': () => ({ calendars: [] }),
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
  it('never claims the mock provider before the config has loaded or when it is refused', async () => {
    mockFetch({ 'GET /api/config': () => apiError(401, 'UNAUTHENTICATED') });
    const c = useClockStore();
    expect(c.config.provider).toBeNull();
    await c.load();
    expect(c.loaded).toBe(false);
    expect(c.config.provider).toBeNull();
  });
  it('takes the provider from the config once it has loaded', async () => {
    mockFetch({ 'GET /api/config': () => config({ provider: 'google' }) });
    const c = useClockStore();
    await c.load();
    expect(c.config.provider).toBe('google');
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

describe('auth store', () => {
  beforeEach(() => freshPinia());
  it('is signed out when the session is refused', async () => {
    mockFetch({ 'GET /api/auth/me': () => apiError(401, 'UNAUTHENTICATED') });
    const a = useAuthStore();
    await a.check();
    expect(a.status).toBe('out');
  });
  it('is off only when the server says sign-in is off', async () => {
    mockFetch({ 'GET /api/auth/me': () => ({ email: null, name: null }) });
    const a = useAuthStore();
    await a.check();
    expect(a.status).toBe('off');
  });
  it('does not mistake a failed check for "sign-in is off" and asks again next time', async () => {
    let fail = true;
    mockFetch({ 'GET /api/auth/me': () => (fail ? apiError(503, 'PROVIDER_UNAVAILABLE') : apiError(401, 'UNAUTHENTICATED')) });
    const a = useAuthStore();
    await a.check();
    expect(a.status).toBe('unknown');
    fail = false;
    await a.check();
    expect(a.status).toBe('out');
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

  it('keeps today loaded in the same request (also) when today is outside the visible range', async () => {
    const { calls } = mockFetch({
      'GET /api/config': () => config(), // today = 2026-10-12
      'GET /api/items': () => resp([
        eventFixture('nov', '2026-11-03T09:00:00+01:00', '2026-11-03T10:00:00+01:00'),
        eventFixture('today', '2026-10-12T09:00:00+02:00', '2026-10-12T10:00:00+02:00'),
      ]),
    });
    await useClockStore().load();
    const s = useItemsStore();
    await s.setVisible('2026-11-01', '2026-12-01', true);
    const reqs = calls.filter((c) => c.path === '/api/items');
    expect(reqs).toHaveLength(1);
    expect(reqs[0].url.searchParams.get('also')).toBe('2026-10-12..2026-10-13');
    expect(s.ranges['2026-11-01_2026-12-01'].ids).toEqual(['nov']);
    expect(s.ranges['2026-10-12_2026-10-13'].ids).toEqual(['today']);
    expect(s.all.map((i) => i.id).sort()).toEqual(['nov', 'today']);
    await s.refreshVisible();
    expect(calls.filter((c) => c.path === '/api/items')).toHaveLength(2);
  });

  it('sends no also range when today is inside the visible range or not wanted', async () => {
    const { calls } = mockFetch({ 'GET /api/config': () => config(), 'GET /api/items': () => resp([]) });
    await useClockStore().load();
    const s = useItemsStore();
    await s.setVisible('2026-10-12', '2026-10-19', true);
    await s.setVisible('2026-11-01', '2026-12-01');
    const reqs = calls.filter((c) => c.path === '/api/items');
    expect(reqs).toHaveLength(2);
    expect(reqs.every((c) => !c.url.searchParams.has('also'))).toBe(true);
  });

  it('aborts a superseded range load', async () => {
    let n = 0;
    mockFetch({ 'GET /api/items': () => resp([eventFixture('x' + n++, '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00')]) });
    const s = useItemsStore();
    await Promise.all([s.setVisible('2026-10-12', '2026-10-19'), s.setVisible('2026-10-19', '2026-10-26')]);
    expect(s.visible!.from).toBe('2026-10-19');
  });
});

describe('prefs store', () => {
  beforeEach(() => freshPinia());
  it('starts with the Approaching card and its track on (3 h), applies loaded prefs and rolls back a refused change', async () => {
    let fail = false;
    mockFetch({
      'GET /api/prefs': () => ({ labs: false, approachBar: false, approachWindowHours: 5, approachingCard: false, tasksCalendarVisible: false }),
      'PATCH /api/prefs': () => (fail ? apiError(400, 'VALIDATION') : {}),
    });
    const p = usePrefsStore();
    expect(p).toMatchObject({ approachBar: true, approachingCard: true, approachWindowHours: 3 });
    await p.load();
    expect(p).toMatchObject({ approachBar: false, approachingCard: false, approachWindowHours: 5 });
    await p.set({ approachingCard: true, approachWindowHours: 24 });
    expect(p).toMatchObject({ approachingCard: true, approachWindowHours: 24 });
    fail = true;
    await expect(p.set({ approachingCard: false })).rejects.toThrow();
    expect(p.approachingCard).toBe(true);
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
  it('resolves the effective scene from the theme scene alone, whatever the plant setting', async () => {
    let server = settingsFixture();
    mockFetch({
      'GET /api/settings': () => server,
      'PATCH /api/settings': ({ body }) => (server = settingsFixture({ ...server, ...body, version: server.version + 1 })),
      'PATCH /api/prefs/theme': ({ body }) => body,
    });
    const s = useSettingsStore();
    await s.load();
    const theme = useThemeStore();
    theme.pref = { preset: 'Default', overrides: {}, seasonal: 'off' };
    expect(s.effectiveScene).toBe('none'); // the Default theme has no scene of its own
    await theme.pick('scene', 'sunflowers');
    expect(s.effectiveScene).toBe('sunflowers');
    await s.patch({ plant: false });
    expect(s.effectiveScene).toBe('sunflowers');
    await theme.pick('scene', 'mordor');
    expect(s.effectiveScene).toBe('mordor');
  });
});

describe('deleted items', () => {
  it('a fetch that was in flight during the delete does not bring the task list back', async () => {
    freshPinia();
    const items = useItemsStore();
    const list = { kind: 'tasklist', id: 'g', title: 'G', date: '2026-10-14', time: null, items: [], doneCount: 0, totalCount: 0, categoryId: null, tags: [], color: '#000', etag: 'x' } as never;
    items.upsert(list);
    mockFetch({ 'DELETE /api/tasklists/g': () => ({}) });
    await items.deleteTaskList('g');
    items.applyResponse('2026-10-01', '2026-11-01', [list], 's');
    expect(items.get('g')).toBeUndefined();
  });
});
