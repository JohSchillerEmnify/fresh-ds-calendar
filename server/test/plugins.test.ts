/** The plugin seam (ADR 0004): the calendar ships with no plugin, and a plugin put into the registry is mounted only while it is enabled. */
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../src/context.js';
import { ApiException } from '../src/lib/errors.js';
import { enabledPlugins, pluginRoutes, plugins } from '../src/plugins/registry.js';
import { makeApp, type TestApp } from './helpers.js';

describe('the app without plugins', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());

  it('ships an empty registry', () => {
    expect(plugins).toEqual([]);
  });

  it('lists no plugin in /api/config and /api/health', async () => {
    expect((await t.json('GET', '/api/config')).body.plugins).toEqual([]);
    expect((await t.json('GET', '/api/health')).body.plugins).toEqual([]);
  });

  it('has no plugin path: /api/door is not there', async () => {
    expect((await t.json('GET', '/api/door')).status).toBe(404);
  });
});

describe('a plugin put into the registry', () => {
  const ctx = {} as Ctx;
  let on = false;
  const fake = { name: 'fake', enabled: () => on, routes: () => new Hono().get('/', (c) => c.json({ ok: true })) };
  let app: Hono;

  // the routes are mounted when the app is built, so the plugin goes in first
  beforeAll(() => { plugins.push(fake); app = new Hono().route('/api', pluginRoutes(ctx)).onError((e, c) => c.json({}, e instanceof ApiException ? e.status : 500)); });
  afterAll(() => { plugins.splice(plugins.indexOf(fake), 1); });

  it('is mounted and listed only while it is enabled', async () => {
    on = false;
    expect((await app.request('/api/fake')).status).toBe(404);
    expect(enabledPlugins(ctx)).toEqual([]);
    on = true;
    expect((await app.request('/api/fake')).status).toBe(200);
    expect(enabledPlugins(ctx)).toEqual(['fake']);
  });
});
