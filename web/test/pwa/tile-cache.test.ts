/** The service worker's cache of map pictures that were shown (feature event-location, offline maps). */
import { describe, expect, it, vi } from 'vitest';
import { isTileRequest, MAX_TILES, serveTile, TILE_MAX_AGE_MS } from '@/pwa/tileCache';

/** A Cache API stand-in that keeps insertion order like the real one. */
function fakeCache() {
  const m = new Map<string, Response>();
  return {
    m,
    async match(r: Request) { const hit = m.get(r.url); return hit?.clone(); },
    async put(r: Request, res: Response) { m.delete(r.url); m.set(r.url, res); },
    async keys() { return [...m.keys()].map((u) => new Request(u)); },
    async delete(r: Request) { return m.delete(r.url); },
  };
}
const png = (headers: Record<string, string> = {}) => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png', ...headers } });
const tile = (n = 1) => new Request(`https://tile.openstreetmap.org/16/35198/${21500 + n}.png`);

describe('map picture cache', () => {
  it('knows map pictures by their z/x/y path, also the test stand-in', () => {
    expect(isTileRequest('image', new URL('https://tile.openstreetmap.org/16/35198/21502.png'), 'http://localhost:3000')).toBe(true);
    expect(isTileRequest('image', new URL('http://localhost:3000/api/__test/tiles/16/1/2.png'), 'http://localhost:3000')).toBe(true);
    expect(isTileRequest('image', new URL('http://localhost:3000/icons/icon-192.png'), 'http://localhost:3000')).toBe(false);
    // the app's own /api is never cached, whatever the path looks like
    expect(isTileRequest('image', new URL('http://localhost:3000/api/themes/1/2/3.png'), 'http://localhost:3000')).toBe(false);
    expect(isTileRequest('image', new URL('http://localhost:3000/1/2/3.png'), 'http://localhost:3000')).toBe(false);
    expect(isTileRequest('', new URL('https://tile.openstreetmap.org/16/35198/21502.png'), 'http://localhost:3000')).toBe(false);
  });

  it('asks the network first and keeps what it showed', async () => {
    const cache = fakeCache();
    const net = vi.fn(async () => png());
    const res = await serveTile(tile(), cache as never, net, 1000);
    expect(res.status).toBe(200);
    expect(net).toHaveBeenCalledTimes(1);
    expect(cache.m.size).toBe(1);
  });

  it('offline, answers a picture it showed within the last 7 days', async () => {
    const cache = fakeCache();
    await serveTile(tile(), cache as never, async () => png(), 1000);
    const down = vi.fn(async () => { throw new TypeError('offline'); });
    expect((await serveTile(tile(), cache as never, down, 1000 + TILE_MAX_AGE_MS)).status).toBe(200);
    await expect(serveTile(tile(), cache as never, down, 1001 + TILE_MAX_AGE_MS)).rejects.toThrow('offline');
    await expect(serveTile(tile(2), cache as never, down, 1000)).rejects.toThrow('offline');
  });

  it('keeps nothing the server forbids storing, and no error answers', async () => {
    const cache = fakeCache();
    await serveTile(tile(1), cache as never, async () => png({ 'cache-control': 'no-store' }), 1);
    await serveTile(tile(2), cache as never, async () => new Response('x', { status: 404 }), 1);
    expect(cache.m.size).toBe(0);
  });

  it('storing is best effort: a full or broken cache never costs the picture, and it does not wait for the store', async () => {
    const broken = { ...fakeCache(), put: vi.fn(async () => { throw new DOMException('full', 'QuotaExceededError'); }) };
    const res = await serveTile(tile(), broken as never, async () => png(), 1);
    expect(res.status).toBe(200);
    const later: Promise<unknown>[] = [];
    const ok = await serveTile(tile(), broken as never, async () => png(), 1, (p) => later.push(p));
    expect(ok.status).toBe(200);
    expect(later).toHaveLength(1);
    await expect(later[0]).resolves.toBeUndefined();
  });

  it('keeps at most the newest pictures', async () => {
    const cache = fakeCache();
    for (let i = 0; i <= MAX_TILES; i++) await serveTile(tile(i), cache as never, async () => png(), 1);
    expect(cache.m.size).toBe(MAX_TILES);
    expect(cache.m.has(tile(0).url)).toBe(false);
  });
});
