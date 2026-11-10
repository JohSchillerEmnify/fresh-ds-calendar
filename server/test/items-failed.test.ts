import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => {
  await t.req('POST', '/api/__test/reset');
  await freeze(t);
  await t.json('POST', '/api/__test/remote/events', { summary: 'Standup', calendarId: 'work', start: { date: '2028-01-12' }, end: { date: '2028-01-13' } });
  await t.json('POST', '/api/__test/remote/events', { summary: 'Planning', start: { date: '2028-01-13' }, end: { date: '2028-01-14' } });
});
const unreadable = (calendarId: string) => t.json('POST', '/api/__test/unreadable', { calendarId, on: true });

describe('a calendar Google cannot read', () => {
  it('is left out of /api/items and named in failed, the others still answer', async () => {
    await unreadable('work');
    const r = await t.json('GET', '/api/items?from=2028-01-10&to=2028-01-17');
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: { title: string }) => i.title)).toEqual(['Planning']);
    expect(r.body.failed).toEqual(['work']);
  });

  it('is left out of /api/summary and named in failed', async () => {
    await unreadable('work');
    const r = await t.json('GET', '/api/summary?from=2028-01-01&to=2028-02-01');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.days)).toEqual(['2028-01-13']);
    expect(r.body.failed).toEqual(['work']);
  });

  it('adds no failed list while every calendar answers', async () => {
    const r = await t.json('GET', '/api/items?from=2028-01-10&to=2028-01-17');
    expect(r.body.failed).toBeUndefined();
    expect(r.body.items).toHaveLength(2);
  });

  it('fails the request when no calendar can be read', async () => {
    await unreadable('*');
    expect((await t.json('GET', '/api/items?from=2028-01-10&to=2028-01-17')).status).toBeGreaterThanOrEqual(500);
    expect((await t.json('GET', '/api/summary?from=2028-01-01&to=2028-02-01')).status).toBeGreaterThanOrEqual(500);
  });
});
