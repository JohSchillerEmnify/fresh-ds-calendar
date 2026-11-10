/** The map picker (feature event-location, "Pick on map"): reverse lookup, its debounce, the device position and the page's states. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createResolver, formatCoords } from '@/features/calendar/mapPicker';
import { reverseAddress, reverseUrl } from '@/features/calendar/place';
import { currentPosition } from '@/native/location';

const answer = (props: Record<string, string>) => new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [13.4, 52.5] }, properties: props }] }));

describe('reverse lookup', () => {
  it('asks /reverse next to the search endpoint with only the position and the language', () => {
    const u = new URL(reverseUrl('https://photon.komoot.io/api', 52.5208, 13.4094, 'de'));
    expect(u.origin + u.pathname).toBe('https://photon.komoot.io/reverse');
    expect([...u.searchParams.keys()].sort()).toEqual(['lang', 'lat', 'limit', 'lon']);
    expect(reverseUrl('/api/__test/photon', 1, 2, 'en')).toBe(`${location.origin}/api/__test/reverse?lat=1&lon=2&lang=en&limit=1`);
  });

  it('reads the readable address of the nearest place', async () => {
    const fetchFn = vi.fn(async () => answer({ street: 'Karl-Liebknecht-Straße', housenumber: '13', postcode: '10178', city: 'Berlin' }));
    expect(await reverseAddress('/api/x', 52.5, 13.4, 'de', undefined, fetchFn as never)).toBe('Karl-Liebknecht-Straße 13, 10178 Berlin');
  });

  it('gives null when nothing is known there and throws when the service fails', async () => {
    expect(await reverseAddress('/api/x', 0, 0, 'en', undefined, (async () => new Response('{"features":[]}')) as never)).toBeNull();
    await expect(reverseAddress('/api/x', 0, 0, 'en', undefined, (async () => new Response('', { status: 500 })) as never)).rejects.toThrow();
  });

  it('formats the position with 4 decimals', () => { expect(formatCoords(52.52084, 13.40941)).toBe('52.5208, 13.4094'); });
});

describe('reverse resolver debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('asks once for a burst of moves, with the last position', async () => {
    const fetchFn = vi.fn(async () => answer({ name: 'Park' }));
    const ev = { onPending: vi.fn(), onAddress: vi.fn(), onFail: vi.fn() };
    const r = createResolver('/api/x', 'en', ev, 500, fetchFn as never);
    r.request(1, 1); r.request(2, 2); r.request(3, 3);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String((fetchFn.mock.calls[0] as unknown[])[0])).toContain('lat=3&lon=3');
    expect(ev.onAddress).toHaveBeenCalledWith('Park');
  });

  it('reports a failed lookup and never an answer that was replaced', async () => {
    const ev = { onPending: vi.fn(), onAddress: vi.fn(), onFail: vi.fn() };
    const r = createResolver('/api/x', 'en', ev, 10, (async () => { throw new Error('offline'); }) as never);
    r.request(1, 1);
    await vi.advanceTimersByTimeAsync(20);
    expect(ev.onFail).toHaveBeenCalledTimes(1);
    r.request(2, 2); r.cancel();
    await vi.advanceTimersByTimeAsync(20);
    expect(ev.onFail).toHaveBeenCalledTimes(1);
  });
});

describe('device position', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete (window as unknown as { Capacitor?: unknown }).Capacitor; });

  it('is a position when the browser answers', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition) } });
    expect(await currentPosition()).toEqual({ ok: true, lat: 1, lon: 2 });
  });

  it('is "denied" when the person refuses and "unavailable" when the device cannot tell', async () => {
    const fail = (code: number) => vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (_: unknown, bad: PositionErrorCallback) => bad({ code } as GeolocationPositionError) } });
    fail(1);
    expect(await currentPosition()).toEqual({ ok: false, reason: 'denied' });
    fail(2);
    expect(await currentPosition()).toEqual({ ok: false, reason: 'unavailable' });
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    expect(await currentPosition()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('asks the Android plugin for the permission first and stops at a refusal', async () => {
    const getCurrentPosition = vi.fn(async () => ({ coords: { latitude: 3, longitude: 4 } }));
    let location = 'denied';
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, Plugins: { Geolocation: { requestPermissions: async () => ({ location }), getCurrentPosition } } };
    expect(await currentPosition()).toEqual({ ok: false, reason: 'denied' });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    location = 'granted';
    expect(await currentPosition()).toEqual({ ok: true, lat: 3, lon: 4 });
  });
});

describe('the picker page', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  async function open(online: boolean) {
    vi.stubGlobal('navigator', { ...navigator, onLine: online, geolocation: { getCurrentPosition: vi.fn() } });
    vi.doMock('leaflet', () => ({ default: { map: () => ({ on: vi.fn(), remove: vi.fn(), getCenter: () => ({ lat: 1, lng: 2 }), setView: vi.fn() }), tileLayer: () => ({ addTo: vi.fn() }) } }));
    vi.doMock('leaflet/dist/leaflet.css', () => ({}));
    const { default: MapPicker } = await import('@/features/calendar/MapPicker.vue');
    const w = mount(MapPicker, { props: { start: null, tileUrl: '/t/{z}/{x}/{y}.png', searchUrl: '/api/x' }, attachTo: document.body });
    await flushPromises();
    return w;
  }

  it('asks for the device position only on the first tap of "Use my location"', async () => {
    const w = await open(true);
    const geo = navigator.geolocation.getCurrentPosition as ReturnType<typeof vi.fn>;
    expect(geo).not.toHaveBeenCalled();
    (document.querySelector('[data-testid="map-picker-locate"]') as HTMLElement).click();
    expect(geo).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('says it needs a connection when offline and offers to type an address', async () => {
    const w = await open(false);
    expect(document.querySelector('[data-testid="map-picker-offline"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="map-picker-map"]')).toBeNull();
    (document.querySelector('[data-testid="map-picker-type"]') as HTMLElement).click();
    expect(w.emitted('type')).toHaveLength(1);
    w.unmount();
  });
});
