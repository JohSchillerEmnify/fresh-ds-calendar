/** An event's picked place (feature event-location): stored in Google's private extended properties next to `location`. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const timed = { title: 'Dentist', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00' };
const weber = { name: 'Zahnarztpraxis Dr. Weber', lat: 52.4867, lon: 13.3536 };
const at = 'Zahnarztpraxis Dr. Weber, Hauptstraße 12, 10827 Berlin';

/** The raw Google event the mock holds for an id. */
async function remote(id: string) {
  const r = await t.json('GET', '/api/__test/remote/events');
  return r.body.items.find((e: { id: string }) => e.id === id);
}

describe('event place', () => {
  it('stores a picked place in the private extended properties and returns it', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, location: at, place: weber });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ location: at, place: weber });
    const g = await remote(c.body.id);
    expect(g.location).toBe(at);
    expect(g.extendedProperties.private).toMatchObject({ placeName: weber.name, placeLat: '52.4867', placeLon: '13.3536' });
    expect((await t.json('GET', `/api/events/${c.body.id}`)).body.place).toEqual(weber);
    const items = await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-19');
    expect(items.body.items[0].place).toEqual(weber);
  });

  it('has no place for a typed location', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, location: 'Zahnarzt am Markt' });
    expect(c.body.place).toBeUndefined();
    expect((await remote(c.body.id)).extendedProperties).toBeUndefined();
  });

  it('drops the place when a patch sets it to null, keeps it when the patch leaves it out', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, location: at, place: weber });
    const kept = await t.json('PATCH', `/api/events/${c.body.id}`, { title: 'Dentist 2' });
    expect(kept.body.place).toEqual(weber);
    const p = await t.json('PATCH', `/api/events/${c.body.id}`, { location: 'Zahnarzt am Markt', place: null });
    expect(p.status).toBe(200);
    expect(p.body.place).toBeUndefined();
    expect(p.body.location).toBe('Zahnarzt am Markt');
    expect((await remote(c.body.id)).extendedProperties?.private?.placeName).toBeUndefined();
  });

  it('a location-only change keeps the place while it still leads with the name, and clears it otherwise', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, location: at, place: weber });
    const kept = await t.json('PATCH', `/api/events/${c.body.id}`, { location: 'Zahnarztpraxis Dr. Weber, Neue Str. 1' });
    expect(kept.body.place).toEqual(weber);
    expect((await remote(c.body.id)).extendedProperties.private.placeName).toBe(weber.name);
    const gone = await t.json('PATCH', `/api/events/${c.body.id}`, { location: 'Praxis am Markt' });
    expect(gone.body.place).toBeUndefined();
    expect((await remote(c.body.id)).extendedProperties?.private?.placeName).toBeUndefined();
  });

  it('replaces the place with a newly picked one', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, location: at, place: weber });
    const mitte = { name: 'Zahnklinik Mitte', lat: 52.52, lon: 13.388 };
    const p = await t.json('PATCH', `/api/events/${c.body.id}`, { location: 'Zahnklinik Mitte, Friedrichstraße 90, 10117 Berlin', place: mitte });
    expect(p.body.place).toEqual(mitte);
  });

  it('ignores the place once the location in Google no longer starts with its name (A8)', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, location: at, place: weber });
    await t.json('PATCH', `/api/__test/remote/events/${c.body.id}`, { location: 'Praxis am Markt' });
    const g = await t.json('GET', `/api/events/${c.body.id}`);
    expect(g.body.location).toBe('Praxis am Markt');
    expect(g.body.place).toBeUndefined();
  });

  it('ignores the place when the location only begins with the name but goes on differently', async () => {
    for (const location of ['Zahnarztpraxis Dr. Weber (Halle 2)', 'Zahnarztpraxis Dr. Webergasse 3']) {
      const c = await t.json('POST', '/api/events', { ...timed, location: at, place: weber });
      await t.json('PATCH', `/api/__test/remote/events/${c.body.id}`, { location });
      expect((await t.json('GET', `/api/events/${c.body.id}`)).body.place, location).toBeUndefined();
    }
    const exact = await t.json('POST', '/api/events', { ...timed, location: weber.name, place: weber });
    expect(exact.body.place).toEqual(weber);
  });

  it('does not store a place whose name does not lead the location', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, location: 'Somewhere else', place: weber });
    expect(c.body.place).toBeUndefined();
    expect((await remote(c.body.id)).extendedProperties?.private?.placeName).toBeUndefined();
    const p = await t.json('PATCH', `/api/events/${c.body.id}`, { location: 'Zahnarztpraxis Dr. Weber (Halle 2)', place: weber });
    expect(p.body.place).toBeUndefined();
    expect((await remote(c.body.id)).extendedProperties?.private?.placeName).toBeUndefined();
  });

  it('reads the place of an event another client wrote with the same properties', async () => {
    const ins = await t.json('POST', '/api/__test/remote/events', {
      summary: 'Swim', location: 'Stadtbad Neukölln, Ganghoferstraße 3, 12043 Berlin',
      start: { dateTime: '2026-10-15T18:00:00+02:00' }, end: { dateTime: '2026-10-15T19:00:00+02:00' },
      extendedProperties: { private: { placeName: 'Stadtbad Neukölln', placeLat: '52.4797', placeLon: '13.4361' } },
    });
    expect((await t.json('GET', `/api/events/${ins.body.id}`)).body.place).toEqual({ name: 'Stadtbad Neukölln', lat: 52.4797, lon: 13.4361 });
  });

  it('ignores stored properties that are not a valid position', async () => {
    const ins = await t.json('POST', '/api/__test/remote/events', {
      summary: 'Swim', location: 'Pool', start: { dateTime: '2026-10-15T18:00:00+02:00' }, end: { dateTime: '2026-10-15T19:00:00+02:00' },
      extendedProperties: { private: { placeName: 'Pool', placeLat: '95', placeLon: 'x' } },
    });
    expect((await t.json('GET', `/api/events/${ins.body.id}`)).body.place).toBeUndefined();
  });

  it('validates the place', async () => {
    const cases: [object, string][] = [
      [{ ...weber, lat: 90.5 }, 'Latitude must be a number from -90 to 90'],
      [{ ...weber, lon: -181 }, 'Longitude must be a number from -180 to 180'],
      [{ ...weber, name: '  ' }, 'Place name is required'],
      [{ name: 'x', lat: 1 }, 'lon is required'],
    ];
    for (const [place, msg] of cases) {
      const r = await t.json('POST', '/api/events', { ...timed, location: at, place });
      expect(r.status, msg).toBe(400);
      expect(r.body.error.message, JSON.stringify(place)).toBe(msg);
    }
  });
});
