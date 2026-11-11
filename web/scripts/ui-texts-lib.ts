/**
 * The texts contract (docs/UI-TEXTS.md) as a checker: pure functions over a message catalogue and the rules in
 * docs/ui-texts.json. `pnpm ui-texts` prints the findings; the `ui-texts` quality gate ratchets their count.
 */
import { flattenKeys } from '../src/i18n/keys.ts';

export interface Glossary { concept: string; en: string; de: string; neverEn: string[]; neverDe: string[] }
export interface Rules {
  hintMaxChars: number;
  glossary: Glossary[];
  implementationWords: { en: string[]; de: string[] };
  supportiveWords: { en: string[]; de: string[] };
  allow: { key: string; rule: string; why: string }[];
}
export interface Finding { key: string; rule: string; text: string }
export type Lang = 'en' | 'de' | 'fun';

const get = (messages: object, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
/** Text without vue-i18n placeholders and links, so `{name}` and `@:key` never trigger a rule. */
const plain = (s: string) => s.replace(/\{[^}]*\}|@[.:][\w.]+/g, ' ');
const words = (s: string) => plain(s).toLowerCase().match(/[a-zäöüß]{3,}/g) ?? [];
const wordRe = (w: string, flags = 'i') => new RegExp(`(?<![\\p{L}\\d])${w}(?![\\p{L}\\d])`, `${flags}u`);
const isHint = (key: string) => /(^|\.)hint$|Hint$/.test(key);

function typography(text: string): string[] {
  const out: string[] = [];
  if (/"/.test(text)) out.push('quotes');
  else if (/(^|[\s(])'[^'\s][^']*'(?=[\s.,;:!?)]|$)/.test(text)) out.push('quotes');
  if (/\.\.\./.test(text)) out.push('ellipsis');
  if (/\S > \S/.test(text)) out.push('menu-arrow');
  return out;
}

function hintRepeatsLabel(label: string, hint: string): boolean {
  const l = words(label), h = words(hint);
  if (!l.length || !h.length) return false;
  if (plain(hint).toLowerCase().includes(plain(label).toLowerCase().trim()) && l.length > 1) return true;
  const hs = new Set(h), ls = new Set(l);
  const covered = l.filter((w) => hs.has(w)).length / l.length;
  const shared = h.filter((w) => ls.has(w)).length / h.length;
  return l.length > 1 && covered >= 0.8 && shared >= 0.6;
}

const sentences = (s: string) => plain(s).split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/).filter((x) => x.trim()).length;

const matches = (words: string[], text: string, caseless: (w: string) => boolean) => words.filter((w) => wordRe(w, caseless(w) ? 'i' : '').test(text));

/** The rules that one string breaks (typography only for the fun locales). */
function stringRules(key: string, text: string, lang: Lang, rules: Rules, messages: object): string[] {
  const hit = typography(text);
  if (lang === 'fun') return hit;
  const p = plain(text);
  const de = lang === 'de';
  if (matches(rules.glossary.flatMap((g) => (de ? g.neverDe : g.neverEn)), p, () => true).length) hit.push('glossary');
  if (matches(rules.implementationWords[de ? 'de' : 'en'], p, (w) => !/^[A-Z]/.test(w)).length) hit.push('implementation-word');
  if (matches(rules.supportiveWords[de ? 'de' : 'en'], p, () => true).length) hit.push('supportive');
  if (de && /(?<![.!?]\s)(?<!^)\b(Sie|Ihnen|Ihre[nmrs]?|Ihr)\b/.test(p)) hit.push('formal-sie');
  if (isHint(key)) hit.push(...hintRules(key, text, rules, messages));
  return hit;
}

function hintRules(key: string, text: string, rules: Rules, messages: object): string[] {
  const hit: string[] = [];
  if (sentences(text) > 1 || plain(text).trim().length > rules.hintMaxChars) hit.push('hint-length');
  const label = get(messages, key.replace(/hint$/, 'label'));
  if (key.endsWith('.hint') && typeof label === 'string' && hintRepeatsLabel(label, text)) hit.push('hint-repeats-label');
  return hit;
}

/** All contract violations of one catalogue; the fun locales get the typography rules only. */
export function checkCatalogue(messages: object, lang: Lang, rules: Rules): Finding[] {
  const found: Finding[] = [];
  for (const key of flattenKeys(messages)) {
    const text = get(messages, key) as string;
    for (const rule of stringRules(key, text, lang, rules, messages)) {
      if (!rules.allow.some((a) => a.key === key && a.rule === rule)) found.push({ key, rule, text });
    }
  }
  return found;
}

/** German strings identical to their English ones (untranslated), unless allowed with a reason. */
export function sameAsEnglish(en: object, de: object, rules: Rules): Finding[] {
  const out: Finding[] = [];
  for (const key of flattenKeys(de)) {
    const text = get(de, key) as string, other = get(en, key);
    const letters = plain(text).match(/\p{L}{2,}/gu);
    if (!letters || text.trim() !== other || rules.allow.some((a) => a.key === key && a.rule === 'same-as-en')) continue;
    out.push({ key, rule: 'same-as-en', text });
  }
  return out;
}

const NAME_TABLES = [
  /['"](?:Mon|Monday|Mo|Montag)['"]\s*,\s*['"](?:Tue|Tuesday|Tu|Di|Dienstag)['"]/,
  /['"](?:Sun|Sunday|So|Sonntag)['"]\s*,\s*['"](?:Mon|Monday|Mo|Montag)['"]/,
  /['"](?:Jan|January|Januar)['"]\s*,\s*['"](?:Feb|February|Februar)['"]/,
];
/** Whether source text holds a hand-made weekday or month name table (dates come from Intl with the app locale). */
export const hasNameTable = (source: string) => NAME_TABLES.some((re) => re.test(source));

/** `file: key [rule] text`, one line per finding. */
export const formatFinding = (file: string, f: Finding) => `${file}: ${f.key} [${f.rule}] ${f.text}`;
