/** Pre-public hardening (AUDIT M-1): a corrupt or crafted shared-list file never breaks other people's lists. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PeopleStore } from '../src/auth/peopleStore.js';
import { Clock } from '../src/lib/clock.js';
import { setDiagSink } from '../src/lib/diag.js';
import { SharedListService, isSharedListDoc } from '../src/services/sharedLists.js';
import { registerSharedListsBackup } from '../src/services/sharedListsBackup.js';

const good = (id: string, owner: string, extra: object = {}) => ({
  version: 1, id, rev: 1, owner, members: [], updated: '2026-10-12T08:00:00+02:00',
  data: { title: 'T', items: [], tags: [], categoryId: null }, category: null, ...extra,
});
const bad: [string, object][] = [
  ['members null', good('x', 'me', { members: null })],
  ['members a string', good('x', 'me', { members: 'victim' })],
  ['members with a non-string', good('x', 'me', { members: [1] })],
  ['owner missing', good('x', '', {})],
  ['rev not a number', good('x', 'me', { rev: '1' })],
  ['data missing', good('x', 'me', { data: undefined })],
  ['items not an array', good('x', 'me', { data: { title: 'T', items: 'no' } })],
  ['wrong version', good('x', 'me', { version: 2 })],
];

describe('isSharedListDoc', () => {
  it('accepts a well-formed document', () => expect(isSharedListDoc(good('x', 'me', { members: ['a'] }))).toBe(true));
  it.each(bad)('rejects %s', (_n, doc) => expect(isSharedListDoc(doc)).toBe(false));
  it('rejects non-objects', () => { for (const v of [null, 1, 'x', []]) expect(isSharedListDoc(v)).toBe(false); });
});

describe('shared list store with a corrupt file on disk', () => {
  let dir: string;
  let lines: string[];
  let restore: () => void;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-hard-')); lines = []; restore = setDiagSink((l) => lines.push(l)); });
  afterEach(() => { restore(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('skips (and logs) invalid files so every other list still loads', () => {
    const lists = path.join(dir, 'shared', 'lists');
    fs.mkdirSync(lists, { recursive: true });
    fs.writeFileSync(path.join(lists, 'bad.json'), JSON.stringify(good('bad', 'me', { members: null })));
    fs.writeFileSync(path.join(lists, 'ok.json'), JSON.stringify(good('ok', 'me', { members: ['you'] })));
    const svc = new SharedListService(dir, new PeopleStore(dir), new Clock(), 'Europe/Berlin', () => null);
    expect(svc.visibleTo('you').map((d) => d.id)).toEqual(['ok']);
    expect(svc.visibleTo('me').map((d) => d.id)).toEqual(['ok']);
    expect(lines.join('\n')).toContain('shared_list_skipped');
  });
});

describe('backup restore of shared lists', () => {
  let dir: string;
  let lines: string[];
  let undo: () => void;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-hard-')); lines = []; undo = setDiagSink((l) => lines.push(l)); });
  afterEach(() => { undo(); fs.rmSync(dir, { recursive: true, force: true }); });
  const source = () => {
    let src: { restore?: (sub: string, files: Record<string, string>) => void } | undefined;
    registerSharedListsBackup({ registerSource: (s: never) => { src = s; } } as never, { reload() { /* not needed */ } } as never, dir);
    return src!;
  };

  it('writes a valid list and skips (and logs) invalid ones', () => {
    const files: Record<string, string> = { 'shared/lists/ok.json': JSON.stringify(good('ok', 'me')) };
    for (const [i, [, doc]] of bad.entries()) {
      const id = `b${i}`;
      files[`shared/lists/${id}.json`] = JSON.stringify({ ...doc, id, owner: (doc as { owner: string }).owner ? 'me' : '' });
    }
    source().restore!('me', files);
    expect(fs.readdirSync(path.join(dir, 'shared', 'lists'))).toEqual(['ok.json']);
    expect(lines.join('\n')).toContain('shared_list_restore_skipped');
  });
});
