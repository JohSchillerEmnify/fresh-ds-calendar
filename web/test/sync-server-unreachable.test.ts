import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/apiError';
import { useClockStore } from '@/stores/clock';
import { useSyncStore } from '@/stores/sync';
import { t } from '@/i18n';
import { changesFixture, config, freshPinia, mockFetch } from './helpers';

describe('our own server cannot be reached (a restart) versus Google cannot be reached', () => {
  let settings: () => unknown;
  let now = 1_000_000;

  beforeEach(() => {
    freshPinia();
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    settings = () => changesFixture({ full: false });
    mockFetch({
      'GET /api/config': () => config(),
      'GET /api/items': () => ({ items: [], from: 'a', to: 'b', syncedAt: 'x' }),
      'GET /api/changes': () => settings(),
      'GET /api/calendars': () => ({ calendars: [] }),
      'GET /api/summary': () => ({ days: {} }),
      'POST /api/diag/sync-error': () => ({ status: 204 }),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const refused = () => { throw new TypeError('Failed to fetch'); };

  it('classifies a failed request, and a proxy 502/503 without our error body, as the server being unreachable', () => {
    expect(new ApiError(0, 'NETWORK', 'x').isServerUnreachable).toBe(true);
    expect(new ApiError(502, 'HTTP', 'x').isServerUnreachable).toBe(true);
    expect(new ApiError(503, 'HTTP', 'x').isServerUnreachable).toBe(true);
    expect(new ApiError(503, 'PROVIDER_UNAVAILABLE', 'x').isServerUnreachable).toBe(false);
    expect(new ApiError(502, 'PROVIDER_ERROR', 'x').isServerUnreachable).toBe(false);
    expect(new ApiError(503, 'RATE_LIMITED', 'x').isServerUnreachable).toBe(false);
  });

  it('shows no banner for a short outage of our server, and the server wording once it has lasted a minute', async () => {
    await useClockStore().load();
    const sync = useSyncStore();
    await sync.syncNow();
    settings = refused;
    await sync.syncNow();
    now += 30_000;
    await sync.syncNow();
    expect(sync.error).toBeNull();
    expect(sync.state).toBe('idle');
    now += 31_000;
    await sync.syncNow();
    expect(sync.state).toBe('error');
    expect(sync.errorMessage).toBe(t('calendar.sync.serverUnreachable'));
    expect(sync.errorMessage).not.toContain('Google');
  });

  it('starts counting again after a good sync', async () => {
    await useClockStore().load();
    const sync = useSyncStore();
    await sync.syncNow();
    settings = refused;
    await sync.syncNow();
    settings = () => changesFixture({ full: false });
    await sync.syncNow();
    settings = refused;
    now += 120_000;
    await sync.syncNow();
    expect(sync.error).toBeNull();
  });

  it('still says Google for an outage the server reports, at once', async () => {
    await useClockStore().load();
    const sync = useSyncStore();
    settings = () => ({ status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'x' } } });
    await sync.syncNow();
    expect(sync.state).toBe('error');
    expect(sync.errorMessage).toBe(t('calendar.sync.unreachable'));
  });

  it('says so at once when the app was opened without the server answering', async () => {
    await useClockStore().load();
    const sync = useSyncStore();
    settings = refused;
    await sync.syncNow();
    expect(sync.state).toBe('error');
    expect(sync.errorMessage).toBe(t('calendar.sync.serverUnreachable'));
  });
});
