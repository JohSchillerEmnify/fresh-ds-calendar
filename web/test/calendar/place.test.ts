/** Place search client, place ↔ event mapping and the map's tile maths (feature event-location). */
import { describe, expect, it, vi } from 'vitest';
import { parsePhoton, photonLang, placeFromEvent, placeLocation, searchPlaces, searchUrl, tileLayout, tileSrc } from '@/features/calendar/place';
import { ev, t } from './helpers';

const feature = (properties: Record<string, unknown>, coordinates: [number, number] = [13.3536, 52.4867]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties });

describe('place search', () => {
  it('asks only for the typed text, the app language and five results', () => {
    const u = new URL(searchUrl('https://photon.komoot.io/api', 'Zahn arzt', 'de'));
    expect(u.origin + u.pathname).toBe('https://photon.komoot.io/api');
    expect([...u.searchParams.entries()]).toEqual([['q', 'Zahn arzt'], ['lang', 'de'], ['limit', '5']]);
  });

  it('resolves a same-origin address against the page', () => {
    expect(searchUrl('/api/__test/photon', 'Zahn', 'en')).toBe(`${location.origin}/api/__test/photon?q=Zahn&lang=en&limit=5`);
  });

  it('uses German for every German language and English otherwise', () => {
    expect(['en', 'de', 'de-x-mainfr', 'de-x-coldmirror'].map((l) => photonLang(l as never))).toEqual(['en', 'de', 'de', 'de']);
  });

  it('reads Photon features as name, address and position', () => {
    const json = {
      type: 'FeatureCollection', features: [
        feature({ name: 'Zahnarztpraxis Dr. Weber', street: 'Hauptstraße', housenumber: '12', postcode: '10827', city: 'Berlin' }),
        feature({ street: 'Hauptstraße', housenumber: '3', postcode: '10827', city: 'Berlin' }, [13.35, 52.48]),
        feature({ name: 'Berlin', country: 'Deutschland' }, [13.4, 52.52]),
        { type: 'Feature', geometry: { type: 'Point', coordinates: ['x', 1] }, properties: { name: 'broken' } },
      ],
    };
    expect(parsePhoton(json)).toEqual([
      { name: 'Zahnarztpraxis Dr. Weber', address: 'Hauptstraße 12, 10827 Berlin', lat: 52.4867, lon: 13.3536 },
      { name: 'Hauptstraße 3', address: '10827 Berlin', lat: 52.48, lon: 13.35 },
      { name: 'Berlin', address: 'Deutschland', lat: 52.52, lon: 13.4 },
    ]);
    expect(parsePhoton(null)).toEqual([]);
  });

  it('fetches without credentials and fails on an error answer', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ features: [feature({ name: 'A' })] })));
    expect(await searchPlaces('https://p.example/api', 'Zahn', 'en', undefined, ok as never)).toHaveLength(1);
    expect(ok).toHaveBeenCalledWith('https://p.example/api?q=Zahn&lang=en&limit=5', { signal: undefined, credentials: 'omit' });
    const bad = vi.fn(async () => new Response('x', { status: 500 }));
    await expect(searchPlaces('https://p.example/api', 'Zahn', 'en', undefined, bad as never)).rejects.toThrow();
  });
});

describe('place and event', () => {
  const weber = { name: 'Zahnarztpraxis Dr. Weber', lat: 52.4867, lon: 13.3536 };
  it('writes the location as name and address', () => {
    expect(placeLocation({ ...weber, address: 'Hauptstraße 12, 10827 Berlin' })).toBe('Zahnarztpraxis Dr. Weber, Hauptstraße 12, 10827 Berlin');
    expect(placeLocation({ ...weber, address: '' })).toBe('Zahnarztpraxis Dr. Weber');
  });

  it('reads the address back from the location', () => {
    const e = ev('d', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { location: 'Zahnarztpraxis Dr. Weber, Hauptstraße 12, 10827 Berlin', place: weber });
    expect(placeFromEvent(e)).toEqual({ ...weber, address: 'Hauptstraße 12, 10827 Berlin' });
    expect(placeFromEvent({ ...e, location: 'Zahnarztpraxis Dr. Weber' })).toEqual({ ...weber, address: '' });
    expect(placeFromEvent({ ...e, place: undefined })).toBeNull();
  });
});

describe('map tiles', () => {
  it('centres the position in the box at zoom 16', () => {
    const tiles = tileLayout(52.4867, 13.3536, 16, 358, 140);
    // world pixel of the position at zoom 16: x 9,010,930.87, y 5,504,724.03 (tile 35198.95 / 21502.83)
    expect(tiles.map((p) => [p.x, p.y])).toEqual([[35198, 21502], [35199, 21502], [35198, 21503], [35199, 21503]]);
    // the box's left edge lies 179 px left of the position, its top 70 px above it
    expect(tiles[0]!.left).toBeCloseTo(35198 * 256 - (9010930.865 - 179), 1);
    expect(tiles[0]!.top).toBeCloseTo(21502 * 256 - (5504724.028 - 70), 1);
    expect(tiles.every((p) => p.left < 358 && p.left + 256 > 0 && p.top < 140 && p.top + 256 > 0)).toBe(true);
  });

  it('fills the template', () => {
    expect(tileSrc('https://tile.openstreetmap.org/{z}/{x}/{y}.png', 16, 35580, 21496)).toBe('https://tile.openstreetmap.org/16/35580/21496.png');
  });
});
