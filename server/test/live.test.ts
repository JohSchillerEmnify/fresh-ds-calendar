/** Live updates (ADR 0030): the stream, who it reaches, and the Google poller that runs while an app is open. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { GooglePoller } from '../src/services/googlePoller.js';
import { loadConfig } from '../src/config.js';
import { RateLimitedError } from '../src/providers/CalendarProvider.js';
import { HEARTBEAT_MS } from '../src/api/liveRoutes.js';
import { LOCAL_PERSON } from '../src/services/prefsStore.js';
import { makeApp, sessionCookie, type TestApp } from './helpers.js';

/** An open stream read in the test: what has arrived so far, and whether the server ended it. */
async function open(t: TestApp, cookie?: string) {
  const res = await t.req('GET', '/api/events/stream', undefined, cookie ? { cookie } : {});
  if (res.status !== 200) return { res, text: () => '', ended: () => false, cancel: async () => undefined, next: async () => '' };
  const reader = res.body!.getReader();
  let text = '';
  let ended = false;
  const dec = new TextDecoder();
  void (async () => {
    for (;;) {
      const r = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (r.done) { ended = true; return; }
      text += dec.decode(r.value);
    }
  })();
  const until = async (pred: () => boolean) => { for (let i = 0; i < 200 && !pred(); i++) await new Promise((r) => setTimeout(r, 10)); };
  await until(() => text.includes(': connected'));
  return { res, text: () => text, ended: () => ended, until, cancel: () => reader.cancel() };
}

describe('GET /api/events/stream', () => {
  let t: TestApp;
  beforeEach(() => { t = makeApp(); });
  afterEach(() => t.cleanup());

  it('is an event stream that keeps alive and nudges with the kind only', async () => {
    const s = await open(t);
    expect(s.res.headers.get('content-type')).toContain('text/event-stream');
    expect(HEARTBEAT_MS).toBe(25_000);
    await t.json('PATCH', '/api/prefs', { labs: true });
    await s.until!(() => s.text().includes('event: changed'));
    expect(s.text()).toContain('event: changed\ndata: prefs\n');
    await s.cancel();
  });

  it('needs a session while sign-in is on, and reaches only that person', async () => {
    const JO = 'jo@example.com', ANNA = 'anna@example.com';
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
    expect((await open(t)).res.status).toBe(401);
    const jo = await sessionCookie(t, JO), anna = await sessionCookie(t, ANNA);
    const sJo = await open(t, jo), sAnna = await open(t, anna);
    await t.json('POST', '/api/events', { title: 'Dentist', allDay: false, start: '2026-10-13T10:00:00+02:00', end: '2026-10-13T11:00:00+02:00' }, { cookie: jo });
    await sJo.until!(() => sJo.text().includes('event: changed'));
    await new Promise((r) => setTimeout(r, 100));
    expect(sJo.text()).toContain('data: events');
    expect(sAnna.text()).not.toContain('changed');
    await sJo.cancel(); await sAnna.cancel();
  });

  it('refuses the 11th stream of one person', async () => {
    const open10 = await Promise.all(Array.from({ length: 10 }, () => open(t)));
    expect((await open(t)).res.status).toBe(429);
    await Promise.all(open10.map((s) => s.cancel()));
  });

  it('ends the person\'s streams on sign-out', async () => {
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
    const jo = await sessionCookie(t, 'jo@example.com');
    const s = await open(t, jo);
    await t.json('POST', '/api/auth/signout', undefined, { cookie: jo });
    await s.until!(() => s.ended());
    expect(s.ended()).toBe(true);
    expect(t.app.ctx.live.has(mockSub('jo@example.com'))).toBe(false);
  });
});

describe('a stream and the session', () => {
  it('ends when the person is taken off the allow-list, and the poller stops', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const jo = await sessionCookie(t, 'jo@example.com');
      t.app.ctx.overrides.liveHeartbeatMs = 30;
      const s = await open(t, jo);
      expect(t.app.ctx.googlePoller.watching()).toEqual([mockSub('jo@example.com')]);
      t.app.ctx.auth.allowedEmails = ['anna@example.com'];
      await s.until!(() => s.ended());
      expect(s.ended()).toBe(true);
      expect(t.app.ctx.googlePoller.watching()).toEqual([]);
    } finally { t.cleanup(); }
  });
});

describe('the Google poller', () => {
  let t: TestApp;
  beforeEach(() => { t = makeApp(); });
  afterEach(() => t.cleanup());

  it('asks every 20 seconds by default and takes LIVE_GOOGLE_POLL_MS from the environment', () => {
    expect(loadConfig({}).googlePollMs).toBe(20_000);
    expect(loadConfig({ LIVE_GOOGLE_POLL_MS: '5000' }).googlePollMs).toBe(5_000);
    expect(loadConfig({ LIVE_GOOGLE_POLL_MS: 'x' }).googlePollMs).toBe(20_000);
  });

  it('waits longer after each failure, honours Retry-After and starts over after a good look', async () => {
    let fail: Error | null = new Error('down');
    let looks = 0;
    const poller = new GooglePoller({
      calendarFor: () => ({ changesSince: async () => { looks++; if (fail) throw fail; return { events: { replace: [], series: [], removed: [], upserts: [], calendars: [], failed: [] }, taskLists: { replace: false, series: [], removed: [], upserts: [], failed: false }, state: { to: '', tokens: {}, shared: {} } }; } }) as never,
      today: () => '2026-10-12', intervalMs: () => 100, publish: () => undefined,
    });
    poller.start('a');
    await new Promise((r) => setTimeout(r, 750));
    // 100 ms steps would be ~7 looks; doubling gives the first look, then +200, +400
    expect(looks).toBeLessThanOrEqual(4);
    poller.stop('a');
    fail = new RateLimitedError(1);
    looks = 0;
    poller.start('a');
    await new Promise((r) => setTimeout(r, 600));
    expect(looks).toBe(1); // Retry-After of 1 s outweighs the 100 ms interval
    poller.stop('a');
  });

  it('runs while an app is connected, nudges when Google changed, and stops with the last connection', async () => {
    await t.json('POST', '/api/__test/config', { googlePollMs: 100 });
    await t.json('POST', '/api/__test/reset');
    await t.json('POST', '/api/__test/config', { googlePollMs: 100 });
    expect(t.app.ctx.googlePoller.watching()).toEqual([]);
    const a = await open(t), b = await open(t);
    expect(t.app.ctx.googlePoller.watching()).toEqual([LOCAL_PERSON]);
    await new Promise((r) => setTimeout(r, 400));
    expect(a.text()).not.toContain('changed');
    await t.json('POST', '/api/__test/remote/events', { summary: 'Flight', start: { dateTime: '2026-10-14T07:00:00+02:00' }, end: { dateTime: '2026-10-14T09:00:00+02:00' } });
    await a.until!(() => a.text().includes('event: changed'));
    expect(a.text()).toContain('data: events');
    await a.cancel();
    expect(t.app.ctx.googlePoller.watching()).toEqual([LOCAL_PERSON]);
    await b.cancel();
    await new Promise((r) => setTimeout(r, 50));
    expect(t.app.ctx.googlePoller.watching()).toEqual([]);
    const { body } = await t.json('GET', '/api/__test/remote/lookups');
    expect(body.count).toBeGreaterThan(0);
    const before = body.count;
    await new Promise((r) => setTimeout(r, 300));
    expect((await t.json('GET', '/api/__test/remote/lookups')).body.count).toBe(before);
  });
});
