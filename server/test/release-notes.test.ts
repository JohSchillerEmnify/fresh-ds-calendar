/** Release notes: CHANGELOG.md parser and the /api/release-notes routes. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadReleaseNotes, parseReleaseNotes } from '../src/services/releaseNotes.js';
import { makeApp, type TestApp } from './helpers.js';

describe('parseReleaseNotes', () => {
  const md = `# Changelog

## 2026-10-13

- Older day line.

## 2026-10-14

- First line of today.
- Second line
  continued here.

## Older history

## 2026-10-01

- Must be ignored.
`;

  it('reads dated sections newest first, joins multi-line bullets and stops at Older history', () => {
    const notes = parseReleaseNotes(md);
    expect(notes.map((n) => [n.date, n.text])).toEqual([
      ['2026-10-14', 'First line of today.'],
      ['2026-10-14', 'Second line continued here.'],
      ['2026-10-13', 'Older day line.'],
    ]);
  });

  it('gives stable short ids from date and text', () => {
    const a = parseReleaseNotes(md);
    expect(a[0]!.id).toMatch(/^[0-9a-f]{8}$/);
    expect(parseReleaseNotes(md)).toEqual(a);
    expect(new Set(a.map((n) => n.id)).size).toBe(3);
  });

  it('caps at 50 notes', () => {
    const many = `## 2026-10-14\n${Array.from({ length: 60 }, (_, i) => `- note ${i}`).join('\n')}\n`;
    expect(parseReleaseNotes(many)).toHaveLength(50);
  });

  it('returns nothing for garbled or empty input', () => {
    expect(parseReleaseNotes('')).toEqual([]);
    expect(parseReleaseNotes('## not a date\n- x\n- y')).toEqual([]);
    expect(parseReleaseNotes('- bullet before any heading')).toEqual([]);
  });

  it('returns an empty list for a missing file', () => {
    expect(loadReleaseNotes(path.join(os.tmpdir(), 'cal-nope', 'CHANGELOG.md'))).toEqual([]);
  });
});

describe('/api/release-notes', () => {
  let t: TestApp;
  afterEach(() => t?.cleanup());

  it('serves the parsed CHANGELOG and TEST_MODE can replace and reset the list', async () => {
    t = makeApp();
    const file = path.join(t.dir, 'CHANGELOG.md');
    fs.writeFileSync(file, '## 2026-10-14\n\n- From file.\n');
    const other = makeApp({ CHANGELOG_PATH: file });
    t.cleanup();
    t = other;
    expect((await t.json('GET', '/api/release-notes')).body.notes.map((n: { text: string }) => n.text)).toEqual(['From file.']);
    const set = await t.json('POST', '/api/__test/release-notes', { notes: [{ date: '2026-10-13', text: 'Injected.' }] });
    expect(set.status).toBe(200);
    const got = (await t.json('GET', '/api/release-notes')).body.notes;
    expect(got).toMatchObject([{ date: '2026-10-13', text: 'Injected.' }]);
    expect(got[0].id).toMatch(/^[0-9a-f]{8}$/);
    await t.json('POST', '/api/__test/reset', {});
    expect((await t.json('GET', '/api/release-notes')).body.notes).toHaveLength(1);
  });
});
