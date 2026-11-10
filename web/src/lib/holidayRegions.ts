/** Holiday regions in the picker: the language of Google's calendar ids, a country's name in the app language, and the search over those names. */
import type { HolidayRegion } from '@calendar/shared/api';
import type { Language } from '@/i18n/language';

/** The language Google's holiday calendars are asked for: German for every German variant, else English. */
export const googleLang = (l: Language): 'de' | 'en' => (l.startsWith('de') ? 'de' : 'en');

/** A country's name in the app language. */
export function regionName(code: string, l: Language): string {
  return new Intl.DisplayNames([googleLang(l)], { type: 'region' }).of(code) ?? code;
}

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The regions with something left to add whose name contains the query (case and accents ignored), sorted by name. */
export function matchRegions(regions: HolidayRegion[], query: string, l: Language): Array<HolidayRegion & { name: string }> {
  const q = fold(query.trim());
  const names = new Intl.DisplayNames([googleLang(l)], { type: 'region' });
  return regions
    .filter((r) => r.variants.some((v) => !r.added.includes(v)))
    .map((r) => ({ ...r, name: names.of(r.code) ?? r.code }))
    .filter((r) => fold(r.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, googleLang(l)));
}
