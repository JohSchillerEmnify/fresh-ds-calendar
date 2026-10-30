import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import { changesFixture, config, freshPinia, mockFetch } from './helpers';

const down = () => ({ status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'x' } } });
const limited = (retryAfter?: number) => () => ({ status: 503, body: { error: { code: 'RATE_LIMITED', message: 'x' } }, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined });
const ok = { items: [], from: '2026-10-12', to: '2026-10-19', syncedAt: 'x' };

describe('sync against a failing or rate-limited server', () => {
  beforeEach(() => { freshPinia(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  function setup(route: () => unknown) {
    const m = mockFetch({
      'GET /api/config': () => config(),
      'GET /api/items': () => route(), 'GET /api/changes': () => (route() === ok ? changesFixture() : route()),
      'GET /api/calendars': () => (route() === ok ? { calendars: [] } : route()), 'GET /api/summary': () => (route() === ok ? { days: {} } : route()),
      'GET /api/tasklists/open': () => (route() === ok ? { items: [], finishedToday: [] } : route()),
      'POST /api/diag/sync-error': () => ({ status: 204 }),
    });
    const reads = () => m.calls.filter((c) => c.path.startsWith('/api/') && !c.path.includes('/diag/') && c.path !== '/api/config');
    return { m, reads };
  }
  const flap = () => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); };

  it('makes no request storm while every call answers 503, even when focus and visibility flap every second', async () => {
    const { reads } = setup(down);
    await useClockStore().load();
    const sync = useSyncStore();
    const items = useItemsStore();
    sync.start();
    items.setVisible('2026-10-12', '2026-10-19', true).catch((e) => sync.reportError(e));
    await vi.advanceTimersByTimeAsync(1_000);
    const first = reads().length;
    for (let i = 0; i < 20; i++) { flap(); await vi.advanceTimersByTimeAsync(1_000); }
    // 21 s on: the one failed sync, the route load and nothing more; the poll (30 s) has not fired yet
    expect(reads().length).toBe(first);
    expect(first).toBeLessThanOrEqual(6);
    window.dispatchEvent(new Event('online')); // the network coming back is not held back
    await vi.advanceTimersByTimeAsync(100);
    expect(reads().length).toBeGreaterThan(first);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reads().length).toBeLessThanOrEqual(first + 10);
    sync.stop();
  });

  it('a failed sync never queues an immediate follow-up', async () => {
    const { reads } = setup(down);
    await useClockStore().load();
    const sync = useSyncStore();
    sync.start();
    useItemsStore().setVisible('2026-10-12', '2026-10-19').catch(() => undefined);
    const p = sync.syncNow();
    void sync.syncNow(); // a trigger during the run
    await p;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(reads().filter((c) => c.path === '/api/changes')).toHaveLength(1);
    sync.stop();
  });

  it('shows no banner for a rate limit while data is on screen, and waits for Retry-After', async () => {
    let route: () => unknown = () => ok;
    const { m, reads } = setup(() => route());
    await useClockStore().load();
    const sync = useSyncStore();
    const items = useItemsStore();
    await items.setVisible('2026-10-12', '2026-10-19');
    sync.start();
    route = limited(90);
    await sync.syncNow();
    expect(sync.error).toBeNull();
    expect(sync.state).toBe('idle');
    expect(sync.rateLimited).toBe(true);
    expect(m.calls.filter((c) => c.path === '/api/diag/sync-error')).toHaveLength(0);
    const n = reads().length;
    flap();
    await vi.advanceTimersByTimeAsync(60_000); // the 30 s poll interval passed, Retry-After (90 s) did not
    expect(reads().length).toBe(n);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(reads().length).toBeGreaterThan(n);
    route = () => ok;
    await vi.advanceTimersByTimeAsync(100_000);
    expect(sync.rateLimited).toBe(false);
    sync.stop();
  });

  it('shows the banner for a rate limit when nothing is on screen yet', async () => {
    setup(limited(5));
    await useClockStore().load();
    const sync = useSyncStore();
    await sync.syncNow();
    expect(sync.error).not.toBeNull();
    expect(sync.state).toBe('error');
  });

  it('no banner and no error for a stale 200 answer', async () => {
    const { reads } = setup(() => ok);
    await useClockStore().load();
    const sync = useSyncStore();
    const items = useItemsStore();
    await items.setVisible('2026-10-12', '2026-10-19');
    await sync.syncNow();
    expect(sync.error).toBeNull();
    expect(sync.state).toBe('idle');
    expect(reads().length).toBeGreaterThan(0);
  });

  it('does not re-request a range whose background load just failed', async () => {
    const { reads } = setup(down);
    await useClockStore().load();
    const items = useItemsStore();
    items.prefetch('2026-10-19', '2026-10-26');
    await vi.advanceTimersByTimeAsync(100);
    items.prefetch('2026-10-19', '2026-10-26');
    items.prefetch('2026-10-19', '2026-10-26');
    await vi.advanceTimersByTimeAsync(100);
    expect(reads().filter((c) => c.path === '/api/items')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(31_000);
    items.prefetch('2026-10-19', '2026-10-26');
    await vi.advanceTimersByTimeAsync(100);
    expect(reads().filter((c) => c.path === '/api/items')).toHaveLength(2);
  });
});
