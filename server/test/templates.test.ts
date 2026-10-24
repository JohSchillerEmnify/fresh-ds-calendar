import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TemplateStore } from '../src/services/templateStore.js';
import { makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

const tpl = (over: object = {}) => ({ name: 'Packing', items: [{ title: 'Passport' }, { title: 'Charger' }], ...over });
const list = async () => (await t.json('GET', '/api/templates')).body.templates;

describe('task list templates (/api/templates, feature tasklist-templates)', () => {
  it('starts empty, saves a template with its items, estimate and category and lists by name', async () => {
    expect(await list()).toEqual([]);
    const a = await t.json('POST', '/api/templates', tpl({ name: ' Weekly shop ', estimateMinutes: 45, categoryId: 'shopping' }));
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ name: 'Weekly shop', items: [{ title: 'Passport' }, { title: 'Charger' }], estimateMinutes: 45, categoryId: 'shopping' });
    expect(a.body.id).toMatch(/^[A-Za-z0-9_-]+$/);
    await t.json('POST', '/api/templates', tpl({ name: 'packing' }));
    const all = await list();
    expect(all.map((x: any) => x.name)).toEqual(['packing', 'Weekly shop']);
    expect(all[0]).toMatchObject({ estimateMinutes: null, categoryId: null });
  });

  it('keeps item titles only (never a done state) and drops empty lines', async () => {
    const r = await t.json('POST', '/api/templates', tpl({ items: [{ title: ' Sink ' }, { title: '  ' }, { title: 'Floor' }] }));
    expect(r.body.items).toEqual([{ title: 'Sink' }, { title: 'Floor' }]);
    expect((await t.json('POST', '/api/templates', tpl({ name: 'B', items: [{ title: 'x', done: true }] }))).status).toBe(400);
  });

  it('refuses a second template with the same name, ignoring case and spaces', async () => {
    await t.json('POST', '/api/templates', tpl());
    const r = await t.json('POST', '/api/templates', tpl({ name: ' PACKING ' }));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', key: 'templates.nameTaken' });
    expect(await list()).toHaveLength(1);
  });

  it('replaces a template, keeps its own name free for itself and refuses another\'s name', async () => {
    const a = (await t.json('POST', '/api/templates', tpl())).body;
    await t.json('POST', '/api/templates', tpl({ name: 'City trip' }));
    const same = await t.json('PUT', `/api/templates/${a.id}`, tpl({ name: 'packing', items: [{ title: 'Bread' }], estimateMinutes: 30 }));
    expect(same.status).toBe(200);
    expect(same.body).toMatchObject({ id: a.id, name: 'packing', items: [{ title: 'Bread' }], estimateMinutes: 30, categoryId: null });
    expect((await t.json('PUT', `/api/templates/${a.id}`, tpl({ name: 'City Trip' }))).status).toBe(400);
    expect((await t.json('PUT', '/api/templates/nope', tpl({ name: 'Other' }))).status).toBe(404);
  });

  it('deletes a template and says 404 for an unknown one', async () => {
    const a = (await t.json('POST', '/api/templates', tpl())).body;
    expect((await t.req('DELETE', `/api/templates/${a.id}`)).status).toBe(204);
    expect(await list()).toEqual([]);
    expect((await t.req('DELETE', `/api/templates/${a.id}`)).status).toBe(404);
  });

  it.each([
    ['an empty name', tpl({ name: '  ' })],
    ['a long name', tpl({ name: 'x'.repeat(81) })],
    ['a missing item list', { name: 'A' }],
    ['a long item', tpl({ items: [{ title: 'x'.repeat(201) }] })],
    ['too many items', tpl({ items: Array.from({ length: 201 }, (_, i) => ({ title: `i${i}` })) })],
    ['a bad estimate', tpl({ estimateMinutes: 3 })],
    ['an unknown field', tpl({ date: '2026-10-14' })],
  ])('rejects %s', async (_n, body) => {
    const r = await t.json('POST', '/api/templates', body);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses more than 100 templates', async () => {
    for (let i = 0; i < 100; i++) await t.json('POST', '/api/templates', tpl({ name: `T${i}` }));
    expect((await t.json('POST', '/api/templates', tpl({ name: 'One more' }))).status).toBe(400);
  });

  it('is forgotten by the test reset', async () => {
    await t.json('POST', '/api/templates', tpl());
    await t.req('POST', '/api/__test/reset');
    expect(await list()).toEqual([]);
  });
});

describe('TemplateStore', () => {
  it('keeps each person\'s templates apart in users/<sub>/templates.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-'));
    try {
      const s = new TemplateStore(dir);
      s.add('alice', { name: 'Packing', items: [{ title: 'Passport' }] });
      expect(s.list('alice').map((x) => x.name)).toEqual(['Packing']);
      expect(s.list('bob')).toEqual([]);
      expect(fs.existsSync(path.join(dir, 'users', 'alice', 'templates.json'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
