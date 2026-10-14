import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClockStore } from '@/stores/clock';
import { useSyncStore } from '@/stores/sync';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

const BEACON = 'POST /api/diag/sync-error';

describe('sync error beacon (POST /api/diag/sync-error)', () => {
  let settings: () => unknown;
  let beacon: () => unknown;

  beforeEach(() => {
    freshPinia();
    settings = () => settingsFixture();
    beacon = () => ({ status: 204 });
  });
  afterEach(() => vi.restoreAllMocks());

  function setup() {
    return mockFetch({
      'GET /api/config': () => config(),
      'GET /api/items': () => ({ items: [], from: 'a', to: 'b', syncedAt: 'x' }),
      'GET /api/settings': () => settings(),
      'GET /api/calendars': () => ({ calendars: [] }),
      'GET /api/summary': () => ({ days: {} }),
      [BEACON]: () => beacon(),
    });
  }
  const beacons = (m: ReturnType<typeof setup>) => m.calls.filter((c) => `${c.method} ${c.path}` === BEACON);
  const down = () => ({ status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'x' } } });

  it('sends one beacon when the error state is entered, not again while it lasts', async () => {
    const m = setup();
    await useClockStore().load();
    const sync = useSyncStore();
    settings = down;
    await sync.syncNow();
    await vi.waitFor(() => expect(beacons(m)).toHaveLength(1));
    expect(beacons(m)[0]!.body).toEqual({ kind: 'http', status: 503, task: 'settings', online: true, resumed: false, app: false });
    await sync.syncNow();
    await sync.syncNow();
    expect(beacons(m)).toHaveLength(1);
    expect(sync.state).toBe('error');
  });

  it('reports a network failure, offline state and the Capacitor app', async () => {
    const m = setup();
    await useClockStore().load();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    (window as unknown as Record<string, unknown>).Capacitor = {};
    try {
      settings = () => { throw new TypeError('Failed to fetch'); };
      await useSyncStore().syncNow();
      await vi.waitFor(() => expect(beacons(m)).toHaveLength(1));
      expect(beacons(m)[0]!.body).toEqual({ kind: 'network', task: 'settings', online: false, resumed: false, app: true });
    } finally { delete (window as unknown as Record<string, unknown>).Capacitor; }
  });

  it('marks a failure within 5 s of the page becoming visible as resumed', async () => {
    const m = setup();
    await useClockStore().load();
    const sync = useSyncStore();
    sync.start();
    try {
      settings = down;
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.waitFor(() => expect(beacons(m)).toHaveLength(1));
      expect((beacons(m)[0]!.body as { resumed: boolean }).resumed).toBe(true);
    } finally { sync.stop(); }
  });

  it('keeps a beacon that could not be sent and sends it with its age after the next good sync', async () => {
    const m = setup();
    await useClockStore().load();
    const sync = useSyncStore();
    settings = down;
    beacon = () => { throw new TypeError('Failed to fetch'); };
    await sync.syncNow();
    await vi.waitFor(() => expect(beacons(m)).toHaveLength(1));
    settings = () => settingsFixture();
    beacon = () => ({ status: 204 });
    await vi.waitFor(async () => { await sync.syncNow(); expect(beacons(m)).toHaveLength(2); });
    expect(beacons(m)[1]!.body).toMatchObject({ kind: 'http', status: 503, task: 'settings', ageSec: expect.any(Number) });
    await sync.syncNow();
    expect(beacons(m)).toHaveLength(2);
  });
});
