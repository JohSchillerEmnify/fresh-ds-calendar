/** The curated holiday regions (ADR 0039): ISO country code to Google's slug, and the id of a holiday calendar in each language and variant. */

import type { HolidayVariant } from '@calendar/shared/api';

export const HOLIDAY_VARIANTS: readonly HolidayVariant[] = ['official', 'all'];
export type HolidayLang = 'de' | 'en';

/** Every id of a Google holiday calendar ends like this (also the ones the person added in Google itself). */
const HOLIDAY_SUFFIX = '#holiday@group.v.calendar.google.com';

/** Countries whose calendars were each found in Google in both variants and both languages (a probe of the public iCal feeds). */
export const HOLIDAY_REGIONS: Readonly<Record<string, string>> = {
  AT: 'austrian',
  BE: 'be',
  BG: 'bulgarian',
  HR: 'croatian',
  CY: 'cy',
  CZ: 'czech',
  DK: 'danish',
  EE: 'ee',
  FI: 'finnish',
  FR: 'french',
  DE: 'german',
  GR: 'greek',
  HU: 'hungarian',
  IE: 'irish',
  IT: 'italian',
  LV: 'latvian',
  LT: 'lithuanian',
  LU: 'lu',
  MT: 'mt',
  NL: 'dutch',
  PL: 'polish',
  PT: 'portuguese',
  RO: 'romanian',
  SK: 'slovak',
  SI: 'slovenian',
  ES: 'spain',
  SE: 'swedish',
  CH: 'ch',
  GB: 'uk',
  NO: 'norwegian',
  IS: 'is',
  LI: 'li',
  AL: 'al',
  BA: 'ba',
  RS: 'rs',
  ME: 'me',
  MK: 'mk',
  UA: 'ukrainian',
  TR: 'turkish',
  US: 'usa',
  CA: 'canadian',
  AU: 'australian',
  NZ: 'new_zealand',
  JP: 'japanese',
  IN: 'indian',
  BR: 'brazilian',
  MX: 'mexican',
  AR: 'ar',
  CN: 'china',
  KR: 'south_korea',
  IL: 'jewish',
  ZA: 'sa',
  AE: 'ae',
  SG: 'singapore',
  TH: 'th',
  VN: 'vietnamese',
  ID: 'indonesian',
  PH: 'philippines',
  MY: 'malaysia',
  RU: 'russian',
  BY: 'by',
  MD: 'md',
  GE: 'ge',
  AM: 'am',
  AZ: 'az',
};

const CODE_OF_SLUG = new Map(Object.entries(HOLIDAY_REGIONS).map(([code, slug]) => [slug, code]));

/** The language of the ids: the app language when Google has it, else English. */
export const holidayLang = (lang: unknown): HolidayLang => (lang === 'de' ? 'de' : 'en');

/** The Google calendar id of a region in a language and variant. */
export function holidayCalendarId(code: string, lang: HolidayLang, variant: HolidayVariant): string {
  return `${lang}.${HOLIDAY_REGIONS[code]}${variant === 'official' ? '.official' : ''}${HOLIDAY_SUFFIX}`;
}

/** True for any Google holiday calendar id. */
export const isHolidayCalendarId = (id: string): boolean => id.endsWith(HOLIDAY_SUFFIX);

/** The region and variant of a holiday calendar id in any language; null for an id outside the curated list. */
export function parseHolidayCalendarId(id: string): { code: string; variant: HolidayVariant } | null {
  const m = /^[a-z]{2}\.([a-z_]+?)(\.official)?#holiday@group\.v\.calendar\.google\.com$/.exec(id);
  const code = m && CODE_OF_SLUG.get(m[1]!);
  return code ? { code, variant: m[2] ? 'official' : 'all' } : null;
}
