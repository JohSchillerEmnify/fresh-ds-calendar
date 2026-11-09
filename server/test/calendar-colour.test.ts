import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const when = { start: { dateTime: '2026-10-14T07:00:00+02:00' }, end: { dateTime: '2026-10-14T08:00:00+02:00' } };
const remote = async (id: string) => (await t.json('GET', '/api/__test/remote/calendars')).body.calendars.find((c: { id: string }) => c.id === id);

describe('PATCH /api/calendars/:id color', () => {
  it('recolours the calendar, its events and Google\'s list entry with a readable text colour', async () => {
    const r = await t.json('PATCH', '/api/calendars/primary', { color: '#0B8043' });
    expect(r.status).toBe(200);
    expect(r.body.color).toBe('#0b8043');
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === 'primary').color).toBe('#0b8043');
    const g = await remote('primary');
    expect(g.backgroundColor).toBe('#0b8043');
    expect(g.foregroundColor).toBe('#ffffff');
    await t.json('POST', '/api/__test/remote/events', { summary: 'Yoga', calendarId: 'primary', ...when });
    const items = (await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-19')).body.items;
    expect(items.find((i: { title: string }) => i.title === 'Yoga').color).toBe('#0b8043');
  });

  it('uses black text on a light colour', async () => {
    await t.json('PATCH', '/api/calendars/primary', { color: '#f6bf26' });
    expect((await remote('primary')).foregroundColor).toBe('#000000');
  });

  it('recolours a calendar the person can only read', async () => {
    const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Anna', id: 'anna@example.org', accessRole: 'reader', ownerEmail: 'anna@example.org' })).body;
    const r = await t.json('PATCH', `/api/calendars/${cal.id}`, { color: '#8e24aa' });
    expect(r.status).toBe(200);
    expect((await remote(cal.id)).backgroundColor).toBe('#8e24aa');
  });

  it('can be sent together with hidden', async () => {
    const r = await t.json('PATCH', '/api/calendars/primary', { color: '#d50000', hidden: true });
    expect(r.body).toMatchObject({ color: '#d50000', hidden: true });
  });

  it.each(['red', '#fff', '#12345g', 12, null])('refuses %j', async (color) => {
    expect((await t.json('PATCH', '/api/calendars/primary', { color })).status).toBe(400);
  });

  it('answers 404 for an unknown calendar', async () => {
    expect((await t.json('PATCH', '/api/calendars/nope', { color: '#d50000' })).status).toBe(404);
  });
});

describe('Google calendar palette', () => {
  it('GET /api/calendar-colors answers the 24 calendar colours', async () => {
    const r = await t.json('GET', '/api/calendar-colors');
    expect(r.status).toBe(200);
    expect(r.body.colors).toHaveLength(24);
    expect(r.body.colors[0]).toEqual({ id: '1', background: '#ac725e', foreground: '#1d1d1d' });
  });

  it('a palette pick replaces the RGB colour Google already holds (Google lets RGB supersede colorId)', async () => {
    expect((await remote('primary')).backgroundColor).toBe('#039be5');
    const r = await t.json('PATCH', '/api/calendars/primary', { colorId: '16' });
    expect(r.status).toBe(200);
    expect(r.body.color).toBe('#4986e7');
    expect((await remote('primary')).backgroundColor).toBe('#4986e7');
    // Google answered "Invalid foreground color." to the palette's own #1d1d1d: the text colour is black or white
    expect((await remote('primary')).foregroundColor).toBe('#000000');
  });

  it('a custom colour clears the palette id', async () => {
    await t.json('PATCH', '/api/calendars/primary', { colorId: '16' });
    await t.json('PATCH', '/api/calendars/primary', { color: '#123456' });
    expect((await remote('primary')).colorId).toBeUndefined();
  });

  it.each(['0', '25', 'x', 7, null])('refuses colorId %j', async (colorId) => {
    expect((await t.json('PATCH', '/api/calendars/primary', { colorId })).status).toBe(400);
  });

  it('refuses color and colorId together', async () => {
    expect((await t.json('PATCH', '/api/calendars/primary', { color: '#123456', colorId: '3' })).status).toBe(400);
  });
});
