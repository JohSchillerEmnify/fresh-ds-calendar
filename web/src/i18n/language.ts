/**
 * The language model: which languages exist, how the active one is chosen and which date locale it implies.
 *
 * Kept free of vue-i18n so date helpers and the server-independent parts can import it without pulling in the
 * message runtime (ADR 0021).
 */
import { ref } from 'vue';
import { LANGUAGE_VALUES } from '@calendar/shared/prefs';

/** The languages the app is translated into; `en` is the default and the last fallback. */
export const LANGUAGES = LANGUAGE_VALUES;
export type Language = (typeof LANGUAGES)[number];

/** The per-person `language` preference: `auto` follows the device, anything else is a fixed language. */
const LANGUAGE_PREFS = ['auto', ...LANGUAGES] as const;
export type LanguagePref = (typeof LANGUAGE_PREFS)[number];

/** Each language in its own name, shown in the Settings select (never translated). */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
  'de-x-mainfr': 'Fränggisch',
  'de-x-coldmirror': 'Coldmirror',
};

/** The language currently shown. Reactive: date helpers and `t()` re-render when it changes. */
export const language = ref<Language>('en');

/** Whether `v` is a valid `language` preference value. */
export function isLanguagePref(v: unknown): v is LanguagePref {
  return typeof v === 'string' && (LANGUAGE_PREFS as readonly string[]).includes(v);
}

/**
 * Resolves a preference to a language.
 *
 * @param pref The stored preference.
 * @param deviceLanguages The browser's preferred languages, most preferred first (`navigator.languages`).
 * @returns The preference itself when fixed; for `auto` German (`de`, `de-AT`, ...) when the most preferred device
 *   language is German, otherwise English.
 */
export function resolveLanguage(pref: LanguagePref, deviceLanguages: readonly string[]): Language {
  if (pref !== 'auto') return pref;
  const first = deviceLanguages[0]?.toLowerCase() ?? '';
  return first === 'de' || first.startsWith('de-') ? 'de' : 'en';
}

/** The BCP 47 tag for `<html lang>`; private-use subtags are at most eight characters, so Coldmirror is shortened. */
export function htmlLang(lang: Language): string {
  return lang === 'de-x-coldmirror' ? 'de-x-coldmir' : lang;
}

/** The `Intl` locale for dates and numbers: en-GB for English, de-DE for German and both fun languages. */
export function dateLocale(lang: Language = language.value): 'en-GB' | 'de-DE' {
  return lang === 'en' ? 'en-GB' : 'de-DE';
}
