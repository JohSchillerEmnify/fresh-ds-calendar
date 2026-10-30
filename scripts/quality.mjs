#!/usr/bin/env node
// `pnpm quality`: ratcheted code-quality gates (architecture, duplication, shared types, lint size/complexity, comments, dead code).
//   node scripts/quality.mjs check [gate...]   fail when any number is above quality-baseline.json (default: all gates)
//   node scripts/quality.mjs ratchet [gate...] [--allow-increase "<reason>"]   lower the baseline to today's numbers;
//                                              raising anything needs the reason, which is recorded in the file
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GATES, root } from './quality/gates.mjs';

const BASELINE = join(root, 'quality-baseline.json');
const JSCPD = join(root, '.jscpd.json');
const SHOW = 8;

const [mode, ...rest] = process.argv.slice(2);
const reasonAt = rest.indexOf('--allow-increase');
const reason = reasonAt >= 0 ? rest[reasonAt + 1] : undefined;
if (reasonAt >= 0 && !reason) { console.error('--allow-increase needs a reason'); process.exit(2); }
const names = rest.filter((a, i) => !a.startsWith("--") && (reasonAt < 0 || i !== reasonAt + 1));
const gates = names.length ? names : Object.keys(GATES);
const bad = gates.filter((g) => !GATES[g]);
if (!['check', 'ratchet'].includes(mode) || bad.length) {
  console.error(`usage: quality.mjs check|ratchet [${Object.keys(GATES).join('|')}...] [--allow-increase "<reason>"]${bad.length ? ` (unknown: ${bad})` : ''}`);
  process.exit(2);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { gates: {}, allowedIncreases: [] };
const measured = Object.fromEntries(await Promise.all(gates.map(async (g) => [g, await GATES[g]()])));

/** Keys whose measured number is above the baseline (a missing baseline key counts as 0). */
const increases = (g) => Object.entries(measured[g].counts)
  .filter(([k, n]) => n > (baseline.gates[g]?.[k] ?? 0))
  .map(([k, n]) => ({ key: k, from: baseline.gates[g]?.[k] ?? 0, to: n }));
const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

if (mode === 'check') {
  let failed = false;
  for (const g of gates) {
    const m = measured[g], inc = increases(g), errs = m.errors ?? [];
    if (!(g in baseline.gates)) { console.log(`FAIL ${g}: no baseline, run pnpm quality:ratchet --allow-increase "initial baseline"`); failed = true; continue; }
    if (inc.length || errs.length) {
      failed = true;
      console.log(`FAIL ${g}: ${m.summary}; ${inc.length} above baseline (${sum(baseline.gates[g])} allowed)`);
      for (const e of errs.slice(0, SHOW)) console.log(`  error ${e}`);
      for (const i of inc.slice(0, SHOW)) console.log(`  ${i.key}  ${i.from} -> ${i.to}`);
      if (inc.length > SHOW) console.log(`  ... ${inc.length - SHOW} more`);
    } else {
      const lower = sum(baseline.gates[g]) > sum(m.counts) ? ` (baseline ${sum(baseline.gates[g])}, run pnpm quality:ratchet to lower it)` : '';
      console.log(`quality ${g}: OK, ${m.summary}${lower}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

// ratchet: the baseline only ever goes down unless a reason is given
const raised = gates.flatMap((g) => increases(g).map((i) => ({ gate: g, ...i })));
if (raised.length && !reason) {
  console.log(`quality:ratchet refused: ${raised.length} number(s) above the baseline. Fix them, or record why with --allow-increase "<reason>".`);
  for (const r of raised.slice(0, SHOW)) console.log(`  ${r.gate} ${r.key}  ${r.from} -> ${r.to}`);
  process.exit(1);
}
for (const g of gates) baseline.gates[g] = Object.fromEntries(Object.entries(measured[g].counts).sort(([a], [b]) => (a < b ? -1 : 1)));
if (raised.length) {
  const date = new Date().toISOString().slice(0, 10);
  baseline.allowedIncreases.push({ date, reason, gates: [...new Set(raised.map((r) => r.gate))], keys: raised.length });
}
writeFileSync(BASELINE, JSON.stringify(baseline, null, 1) + '\n');
// keep `pnpm dedup` (jscpd's own threshold) in step with the baseline
if (gates.includes('dedup')) {
  const cfg = readFileSync(JSCPD, 'utf8').replace(/("threshold":\s*)[\d.]+/, `$1${measured.dedup.counts['duplicated-percent']}`);
  writeFileSync(JSCPD, cfg);
}
for (const g of gates) console.log(`quality ${g}: baseline ${sum(baseline.gates[g])}${raised.some((r) => r.gate === g) ? ' (raised: ' + reason + ')' : ''}`);
