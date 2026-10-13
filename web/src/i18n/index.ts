/**
 * Translation entry point (ARCHITECTURE "i18n"): vue-i18n in Composition API mode behind a typed `t()`.
 *
 * `en` is bundled (source of the schema and the last fallback); every other catalogue is a lazy chunk loaded by
 * {@link applyLanguage}. UI code imports `t` from here, never from vue-i18n, so key names are type-checked.
 */
import { createI18n } from 'vue-i18n';
import { en, type Messages, type PartialMessages } from './locales/en';
import { htmlLang, isLanguagePref, language, resolveLanguage, type Language, type LanguagePref } from './language';

export type { Messages };
export * from './language';

/** Dotted paths of all leaves of `T` (`settings.language.label`). */
type Paths<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`> }[keyof T & string];
/** A key of the English catalogue: a missing or misspelt key is a type error. */
export type MessageKey = Paths<Messages>;

/** The lazy catalogues; the fun languages fall back to `de`, so applying them loads `de` too. */
const loaders: Record<Exclude<Language, 'en'>, () => Promise<PartialMessages>> = {
  de: () => import('./locales/de').then((m) => m.de),
  'de-x-mainfr': () => import('./locales/de-x-mainfr').then((m) => m.deXMainfr),
  'de-x-coldmirror': () => import('./locales/de-x-coldmirror').then((m) => m.deXColdmirror),
};

/** The vue-i18n instance (`legacy: false`); install it with `app.use(i18n)` only if components need `useI18n`. */
export const i18n = createI18n<[PartialMessages], Language, false>({
  legacy: false,
  locale: 'en',
  fallbackLocale: { 'de-x-mainfr': ['de', 'en'], 'de-x-coldmirror': ['de', 'en'], de: ['en'], default: ['en'] },
  // the other catalogues are added by applyLanguage when first needed
  messages: { en } as Record<Language, PartialMessages>,
  // untranslated keys are expected in the fun languages
  missingWarn: false,
  fallbackWarn: false,
});
const composer = i18n.global;

/**
 * Translates `key` in the active language, falling back along `de` and `en`.
 *
 * @param key A catalogue key.
 * @param named Values for `{name}` placeholders.
 * @param plural A count selecting among `a | b` alternatives (also available as `{count}` and `{n}`).
 */
export function t(key: MessageKey, named?: Record<string, string | number>, plural?: number): string {
  if (plural !== undefined) return composer.t(key, named ?? {}, plural);
  return named ? composer.t(key, named) : composer.t(key);
}

/** Whether `key` exists in the English catalogue (server message keys are checked with this before translating). */
export function hasKey(key: string): key is MessageKey {
  return composer.te(key, 'en');
}

/** The language preference remembered on this device so the first paint already uses it (a convenience only). */
const PREF_CACHE = 'language';
export function cachedLanguagePref(): LanguagePref {
  try {
    const v = localStorage.getItem(PREF_CACHE);
    return isLanguagePref(v) ? v : 'auto';
  } catch { return 'auto'; }
}

/** Guards against an older, slower switch overwriting a newer one. */
let latest = 0;

/**
 * Switches the app to the language `pref` resolves to, without a reload.
 *
 * Loads the needed catalogues first, so the screen never shows keys; then flips the reactive locale and `<html lang>`.
 *
 * @param pref The person's language preference.
 * @param deviceLanguages The browser's languages (defaults to `navigator.languages`).
 */
export async function applyLanguage(pref: LanguagePref, deviceLanguages: readonly string[] = navigator.languages ?? [navigator.language]): Promise<void> {
  try { localStorage.setItem(PREF_CACHE, pref); } catch { /* storage may be blocked */ }
  const mine = ++latest;
  const lang = resolveLanguage(pref, deviceLanguages);
  if (lang !== 'en') {
    // German is the fallback of both fun languages
    const needed = lang === 'de' ? (['de'] as const) : (['de', lang] as const);
    for (const l of needed) {
      if (!composer.availableLocales.includes(l)) composer.setLocaleMessage(l, await loaders[l]());
    }
  }
  if (mine !== latest) return;
  composer.locale.value = lang;
  language.value = lang;
  document.documentElement.lang = htmlLang(lang);
}
