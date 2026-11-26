import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { freeze, makeApp, sessionCookie, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => {
  await t.req('POST', '/api/__test/reset');
  await freeze(t, '2026-11-26T08:00:00+01:00');
});

const OUTSIDE = '2025-11-26..2027-11-27';
const allDay = (summary: string, date: string, extra: Record<string, unknown> = {}) => t.json('POST', '/api/__test/remote/events', {
  summary, start: { date }, end: { date: new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) }, ...extra,
});
const search = (q: string, extra = '') => t.json('GET', `/api/search?${new URLSearchParams({ q, outside: OUTSIDE, today: '2026-11-26' })}${extra}`);
const titles = (r: { body: { items: Array<{ title: string }> } }) => r.body.items.map((i) => i.title);

describe('GET /api/search', () => {
  it('finds the events outside the device window by Google text search (title, notes, place), nearest to today first', async () => {
    await allDay('Tax return 2019', '2020-06-01');
    await allDay('Tax outlook', '2027-12-15');
    await allDay('Tax return 2024', '2025-10-01');
    await allDay('Check-up', '2020-07-01', { description: 'bring the TAX card', location: 'Taxistrasse 4' });
    await allDay('Dentist', '2020-07-02');
    const r = await search('tax');
    expect(r.status).toBe(200);
    expect(titles(r)).toEqual(['Tax outlook', 'Tax return 2024', 'Check-up', 'Tax return 2019']);
    expect(r.body.nextCursor).toBeUndefined();
  });

  it('leaves out what the device holds: events touching the window, also one that starts before it', async () => {
    await allDay('Tax inside', '2026-12-01');
    await allDay('Tax first day', '2025-11-26');
    await t.json('POST', '/api/__test/remote/events', { summary: 'Tax long', start: { date: '2025-11-20' }, end: { date: '2025-11-27' } });
    await allDay('Tax day before', '2025-11-25');
    await allDay('Tax last day', '2027-11-26');
    await allDay('Tax day after', '2027-11-27');
    expect(titles(await search('tax'))).toEqual(['Tax day after', 'Tax day before']);
  });

  it('answers 100 per request and a cursor for the next ones', async () => {
    for (let i = 0; i < 105; i++) {
      const d = new Date(Date.parse('2020-01-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
      await allDay('Tax session', d);
    }
    const a = await search('tax');
    expect(a.body.items).toHaveLength(100);
    expect(a.body.nextCursor).toEqual(expect.any(String));
    // nearest first: the 100 latest days
    expect(a.body.items[0].start).toBe('2020-04-14');
    const b = await search('tax', `&cursor=${encodeURIComponent(a.body.nextCursor)}`);
    expect(b.body.items.map((i: { start: string }) => i.start)).toEqual(['2020-01-05', '2020-01-04', '2020-01-03', '2020-01-02', '2020-01-01']);
    expect(b.body.nextCursor).toBeUndefined();
  });

  it('reads Google once for all the cursor pages of one search, and again for another query', async () => {
    for (let i = 0; i < 105; i++) await allDay('Tax session', new Date(Date.parse('2020-01-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10));
    const mock = t.app.ctx.mock!;
    const calls = vi.spyOn(mock, 'listEvents');
    const a = await search('tax');
    const first = calls.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    await search('tax', `&cursor=${encodeURIComponent(a.body.nextCursor)}`);
    expect(calls.mock.calls.length, 'page 2 asks Google nothing').toBe(first);
    await search('taxes');
    expect(calls.mock.calls.length).toBeGreaterThan(first);
  });

  it('reads only the calendars of the person who asks', async () => {
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
    await allDay('Tax secret', '2020-06-01', { owner: 'anna@example.com' });
    await allDay('Tax mine', '2020-06-02', { owner: 'jo@example.com' });
    const url = `/api/search?${new URLSearchParams({ q: 'tax', outside: OUTSIDE, today: '2026-11-26' })}`;
    const jo = await t.json('GET', url, undefined, { cookie: await sessionCookie(t, 'jo@example.com') });
    expect(titles(jo)).toEqual(['Tax mine']);
    const anna = await t.json('GET', url, undefined, { cookie: await sessionCookie(t, 'anna@example.com') });
    expect(titles(anna)).toEqual(['Tax secret']);
  });

  it('rejects bad parameters with 400', async () => {
    for (const url of [
      '/api/search?outside=' + OUTSIDE + '&today=2026-11-26',
      '/api/search?q=&outside=' + OUTSIDE + '&today=2026-11-26',
      `/api/search?q=${'x'.repeat(101)}&outside=${OUTSIDE}&today=2026-11-26`,
      '/api/search?q=tax&outside=2025-11-26&today=2026-11-26',
      '/api/search?q=tax&outside=' + OUTSIDE + '&today=nope',
      '/api/search?q=tax&outside=' + OUTSIDE + '&today=2026-11-26&cursor=%25%25',
    ]) expect((await t.json('GET', url)).status, url).toBe(400);
  });

  it('answers 503 RATE_LIMITED with Retry-After when Google says the rate limit is reached, and works again once it accepts', async () => {
    await allDay('Tax return 2019', '2020-06-01');
    await t.json('POST', '/api/__test/search-rate-limit', { on: true });
    const limited = await search('tax');
    expect(limited.status).toBe(503);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.res.headers.get('retry-after'))).toBeGreaterThan(0);
    await t.json('POST', '/api/__test/search-rate-limit', { on: false });
    expect(titles(await search('tax'))).toEqual(['Tax return 2019']);
  });

  it('does not refuse reads without q while only searches are refused', async () => {
    await t.json('POST', '/api/__test/search-rate-limit', { on: true });
    expect((await t.json('GET', '/api/items?from=2026-11-01&to=2026-12-01')).status).toBe(200);
  });
});
