import { vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiClient, setApi } from '@/api/client';
import type { Settings } from '@/api/types';
import { DEFAULT_SETTINGS } from '@/stores/settings';

export type Handler = (req: { url: URL; method: string; body: any; headers: Record<string, string> }) => { status?: number; body?: unknown; headers?: Record<string, string> } | unknown;

/** fetch mock keyed by "METHOD /path" (query ignored). Records every call in `calls`. */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; url: URL; body: any; headers: Record<string, string> }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const method = init?.method ?? 'GET';
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, url, body, headers });
    const h = routes[`${method} ${url.pathname}`];
    if (!h) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nf' } }), { status: 404 });
    const r = (await h({ url, method, body, headers })) as { status?: number; body?: unknown; headers?: Record<string, string> };
    const wrapped = r && typeof r === 'object' && ('status' in r || 'body' in r) ? r : { body: r };
    if (wrapped.status === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(wrapped.body ?? null), { status: wrapped.status ?? 200, headers: wrapped.headers });
  });
  setApi(new ApiClient({ fetch: fn as unknown as typeof fetch }));
  return { fn, calls };
}

export function freshPinia() {
  const p = createPinia();
  setActivePinia(p);
  return p;
}

export const settingsFixture = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, version: 1, updated: '2026-10-12T08:00:00+02:00', ...o });

export const config = (o: Record<string, unknown> = {}) => ({
  now: '2026-10-12T06:00:00.000Z', clockFrozen: true, timeZone: 'Europe/Berlin', weekStartsOn: 1, pollIntervalMs: 30000,
  provider: 'mock', testMode: false, publicUrl: null, version: 't', placeSearchUrl: 'https://photon.test/api', mapTileUrl: 'https://tiles.test/{z}/{x}/{y}.png', ...o,
});

export const apiError = (status: number, code: string, message = code) => ({ status, body: { error: { code, message } } });

export const eventFixture = (id: string, start: string, end: string, o: Record<string, unknown> = {}) => ({
  kind: 'event', id, calendarId: 'primary', title: id, description: '', location: '', allDay: false, start, end, colorId: null,
  color: '#039be5', etag: 'etag-' + id, updated: start, ...o,
});
