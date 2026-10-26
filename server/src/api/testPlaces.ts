/**
 * TEST_MODE stand-ins for the place search (Photon) and the OpenStreetMap map pictures (feature event-location).
 *
 * In TEST_MODE `/api/config` points the device here instead of the real hosts, so a scenario never reaches them:
 * `POST /api/__test/places` sets the places the fake search knows, `GET /api/__test/photon` answers them in Photon's
 * GeoJSON shape and `GET /api/__test/tiles/:z/:x/:y.png` answers a generated plain map picture.
 */
import zlib from 'node:zlib';
import type { Hono } from 'hono';
import * as v from 'valibot';
import type { Ctx } from '../context.js';
import { notFound } from '../lib/errors.js';
import { parse } from '../lib/validation.js';

/** A place the fake search knows: its name, readable address ("<street> <no>, <postcode> <city>") and position. */
export interface TestPlace { name: string; address: string; lat: number; lon: number }

const placesSchema = v.strictObject({
  places: v.array(v.strictObject({
    name: v.pipe(v.string(), v.minLength(1, 'name is required')),
    address: v.string(),
    lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    lon: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  })),
});

/** Photon's answer limit is never above 5 here (the app asks for 5). */
const MAX_RESULTS = 5;

/**
 * Splits a readable address into Photon's address properties.
 *
 * @param address "Hauptstraße 12, 10827 Berlin"-like text.
 * @returns `street`, `housenumber`, `postcode` and `city`, each only when found.
 */
function addressProps(address: string): Record<string, string> {
  const [streetPart = '', cityPart = ''] = address.split(',').map((s) => s.trim());
  const street = /^(.*\S)\s+(\d+\w*)$/.exec(streetPart);
  const city = /^(\d{4,5})\s+(.+)$/.exec(cityPart);
  return {
    ...(street ? { street: street[1]!, housenumber: street[2]! } : streetPart ? { street: streetPart } : {}),
    ...(city ? { postcode: city[1]!, city: city[2]! } : cityPart ? { city: cityPart } : {}),
  };
}

/**
 * The known places matching a query the way the scenarios describe it (STEPS.md "the place search knows:").
 *
 * @param places The known places, in table order.
 * @param q The typed text; every word must occur in the name or the address (case-insensitive).
 * @param limit The requested number of results.
 * @returns Photon's GeoJSON FeatureCollection.
 */
export function photonAnswer(places: TestPlace[], q: string, limit: number) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length ? places.filter((p) => words.every((w) => `${p.name} ${p.address}`.toLowerCase().includes(w))) : [];
  return {
    type: 'FeatureCollection',
    features: hits.slice(0, Math.max(0, Math.min(limit, MAX_RESULTS))).map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { name: p.name, ...addressProps(p.address) },
    })),
  };
}

/** One PNG chunk: length, type, data and CRC. */
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/**
 * A 256×256 map picture in OpenStreetMap's land colour with a faint street grid, as a PNG.
 *
 * @returns The PNG bytes.
 */
function tilePng(): Buffer {
  const size = 256;
  const land = [0xf2, 0xef, 0xe9], road = [0xff, 0xff, 0xff];
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte 0 (none), then RGB
    for (let x = 0; x < size; x++) row.set(x % 64 < 4 || y % 64 < 4 ? road : land, 1 + x * 3);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

let tile: Buffer | null = null;

/**
 * Registers the stand-in routes on the TEST_MODE router.
 *
 * @param t The `/api/__test` router.
 * @param ctx The app context (its `overrides.places` holds the known places until the next reset).
 */
export function placeTestRoutes(t: Hono, ctx: Ctx): void {
  t.post('/places', async (c) => {
    const { places } = parse(placesSchema, await c.req.json().catch(() => undefined));
    ctx.overrides.places = places;
    return c.json({ places });
  });

  t.get('/photon', (c) => {
    const limit = Number(c.req.query('limit') ?? MAX_RESULTS);
    return c.json(photonAnswer(ctx.overrides.places ?? [], c.req.query('q') ?? '', Number.isFinite(limit) ? limit : MAX_RESULTS));
  });

  t.get('/tiles/:z/:x/:file', (c) => {
    const [z, x, y] = [c.req.param('z'), c.req.param('x'), c.req.param('file').replace(/\.png$/, '')];
    if (![z, x, y].every((n) => /^\d+$/.test(n))) throw notFound('Not found');
    tile ??= tilePng();
    // like the OSM tile server: cacheable for hours, usable stale for a week (feature event-location, offline maps)
    return c.body(new Uint8Array(tile), 200, { 'content-type': 'image/png', 'cache-control': 'max-age=10800, stale-while-revalidate=604800, stale-if-error=604800' });
  });
}
