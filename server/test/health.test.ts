import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { makeApp, type TestApp } from './helpers.js';

describe('GET /api/health', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp({ TEST_MODE: 'false' }); });
  afterAll(() => t.cleanup());

  it('returns ok with provider and status', async () => {
    const { status, body } = await t.json('GET', '/api/health');
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', provider: 'mock', providerStatus: 'ok', testMode: false });
    expect(typeof body.version).toBe('string');
    expect(body.time).toMatch(/[+-]\d\d:\d\d$/);
  });

  it('returns the API error format for unknown api routes', async () => {
    const { status, body } = await t.json('GET', '/api/nope');
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('static web + SPA fallback', () => {
  let app: App;
  let dir: string;
  let data: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-web-'));
    data = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-data-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Calendar</title>');
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
    app = buildApp({ ...loadConfig({ DATA_DIR: data }), webDist: dir });
  });
  afterAll(() => { app.close(); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(data, { recursive: true, force: true }); });

  it('serves index.html at /', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Calendar</title>');
  });
  it('serves static assets', async () => {
    const res = await app.request('/assets/app.js');
    expect(res.headers.get('content-type')).toContain('javascript');
  });
  it('falls back to index.html for client routes', async () => {
    const res = await app.request('/week/2026-10-12');
    expect(res.headers.get('content-type')).toContain('text/html');
  });
  it('keeps JSON 404 under /api even with web enabled', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
