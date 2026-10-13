import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateTheme } from '@calendar/shared';
import { makeApp, type TestApp } from './helpers.js';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../e2e/fixtures/themes', name), 'utf8'));
const minimal = (extra: object = {}) => ({ schema: 'calendar-theme/1', name: 'X', ...extra });

describe('theme document validation', () => {
  it('accepts the minimal document and both fixtures', () => {
    expect(validateTheme(minimal()).ok).toBe(true);
    expect(validateTheme(fixture('ocean.json')).ok).toBe(true);
    expect(validateTheme(fixture('sneaky.json')).ok).toBe(true);
  });

  it.each([
    [minimal({ glow: 'ultra' }), 'glow must be one of off, soft, neon'],
    [{ name: 'X' }, 'schema is required'],
    [minimal({ schema: 'calendar-theme/2' }), 'schema must be "calendar-theme/1"'],
    [minimal({ name: '' }), 'name must not be empty'],
    [minimal({ name: 'x'.repeat(41) }), 'name must be at most 40 characters'],
    [minimal({ colors: { seed: 'blue' } }), 'colors.seed must be a 6-digit hex colour like #1a73e8'],
    [minimal({ colors: { light: { primary: '#fff' } } }), 'colors.light.primary must be a 6-digit hex colour like #1a73e8'],
    [minimal({ colors: { light: { sparkle: '#ffffff' } } }), 'colors.light.sparkle is not a known field'],
    [minimal({ sparkle: 1 }), 'sparkle is not a known field'],
    [minimal({ font: 'comic' }), 'font must be one of system, serif, rounded, mono'],
    [minimal({ scene: {} }), 'scene needs either builtin or svg'],
    [minimal({ scene: { builtin: 'none', svg: { light: '<svg/>' } } }), 'scene can have builtin or svg, not both'],
    [minimal({ scene: { svg: { light: 'hello' } } }), 'scene.svg.light must be an SVG picture (starting with <svg)'],
    [minimal({ scene: { svg: {} } }), 'scene.svg needs light or dark'],
    [[], 'The theme must be an object'],
  ])('refuses %j with a readable reason', (doc, message) => {
    const r = validateTheme(doc);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.errors).toContain(message);
  });
});

describe('/api/themes', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());
  beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

  it('starts empty, stores a theme, lists it and deletes it', async () => {
    expect((await t.json('GET', '/api/themes')).body).toEqual({ themes: [] });
    const created = await t.json('POST', '/api/themes', fixture('ocean.json'));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ doc: { name: 'Ocean' }, sanitized: false });
    const listed = (await t.json('GET', '/api/themes')).body.themes;
    expect(listed.map((x: { id: string }) => x.id)).toEqual([created.body.id]);
    expect((await t.req('DELETE', `/api/themes/${created.body.id}`)).status).toBe(204);
    expect((await t.json('GET', '/api/themes')).body).toEqual({ themes: [] });
    expect((await t.json('DELETE', `/api/themes/${created.body.id}`)).status).toBe(404);
  });

  it('keeps the themes under the person\'s data directory', async () => {
    const { body } = await t.json('POST', '/api/themes', fixture('ocean.json'));
    expect(fs.existsSync(path.join(t.dir, 'users', 'local', 'themes', `${body.id}.json`))).toBe(true);
  });

  it('refuses a broken theme with the readable reason', async () => {
    const r = await t.json('POST', '/api/themes', minimal({ glow: 'ultra' }));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'glow must be one of off, soft, neon' });
    expect((await t.json('POST', '/api/themes', undefined)).status).toBe(400);
  });

  it('removes unsafe parts of the scene picture before storing and says so', async () => {
    const r = await t.json('POST', '/api/themes', fixture('sneaky.json'));
    expect(r.status).toBe(201);
    expect(r.body.sanitized).toBe(true);
    const svg: string = r.body.doc.scene.svg.light;
    expect(svg).toMatch(/^<svg /);
    expect(svg).not.toMatch(/script|foreignObject|<image|onload|onmouseover|example\.com|__pwned/i);
    expect(svg).toContain('<rect');
  });

  it('keeps the picture without its script when that was all that was unsafe', async () => {
    const r = await t.json('POST', '/api/themes', minimal({ scene: { svg: { light: '<svg><script>alert(1)</script></svg>' } } }));
    expect(r.status).toBe(201);
    expect(r.body.sanitized).toBe(true);
    expect(r.body.doc.scene.svg.light).not.toMatch(/script/);
  });

  it('allows at most 20 themes', async () => {
    for (let i = 0; i < 20; i++) expect((await t.json('POST', '/api/themes', minimal({ name: `T${i}` }))).status).toBe(201);
    const r = await t.json('POST', '/api/themes', minimal({ name: 'Too many' }));
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/at most 20 themes/);
  });

  it('lets a person choose an imported theme as their theme', async () => {
    const { body } = await t.json('POST', '/api/themes', fixture('ocean.json'));
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: `theme:${body.id}` })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body.preset).toBe(`theme:${body.id}`);
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'theme:../x' })).status).toBe(400);
  });
});
