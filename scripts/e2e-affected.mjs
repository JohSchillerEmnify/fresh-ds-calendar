#!/usr/bin/env node
// `pnpm e2e:affected [base]`: prints the Playwright --grep for the features touched since `base` (default origin/main,
// falling back to main when there is no remote). Heuristic, see CONTRIBUTING.md "Tooling":
//   .feature changed          -> that feature
//   e2e step/support changed  -> features whose steps match the step definitions in (or using helpers of) that file
//   web/src file changed      -> features whose step definitions reference a data-testid literal found in that file
// Web/server/shared files that share no testid with any step are listed on a second line as "unmapped".
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const stepIds = (s) => new Set([...s.matchAll(TESTID)].map((m) => m[1] ?? m[2]));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const KEBAB = /['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['"`]/g;
const kebabs = (s) => new Set([...s.matchAll(KEBAB)].map((m) => m[1]));
const TESTID = /(?:getByTestId|byTestId|tid)\(\s*['"`]([\w-]+)['"`]|data-testid=\\?["']?([\w-]+)/g;

// --- changed files (committed since merge-base, plus working tree and untracked)
let base = process.argv[2] ?? 'origin/main';
const ok = (r) => { try { git('rev-parse', '--verify', '-q', r); return true; } catch { return false; } };
if (!ok(base) && !process.argv[2]) base = 'main';
if (!ok(base)) { console.error(`e2e:affected: unknown base ${base}`); process.exit(2); }
const changed = new Set([
  ...git('diff', '--name-only', git('merge-base', base, 'HEAD')).split('\n'),
  ...git('ls-files', '-o', '--exclude-standard').split('\n'),
].filter(Boolean));

// --- features: tags, scenario count, step texts (Background included, Outline placeholders filled from Examples row 1)
const featureFiles = readdirSync(resolve(root, 'spec/features'), { recursive: true }).filter((f) => f.endsWith('.feature')).sort();
const features = featureFiles.map((f) => {
  const lines = read(`spec/features/${f}`).split('\n').map((l) => l.trim());
  const name = (lines.find((l) => l.startsWith('Feature:')) ?? '').slice(8).trim();
  const tags = new Set(), steps = [];
  let scenarios = 0, outline = null, inExamples = false, header = null, firstRow = null, docstring = false;
  const flush = () => {
    if (outline) {
      for (const s of outline) steps.push(firstRow ? s.replace(/<([^>]+)>/g, (m, k) => firstRow[header.indexOf(k)] ?? m) : s);
    }
    outline = null;
  };
  for (const l of lines) {
    if (l.startsWith('"""')) { docstring = !docstring; continue; }
    if (docstring) continue;
    if (l.startsWith('@')) { for (const t of l.split(/\s+/)) tags.add(t); continue; }
    if (/^(Scenario Outline|Scenario Template):/.test(l)) { flush(); outline = []; inExamples = false; header = null; firstRow = null; continue; }
    if (/^Scenario:/.test(l)) { flush(); scenarios++; continue; }
    if (/^Examples:/.test(l)) { inExamples = true; header = null; firstRow = null; continue; }
    if (inExamples && l.startsWith('|')) {
      const cells = l.split('|').slice(1, -1).map((c) => c.trim());
      if (!header) header = cells; else { scenarios += 1; firstRow ??= cells; }
      continue;
    }
    if (/^(Given|When|Then|And|But)\s/.test(l)) {
      const text = l.replace(/^\w+\s+/, '');
      if (outline && !inExamples) outline.push(text); else steps.push(text);
    }
  }
  flush();
  return { file: f, name, tags: [...tags], steps, scenarios };
});
for (const f of features) f.scenarios = Math.max(f.scenarios, 1);

// --- Cucumber expression -> RegExp
const EXPR = { string: '"[^"]*"', int: '-?\\d+', float: '-?\\d+(?:\\.\\d+)?', word: '\\S+' };
function exprRegex(e) {
  let r = '';
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (c === '{') { const j = e.indexOf('}', i); r += EXPR[e.slice(i + 1, j)] ?? '.+?'; i = j; }
    else if (c === '(') { const j = e.indexOf(')', i); r += `(?:${e.slice(i + 1, j).replace(/[.*+?^$|\\[\]]/g, '\\$&')})?`; i = j; }
    else if (c === '/' ) r += '|';
    else r += c.replace(/[.*+?^$|\\[\]]/g, '\\$&');
  }
  return new RegExp(`^(?:${r})$`);
}

// --- step definitions per file: expression + body
const stepDir = resolve(root, 'e2e/steps');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(resolve(d, e.name)) : e.name.endsWith('.ts') ? [resolve(d, e.name)] : []));
const rel = (p) => p.slice(root.length + 1);
const stepFiles = walk(stepDir).filter((p) => p.endsWith('.steps.ts'));
const defs = stepFiles.flatMap((p) => {
  const lines = readFileSync(p, 'utf8').split('\n');
  const out = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(?:Given|When|Then|Step)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/);
    if (m) out.push({ file: rel(p), re: exprRegex(m[2].replace(/\\(['"`])/g, '$1')), start: i });
  });
  out.forEach((d, k) => { d.body = lines.slice(d.start, out[k + 1]?.start ?? lines.length).join('\n'); });
  return out;
});
// support helpers: name -> literals inside it
const supportFiles = walk(resolve(stepDir, 'support')).concat(['fixtures.ts', 'parameters.ts'].map((f) => resolve(stepDir, f)));
const helpers = supportFiles.flatMap((p) => {
  const lines = readFileSync(p, 'utf8').split('\n');
  const heads = [];
  lines.forEach((l, i) => { const m = l.match(/^(?:export )?(?:async )?(?:function\*? (\w+)|const (\w+)\s*=)/); if (m) heads.push({ name: m[1] ?? m[2], start: i }); });
  return heads.map((h, k) => ({ file: rel(p), name: h.name, lits: stepIds(lines.slice(h.start, heads[k + 1]?.start ?? lines.length).join('\n')) }));
});

const featuresUsing = (pred) => features.filter((f) => defs.some((d) => pred(d) && f.steps.some((s) => d.re.test(s))));
const callers = (names) => (d) => [...names].some((n) => new RegExp(`\\b${n}\\b`).test(d.body));

// --- map changed files to features
const hit = new Set();
const unmapped = [];
const add = (fs) => fs.forEach((f) => hit.add(f));
for (const p of changed) {
  if (p.startsWith('spec/features/') && p.endsWith('.feature')) add(features.filter((f) => `spec/features/${f.file}` === p));
  else if (p.endsWith('.steps.ts') && p.startsWith('e2e/steps/')) add(featuresUsing((d) => d.file === p));
  else if (p.startsWith('e2e/steps/')) {
    const names = new Set(helpers.filter((h) => h.file === p).map((h) => h.name));
    add(featuresUsing(callers(names)));
  } else if (/^web\/src\/.*\.(vue|ts)$/.test(p)) {
    let src = ''; try { src = read(p); } catch { continue; } // deleted file
    const ids = kebabs(src);
    const viaHelpers = new Set(helpers.filter((h) => [...h.lits].some((l) => ids.has(l))).map((h) => h.name));
    const before = hit.size;
    add(featuresUsing((d) => [...stepIds(d.body)].some((l) => ids.has(l)) || callers(viaHelpers)(d)));
    if (hit.size === before && !featuresUsing((d) => [...stepIds(d.body)].some((l) => ids.has(l))).length) unmapped.push(p);
  } else if (/^(web|server|shared)\/(src|index)/.test(p)) unmapped.push(p);
}

// --- grep term per feature: @id, else a tag no other feature shares (prefix-safe), else the feature title
function term(f) {
  const others = features.filter((o) => o !== f).flatMap((o) => o.tags);
  const unique = (t) => !others.some((u) => u.startsWith(t));
  const id = f.tags.find((t) => t.startsWith('@id:'));
  const t = (id && unique(id) && id) || f.tags.find(unique);
  return t ?? f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
if (hit.size === 0) console.log('none');
else {
  const list = features.filter((f) => hit.has(f));
  const n = list.reduce((s, f) => s + f.scenarios, 0);
  console.log(list.length === features.length ? `all  (${list.length} features, ~${n} scenarios)` : `--grep "${list.map(term).join('|')}"  (${list.length} features, ~${n} scenarios)`);
}
if (unmapped.length) console.log(`unmapped (no testid shared with e2e steps): ${unmapped.length} files, e.g. ${unmapped.slice(0, 3).join(', ')}`);
