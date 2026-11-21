import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { globRegex, loadMap, ruleFor, stepRanges, touchesDef, unmappedFiles } from '../../scripts/affected-map.mjs';

const root = resolve(__dirname, '../..');
const affected = (...changed: string[]) =>
  execFileSync('node', ['scripts/e2e-affected.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, E2E_AFFECTED_FILES: changed.join('\n') } });
const rules = loadMap(root);
const files = execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', 'web/src', 'server/src', 'shared'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const specTags = new Set(
  execFileSync('git', ['ls-files', 'spec/features'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .flatMap((f) => readFileSync(resolve(root, f), 'utf8').match(/@[\w:-]+/g) ?? []),
);

describe('e2e affected map', () => {
  it('matches ** across folders and * within one', () => {
    expect(globRegex('a/**').test('a/b/c.ts')).toBe(true);
    expect(globRegex('a/*.ts').test('a/b/c.ts')).toBe(false);
    expect(globRegex('a/*.ts').test('a/c.ts')).toBe(true);
  });

  it('reports a source file that no rule covers', () => {
    expect(unmappedFiles(rules, ['server/src/services/brandNewThing.ts', 'docs/x.md'])).toEqual(['server/src/services/brandNewThing.ts']);
  });

  it('maps every web/src, server/src and shared file, or marks it "no e2e"', () => {
    expect(unmappedFiles(rules, files)).toEqual([]);
  });

  it('only selects tags that exist in the spec', () => {
    const bad = rules.flatMap((r: { select?: string[] }) => (r.select ?? []).filter((s) => s !== 'heuristic' && !specTags.has(s)));
    expect(bad).toEqual([]);
  });

  it('has no rule that matches no file', () => {
    const dead = rules.filter((r: { res: RegExp[] }) => !files.some((f) => r.res.some((re) => re.test(f)))).map((r: { paths: string[] }) => r.paths[0]);
    expect(dead).toEqual([]);
  });

  it('gives every no-e2e entry a reason', () => {
    expect(rules.filter((r: { noE2e: boolean; why?: string }) => r.noE2e && !r.why)).toEqual([]);
  });

  it('finds the rule of a file', () => {
    expect(ruleFor(rules, 'server/src/services/templateStore.ts').select).toEqual(['@id:tasklist-templates']);
  });

  it.concurrent.each([
    'server/src/lib/secretBox.ts',
    'web/src/native/apkHint.ts',
    'web/index.html',
    'Dockerfile',
  ])('a change to %s selects at least one runnable scenario', (file) => {
    expect(affected(file)).toMatch(/^--grep .*\(\d+ of \d+ runnable scenarios/);
  });

  it('selects nothing for a file no scenario can show', () => {
    expect(affected('web/test/tasklists.test.ts').trim()).toBe('none');
  });

  it('credits a helper between step definitions to every definition of the file', () => {
    const lines = readFileSync(resolve(root, 'e2e/steps/tasklists.steps.ts'), 'utf8').split('\n');
    const ranges = stepRanges(lines);
    const helper = lines.findIndex((l) => l.startsWith('const itemLine'));
    expect(ranges.every((r: { start: number; end: number }) => helper < r.start || helper >= r.end)).toBe(true);
    expect(ranges.every((_: unknown, k: number) => touchesDef([[helper, helper + 1]], ranges, k))).toBe(true);
    expect(touchesDef([[ranges[1].start, ranges[1].start + 1]], ranges, 0)).toBe(false);
  });
});
