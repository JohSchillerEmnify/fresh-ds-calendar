import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { applyLanguage, hasKey, htmlLang, resolveLanguage, t, language, LANGUAGES } from '@/i18n';
import { flattenKeys, missingKeys } from '@/i18n/keys';
import de from '@/i18n/locales/de';
import deXColdmirror from '@/i18n/locales/de-x-coldmirror';
import deXMainfr from '@/i18n/locales/de-x-mainfr';
import en from '@/i18n/locales/en';
import { monthNames, parseParam, periodTitle, weekdayLabels } from '@/lib/dates';

afterEach(async () => { await applyLanguage('en'); });

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
/** The message at a dotted key of a nested catalogue. */
const at = (o: object, key: string) => key.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)[k], o) as string;

describe('catalogues', () => {
  it('de has every en key', () => {
    expect(missingKeys(en, de)).toEqual([]);
  });
  it('no catalogue has a key en does not know (typo guard)', () => {
    for (const c of [de, deXMainfr, deXColdmirror]) expect(missingKeys(c, en)).toEqual([]);
  });
  it('translations keep the placeholders of the English message', () => {
    for (const c of [de, deXMainfr, deXColdmirror]) {
      for (const k of flattenKeys(c)) expect(placeholders(at(c, k)), k).toEqual(placeholders(at(en, k)));
    }
  });
  it('the Fränggisch dialect is allowed to be partial', () => {
    expect(missingKeys(en, deXMainfr).length).toBeGreaterThan(0);
  });
});

describe('language choice', () => {
  it.each([
    ['auto', ['de-DE', 'en'], 'de'], ['auto', ['de'], 'de'], ['auto', ['de-AT'], 'de'], ['auto', ['en-GB', 'de'], 'en'],
    ['auto', ['fr-FR'], 'en'], ['auto', [], 'en'], ['en', ['de-DE'], 'en'], ['de-x-mainfr', ['en-GB'], 'de-x-mainfr'],
  ] as const)('%s on a device with %j is %s', (pref, device, want) => {
    expect(resolveLanguage(pref, device)).toBe(want);
  });
  it('html lang is a valid BCP 47 tag for every language', () => {
    for (const l of LANGUAGES) expect(() => Intl.getCanonicalLocales(htmlLang(l))).not.toThrow();
  });
});

describe('t()', () => {
  it('speaks English by default and interpolates', () => {
    expect(t('views.year')).toBe('Year');
    expect(t('settings.tasklists.moveUp', { name: 'Work' })).toBe('Move Work up');
  });
  it('switches without a reload and sets <html lang>', async () => {
    await applyLanguage('de');
    expect(t('views.year')).toBe('Jahr');
    expect(language.value).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    await applyLanguage('en');
    expect(t('views.year')).toBe('Year');
    expect(document.documentElement.lang).toBe('en');
  });
  it('follows the device language for auto', async () => {
    await applyLanguage('auto', ['de-DE']);
    expect(t('views.week')).toBe('Woche');
  });
  it('pluralises', async () => {
    expect(t('settings.calendar.approachWindow.hours', { count: 1 }, 1)).toBe('1 hour');
    expect(t('settings.calendar.approachWindow.hours', { count: 3 }, 3)).toBe('3 hours');
    await applyLanguage('de');
    expect(t('settings.calendar.approachWindow.hours', { count: 1 }, 1)).toBe('1 Stunde');
    expect(t('settings.calendar.approachWindow.hours', { count: 6 }, 6)).toBe('6 Stunden');
  });
  it('the fun languages fall back to German, then English', async () => {
    await applyLanguage('de-x-mainfr');
    expect(t('views.month')).toBe('Monad');
    // not in the dialect: German
    expect(t('settings.sections.labs')).toBe('Labor');
    expect(html()).toBe('de-x-mainfr');
    await applyLanguage('de-x-coldmirror');
    expect(t('tasklist.titleOrItem')).toContain('Schinken!');
    expect(t('views.day')).toBe('Tag, Digga');
    expect(html()).toBe('de-x-coldmir');
  });
  it('knows which keys exist', () => {
    expect(hasKey('views.year')).toBe(true);
    expect(hasKey('views')).toBe(false);
    expect(hasKey('nope.nothing')).toBe(false);
  });
  it('rejects a misspelt key at compile time', () => {
    // @ts-expect-error not a catalogue key
    const missing = () => t('views.yeer');
    expect(missing).toBeTypeOf('function');
  });
});
const html = () => document.documentElement.lang;

describe('dates follow the language', () => {
  const day = parseParam('day', '2026-10-13')!;
  it('keeps the en-GB forms in English', () => {
    expect(periodTitle('day', day)).toBe('Tuesday, 13 October 2026');
    expect(weekdayLabels()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(monthNames()[9]).toBe('October');
  });
  it('uses de-DE in German and the fun languages, Monday first', async () => {
    for (const l of ['de', 'de-x-mainfr', 'de-x-coldmirror'] as const) {
      await applyLanguage(l);
      expect(periodTitle('day', day)).toBe('Dienstag, 13. Oktober 2026');
      expect(periodTitle('month', day)).toBe('Oktober 2026');
      expect(periodTitle('week', day)).toBe('12. – 18. Okt. 2026');
      expect(periodTitle('year', day)).toBe('2026');
      expect(weekdayLabels()).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
      expect(monthNames()[2]).toBe('März');
    }
  });
});

describe('server message keys', () => {
  it('translates a known key and falls back to the server English otherwise', async () => {
    const known = new ApiError(400, 'VALIDATION_ERROR', 'End must be after start', [], 'errors.validation.endAfterStart');
    const unknown = new ApiError(400, 'VALIDATION_ERROR', 'Something new', [], 'errors.validation.brandNew');
    const plain = new ApiError(400, 'VALIDATION_ERROR', 'No key sent');
    expect(known.userMessage).toBe('End must be after start');
    await applyLanguage('de');
    expect(known.userMessage).toBe('Das Ende muss nach dem Beginn liegen');
    expect(unknown.userMessage).toBe('Something new');
    expect(plain.userMessage).toBe('No key sent');
    expect(new ApiError(0, 'NETWORK', 'x').userMessage).toBe(de.errors.saveUnavailable);
  });
});
