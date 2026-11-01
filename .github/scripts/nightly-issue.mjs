/**
 * Opens (or updates) the "Nightly e2e failed <date>" issue: every failed job and every failed Playwright scenario, with
 * the run link. Env: NEEDS (JSON of the needs context), RESULTS_DIR (downloaded artifacts), RUN_URL, DATE, GH_TOKEN, GH_REPO.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { NEEDS, RESULTS_DIR, RUN_URL, DATE } = process.env;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });

// results.json files of the Playwright runs, wherever the artifact download put them
const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : n === 'results.json' ? [join(dir, n)] : []));
const failedScenarios = new Set();
const walk = (suite, file = '') => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      if (!['unexpected', 'flaky'].includes(t.status)) continue;
      failedScenarios.add(`${spec.title} (${t.projectName}, ${spec.file ?? file})${t.status === 'flaky' ? ' [flaky]' : ''}`);
    }
  }
  for (const s of suite.suites ?? []) walk(s, s.file ?? file);
};
for (const f of files(RESULTS_DIR)) for (const s of JSON.parse(readFileSync(f, 'utf8')).suites ?? []) walk(s, s.file);

const failedJobs = Object.entries(JSON.parse(NEEDS)).filter(([, v]) => v.result === 'failure' || v.result === 'cancelled').map(([k, v]) => `${k} (${v.result})`);
const body = [
  `The nightly run failed: ${RUN_URL}`,
  '', '### Failed jobs', ...(failedJobs.length ? failedJobs.map((j) => `- ${j}`) : ['- none (see the run)']),
  '', '### Failed e2e scenarios', ...(failedScenarios.size ? [...failedScenarios].sort().map((s) => `- ${s}`) : ['- none recorded (a job failed before its report, or a non-e2e job failed)']),
  '', 'Screenshots, traces, videos and logs are in the run\'s artifacts.',
].join('\n');

// one issue at a time: a failure on a following night is added to the open one
try { gh('label', 'create', 'tests', '--color', 'D93F0B', '--description', 'Test failures'); } catch { /* already there */ }
const open = JSON.parse(gh('issue', 'list', '--label', 'tests', '--state', 'open', '--search', 'Nightly e2e failed in:title', '--json', 'number,title'));
const existing = open.find((i) => i.title.startsWith('Nightly e2e failed'));
if (existing) gh('issue', 'comment', String(existing.number), '--body', `Failed again on ${DATE}.\n\n${body}`);
else gh('issue', 'create', '--title', `Nightly e2e failed ${DATE}`, '--label', 'tests', '--body', body);
