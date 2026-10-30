/** Pre-public hardening (PENTEST F1): inherited object keys in a session cookie are never a session. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SESSION_ABSOLUTE_MAX_MS, SESSION_TTL_MS, SessionStore } from '../src/auth/sessions.js';
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

  it('stores only sha256(id) as the key, read back after a restart', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sess-'));
    try {
      const file = path.join(dir, 'sessions.json');
      const a = new SessionStore(file, () => 1000);
      const id = a.create({ sub: 'u1', email: 'a@example.com' });
      const onDisk = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, { sub: string; expiresAt: number }>;
      const h = createHash('sha256').update(id).digest('hex');
      expect(Object.keys(onDisk)).toEqual([h]);
      expect(fs.readFileSync(file, 'utf8')).not.toContain(id);
      expect(onDisk[h]!.sub).toBe('u1');
      expect(new SessionStore(file, () => 2000).get(id)?.session.sub).toBe('u1');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('session ids at rest', () => {
  it('hashes legacy raw-id entries in place, so nobody is signed out', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sess-'));
    try {
      const file = path.join(dir, 'sessions.json');
      fs.writeFileSync(file, JSON.stringify({ rawIdValue: { sub: 'u1', email: 'a@example.com', expiresAt: 5000 } }));
      const s = new SessionStore(file, () => 1000);
      expect(s.get('rawIdValue')?.session.sub).toBe('u1');
      const onDisk = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      expect(Object.keys(onDisk)).toEqual([createHash('sha256').update('rawIdValue').digest('hex')]);
      expect(new SessionStore(file, () => 1000).get('rawIdValue')?.session.sub).toBe('u1');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ends a session at the absolute cap even when it is used every day', () => {
    let now = 0;
    const s = new SessionStore(null, () => now);
    const id = s.create({ sub: 'u1', email: 'a@example.com' });
    for (now = 0; now < SESSION_ABSOLUTE_MAX_MS; now += SESSION_TTL_MS / 2) expect(s.get(id)).not.toBeNull();
    now = SESSION_ABSOLUTE_MAX_MS + 1;
    expect(s.get(id)).toBeNull();
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
