import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startLiveSync } from '@/lib/liveSync';
import { useClockStore } from '@/stores/clock';
import { useSyncStore } from '@/stores/sync';
import { changesFixture, config, freshPinia, mockFetch } from './helpers';

/** A stand-in for the browser's `EventSource` that the test drives. */
class FakeSource {
  static CLOSED = 2;
  static all: FakeSource[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private handlers = new Map<string, () => void>();
  constructor(readonly url: string, readonly init?: { withCredentials?: boolean }) { FakeSource.all.push(this); }
  addEventListener(type: string, fn: () => void) { this.handlers.set(type, fn); }
  close() { this.readyState = FakeSource.CLOSED; }
  nudge() { this.handlers.get('changed')!(); }
  get live() { return FakeSource.all.filter((s) => s.readyState !== FakeSource.CLOSED); }
}

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('the live subscriber', () => {
  beforeEach(() => { FakeSource.all = []; vi.stubGlobal('EventSource', FakeSource); setHidden(false); });
  afterEach(() => { vi.unstubAllGlobals(); setHidden(false); });

  it('holds one stream while visible, syncs on a nudge and after a reconnect, and nothing while hidden', () => {
    const changed = vi.fn(), connected = vi.fn();
    const stop = startLiveSync({ changed, connected });
    expect(FakeSource.all).toHaveLength(1);
    expect(FakeSource.all[0]!.url).toBe('/api/events/stream');
    const s = FakeSource.all[0]!;
    s.onopen!();
    expect(changed).not.toHaveBeenCalled(); // the first open is covered by the sync that opened the app
    expect(connected).toHaveBeenLastCalledWith(true);
    s.nudge();
    expect(changed).toHaveBeenCalledTimes(1);
    s.onerror!(); // the browser reconnects by itself
    expect(connected).toHaveBeenLastCalledWith(false);
    s.onopen!();
    expect(changed).toHaveBeenCalledTimes(2);
    setHidden(true);
    expect(s.live).toHaveLength(0);
    setHidden(false);
    expect(s.live).toHaveLength(1);
    FakeSource.all[1]!.onopen!();
    expect(changed).toHaveBeenCalledTimes(2); // shown again: the visibility sync covers it
    stop();
    expect(s.live).toHaveLength(0);
  });

  it('reopens with growing waits after the browser gave up (the server restarted), and stops when signed out', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const stop = startLiveSync({ changed: vi.fn(), connected: vi.fn() });
    const first = FakeSource.all[0]!;
    first.onopen!();
    first.readyState = FakeSource.CLOSED;
    first.onerror!(); // CLOSED for good: a 502 from the proxy
    await vi.advanceTimersByTimeAsync(1_900);
    expect(FakeSource.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_200); // 2 s + up to 50 % jitter
    expect(FakeSource.all).toHaveLength(2);
    FakeSource.all[1]!.readyState = FakeSource.CLOSED;
    FakeSource.all[1]!.onerror!();
    await vi.advanceTimersByTimeAsync(3_900);
    expect(FakeSource.all).toHaveLength(2); // the second wait is 4 s at least
    await vi.advanceTimersByTimeAsync(2_200);
    expect(FakeSource.all).toHaveLength(3);
    fetchMock.mockResolvedValue({ status: 401 });
    FakeSource.all[2]!.readyState = FakeSource.CLOSED;
    FakeSource.all[2]!.onerror!();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSource.all).toHaveLength(3); // signed out: no loop
    stop();
    vi.useRealTimers();
  });

  it('does not open a stream while hidden at the start, and survives a browser without EventSource', () => {
    setHidden(true);
    const stop = startLiveSync({ changed: vi.fn(), connected: vi.fn() });
    expect(FakeSource.all).toHaveLength(0);
    stop();
    vi.stubGlobal('EventSource', undefined);
    expect(() => startLiveSync({ changed: vi.fn(), connected: vi.fn() })()).not.toThrow();
  });
});

describe('the sync store with a live connection', () => {
  beforeEach(() => { freshPinia(); vi.useFakeTimers(); FakeSource.all = []; vi.stubGlobal('EventSource', FakeSource); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const routes = () => mockFetch({
    'GET /api/config': () => config({ pollIntervalMs: 30_000 }), 'GET /api/changes': () => changesFixture(), 'GET /api/items': () => ({ items: [], from: '2026-10-12', to: '2026-10-19', syncedAt: 'x' }),
    'GET /api/calendars': () => ({ calendars: [] }), 'GET /api/summary': () => ({ days: {} }), 'GET /api/tasklists/open': () => ({ items: [], finishedToday: [] }),
  });

  it('syncs once per nudge and polls only once a minute while connected (a normal 30 s poll), at the configured rate otherwise', async () => {
    const m = routes();
    const changes = () => m.calls.filter((c) => c.path === '/api/changes').length;
    await useClockStore().load();
    const sync = useSyncStore();
    sync.start();
    await vi.advanceTimersByTimeAsync(30_100);
    expect(changes()).toBe(1); // no stream yet: the configured poll
    const s = FakeSource.all[0]!;
    s.onopen!();
    const before = changes();
    s.nudge();
    await vi.advanceTimersByTimeAsync(100);
    expect(changes()).toBe(before + 1);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(changes()).toBe(before + 1); // connected: no 30 s poll
    await vi.advanceTimersByTimeAsync(21_000);
    expect(changes()).toBe(before + 2);
    s.onerror!(); // connection lost: back to the configured rate
    await vi.advanceTimersByTimeAsync(30_100);
    expect(changes()).toBe(before + 3);
    sync.stop();
    expect(s.live).toHaveLength(0);
  });
});
