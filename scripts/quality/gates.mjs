// Measurers for the quality gates. Each returns { counts, summary }: `counts` maps a stable key to a number, and the
// ratchet (scripts/quality.mjs) fails when any key rises above the baseline. Established tools do the analysis; only
// the exported-name duplicate check is our own (no maintained tool compares declarations across two source trees).
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bin = (name) => join(root, 'node_modules/.bin', name);

/** Runs a command and resolves with its exit code, stdout and stderr (never rejects). */
function run(cmd, args) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd: root, env: { ...process.env, FORCE_COLOR: '0', CI: '1' } });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => done({ code: 1, out, err: String(e) }));
    p.on('close', (code) => done({ code: code ?? 1, out, err }));
  });
}

/** Adds one to `counts[key]`. */
const bump = (counts, key) => { counts[key] = (counts[key] ?? 0) + 1; };

/** Layer, boundary, circular and orphan violations from dependency-cruiser, keyed rule|from|to. */
async function arch() {
  const r = await run(bin('depcruise'), ['web/src', 'server/src', 'shared', '-c', '.dependency-cruiser.cjs', '-T', 'json']);
  let json;
  try { json = JSON.parse(r.out); } catch { throw new Error(`depcruise failed: ${(r.err || r.out).slice(0, 400)}`); }
  const counts = {};
  for (const v of json.summary.violations) {
    const to = v.cycle ? v.cycle.map((c) => c.name).join(' > ') : v.to === v.from ? '' : v.to;
    bump(counts, `${v.rule.name}|${v.from}|${to}`);
  }
  return { counts, summary: `${Object.values(counts).reduce((a, b) => a + b, 0)} known violations` };
}

/** Copy/paste percentage from jscpd (config in .jscpd.json). */
async function dedup() {
  await run(bin('jscpd'), ['web/src', 'server/src', 'shared', '--silent', '--reporters', 'json', '--output', '.jscpd-report', '--threshold', '100']);
  const stats = JSON.parse(readFileSync(join(root, '.jscpd-report/jscpd-report.json'), 'utf8')).statistics.total;
  // rounded up to 3 decimals so the baseline is a short, stable number
  const percent = Math.ceil(stats.percentage * 1000) / 1000;
  return { counts: { 'duplicated-percent': percent }, summary: `${percent}% duplicated (${stats.clones} clones)` };
}

/** Recursively lists .ts files below a directory. */
function tsFiles(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsFiles(p) : /\.ts$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

/** Exported type/interface/enum/const names declared in a file's top level. */
function exportedNames(ts, file) {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const names = [];
  for (const st of sf.statements) {
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) names.push(st.name.text);
    else if (ts.isVariableStatement(st) && (st.declarationList.flags & ts.NodeFlags.Const)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
    }
  }
  return names;
}

/** Names exported in both web/src and server/src: candidates for shared/. */
async function types() {
  const ts = createRequire(join(root, 'web/package.json'))('typescript');
  const names = (dir) => new Set(tsFiles(join(root, dir)).flatMap((f) => exportedNames(ts, f)));
  const web = names('web/src'), server = names('server/src');
  const counts = {};
  for (const n of web) if (server.has(n)) counts[n] = 1;
  return { counts, summary: `${Object.keys(counts).length} names declared in both web and server` };
}

let eslintRun;
/** One shared ESLint JSON run for the `lint` and `comments` gates. */
function eslint() {
  eslintRun ??= run(bin('eslint'), ['.', '-f', 'json']).then((r) => {
    try { return JSON.parse(r.out); } catch { throw new Error(`eslint failed: ${(r.err || r.out).slice(0, 400)}`); }
  });
  return eslintRun;
}

/** Warning counts per rule and file (comment-style excluded). Errors are reported as a failure by the caller. */
async function lint() {
  const counts = {}; const errors = [];
  for (const f of await eslint()) {
    const file = relative(root, f.filePath);
    for (const m of f.messages) {
      if (m.ruleId === 'local/comment-style') continue;
      if (m.severity === 2) errors.push(`${file}:${m.line} ${m.ruleId ?? ''} ${m.message}`);
      else bump(counts, `${m.ruleId}|${file}`);
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, errors, summary: `${total} warnings (size, complexity, unused, any)` };
}

/** Long, dated and owner-quoting comments per file. */
async function comments() {
  const counts = {};
  for (const f of await eslint()) {
    for (const m of f.messages) if (m.ruleId === 'local/comment-style') bump(counts, `${m.messageId ?? 'comment'}|${relative(root, f.filePath)}`);
  }
  return { counts, summary: `${Object.values(counts).reduce((a, b) => a + b, 0)} comment-style findings` };
}

/** Unused files, exports, types and dependencies from knip (config in knip.json). */
async function knip() {
  const r = await run(bin('knip'), ['--reporter', 'json', '--no-exit-code']);
  let json;
  try { json = JSON.parse(r.out); } catch { throw new Error(`knip failed: ${(r.err || r.out).slice(0, 400)}`); }
  const counts = {};
  for (const i of json.issues) {
    for (const kind of ['files', 'exports', 'types', 'dependencies', 'devDependencies']) {
      for (const it of i[kind] ?? []) bump(counts, `${kind}|${i.file}|${kind === 'files' ? '' : it.name}`);
    }
  }
  const by = (k) => Object.keys(counts).filter((x) => x.startsWith(k + '|')).length;
  return { counts, summary: `${by('files')} files, ${by('exports')} exports, ${by('types')} types, ${by('dependencies') + by('devDependencies')} deps unused` };
}

/** Recursively lists .vue files below a directory. */
function vueFiles(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? vueFiles(p) : n.endsWith('.vue') ? [p] : [];
  });
}

/** Hard-coded colour literals (#hex, rgb(), hsl()) per .vue file; the theme tokens (web/src/theme) and the m3 kit are the only sources. */
async function colors() {
  const literal = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(/g;
  const counts = {};
  for (const f of vueFiles(join(root, 'web/src'))) {
    const rel = relative(root, f);
    if (rel.startsWith('web/src/components/m3/')) continue;
    const n = (readFileSync(f, 'utf8').match(literal) ?? []).length;
    if (n) counts[rel] = n;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, summary: `${total} colour literals in ${Object.keys(counts).length} .vue files (use theme tokens: var(--...) from web/src/theme)` };
}

/** Fixed px/pt `font-size:` values per .vue file; sizes come from the type tokens (calc/var expressions are fine) so they follow the density setting. */
async function fonts() {
  const literal = /font-size:\s*[0-9.]+(?:px|pt)\b/g;
  const counts = {};
  for (const f of vueFiles(join(root, 'web/src'))) {
    const rel = relative(root, f);
    if (rel.startsWith('web/src/components/m3/')) continue;
    const n = (readFileSync(f, 'utf8').match(literal) ?? []).length;
    if (n) counts[rel] = n;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, summary: `${total} fixed font sizes in ${Object.keys(counts).length} .vue files (use the type tokens: calc(Npx * var(--dz, 1)) or var(--entry-...))` };
}

export const GATES = { arch, dedup, types, lint, comments, knip, colors, fonts };
