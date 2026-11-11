/**
 * `pnpm ui-texts [--write-doc]`: checks the message catalogues against the texts contract (docs/UI-TEXTS.md,
 * docs/ui-texts.json) and prints one line per finding. `--write-doc` regenerates the glossary table in the doc.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import de from '../src/i18n/locales/de.ts';
import deXColdmirror from '../src/i18n/locales/de-x-coldmirror.ts';
import deXMainfr from '../src/i18n/locales/de-x-mainfr.ts';
import en from '../src/i18n/locales/en.ts';
import { checkCatalogue, formatFinding, hasNameTable, sameAsEnglish, checkAllow, type Finding, type Rules } from './ui-texts-lib.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const RULES_FILE = resolve(repo, 'docs/ui-texts.json');
export const DOC_FILE = resolve(repo, 'docs/UI-TEXTS.md');
const BEGIN = '<!-- glossary:begin (generated from docs/ui-texts.json: pnpm ui-texts --write-doc) -->';
const END = '<!-- glossary:end -->';

export const loadRules = (): Rules => JSON.parse(readFileSync(RULES_FILE, 'utf8'));

/** The glossary table as the doc shows it. */
export function glossaryTable(rules: Rules): string {
  const row = (g: Rules['glossary'][number]) =>
    `| ${g.en} | ${g.de} | ${[...g.neverEn, ...g.neverDe].join(', ') || '-'} |`;
  return ['| English | German | Never use |', '|---|---|---|', ...rules.glossary.map(row)].join('\n');
}

/** Whether the doc's glossary block equals the generated one. */
export function docInSync(doc: string, rules: Rules): boolean {
  const m = doc.match(new RegExp(`${BEGIN.replace(/[()]/g, '\\$&')}\\n([\\s\\S]*?)\\n${END}`));
  return !!m && m[1] === glossaryTable(rules);
}

/** All findings per catalogue, keyed by a short file label. */
export function allFindings(rules: Rules): { file: string; findings: Finding[] }[] {
  return [
    { file: 'locales/en', findings: checkCatalogue(en, 'en', rules) },
    { file: 'locales/de', findings: [...checkCatalogue(de, 'de', rules), ...sameAsEnglish(en, de, rules), ...checkAllow(de, rules)] },
    { file: 'locales/de-x-mainfr', findings: checkCatalogue(deXMainfr, 'fun', rules) },
    { file: 'locales/de-x-coldmirror', findings: checkCatalogue(deXColdmirror, 'fun', rules) },
  ];
}

const walk = (p: string): string[] =>
  statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => walk(resolve(p, n))) : /\.(ts|vue|java|kt)$/.test(p) ? [p] : [];

/** Repo-relative source files (web, Android widget) that hold a hand-made weekday or month name table. */
export function nameTableFiles(): string[] {
  return ['web/src', 'android/app/src/main/java']
    .flatMap((d) => { try { return walk(resolve(repo, d)); } catch { return []; } })
    .filter((f) => hasNameTable(readFileSync(f, 'utf8')))
    .map((f) => f.slice(repo.length + 1))
    .sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rules = loadRules();
  if (process.argv.includes('--write-doc')) {
    const doc = readFileSync(DOC_FILE, 'utf8');
    const re = new RegExp(`${BEGIN.replace(/[()]/g, '\\$&')}[\\s\\S]*?${END}`);
    writeFileSync(DOC_FILE, doc.replace(re, `${BEGIN}\n${glossaryTable(rules)}\n${END}`));
  }
  let n = 0;
  for (const { file, findings } of allFindings(rules)) for (const f of findings) { console.log(formatFinding(file, f)); n++; }
  for (const f of nameTableFiles()) { console.log(`${f}: [hand-made-dates] weekday or month name table; use Intl with the app locale`); n++; }
  const sync = docInSync(readFileSync(DOC_FILE, 'utf8'), rules);
  if (!sync) console.log('docs/UI-TEXTS.md: glossary table differs from docs/ui-texts.json (run pnpm ui-texts --write-doc)');
  console.log(`ui-texts: ${n} findings`);
}
