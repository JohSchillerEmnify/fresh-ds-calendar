import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkCatalogue, hasNameTable, sameAsEnglish, type Lang, type Rules } from '../scripts/ui-texts-lib';
import { docInSync, loadRules, DOC_FILE } from '../scripts/ui-texts';

const rules: Rules = loadRules();
const rulesOf = (messages: object, lang: Lang, r: Rules = rules) => checkCatalogue(messages, lang, r).map((f) => f.rule);

describe('texts contract checker', () => {
  it('passes plain, correct strings', () => {
    expect(rulesOf({ a: { label: 'Show the version', hint: 'Opens the list when you tap it.' }, b: 'Sign in again' }, 'en')).toEqual([]);
  });
  it('flags glossary words per language', () => {
    expect(rulesOf({ a: 'Wähle ein Theme' }, 'de')).toContain('glossary');
    expect(rulesOf({ a: 'Wähle ein Theme' }, 'en')).not.toContain('glossary');
    expect(rulesOf({ a: 'Your own calendar' }, 'en')).toContain('glossary');
  });
  it('flags implementation words, not words that merely contain them', () => {
    expect(rulesOf({ a: 'Stored on the server' }, 'en')).toContain('implementation-word');
    expect(rulesOf({ a: 'Servers are fun' }, 'en')).not.toContain('implementation-word');
    expect(rulesOf({ a: 'Show Labs features' }, 'en')).toContain('implementation-word');
    expect(rulesOf({ a: 'Nutze einen Token' }, 'de')).toContain('implementation-word');
  });
  it('honours the allow-list with its reason', () => {
    const allow = { ...rules, allow: [{ key: 'a', rule: 'implementation-word', why: 'test' }] };
    expect(rulesOf({ a: 'Stored on the server' }, 'en', allow)).toEqual([]);
  });
  it('flags straight quotes, three dots and the > menu arrow, also in fun locales', () => {
    expect(rulesOf({ a: 'Tap "Save"' }, 'fun')).toContain('quotes');
    expect(rulesOf({ a: "Tap 'Save' now" }, 'en')).toContain('quotes');
    expect(rulesOf({ a: 'Wait...' }, 'fun')).toContain('ellipsis');
    expect(rulesOf({ a: 'Settings > Calendar' }, 'en')).toContain('menu-arrow');
    expect(rulesOf({ a: 'Tap “Save”… it’s Settings › Calendar' }, 'en')).toEqual([]);
    expect(rulesOf({ a: "Don't stop" }, 'en')).toEqual([]);
  });
  it('checks nothing but typography in fun locales', () => {
    expect(rulesOf({ a: 'Der Server failed', b: { hint: 'Eins. Zwei.' } }, 'fun')).toEqual([]);
  });
  it('flags a hint that repeats its label', () => {
    expect(rulesOf({ x: { label: 'Show version in the corner', hint: 'Show the version in the corner' } }, 'en')).toContain('hint-repeats-label');
    expect(rulesOf({ x: { label: 'Time left', hint: 'Shows how long the event still runs.' } }, 'en')).not.toContain('hint-repeats-label');
  });
  it('flags hints with two sentences or over the length', () => {
    expect(rulesOf({ x: { hint: 'First thing. Second thing.' } }, 'en')).toContain('hint-length');
    expect(rulesOf({ x: { hint: 'a'.repeat(125) } }, 'en')).toContain('hint-length');
    expect(rulesOf({ x: { hint: 'Open lists get a label like “From Sat 10 Oct”' } }, 'en')).not.toContain('hint-length');
    expect(rulesOf({ xHint: 'One. Two.' }, 'en')).toContain('hint-length');
  });
  it('flags formal Sie but not a sentence-initial “they”', () => {
    expect(rulesOf({ a: 'Hier können Sie speichern' }, 'de')).toContain('formal-sie');
    expect(rulesOf({ a: 'Sie bleibt offen' }, 'de')).not.toContain('formal-sie');
  });
  it('flags unsupportive words', () => {
    expect(rulesOf({ a: 'Backup failed' }, 'en')).toContain('supportive');
    expect(rulesOf({ a: 'Termin verpasst' }, 'de')).toContain('supportive');
    expect(rulesOf({ a: 'Could not back up' }, 'en')).toEqual([]);
  });
  it('ignores placeholders', () => {
    expect(rulesOf({ a: 'Hello {server}' }, 'en')).toEqual([]);
  });
  it('flags a German string identical to the English one unless allowed', () => {
    expect(sameAsEnglish({ a: 'Cancel', b: 'OK', c: '{n}' }, { a: 'Cancel', b: 'OK', c: '{n}' }, rules).map((f) => f.key)).toEqual(['a', 'b']);
    const allow = { ...rules, allow: [{ key: 'b', rule: 'same-as-en', why: 'test' }] };
    expect(sameAsEnglish({ a: 'Cancel', b: 'OK' }, { a: 'Abbrechen', b: 'OK' }, allow)).toEqual([]);
  });
  it('spots hand-made weekday and month tables', () => {
    expect(hasNameTable("const D = ['Mon', 'Tue', 'Wed']")).toBe(true);
    expect(hasNameTable("const M = ['January', 'February']")).toBe(true);
    expect(hasNameTable("const x = ['Monday', 'sale']")).toBe(false);
  });
  it('keeps the glossary table in docs/UI-TEXTS.md in step with docs/ui-texts.json', () => {
    expect(docInSync(readFileSync(DOC_FILE, 'utf8'), rules)).toBe(true);
  });
});
