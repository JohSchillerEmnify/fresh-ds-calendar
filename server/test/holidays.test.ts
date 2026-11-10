import { OAuth2Client } from 'google-auth-library';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GoogleProvider, makeApi } from '../src/providers/google/GoogleProvider.js';
import { HOLIDAY_REGIONS, holidayCalendarId, parseHolidayCalendarId } from '../src/providers/holidayRegions.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const DE = 'de.german.official#holiday@group.v.calendar.google.com';
const EN = 'en.german.official#holiday@group.v.calendar.google.com';
const regions = async (lang = 'en') => (await t.json('GET', `/api/holiday-regions?lang=${lang}`)).body.regions as Array<{ code: string; variants: string[]; added: string[] }>;
const calendars = async () => (await t.json('GET', '/api/calendars')).body.calendars as Array<{ id: string; name: string; holiday?: boolean }>;

describe('holiday ids', () => {
  it('builds ids in a language and variant and reads them back in any language', () => {
    expect(holidayCalendarId('DE', 'de', 'official')).toBe(DE);
    expect(holidayCalendarId('AT', 'en', 'all')).toBe('en.austrian#holiday@group.v.calendar.google.com');
    expect(parseHolidayCalendarId(DE)).toEqual({ code: 'DE', variant: 'official' });
    expect(parseHolidayCalendarId('en.german#holiday@group.v.calendar.google.com')).toEqual({ code: 'DE', variant: 'all' });
    expect(parseHolidayCalendarId('en.christian#holiday@group.v.calendar.google.com')).toBeNull();
    expect(Object.keys(HOLIDAY_REGIONS)).toHaveLength(65);
  });
});

describe('GET /api/holiday-regions', () => {
  it('offers every verified region with both variants and marks none added', async () => {
    const r = await regions();
    expect(r).toHaveLength(65);
    expect(r.find((x) => x.code === 'DE')).toEqual({ code: 'DE', variants: ['official', 'all'], added: [] });
  });

  it('leaves out a region Google does not know and a variant it lacks', async () => {
    await t.json('POST', '/api/__test/holiday-missing', { code: 'AT', variants: ['official', 'all'] });
    await t.json('POST', '/api/__test/holiday-missing', { code: 'DE', variants: ['all'] });
    const r = await regions();
    expect(r.find((x) => x.code === 'AT')).toBeUndefined();
    expect(r.find((x) => x.code === 'DE')?.variants).toEqual(['official']);
  });

  it('marks the variants the person has, whatever language the id has', async () => {
    await t.json('POST', '/api/__test/remote/holiday-calendars', { code: 'DE', variant: 'all' });
    expect((await regions('de')).find((x) => x.code === 'DE')?.added).toEqual(['all']);
  });

  it('fails as a whole when Google is down, and keeps nothing of it', async () => {
    await t.json('POST', '/api/__test/outage', { down: true, status: 503 });
    expect((await t.json('GET', '/api/holiday-regions')).status).toBe(503);
    await t.json('POST', '/api/__test/outage', { down: false });
    expect(await regions()).toHaveLength(65);
  });
});

describe('POST /api/holiday-calendars', () => {
  it('subscribes the id in the app language and falls back to English', async () => {
    const de = await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official', lang: 'de' });
    expect(de.status).toBe(201);
    expect(de.body).toMatchObject({ id: DE, name: 'Feiertage in Deutschland', holiday: true, writable: false, hidden: false });
    await t.json('DELETE', `/api/holiday-calendars/${encodeURIComponent(DE)}`);
    const fr = await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official', lang: 'fr' });
    expect(fr.body).toMatchObject({ id: EN, name: 'Holidays in Germany' });
    expect((await calendars()).find((c) => c.id === EN)?.holiday).toBe(true);
  });

  it('answers 200 with the entry it already has, in whatever language', async () => {
    await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official', lang: 'en' });
    const again = await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official', lang: 'de' });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(EN);
  });

  it('refuses a code outside the list, an unknown variant and a calendar Google does not have', async () => {
    expect((await t.json('POST', '/api/holiday-calendars', { code: 'XX', variant: 'official' })).status).toBe(400);
    expect((await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'nope' })).status).toBe(400);
    await t.json('POST', '/api/__test/holiday-missing', { code: 'DE', variants: ['official'] });
    expect((await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official' })).status).toBe(404);
  });

  it('shows the holidays of the calendar as events', async () => {
    await t.json('POST', '/api/__test/remote/events', { summary: 'Christmas Day', calendarId: EN, start: { date: '2026-12-25' }, end: { date: '2026-12-26' } });
    await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official' });
    const items = (await t.json('GET', '/api/items?from=2026-12-21&to=2026-12-28')).body.items;
    expect(items.find((i: { title: string }) => i.title === 'Christmas Day')).toBeTruthy();
  });
});

describe('DELETE /api/holiday-calendars/:id', () => {
  it('removes the calendar from the list and its switch', async () => {
    await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official' });
    await t.json('PATCH', `/api/calendars/${encodeURIComponent(EN)}`, { hidden: true });
    expect((await t.req('DELETE', `/api/holiday-calendars/${encodeURIComponent(EN)}`)).status).toBe(204);
    expect((await calendars()).some((c) => c.id === EN)).toBe(false);
    await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official' });
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === EN).hidden).toBe(false);
  });

  it('refuses anything that is not a holiday calendar of the list', async () => {
    expect((await t.json('DELETE', '/api/holiday-calendars/primary')).status).toBe(404);
    expect((await t.json('DELETE', `/api/holiday-calendars/${encodeURIComponent(EN)}`)).status).toBe(404);
  });
});

describe('GoogleProvider holiday calls (mocked HTTP)', () => {
  function provider(handler: (url: URL, method: string, body: unknown) => { status?: number; json?: unknown }) {
    const calls: Array<{ url: URL; method: string; body: unknown }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : null;
      const url = new URL(req ? req.url : String(input));
      const method = req ? req.method : init?.method ?? 'GET';
      const raw = req ? await req.text() : init?.body;
      const body = raw ? JSON.parse(String(raw)) : undefined;
      calls.push({ url, method, body });
      const r = handler(url, method, body);
      return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const auth = new OAuth2Client({ clientId: 'id', clientSecret: 'secret' });
    auth.setCredentials({ access_token: 'tok', expiry_date: Date.now() + 3_600_000 });
    return { p: new GoogleProvider({ api: makeApi(auth, fetchImpl) }), calls };
  }

  it('checks with calendars.get, and falls back to a one-event read when that says 404', async () => {
    const a = provider(() => ({ json: { id: EN, summary: 'Holidays in Germany' } }));
    expect(await a.p.publicCalendarExists(EN)).toBe(true);
    expect(a.calls).toHaveLength(1);
    expect(a.calls[0]!.url.pathname).toBe(`/calendar/v3/calendars/${encodeURIComponent(EN)}`);
    const b = provider((url) => (url.pathname.endsWith('/events') ? { json: { items: [] } } : { status: 404, json: { error: { code: 404, message: 'Not Found' } } }));
    expect(await b.p.publicCalendarExists(EN)).toBe(true);
    expect(b.calls.map((c) => c.url.pathname.split('/').pop())).toEqual([encodeURIComponent(EN), 'events']);
    expect(b.calls[1]!.url.searchParams.get('maxResults')).toBe('1');
    const c = provider(() => ({ status: 404, json: { error: { code: 404, message: 'Not Found' } } }));
    expect(await c.p.publicCalendarExists(EN)).toBe(false);
  });

  it('subscribes with calendarList.insert (selected) and removes with calendarList.delete', async () => {
    const { p, calls } = provider((_u, method) => (method === 'POST' ? { json: { id: EN, summary: 'Holidays in Germany', backgroundColor: '#7986CB', accessRole: 'reader' } } : { status: 204 }));
    expect(await p.subscribeCalendar(EN)).toMatchObject({ id: EN, summary: 'Holidays in Germany', backgroundColor: '#7986cb', accessRole: 'reader', primary: false });
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url.pathname).toBe('/calendar/v3/users/me/calendarList');
    expect(calls[0]!.body).toEqual({ id: EN, selected: true });
    await p.unsubscribeCalendar(EN);
    expect(calls[1]!.method).toBe('DELETE');
    expect(calls[1]!.url.pathname).toBe(`/calendar/v3/users/me/calendarList/${encodeURIComponent(EN)}`);
  });
});

describe('after a region is removed', () => {
  it('its events leave the items and the change feed lists the calendar no more', async () => {
    await t.json('POST', '/api/__test/remote/events', { summary: 'Christmas Day', calendarId: EN, start: { date: '2026-12-25' }, end: { date: '2026-12-26' } });
    await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official' });
    const feed = async () => (await t.json('GET', '/api/changes?today=2026-12-20')).body;
    expect((await feed()).events.calendars).toContain(EN);
    await t.req('DELETE', `/api/holiday-calendars/${encodeURIComponent(EN)}`);
    const items = (await t.json('GET', '/api/items?from=2026-12-21&to=2026-12-28')).body.items;
    expect(items.some((i: { title: string }) => i.title === 'Christmas Day')).toBe(false);
    expect((await feed()).events.calendars).not.toContain(EN);
  });

  it('is reported to a device that holds the older cursor', async () => {
    await t.json('POST', '/api/__test/remote/events', { summary: 'Christmas Day', calendarId: EN, start: { date: '2026-12-25' }, end: { date: '2026-12-26' } });
    await t.json('POST', '/api/holiday-calendars', { code: 'DE', variant: 'official' });
    const first = (await t.json('GET', '/api/changes?today=2026-12-20')).body;
    await t.req('DELETE', `/api/holiday-calendars/${encodeURIComponent(EN)}`);
    const next = (await t.json('GET', `/api/changes?today=2026-12-20&cursor=${encodeURIComponent(first.cursor)}`)).body;
    expect(next.events.calendars).not.toContain(EN);
    expect(next.calendars.some((c: { id: string }) => c.id === EN)).toBe(false);
  });
});
