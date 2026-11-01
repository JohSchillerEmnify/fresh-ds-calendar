import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Clock } from '../src/lib/clock.js';
import { deltaE76, nearestGoogleColorId, GOOGLE_COLORS } from '@calendar/shared/colors';
import { addDays, addMonthsClamp, formatInZone, isDateTime, isLocalDate, localDateOf, offsetMinutes, startOfLocalDay, zonedToUtc } from '../src/lib/time.js';
import { MockGoogleProvider } from '../src/providers/mock/MockGoogleProvider.js';
import { NotFoundError, PreconditionFailedError, ProviderError, ProviderUnavailableError } from '../src/providers/CalendarProvider.js';
import {
  dateOnCompletion, decodeTaskList, encodeItems, encodePrivate, encodeTaskList, isUndatedEvent, mirror, nextCompletedOn, parseDescription, readItems, UNDATED_ANCHOR,
} from '../src/services/taskCodec.js';

describe('colors', () => {
  it('palette colors map to themselves', () => {
    for (const [id, c] of Object.entries(GOOGLE_COLORS)) expect(nearestGoogleColorId(c.hex)).toBe(id);
  });
  it('picks the nearest by CIE76', () => {
    expect(nearestGoogleColorId('#c43e00')).toBe('6');
    expect(nearestGoogleColorId('#ff0000')).toBe('11');
    expect(nearestGoogleColorId('#000000')).toBe('8');
    expect(nearestGoogleColorId('#1A73E8')).toBe('9');
  });
  it('delta E is zero for equal and symmetric', () => {
    expect(deltaE76('#123456', '#123456')).toBe(0);
    expect(deltaE76('#ffffff', '#000000')).toBeCloseTo(100, 0);
    expect(deltaE76('#abcdef', '#fedcba')).toBeCloseTo(deltaE76('#fedcba', '#abcdef'));
  });
});

describe('time helpers (Europe/Berlin)', () => {
  const tz = 'Europe/Berlin';
  it('offsets across DST', () => {
    expect(offsetMinutes(Date.parse('2026-07-01T00:00:00Z'), tz)).toBe(120);
    expect(offsetMinutes(Date.parse('2026-12-01T00:00:00Z'), tz)).toBe(60);
  });
  it('local midnight on DST change days is 23/25 hours apart', () => {
    const h = (a: string, b: string) => (startOfLocalDay(b, tz) - startOfLocalDay(a, tz)) / 3_600_000;
    expect(h('2026-03-29', '2026-03-30')).toBe(23);
    expect(h('2026-10-25', '2026-10-26')).toBe(25);
  });
  it('spring-forward gap shifts forward; fall-back picks the first occurrence', () => {
    expect(formatInZone(zonedToUtc('2026-03-29', '02:30', tz), tz)).toBe('2026-03-29T03:30:00+02:00');
    expect(formatInZone(zonedToUtc('2026-10-25', '02:30', tz), tz)).toBe('2026-10-25T02:30:00+02:00');
  });
  it('local date follows the zone, not UTC', () => {
    expect(localDateOf(Date.parse('2026-10-12T22:30:00Z'), tz)).toBe('2026-10-13');
  });
  it('validators and arithmetic', () => {
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isDateTime('2026-10-12T09:00:00+02:00')).toBe(true);
    expect(isDateTime('2026-10-12T09:00:00')).toBe(false);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonthsClamp('2026-01-31', 1)).toEqual({ date: '2026-02-28', exact: false });
  });
});

describe('Clock', () => {
  it('is frozen, running or real', () => {
    let real = 1000;
    const c = new Clock(() => real);
    expect(c.nowMs()).toBe(1000);
    c.set(5000, true);
    real = 2000;
    expect(c.nowMs()).toBe(5000);
    expect(c.frozen).toBe(true);
    c.set(5000, false);
    real = 2500;
    expect(c.nowMs()).toBe(5500);
    c.set(null);
    expect(c.nowMs()).toBe(2500);
    expect(c.real()).toBe(2500);
  });
});

describe('TaskListCodec', () => {
  const items = [{ id: 'aaaaaaaa', title: 'One', done: false }, { id: 'bbbbbbbb', title: 'Two', done: true }];
  it('mirrors items as checkbox lines', () => {
    expect(mirror(items)).toBe('☐ One\n☑ Two');
    expect(mirror([])).toBe('');
  });
  it('round-trips through the Google shape', () => {
    const data = { title: 'T', date: '2026-10-12', time: '09:00', items, categoryId: 'work', tags: ['a', 'b'], estimateMinutes: 45, recurrence: 'weekly' as const, completedOn: '2026-10-11', createdOn: '2026-10-10', canvas: { x: 120, y: 340 } };
    const ev = encodeTaskList(data, 'Europe/Berlin', '3');
    expect(ev).toMatchObject({ summary: 'T', colorId: '3', recurrence: ['RRULE:FREQ=WEEKLY'] });
    expect(ev.extendedProperties?.private?.completedOn).toBe('2026-10-11');
    expect(ev.end.dateTime).toBe('2026-10-12T09:45:00+02:00');
    const back = decodeTaskList({ ...ev, id: 'x', calendarId: 'primary', etag: 'e', status: 'confirmed', created: '', updated: '' }, 'Europe/Berlin');
    expect(back).toEqual(data);
  });
  it('an untitled list is stored with an empty summary and the untitled flag, and decodes to an empty title with its items intact', () => {
    const data = { title: '', date: '2026-10-12', time: null, items, categoryId: null, tags: [], estimateMinutes: null, recurrence: null, completedOn: null, createdOn: null, canvas: null };
    const ev = encodeTaskList(data, 'Europe/Berlin', null);
    expect(ev.summary).toBe('');
    expect(ev.extendedProperties?.private?.untitled).toBe('1');
    const back = decodeTaskList({ ...ev, id: 'x', calendarId: 'primary', etag: 'e', status: 'confirmed', created: '', updated: '' }, 'Europe/Berlin');
    expect(back.title).toBe('');
    expect(back.items.map((i) => i.title)).toEqual(items.map((i) => i.title));
    const titled = encodeTaskList({ ...data, title: 'T' }, 'Europe/Berlin', null);
    expect(titled.summary).toBe('T');
    expect(titled.extendedProperties?.private?.untitled).toBeUndefined();
  });
  it('reads a missing or malformed completedOn as null', () => {
    const ev = (completedOn?: string) => ({ id: 'x', calendarId: 'p', etag: '', status: 'confirmed' as const, start: { date: '2026-10-12' }, end: { date: '2026-10-13' }, created: '', updated: '', extendedProperties: { private: { kind: 'tasklist', items: '[]', ...(completedOn === undefined ? {} : { completedOn }) } } });
    expect(decodeTaskList(ev(), 'Europe/Berlin').completedOn).toBeNull();
    expect(decodeTaskList(ev('yesterday'), 'Europe/Berlin').completedOn).toBeNull();
  });
  it('nextCompletedOn: set on the write that finishes a list, kept while finished, cleared when reopened', () => {
    const open = [{ id: 'a', title: 'A', done: false }], done = [{ id: 'a', title: 'A', done: true }];
    const d = (its: typeof items, completedOn: string | null) => ({ items: its, completedOn });
    expect(nextCompletedOn(d(open, null), d(done, null), '2026-10-12')).toBe('2026-10-12');
    expect(nextCompletedOn(d(done, '2026-10-10'), d(done, '2026-10-10'), '2026-10-12')).toBe('2026-10-10');
    expect(nextCompletedOn(d(done, null), d(done, null), '2026-10-12')).toBeNull(); // finished outside the app: unknown date stays unknown
    expect(nextCompletedOn(d(done, '2026-10-10'), d(open, '2026-10-10'), '2026-10-12')).toBeNull();
    expect(nextCompletedOn(d(done, '2026-10-10'), d([], '2026-10-10'), '2026-10-12')).toBeNull(); // an empty list is not finished
  });
  it('an undated list is an all-day event on the anchor date with the undated marker, and round-trips to date null', () => {
    const data = { title: 'T', date: null, time: null, items, categoryId: null, tags: [], estimateMinutes: null, recurrence: null, completedOn: null, createdOn: null, canvas: null };
    const ev = encodeTaskList(data, 'Europe/Berlin', null);
    expect(UNDATED_ANCHOR).toBe('2099-12-31');
    expect(ev.start).toEqual({ date: '2099-12-31' });
    expect(ev.end).toEqual({ date: '2100-01-01' });
    expect(ev.extendedProperties?.private?.undated).toBe('1');
    const full = { ...ev, id: 'x', calendarId: 'primary', etag: 'e', status: 'confirmed' as const, created: '', updated: '' };
    expect(isUndatedEvent(full)).toBe(true);
    expect(decodeTaskList(full, 'Europe/Berlin')).toEqual(data);
    // giving it a date clears the marker on the patch and a time is ignored while undated
    expect(encodePrivate({ ...data, date: '2026-10-12' }).undated).toBeNull();
    expect(encodeTaskList({ ...data, time: '09:00' }, 'Europe/Berlin', null).start).toEqual({ date: '2099-12-31' });
  });
  it('dateOnCompletion: only the write that ticks the last open item of an undated list dates it', () => {
    const open = [{ id: 'a', title: 'A', done: false }, { id: 'b', title: 'B', done: true }], done = [{ id: 'a', title: 'A', done: true }, { id: 'b', title: 'B', done: true }];
    const l = (its: typeof items, date: string | null) => ({ items: its, date });
    expect(dateOnCompletion(l(open, null), l(done, null), '2026-10-12')).toBe('2026-10-12');
    expect(dateOnCompletion(l(open, null), l(open, null), '2026-10-12')).toBeNull(); // still open
    expect(dateOnCompletion(l(done, null), l(done, null), '2026-10-12')).toBeNull(); // was complete already
    expect(dateOnCompletion(l(open, '2026-10-01'), l(done, '2026-10-01'), '2026-10-12')).toBeNull(); // dated lists keep their date
    expect(dateOnCompletion(l(open, null), l([], null), '2026-10-12')).toBeNull(); // an empty list is not finished
  });
  it('dateOnCompletion: "Archive only" keeps a finished undated list undated', () => {
    const open = [{ id: 'a', title: 'A', done: false }], done = [{ id: 'a', title: 'A', done: true }];
    const l = (its: typeof open) => ({ items: its, date: null });
    expect(dateOnCompletion(l(open), l(done), '2026-10-12', 'archive')).toBeNull();
    expect(dateOnCompletion(l(open), l(done), '2026-10-12', 'calendar')).toBe('2026-10-12');
  });
  it('encodePrivate marks finished lists with done=1 and clears it when an item is open again', () => {
    const base = { title: 'T', date: null, time: null, categoryId: null, tags: [], estimateMinutes: null, recurrence: null, completedOn: null, createdOn: null, canvas: null };
    expect(encodePrivate({ ...base, items: [{ id: 'a', title: 'A', done: true }] }).done).toBe('1');
    expect(encodePrivate({ ...base, items: [{ id: 'a', title: 'A', done: false }] }).done).toBeNull();
    expect(encodePrivate({ ...base, items: [] }).done).toBeNull();
  });
  it('splits at 1000 chars and reads chunks back in order', () => {
    const big = Array.from({ length: 60 }, (_, i) => ({ id: `id${String(i).padStart(6, '0')}`, title: `Title ${i} ${'x'.repeat(40)}`, done: i % 2 === 0 }));
    const enc = encodeItems(big);
    expect(Number(enc.itemsChunks)).toBeGreaterThan(2);
    expect(enc.items!.length).toBe(1000);
    const priv = Object.fromEntries(Object.entries(enc).filter(([, v]) => v !== null)) as Record<string, string>;
    expect(readItems({ id: 'x', calendarId: 'p', etag: '', status: 'confirmed', start: {}, end: {}, created: '', updated: '', extendedProperties: { private: priv } })).toEqual(big);
  });
  it('falls back to the description when items JSON is corrupt', () => {
    const ev = { id: 'x', calendarId: 'p', etag: '', status: 'confirmed' as const, start: { date: '2026-10-12' }, end: { date: '2026-10-13' }, created: '', updated: '', description: '☑ ok', extendedProperties: { private: { kind: 'tasklist', items: '{broken' } } };
    expect(readItems(ev)).toMatchObject([{ title: 'ok', done: true }]);
  });
  it('parses description variants', () => {
    const r = parseDescription('☐ A\n☑ B\n[ ] C\n[X] D\n  E  \n\n☐   \n');
    expect(r.map((i) => [i.title, i.done])).toEqual([['A', false], ['B', true], ['C', false], ['D', true], ['E', false]]);
    expect(new Set(r.map((i) => i.id)).size).toBe(r.length);
    expect(parseDescription('☐ same\n☐ same').map((i) => i.id)[0]).not.toBe(parseDescription('☐ same\n☐ same').map((i) => i.id)[1]);
    expect(parseDescription(undefined)).toEqual([]);
  });
});

describe('MockGoogleProvider', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
  const mk = (dataDir: string | null = null) => new MockGoogleProvider({ dataDir, tz: 'Europe/Berlin', clock: new Clock(), flushDelayMs: 10 });
  const ev = (o = {}) => ({ summary: 'A', start: { date: '2026-10-12' }, end: { date: '2026-10-13' }, ...o });

  it('assigns id, etag, timestamps, iCalUID; bumps etag, sequence and updated on patch', async () => {
    const p = mk();
    const a = await p.insertEvent('primary', ev());
    expect(a).toMatchObject({ calendarId: 'primary', status: 'confirmed', sequence: 0 });
    expect(a.id).toMatch(/^[a-v0-9]{26}$/);
    expect(a.iCalUID).toContain(a.id);
    await new Promise((r) => setTimeout(r, 5));
    const b = await p.patchEvent('primary', a.id, { summary: 'B' });
    expect(b.etag).not.toBe(a.etag);
    expect(b.sequence).toBe(1);
    expect(b.updated >= a.updated).toBe(true);
    expect(b.created).toBe(a.created);
  });
  it('patch merges extendedProperties.private deeply; null removes keys and optional fields', async () => {
    const p = mk();
    const a = await p.insertEvent('primary', ev({ colorId: '5', extendedProperties: { private: { a: '1', b: '2' }, shared: { s: '1' } } }));
    const b = await p.patchEvent('primary', a.id, { colorId: null, extendedProperties: { private: { b: null, c: '3' } } });
    expect(b.colorId).toBeUndefined();
    expect(b.extendedProperties).toEqual({ private: { a: '1', c: '3' }, shared: { s: '1' } });
  });
  it('412 on stale ifMatch (quotes and weak prefix ignored), pass on current', async () => {
    const p = mk();
    const a = await p.insertEvent('primary', ev());
    await p.patchEvent('primary', a.id, { summary: 'B' });
    await expect(p.patchEvent('primary', a.id, { summary: 'C' }, { ifMatch: a.etag })).rejects.toBeInstanceOf(PreconditionFailedError);
    await expect(p.deleteEvent('primary', a.id, { ifMatch: a.etag })).rejects.toBeInstanceOf(PreconditionFailedError);
    const cur = await p.getEvent('primary', a.id);
    await p.patchEvent('primary', a.id, { summary: 'C' }, { ifMatch: `W/${cur.etag}` });
  });
  it('delete cancels (Google semantics): hidden unless showDeleted, get/patch/delete then 404', async () => {
    const p = mk();
    const a = await p.insertEvent('primary', ev());
    await p.deleteEvent('primary', a.id);
    const q = { calendarId: 'primary', timeMin: '2026-10-01T00:00:00Z', timeMax: '2026-11-01T00:00:00Z' };
    expect((await p.listEvents(q)).items).toHaveLength(0);
    expect((await p.listEvents({ ...q, showDeleted: true })).items[0]).toMatchObject({ id: a.id, status: 'cancelled' });
    await expect(p.getEvent('primary', a.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(p.deleteEvent('primary', a.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(p.getEvent('nope', a.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it('list filters by overlap (end exclusive) and private properties', async () => {
    const p = mk();
    await p.insertEvent('primary', ev({ summary: 'day', extendedProperties: { private: { kind: 'tasklist' } } }));
    await p.insertEvent('primary', ev({ summary: 'timed', start: { dateTime: '2026-10-12T23:30:00+02:00' }, end: { dateTime: '2026-10-13T00:00:00+02:00' } }));
    const q = (min: string, max: string, f?: string[]) => p.listEvents({ calendarId: 'primary', timeMin: min, timeMax: max, privateExtendedProperty: f }).then((r) => r.items.map((e) => e.summary));
    expect(await q('2026-10-12T00:00:00+02:00', '2026-10-13T00:00:00+02:00')).toEqual(['day', 'timed']);
    expect(await q('2026-10-13T00:00:00+02:00', '2026-10-14T00:00:00+02:00')).toEqual([]);
    expect(await q('2026-10-12T23:59:00+02:00', '2026-10-14T00:00:00+02:00')).toEqual(['day', 'timed']);
    expect(await q('2026-10-12T00:00:00+02:00', '2026-10-13T00:00:00+02:00', ['kind=tasklist'])).toEqual(['day']);
    expect(await q('2026-10-12T00:00:00+02:00', '2026-10-13T00:00:00+02:00', ['kind=other'])).toEqual([]);
  });
  it('moves between calendars keeping the id', async () => {
    const p = mk();
    const a = await p.insertEvent('primary', ev());
    const m = await p.moveEvent('primary', a.id, 'work');
    expect(m).toMatchObject({ id: a.id, calendarId: 'work' });
    await expect(p.getEvent('primary', a.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it('outage switch throws 503/500 style errors and ping fails', async () => {
    const p = mk();
    p.setOutage(true);
    await expect(p.ping()).rejects.toBeInstanceOf(ProviderUnavailableError);
    p.setOutage(true, 500);
    await expect(p.listCalendars()).rejects.toBeInstanceOf(ProviderError);
    p.setOutage(false);
    await p.ping();
  });
  it('persists atomically to JSON with a debounced flush and reloads', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-mock-'));
    dirs.push(dir);
    const p = mk(dir);
    const a = await p.insertEvent('primary', ev());
    await p.insertEvent('work', ev({ summary: 'W' }));
    await p.patchEvent('primary', a.id, { summary: 'A2' });
    expect(fs.existsSync(path.join(dir, 'mock-google.json'))).toBe(false); // debounced
    await new Promise((r) => setTimeout(r, 60));
    const file = path.join(dir, 'mock-google.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).events).toHaveLength(2);
    expect(fs.readdirSync(dir).filter((f) => f.includes('.tmp'))).toEqual([]);
    const q = mk(dir);
    expect(q.loadedFromDisk).toBe(true);
    expect((await q.getEvent('primary', a.id)).summary).toBe('A2');
    const b = await q.insertEvent('primary', ev());
    expect(b.etag).not.toBe(a.etag);
  });
  it('flushSync writes immediately; a corrupt file starts empty', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-mock-'));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, 'mock-google.json'), '{bad');
    const p = mk(dir);
    expect(p.loadedFromDisk).toBe(false);
    await p.insertEvent('primary', ev());
    p.close();
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'mock-google.json'), 'utf8')).events).toHaveLength(1);
  });
});
