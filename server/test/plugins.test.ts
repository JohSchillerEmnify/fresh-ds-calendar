/** The plugin seam (ADR 0004): the calendar ships with no plugin, and a plugin put into the registry is mounted only while it is enabled. */
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../src/context.js';
import { ApiException } from '../src/lib/errors.js';
import { enabledPlugins, pluginRoutes, plugins } from '../src/plugins/registry.js';
import { makeApp, type TestApp } from './helpers.js';

describe('the app with no plugin turned on', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());

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

  let shipped: typeof plugins;

  // only the fake is registered (a plugin that ships with the app cannot disturb the test), and before the app is built, which mounts the routes
  beforeAll(() => { shipped = plugins.splice(0, plugins.length, fake); app = new Hono().route('/api', pluginRoutes(ctx)).onError((e, c) => c.json({}, e instanceof ApiException ? e.status : 500)); });
  afterAll(() => { plugins.splice(0, plugins.length, ...shipped); });

  it('is mounted and listed only while it is enabled', async () => {
    on = false;
    expect((await app.request('/api/fake')).status).toBe(404);
    expect(enabledPlugins(ctx)).toEqual([]);
    on = true;
    expect((await app.request('/api/fake')).status).toBe(200);
    expect(enabledPlugins(ctx)).toEqual(['fake']);
  });
});
