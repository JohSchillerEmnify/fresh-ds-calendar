/** Place search and map addresses in /api/config, and the TEST_MODE stand-ins for both (feature event-location). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { makeApp, type TestApp } from './helpers.js';

/** `/api/config` of a server that is not in TEST_MODE, with these environment variables. */
async function liveConfig(env: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-places-'));
  const app = buildApp({ ...loadConfig({ DATA_DIR: dir, SEED: 'false', ...env }), webDist: null });
  try {
    return await (await app.request('/api/config')).json();
  } finally {
    app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('place search and map addresses', () => {
  it('defaults to the public Photon and OpenStreetMap tile servers', async () => {
    const c = await liveConfig();
    expect(c.placeSearchUrl).toBe('https://photon.komoot.io/api');
    expect(c.mapTileUrl).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('takes the addresses from the environment', async () => {
    const c = await liveConfig({ PLACE_SEARCH_URL: 'https://photon.example.org/api', MAP_TILE_URL: 'https://tiles.example.org/{z}/{x}/{y}.png' });
    expect(c.placeSearchUrl).toBe('https://photon.example.org/api');
    expect(c.mapTileUrl).toBe('https://tiles.example.org/{z}/{x}/{y}.png');
  });

  it('keeps the defaults for addresses that are not https or lack the tile placeholders', async () => {
    const c = await liveConfig({ PLACE_SEARCH_URL: 'http://photon.example.org/api', MAP_TILE_URL: 'https://tiles.example.org/tile.png' });
    expect(c.placeSearchUrl).toBe('https://photon.komoot.io/api');
    expect(c.mapTileUrl).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });
});

describe('unsafe place addresses', () => {
  // the origins go into the CSP: nothing that could break out of a directive or carry credentials
  it.each([
    ['PLACE_SEARCH_URL', 'https://photon.example.org;script-src *'],
    ['PLACE_SEARCH_URL', 'https://user:secret@photon.example.org/api'],
    ['PLACE_SEARCH_URL', 'https://phot%20on.example.org/api'],
    ['MAP_TILE_URL', 'https://{s}.tiles.example.org/{z}/{x}/{y}.png'],
    ['MAP_TILE_URL', 'https://tiles.example.org;/{z}/{x}/{y}.png'],
    ['MAP_TILE_URL', 'https://tiles_x.example.org/{z}/{x}/{y}.png'],
  ])('falls back to the default for %s=%s', async (name, value) => {
    const c = await liveConfig({ [name]: value });
    expect(name === 'PLACE_SEARCH_URL' ? c.placeSearchUrl : c.mapTileUrl).toBe(name === 'PLACE_SEARCH_URL' ? 'https://photon.komoot.io/api' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });
});

describe('TEST_MODE place search and tiles', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());
  beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

  const places = [
    { name: 'Zahnarztpraxis Dr. Weber', address: 'Hauptstraße 12, 10827 Berlin', lat: 52.4867, lon: 13.3536 },
    { name: 'Zahnklinik Mitte', address: 'Friedrichstraße 90, 10117 Berlin', lat: 52.52, lon: 13.388 },
    { name: 'Stadtbad Neukölln', address: 'Ganghoferstraße 3, 12043 Berlin', lat: 52.4797, lon: 13.4361 },
  ];

  it('points the app at the same-origin stand-ins', async () => {
    const c = await t.json('GET', '/api/config');
    expect(c.body.placeSearchUrl).toBe('/api/__test/photon');
    expect(c.body.mapTileUrl).toBe('/api/__test/tiles/{z}/{x}/{y}.png');
  });

  it('answers the known places whose name or address has every typed word, in Photon\'s shape', async () => {
    expect((await t.json('POST', '/api/__test/places', { places })).status).toBe(200);
    const r = await t.json('GET', '/api/__test/photon?q=zahn%20berlin&lang=en&limit=5');
    expect(r.status).toBe(200);
    expect(r.body.type).toBe('FeatureCollection');
    expect(r.body.features).toHaveLength(2);
    expect(r.body.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [13.3536, 52.4867] },
      properties: { name: 'Zahnarztpraxis Dr. Weber', street: 'Hauptstraße', housenumber: '12', postcode: '10827', city: 'Berlin' },
    });
    expect((await t.json('GET', '/api/__test/photon?q=Ganghofer&limit=5')).body.features.map((f: any) => f.properties.name)).toEqual(['Stadtbad Neukölln']);
    expect((await t.json('GET', '/api/__test/photon?q=Zahn&limit=1')).body.features).toHaveLength(1);
  });

  it('forgets the places on reset', async () => {
    await t.json('POST', '/api/__test/places', { places });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/__test/photon?q=Zahn')).body.features).toEqual([]);
  });

  it('refuses places without a name or a valid position', async () => {
    expect((await t.json('POST', '/api/__test/places', { places: [{ name: '', address: 'x', lat: 1, lon: 1 }] })).status).toBe(400);
    expect((await t.json('POST', '/api/__test/places', { places: [{ name: 'x', address: 'x', lat: 91, lon: 1 }] })).status).toBe(400);
  });

  it('answers a map picture with cache headers', async () => {
    const r = await t.req('GET', '/api/__test/tiles/16/35210/21490.png');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(r.headers.get('cache-control')).toMatch(/max-age=\d+/);
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect((await t.req('GET', '/api/__test/tiles/16/x/1.png')).status).toBe(404);
  });
});
