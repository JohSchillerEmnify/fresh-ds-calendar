/**
 * An event's picked place (feature event-location) in Google: the place's name and position live in the event's private
 * extended properties (`placeName`, `placeLat`, `placeLon`) next to the readable `location` ("<name>, <address>").
 */
import type { Place } from '../api/types.js';
import type { GoogleEvent } from '../providers/CalendarProvider.js';

/** The private extended property keys of a place. */
const KEYS = { name: 'placeName', lat: 'placeLat', lon: 'placeLon' } as const;

/**
 * Reads the place of a Google event.
 *
 * The place counts only while `location` still starts with its name: a location changed elsewhere (Google Calendar)
 * shows as plain text, so a stale map never sits next to a different location (assumption A8).
 *
 * @param ev The Google event.
 * @returns The place, or undefined when there is none or it is not valid any more.
 */
export function placeOf(ev: GoogleEvent): Place | undefined {
  const p = ev.extendedProperties?.private;
  const name = p?.[KEYS.name];
  if (!name || !(ev.location ?? '').startsWith(name)) return undefined;
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
