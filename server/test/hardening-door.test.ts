/** Pre-public hardening (AUDIT L-1, L-2, PENTEST F2): the door's rate limit, key length and allow-list check. */
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { setDiagSink } from '../src/lib/diag.js';
import { makeApp, type TestApp } from './helpers.js';

const KEY = 'door-test-key-0123456789abcdef0123456789abcdef';

describe('L-2 door key length', () => {
  it('keeps the door off (and says so) for a key shorter than 32 characters', () => {
    const lines: string[] = [];
    const undo = setDiagSink((l) => lines.push(l));
    try {
      expect(loadConfig({ DOOR_API_TOKEN: 'short-key', DOOR_PERSON: 'a@example.com' }).door.token).toBeNull();
      expect(lines.join('\n')).toContain('door_key_too_short');
      expect(loadConfig({ DOOR_API_TOKEN: KEY }).door.token).toBe(KEY);
    } finally { undo(); }
  });
});

describe('F2 / L-2 door rate limit', () => {
  let t: TestApp;
  afterEach(() => t.cleanup());
  const ask = (headers: Record<string, string>) => t.req('GET', '/api/door', undefined, { authorization: 'Bearer wrong', ...headers });
  const statuses = async (n: number, header: (i: number) => Record<string, string>) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push((await ask(header(i))).status);
    return out;
  };

  it('ignores X-Forwarded-For unless the server sits behind a trusted proxy', async () => {
    t = makeApp({ DOOR_API_TOKEN: KEY });
    const got = await statuses(70, (i) => ({ 'x-forwarded-for': `10.0.0.${i}` }));
    expect(got.filter((s) => s === 429).length).toBe(10);
  });

  it('behind a trusted proxy the last hop is the client, so rotating the first entry does not help', async () => {
    t = makeApp({ DOOR_API_TOKEN: KEY, TRUST_PROXY: '1' });
    const got = await statuses(70, (i) => ({ 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` }));
    expect(got.filter((s) => s === 429).length).toBe(10);
    // another real client (a different last hop) has its own budget
    expect((await ask({ 'x-forwarded-for': '203.0.113.8' })).status).toBe(401);
  });

  it('a flood of distinct clients does not reset the counter of one that is over its limit', async () => {
    t = makeApp({ DOOR_API_TOKEN: KEY, TRUST_PROXY: '1' });
    await statuses(61, () => ({ 'x-forwarded-for': '198.51.100.1' }));
    await statuses(1100, (i) => ({ 'x-forwarded-for': `192.0.2.${i % 250}.${i}` }));
    expect((await ask({ 'x-forwarded-for': '198.51.100.1' })).status).toBe(429);
  });
});

describe('L-1 door person removed from the allow-list', () => {
  let t: TestApp;
  afterEach(() => t.cleanup());

  it('answers 503 once the door person is no longer allowed', async () => {
    t = makeApp();
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
    await t.json('POST', '/api/__test/door', { token: KEY, person: 'jo@example.com' });
    const ask = () => t.req('GET', '/api/door', undefined, { authorization: `Bearer ${KEY}` });
    expect((await ask()).status).toBe(200);
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['anna@example.com'] });
    expect((await ask()).status).toBe(503);
  });
});
