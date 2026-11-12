/* eslint-disable @typescript-eslint/no-explicit-any -- the API answers are untyped JavaScript objects */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setDiagSink } from '../src/lib/diag.js';
import { MAX_UPLOADS } from '../src/services/diagUploads.js';
import { makeApp, sessionCookie, type TestApp } from './helpers.js';

let t: TestApp;
let jo: string;
let anna: string;
let now = Date.parse('2026-10-12T08:00:00+02:00');
let lines: string[] = [];
let restore: () => void;
beforeAll(() => { t = makeApp(); t.app.ctx.clock.real = () => now; });
afterAll(() => t.cleanup());
beforeEach(async () => {
  await t.req('POST', '/api/__test/reset');
  await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
  jo = await sessionCookie(t, 'jo@example.com');
  anna = await sessionCookie(t, 'anna@example.com');
  lines = [];
  restore = setDiagSink((l) => lines.push(l));
  return () => restore();
});

const entry = (summary: string, kind = 'error') => ({ at: '2026-10-12T06:00:00.000Z', kind, summary, app: '0.1.0', platform: 'android', standalone: false, native: true, data: { name: 'TypeError', frames: 3 } });
const log = (...entries: object[]) => ({ app: '0.1.0', exportedAt: '2026-10-12T06:00:00.000Z', entries });
const send = (cookie: string, body: unknown) => t.json('POST', '/api/diag/device-log', body, { cookie });
const uploads = async () => (await t.json('GET', '/api/__test/diag-uploads')).body.uploads as any[];
const annaSub = async () => (await uploads()).find((u) => u.entries[0].summary === 'anna')?.sub;

describe('POST /api/diag/device-log', () => {
  it('keeps the last 5 uploads per person, refuses over 256 KB and rate-limits', async () => {
    expect((await send(anna, log(entry('anna')))).status).toBe(204);
    for (let i = 0; i < 7; i++) {
      now += 61_000;
      expect((await send(jo, log(entry(`jo ${i}`)))).status).toBe(204);
    }
    const all = await uploads();
    const mine = all.filter((u) => u.sub !== all.find((x) => x.entries[0].summary === 'anna').sub);
    expect(mine.map((u) => u.entries[0].summary)).toEqual(['jo 2', 'jo 3', 'jo 4', 'jo 5', 'jo 6']);
    expect(mine).toHaveLength(MAX_UPLOADS);
    expect(all.filter((u) => u.entries[0].summary === 'anna')).toHaveLength(1);

    now += 61_000;
    const big = log(...Array.from({ length: 500 }, () => entry('x'.repeat(400))));
    expect((await send(jo, big)).status).toBe(413);
    expect((await send(jo, log(entry('one')))).status).toBe(204);
    expect((await send(jo, log(entry('two')))).status).toBe(429);
    expect((await send(anna, log(entry('anna again')))).status).toBe(204);
    now += 61_000;
    expect((await send(jo, log(entry('three')))).status).toBe(204);
  });

  it('needs a session, refuses unknown fields and wrong shapes', async () => {
    expect((await t.req('POST', '/api/diag/device-log', log(entry('a')))).status).toBe(401);
    now += 61_000;
    expect((await send(jo, { ...log(entry('a')), extra: 1 })).status).toBe(400);
    expect((await send(jo, log({ ...entry('a'), kind: 'other' }))).status).toBe(400);
    expect((await send(jo, log({ ...entry('a'), data: { nested: { a: 1 } } }))).status).toBe(400);
    expect(await uploads()).toHaveLength(0);
  });

  it('writes one log line with counts and a pseudonym, never entry text or the e-mail address', async () => {
    now += 61_000;
    await send(jo, log(entry('Dentist Meyer secret'), entry('crash java.lang.IllegalStateException', 'crash')));
    const l = lines.map((x) => JSON.parse(x)).find((x) => x.event === 'client_device_log');
    expect(l).toMatchObject({ entries: 2, crashes: 1, app: '0.1.0' });
    expect(typeof l.subHash).toBe('string');
    expect(lines.join('\n')).not.toMatch(/Dentist|example\.com/);
    expect(await annaSub()).toBeUndefined();
  });
});
