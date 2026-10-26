/**
 * Places for an event's location (feature event-location): the place search client (Photon, asked straight from the
 * device), the mapping between a picked place and the event's `location` / `place`, and the tile maths of the small map.
 */
import type { CalendarEvent, Place } from '@/api/types';
import type { Language } from '@/i18n/language';

/** A place as the location field holds it: the stored place plus its readable address. */
export interface PlacePick extends Place {
  address: string;
}

/** At most this many suggestions (owner: a short list under the field). */
export const MAX_SUGGESTIONS = 5;
/** Side of one map picture in px (OpenStreetMap's raster tiles). */
export const TILE = 256;

/**
 * The language the place search answers in: German for every German language of the app, else English.
 *
 * @param lang The app's language.
 * @returns Photon's `lang` value.
 */
export function photonLang(lang: Language): 'de' | 'en' {
  return lang.startsWith('de') ? 'de' : 'en';
}

/**
 * The search request for typed text. Only the text, the app language and the limit are sent (owner, Q4/Q7).
 *
 * @param base The configured search endpoint (`placeSearchUrl`); a relative one resolves against the page.
 * @param q The typed text.
 * @param lang Photon's `lang` value.
 * @returns The request URL.
 */
export function searchUrl(base: string, q: string, lang: string): string {
  const u = new URL(base, location.origin);
  u.search = new URLSearchParams({ q, lang, limit: String(MAX_SUGGESTIONS) }).toString();
  return u.toString();
}

/** Joins the non-empty parts with a separator. */
const join = (sep: string, ...parts: unknown[]) => parts.filter((p) => typeof p === 'string' && p).join(sep);

/**
 * Reads Photon's GeoJSON answer.
 *
 * @param json The parsed answer body.
 * @returns One pick per point feature with a name (or a street address), its readable address and its position.
 */
export function parsePhoton(json: unknown): PlacePick[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: PlacePick[] = [];
  for (const f of features as Array<{ geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }>) {
    const [lon, lat] = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : [];
    const p = f.properties ?? {};
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const street = join(' ', p.street, p.housenumber);
    const name = typeof p.name === 'string' && p.name ? p.name : street;
    if (!name) continue;
    // an address result is named after its street: the address line then starts at the postcode
    const address = join(', ', name === street ? '' : street, join(' ', p.postcode, p.city ?? p.town ?? p.village), p.city || p.postcode ? '' : p.country);
    out.push({ name, address, lat, lon });
  }
  return out;
}

/**
 * Asks the place search for typed text.
 *
 * @param base The configured search endpoint.
 * @param q The typed text.
 * @param lang Photon's `lang` value.
 * @param signal Cancels the request when newer text is typed.
 * @param fetchFn The fetch to use (tests).
 * @returns The suggestions.
 * @throws Error When the search answers with an error status (or the request fails).
 */
export async function searchPlaces(base: string, q: string, lang: string, signal?: AbortSignal, fetchFn: typeof fetch = fetch): Promise<PlacePick[]> {
  // no cookies to the outside service; the page's origin goes as Referer, like any web page
  const res = await fetchFn(searchUrl(base, q, lang), { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`place search answered ${res.status}`);
  return parsePhoton(await res.json());
}

/**
 * The location text Google gets for a picked place (owner, Q5).
 *
 * @param p The picked place.
 * @returns `"<name>, <address>"`, or the name alone when there is no address.
 */
export function placeLocation(p: PlacePick): string {
  return p.address ? `${p.name}, ${p.address}` : p.name;
}

/**
 * The picked place of a saved event, with its address read back from the location.
 *
 * The place belongs to the location only while that is the name or `"<name>, <address>"` (A8, the server's rule too):
 * other text, e.g. "<name> (Halle 2)" changed in Google Calendar, stays plain text and is never cut back to the name.
 *
 * @param ev The event.
 * @returns The place, or null when the event has none or its location was changed elsewhere.
 */
export function placeFromEvent(ev: Pick<CalendarEvent, 'location' | 'place'>): PlacePick | null {
  if (!ev.place) return null;
  const prefix = `${ev.place.name}, `;
  if (ev.location === ev.place.name) return { ...ev.place, address: '' };
  return ev.location.startsWith(prefix) ? { ...ev.place, address: ev.location.slice(prefix.length) } : null;
}

/** One map picture of the small map: its tile numbers and where its top-left corner sits in the box (px). */
export interface TilePos { x: number; y: number; left: number; top: number }

/**
 * The map pictures that cover a box centred on a position (Web Mercator, OpenStreetMap's tile numbering).
 *
 * Only pictures that show inside the box are listed: the tile policy forbids fetching pictures nobody looks at.
 *
 * @param lat Latitude in degrees.
 * @param lon Longitude in degrees.
 * @param zoom The zoom level.
 * @param width Box width in px.
 * @param height Box height in px.
 * @returns The pictures, row by row from the top left.
 */
export function tileLayout(lat: number, lon: number, zoom: number, width: number, height: number): TilePos[] {
  const n = 2 ** zoom;
  const r = (lat * Math.PI) / 180;
  const px = ((lon + 180) / 360) * n * TILE;
  const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE;
  const left = px - width / 2, top = py - height / 2;
  const out: TilePos[] = [];
  for (let y = Math.floor(top / TILE); y * TILE < top + height; y++) {
    if (y < 0 || y >= n) continue;
    for (let x = Math.floor(left / TILE); x * TILE < left + width; x++) out.push({ x: ((x % n) + n) % n, y, left: x * TILE - left, top: y * TILE - top });
  }
  return out;
}

/**
 * The address of one map picture.
 *
 * @param template The configured `mapTileUrl` with `{z}`, `{x}`, `{y}`.
 * @param z The zoom level.
 * @param x The tile column.
 * @param y The tile row.
 * @returns The picture's URL.
 */
export function tileSrc(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
