import { OAuth2Client } from 'google-auth-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setDiagSink, subHash } from '../src/lib/diag.js';
import { GoogleProvider, makeApi } from '../src/providers/google/GoogleProvider.js';
import { ProviderUnavailableError } from '../src/providers/CalendarProvider.js';
import { makeApp } from './helpers.js';

let lines: Record<string, unknown>[] = [];
let raw: string[] = [];
let restore: () => void;
beforeEach(() => {
  lines = [];
  raw = [];
  restore = setDiagSink((l) => { raw.push(l); lines.push(JSON.parse(l)); });
});
afterEach(() => restore());

const SUB = 'google-sub-1234567890';
const TOKEN = 'secret-access-token';

function provider(fetchImpl: typeof fetch) {
  const auth = new OAuth2Client({ clientId: 'id', clientSecret: 'secret' });
  auth.setCredentials({ access_token: TOKEN, expiry_date: Date.now() + 3_600_000 });
  return new GoogleProvider({ api: makeApi(auth, fetchImpl), sub: SUB });
}
const reply = (status: number, json: unknown) => (async () => new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

describe('google_error log line', () => {
  it('logs a 429 with its Google reason and keeps the 503 mapping (plus one rate_limited start line)', async () => {
    const p = provider(reply(429, { error: { code: 429, message: 'Quota for Dentist exceeded', errors: [{ reason: 'rateLimitExceeded', message: 'Dentist' }] } }));
    await expect(p.listEvents({ calendarId: 'primary', timeMin: 'a', timeMax: 'b' })).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ event: 'google_error', op: 'events.list', status: 429, reason: 'rateLimitExceeded', subHash: subHash(SUB) });
    expect(lines[1]).toMatchObject({ event: 'rate_limited', state: 'start', op: 'events.list', subHash: subHash(SUB) });
    expect(typeof lines[0]!.durationMs).toBe('number');
    expect(typeof lines[0]!.ts).toBe('string');
  });

  it('logs a 500 for calendarList.list', async () => {
    const p = provider(reply(500, { error: { code: 500, message: 'x', errors: [{ reason: 'backendError' }] } }));
    await expect(p.listCalendars()).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(lines[0]).toMatchObject({ event: 'google_error', op: 'calendarList.list', status: 500, reason: 'backendError' });
  });

  it('logs a network error by its code', async () => {
    const down = (async () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) }); }) as unknown as typeof fetch;
    await expect(provider(down).getEvent('primary', 'e1')).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(lines[0]).toMatchObject({ event: 'google_error', op: 'events.get', code: 'ECONNRESET' });
    expect(lines[0]!.retry).toBeGreaterThan(0);
    expect(lines[0]!.status).toBeUndefined();
  }, 20_000); // the Google client retries network errors with a back-off before giving up

  it('never writes the sub, tokens, titles or message text', async () => {
    const p = provider(reply(403, { error: { code: 403, message: 'Event "Dentist" for jo@example.com', errors: [{ reason: 'forbidden', message: 'Dentist jo@example.com' }] } }));
    await expect(p.insertEvent('primary', { summary: 'Dentist', start: { date: '2026-10-12' }, end: { date: '2026-10-13' } })).rejects.toBeInstanceOf(ProviderUnavailableError);
    const text = raw.join('\n');
    for (const secret of [SUB, TOKEN, 'Dentist', 'jo@example.com', 'secret']) expect(text).not.toContain(secret);
    expect(Object.keys(lines[0]!).sort()).toEqual(['durationMs', 'event', 'op', 'reason', 'retry', 'status', 'subHash', 'ts']);
  });

  it('does not log a successful call', async () => {
    await provider(reply(200, { items: [] })).listCalendars();
    expect(lines).toEqual([]);
  });
});

describe('api_unavailable log line', () => {
  it('logs the route, status and duration of a 503 response', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/outage', { down: true, status: 503 });
      lines.length = 0;
      const r = await t.req('GET', '/api/items?from=2026-10-12&to=2026-10-19');
      expect(r.status).toBe(503);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ event: 'api_unavailable', route: 'GET /api/items', status: 503, cause: 'ProviderUnavailableError' });
      expect(typeof lines[0]!.durationMs).toBe('number');
    } finally { t.cleanup(); }
  });

  it('logs nothing for responses below 500', async () => {
    const t = makeApp();
    try {
      await t.req('GET', '/api/nope');
      await t.req('GET', '/api/items?from=bad&to=bad');
      expect(lines).toEqual([]);
    } finally { t.cleanup(); }
  });
});

describe('POST /api/diag/sync-error', () => {
  const beacon = { kind: 'http', status: 503, task: 'items', online: true, resumed: false, app: false };

  it('logs a valid beacon as client_sync_error and answers 204', async () => {
    const t = makeApp();
    try {
      const r = await t.req('POST', '/api/diag/sync-error', beacon);
      expect(r.status).toBe(204);
      expect(lines).toEqual([expect.objectContaining({ event: 'client_sync_error', ...beacon })]);
    } finally { t.cleanup(); }
  });

  it('refuses invalid, unknown-field and oversized bodies', async () => {
    const t = makeApp();
    try {
      for (const bad of [{ ...beacon, kind: 'weird' }, { ...beacon, task: 'a b' }, { ...beacon, status: 99 }, { ...beacon, online: 'yes' }, { ...beacon, email: 'jo@example.com' }, { kind: 'network' }, { ...beacon, task: 'x'.repeat(2000) }]) {
        expect((await t.req('POST', '/api/diag/sync-error', bad)).status).toBe(400);
      }
      expect((await t.req('POST', '/api/diag/sync-error', undefined)).status).toBe(400);
      expect(lines).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('allows one beacon per client per minute, a different client or a minute later is fine', async () => {
    const t = makeApp();
    try {
      let now = 1_000_000;
      t.app.ctx.clock.real = () => now;
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
      const signIn = async (email: string) => {
        await t.json('POST', '/api/__test/oauth/account', { email });
        const start = await t.req('GET', '/api/auth/google/start');
        const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
        const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
        const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
        return cb.headers.getSetCookie().find((c) => c.startsWith('cal_session='))!.split(';')[0]!;
      };
      const jo = await signIn('jo@example.com');
      const anna = await signIn('anna@example.com');
      const send = async (cookie: string) => (await t.req('POST', '/api/diag/sync-error', beacon, { cookie })).status;
      lines.length = 0;
      expect(await send(jo)).toBe(204);
      expect(await send(jo)).toBe(429);
      expect(await send(anna)).toBe(204);
      now += 59_000;
      expect(await send(jo)).toBe(429);
      now += 2_000;
      expect(await send(jo)).toBe(204);
      expect(lines.filter((l) => l.event === 'client_sync_error')).toHaveLength(3);
      expect(raw.join('\n')).not.toContain('example.com');
    } finally { t.cleanup(); }
  });

  it('needs a session while sign-in is on', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const r = await t.json('POST', '/api/diag/sync-error', beacon);
      expect(r.status).toBe(401);
      expect(lines.filter((l) => l.event === 'client_sync_error')).toEqual([]);
    } finally { t.cleanup(); }
  });
});
