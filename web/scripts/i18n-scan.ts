/**
 * `pnpm i18n:scan [path...] [--json]`: lists hard-coded user-visible strings left in `web/src` (default: everything).
 *
 * Templates use the same detector as `test/i18n-raw-text.test.ts` (static text nodes and the attributes label,
 * aria-label, title, placeholder, alt). Scripts (`.ts` and `<script>` blocks) are scanned for string literals passed to
 * `notify(` and `new Error(`. Strings already routed through `t(` are not literals of these calls and never listed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'vue/compiler-sfc';
import { HAS_WORD, rawTextHits, type Node, type RawHit } from '../src/i18n/raw-text.ts';

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(webDir, '..');
const args = process.argv.slice(2);
const json = args.includes('--json');
const targets = args.filter((a) => !a.startsWith('--'));

/** All `.vue`/`.ts` files below `p` (a file or directory), skipping declaration files. */
function files(p: string): string[] {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((n) => (/\.(vue|ts)$/.test(n) && !n.endsWith('.d.ts')) || !n.includes('.') ? files(resolve(p, n)) : []);
}

/** Resolves a CLI path against the cwd, then the repo root, then `web/`. */
function resolveTarget(t: string): string {
  for (const base of [process.cwd(), repoDir, webDir]) {
    try { const p = resolve(base, t); statSync(p); return p; } catch { /* try next base */ }
  }
  throw new Error(`no such path: ${t}`);
}

/** Text between the parentheses opening at `open` (balanced, string-aware); empty if unbalanced. */
function callArgs(src: string, open: number): string {
  let depth = 0, quote = '';
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return src.slice(open + 1, i);
  }
  return '';
}

/** User-visible string literals in `notify(` and `new Error(` calls of `src`; lines are offset by `firstLine - 1`. */
function scriptHits(src: string, firstLine: number): RawHit[] {
  const hits: RawHit[] = [];
  const call = /\b(notify|new Error)\(/g;
  for (let m = call.exec(src); m; m = call.exec(src)) {
    const body = callArgs(src, m.index + m[0].length - 1);
    const lit = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
    for (let l = lit.exec(body); l; l = lit.exec(body)) {
      const text = l[2];
      // Skip option values (`testid: 'x'`), non-sentences and `${…}`-only templates
      if (/\w\s*:\s*$/.test(body.slice(0, l.index)) || !HAS_WORD.test(text.replace(/\$\{[^}]*\}/g, ''))) continue;
      if (!/\s/.test(text) && !/^\p{Lu}/u.test(text)) continue;
      const at = m.index + m[0].length + l.index;
      hits.push({ text, line: firstLine + src.slice(0, at).split('\n').length - 1 });
    }
  }
  return hits;
}

/** All hits of one file, sorted by line. */
function scan(file: string): RawHit[] {
  const src = readFileSync(file, 'utf8');
  if (!file.endsWith('.vue')) return scriptHits(src, 1);
  const { descriptor } = parse(src);
  const hits = descriptor.template ? rawTextHits(descriptor.template.ast as unknown as Node) : [];
  for (const block of [descriptor.script, descriptor.scriptSetup]) if (block) hits.push(...scriptHits(block.content, block.loc.start.line));
  return hits.sort((a, b) => a.line - b.line);
}

const roots = targets.length ? targets.map(resolveTarget) : [resolve(webDir, 'src')];
const results = roots.flatMap(files).sort().map((f) => ({ file: relative(repoDir, f), hits: scan(f) }));
const dirty = results.filter((r) => r.hits.length);
const total = dirty.reduce((n, r) => n + r.hits.length, 0);

if (json) {
  console.log(JSON.stringify({ total, files: dirty.length, clean: results.length - dirty.length, results: dirty }, null, 1));
} else {
  for (const r of dirty.sort((a, b) => b.hits.length - a.hits.length)) {
    console.log(`${r.file}: ${r.hits.length} strings`);
    for (const h of r.hits.slice(0, 5)) console.log(`  ${h.line}: ${h.text.length > 70 ? h.text.slice(0, 67) + '...' : h.text}`);
  }
  console.log(`i18n:scan: ${total} strings in ${dirty.length} files (${results.length - dirty.length} files clean)`);
}
