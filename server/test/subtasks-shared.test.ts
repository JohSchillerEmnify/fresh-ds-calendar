/** A shared list stored with a done task over an open subtask reads as open (feature tasklist-subtasks). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { makeApp, sessionCookie } from './helpers.js';

const JO = 'jo@example.com';

describe('shared lists and subtasks', () => {
  it('reads a done task over an open subtask as open, with counts that follow, without writing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sub-'));
    const file = path.join(dir, 'shared', 'lists', 'old.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const items = [{ id: 'a', title: 'Order', done: false }, { id: 'b', title: 'Tidy up', done: true }, { id: 'c', title: 'Fold clothes', done: false, level: 1 }];
    const doc = {
      version: 1, id: 'old', rev: 1, owner: mockSub(JO), members: [], updated: '2026-10-12T08:00:00+02:00', category: null,
      data: { title: 'Camping', date: null, time: null, items, categoryId: null, tags: [], estimateMinutes: null, recurrence: null, completedOn: null, canvas: null },
    };
    fs.writeFileSync(file, JSON.stringify(doc));
    const t = makeApp({ DATA_DIR: dir });
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: [JO] });
      const cookie = await sessionCookie(t, JO);
      const r = await t.json('GET', '/api/tasklists/all-open?today=2026-10-12', undefined, { cookie });
      const list = r.body.items.find((l: { title: string }) => l.title === 'Camping');
      expect(list.items.map((i: { done: boolean }) => i.done)).toEqual([false, false, false]);
      expect(list.doneCount).toBe(0);
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).data.items[1].done).toBe(true);
    } finally { t.cleanup(); }
  });
});
