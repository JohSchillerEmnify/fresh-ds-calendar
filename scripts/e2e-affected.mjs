#!/usr/bin/env node
// `pnpm e2e:affected [base]`: prints the Playwright --grep and --project for the scenarios touched since `base` (default
// origin/main, falling back to main). Mapping, see docs/DEVELOPER-GUIDE.md "Which e2e scenarios a change needs":
//   .feature changed          -> that feature
//   e2e step/support changed  -> features whose steps match the step definitions in (or using helpers of) that file
//   web/src, server/src, shared file -> the selectors of its rule in e2e/affected-map.json ("heuristic": features whose
//                                steps reference a data-testid literal found in the file); `pnpm verify` fails on unmapped files
// Counts leave out @unit and @backlog scenarios. A code change never selects nothing: it falls back to @smoke|@ci.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATED, loadMap, ruleFor, stepRanges, touchesDef } from './affected-map.mjs';

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
const mergeBase = git('merge-base', base, 'HEAD');
const forced = process.env.E2E_AFFECTED_FILES; // tests and replays: the changed paths, one per line
const changedFromBase = new Set(forced === undefined ? git('diff', '--name-only', mergeBase).split('\n') : []);
const changed = new Set(forced === undefined ? [
  ...changedFromBase,
  ...git('ls-files', '-o', '--exclude-standard').split('\n'),
].filter(Boolean) : forced.split('\n').filter(Boolean));

// --- features: tags, scenarios (own tags + feature tags, one per Examples row), step texts (Background included,
// Outline placeholders filled from Examples row 1)
const featureFiles = readdirSync(resolve(root, 'spec/features'), { recursive: true }).filter((f) => f.endsWith('.feature')).sort();
const features = featureFiles.map((f) => {
  const lines = read(`spec/features/${f}`).split('\n').map((l) => l.trim());
  const name = (lines.find((l) => l.startsWith('Feature:')) ?? '').slice(8).trim();
  const featureTags = new Set(), steps = [], scenarios = [];
  let outline = null, inExamples = false, header = null, firstRow = null, docstring = false, pending = [], own = [], block = [], seenScenario = false;
  const flush = () => {
    if (outline) {
      for (const s of outline) steps.push(firstRow ? s.replace(/<([^>]+)>/g, (m, k) => firstRow[header.indexOf(k)] ?? m) : s);
    }
    outline = null;
  };
  for (const l of lines) {
    if (l.startsWith('"""')) { docstring = !docstring; continue; }
    if (docstring) continue;
    if (l.startsWith('@')) { pending.push(...l.split(/\s+/)); continue; }
    if (/^(Scenario Outline|Scenario Template):/.test(l)) { flush(); outline = []; inExamples = false; header = null; firstRow = null; own = pending; pending = []; seenScenario = true; continue; }
    if (/^Scenario:/.test(l)) { flush(); own = pending; scenarios.push({ tags: own }); pending = []; seenScenario = true; continue; }
    if (/^Examples:/.test(l)) { inExamples = true; header = null; firstRow = null; block = pending; pending = []; continue; }
    if (!seenScenario && pending.length) { pending.forEach((t) => featureTags.add(t)); pending = []; }
    if (inExamples && l.startsWith('|')) {
      const cells = l.split('|').slice(1, -1).map((c) => c.trim());
      if (!header) header = cells; else { scenarios.push({ tags: [...own, ...block] }); firstRow ??= cells; }
      continue;
    }
    if (/^(Given|When|Then|And|But)\s/.test(l)) {
      const text = l.replace(/^\w+\s+/, '');
      if (outline && !inExamples) outline.push(text); else steps.push(text);
    }
  }
  flush();
  const tags = [...featureTags];
  const all = scenarios.length ? scenarios : [{ tags: [] }];
  return { file: f, name, tags, steps, scenarios: all.map((s) => ({ tags: [...new Set([...tags, ...s.tags])] })) };
});

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
  const ranges = stepRanges(lines);
  out.forEach((d, k) => { Object.assign(d, { end: ranges[k].end, ranges, idx: k }); d.body = lines.slice(d.start, d.end).join('\n'); });
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

// --- map changed files to features and tag selectors
const hit = new Set(), selectors = new Set();
let code = false;
const add = (fs) => fs.forEach((f) => hit.add(f));
const byTestId = (p) => {
  let src = ''; try { src = read(p); } catch { return; } // deleted file
  const ids = kebabs(src);
  const viaHelpers = new Set(helpers.filter((h) => [...h.lits].some((l) => ids.has(l))).map((h) => h.name));
  add(featuresUsing((d) => [...stepIds(d.body)].some((l) => ids.has(l)) || callers(viaHelpers)(d)));
};
const rules = loadMap(root);
const OTHER_CODE = /^(web\/(index\.html|[^/]+\.ts|public\/.*)|capacitor\.config\.ts|Dockerfile)$/; // build and shell files: smoke set
// A step definition counts as changed when a diff hunk overlaps it; a hunk outside any definition (imports, helpers) touches all.
function hunks(p) {
  if (!changedFromBase.has(p)) return null;
  const lines = git('diff', '-U0', mergeBase, '--', p).split('\n').filter((l) => l.startsWith('@@'));
  return lines.map((l) => { const [, a, b = '1'] = l.match(/\+(\d+)(?:,(\d+))?/); return [Number(a) - 1, Number(a) - 1 + Math.max(Number(b), 1)]; });
}
const stepHunks = new Map();
const touched = (d) => {
  if (!stepHunks.has(d.file)) stepHunks.set(d.file, hunks(d.file));
  const hs = stepHunks.get(d.file);
  if (!hs) return true;
  return touchesDef(hs, d.ranges, d.idx);
};
for (const p of changed) {
  if (p.startsWith('spec/features/') && p.endsWith('.feature')) add(features.filter((f) => `spec/features/${f.file}` === p));
  else if (p.endsWith('.steps.ts') && p.startsWith('e2e/steps/')) add(featuresUsing((d) => d.file === p && touched(d)));
  else if (p.startsWith('e2e/steps/')) {
    const names = new Set(helpers.filter((h) => h.file === p).map((h) => h.name));
    add(featuresUsing(callers(names)));
  } else if (OTHER_CODE.test(p)) code = true;
  else if (/^(pnpm-lock\.yaml|(web|server)\/package\.json)$/.test(p)) code = true; // dependency change: smoke set
  else if (GATED.test(p)) {
    const r = ruleFor(rules, p);
    if (r?.noE2e) continue;
    code = true;
    if (!r) { selectors.add('@smoke'); selectors.add('@ci'); continue; }
    for (const sel of r.select) if (sel === 'heuristic') { if (/\.(vue|ts)$/.test(p)) byTestId(p); } else selectors.add(sel);
  }
}
const idOf = (f) => f.tags.find((t) => t.startsWith('@id:'));
for (const f of features) if (hit.has(f)) selectors.add(idOf(f));
// --- selected scenarios, without @unit/@backlog (no project runs them)
const runnable = (sc) => !sc.tags.includes('@unit') && !sc.tags.includes('@backlog');
const pick = () => features.flatMap((f) => f.scenarios.filter((sc) => runnable(sc) && sc.tags.some((t) => selectors.has(t))).map((sc) => ({ f, sc })));
let picked = pick();
if (code && !picked.length) { selectors.add('@smoke'); selectors.add('@ci'); picked = pick(); }
const total = features.reduce((n, f) => n + f.scenarios.filter(runnable).length, 0);
const nFeatures = new Set(picked.map((x) => x.f)).size;

// --- grep term: the tag, made prefix-safe when another tag starts with it (@id:a vs @id:a-b)
const allTags = new Set(features.flatMap((f) => f.scenarios.flatMap((sc) => sc.tags)));
const term = (t) => ([...allTags].some((o) => o !== t && o.startsWith(t)) ? `${t}(\\s|$)` : t);

// --- projects as projects/*.config: mobile skips @desktop/@tablet, desktop skips @mobile/@tablet/@perf, tablet and iphone only theirs
const needs = (tags) => [
  ...(tags.includes('@tablet') ? ['tablet'] : tags.includes('@desktop') ? ['desktop'] : ['mobile']),
  ...(tags.includes('@iphone') ? ['iphone'] : []),
];
const projects = new Set(picked.flatMap((x) => needs(x.sc.tags)));

if (picked.length === 0) console.log('none');
else {
  const counts = `${picked.length} of ${total} runnable scenarios, ${nFeatures} features`;
  console.log(picked.length === total ? `all  (${counts})` : `--grep "${[...selectors].filter((t) => allTags.has(t)).map(term).join('|')}"  (${counts})`);
  console.log(`projects: ${['mobile', 'desktop', 'iphone', 'tablet'].filter((p) => projects.has(p)).map((p) => `--project=${p}`).join(' ')}`);
}
