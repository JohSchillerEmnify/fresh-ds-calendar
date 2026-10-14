import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RateLimitedError } from '../src/providers/CalendarProvider.js';
import { GoogleProvider, makeApi } from '../src/providers/google/GoogleProvider.js';
import { setDiagSink } from '../src/lib/diag.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

interface Reply { status?: number; json?: unknown; headers?: Record<string, string> }
const limit = (headers?: Record<string, string>): Reply => ({ status: 403, json: { error: { code: 403, errors: [{ reason: 'rateLimitExceeded' }], status: 'PERMISSION_DENIED' } }, headers });
const gev = (id: string) => ({ id, etag: '"e"', status: 'confirmed', summary: id, start: { date: '2026-10-12' }, end: { date: '2026-10-13' }, created: '', updated: '' });

let clock = 0;
let lines: Record<string, unknown>[] = [];
let restore: () => void;
beforeEach(() => { clock = 1_000_000; lines = []; restore = setDiagSink((l) => lines.push(JSON.parse(l))); });
afterEach(() => restore());

function setup(handler: (url: URL, method: string) => Reply | Promise<Reply>) {
  const calls: { url: URL; method: string }[] = [];
  const fetchImpl = (async (input: any, init?: any) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input?.url ?? input));
    const method = req ? req.method : init?.method ?? 'GET';
    calls.push({ url, method });
    const r = await handler(url, method);
    return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json', ...r.headers } });
  }) as typeof fetch;
  const auth = new OAuth2Client({ clientId: 'id', clientSecret: 'secret' });
  auth.setCredentials({ access_token: 'tok', expiry_date: Date.now() + 3_600_000 });
  const provider = new GoogleProvider({ api: makeApi(auth, fetchImpl), sub: 'person', guard: { now: () => clock } });
  return { provider, calls };
}
const list = { calendarId: 'primary', timeMin: '2026-10-12T00:00:00+02:00', timeMax: '2026-10-13T00:00:00+02:00' };

describe('Google read cache', () => {
  it('serves a repeated events.list from the cache and shares concurrent identical calls', async () => {
    const { provider, calls } = setup(() => ({ json: { items: [gev('a')] } }));
    const [a, b, c] = await Promise.all([provider.listEvents(list), provider.listEvents(list), provider.listEvents(list)]);
    expect(calls).toHaveLength(1);
    expect(a.items[0]!.id).toBe('a');
    expect(b).toEqual(a);
    expect(c).not.toBe(a); // every caller gets its own copy
    clock += 24_000;
    await provider.listEvents(list);
    expect(calls).toHaveLength(1);
    clock += 2_000; // past the 25 s TTL
    await provider.listEvents(list);
    expect(calls).toHaveLength(2);
  });

  it('keys by calendar and range, and caches calendarList.list', async () => {
    const { provider, calls } = setup((u) => ({ json: u.pathname.endsWith('/users/me/calendarList') ? { items: [{ id: 'primary', primary: true }] } : { items: [] } }));
    await provider.listEvents(list);
    await provider.listEvents({ ...list, calendarId: 'other' });
    await provider.listEvents({ ...list, timeMax: '2026-10-14T00:00:00+02:00' });
    expect(calls).toHaveLength(3);
    await provider.listCalendars();
    await provider.listCalendars();
    expect(calls).toHaveLength(4);
  });

  it('a write makes cached reads stale at once; a read that was in flight during the write is not kept as fresh', async () => {
    let n = 0;
    const { provider, calls } = setup((u, m) => (m === 'GET' ? { json: { items: [gev(`v${++n}`)] } } : { json: gev('w') }));
    expect((await provider.listEvents(list)).items[0]!.id).toBe('v1');
    await provider.insertEvent('primary', { start: { date: '2026-10-12' }, end: { date: '2026-10-13' } });
    expect((await provider.listEvents(list)).items[0]!.id).toBe('v2');
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
  });
});

describe('Google rate-limit cooldown', () => {
  it('enters a cooldown on rateLimitExceeded, makes no Google call during it, serves cached data, logs start and end once', async () => {
    let limited = false;
    const { provider, calls } = setup(() => (limited ? limit() : { json: { items: [gev('a')] } }));
    await provider.listEvents(list);
    clock += 30_000; // cache no longer fresh
    limited = true;
    const stale = await provider.listEvents(list); // 403 -> cooldown -> last known data
    expect(stale.items[0]!.id).toBe('a');
    expect(provider.cooldownMs()).toBe(5_000);
    const n = calls.length;
    await provider.listEvents(list);
    await provider.listEvents(list);
    await expect(provider.listEvents({ ...list, calendarId: 'nodata' })).rejects.toBeInstanceOf(RateLimitedError);
    await expect(provider.insertEvent('primary', { start: { date: '2026-10-12' }, end: { date: '2026-10-13' } })).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(n);
    clock += 5_001;
    limited = false;
    await provider.listEvents(list);
    expect(provider.cooldownMs()).toBe(0);
    expect(lines.filter((l) => l.event === 'rate_limited').map((l) => l.state)).toEqual(['start', 'end']);
  });

  it('without any data the error carries the seconds to wait', async () => {
    const { provider } = setup(() => limit());
    const e = await provider.listEvents(list).catch((x) => x);
    expect(e).toBeInstanceOf(RateLimitedError);
    expect(e.retryAfterSec).toBe(5);
  });

  it('backs off exponentially for consecutive failures, capped at 2 minutes, and resets after a success', async () => {
    let limited = true;
    const { provider } = setup(() => (limited ? limit() : { json: { items: [] } }));
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      await provider.listEvents(list).catch(() => undefined);
      waits.push(provider.cooldownMs() / 1000);
      clock += provider.cooldownMs() + 1;
    }
    expect(waits).toEqual([5, 10, 20, 40, 80, 120, 120]);
    limited = false;
    await provider.listEvents(list);
    limited = true;
    clock += 30_000;
    await provider.listEvents(list).catch(() => undefined);
    expect(provider.cooldownMs()).toBe(5_000);
  });

  it('honours Retry-After, and concurrent failures start one cooldown, not several', async () => {
    const { provider } = setup(() => limit({ 'Retry-After': '37' }));
    const rs = await Promise.allSettled([provider.listEvents(list), provider.listEvents({ ...list, calendarId: 'b' }), provider.listCalendars()]);
    expect(rs.every((r) => r.status === 'rejected')).toBe(true);
    expect(provider.cooldownMs()).toBe(37_000);
    expect(lines.filter((l) => l.event === 'rate_limited' && l.state === 'start')).toHaveLength(1);
  });

  it('treats 429 as a rate limit; an ordinary 403 (sharing) is not', async () => {
    const a = setup(() => ({ status: 429, json: { error: { code: 429 } } }));
    await a.provider.listEvents(list).catch(() => undefined);
    expect(a.provider.cooldownMs()).toBeGreaterThan(0);
    const b = setup(() => ({ status: 403, json: { error: { code: 403, errors: [{ reason: 'forbidden' }] } } }));
    await b.provider.listEvents(list).catch(() => undefined);
    expect(b.provider.cooldownMs()).toBe(0);
  });
});

describe('API under a Google rate limit', () => {
  it('answers 503 RATE_LIMITED with Retry-After without data, then 200 with stale: true from the cache', async () => {
    let limited = false;
    const { provider } = setup((u) => {
      if (limited) return limit();
      return { json: u.pathname.endsWith('/users/me/calendarList') ? { items: [{ id: 'primary', primary: true, accessRole: 'owner' }, { id: 't', summary: 'Calendar app: tasks', accessRole: 'owner', hidden: true }] } : { items: [gev('a')] } };
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-rl-'));
    const app = buildApp({ ...loadConfig({ DATA_DIR: dir, PROVIDER: 'google' }), webDist: null }, { provider });
    app.ctx.auth.on = false;
    try {
      const url = '/api/items?from=2026-10-12&to=2026-10-13';
      const ok = await app.request(url);
      expect(ok.status).toBe(200);
      expect((await ok.json()).stale).toBeUndefined();
      expect(ok.headers.get('x-stale')).toBeNull();
      clock += 30_000;
      limited = true;
      const stale = await app.request(url);
      expect(stale.status).toBe(200);
      expect((await stale.json()).stale).toBe(true);
      expect(stale.headers.get('x-stale')).toBe('1');
      const none = await app.request('/api/items?from=2026-11-01&to=2026-11-02');
      expect(none.status).toBe(503);
      expect((await none.json()).error.code).toBe('RATE_LIMITED');
      expect(Number(none.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(lines.filter((l) => l.event === 'api_unavailable')).toHaveLength(0);
    } finally { app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
