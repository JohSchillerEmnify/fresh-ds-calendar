import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readCanvas } from '../src/services/taskCodec.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const mk = async () => (await t.json('POST', '/api/tasklists', { title: 'Taxes', date: null, items: [{ title: 'Form' }] })).body;
const raw = async (id: string) => (await t.json('GET', '/api/__test/remote/events')).body.items.find((e: any) => e.id === id);
const area = (over: object = {}) => ({ id: 'a1', name: 'Haus', color: '#1a73e8', x: 100, y: 200, w: 320, h: 240, ...over });

describe('canvas place on a task list', () => {
  it('has no place until one is saved, stores cx and cy on the event and clears them with null', async () => {
    const l = await mk();
    expect(l.canvas).toBeNull();
    const moved = await t.json('PATCH', `/api/tasklists/${l.id}`, { canvas: { x: 100, y: 260 } });
    expect(moved.status).toBe(200);
    expect(moved.body.canvas).toEqual({ x: 100, y: 260 });
    expect((await raw(l.id)).extendedProperties.private).toMatchObject({ cx: '100', cy: '260' });
    expect((await t.json('GET', `/api/tasklists/${l.id}`)).body.canvas).toEqual({ x: 100, y: 260 });
    const cleared = await t.json('PATCH', `/api/tasklists/${l.id}`, { canvas: null });
    expect(cleared.body.canvas).toBeNull();
    expect((await raw(l.id)).extendedProperties.private.cx).toBeUndefined();
  });

  it('keeps the place when the items change', async () => {
    const l = await mk();
    await t.json('PATCH', `/api/tasklists/${l.id}`, { canvas: { x: 5, y: 9 } });
    const r = await t.json('POST', `/api/tasklists/${l.id}/items`, { title: 'Stamp' });
    expect(r.body.canvas).toEqual({ x: 5, y: 9 });
    const tick = await t.json('PATCH', `/api/tasklists/${l.id}/items/${l.items[0].id}`, { done: true });
    expect(tick.body.canvas).toEqual({ x: 5, y: 9 });
  });

  it.each([{ x: -1, y: 0 }, { x: 0, y: 10001 }, { x: 1.5, y: 0 }, { x: '5', y: 0 }, { x: 1 }, { x: 1, y: 2, z: 3 }])('rejects the place %j', async (canvas) => {
    const l = await mk();
    const r = await t.json('PATCH', `/api/tasklists/${l.id}`, { canvas });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reads only two integers in range and ignores anything else', () => {
    expect(readCanvas({ cx: '0', cy: '10000' })).toEqual({ x: 0, y: 10000 });
    expect(readCanvas({ cx: '10001', cy: '5' })).toBeNull();
    expect(readCanvas({ cx: '5' })).toBeNull();
    expect(readCanvas({ cx: '5.5', cy: '5' })).toBeNull();
    expect(readCanvas({ cx: 'abc', cy: '5' })).toBeNull();
    expect(readCanvas({})).toBeNull();
  });
});

describe('canvas areas (/api/canvas)', () => {
  it('starts empty, replaces the whole document and keeps it per reset', async () => {
    expect((await t.json('GET', '/api/canvas')).body).toEqual({ version: 1, areas: [] });
    const put = await t.json('PUT', '/api/canvas', { areas: [area(), area({ id: 'a2', name: ' Arbeit ', x: 600 })] });
    expect(put.status).toBe(200);
    expect(put.body.areas.map((a: any) => a.name)).toEqual(['Haus', 'Arbeit']);
    expect((await t.json('GET', '/api/canvas')).body).toEqual(put.body);
    expect((await t.json('PUT', '/api/canvas', { areas: [area()] })).body.areas).toHaveLength(1);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/canvas')).body.areas).toEqual([]);
  });

  it.each([
    ['an unknown field', { areas: [], extra: 1 }],
    ['a missing list', {}],
    ['a duplicate id', { areas: [area(), area()] }],
    ['an empty name', { areas: [area({ name: '  ' })] }],
    ['a long name', { areas: [area({ name: 'x'.repeat(61) })] }],
    ['a bad color', { areas: [area({ color: 'red' })] }],
    ['a bad id', { areas: [area({ id: 'a b' })] }],
    ['a fractional x', { areas: [area({ x: 1.5 })] }],
    ['an x beyond the limit', { areas: [area({ x: 10001 })] }],
    ['a tiny width', { areas: [area({ w: 10 })] }],
    ['an unknown area field', { areas: [{ ...area(), z: 1 }] }],
    ['too many areas', { areas: Array.from({ length: 51 }, (_, i) => area({ id: `a${i}` })) }],
  ])('rejects %s and changes nothing', async (_n, body) => {
    await t.json('PUT', '/api/canvas', { areas: [area()] });
    const r = await t.json('PUT', '/api/canvas', body);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect((await t.json('GET', '/api/canvas')).body.areas).toHaveLength(1);
  });
});
