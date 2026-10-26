/**
 * The service worker's cache of map pictures (feature event-location, R7): the pictures a map has shown are kept, so the
 * map of a place seen before still shows without a connection.
 *
 * Network first: online, every picture comes from the tile server (the browser's HTTP cache applies its cache headers),
 * and only what was shown is stored, never anything ahead (the OSM tile policy forbids prefetching). Offline, a stored
 * picture is answered for up to 7 days after it was shown (the tile server allows stale use for a week,
 * `stale-if-error=604800`); older ones and pictures never seen are not, and the map shows its placeholder.
 */

/** Cache name of the stored map pictures. */
export const TILE_CACHE = 'map-tiles-v1';
/** At most this many pictures are kept (~20 kB each); the oldest go first. */
export const MAX_TILES = 200;
/** How long after it was shown a stored picture may stand in offline. */
export const TILE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
/** Header that carries when a stored picture was fetched. */
const STORED_AT = 'x-stored-at';
/** A map picture's path: `/<z>/<x>/<y>.png`. */
const TILE_PATH = /\/\d+\/\d+\/\d+\.png$/;

/** The parts of the Cache API used here. */
export interface TileStore {
  match(r: Request): Promise<Response | undefined>;
  put(r: Request, res: Response): Promise<void>;
  keys(): Promise<readonly Request[]>;
  delete(r: Request): Promise<boolean>;
}

/**
 * Whether a request is for a map picture: the TEST_MODE stand-in under `/api/__test/tiles/` on the app's own origin, or
 * a `<z>/<x>/<y>.png` image from another origin. The CSP's `img-src` allows no other origin than the configured tile
 * server, so a cross-origin image is always one of its pictures; no other path of the app (and nothing else under
 * `/api`) is ever cached here.
 *
 * @param destination The request's destination (`image` for an `<img>`).
 * @param url The request URL.
 * @param origin The app's own origin (the worker's).
 * @returns True for a map picture.
 */
export function isTileRequest(destination: string, url: URL, origin: string): boolean {
  if (destination !== 'image' || !TILE_PATH.test(url.pathname)) return false;
  return url.origin === origin ? url.pathname.startsWith('/api/__test/tiles/') : true;
}

/**
 * Stores a shown picture and trims the cache to the newest {@link MAX_TILES}.
 *
 * Best effort: a full or broken cache only means the picture is not there offline.
 *
 * @param request The picture request (the cache key).
 * @param res A copy of the network answer.
 * @param cache The picture cache.
 * @param now The current time in ms (kept with the picture).
 * @returns Resolves when done; never rejects.
 */
async function keep(request: Request, res: Response, cache: TileStore, now: number): Promise<void> {
  try {
    const headers = new Headers(res.headers);
    headers.set(STORED_AT, String(now));
    await cache.put(request, new Response(await res.arrayBuffer(), { status: res.status, headers }));
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await cache.delete(old);
  } catch {
    // quota exceeded or storage unavailable: the shown picture is unaffected
  }
}

/**
 * Answers a map picture: from the network when possible (and stores it), else a stored one that is young enough.
 *
 * @param request The picture request.
 * @param cache The picture cache.
 * @param net The network fetch.
 * @param now The current time in ms.
 * @param waitUntil Keeps the worker alive for the store without holding up the answer (the fetch event's); without it
 *   the store is awaited.
 * @returns The picture.
 * @throws The network error when there is no usable stored picture (the image then fails and the placeholder shows).
 */
export async function serveTile(request: Request, cache: TileStore, net: (r: Request) => Promise<Response>, now: number, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> {
  let res: Response;
  try {
    res = await net(request);
  } catch (e) {
    const hit = await cache.match(request).catch(() => undefined);
    if (hit && now - Number(hit.headers.get(STORED_AT) ?? 0) <= TILE_MAX_AGE_MS) return hit;
    throw e;
  }
  // honour the server: an error or "do not store" is never kept
  if (res.ok && !/no-store/i.test(res.headers.get('cache-control') ?? '')) {
    const stored = keep(request, res.clone(), cache, now);
    if (waitUntil) waitUntil(stored);
    else await stored;
  }
  return res;
}
