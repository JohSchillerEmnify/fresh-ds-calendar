#!/usr/bin/env node
// Gate: a branch with a feat/fix commit must also change CHANGELOG.md (rule: docs/DEPLOYMENT.md, "Release notes").
// Compares HEAD with its merge base with github/main or origin/main; on main itself there is nothing to compare.
import { execFileSync } from 'node:child_process';

const USER_FACING = /^(feat|fix)(\([^)]*\))?!?:/;

/** Subjects of the commits that need a changelog entry, or [] when CHANGELOG.md changed or none is user-facing. */
export function missingEntries(commits, changedFiles) {
  if (changedFiles.includes('CHANGELOG.md')) return [];
  return commits.filter((c) => USER_FACING.test(c.subject));
}

export function message(missing) {
  const list = missing.map((c) => `${c.sha.slice(0, 8)} ${c.subject}`).join('; ');
  return `CHANGELOG.md has no entry for: ${list}. Rule: every feat/fix branch adds one or two plain user-facing bullets under today's "## YYYY-MM-DD" heading in CHANGELOG.md (docs/DEPLOYMENT.md).`;
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function main() {
  let base;
  for (const ref of ['github/main', 'origin/main']) {
    try {
      base = git('merge-base', ref, 'HEAD');
      break;
    } catch {}
  }
  if (!base) return console.log('changelog: no main ref to compare with, skipped');
  const commits = git('log', '--no-merges', '--format=%H%x09%s', `${base}..HEAD`)
    .split('\n').filter(Boolean).map((l) => ({ sha: l.split('\t')[0], subject: l.split('\t').slice(1).join('\t') }));
  const files = git('diff', '--name-only', base, 'HEAD').split('\n');
  const missing = missingEntries(commits, files);
  if (missing.length) {
    console.log(message(missing));
    process.exit(1);
  }
  console.log('changelog: OK');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
