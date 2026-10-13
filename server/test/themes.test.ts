import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validatePicture, validateTheme } from '@calendar/shared';
import { makeApp, type TestApp } from './helpers.js';

const fixtures = path.join(import.meta.dirname, '../../e2e/fixtures/themes');
const ocean = () => JSON.parse(fs.readFileSync(path.join(fixtures, 'ocean.json'), 'utf8'));
const sneaky = () => fs.readFileSync(path.join(fixtures, 'sneaky.svg'), 'utf8');
const minimal = (extra: object = {}) => ({ schema: 'calendar-theme/2', name: 'X', ...extra });

describe('theme document validation', () => {
  it('accepts the minimal document and the ocean fixture', () => {
    expect(validateTheme(minimal()).ok).toBe(true);
    expect(validateTheme(ocean()).ok).toBe(true);
  });

  it('accepts the fine-tuning fields within range and refuses the rest', () => {
    expect(validateTheme(minimal({ glowStrength: 70, radius: 4, tint: 30, density: 'airy', checkbox: 'square', checkFill: 'outline', check: 'dot', icons: 'rounded' })).ok).toBe(true);
    expect(validateTheme(minimal({ icons: 'filled' })).ok).toBe(false);
    expect(validateTheme(minimal({ radius: 29 }))).toEqual({ ok: false, errors: ['radius must be between 0 and 28'] });
    expect(validateTheme(minimal({ tint: 2.5 }))).toEqual({ ok: false, errors: ['tint must be a whole number'] });
    expect(validateTheme(minimal({ glowStrength: '70' }))).toEqual({ ok: false, errors: ['glowStrength must be a whole number'] });
    expect(validateTheme(minimal({ check: 'star' })).ok).toBe(false);
  });

  it.each([
    [minimal({ glow: 'ultra' }), 'glow must be one of off, soft, neon'],
    [{ name: 'X' }, 'schema is required'],
    [minimal({ schema: 'calendar-theme/1' }), 'schema must be "calendar-theme/2"'],
    [minimal({ name: '' }), 'name must not be empty'],
    [minimal({ name: 'x'.repeat(41) }), 'name must be at most 40 characters'],
    [minimal({ colors: { seed: 'blue' } }), 'colors.seed must be a 6-digit hex colour like #1a73e8'],
    [minimal({ colors: { light: { primary: '#fff' } } }), 'colors.light.primary must be a 6-digit hex colour like #1a73e8'],
    [minimal({ colors: { light: { sparkle: '#ffffff' } } }), 'colors.light.sparkle is not a known field'],
    [minimal({ sparkle: 1 }), 'sparkle is not a known field'],
    [minimal({ font: 'comic' }), 'font must be one of system, serif, rounded, mono'],
    [minimal({ scene: {} }), 'scene needs either builtin or gradient'],
    [minimal({ scene: { builtin: 'none', gradient: ['#ffffff', '#000000'] } }), 'scene can have builtin or gradient, not both'],
    [minimal({ scene: { gradient: ['#ffffff'] } }), 'scene.gradient must have at least 2 entries'],
    [minimal({ scene: { gradient: ['#111111', '#222222', '#333333', '#444444'] } }), 'scene.gradient must have at most 3 entries'],
    [minimal({ scene: { gradient: ['#111111', 'red'] } }), 'scene.gradient[1] must be a 6-digit hex colour like #1a73e8'],
    [minimal({ scene: { gradient: 'blue' } }), 'scene.gradient must be a list'],
    [minimal({ scene: { gradient: ['#111111', '#222222'], decor: 'fireworks' } }), 'scene.decor must be one of stars, sparkles, waves, hills, hearts, clouds, confetti, bubbles'],
    [minimal({ scene: { gradient: ['#111111', '#222222'], density: 'lots' } }), 'scene.density must be one of low, medium, high'],
    [minimal({ scene: { builtin: 'none', decor: 'stars' } }), 'scene.decor and scene.density go with gradient, not with builtin'],
    [minimal({ scene: { svg: { light: '<svg/>' } } }), 'scene.svg is not a known field'],
    [[], 'The theme must be an object'],
  ])('refuses %j with a readable reason', (doc, message) => {
    const r = validateTheme(doc);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.errors).toContain(message);
  });

  it('checks the own picture', () => {
    expect(validatePicture({ light: '<svg xmlns="http://www.w3.org/2000/svg"/>' }).ok).toBe(true);
    expect(validatePicture({}).ok).toBe(false);
    expect(validatePicture({ light: 'hello' })).toEqual({ ok: false, errors: ['picture.light must be an SVG picture (starting with <svg)'] });
    expect(validatePicture({ light: '<svg>' + 'x'.repeat(101 * 1024) })).toEqual({ ok: false, errors: ['picture.light must be at most 100 KB'] });
    expect(validatePicture({ light: '<svg/>', big: 1 })).toEqual({ ok: false, errors: ['picture.big is not a known field'] });
  });
});

describe('/api/themes', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());
  beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

  it('starts empty, stores a theme, lists it and deletes it', async () => {
    expect((await t.json('GET', '/api/themes')).body).toEqual({ themes: [] });
    const created = await t.json('POST', '/api/themes', { theme: ocean() });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: expect.any(String), doc: ocean(), sanitized: false });
    const listed = (await t.json('GET', '/api/themes')).body.themes;
    expect(listed).toEqual([{ id: created.body.id, doc: ocean() }]);
    expect((await t.req('DELETE', `/api/themes/${created.body.id}`)).status).toBe(204);
    expect((await t.json('GET', '/api/themes')).body).toEqual({ themes: [] });
    expect((await t.json('DELETE', `/api/themes/${created.body.id}`)).status).toBe(404);
  });

  it('keeps the themes under the person\'s data directory', async () => {
    const { body } = await t.json('POST', '/api/themes', { theme: ocean() });
    expect(fs.existsSync(path.join(t.dir, 'users', 'local', 'themes', `${body.id}.json`))).toBe(true);
  });

  it('refuses a broken theme with the readable reason', async () => {
    const r = await t.json('POST', '/api/themes', { theme: minimal({ glow: 'ultra' }) });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'glow must be one of off, soft, neon' });
    expect((await t.json('POST', '/api/themes', undefined)).status).toBe(400);
    expect((await t.json('POST', '/api/themes', { theme: ocean(), extra: 1 })).body.error.message).toBe('extra is not a known field');
    expect((await t.json('POST', '/api/themes', ocean())).status).toBe(400);
  });

  it('stores the own picture next to the document, sanitised, and says what was removed', async () => {
    const r = await t.json('POST', '/api/themes', { theme: ocean(), picture: { light: sneaky() } });
    expect(r.status).toBe(201);
    expect(r.body.sanitized).toBe(true);
    const svg: string = r.body.picture.light;
    expect(svg).toMatch(/^<svg /);
    expect(svg).not.toMatch(/script|foreignObject|<image|onload|onmouseover|example\.com|__pwned/i);
    expect(svg).toContain('<rect');
    expect((await t.json('GET', '/api/themes')).body.themes[0].picture.light).toBe(svg);
  });

  it('refuses a broken picture', async () => {
    const r = await t.json('POST', '/api/themes', { theme: ocean(), picture: { light: 'nope' } });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe('picture.light must be an SVG picture (starting with <svg)');
  });

  it('allows at most 20 themes', async () => {
    for (let i = 0; i < 20; i++) expect((await t.json('POST', '/api/themes', { theme: minimal({ name: `T${i}` }) })).status).toBe(201);
    const r = await t.json('POST', '/api/themes', { theme: minimal({ name: 'Too many' }) });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/at most 20 themes/);
  });

  it('lets a person choose an own theme as their theme', async () => {
    const { body } = await t.json('POST', '/api/themes', { theme: ocean() });
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: `theme:${body.id}` })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs/theme')).body.preset).toBe(`theme:${body.id}`);
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'theme:../x' })).status).toBe(400);
  });
});
