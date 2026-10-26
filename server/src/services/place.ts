/**
 * An event's picked place (feature event-location) in Google: the place's name and position live in the event's private
 * extended properties (`placeName`, `placeLat`, `placeLon`) next to the readable `location` ("<name>, <address>").
 */
import type { Place } from '../api/types.js';
import type { GoogleEvent } from '../providers/CalendarProvider.js';

/** The private extended property keys of a place. */
const KEYS = { name: 'placeName', lat: 'placeLat', lon: 'placeLon' } as const;

/**
 * Whether a location still belongs to a place: it is the name, or `"<name>, <address>"` (assumption A8). Anything else,
 * e.g. "<name> (Halle 2)" or a longer street name, is text changed elsewhere and must not be cut back to the name.
 *
 * @param location The event's location text.
 * @param name The place's name.
 * @returns True when the place still describes the location.
 */
export function placeLeads(location: string, name: string): boolean {
  return location === name || location.startsWith(`${name}, `);
}

/**
 * Reads the place of a Google event.
 *
 * The place counts only while the location is its name or starts with `"<name>, "` ({@link placeLeads}): a location
 * changed elsewhere (Google Calendar) shows as plain text, so a stale map never sits next to a different location (A8).
 *
 * @param ev The Google event.
 * @returns The place, or undefined when there is none or it is not valid any more.
 */
export function placeOf(ev: GoogleEvent): Place | undefined {
  const p = ev.extendedProperties?.private;
  const name = p?.[KEYS.name];
  if (!name || !placeLeads(ev.location ?? '', name)) return undefined;
  const lat = Number(p[KEYS.lat]), lon = Number(p[KEYS.lon]);
  if (!p[KEYS.lat] || !p[KEYS.lon] || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return undefined;
  return { name, lat, lon };
}

/**
 * The private extended properties that store a place, or remove it.
 *
 * @param place The picked place, or null to remove a stored one.
 * @returns The properties for an insert or a patch (null values delete the keys in a patch).
 */
export function placeProps(place: Place | null): Record<string, string | null> {
  if (!place) return { [KEYS.name]: null, [KEYS.lat]: null, [KEYS.lon]: null };
  return { [KEYS.name]: place.name, [KEYS.lat]: String(place.lat), [KEYS.lon]: String(place.lon) };
}
