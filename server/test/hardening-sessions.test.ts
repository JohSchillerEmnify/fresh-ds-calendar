/** Pre-public hardening (PENTEST F1): inherited object keys in a session cookie are never a session. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionStore } from '../src/auth/sessions.js';
import { makeApp, type TestApp } from './helpers.js';

const KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

describe('F1 session store: prototype keys', () => {
  it('get and delete treat inherited keys as no session', () => {
    const s = new SessionStore(null, () => 1000);
    for (const k of KEYS) {
      expect(s.get(k)).toBeNull();
      s.delete(k);
    }
  });

  it('keeps the file format: a plain id -> session object, read back after a restart', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sess-'));
    try {
      const file = path.join(dir, 'sessions.json');
      const a = new SessionStore(file, () => 1000);
      const id = a.create({ sub: 'u1', email: 'a@example.com' });
      const onDisk = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, { sub: string; expiresAt: number }>;
      expect(Object.keys(onDisk)).toEqual([id]);
      expect(onDisk[id]!.sub).toBe('u1');
      expect(new SessionStore(file, () => 2000).get(id)?.session.sub).toBe('u1');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('F1 API: a prototype-key cookie is a plain 401', () => {
  let t: TestApp;
  afterEach(() => t.cleanup());

  it.each(KEYS)('cal_session=%s answers 401, not 500', async (k) => {
    t = makeApp();
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
    const r = await t.req('GET', '/api/auth/me', undefined, { cookie: `cal_session=${k}` });
    expect(r.status).toBe(401);
    const r2 = await t.req('GET', '/api/items', undefined, { cookie: `cal_session=${k}` });
    expect(r2.status).toBe(401);
  });
});

describe('F1 other plain-object lookups keyed by request input', () => {
  it('PeopleStore.get and SharedListService.ruleFor ignore inherited keys', async () => {
    const { PeopleStore } = await import('../src/auth/peopleStore.js');
    const { SharedListService } = await import('../src/services/sharedLists.js');
    const { Clock } = await import('../src/lib/clock.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-people-'));
    try {
      const people = new PeopleStore(dir);
      for (const k of KEYS) expect(people.get(k)).toBeNull();
      const shared = new SharedListService(dir, people, new Clock(), 'Europe/Berlin', () => null);
      for (const k of KEYS) {
        expect(shared.ruleFor(k, 'cat')).toBeNull();
        expect(shared.ruleFor('owner', k)).toBeNull();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
