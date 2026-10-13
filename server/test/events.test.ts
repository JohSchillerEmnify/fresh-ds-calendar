import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const timed = { title: 'Standup', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T09:30:00+02:00' };

describe('events CRUD', () => {
  it('creates, reads, patches and deletes an event', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, description: 'd', location: 'Room 1', colorId: '6' });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ kind: 'event', calendarId: 'primary', title: 'Standup', allDay: false, colorId: '6', color: '#f4511e', description: 'd', location: 'Room 1' });
    expect(c.body.etag).toBeTruthy();
    const id = c.body.id;
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect((await t.json('GET', `/api/events/${id}`)).body.title).toBe('Standup');
    const p = await t.json('PATCH', `/api/events/${id}`, { title: 'Daily', colorId: null }, { 'If-Match': c.body.etag });
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ title: 'Daily', colorId: null, color: '#039be5' });
    expect(p.body.etag).not.toBe(c.body.etag);
    expect((await t.req('DELETE', `/api/events/${id}`)).status).toBe(204);
    expect((await t.json('GET', `/api/events/${id}`)).status).toBe(404);
  });

  it('normalises Z offsets to the calendar zone', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, start: '2026-10-14T07:00:00Z', end: '2026-10-14T08:00:00Z' });
    expect(c.body.start).toBe('2026-10-14T09:00:00+02:00');
  });

  it('keeps the correct offset across the DST change (2026-10-25)', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, start: '2026-10-25T10:00:00+01:00', end: '2026-10-25T11:00:00+01:00' });
    expect(c.body.start).toBe('2026-10-25T10:00:00+01:00');
    const s = await t.json('POST', '/api/events', { ...timed, start: '2026-03-29T01:30:00+01:00', end: '2026-03-29T03:30:00+02:00' });
    expect(s.status).toBe(201);
    expect(s.body.end).toBe('2026-03-29T03:30:00+02:00');
  });

  it('handles all-day and multi-day events with exclusive end', async () => {
    const c = await t.json('POST', '/api/events', { title: 'Trip', allDay: true, start: '2026-10-16', end: '2026-10-19' });
    expect(c.body).toMatchObject({ allDay: true, start: '2026-10-16', end: '2026-10-19' });
    const r = await t.json('GET', '/api/items?from=2026-10-18&to=2026-10-19');
    expect(r.body.items.map((i: any) => i.title)).toEqual(['Trip']);
    const none = await t.json('GET', '/api/items?from=2026-10-19&to=2026-10-20');
    expect(none.body.items).toHaveLength(0);
  });

  it('moves an event to another calendar', async () => {
    const c = await t.json('POST', '/api/events', timed);
    const p = await t.json('PATCH', `/api/events/${c.body.id}`, { calendarId: 'work' });
    expect(p.body.calendarId).toBe('work');
    expect(p.body.color).toBe('#0b8043');
  });

  it('validates input with the exact UI messages', async () => {
    const cases: [object, string][] = [
      [{ ...timed, title: '   ' }, 'Title is required'],
      [{ allDay: false, start: timed.start, end: timed.end }, 'Title is required'],
      [{ ...timed, title: 'x'.repeat(201) }, 'Title must be at most 200 characters'],
      [{ ...timed, end: timed.start }, 'End must be after start'],
      [{ title: 'a', allDay: true, start: '2026-10-16', end: '2026-10-16' }, 'End must be after start'],
    ];
    for (const [b, msg] of cases) {
      const r = await t.json('POST', '/api/events', b);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      expect(r.body.error.message).toBe(msg);
    }
    // user-facing validation messages carry a key the web app translates
    const end = await t.json('POST', '/api/events', { ...timed, end: timed.start });
    expect(end.body.error).toMatchObject({ message: 'End must be after start', key: 'errors.validation.endAfterStart' });
    expect((await t.json('POST', '/api/events', { ...timed, bogus: 1 })).status).toBe(400);
    expect((await t.json('POST', '/api/events', { ...timed, allDay: true })).status).toBe(400);
    expect((await t.json('POST', '/api/events', { title: 'x', allDay: true, start: '2026-01-01', end: '2027-02-01' })).status).toBe(400);
    expect((await t.json('POST', '/api/events', { ...timed, calendarId: 'nope' })).status).toBe(400);
    const bad = await t.req('POST', '/api/events', undefined);
    expect(bad.status).toBe(400);
  });

  it('PATCH validates the merged result', async () => {
    const c = await t.json('POST', '/api/events', timed);
    const r = await t.json('PATCH', `/api/events/${c.body.id}`, { end: '2026-10-14T08:00:00+02:00' });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe('End must be after start');
    const toAllDay = await t.json('PATCH', `/api/events/${c.body.id}`, { allDay: true });
    expect(toAllDay.status).toBe(400);
    const ok = await t.json('PATCH', `/api/events/${c.body.id}`, { allDay: true, start: '2026-10-14', end: '2026-10-15' });
    expect(ok.body).toMatchObject({ allDay: true, start: '2026-10-14', end: '2026-10-15' });
    const back = await t.json('PATCH', `/api/events/${c.body.id}`, { allDay: false, start: timed.start, end: timed.end });
    expect(back.body.allDay).toBe(false);
  });

  it('returns 412 for a stale If-Match on PATCH and DELETE', async () => {
    const c = await t.json('POST', '/api/events', timed);
    await t.json('PATCH', `/api/events/${c.body.id}`, { title: 'B' });
    const p = await t.json('PATCH', `/api/events/${c.body.id}`, { title: 'C' }, { 'If-Match': c.body.etag });
    expect(p.status).toBe(412);
    expect(p.body.error.code).toBe('PRECONDITION_FAILED');
    expect((await t.req('DELETE', `/api/events/${c.body.id}`, undefined, { 'If-Match': c.body.etag })).status).toBe(412);
    expect((await t.json('GET', `/api/events/${c.body.id}`)).body.title).toBe('B');
  });

  it('returns 404 for unknown ids and for task lists on event endpoints', async () => {
    expect((await t.json('GET', '/api/events/zzzz')).status).toBe(404);
    expect((await t.json('PATCH', '/api/events/zzzz', { title: 'a' })).status).toBe(404);
    expect((await t.req('DELETE', '/api/events/zzzz')).status).toBe(404);
    const l = await t.json('POST', '/api/tasklists', { title: 'L', date: '2026-10-14' });
    expect((await t.json('GET', `/api/events/${l.body.id}`)).status).toBe(404);
    const e = await t.json('POST', '/api/events', timed);
    expect((await t.json('GET', `/api/tasklists/${e.body.id}`)).status).toBe(404);
  });
});

describe('GET /api/items', () => {
  it('validates the range', async () => {
    for (const q of ['', '?from=2026-10-01', '?from=x&to=2026-10-02', '?from=2026-10-02&to=2026-10-02', '?from=2026-01-01&to=2026-06-01']) {
      expect((await t.json('GET', `/api/items${q}`)).status).toBe(400);
    }
  });

  it('sorts all-day first, then by time, then title and filters by calendar', async () => {
    await t.json('POST', '/api/events', { ...timed, title: 'B', start: '2026-10-14T10:00:00+02:00', end: '2026-10-14T11:00:00+02:00' });
    await t.json('POST', '/api/events', { ...timed, title: 'A', start: '2026-10-14T10:00:00+02:00', end: '2026-10-14T11:00:00+02:00', calendarId: 'work' });
    await t.json('POST', '/api/events', { title: 'Z day', allDay: true, start: '2026-10-14', end: '2026-10-15' });
    await t.json('POST', '/api/events', { ...timed, title: 'Early', start: '2026-10-14T08:00:00+02:00', end: '2026-10-14T08:30:00+02:00' });
    await t.json('POST', '/api/tasklists', { title: 'List', date: '2026-10-14' });
    const r = await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15');
    expect(r.body.items.map((i: any) => i.title)).toEqual(['List', 'Z day', 'Early', 'A', 'B']);
    expect(r.body.syncedAt).toMatch(/\+0[12]:00$/);
    const w = await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15&calendarIds=work');
    expect(w.body.items.map((i: any) => i.title)).toEqual(['A']);
  });

  it('shows remote changes immediately and omits cancelled events', async () => {
    const c = await t.json('POST', '/api/events', timed);
    await t.json('PATCH', `/api/__test/remote/events/${c.body.id}`, { summary: 'Remote title' });
    expect((await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.items[0].title).toBe('Remote title');
    await t.req('DELETE', `/api/__test/remote/events/${c.body.id}`);
    expect((await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.items).toHaveLength(0);
  });

  it('includes events overlapping the range boundary across midnight', async () => {
    await t.json('POST', '/api/events', { ...timed, title: 'Night', start: '2026-10-14T23:00:00+02:00', end: '2026-10-15T01:00:00+02:00' });
    expect((await t.json('GET', '/api/items?from=2026-10-15&to=2026-10-16')).body.items).toHaveLength(1);
    expect((await t.json('GET', '/api/items?from=2026-10-16&to=2026-10-17')).body.items).toHaveLength(0);
  });

  it('validates the also range with the same rules', async () => {
    const base = '/api/items?from=2026-10-14&to=2026-10-15&also=';
    for (const a of ['', 'x', '2026-10-01', '2026-10-01..', '2026-10-02..2026-10-02', '2026-10-03..2026-10-02', '2026-01-01..2026-06-01', '2026-10-01..x']) {
      const r = await t.json('GET', `${base}${a}`);
      expect(r.status).toBe(400);
      expect(r.body.error.details[0].field).toBe('also');
    }
  });

  it('merges the also range into one response, each item once, and echoes it', async () => {
    await t.json('POST', '/api/events', { ...timed, title: 'Shown' });
    await t.json('POST', '/api/events', { ...timed, title: 'Today', start: '2026-10-20T09:00:00+02:00', end: '2026-10-20T09:30:00+02:00' });
    await t.json('POST', '/api/events', { title: 'Both', allDay: true, start: '2026-10-14', end: '2026-10-21' });
    const r = await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15&also=2026-10-20..2026-10-21');
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: any) => i.title)).toEqual(['Both', 'Shown', 'Today']);
    expect(r.body).toMatchObject({ from: '2026-10-14', to: '2026-10-15', also: { from: '2026-10-20', to: '2026-10-21' } });
    expect((await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.also).toBeUndefined();
  });
});

describe('calendars, config, health, errors', () => {
  it('lists the mock calendars', async () => {
    const r = await t.json('GET', '/api/calendars');
    expect(r.body.calendars).toEqual([
      { id: 'primary', name: 'Personal', color: '#039be5', primary: true, writable: true, hidden: false },
      { id: 'work', name: 'Work', color: '#0b8043', primary: false, writable: true, hidden: false },
    ]);
  });

  it('hides and shows a calendar per person, 404 for an unknown one', async () => {
    const r = await t.json('PATCH', '/api/calendars/work', { hidden: true });
    expect(r.status).toBe(200);
    expect(r.body.hidden).toBe(true);
    expect((await t.json('GET', '/api/calendars')).body.calendars.map((c: { hidden: boolean }) => c.hidden)).toEqual([false, true]);
    await t.json('PATCH', '/api/calendars/work', { hidden: false });
    expect((await t.json('GET', '/api/calendars')).body.calendars.every((c: { hidden: boolean }) => !c.hidden)).toBe(true);
    expect((await t.json('PATCH', '/api/calendars/nope', { hidden: true })).status).toBe(404);
  });

  it('config honours the test clock and poll override', async () => {
    const r = await t.json('GET', '/api/config');
    expect(r.body).toMatchObject({ now: '2026-10-12T06:00:00.000Z', clockFrozen: true, timeZone: 'Europe/Berlin', weekStartsOn: 1, pollIntervalMs: 30000, provider: 'mock', testMode: true });
    const o = await t.json('POST', '/api/__test/config', { pollIntervalMs: 2000 });
    expect(o.body.pollIntervalMs).toBe(2000);
    await t.req('POST', '/api/__test/clock', { now: null });
    const c = await t.json('GET', '/api/config');
    expect(c.body.clockFrozen).toBe(false);
    expect(Math.abs(Date.parse(c.body.now) - Date.now())).toBeLessThan(5000);
  });

  it('a running clock advances from the set instant', async () => {
    await t.req('POST', '/api/__test/clock', { now: '2026-10-12T08:00:00+02:00', frozen: false });
    const a = Date.parse((await t.json('GET', '/api/config')).body.now);
    await new Promise((r) => setTimeout(r, 30));
    const b = Date.parse((await t.json('GET', '/api/config')).body.now);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThanOrEqual(Date.parse('2026-10-12T06:00:00Z'));
  });

  it('outage: provider routes fail, health/config/settings keep working', async () => {
    await t.json('POST', '/api/__test/outage', { down: true });
    const h = await t.json('GET', '/api/health');
    expect(h.status).toBe(200);
    expect(h.body.providerStatus).toBe('unavailable');
    for (const [m, u, b] of [['GET', '/api/items?from=2026-10-14&to=2026-10-15'], ['POST', '/api/events', timed], ['GET', '/api/calendars']] as const) {
      const r = await t.json(m, u, b);
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('PROVIDER_UNAVAILABLE');
    }
    expect((await t.json('GET', '/api/settings')).status).toBe(200);
    expect((await t.json('GET', '/api/config')).status).toBe(200);
    await t.json('POST', '/api/__test/outage', { down: true, status: 500 });
    const r = await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15');
    expect(r.status).toBe(502);
    expect(r.body.error.code).toBe('PROVIDER_ERROR');
    await t.json('POST', '/api/__test/outage', { down: false });
    expect((await t.json('GET', '/api/health')).body.providerStatus).toBe('ok');
  });

  it('answers malformed JSON with 400', async () => {
    const res = await t.app.request('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    expect(res.status).toBe(400);
  });
});

describe('test endpoints are 404 when TEST_MODE is off', () => {
  it('hides /api/__test/*', async () => {
    const p = makeApp({ TEST_MODE: 'false' });
    try {
      for (const [m, u] of [['POST', '/api/__test/reset'], ['GET', '/api/__test/memory'], ['POST', '/api/__test/clock']]) {
        const r = await p.json(m!, u!);
        expect(r.status).toBe(404);
        expect(r.body.error.code).toBe('NOT_FOUND');
      }
    } finally { p.cleanup(); }
  });
});
