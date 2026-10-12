import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp, type App } from '../src/app.js';
import { loadConfig } from '../src/config.js';

export interface TestApp {
  app: App;
  dir: string;
  req(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<Response>;
  json<T = any>(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: T; res: Response }>;
  cleanup(): void;
}

export function makeApp(env: Record<string, string> = {}): TestApp {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-test-'));
  const config = { ...loadConfig({ TEST_MODE: 'true', DATA_DIR: dir, ...env }), webDist: null };
  const app = buildApp(config);
  const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.request(url, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  return {
    app, dir, req,
    async json(method, url, body, headers) {
      const res = await req(method, url, body, headers);
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, res };
    },
    cleanup() {
      app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Freeze the app clock at 2026-10-12 08:00 Europe/Berlin. */
export async function freeze(t: TestApp, now = '2026-10-12T08:00:00+02:00') {
  await t.req('POST', '/api/__test/clock', { now });
}
