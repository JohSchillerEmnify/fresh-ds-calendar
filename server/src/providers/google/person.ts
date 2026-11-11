import type { people_v1 } from '@googleapis/people';
import type { ContactDate, GoogleContact } from '../CalendarProvider.js';

const dateOf = (d: people_v1.Schema$Date | undefined): ContactDate | undefined =>
  d && d.month && d.day ? { ...(d.year ? { year: d.year } : {}), month: d.month, day: d.day } : undefined;

/** A People API person reduced to its display name and dated entries (year 0 = no year; the deprecated free-text `text` is ignored). */
export function fromPerson(p: people_v1.Schema$Person): GoogleContact {
  const birthday = dateOf(p.birthdays?.find((b) => dateOf(b.date))?.date);
  const dates = (p.events ?? []).flatMap((e) => { const date = dateOf(e.date); return date ? [{ ...(e.type ? { type: e.type } : {}), date }] : []; });
  const name = (p.names?.find((n) => n.metadata?.primary) ?? p.names?.[0])?.displayName ?? undefined;
  return { resourceName: p.resourceName ?? '', ...(p.metadata?.deleted ? { deleted: true as const } : {}), ...(name ? { name } : {}), ...(birthday ? { birthday } : {}), dates };
}
