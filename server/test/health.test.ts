import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/health', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp({ ...loadConfig({}), webDist: null });
  });
  afterAll(() => app.close());

  it('returns ok with provider', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.provider).toBe('mock');
  });

  it('returns JSON 404 for unknown api routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Not Found');
  });
});

describe('static web + SPA fallback', () => {
  let app: FastifyInstance;
  let dir: string;
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-web-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Calendar</title>');
    app = await buildApp({ ...loadConfig({}), webDist: dir });
  });
  afterAll(async () => {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('serves index.html at /', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>Calendar</title>');
  });

  it('falls back to index.html for client routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/week/2026-10-12' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
