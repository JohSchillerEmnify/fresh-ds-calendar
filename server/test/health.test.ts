import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/health', () => {
  const app = buildApp({ ...loadConfig({}), webDist: null });

  it('returns ok with provider', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.provider).toBe('mock');
  });

  it('returns JSON 404 for unknown api routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Not Found');
  });
});

describe('static web + SPA fallback', () => {
  let app: App;
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-web-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Calendar</title>');
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
    app = buildApp({ ...loadConfig({}), webDist: dir });
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('serves index.html at /', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Calendar</title>');
  });

  it('serves static assets', async () => {
    const res = await app.request('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
  });

  it('falls back to index.html for client routes', async () => {
    const res = await app.request('/week/2026-10-12');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('keeps JSON 404 under /api even with web enabled', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
