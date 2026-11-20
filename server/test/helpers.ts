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

/** Signs `email` in through the stand-in OAuth flow (sign-in must be on) and returns the session cookie. */
export async function sessionCookie(t: TestApp, email: string): Promise<string> {
  await t.json('POST', '/api/__test/oauth/account', { email });
  const start = await t.req('GET', '/api/auth/google/start');
  const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
  const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
  const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
  return cb.headers.getSetCookie().find((c) => c.startsWith('cal_session='))!.split(';')[0]!;
}

/** One person's API caller (own session). */
export type Caller = (method: string, url: string, body?: unknown) => Promise<{ status: number; body: any }>;

/** Shares a list the way people do: the owner invites, the other person accepts. Returns the shared list as the owner sees it. */
export async function shareAndAccept(owner: Caller, member: Caller, listId: string, email: string): Promise<any> {
  const sent = await owner('POST', `/api/tasklists/${encodeURIComponent(listId)}/share`, { email });
  if (sent.status !== 200) throw new Error(`invitation refused: ${sent.status}`);
  const inv = (await member('GET', '/api/invitations')).body.invitations.find((i: { kind: string }) => i.kind === 'list');
  const accepted = await member('POST', `/api/invitations/${inv.id}/accept`);
  if (accepted.status !== 200) throw new Error(`accept refused: ${accepted.status}`);
  return (await owner('GET', `/api/tasklists/${encodeURIComponent(accepted.body.listId)}`)).body;
}

/** The owner invites to a category and the other person accepts. */
export async function shareCategoryAndAccept(owner: Caller, member: Caller, categoryId: string, email: string): Promise<void> {
  const sent = await owner('PUT', `/api/categories/${categoryId}/share`, { email });
  if (sent.status !== 200) throw new Error(`invitation refused: ${sent.status}`);
  const inv = (await member('GET', '/api/invitations')).body.invitations.find((i: { kind: string }) => i.kind === 'category');
  const accepted = await member('POST', `/api/invitations/${inv.id}/accept`);
  if (accepted.status !== 200) throw new Error(`accept refused: ${accepted.status}`);
}

/** A caller for a test that holds sessions as `{ cookie }` headers. */
export const callerOf = (t: TestApp, h: { cookie: string }): Caller => (method, url, body) => t.json(method, url, body, h);
