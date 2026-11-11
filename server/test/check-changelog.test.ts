import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { message, missingEntries } from '../../scripts/check-changelog.mjs';

const c = (subject: string) => ({ sha: 'abcdef123456', subject });

describe('changelog gate', () => {
  it('asks for an entry when a feat or fix commit has no CHANGELOG change', () => {
    const bad = [c('feat(web): a thing (Fixes #1)'), c('fix!: x'), c('test: y')];
    expect(missingEntries(bad, ['web/a.ts']).map((x: { subject: string }) => x.subject)).toEqual([
      'feat(web): a thing (Fixes #1)',
      'fix!: x',
    ]);
  });
  it('passes when CHANGELOG.md changed', () => {
    expect(missingEntries([c('fix: a')], ['CHANGELOG.md'])).toEqual([]);
  });
  it('passes for test/ci/chore/docs/refactor/spec only and for no commits', () => {
    const ok = ['test: a', 'ci: b', 'chore: c', 'docs: d', 'refactor: e', 'spec: f', 'feature flag docs'].map(c);
    expect(missingEntries(ok, ['x'])).toEqual([]);
    expect(missingEntries([], [''])).toEqual([]);
  });
  it('prints one line naming the commits and the rule', () => {
    const m = message([c('fix: a')]);
    expect(m).toContain('abcdef12 fix: a');
    expect(m).not.toContain('\n');
  });
});
