#!/usr/bin/env node
// `pnpm verify`: quick pre-merge gate. Runs tsc (web/server/e2e), unit tests, i18n:check, check-steps and the ratcheted
// quality gates (arch, dedup, types, lint, comments, knip, colors, fonts, texts; see scripts/quality.mjs) in parallel.
// Prints one OK line, or per failing check its name plus the first lines of relevant errors. Exit 1 on failure.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_LINES = 15;
const ansi = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Runs one command, resolving with its exit code and ANSI-stripped combined output. */
function run(cmd, args, cwd) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '0', CI: '1' } });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('error', (e) => done({ code: 1, out: String(e) }));
    p.on('close', (code) => done({ code: code ?? 1, out: out.replace(ansi, '') }));
  });
}

// Two workers per suite (server + web run side by side): several agents verify at once on one machine.
const tests = (dir) => ({
  cmd: ['pnpm', ['exec', 'vitest', 'run', '--maxWorkers=2'], resolve(root, dir)],
  /** Test count from vitest's "Tests  N passed" line. */
  count: (o) => (o.match(/^\s*Tests\s+(?:\d+ failed \| )?(\d+) passed/m) ?? [])[1],
  /** FAIL headers plus the assertion line that follows each. */
  errors: (o) => {
    const l = o.split('\n'), r = [];
    l.forEach((x, i) => {
      if (/^\s*FAIL /.test(x)) r.push(x.trim(), ...l.slice(i + 1, i + 4).filter((y) => /Error/.test(y)).map((y) => '  ' + y.trim()));
    });
    return r;
  },
});
const tsc = (dir, bin) => ({
  cmd: ['pnpm', ['exec', bin, '--noEmit'], resolve(root, dir)],
  errors: (o) => o.split('\n').filter((x) => /error TS\d+/.test(x)),
});

/** A ratcheted quality gate run (scripts/quality.mjs); its output lines are the details on failure. */
const quality = (...gates) => ({
  cmd: ['node', ['scripts/quality.mjs', 'check', ...gates], root],
  errors: (o) => o.split('\n').filter((x) => x.trim()),
});

const checks = {
  'tsc web': tsc('web', 'vue-tsc'),
  'tsc server': tsc('server', 'tsc'),
  ...(existsSync(resolve(root, 'e2e/tsconfig.json')) ? { 'tsc e2e': tsc('e2e', 'tsc') } : {}),
  'unit server': tests('server'),
  'unit web': tests('web'),
  i18n: { cmd: ['pnpm', ['i18n:check'], root], errors: (o) => o.split('\n').filter((x) => /ERROR|^\s+missing/.test(x)) },
  steps: { cmd: ['python3', ['e2e/scripts/check-steps.py'], root], errors: (o) => o.split('\n').filter((x) => x.trim()) },
  changelog: { cmd: ['node', ['scripts/check-changelog.mjs'], root], errors: (o) => o.split('\n').filter((x) => x.trim()) },
  'quality arch': quality('arch'),
  'quality dedup': quality('dedup'),
  'quality types': quality('types'),
  'quality lint': quality('lint', 'comments'),
  'quality knip': quality('knip'),
  'quality colors': quality('colors'),
  'quality fonts': quality('fonts'),
  'quality texts': quality('texts'),
};

const t0 = Date.now();
const results = await Promise.all(
  Object.entries(checks).map(async ([name, c]) => ({ name, c, ...(await run(...c.cmd)) })),
);
const failed = results.filter((r) => r.code !== 0);
if (failed.length === 0) {
  const n = (k) => results.find((r) => r.name === k);
  const tscs = ['web', 'server', 'e2e'].filter((k) => n('tsc ' + k)).join('/');
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`verify: OK (tsc ${tscs}, unit ${checks['unit server'].count(n('unit server').out) ?? '?'}+${checks['unit web'].count(n('unit web').out) ?? '?'}, i18n, steps, quality) in ${secs}s`);
  // one line per quality gate
  for (const r of results.filter((x) => x.name.startsWith('quality '))) process.stdout.write(r.out);
} else {
  for (const r of failed) {
    let lines = r.c.errors(r.out);
    if (!lines.length) lines = r.out.split('\n').filter((x) => x.trim()).slice(-MAX_LINES);
    console.log(`FAIL ${r.name}`);
    for (const l of lines.slice(0, MAX_LINES)) console.log('  ' + (l.length > 200 ? l.slice(0, 197) + '...' : l));
    if (lines.length > MAX_LINES) console.log(`  ... ${lines.length - MAX_LINES} more`);
  }
  process.exit(1);
}
